/* NEXAUREN PAYPAL LIFECYCLE PATCH
 * Loaded after payment-providers.js so the PayPal adapter is fully wired.
 */

async function paypalGetSubscription(env, subscriptionId) {
  const token = await paypalAccessToken(env);
  const response = await fetch(`${paypalBase(env)}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    headers: paypalHeaders(token),
  });
  return providerJson(response);
}

async function paypalSubscriptionWebhook({ request, env }) {
  const raw = await request.clone().text();
  let event;
  try { event = JSON.parse(raw); } catch { throw new Error('Invalid PayPal webhook JSON.'); }
  await paypalVerifyWebhook(env, request, event);

  const type = clean(event?.event_type);
  const resource = event?.resource || {};
  const subscriptionId = clean(resource?.id || resource?.billing_agreement_id);

  if (type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
    if (!subscriptionId) throw new Error('PayPal subscription ID missing.');
    const customId = clean(resource?.custom_id);
    if (!customId) return json({ received: true, ignored: true }, 200);
    const payment = await env.DB.prepare(
      'SELECT id,user_id,type,amount_minor,currency,metadata FROM payments WHERE reference=?1 LIMIT 1',
    ).bind(customId).first();
    if (!payment || payment.type !== 'subscription') throw new Error('Subscription payment reference not found.');
    const meta = JSON.parse(payment.metadata || '{}');
    const existing = await env.DB.prepare(
      'SELECT id FROM subscriptions WHERE provider=?1 AND provider_subscription_id=?2 LIMIT 1',
    ).bind('paypal', subscriptionId).first();
    if (!existing) {
      const plan = await env.DB.prepare(
        'SELECT id FROM plans WHERE id=?1 AND enabled=1 LIMIT 1',
      ).bind(meta.product_id).first();
      if (!plan) throw new Error('Subscription plan not found.');
      const now = Math.floor(Date.now() / 1000);
      const remote = await paypalGetSubscription(env, subscriptionId);
      const start = Math.floor(new Date(remote?.start_time || Date.now()).getTime() / 1000);
      const next = remote?.billing_info?.next_billing_time ? Math.floor(new Date(remote.billing_info.next_billing_time).getTime() / 1000) : null;
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO subscriptions(id,user_id,provider,provider_subscription_id,plan_id,status,start_date,next_billing_date,cancelled_at,created_at,updated_at) VALUES(?1,?2,'paypal',?3,?4,'active',?5,?6,NULL,?5,?5)",
        ).bind(uuid(), payment.user_id, subscriptionId, plan.id, start, next),
        env.DB.prepare(
          'UPDATE payments SET provider_transaction_id=?1,metadata=?2,updated_at=?3 WHERE id=?4',
        ).bind(subscriptionId, JSON.stringify({ ...meta, provider_subscription_id: subscriptionId }), now, payment.id),
      ]);
    }
    return json({ received: true, processed: true, subscription_id: subscriptionId }, 200);
  }

  if (type === 'PAYMENT.SALE.COMPLETED') {
    const saleId = clean(resource?.id);
    const agreementId = clean(resource?.billing_agreement_id);
    if (!saleId || !agreementId) return json({ received: true, ignored: true }, 200);
    const sub = await env.DB.prepare(
      "SELECT s.id,s.user_id,s.status,s.plan_id,s.current_period_end,p.price_minor,p.currency FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.provider='paypal' AND s.provider_subscription_id=?1 LIMIT 1",
    ).bind(agreementId).first();
    if (!sub) throw new Error('PayPal subscription not found for sale.');
    const amount = Number(resource?.amount?.total || resource?.amount?.value);
    const currency = String(resource?.amount?.currency || resource?.amount?.currency_code || '').toUpperCase();
    if (!Number.isFinite(amount)) throw new Error('PayPal sale amount missing.');
    const remote = await paypalGetSubscription(env, agreementId);
    const periodEnd = remote?.billing_info?.next_billing_time ? Math.floor(new Date(remote.billing_info.next_billing_time).getTime() / 1000) : 0;
    const periodStart = sub.current_period_end ? Number(sub.current_period_end) : Math.floor(new Date(resource?.create_time || Date.now()).getTime() / 1000);
    if (!periodEnd || periodEnd <= periodStart) throw new Error('PayPal subscription period could not be determined.');
    await billingProcessSubscriptionCycle(env, {
      provider: 'paypal',
      subscriptionId: sub.id,
      providerTransactionId: saleId,
      periodStart,
      periodEnd,
      amountMinor: Math.round(amount * 100),
      currency,
      reference: `subscription-sale:${agreementId}:${saleId}`,
    });
    return json({ received: true, processed: true }, 200);
  }

  if (type === 'PAYMENT.SALE.REFUNDED') {
    const saleId = clean(resource?.id);
    if (!saleId) return json({ received: true, ignored: true }, 200);
    const amount = Number(resource?.amount?.total || resource?.amount?.value);
    const currency = String(resource?.amount?.currency || resource?.amount?.currency_code || '').toUpperCase();
    const payment = await env.DB.prepare('SELECT amount_minor,currency FROM payments WHERE provider=?1 AND provider_transaction_id=?2 LIMIT 1').bind('paypal', saleId).first();
    if (!payment) throw new Error('Refund payment not found.');
    if (String(payment.currency).toUpperCase() !== currency) throw new Error('Refund currency mismatch.');
    await billingProcessRefund(env, { provider: 'paypal', providerTransactionId: saleId, refundId: clean(resource?.id) || event.id, amountMinor: Math.round(amount * 100), reason: 'PayPal refund' });
    return json({ received: true, processed: true }, 200);
  }

  if (type === 'PAYMENT.SALE.REVERSED') {
    if (subscriptionId) await billingProcessSubscriptionStatus(env, { provider: 'paypal', providerSubscriptionId: subscriptionId, status: 'past_due' });
    return json({ received: true, processed: true }, 200);
  }

  const statusMap = {
    'BILLING.SUBSCRIPTION.CANCELLED': 'cancelled',
    'BILLING.SUBSCRIPTION.EXPIRED': 'expired',
    'BILLING.SUBSCRIPTION.SUSPENDED': 'past_due',
    'BILLING.SUBSCRIPTION.PAYMENT.FAILED': 'past_due',
    'BILLING.SUBSCRIPTION.UPDATED': null,
    'BILLING.SUBSCRIPTION.CREATED': 'pending',
  };
  if (Object.prototype.hasOwnProperty.call(statusMap, type)) {
    if (!subscriptionId) throw new Error('PayPal subscription ID missing.');
    const status = statusMap[type];
    if (status) await billingProcessSubscriptionStatus(env, { provider: 'paypal', providerSubscriptionId: subscriptionId, status });
    if (status === 'cancelled' || status === 'expired') {
      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(
        "UPDATE billing_accounts SET plan_id='free',updated_at=?1 WHERE user_id=(SELECT user_id FROM subscriptions WHERE provider='paypal' AND provider_subscription_id=?2 LIMIT 1)",
      ).bind(now, subscriptionId).run();
    }
    return json({ received: true, processed: true }, 200);
  }

  return json({ received: true, ignored: true }, 200);
}

async function paypalHandleWebhookPatched(args) {
  const event = await args.request.clone().json();
  if (String(event?.event_type || '').startsWith('BILLING.SUBSCRIPTION.') || String(event?.event_type || '').startsWith('PAYMENT.SALE.')) {
    return paypalSubscriptionWebhook(args);
  }
  return paypalHandleWebhook(args);
}

function createPayPalProviderPatched() {
  return Object.freeze({ name: 'paypal', createCheckout: paypalCreateCheckout, handleWebhook: paypalHandleWebhookPatched });
}

function buildPaymentProviderRegistryPatched(env) {
  const configured = clean(env.PAYMENT_PROVIDER).toLowerCase();
  const registry = { paypal: createPayPalProviderPatched(), flutterwave: createFlutterwaveProvider() };
  return configured && registry[configured] ? Object.freeze({ [configured]: registry[configured] }) : Object.freeze({});
}

// billingProviderRegistry() and billingWebhook() prefer this patched registry.
