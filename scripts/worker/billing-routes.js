/* NEXAUREN BILLING ROUTES v2 */
const __billingUrl = new URL(r.url);

if (__billingUrl.pathname === '/api/billing/catalog' && r.method === 'GET') {
  return billingCatalog(r, e);
}

if (__billingUrl.pathname === '/api/billing/account' && r.method === 'GET') {
  return billingAccount(r, e);
}

if (__billingUrl.pathname === '/api/billing/transactions' && r.method === 'GET') {
  return billingTransactions(r, e);
}

if (__billingUrl.pathname === '/api/billing/checkout' && r.method === 'POST') {
  return billingCheckout(r, e);
}

if (__billingUrl.pathname === '/api/billing/usage' && r.method === 'POST') {
  return billingUsageSafe(r, e);
}

if (__billingUrl.pathname === '/api/billing/subscription/cancel' && r.method === 'POST') {
  const u = await currentUser(r, e);
  if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));
  const now = Math.floor(Date.now() / 1000);
  const sub = await e.DB.prepare(
    "SELECT id,provider,provider_subscription_id,status,next_billing_date FROM subscriptions WHERE user_id=?1 AND status IN ('active','past_due') ORDER BY created_at DESC LIMIT 1",
  ).bind(u.id).first();
  if (!sub) return json({ error: 'No active subscription.' }, 404, cors(r));

  if (clean(sub.provider).toLowerCase() === 'paypal') {
    const provider = billingProviderRegistry(e).paypal;
    if (!provider?.subscriptionAction) return json({ error: 'Subscription provider does not support cancellation.' }, 503, cors(r));
    try {
      await provider.subscriptionAction({ env: e, subscriptionId: sub.provider_subscription_id, action: 'cancel' });
    } catch (error) {
      console.error('PayPal subscription cancellation failed', String(error).slice(0, 500));
      return json({ error: 'Unable to cancel the subscription with the payment provider.' }, 502, cors(r));
    }
  }

  await e.DB.prepare('UPDATE subscriptions SET cancel_at_period_end=1,updated_at=?1 WHERE id=?2').bind(now, sub.id).run();
  return json({ success: true, cancel_at_period_end: true, current_period_end: sub.next_billing_date || null }, 200, cors(r));
}

if (__billingUrl.pathname === '/api/billing/subscription/resume' && r.method === 'POST') {
  const u = await currentUser(r, e);
  if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));
  const now = Math.floor(Date.now() / 1000);
  const sub = await e.DB.prepare(
    "SELECT id,provider,provider_subscription_id,status,cancel_at_period_end FROM subscriptions WHERE user_id=?1 AND status='active' ORDER BY created_at DESC LIMIT 1",
  ).bind(u.id).first();
  if (!sub) return json({ error: 'No active subscription.' }, 404, cors(r));

  if (Number(sub.cancel_at_period_end) === 1 && clean(sub.provider).toLowerCase() === 'paypal') {
    const provider = billingProviderRegistry(e).paypal;
    if (!provider?.subscriptionAction) return json({ error: 'Subscription provider does not support resume.' }, 503, cors(r));
    try {
      await provider.subscriptionAction({ env: e, subscriptionId: sub.provider_subscription_id, action: 'resume' });
    } catch (error) {
      console.error('PayPal subscription resume failed', String(error).slice(0, 500));
      return json({ error: 'Unable to resume the subscription with the payment provider.' }, 502, cors(r));
    }
  }

  await e.DB.prepare('UPDATE subscriptions SET cancel_at_period_end=0,cancelled_at=NULL,updated_at=?1 WHERE id=?2').bind(now, sub.id).run();
  return json({ success: true, cancel_at_period_end: false }, 200, cors(r));
}

if (__billingUrl.pathname.startsWith('/api/webhooks/')) {
  const parts = __billingUrl.pathname.split('/').filter(Boolean);
  const provider = clean(parts[2]);
  if (parts.length === 3 && r.method === 'POST') return billingWebhook(r, e, provider);
}
