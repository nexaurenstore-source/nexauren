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
    return json({ error: 'Unable to create the PayPal plan.' }, 502, cors(r));
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