/* NEXAUREN BILLING ROUTES — PAYPAL */
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
    const product = await provider.createProduct({
      env: e,
      name,
      description,
      type,
      category,
      imageUrl,
      homeUrl,
      requestId: `nexauren-product-${crypto.randomUUID()}`,
    });
    return json({ success: true, product }, 201, cors(r));
  } catch (error) {
    console.error('PayPal product creation failed', String(error).slice(0, 500));
    return json({ error: 'Unable to create the PayPal product.' }, 502, cors(r));
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
    if (orderReference !== reference || paypalCurrency !== String(payment.currency).toUpperCase() || paypalAmount !== expectedAmount) {
      return json({ error: 'PayPal order verification mismatch.' }, 409, cors(r));
    }
    if (String(order?.status || '').toUpperCase() !== 'COMPLETED') {
      const captured = await provider.captureCheckout({ env: e, orderId });
      if (String(captured?.status || '').toUpperCase() !== 'COMPLETED') return json({ error: 'PayPal payment is not completed.' }, 409, cors(r));
    }
    const finalOrder = await provider.getOrder({ env: e, orderId });
    const finalPurchase = finalOrder?.purchase_units?.[0];
    const finalAmount = String(finalPurchase?.amount?.value || '');
    const finalCurrency = String(finalPurchase?.amount?.currency_code || '').toUpperCase();
    if (String(finalOrder?.status || '').toUpperCase() !== 'COMPLETED' || finalAmount !== expectedAmount || finalCurrency !== String(payment.currency).toUpperCase()) {
      return json({ error: 'PayPal payment verification failed.' }, 409, cors(r));
    }
    let metadata = {};
    try { metadata = JSON.parse(payment.metadata || '{}'); } catch { metadata = {}; }
    const finalized = await billingFinalizePayment(e, {
      provider: 'paypal',
      reference,
      providerTransactionId: orderId,
      status: 'successful',
      userId: u.id,
      amountMinor: payment.amount_minor,
      currency: payment.currency,
      type: payment.type,
      productId: metadata.product_id,
      metadata: { ...metadata, paypal_order_id: orderId, paypal_status: 'COMPLETED' },
    });
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
  try {
    await provider.subscriptionAction({ env: e, subscriptionId: sub.provider_subscription_id, action: 'cancel' });
  } catch (error) {
    console.error('Subscription cancellation failed', String(error).slice(0, 300));
    return json({ error: 'Unable to cancel the subscription with the payment provider.' }, 502, cors(r));
  }
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
