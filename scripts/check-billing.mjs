import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [migration, lifecycle, webhook, billing, safety, routes, build, providers, paypal] = await Promise.all([
  read('migrations/0004_billing_core.sql'),
  read('migrations/0005_billing_lifecycle.sql'),
  read('scripts/worker/billing-webhooks.js'),
  read('scripts/worker/billing.js'),
  read('scripts/worker/billing-safety-patch.js'),
  read('scripts/worker/billing-routes.js'),
  read('scripts/build-worker.mjs'),
  read('scripts/worker/payment-providers.js'),
  read('scripts/worker/paypal-provider.js'),
]);

const requiredTables = ['plans','credit_packages','billing_accounts','payments','subscriptions','credit_balances','credit_transactions','tool_billing','tool_usage','webhook_events'];
for (const table of requiredTables) if (!migration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) throw new Error(`[billing] Missing table: ${table}`);
for (const invariant of ['reference TEXT NOT NULL UNIQUE','idx_payments_provider_transaction','idx_webhook_events_provider_event','INSERT OR IGNORE INTO credit_transactions','WHERE NOT EXISTS(SELECT 1 FROM credit_transactions WHERE reference=?5)','balance>=?8']) if (!migration.includes(invariant) && !billing.includes(invariant)) throw new Error(`[billing] Missing invariant: ${invariant}`);
for (const column of ['current_period_start','current_period_end','cancel_at_period_end','subscription_cycles','idx_subscription_cycles_subscription_key']) if (!lifecycle.includes(column)) throw new Error(`[billing] Missing lifecycle schema item: ${column}`);
for (const contract of ['billingWebhook','billingProcessSubscriptionStatus','billingProcessRefund','billingRecordWebhook']) if (!webhook.includes(contract)) throw new Error(`[billing] Missing webhook lifecycle contract: ${contract}`);
for (const source of [webhook,safety,routes,build,providers,paypal]) if (source.includes('FLW_SECRET_KEY=') || source.includes('FLW_SECRET_HASH=') || source.includes('PAYPAL_CLIENT_SECRET=')) throw new Error('[billing] Provider secrets must never be committed.');
for (const route of ['/api/billing/catalog','/api/billing/account','/api/billing/payment','/api/billing/transactions','/api/billing/checkout','/api/billing/usage','/api/billing/subscription/cancel','/api/billing/subscription/resume','/api/webhooks/','/api/admin/paypal/products']) if (!routes.includes(route)) throw new Error(`[billing] Missing route: ${route}`);
for (const contract of ['createCheckout','captureCheckout','getOrder','createProduct','buildPaymentProviderRegistry','PAYMENT_PROVIDER']) if (!providers.includes(contract) && !build.includes(contract) && !paypal.includes(contract)) throw new Error(`[billing] Missing PayPal provider contract: ${contract}`);
// PayPal Sandbox OAuth endpoint is composed from the sandbox base URL and OAuth path.
if (!paypal.includes('PAYPAL_SANDBOX_BASE') || !paypal.includes('/v1/oauth2/token')) throw new Error('[billing] PayPal sandbox OAuth endpoint missing.');
if (!paypal.includes('/v1/catalogs/products')) throw new Error('[billing] PayPal catalog product endpoint missing.');
if (!paypal.includes('/v2/checkout/orders')) throw new Error('[billing] PayPal Orders endpoint missing.');
if (!webhook.includes('payload?.id')) throw new Error('[billing] Webhook idempotency must use the provider event ID.');
if (!webhook.includes("status IN ('received','failed')")) throw new Error('[billing] Failed webhooks must be retryable.');
if (!billing.includes('product.price_minor') || !billing.includes('SELECT credits FROM credit_packages') || !billing.includes('productId')) throw new Error('[billing] Backend must determine product price and credits.');
if (billing.includes('d?.credits') || billing.includes('d?.amount_minor')) throw new Error('[billing] Frontend-controlled credits/price detected.');
if (!build.includes('paymentProvidersUrl') || !build.includes('webhookLifecycleUrl')) throw new Error('[billing] Build does not load payment lifecycle modules.');
if (!build.includes('billingModuleUrl') || !build.includes('billingRoutesUrl')) throw new Error('[billing] Build does not load billing core/routes.');
if (!safety.includes('billingEnsureAccount')) throw new Error('[billing] Safety patch does not initialize accounts.');

console.log('[billing] Architecture, PayPal provider, webhook lifecycle, idempotency and refund checks passed.');
