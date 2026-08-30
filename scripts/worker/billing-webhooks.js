/* NEXAUREN BILLING WEBHOOK LIFECYCLE v1 */

async function billingHashWebhook(raw) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function billingRecordWebhook(e, { provider, eventId, eventType, reference, raw }) {
  const id = `${clean(provider)}:${clean(eventId)}`;
  const now = Math.floor(Date.now() / 1000);
  const payloadHash = await billingHashWebhook(raw);
  const result = await e.DB.prepare('INSERT OR IGNORE INTO webhook_events(id,provider,event_id,event_type,reference,payload_hash,status,processed_at,created_at) VALUES(?1,?2,?3,?4,?5,?6,\'received\',NULL,?7)').bind(id, provider, eventId, eventType, reference || null, payloadHash, now).run();
  return { id, duplicate: Number(result?.meta?.changes || 0) === 0 };
}

async function billingMarkWebhook(e, id, status) {
  await e.DB.prepare('UPDATE webhook_events SET status=?1,processed_at=?2 WHERE id=?3').bind(status, Math.floor(Date.now() / 1000), id).run();
}

async function billingProcessSubscriptionStatus(e, { provider, providerSubscriptionId, status, cancelledAt = null }) {
  if (!providerSubscriptionId) return { updated: false };
  const normalized = ['active','past_due','cancelled','expired','failed'].includes(status) ? status : 'pending';
  const now = Math.floor(Date.now() / 1000);
  const result = await e.DB.prepare('UPDATE subscriptions SET status=?1,cancelled_at=?2,updated_at=?3 WHERE provider=?4 AND provider_subscription_id=?5').bind(normalized, cancelledAt, now, provider, providerSubscriptionId).run();
  return { updated: Number(result?.meta?.changes || 0) > 0 };
}

async function billingProcessRefund(e, { provider, providerTransactionId, refundId, amountMinor, reason }) {
  const payment = await e.DB.prepare('SELECT id,user_id,amount_minor,status FROM payments WHERE provider=?1 AND provider_transaction_id=?2 LIMIT 1').bind(provider, String(providerTransactionId)).first();
  if (!payment) throw new Error('Refund payment not found.');
  const refundReference = `refund:${provider}:${clean(refundId || providerTransactionId)}`;
  const amount = Math.max(0, Math.floor(Number(amountMinor)));
  if (!amount) throw new Error('Invalid refund amount.');
  const existing = await e.DB.prepare('SELECT id FROM credit_transactions WHERE reference=?1 LIMIT 1').bind(refundReference).first();
  if (existing) return { processed: false, idempotent: true };
  const creditRows = await e.DB.prepare('SELECT id,amount FROM credit_transactions WHERE payment_id=?1 AND amount>0 AND type IN (\'purchase\',\'subscription\') ORDER BY created_at ASC').bind(payment.id).all();
  const granted = (creditRows?.results || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  if (!granted) return { processed: false, idempotent: false, no_credits: true };
  const ratio = Math.min(1, amount / Math.max(1, Number(payment.amount_minor)));
  const creditsToRemove = Math.max(1, Math.floor(granted * ratio));
  const now = Math.floor(Date.now() / 1000);
  await e.DB.batch([
    e.DB.prepare('INSERT INTO credit_transactions(id,user_id,amount,type,description,reference,payment_id,created_at) VALUES(?1,?2,?3,\'refund\',?4,?5,?6,?7)').bind(uuid(), payment.user_id, -creditsToRemove, `Refund: ${clean(reason).slice(0, 180)}`, refundReference, payment.id, now),
    e.DB.prepare('UPDATE payments SET status=\'refunded\',updated_at=?1 WHERE id=?2').bind(now, payment.id),
    e.DB.prepare('INSERT OR IGNORE INTO credit_balances(user_id,balance,updated_at) VALUES(?1,0,?2)').bind(payment.user_id, now),
    e.DB.prepare('UPDATE credit_balances SET balance=(SELECT COALESCE(SUM(amount),0) FROM credit_transactions WHERE user_id=?1),updated_at=?2 WHERE user_id=?1').bind(payment.user_id, now),
  ]);
  return { processed: true, credits_removed: creditsToRemove };
}

async function billingWebhook(r, e, providerName) {
  const provider = clean(providerName).toLowerCase();
  const adapter = buildPaymentProviderRegistry(e)[provider];
  if (!adapter) return json({ error: 'Payment provider not configured.' }, 503, cors(r));
  const raw = await r.clone().text();
  let payload = null;
  try { payload = JSON.parse(raw); } catch { throw new Error('Invalid webhook JSON.'); }
  const eventId = provider === 'paypal' ? clean(r.headers.get('paypal-transmission-id')) || clean(payload?.id) : clean(payload?.id || payload?.data?.id) || await billingHashWebhook(raw);
  const eventType = clean(payload?.event_type || payload?.event || payload?.type) || 'provider.webhook';
  const reference = clean(payload?.resource?.custom_id || payload?.resource?.purchase_units?.[0]?.custom_id || payload?.data?.tx_ref);
  const recorded = await billingRecordWebhook(e, { provider, eventId, eventType, reference, raw });
  if (recorded.duplicate) return json({ received: true, duplicate: true }, 200, cors(r));
  try {
    const response = await adapter.handleWebhook({ request: r, env: e, finalize: async (payment) => billingFinalizePayment(e, payment) });
    await billingMarkWebhook(e, recorded.id, 'processed');
    return response;
  } catch (error) {
    await billingMarkWebhook(e, recorded.id, 'failed');
    console.error('Billing webhook failed', String(error).slice(0, 500));
    return json({ error: 'Webhook processing failed.' }, 500, cors(r));
  }
}
