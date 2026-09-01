/* Nexauren PayPal provider — Orders v2 / Catalog Products / Subscriptions.
 * Secrets are read exclusively from Cloudflare Worker env bindings.
 */

const PAYPAL_SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';
const PAYPAL_LIVE_BASE = 'https://api-m.paypal.com';

function paypalBaseUrl(env) {
  return String(env?.PAYPAL_ENVIRONMENT || 'sandbox').toLowerCase() === 'live' ? PAYPAL_LIVE_BASE : PAYPAL_SANDBOX_BASE;
}
function requirePaypalCredentials(env) {
  if (!env?.PAYPAL_CLIENT_ID || !env?.PAYPAL_CLIENT_SECRET) throw new Error('PayPal credentials are not configured');
}
async function paypalAccessToken(env) {
  requirePaypalCredentials(env);
  const basic = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${paypalBaseUrl(env)}/v1/oauth2/token`, { method: 'POST', headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'Accept-Language': 'en_US' }, body: 'grant_type=client_credentials' });
  if (!response.ok) throw new Error(`PayPal OAuth failed (${response.status})`);
  const data = await response.json();
  if (!data?.access_token) throw new Error('PayPal OAuth returned no access token');
  return data.access_token;
}
async function paypalApi(env, path, options = {}) {
  const token = await paypalAccessToken(env);
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`); headers.set('Accept', 'application/json');
  if (options.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${paypalBaseUrl(env)}${path}`, { ...options, headers });
}
async function paypalJson(response) {
  const text = await response.text(); let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const issue = clean(data?.details?.[0]?.issue || data?.name || 'PAYPAL_API_ERROR');
    const description = clean(data?.details?.[0]?.description || data?.message || 'PayPal rejected the request.');
    const error = new Error(`PayPal API error (${response.status}): ${issue}: ${description}`);
    error.paypalStatus = response.status; error.paypalIssue = issue; error.paypalDescription = description; error.paypalDebugId = clean(data?.debug_id || response.headers.get('PayPal-Debug-Id') || '');
    throw error;
  }
  return data;
}
async function paypalCreateProduct({ env, name, description, type = 'SERVICE', category = 'SOFTWARE', imageUrl = '', homeUrl = '', requestId = '' }) {
  const productName = clean(name).slice(0, 127), productDescription = clean(description).slice(0, 256), productType = clean(type).toUpperCase(), productCategory = clean(category).toUpperCase();
  if (!productName) throw new Error('PayPal product name is required.');
  if (!['PHYSICAL', 'DIGITAL', 'SERVICE'].includes(productType)) throw new Error('Invalid PayPal product type.');
  if (!/^[A-Z_]{4,256}$/.test(productCategory)) throw new Error('Invalid PayPal product category.');
  const payload = { name: productName, description: productDescription || undefined, type: productType, category: productCategory, ...(clean(imageUrl) ? { image_url: clean(imageUrl).slice(0, 2000) } : {}), ...(clean(homeUrl) ? { home_url: clean(homeUrl).slice(0, 2000) } : {}) };
  const headers = {}; if (clean(requestId)) headers['PayPal-Request-Id'] = clean(requestId).slice(0, 108);
  return paypalJson(await paypalApi(env, '/v1/catalogs/products', { method: 'POST', headers, body: JSON.stringify(payload) }));
}
async function paypalCreatePlan({ env, productId, name, description, priceMinor, currency = 'USD', intervalUnit = 'MONTH', intervalCount = 1, trialDays = 0, requestId = '' }) {
  const product = clean(productId), planName = clean(name).slice(0, 127), planDescription = clean(description).slice(0, 127), currencyCode = clean(currency).toUpperCase(), unit = clean(intervalUnit).toUpperCase(), count = Number(intervalCount), minor = Number(priceMinor), trial = Number(trialDays || 0);
  if (!product) throw new Error('PayPal product ID is required.'); if (!planName) throw new Error('PayPal plan name is required.');
  if (!['DAY', 'WEEK', 'MONTH', 'YEAR'].includes(unit)) throw new Error('Invalid billing interval.');
  const maxIntervalCount = unit === 'DAY' ? 365 : unit === 'WEEK' ? 52 : unit === 'MONTH' ? 12 : 1;
  if (!Number.isInteger(count) || count < 1 || count > maxIntervalCount) throw new Error('Invalid billing interval count.');
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error('Invalid plan price.'); if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error('Invalid plan currency.');
  if (!Number.isInteger(trial) || trial < 0 || trial > 365) throw new Error('Invalid trial days.');
  const billingCycles = [];
  if (trial > 0) billingCycles.push({ frequency: { interval_unit: 'DAY', interval_count: trial }, tenure_type: 'TRIAL', sequence: 1, total_cycles: 1, pricing_scheme: { fixed_price: { value: '0.00', currency_code: currencyCode } } });
  billingCycles.push({ frequency: { interval_unit: unit, interval_count: count }, tenure_type: 'REGULAR', sequence: billingCycles.length + 1, total_cycles: 0, pricing_scheme: { fixed_price: { value: (minor / 100).toFixed(2), currency_code: currencyCode } } });
  const payload = { product_id: product, name: planName, description: planDescription || undefined, status: 'ACTIVE', billing_cycles: billingCycles, payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CONTINUE', payment_failure_threshold: 1 } };
  const headers = {}; if (clean(requestId)) headers['PayPal-Request-Id'] = clean(requestId).slice(0, 108);
  return paypalJson(await paypalApi(env, '/v1/billing/plans', { method: 'POST', headers, body: JSON.stringify(payload) }));
}
function paypalMoney(product) { const minor = Number(product?.price_minor); if (!Number.isSafeInteger(minor) || minor < 0) throw new Error('Invalid product price.'); const currency = String(product?.currency || '').toUpperCase(); if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Invalid product currency.'); return { currency_code: currency, value: (minor / 100).toFixed(2) }; }
async function paypalCreateOrder({ env, request, user, reference, product }) { const amount = paypalMoney(product); const origin = new URL(request.url).origin; const returnUrl = new URL('/payment/success', origin); returnUrl.searchParams.set('reference', reference); const cancelUrl = new URL('/payment/success', origin); cancelUrl.searchParams.set('reference', reference); cancelUrl.searchParams.set('status', 'cancelled'); const payload = { intent: 'CAPTURE', purchase_units: [{ reference_id: reference.slice(0, 64), custom_id: reference.slice(0, 127), invoice_id: reference.slice(0, 127), description: String(product?.name || 'Nexauren purchase').slice(0, 127), amount }], application_context: { brand_name: String(env.PAYMENT_BRAND_NAME || 'Nexauren').slice(0, 127), user_action: 'PAY_NOW', return_url: returnUrl.toString(), cancel_url: cancelUrl.toString(), shipping_preference: 'NO_SHIPPING' } }; const data = await paypalJson(await paypalApi(env, '/v2/checkout/orders', { method: 'POST', headers: { 'PayPal-Request-Id': reference.slice(0, 25) }, body: JSON.stringify(payload) })); if (!data?.id || data?.status !== 'CREATED') throw new Error('PayPal order was not created.'); const approve = (data.links || []).find(link => link.rel === 'payer-action' || link.rel === 'approve'); if (!approve?.href) throw new Error('PayPal approval link was not returned.'); return { url: approve.href, order_id: String(data.id), transaction_id: String(data.id), mode: 'payment' }; }
async function paypalCaptureOrder({ env, orderId }) { if (!orderId) throw new Error('PayPal order ID is required.'); const data = await paypalJson(await paypalApi(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', headers: { 'PayPal-Request-Id': `capture-${String(orderId).slice(0, 18)}` }, body: '{}' })); if (data?.status !== 'COMPLETED') throw new Error('PayPal order was not completed.'); return data; }
async function paypalGetOrder({ env, orderId }) { if (!orderId) throw new Error('PayPal order ID is required.'); return paypalJson(await paypalApi(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: 'GET' })); }

async function paypalCreateSubscription({ env, request, user, reference, product }) {
  const planId = clean(product?.paypal_plan_id);
  if (!planId) throw new Error('PayPal subscription plan ID is missing.');
  const origin = new URL(request.url).origin;
  const returnUrl = new URL('/payment/success', origin);
  returnUrl.searchParams.set('reference', reference);
  returnUrl.searchParams.set('type', 'subscription');
  const cancelUrl = new URL('/payment/success', origin);
  cancelUrl.searchParams.set('reference', reference);
  cancelUrl.searchParams.set('status', 'cancelled');
  cancelUrl.searchParams.set('type', 'subscription');
  const payload = { plan_id: planId, quantity: '1', application_context: { brand_name: String(env.PAYMENT_BRAND_NAME || 'Nexauren').slice(0, 127), user_action: 'SUBSCRIBE_NOW', shipping_preference: 'NO_SHIPPING', return_url: returnUrl.toString(), cancel_url: cancelUrl.toString() } };
  const data = await paypalJson(await paypalApi(env, '/v1/billing/subscriptions', { method: 'POST', headers: { 'PayPal-Request-Id': reference.slice(0, 25) }, body: JSON.stringify(payload) }));
  if (!data?.id) throw new Error('PayPal subscription was not created.');
  const approve = (data.links || []).find(link => link.rel === 'approve');
  if (!approve?.href) throw new Error('PayPal subscription approval link was not returned.');
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare("INSERT INTO subscriptions(id,user_id,provider,provider_subscription_id,plan_id,status,start_date,next_billing_date,cancelled_at,created_at,updated_at) VALUES(?1,?2,'paypal',?3,?4,'pending',?5,NULL,NULL,?5,?5)").bind(uuid(), user.id, String(data.id), clean(product.id), now).run();
  return { url: approve.href, subscription_id: String(data.id), transaction_id: String(data.id), mode: 'subscription', status: String(data.status || 'APPROVAL_PENDING') };
}

async function paypalGetSubscription({ env, subscriptionId }) { if (!subscriptionId) throw new Error('PayPal subscription ID is required.'); return paypalJson(await paypalApi(env, `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: 'GET' })); }
async function paypalSubscriptionAction({ env, subscriptionId, action }) {
  if (!subscriptionId) throw new Error('PayPal subscription ID is required.');
  const map = { cancel: ['cancel', { reason: 'Cancelled by subscriber.' }], suspend: ['suspend', { reason: 'Suspended by Nexauren.' }], resume: ['activate', { reason: 'Resumed by subscriber.' }] };
  const item = map[action]; if (!item) throw new Error('Unsupported PayPal subscription action.');
  const response = await paypalApi(env, `/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/${item[0]}`, { method: 'POST', body: JSON.stringify(item[1]) });
  if (!response.ok && response.status !== 204) await paypalJson(response);
  return true;
}

async function paypalVerifyWebhook({ env, request, raw }) {
  const webhookId = clean(env.PAYPAL_WEBHOOK_ID);
  const transmissionId = clean(request.headers.get('paypal-transmission-id'));
  const transmissionTime = clean(request.headers.get('paypal-transmission-time'));
  const certUrl = clean(request.headers.get('paypal-cert-url'));
  const authAlgo = clean(request.headers.get('paypal-auth-algo')) || 'SHA256withRSA';
  const transmissionSig = clean(request.headers.get('paypal-transmission-sig'));
  if (!webhookId || !transmissionId || !transmissionTime || !certUrl || !transmissionSig) throw new Error('PayPal webhook verification is not configured.');
  const response = await paypalApi(env, '/v1/notifications/verify-webhook-signature', { method: 'POST', body: JSON.stringify({ transmission_id: transmissionId, transmission_time: transmissionTime, cert_url: certUrl, auth_algo: authAlgo, transmission_sig: transmissionSig, webhook_id: webhookId, webhook_event: JSON.parse(raw) }) });
  const result = await paypalJson(response);
  if (result?.verification_status !== 'SUCCESS') throw new Error('PayPal webhook signature verification failed.');
  return true;
}

async function paypalHandleWebhook({ request, env }) {
  const raw = await request.clone().text();
  await paypalVerifyWebhook({ env, request, raw });
  const event = JSON.parse(raw);
  const type = clean(event?.event_type);
  const resource = event?.resource || {};
  const subscriptionId = clean(resource?.id || resource?.billing_agreement_id || resource?.supplementary_data?.related_ids?.billing_agreement_id);
  const providerSubscriptionId = type.startsWith('BILLING.SUBSCRIPTION.') ? clean(resource?.id) : subscriptionId;
  if (!providerSubscriptionId) return json({ received: true, ignored: true }, 200, cors(request));

  const local = await env.DB.prepare("SELECT id,user_id,plan_id,status,current_period_start,current_period_end FROM subscriptions WHERE provider='paypal' AND provider_subscription_id=?1 LIMIT 1").bind(providerSubscriptionId).first();
  if (!local) return json({ received: true, ignored: true }, 200, cors(request));

  if (type === 'BILLING.SUBSCRIPTION.ACTIVATED' || type === 'BILLING.SUBSCRIPTION.UPDATED') {
    const details = await paypalGetSubscription({ env, subscriptionId: providerSubscriptionId });
    const status = String(details?.status || '').toLowerCase() === 'active' ? 'active' : 'pending';
    const start = Math.floor(new Date(details?.start_time || resource?.start_time || Date.now()).getTime() / 1000);
    const next = details?.billing_info?.next_billing_time ? Math.floor(new Date(details.billing_info.next_billing_time).getTime() / 1000) : null;
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('UPDATE subscriptions SET status=?1,start_date=?2,next_billing_date=?3,current_period_start=?4,current_period_end=?5,updated_at=?6 WHERE id=?7').bind(status, start, next, start, next, now, local.id).run();
    await env.DB.prepare('UPDATE billing_accounts SET plan_id=?1,updated_at=?2 WHERE user_id=?3').bind(local.plan_id, now, local.user_id).run();
    if (type === 'BILLING.SUBSCRIPTION.ACTIVATED' && status === 'active' && next && next > start && typeof billingProcessSubscriptionCycle === 'function') {
      const plan = await env.DB.prepare('SELECT price_minor,currency FROM plans WHERE id=?1 LIMIT 1').bind(local.plan_id).first();
      if (plan) await billingProcessSubscriptionCycle(env, { provider: 'paypal', subscriptionId: local.id, providerTransactionId: `activation:${event.id}`, periodStart: start, periodEnd: next, amountMinor: Number(plan.price_minor), currency: plan.currency, reference: `subscription:${local.id}:${start}:${next}` });
    }
    return json({ received: true, processed: true }, 200, cors(request));
  }

  if (type === 'PAYMENT.SALE.COMPLETED') {
    const details = await paypalGetSubscription({ env, subscriptionId: providerSubscriptionId });
    const start = details?.billing_info?.last_payment?.time ? Math.floor(new Date(details.billing_info.last_payment.time).getTime() / 1000) : Math.floor(new Date(resource?.create_time || Date.now()).getTime() / 1000);
    const end = details?.billing_info?.next_billing_time ? Math.floor(new Date(details.billing_info.next_billing_time).getTime() / 1000) : null;
    const amount = Number(resource?.amount?.total || resource?.amount?.value || 0);
    const currency = String(resource?.amount?.currency || resource?.amount?.currency_code || '').toUpperCase();
    const plan = await env.DB.prepare('SELECT price_minor,currency FROM plans WHERE id=?1 LIMIT 1').bind(local.plan_id).first();
    if (!plan) throw new Error('Subscription plan not found.');
    const verifiedAmountMinor = amount > 0 ? Math.round(amount * 100) : Number(plan.price_minor);
    const verifiedCurrency = currency || String(plan.currency).toUpperCase();
    if (end && typeof billingProcessSubscriptionCycle === 'function') await billingProcessSubscriptionCycle(env, { provider: 'paypal', subscriptionId: local.id, providerTransactionId: clean(resource?.id || event.id), periodStart: start, periodEnd: end, amountMinor: verifiedAmountMinor, currency: verifiedCurrency, reference: `subscription:${local.id}:${start}:${end}` });
    return json({ received: true, processed: true }, 200, cors(request));
  }

  const statusMap = { 'BILLING.SUBSCRIPTION.CANCELLED': 'cancelled', 'BILLING.SUBSCRIPTION.EXPIRED': 'expired', 'BILLING.SUBSCRIPTION.SUSPENDED': 'past_due', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': 'past_due' };
  if (statusMap[type]) {
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare('UPDATE subscriptions SET status=?1,cancelled_at=?2,updated_at=?3 WHERE id=?4').bind(statusMap[type], statusMap[type] === 'cancelled' || statusMap[type] === 'expired' ? now : null, now, local.id).run();
    if (statusMap[type] !== 'past_due') await env.DB.prepare("UPDATE billing_accounts SET plan_id='free',updated_at=?1 WHERE user_id=?2").bind(now, local.user_id).run();
    return json({ received: true, processed: true }, 200, cors(request));
  }
  return json({ received: true, ignored: true }, 200, cors(request));
}

async function paypalCreateCheckout({ env, request, user, reference, product, productType }) {
  if (productType === 'subscription') return paypalCreateSubscription({ env, request, user, reference, product });
  if (productType !== 'credit_purchase') throw new Error('Unsupported PayPal checkout type.');
  return paypalCreateOrder({ env, request, user, reference, product });
}
async function paypalCaptureCheckout({ env, orderId }) { return paypalCaptureOrder({ env, orderId }); }
function createPayPalProvider() { return Object.freeze({ name: 'paypal', createCheckout: paypalCreateCheckout, captureCheckout: paypalCaptureCheckout, getOrder: paypalGetOrder, createProduct: paypalCreateProduct, createPlan: paypalCreatePlan, getSubscription: paypalGetSubscription, subscriptionAction: paypalSubscriptionAction, handleWebhook: paypalHandleWebhook }); }
async function paypalHealthCheck(env) { const token = await paypalAccessToken(env); return { ok: true, environment: String(env?.PAYPAL_ENVIRONMENT || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox', authenticated: Boolean(token) }; }