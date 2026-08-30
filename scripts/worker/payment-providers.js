/* NEXAUREN PAYMENT PROVIDERS v2
 * Server-side adapters only. No provider secret is stored in source.
 * PayPal: Orders + Subscriptions + verified webhooks.
 * Flutterwave: Standard hosted checkout + verified webhooks.
 */

function providerProductEnvKey(prefix, productId) {
  return `${prefix}_${clean(productId).toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
}

async function providerJson(response) {
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const detail = data?.message || data?.name || text || `HTTP ${response.status}`;
    throw new Error(String(detail).slice(0, 500));
  }
  return data;
}

function paypalBase(env) {
  return clean(env.PAYPAL_ENV).toLowerCase() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function paypalAccessToken(env) {
  const clientId = clean(env.PAYPAL_CLIENT_ID);
  const secret = clean(env.PAYPAL_CLIENT_SECRET);
  if (!clientId || !secret) throw new Error('PayPal server credentials are not configured.');
  const auth = btoa(`${clientId}:${secret}`);
  const response = await fetch(`${paypalBase(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await providerJson(response);
  if (!data?.access_token) throw new Error('PayPal access token was not returned.');
  return data.access_token;
}

function paypalHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function paypalCreateCheckout({ env, user, reference, product, productType }) {
  const token = await paypalAccessToken(env);
  const base = paypalBase(env);
  const returnUrl = clean(env.PAYMENT_RETURN_URL);
  const cancelUrl = clean(env.PAYMENT_CANCEL_URL);
  if (!returnUrl || !cancelUrl) throw new Error('Payment return/cancel URLs are not configured.');

  if (productType === 'subscription') {
    const planKey = providerProductEnvKey('PAYPAL_PLAN', product.id);
    const planId = clean(env[planKey]);
    if (!planId) throw new Error(`Missing PayPal plan mapping: ${planKey}.`);

    const response = await fetch(`${base}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: paypalHeaders(token),
      body: JSON.stringify({
        plan_id: planId,
        custom_id: reference,
        subscriber: { email_address: user.email },
        application_context: {
          brand_name: clean(env.PAYMENT_BRAND_NAME) || 'Nexauren',
          user_action: 'SUBSCRIBE_NOW',
          return_url: returnUrl,
          cancel_url: cancelUrl,
        },
      }),
    });
    const data = await providerJson(response);
    const approve = (data?.links || []).find((link) => link.rel === 'approve');
    if (!approve?.href || !data?.id) throw new Error('PayPal subscription approval link was not returned.');
    return { url: approve.href, transaction_id: data.id, subscription_id: data.id, mode: 'subscription' };
  }

  const amount = (Number(product.price_minor) / 100).toFixed(2);
  const response = await fetch(`${base}/v2/checkout/orders`, {
    method: 'POST',
    headers: paypalHeaders(token),
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: reference,
        custom_id: reference,
        amount: { currency_code: String(product.currency).toUpperCase(), value: amount },
      }],
      application_context: {
        brand_name: clean(env.PAYMENT_BRAND_NAME) || 'Nexauren',
        user_action: 'PAY_NOW',
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    }),
  });
  const data = await providerJson(response);
  const approve = (data?.links || []).find((link) => link.rel === 'approve');
  if (!approve?.href || !data?.id) throw new Error('PayPal approval link was not returned.');
  return { url: approve.href, transaction_id: data.id, order_id: data.id, mode: 'order' };
}

async function paypalVerifyWebhook(env, request, event) {
  const webhookId = clean(env.PAYPAL_WEBHOOK_ID);
  if (!webhookId) throw new Error('PAYPAL_WEBHOOK_ID is not configured.');
  const headers = request.headers;
  const required = {
    auth_algo: headers.get('paypal-auth-algo'),
    cert_url: headers.get('paypal-cert-url'),
    transmission_id: headers.get('paypal-transmission-id'),
    transmission_sig: headers.get('paypal-transmission-sig'),
    transmission_time: headers.get('paypal-transmission-time'),
    webhook_id: webhookId,
    webhook_event: event,
  };
  if (Object.values(required).some((value) => !value)) throw new Error('Incomplete PayPal webhook signature headers.');
  const token = await paypalAccessToken(env);
  const response = await fetch(`${paypalBase(env)}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: paypalHeaders(token),
    body: JSON.stringify(required),
  });
  const data = await providerJson(response);
  if (data?.verification_status !== 'SUCCESS') throw new Error('Invalid PayPal webhook signature.');
}

async function paypalHandleWebhook({ request, env, finalize }) {
  const event = await request.clone().json();
  await paypalVerifyWebhook(env, request, event);
  const eventType = clean(event?.event_type);

  if (eventType === 'CHECKOUT.ORDER.APPROVED') {
    const orderId = clean(event?.resource?.id);
    if (!orderId) return json({ received: true }, 200);
    const token = await paypalAccessToken(env);
    const capture = await fetch(`${paypalBase(env)}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: paypalHeaders(token),
    });
    const data = await providerJson(capture);
    const purchase = data?.purchase_units?.[0];
    const payment = purchase?.payments?.captures?.[0];
    if (!payment || payment.status !== 'COMPLETED') return json({ received: true, status: 'pending' }, 200);
    const reference = clean(purchase?.custom_id || purchase?.reference_id);
    const row = await env.DB.prepare('SELECT id,user_id,type,amount_minor,currency,metadata FROM payments WHERE reference=?1 LIMIT 1').bind(reference).first();
    if (!row) throw new Error('PayPal payment reference not found.');
    const meta = JSON.parse(row.metadata || '{}');
    await finalize({
      provider: 'paypal', reference, providerTransactionId: payment.id, status: 'successful',
      userId: row.user_id, amountMinor: row.amount_minor, currency: row.currency,
      type: row.type, productId: meta.product_id,
      metadata: { ...meta, paypal_order_id: orderId, paypal_capture_id: payment.id },
    });
    return json({ received: true, processed: true }, 200);
  }

  if (eventType === 'PAYMENT.SALE.COMPLETED') {
    // Recurring PayPal subscription events are acknowledged here. Renewal
    // credit allocation is handled by the subscription lifecycle phase.
    return json({ received: true, deferred: true }, 200);
  }

  return json({ received: true, ignored: true }, 200);
}

async function flutterwaveCreateCheckout({ env, user, reference, product, productType }) {
  const secret = clean(env.FLW_SECRET_KEY);
  if (!secret) throw new Error('Flutterwave server credentials are not configured.');
  const redirectUrl = clean(env.PAYMENT_RETURN_URL);
  if (!redirectUrl) throw new Error('Payment return URL is not configured.');

  const payload = {
    tx_ref: reference,
    amount: Number(product.price_minor) / 100,
    currency: String(product.currency).toUpperCase(),
    redirect_url: redirectUrl,
    customer: { email: user.email, name: user.name || user.email },
    meta: { product_id: product.id, product_type: productType, reference },
  };

  if (productType === 'subscription') {
    const planKey = providerProductEnvKey('FLW_PAYMENT_PLAN', product.id);
    const paymentPlan = clean(env[planKey]);
    if (!paymentPlan) throw new Error(`Missing Flutterwave payment plan mapping: ${planKey}.`);
    payload.payment_plan = Number(paymentPlan);
  }

  const response = await fetch('https://api.flutterwave.com/v3/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await providerJson(response);
  if (data?.status !== 'success' || !data?.data?.link) throw new Error('Flutterwave checkout link was not returned.');
  return { url: data.data.link, mode: productType === 'subscription' ? 'subscription' : 'payment' };
}

async function flutterwaveHandleWebhook({ request, env, finalize }) {
  const secretHash = clean(env.FLW_WEBHOOK_SECRET);
  if (!secretHash) throw new Error('FLW_WEBHOOK_SECRET is not configured.');
  const raw = await request.clone().text();
  const signature = request.headers.get('flutterwave-signature');
  if (!signature) throw new Error('Missing Flutterwave webhook signature.');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secretHash), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
  if (signature !== expected) throw new Error('Invalid Flutterwave webhook signature.');

  const event = JSON.parse(raw);
  const transactionId = String(event?.data?.id || '');
  if (!transactionId) return json({ received: true, ignored: true }, 200);

  const secret = clean(env.FLW_SECRET_KEY);
  if (!secret) throw new Error('Flutterwave server credentials are not configured.');
  const verify = await fetch(`https://api.flutterwave.com/v3/transactions/${encodeURIComponent(transactionId)}/verify`, {
    headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
  });
  const verified = await providerJson(verify);
  const tx = verified?.data;
  const reference = clean(tx?.tx_ref);
  if (!reference) throw new Error('Flutterwave transaction reference missing.');

  const row = await env.DB.prepare('SELECT id,user_id,type,amount_minor,currency,metadata FROM payments WHERE reference=?1 LIMIT 1').bind(reference).first();
  if (!row) throw new Error('Flutterwave payment reference not found.');
  const meta = JSON.parse(row.metadata || '{}');
  const expectedAmount = Number(row.amount_minor) / 100;
  const status = String(tx?.status || '').toLowerCase();
  if (String(tx?.currency).toUpperCase() !== String(row.currency).toUpperCase() || Number(tx?.amount) < expectedAmount) {
    throw new Error('Flutterwave payment verification mismatch.');
  }

  await finalize({
    provider: 'flutterwave', reference, providerTransactionId: transactionId,
    status: status === 'successful' ? 'successful' : status === 'failed' ? 'failed' : 'cancelled',
    userId: row.user_id, amountMinor: row.amount_minor, currency: row.currency,
    type: row.type, productId: meta.product_id,
    metadata: { ...meta, flutterwave_transaction_id: transactionId },
  });
  return json({ received: true, processed: true }, 200);
}

function createPayPalProvider() {
  return Object.freeze({ name: 'paypal', createCheckout: paypalCreateCheckout, handleWebhook: paypalHandleWebhook });
}

function createFlutterwaveProvider() {
  return Object.freeze({ name: 'flutterwave', createCheckout: flutterwaveCreateCheckout, handleWebhook: flutterwaveHandleWebhook });
}

function buildPaymentProviderRegistry(env) {
  const configured = clean(env.PAYMENT_PROVIDER).toLowerCase();
  const registry = {
    paypal: createPayPalProvider(),
    flutterwave: createFlutterwaveProvider(),
  };
  if (!configured) return Object.freeze({});
  if (!registry[configured]) return Object.freeze({});
  return Object.freeze({ [configured]: registry[configured] });
}

const NEXAUREN_PAYMENT_PROVIDERS = Object.freeze({
  paypal: createPayPalProvider(),
  flutterwave: createFlutterwaveProvider(),
});
