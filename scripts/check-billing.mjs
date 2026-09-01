import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [migration, lifecycleMigration, recoveryMigration, lifecycle, webhook, billing, safety, routes, build, providers, paypal] = await Promise.all([
  read('migrations/0004_billing_core.sql'),
  read('migrations/0005_billing_lifecycle.sql'),
  read('migrations/0006_webhook_processing_recovery.sql'),
  read('scripts/worker/subscription-lifecycle.js'),
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
for (const column of ['current_period_start','current_period_end','cancel_at_period_end','subscription_cycles','idx_subscription_cycles_subscription_key']) if (!lifecycleMigration.includes(column) && !lifecycle.includes(column)) throw new Error(`[billing] Missing lifecycle schema item: ${column}`);
for (const column of ['processing_at','idx_webhook_events_processing']) if (!recoveryMigration.includes(column)) throw new Error(`[billing] Missing webhook recovery schema item: ${column}`);
for (const contract of ['billingWebhook','billingProcessSubscriptionStatus','billingProcessRefund','billingRecordWebhook']) if (!webhook.includes(contract)) throw new Error(`[billing] Missing webhook lifecycle contract: ${contract}`);
for (const source of [webhook,safety,routes,build,providers,paypal]) if (source.includes('FLW_SECRET_KEY=') || source.includes('FLW_SECRET_HASH=') || source.includes('PAYPAL_CLIENT_SECRET=')) throw new Error('[billing] Provider secrets must never be committed.');
for (const route of ['/api/billing/catalog','/api/billing/account','/api/billing/payment','/api/billing/transactions','/api/billing/checkout','/api/billing/usage','/api/billing/subscription/cancel','/api/billing/subscription/resume','/api/webhooks/','/api/admin/paypal/products']) if (!routes.includes(route)) throw new Error(`[billing] Missing route: ${route}`);
for (const contract of ['createCheckout','captureCheckout','getOrder','createProduct','buildPaymentProviderRegistry','PAYMENT_PROVIDER']) if (!providers.includes(contract) && !build.includes(contract) && !paypal.includes(contract)) throw new Error(`[billing] Missing PayPal provider contract: ${contract}`);
if (!paypal.includes('PAYPAL_SANDBOX_BASE') || !paypal.includes('/v1/oauth2/token')) throw new Error('[billing] PayPal sandbox OAuth endpoint missing.');
if (!paypal.includes('/v1/catalogs/products')) throw new Error('[billing] PayPal catalog product endpoint missing.');
if (!paypal.includes('/v2/checkout/orders')) throw new Error('[billing] PayPal Orders endpoint missing.');
const hasLocalWebhookVerification = paypal.includes('paypalCrc32Decimal') && paypal.includes('crypto.subtle.verify') && paypal.includes('RSASSA-PKCS1-v1_5') && paypal.includes("hash: 'SHA-256'");
if (!hasLocalWebhookVerification) throw new Error('[billing] PayPal webhook cryptographic signature verification is missing.');
if (!paypal.includes('PAYPAL_WEBHOOK_ID') || !paypal.includes('paypal-cert-url') || !paypal.includes('paypal-transmission-sig')) throw new Error('[billing] PayPal webhook verification headers/configuration are incomplete.');
if (!webhook.includes('payload?.id')) throw new Error('[billing] Webhook idempotency must use the provider event ID.');
if (!webhook.includes("status IN ('received','failed')")) throw new Error('[billing] Failed webhooks must be retryable.');
if (!webhook.includes('processing_at') || !webhook.includes('now - processingAt < 600')) throw new Error('[billing] Webhook processing recovery guard missing.');
if (!webhook.includes('billingProcessPayPalSaleCompleted')) throw new Error('[billing] PayPal sale completion lifecycle missing.');
if (!webhook.includes("PAYMENT.SALE.COMPLETED")) throw new Error('[billing] PayPal sale completion event missing.');
const activationBranch = paypal.split("if (type === 'BILLING.SUBSCRIPTION.ACTIVATED' || type === 'BILLING.SUBSCRIPTION.UPDATED')")[1]?.split("if (type === 'PAYMENT.SALE.COMPLETED')")[0] || '';
if (!activationBranch || /credit|grant/i.test(activationBranch)) throw new Error('[billing] Subscription activation must not grant recurring credits before a completed sale.');
if (!billing.includes('product.price_minor') || !billing.includes('SELECT credits FROM credit_packages') || !billing.includes('productId')) throw new Error('[billing] Backend must determine product price and credits.');
if (billing.includes('d?.credits') || billing.includes('d?.amount_minor')) throw new Error('[billing] Frontend-controlled credits/price detected.');
if (!build.includes('paymentProvidersUrl') || !build.includes('webhookLifecycleUrl')) throw new Error('[billing] Build does not load payment lifecycle modules.');
if (!build.includes('billingModuleUrl') || !build.includes('billingRoutesUrl')) throw new Error('[billing] Build does not load billing core/routes.');
if (!safety.includes('billingEnsureAccount')) throw new Error('[billing] Safety patch does not initialize accounts.');

console.log('[billing] Architecture, PayPal provider, webhook lifecycle, idempotency, recovery and refund checks passed.');
