/* NEXAUREN SUBSCRIPTION ROUTES v1 */
const __subscriptionUrl = new URL(r.url);

if (__subscriptionUrl.pathname === '/api/billing/subscription/cancel' && r.method === 'POST') {
  return billingCancelSubscription(r, e);
}

if (__subscriptionUrl.pathname === '/api/billing/subscription/resume' && r.method === 'POST') {
  return billingResumeSubscription(r, e);
}
