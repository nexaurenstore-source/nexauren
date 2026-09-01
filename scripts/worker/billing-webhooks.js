/* NEXAUREN BILLING WEBHOOK LIFECYCLE v4 */

async function billingHashWebhook(raw) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function billingRecordWebhook(e, { provider, eventId, eventType, reference, raw }) {
  const safeProvider = clean(provider).toLowerCase();
  const safeEventId = clean(eventId);
  if (!safeProvider || !safeEventId) throw new Error('Webhook identity is missing.');
  const id = `${safeProvider}:${safeEventId}`;
  const now = Math.floor(Date.now() / 1000);
  const payloadHash = await billingHashWebhook(raw);
  const result = await e.DB.prepare("INSERT OR IGNORE INTO webhook_events(id,provider,event_id,event_type,reference,payload_hash,status,processed_at,processing_at,created_at) VALUES(?1,?2,?3,?4,?5,?6,'received',NULL,NULL,?7)").bind(id, safeProvider, safeEventId, clean(eventType) || 'provider.webhook', reference || null, payloadHash, now).run();
  if (Number(result?.meta?.changes || 0) === 1) {
    const claim = await e.DB.prepare("UPDATE webhook_events SET status='processing',processing_at=?1 WHERE id=?2 AND status='received'").bind(now, id).run();
    return { id, duplicate: Number(claim?.meta?.changes || 0) !== 1, claimed: Number(claim?.meta?.changes || 0) === 1, status: 'processing' };
  }
  const existing = await e.DB.prepare('SELECT id,status,payload_hash,processing_at FROM webhook_events WHERE id=?1 LIMIT 1').bind(id).first();
  if (!existing) throw new Error('Webhook record could not be loaded.');
  if (existing.payload_hash && existing.payload_hash !== payloadHash) throw new Error('Webhook event payload mismatch.');
  if (existing.status === 'processed') return { id, duplicate: true, claimed: false, status: existing.status };
  if (existing.status === 'processing') {
    const processingAt = Number(existing.processing_at || 0);
    if (processingAt > 0 && now - processingAt < 600) return { id, duplicate: true, claimed: false, status: existing.status };
    const reclaim = await e.DB.prepare("UPDATE webhook_events SET status='processing',processing_at=?1,processed_at=NULL WHERE id=?2 AND status='processing' AND COALESCE(processing_at,0)=?3").bind(now, id, processingAt).run();
    return { id, duplicate: Number(reclaim?.meta?.changes || 0) === 0, claimed: Number(reclaim?.meta?.changes || 0) === 1, status: 'processing', reclaimed: Number(reclaim?.meta?.changes || 0) === 1 };
  }
  const claim = await e.DB.prepare("UPDATE webhook_events SET status='processing',processing_at=?1,processed_at=NULL WHERE id=?2 AND status IN ('received','failed')").bind(now, id).run();
  return { id, duplicate: Number(claim?.meta?.changes || 0) === 0, claimed: Number(claim?.meta?.changes || 0) === 1, status: 'processing' };
}

async function billingMarkWebhook(e, id, status) {
  const normalized = ['received','processing','processed','failed'].includes(status) ? status : 'failed';
  const now = Math.floor(Date.now() / 1000);
  if (normalized === 'processing') {
    await e.DB.prepare('UPDATE webhook_events SET status=?1,processing_at=?2 WHERE id=?3').bind(normalized, now, id).run();
    return;
  }
  await e.DB.prepare('UPDATE webhook_events SET status=?1,processed_at=?2,processing_at=NULL WHERE id=?3').bind(normalized, now, id).run();
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
  const creditRows = await e.DB.prepare("SELECT id,amount FROM credit_transactions WHERE payment_id=?1 AND amount>0 AND type IN ('purchase','subscription') ORDER BY created_at ASC").bind(payment.id).all();
  const granted = (creditRows?.results || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);
  if (!granted) return { processed: false, idempotent: false, no_credits: true };
  const priorRefunds = await e.DB.prepare("SELECT COALESCE(SUM(-amount),0) AS refunded FROM credit_transactions WHERE payment_id=?1 AND type='refund'").bind(payment.id).first();
  const alreadyRefunded = Math.max(0, Number(priorRefunds?.refunded || 0));
  const ratio = Math.min(1, amount / Math.max(1, Number(payment.amount_minor)));
  const requestedCredits = Math.max(1, Math.floor(granted * ratio));
  const creditsToRemove = Math.min(requestedCredits, Math.max(0, granted - alreadyRefunded));
  if (creditsToRemove <= 0) return { processed: false, idempotent: false, already_refunded: true };
  const now = Math.floor(Date.now() / 1000);
  await e.DB.batch([
    e.DB.prepare("INSERT INTO credit_transactions(id,user_id,amount,type,description,reference,payment_id,created_at) VALUES(?1,?2,?3,'refund',?4,?5,?6,?7)").bind(uuid(), payment.user_id, -creditsToRemove, `Refund: ${clean(reason).slice(0, 180)}`, refundReference, payment.id, now),
    e.DB.prepare("UPDATE payments SET status='refunded',updated_at=?1 WHERE id=?2").bind(now, payment.id),
    e.DB.prepare('INSERT OR IGNORE INTO credit_balances(user_id,balance,updated_at) VALUES(?1,0,?2)').bind(payment.user_id, now),
    e.DB.prepare('UPDATE credit_balances SET balance=(SELECT COALESCE(SUM(amount),0) FROM credit_transactions WHERE user_id=?1),updated_at=?2 WHERE user_id=?1').bind(payment.user_id, now),
  ]);
  return { processed: true, credits_removed: creditsToRemove };
}

/* PayPal's PAYMENT.SALE.COMPLETED is the authoritative successful recurring charge. */
async function billingProcessPayPalSaleCompleted(e, event) {
  if (clean(event?.event_type) !== 'PAYMENT.SALE.COMPLETED') return { handled: false };
  const resource = event?.resource || {};
  const providerSubscriptionId = clean(resource?.billing_agreement_id || resource?.supplementary_data?.related_ids?.billing_agreement_id);
  const providerTransactionId = clean(resource?.id || event?.id);
  const total = resource?.amount?.total ?? resource?.amount?.value;
  const currency = clean(resource?.amount?.currency || resource?.amount?.currency_code).toUpperCase();
  if (!providerSubscriptionId || !providerTransactionId || total == null || !currency) return { handled: false, ignored: true };
  const subscription = await e.DB.prepare("SELECT id,user_id,plan_id,status,provider_subscription_id FROM subscriptions WHERE provider='paypal' AND provider_subscription_id=?1 LIMIT 1").bind(providerSubscriptionId).first();
  if (!subscription) return { handled: false, ignored: true, reason: 'subscription not found' };
  if (!['active','past_due'].includes(String(subscription.status))) return { handled: false, ignored: true, reason: 'subscription not billable' };
  const details = await paypalGetSubscription({ env: e, subscriptionId: providerSubscriptionId });
  const lastPaymentTime = details?.billing_info?.last_payment?.time || resource?.create_time || resource?.update_time;
  const nextBillingTime = details?.billing_info?.next_billing_time;
  const periodStart = lastPaymentTime ? Math.floor(new Date(lastPaymentTime).getTime() / 1000) : NaN;
  const periodEnd = nextBillingTime ? Math.floor(new Date(nextBillingTime).getTime() / 1000) : NaN;
  if (!Number.isFinite(periodStart) || !Number.isFinite(periodEnd) || periodEnd <= periodStart) throw new Error('PayPal subscription period could not be determined.');
  const amountMinor = Math.round(Number(total) * 100);
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error('Invalid PayPal recurring payment amount.');
  return billingProcessSubscriptionCycle(e, { provider: 'paypal', subscriptionId: subscription.id, providerTransactionId, periodStart, periodEnd, amountMinor, currency, reference: `paypal-sale:${providerTransactionId}` });
}

async function billingWebhook(r, e, providerName) {
  const provider = clean(providerName).toLowerCase();
  const adapter = buildPaymentProviderRegistry(e)[provider];
  if (!adapter) return json({ error: 'Payment provider not configured.' }, 503, cors(r));
  const raw = await r.clone().text();
  let payload = null;
  try { payload = JSON.parse(raw); } catch { throw new Error('Invalid webhook JSON.'); }
  const eventId = provider === 'flutterwave'
    ? clean(payload?.webhook_id || payload?.id || payload?.data?.id) || await billingHashWebhook(raw)
    : provider === 'paypal'
      ? clean(payload?.id) || await billingHashWebhook(raw)
      : clean(payload?.id || payload?.data?.id) || await billingHashWebhook(raw);
  const eventType = clean(payload?.event_type || payload?.event || payload?.type) || 'provider.webhook';
  const reference = clean(payload?.resource?.custom_id || payload?.resource?.purchase_units?.[0]?.custom_id || payload?.data?.tx_ref || payload?.data?.reference);
  const recorded = await billingRecordWebhook(e, { provider, eventId, eventType, reference, raw });
  if (recorded.duplicate || !recorded.claimed) return json({ received: true, duplicate: true }, 200, cors(r));
  try {
    const response = await adapter.handleWebhook({ request: r, env: e, finalize: async (payment) => billingFinalizePayment(e, payment) });
    if (provider === 'paypal' && eventType === 'PAYMENT.SALE.COMPLETED') await billingProcessPayPalSaleCompleted(e, payload);
    await billingMarkWebhook(e, recorded.id, 'processed');
    return response;
  } catch (error) {
    await billingMarkWebhook(e, recorded.id, 'failed');
    console.error('Billing webhook failed', String(error).slice(0, 500));
    return json({ error: 'Webhook processing failed.' }, 500, cors(r));
  }
}
