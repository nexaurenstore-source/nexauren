/* NEXAUREN BILLING ROUTES — PAYPAL */
// This file is a Worker fetch(r, e) route fragment; it is validated by wrapping it in an async function.
const __billingUrl = new URL(r.url);

if (__billingUrl.pathname === '/api/billing/catalog' && r.method === 'GET') return billingCatalog(r, e);
if (__billingUrl.pathname === '/api/billing/account' && r.method === 'GET') return billingAccountSafe(r, e);

if (__billingUrl.pathname === '/api/admin/paypal/products' && r.method === 'POST') {
  const admin = await isAdmin(r, e);
  if (!admin) return json({ error: 'Admin access required.' }, 403, cors(r));
  const provider = billingProviderRegistry(e).paypal;
  if (!provider?.createProduct) return json({ error: 'PayPal provider is not configured.' }, 503, cors(r));
  const d = await body(r);
  const name = clean(d?.name).slice(0, 127);
  const description = clean(d?.description).slice(0, 256);
  const type = clean(d?.type || 'SERVICE').toUpperCase();
  const category = clean(d?.category || 'SOFTWARE').toUpperCase();
  const imageUrl = clean(d?.image_url);
  const homeUrl = clean(d?.home_url);
  if (!name) return json({ error: 'Product name is required.' }, 400, cors(r));
  try {
    const product = await provider.createProduct({ env: e, name, description, type, category, imageUrl, homeUrl, requestId: `nexauren-product-${crypto.randomUUID()}` });
    return json({ success: true, product }, 201, cors(r));
  } catch (error) {
    console.error('PayPal product creation failed', String(error).slice(0, 500));
    return json({ error: 'Unable to create the PayPal product.' }, 502, cors(r));
  }
}

if (__billingUrl.pathname === '/api/admin/paypal/plans' && r.method === 'POST') {
  const admin = await isAdmin(r, e);
  if (!admin) return json({ error: 'Admin access required.' }, 403, cors(r));
  const provider = billingProviderRegistry(e).paypal;
  if (!provider?.createPlan) return json({ error: 'PayPal plan creation is not configured.' }, 503, cors(r));
  const d = await body(r);
  const planId = clean(d?.plan_id).toLowerCase().replace(/[^a-z0-9_-]+/g, '_').slice(0, 64);
  const productId = clean(d?.product_id).slice(0, 50);
  const name = clean(d?.name).slice(0, 127);
  const description = clean(d?.description).slice(0, 127);
  const priceMinor = Number(d?.price_minor);
  const currency = clean(d?.currency || 'USD').toUpperCase();
  const intervalUnit = clean(d?.interval_unit || 'MONTH').toUpperCase();
  const intervalCount = Number(d?.interval_count || 1);
  const trialDays = Number(d?.trial_days || 0);
  const credits = Number(d?.credits_per_cycle || 0);
  const enabled = d?.enabled === false ? 0 : 1;
  if (!planId || !productId || !name) return json({ error: 'plan_id, product_id and name are required.' }, 400, cors(r));
  if (!Number.isSafeInteger(priceMinor) || priceMinor < 0) return json({ error: 'Invalid price.' }, 400, cors(r));
  if (!/^[A-Z]{3}$/.test(currency)) return json({ error: 'Invalid currency.' }, 400, cors(r));
  if (!['DAY','WEEK','MONTH','YEAR'].includes(intervalUnit)) return json({ error: 'Invalid interval.' }, 400, cors(r));
  if (!Number.isInteger(intervalCount) || intervalCount < 1 || intervalCount > 12) return json({ error: 'Invalid interval count.' }, 400, cors(r));
  if (!Number.isInteger(trialDays) || trialDays < 0 || trialDays > 365) return json({ error: 'Invalid trial days.' }, 400, cors(r));
  if (!Number.isInteger(credits) || credits < 0) return json({ error: 'Invalid credits per cycle.' }, 400, cors(r));
  const interval = intervalUnit === 'DAY' ? 'day' : intervalUnit === 'WEEK' ? 'week' : intervalUnit === 'YEAR' ? 'year' : 'month';
  try {
    const existing = await e.DB.prepare('SELECT id,paypal_plan_id FROM plans WHERE id=?1 LIMIT 1').bind(planId).first();
    if (existing?.paypal_plan_id) return json({ error: 'This local plan already has a PayPal plan.', plan_id: planId, paypal_plan_id: existing.paypal_plan_id }, 409, cors(r));
    const remote = await provider.createPlan({ env: e, productId, name, description, priceMinor, currency, intervalUnit, intervalCount, trialDays, requestId: `nexauren-plan-${crypto.randomUUID()}` });
    const now = Math.floor(Date.now() / 1000);
    await e.DB.prepare(`INSERT INTO plans(id,name,price_minor,currency,billing_interval,credits_per_cycle,enabled,created_at,updated_at,paypal_product_id,paypal_plan_id) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?8,?9,?10) ON CONFLICT(id) DO UPDATE SET name=excluded.name,price_minor=excluded.price_minor,currency=excluded.currency,billing_interval=excluded.billing_interval,credits_per_cycle=excluded.credits_per_cycle,enabled=excluded.enabled,updated_at=excluded.updated_at,paypal_product_id=excluded.paypal_product_id,paypal_plan_id=excluded.paypal_plan_id`).bind(planId, name, priceMinor, currency, interval, credits, enabled, now, productId, clean(remote?.id)).run();
    return json({ success: true, plan: { id: planId, name, price_minor: priceMinor, currency, billing_interval: interval, credits_per_cycle: credits, paypal_product_id: productId, paypal_plan_id: clean(remote?.id), paypal: remote } }, 201, cors(r));
  } catch (error) {
    console.error('PayPal plan creation failed', String(error).slice(0, 700));
    const issue = clean(error?.paypalIssue || 'PAYPAL_PLAN_CREATE_FAILED');
    const description = clean(error?.paypalDescription || error?.message || 'PayPal plan creation failed.').slice(0, 500);
    const debugId = clean(error?.paypalDebugId || '');
    return json({ error: `Unable to create the PayPal plan: ${issue}: ${description}`, paypal_issue: issue, paypal_debug_id: debugId || undefined }, 502, cors(r));
  }
}

if (__billingUrl.pathname === '/api/billing/payment' && r.method === 'GET') return billingPaymentStatus(r, e);

if (__billingUrl.pathname === '/api/billing/payment' && r.method === 'POST') {
  const u = await currentUser(r, e);
  if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));
  const d = await body(r);
  const reference = clean(d?.reference).slice(0, 180);
  if (!reference) return json({ error: 'reference is required.' }, 400, cors(r));
  const payment = await e.DB.prepare('SELECT id,user_id,provider,reference,amount_minor,currency,status,type,provider_transaction_id,metadata,created_at,updated_at FROM payments WHERE user_id=?1 AND reference=?2 LIMIT 1').bind(u.id, reference).first();
  if (!payment) return json({ error: 'Payment not found.' }, 404, cors(r));
  if (payment.status === 'successful') return json({ payment }, 200, cors(r));
  if (String(payment.provider).toLowerCase() !== 'paypal') return json({ error: 'Payment provider mismatch.' }, 409, cors(r));
  const provider = billingProviderRegistry(e).paypal;

  // PayPal subscriptions are approved through /v1/billing/subscriptions and must never be captured as Orders.
  if (payment.type === 'subscription') {
    if (!provider?.getSubscription) return json({ error: 'PayPal subscription verification is not configured.' }, 503, cors(r));
    const subscriptionId = clean(payment.provider_transaction_id);
    if (!subscriptionId) return json({ error: 'PayPal subscription is not associated with this payment.' }, 409, cors(r));
    try {
      const details = await provider.getSubscription({ env: e, subscriptionId });
      const paypalStatus = String(details?.status || '').toUpperCase();
      let metadata = {};
      try { metadata = JSON.parse(payment.metadata || '{}'); } catch { metadata = {}; }
      const planId = clean(metadata.product_id);
      if (!planId || paypalStatus !== 'ACTIVE') {
        return json({ success: false, pending: true, payment: { ...payment, provider_transaction_id: subscriptionId }, subscription: { id: subscriptionId, status: paypalStatus || 'APPROVAL_PENDING' } }, 200, cors(r));
      }
      const plan = await e.DB.prepare('SELECT id,price_minor,currency,credits_per_cycle FROM plans WHERE id=?1 AND enabled=1 LIMIT 1').bind(planId).first();
      if (!plan) return json({ error: 'Subscription plan not found.' }, 409, cors(r));
      if (Number(plan.price_minor) !== Number(payment.amount_minor) || String(plan.currency).toUpperCase() !== String(payment.currency).toUpperCase()) return json({ error: 'Subscription plan price mismatch.' }, 409, cors(r));
      const now = Math.floor(Date.now() / 1000);
      const start = details?.start_time ? Math.floor(new Date(details.start_time).getTime() / 1000) : now;
      const next = details?.billing_info?.next_billing_time ? Math.floor(new Date(details.billing_info.next_billing_time).getTime() / 1000) : null;
      const local = await e.DB.prepare("SELECT id,status FROM subscriptions WHERE provider='paypal' AND provider_subscription_id=?1 LIMIT 1").bind(subscriptionId).first();
      if (local) {
        await e.DB.prepare('UPDATE subscriptions SET plan_id=?1,status=\'active\',start_date=?2,next_billing_date=?3,current_period_start=?2,current_period_end=?3,updated_at=?4 WHERE id=?5').bind(planId, start, next, now, local.id).run();
      }
      await e.DB.prepare('UPDATE billing_accounts SET plan_id=?1,updated_at=?2 WHERE user_id=?3').bind(planId, now, u.id).run();
      const finalized = await billingFinalizePayment(e, { provider: 'paypal', reference, providerTransactionId: subscriptionId, status: 'successful', userId: u.id, amountMinor: payment.amount_minor, currency: payment.currency, type: 'subscription', productId: planId, metadata: { ...metadata, provider_subscription_id: subscriptionId, paypal_subscription_status: paypalStatus } });
      return json({ success: true, payment: { ...payment, status: 'successful', provider_transaction_id: subscriptionId }, subscription: { id: subscriptionId, status: 'ACTIVE', plan_id: planId, start_date: start, next_billing_date: next }, finalized }, 200, cors(r));
    } catch (error) {
      console.error('PayPal subscription verification failed', String(error).slice(0, 500));
      return json({ error: 'Unable to verify the PayPal subscription.' }, 502, cors(r));
    }
  }

  if (!provider?.captureCheckout || !provider?.getOrder) return json({ error: 'PayPal provider is not configured.' }, 503, cors(r));
  const orderId = clean(payment.provider_transaction_id);
  if (!orderId) return json({ error: 'PayPal order is not associated with this payment.' }, 409, cors(r));
  try {
    const order = await provider.getOrder({ env: e, orderId });
    const purchase = order?.purchase_units?.[0];
    const orderReference = clean(purchase?.custom_id || purchase?.invoice_id || purchase?.reference_id);
    const paypalAmount = String(purchase?.amount?.value || '');
    const paypalCurrency = String(purchase?.amount?.currency_code || '').toUpperCase();
    const expectedAmount = (Number(payment.amount_minor) / 100).toFixed(2);
    if (orderReference !== reference || paypalCurrency !== String(payment.currency).toUpperCase() || paypalAmount !== expectedAmount) return json({ error: 'PayPal order verification mismatch.' }, 409, cors(r));
    if (String(order?.status || '').toUpperCase() !== 'COMPLETED') {
      const captured = await provider.captureCheckout({ env: e, orderId });
      if (String(captured?.status || '').toUpperCase() !== 'COMPLETED') return json({ error: 'PayPal payment is not completed.' }, 409, cors(r));
    }
    const finalOrder = await provider.getOrder({ env: e, orderId });
    const finalPurchase = finalOrder?.purchase_units?.[0];
    const finalAmount = String(finalPurchase?.amount?.value || '');
    const finalCurrency = String(finalPurchase?.amount?.currency_code || '').toUpperCase();
    if (String(finalOrder?.status || '').toUpperCase() !== 'COMPLETED' || finalAmount !== expectedAmount || finalCurrency !== String(payment.currency).toUpperCase()) return json({ error: 'PayPal payment verification failed.' }, 409, cors(r));
    let metadata = {};
    try { metadata = JSON.parse(payment.metadata || '{}'); } catch { metadata = {}; }
    const finalized = await billingFinalizePayment(e, { provider: 'paypal', reference, providerTransactionId: orderId, status: 'successful', userId: u.id, amountMinor: payment.amount_minor, currency: payment.currency, type: payment.type, productId: metadata.product_id, metadata: { ...metadata, paypal_order_id: orderId, paypal_status: 'COMPLETED' } });
    return json({ success: true, payment: { ...payment, status: 'successful', provider_transaction_id: orderId }, finalized }, 200, cors(r));
  } catch (error) {
    console.error('PayPal capture failed', String(error).slice(0, 300));
    return json({ error: 'Unable to verify or capture the PayPal payment.' }, 502, cors(r));
  }
}

if (__billingUrl.pathname === '/api/billing/transactions' && r.method === 'GET') return billingTransactions(r, e);
if (__billingUrl.pathname === '/api/billing/checkout' && r.method === 'POST') return billingCheckout(r, e);
if (__billingUrl.pathname === '/api/billing/usage' && r.method === 'POST') return billingUsageSafe(r, e);

if (__billingUrl.pathname === '/api/billing/subscription/cancel' && r.method === 'POST') {
  const u = await currentUser(r, e);
  if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));
  const now = Math.floor(Date.now() / 1000);
  const sub = await e.DB.prepare("SELECT id,provider,provider_subscription_id,status,next_billing_date FROM subscriptions WHERE user_id=?1 AND status IN ('active','past_due') ORDER BY created_at DESC LIMIT 1").bind(u.id).first();
  if (!sub) return json({ error: 'No active subscription.' }, 404, cors(r));
  const provider = billingProviderRegistry(e)[clean(sub.provider).toLowerCase()];
  if (!provider?.subscriptionAction) return json({ error: 'Subscription provider does not support cancellation yet.' }, 503, cors(r));
  try { await provider.subscriptionAction({ env: e, subscriptionId: sub.provider_subscription_id, action: 'cancel' }); }
  catch (error) { console.error('Subscription cancellation failed', String(error).slice(0, 300)); return json({ error: 'Unable to cancel the subscription with the payment provider.' }, 502, cors(r)); }
  await e.DB.prepare('UPDATE subscriptions SET cancel_at_period_end=1,updated_at=?1 WHERE id=?2').bind(now, sub.id).run();
  return json({ success: true, cancel_at_period_end: true, current_period_end: sub.next_billing_date || null }, 200, cors(r));
}

if (__billingUrl.pathname === '/api/billing/subscription/resume' && r.method === 'POST') {
  const u = await currentUser(r, e);
  if (!u) return json({ error: 'Authentication required.' }, 401, cors(r));
  const now = Math.floor(Date.now() / 1000);
  const sub = await e.DB.prepare("SELECT id,provider,provider_subscription_id,status,cancel_at_period_end FROM subscriptions WHERE user_id=?1 AND status='active' ORDER BY created_at DESC LIMIT 1").bind(u.id).first();
  if (!sub) return json({ error: 'No active subscription.' }, 404, cors(r));
  const provider = billingProviderRegistry(e)[clean(sub.provider).toLowerCase()];
  if (!provider?.subscriptionAction) return json({ error: 'Subscription provider does not support resume yet.' }, 503, cors(r));
  if (Number(sub.cancel_at_period_end) === 1) {
    try { await provider.subscriptionAction({ env: e, subscriptionId: sub.provider_subscription_id, action: 'resume' }); }
    catch (error) { console.error('Subscription resume failed', String(error).slice(0, 300)); return json({ error: 'Unable to resume the subscription with the payment provider.' }, 502, cors(r)); }
  }
  await e.DB.prepare('UPDATE subscriptions SET cancel_at_period_end=0,cancelled_at=NULL,updated_at=?1 WHERE id=?2').bind(now, sub.id).run();
  return json({ success: true, cancel_at_period_end: false }, 200, cors(r));
}

if (__billingUrl.pathname.startsWith('/api/webhooks/')) {
  const parts = __billingUrl.pathname.split('/').filter(Boolean);
  const provider = clean(parts[2]);
  if (parts.length === 3 && r.method === 'POST') return billingWebhook(r, e, provider);
  if (parts.length === 3) return json({ error: 'Method not allowed.' }, 405, { ...cors(r), Allow: 'POST' });
  return json({ error: 'Not found' }, 404, cors(r));
}

if (__billingUrl.pathname.startsWith('/api/billing/')) return json({ error: 'Not found' }, 404, cors(r));