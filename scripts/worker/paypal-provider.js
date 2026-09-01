/* Nexauren PayPal provider — Orders v2 / Catalog Products / Subscriptions.
 * Secrets are read exclusively from Cloudflare Worker env bindings.
 */

const PAYPAL_SANDBOX_BASE = 'https://api-m.sandbox.paypal.com';
const PAYPAL_LIVE_BASE = 'https://api-m.paypal.com';

function paypalBaseUrl(env) {
  return String(env?.PAYPAL_ENVIRONMENT || 'sandbox').toLowerCase() === 'live'
    ? PAYPAL_LIVE_BASE
    : PAYPAL_SANDBOX_BASE;
}

function requirePaypalCredentials(env) {
  if (!env?.PAYPAL_CLIENT_ID || !env?.PAYPAL_CLIENT_SECRET) throw new Error('PayPal credentials are not configured');
}

async function paypalAccessToken(env) {
  requirePaypalCredentials(env);
  const credentials = `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`;
  const basic = btoa(credentials);
  const response = await fetch(`${paypalBaseUrl(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json', 'Accept-Language': 'en_US' },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) throw new Error(`PayPal OAuth failed (${response.status})`);
  const data = await response.json();
  if (!data?.access_token) throw new Error('PayPal OAuth returned no access token');
  return data.access_token;
}

async function paypalApi(env, path, options = {}) {
  const token = await paypalAccessToken(env);
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');
  if (options.body != null && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return fetch(`${paypalBaseUrl(env)}${path}`, { ...options, headers });
}

async function paypalJson(response) {
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw new Error(`PayPal API error (${response.status})`);
  return data;
}

async function paypalCreateProduct({ env, name, description, type = 'SERVICE', category = 'SOFTWARE', imageUrl = '', homeUrl = '', requestId = '' }) {
  const productName = clean(name).slice(0, 127);
  const productDescription = clean(description).slice(0, 256);
  const productType = clean(type).toUpperCase();
  const productCategory = clean(category).toUpperCase();
  if (!productName) throw new Error('PayPal product name is required.');
  if (!['PHYSICAL', 'DIGITAL', 'SERVICE'].includes(productType)) throw new Error('Invalid PayPal product type.');
  if (!/^[A-Z_]{4,256}$/.test(productCategory)) throw new Error('Invalid PayPal product category.');
  const payload = { name: productName, description: productDescription || undefined, type: productType, category: productCategory, ...(clean(imageUrl) ? { image_url: clean(imageUrl).slice(0, 2000) } : {}), ...(clean(homeUrl) ? { home_url: clean(homeUrl).slice(0, 2000) } : {}) };
  const headers = {};
  if (clean(requestId)) headers['PayPal-Request-Id'] = clean(requestId).slice(0, 108);
  return paypalJson(await paypalApi(env, '/v1/catalogs/products', { method: 'POST', headers, body: JSON.stringify(payload) }));
}

async function paypalCreatePlan({ env, productId, name, description, priceMinor, currency = 'USD', intervalUnit = 'MONTH', intervalCount = 1, trialDays = 0, requestId = '' }) {
  const product = clean(productId);
  const planName = clean(name).slice(0, 127);
  const planDescription = clean(description).slice(0, 127);
  const currencyCode = clean(currency).toUpperCase();
  const unit = clean(intervalUnit).toUpperCase();
  const count = Number(intervalCount);
  const minor = Number(priceMinor);
  const trial = Number(trialDays || 0);
  if (!product) throw new Error('PayPal product ID is required.');
  if (!planName) throw new Error('PayPal plan name is required.');
  if (!['DAY', 'WEEK', 'MONTH', 'YEAR'].includes(unit)) throw new Error('Invalid billing interval.');
  if (!Number.isInteger(count) || count < 1 || count > 12) throw new Error('Invalid billing interval count.');
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error('Invalid plan price.');
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw new Error('Invalid plan currency.');
  if (!Number.isInteger(trial) || trial < 0 || trial > 365) throw new Error('Invalid trial days.');
  const payload = {
    product_id: product,
    name: planName,
    description: planDescription || undefined,
    status: 'ACTIVE',
    billing_cycles: [{
      frequency: { interval_unit: unit, interval_count: count },
      tenure_type: 'REGULAR',
      sequence: 1,
      total_cycles: 0,
      pricing_scheme: { fixed_price: { value: (minor / 100).toFixed(2), currency_code: currencyCode } },
    }],
    payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CONTINUE', payment_failure_threshold: 1 },
  };
  if (trial > 0) payload.billing_cycles.unshift({ frequency: { interval_unit: 'DAY', interval_count: trial }, tenure_type: 'TRIAL', sequence: 1, total_cycles: 1, pricing_scheme: { fixed_price: { value: '0.00', currency_code: currencyCode } } });
  if (trial > 0) payload.billing_cycles[1].sequence = 2;
  const headers = {};
  if (clean(requestId)) headers['PayPal-Request-Id'] = clean(requestId).slice(0, 108);
  return paypalJson(await paypalApi(env, '/v1/billing/plans', { method: 'POST', headers, body: JSON.stringify(payload) }));
}

function paypalMoney(product) {
  const minor = Number(product?.price_minor);
  if (!Number.isSafeInteger(minor) || minor < 0) throw new Error('Invalid product price.');
  const currency = String(product?.currency || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('Invalid product currency.');
  return { currency_code: currency, value: (minor / 100).toFixed(2) };
}

async function paypalCreateOrder({ env, request, user, reference, product }) {
  const amount = paypalMoney(product);
  const origin = new URL(request.url).origin;
  const returnUrl = new URL('/payment/success', origin); returnUrl.searchParams.set('reference', reference);
  const cancelUrl = new URL('/payment/success', origin); cancelUrl.searchParams.set('reference', reference); cancelUrl.searchParams.set('status', 'cancelled');
  const payload = { intent: 'CAPTURE', purchase_units: [{ reference_id: reference.slice(0, 64), custom_id: reference.slice(0, 127), invoice_id: reference.slice(0, 127), description: String(product?.name || 'Nexauren purchase').slice(0, 127), amount }], application_context: { brand_name: String(env.PAYMENT_BRAND_NAME || 'Nexauren').slice(0, 127), user_action: 'PAY_NOW', return_url: returnUrl.toString(), cancel_url: cancelUrl.toString(), shipping_preference: 'NO_SHIPPING' } };
  const data = await paypalJson(await paypalApi(env, '/v2/checkout/orders', { method: 'POST', headers: { 'PayPal-Request-Id': reference.slice(0, 25) }, body: JSON.stringify(payload) }));
  if (!data?.id || data?.status !== 'CREATED') throw new Error('PayPal order was not created.');
  const approve = (data.links || []).find(link => link.rel === 'payer-action' || link.rel === 'approve');
  if (!approve?.href) throw new Error('PayPal approval link was not returned.');
  return { url: approve.href, order_id: String(data.id), transaction_id: String(data.id), mode: 'payment' };
}

async function paypalCaptureOrder({ env, orderId }) {
  if (!orderId) throw new Error('PayPal order ID is required.');
  const data = await paypalJson(await paypalApi(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', headers: { 'PayPal-Request-Id': `capture-${String(orderId).slice(0, 18)}` }, body: '{}' }));
  if (data?.status !== 'COMPLETED') throw new Error('PayPal order was not completed.');
  return data;
}

async function paypalGetOrder({ env, orderId }) {
  if (!orderId) throw new Error('PayPal order ID is required.');
  return paypalJson(await paypalApi(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: 'GET' }));
}

async function paypalCreateCheckout({ env, request, user, reference, product, productType }) {
  if (productType !== 'credit_purchase') throw new Error('PayPal subscription checkout is not enabled yet.');
  return paypalCreateOrder({ env, request, user, reference, product });
}

async function paypalCaptureCheckout({ env, orderId }) { return paypalCaptureOrder({ env, orderId }); }

function createPayPalProvider() {
  return Object.freeze({ name: 'paypal', createCheckout: paypalCreateCheckout, captureCheckout: paypalCaptureCheckout, getOrder: paypalGetOrder, createProduct: paypalCreateProduct, createPlan: paypalCreatePlan });
}

async function paypalHealthCheck(env) {
  const token = await paypalAccessToken(env);
  return { ok: true, environment: String(env?.PAYPAL_ENVIRONMENT || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox', authenticated: Boolean(token) };
}
