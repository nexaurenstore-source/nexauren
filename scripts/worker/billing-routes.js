/* NEXAUREN BILLING ROUTES v1 */
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

if (__billingUrl.pathname.startsWith('/api/webhooks/')) {
  const parts = __billingUrl.pathname.split('/').filter(Boolean);
  const provider = clean(parts[2]);

  if (parts.length === 3 && r.method === 'POST') {
    return billingWebhook(r, e, provider);
  }
}
