import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [migration, billing, safety, routes, build, providers] = await Promise.all([
  read('migrations/0004_billing_core.sql'),
  read('scripts/worker/billing.js'),
  read('scripts/worker/billing-safety-patch.js'),
  read('scripts/worker/billing-routes.js'),
  read('scripts/build-worker.mjs'),
  read('scripts/worker/payment-providers.js'),
]);

const requiredTables = ['plans','credit_packages','billing_accounts','payments','subscriptions','credit_balances','credit_transactions','tool_billing','tool_usage','webhook_events'];
for (const table of requiredTables) {
  if (!migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) throw new Error(`[billing] Missing table: ${table}`);
}
for (const invariant of ['reference TEXT NOT NULL UNIQUE','idx_payments_provider_transaction','idx_webhook_events_provider_event','INSERT OR IGNORE INTO credit_transactions','WHERE NOT EXISTS(SELECT 1 FROM credit_transactions WHERE reference=?5)','balance>=?8']) {
  if (!migration.includes(invariant) && !billing.includes(invariant)) throw new Error(`[billing] Missing invariant: ${invariant}`);
}
for (const source of [billing,safety,routes,build,providers]) {
  if (source.includes('FLW_SECRET_KEY') || source.includes('PAYPAL_CLIENT_SECRET')) throw new Error('[billing] Provider secrets must never be committed.');
}
for (const route of ['/api/billing/catalog','/api/billing/account','/api/billing/transactions','/api/billing/checkout','/api/billing/usage','/api/webhooks/']) {
  if (!routes.includes(route)) throw new Error(`[billing] Missing route: ${route}`);
}
for (const contract of ['createCheckout','handleWebhook','buildPaymentProviderRegistry','PAYMENT_PROVIDER']) {
  if (!providers.includes(contract) && !build.includes(contract)) throw new Error(`[billing] Missing provider contract: ${contract}`);
}
if (!build.includes('paymentProvidersUrl')) throw new Error('[billing] Build does not load provider registry.');
if (!build.includes('billingModuleUrl')) throw new Error('[billing] Build does not load billing core.');
if (!build.includes('billingRoutesUrl')) throw new Error('[billing] Build does not load billing routes.');
if (!safety.includes('billingEnsureAccount')) throw new Error('[billing] Safety patch does not initialize accounts.');

console.log('[billing] Architecture and provider contract checks passed.');
