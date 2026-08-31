/* NEXAUREN BILLING SAFETY PATCH v5 */

async function billingAccountSafe(r, e) {
  const u = await currentUser(r, e);
  if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));

  let account = await billingEnsureAccount(e, u.id);
  let subscription = await e.DB.prepare('SELECT id,provider,provider_subscription_id,plan_id,status,start_date,next_billing_date,cancelled_at,created_at,updated_at,current_period_start,current_period_end,cancel_at_period_end FROM subscriptions WHERE user_id=?1 ORDER BY created_at DESC LIMIT 1').bind(u.id).first();

  const now = Math.floor(Date.now() / 1000);
  const periodEnd = Number(subscription?.current_period_end || subscription?.next_billing_date || 0);
  const expired = subscription && periodEnd > 0 && periodEnd <= now && ['cancelled','expired'].includes(String(subscription.status).toLowerCase());

  if (expired && String(account?.plan_id) !== 'free') {
    await e.DB.prepare("UPDATE billing_accounts SET plan_id='free',updated_at=?1 WHERE user_id=?2").bind(now, u.id).run();
    account = await billingEnsureAccount(e, u.id);
  }

  return json({ account, subscription: subscription || null }, 200, cors(r));
}

async function billingDebitCreditsSafe(e, { userId, amount, toolId, reference }) {
  const credits = Math.floor(Number(amount));
  if (!Number.isSafeInteger(credits) || credits <= 0) throw new Error('Invalid credit amount.');
  const safeReference = clean(reference).slice(0, 160);
  if (!safeReference) throw new Error('Usage reference is required.');
  const safeToolId = clean(toolId).slice(0, 120);
  const now = Math.floor(Date.now() / 1000);
  const debitId = uuid();

  const results = await e.DB.batch([
    e.DB.prepare(
      "INSERT INTO credit_transactions(id,user_id,amount,type,description,reference,payment_id,tool_id,created_at) SELECT ?1,?2,?3,'usage',?4,?5,NULL,?6,?7 WHERE EXISTS(SELECT 1 FROM credit_balances WHERE user_id=?2 AND balance>=?8) AND NOT EXISTS(SELECT 1 FROM credit_transactions WHERE reference=?5)",
    ).bind(debitId, userId, -credits, `Experience usage: ${safeToolId}`.slice(0, 240), safeReference, safeToolId, now, credits),
    e.DB.prepare(
      'UPDATE credit_balances SET balance=balance-?1,updated_at=?2 WHERE user_id=?3 AND balance>=?1 AND EXISTS(SELECT 1 FROM credit_transactions WHERE id=?4 AND user_id=?3 AND reference=?5)',
    ).bind(credits, now, userId, debitId, safeReference),
    e.DB.prepare(
      "INSERT INTO tool_usage(id,user_id,tool_id,credits,status,reference,created_at) SELECT ?1,?2,?3,?4,'consumed',?5,?6 WHERE EXISTS(SELECT 1 FROM credit_transactions WHERE id=?7 AND user_id=?2 AND reference=?5 AND type='usage') AND NOT EXISTS(SELECT 1 FROM tool_usage WHERE reference=?5)",
    ).bind(uuid(), userId, safeToolId, credits, safeReference, now, debitId),
  ]);

  const applied = Number(results?.[0]?.meta?.changes || 0) > 0;
  if (applied) return { applied: true, idempotent: false };

  const existing = await e.DB.prepare(
    'SELECT id,amount,tool_id,created_at FROM credit_transactions WHERE user_id=?1 AND reference=?2 LIMIT 1',
  ).bind(userId, safeReference).first();

  if (existing) return { applied: false, idempotent: true, transaction: existing };
  return { applied: false, idempotent: false, insufficient: true };
}

async function billingUsageSafe(r, e) {
  const u = await currentUser(r, e);
  if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));

  const d = await body(r);
  const toolId = clean(d?.tool_id).slice(0, 120);
  const reference = clean(d?.reference).slice(0, 160) || `usage:${uuid()}`;

  if (!toolId || !/^[A-Za-z0-9._-]{2,120}$/.test(toolId)) {
    return json({ error: 'Invalid experience id.' }, 400, cors(r));
  }

  const tool = await e.DB.prepare(
    'SELECT tool_id,credit_cost,enabled FROM tool_billing WHERE tool_id=?1 LIMIT 1',
  ).bind(toolId).first();

  if (!tool) return json({ error: 'This experience is not configured for billing.', code: 'experience_not_configured' }, 409, cors(r));
  if (Number(tool.enabled) !== 1) return json({ error: 'This experience is currently unavailable.', code: 'experience_disabled' }, 409, cors(r));

  const cost = Math.floor(Number(tool.credit_cost));
  if (!Number.isSafeInteger(cost) || cost < 0) return json({ error: 'Invalid experience credit cost.' }, 500, cors(r));

  const account = await billingEnsureAccount(e, u.id);
  if (cost === 0) return json({ success: true, charged: 0, idempotent: false, reference, balance: Number(account?.balance || 0) }, 200, cors(r));

  const result = await billingDebitCreditsSafe(e, { userId: u.id, amount: cost, toolId, reference });
  const updatedAccount = await billingEnsureAccount(e, u.id);

  if (result.insufficient) {
    return json({ error: 'Insufficient credits.', code: 'insufficient_credits', balance: Number(updatedAccount?.balance || 0), required: cost }, 402, cors(r));
  }

  return json({ success: true, charged: result.idempotent ? 0 : cost, idempotent: !!result.idempotent, reference, balance: Number(updatedAccount?.balance || 0) }, 200, cors(r));
}
