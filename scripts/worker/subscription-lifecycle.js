/* NEXAUREN SUBSCRIPTION LIFECYCLE v5 */

function billingCycleSeconds(interval, from) {
  const start = new Date(Number(from) * 1000);
  const unit = String(interval || 'month').toLowerCase();
  if (unit === 'day') start.setUTCDate(start.getUTCDate() + 1);
  else if (unit === 'week') start.setUTCDate(start.getUTCDate() + 7);
  else if (unit === 'quarter' || unit === 'quarterly') start.setUTCMonth(start.getUTCMonth() + 3);
  else if (unit === 'year' || unit === 'yearly') start.setUTCFullYear(start.getUTCFullYear() + 1);
  else start.setUTCMonth(start.getUTCMonth() + 1);
  return Math.floor(start.getTime() / 1000);
}

async function billingCancelSubscription(r, e) {
  const u = await currentUser(r, e);
  if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));
  const now = Math.floor(Date.now() / 1000);
  const sub = await e.DB.prepare("SELECT id,status,next_billing_date FROM subscriptions WHERE user_id=?1 AND status IN ('active','past_due') ORDER BY created_at DESC LIMIT 1").bind(u.id).first();
  if (!sub) return json({ error: 'No active subscription.' }, 404, cors(r));
  await e.DB.prepare('UPDATE subscriptions SET cancel_at_period_end=1,updated_at=?1 WHERE id=?2').bind(now, sub.id).run();
  return json({ success: true, status: sub.status, cancel_at_period_end: true, current_period_end: sub.next_billing_date || null }, 200, cors(r));
}

async function billingResumeSubscription(r, e) {
  const u = await currentUser(r, e);
  if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));
  const now = Math.floor(Date.now() / 1000);
  const sub = await e.DB.prepare("SELECT id,status FROM subscriptions WHERE user_id=?1 AND status='active' ORDER BY created_at DESC LIMIT 1").bind(u.id).first();
  if (!sub) return json({ error: 'No active subscription.' }, 404, cors(r));
  await e.DB.prepare('UPDATE subscriptions SET cancel_at_period_end=0,updated_at=?1 WHERE id=?2').bind(now, sub.id).run();
  return json({ success: true, cancel_at_period_end: false }, 200, cors(r));
}

async function billingProcessSubscriptionCycle(e, { provider, subscriptionId, providerTransactionId, periodStart, periodEnd, amountMinor, currency, reference }) {
  const sub = await e.DB.prepare(
    'SELECT s.id,s.user_id,s.plan_id,s.status,s.cancel_at_period_end,p.credits_per_cycle,p.price_minor,p.currency,p.billing_interval FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.id=?1 LIMIT 1',
  ).bind(subscriptionId).first();
  if (!sub) throw new Error('Subscription not found.');
  if (sub.status !== 'active' && sub.status !== 'past_due') throw new Error('Subscription is not billable.');

  const start = Math.floor(Number(periodStart));
  const end = Math.floor(Number(periodEnd));
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error('Invalid subscription period.');
  if (!provider || !providerTransactionId || !reference) throw new Error('Invalid recurring payment identity.');

  const expectedAmount = Number(sub.price_minor);
  const paidAmount = Number(amountMinor);
  if (!Number.isSafeInteger(expectedAmount) || expectedAmount < 0 || !Number.isSafeInteger(paidAmount) || paidAmount < 0) throw new Error('Invalid recurring payment amount.');
  if (expectedAmount !== paidAmount || String(sub.currency).toUpperCase() !== String(currency).toUpperCase()) throw new Error('Recurring payment amount mismatch.');

  const cycleKey = `${start}:${end}`;
  const creditReference = `subscription-cycle:${sub.id}:${cycleKey}`;
  const cycleId = `subscription-cycle:${sub.id}:${cycleKey}`;
  const now = Math.floor(Date.now() / 1000);

  const existingCycle = await e.DB.prepare(
    'SELECT id,status,credit_transaction_id FROM subscription_cycles WHERE subscription_id=?1 AND cycle_key=?2 LIMIT 1',
  ).bind(sub.id, cycleKey).first();
  if (existingCycle) return { processed: false, idempotent: true, cycle: existingCycle };

  const existingPayment = await e.DB.prepare(
    'SELECT id,status FROM payments WHERE provider=?1 AND provider_transaction_id=?2 LIMIT 1',
  ).bind(clean(provider), String(providerTransactionId)).first();
  const paymentId = existingPayment?.id || uuid();

  /*
   * All ledger mutations are in one D1 batch. This prevents the dangerous state
   * where credits were inserted but the cycle remained pending after a retry.
   * subscription_cycles has a unique (subscription_id,cycle_key) constraint and
   * credit_transactions has a unique reference, so concurrent/replayed webhooks
   * cannot create a second credit grant.
   */
  const statements = [
    e.DB.prepare("INSERT OR IGNORE INTO subscription_cycles(id,subscription_id,user_id,cycle_key,period_start,period_end,credits,status,credit_transaction_id,created_at,processed_at) VALUES(?1,?2,?3,?4,?5,?6,?7,'credited',?8,?9,?9)").bind(cycleId, sub.id, sub.user_id, cycleKey, start, end, Number(sub.credits_per_cycle), null, now),
  ];

  if (!existingPayment) {
    statements.push(
      e.DB.prepare("INSERT INTO payments(id,user_id,provider,provider_transaction_id,reference,amount_minor,currency,status,type,metadata,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,'successful','subscription',?8,?9,?9)").bind(paymentId, sub.user_id, clean(provider), String(providerTransactionId), reference, paidAmount, String(currency).toUpperCase(), JSON.stringify({ subscription_id: sub.id, cycle_key: cycleKey }), now),
    );
  } else if (String(existingPayment.status) !== 'successful') {
    statements.push(e.DB.prepare("UPDATE payments SET status='successful',amount_minor=?1,currency=?2,updated_at=?3 WHERE id=?4").bind(paidAmount, String(currency).toUpperCase(), now, paymentId));
  }

  const transactionId = uuid();
  statements.push(
    e.DB.prepare("INSERT OR IGNORE INTO credit_transactions(id,user_id,amount,type,description,reference,payment_id,created_at) VALUES(?1,?2,?3,'subscription',?4,?5,?6,?7)").bind(transactionId, sub.user_id, Number(sub.credits_per_cycle), `Subscription cycle: ${sub.plan_id}`, creditReference, paymentId, now),
    e.DB.prepare('INSERT OR IGNORE INTO credit_balances(user_id,balance,updated_at) VALUES(?1,0,?2)').bind(sub.user_id, now),
    e.DB.prepare('UPDATE credit_balances SET balance=(SELECT COALESCE(SUM(amount),0) FROM credit_transactions WHERE user_id=?1),updated_at=?2 WHERE user_id=?1').bind(sub.user_id, now),
  );

  const final = Number(sub.cancel_at_period_end) === 1;
  const next = final ? end : billingCycleSeconds(sub.billing_interval, end);
  statements.push(
    e.DB.prepare("UPDATE subscription_cycles SET credit_transaction_id=COALESCE((SELECT id FROM credit_transactions WHERE reference=?1 LIMIT 1),?2),status='credited',processed_at=?3 WHERE subscription_id=?4 AND cycle_key=?5").bind(creditReference, transactionId, now, sub.id, cycleKey),
    e.DB.prepare("UPDATE subscriptions SET current_period_start=?1,current_period_end=?2,next_billing_date=?3,status=?4,cancelled_at=?5,updated_at=?6 WHERE id=?7").bind(start, end, next, final ? 'cancelled' : 'active', final ? now : null, now, sub.id),
    e.DB.prepare('UPDATE billing_accounts SET plan_id=?1,updated_at=?2 WHERE user_id=?3').bind(final ? 'free' : sub.plan_id, now, sub.user_id),
  );

  await e.DB.batch(statements);

  const cycle = await e.DB.prepare('SELECT id,status,credit_transaction_id FROM subscription_cycles WHERE subscription_id=?1 AND cycle_key=?2 LIMIT 1').bind(sub.id, cycleKey).first();
  return { processed: true, idempotent: false, cycle_id: cycle?.id || cycleId, credit_transaction_id: cycle?.credit_transaction_id || transactionId };
}
