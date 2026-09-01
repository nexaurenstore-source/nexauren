/* Nexauren PayPal provider — Sandbox/Live REST authentication.
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
  if (!env?.PAYPAL_CLIENT_ID || !env?.PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal credentials are not configured');
  }
}

async function paypalAccessToken(env) {
  requirePaypalCredentials(env);
  const credentials = `${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`;
  const basic = btoa(credentials);

  const response = await fetch(`${paypalBaseUrl(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      'Accept-Language': 'en_US',
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    // Never expose PayPal credentials or the response body in application errors/logs.
    throw new Error(`PayPal OAuth failed (${response.status})`);
  }

  const data = await response.json();
  if (!data?.access_token) throw new Error('PayPal OAuth returned no access token');
  return data.access_token;
}

async function paypalApi(env, path, options = {}) {
  const token = await paypalAccessToken(env);
  const headers = new Headers(options.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');
  if (options.body != null && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(`${paypalBaseUrl(env)}${path}`, {
    ...options,
    headers,
  });
}

async function paypalHealthCheck(env) {
  const token = await paypalAccessToken(env);
  return {
    ok: true,
    environment: String(env?.PAYPAL_ENVIRONMENT || 'sandbox').toLowerCase() === 'live' ? 'live' : 'sandbox',
    authenticated: Boolean(token),
  };
}
