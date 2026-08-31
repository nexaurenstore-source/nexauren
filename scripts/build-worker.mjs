import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const sourceUrl = new URL('../worker.js', import.meta.url);
const outputDir = new URL('../.worker-build/', import.meta.url);
const outputUrl = new URL('../.worker-build/worker.js', import.meta.url);
const notificationModuleUrl = new URL('./worker/notifications.js', import.meta.url);
const notificationRoutesUrl = new URL('./worker/notification-routes.js', import.meta.url);
const billingModuleUrl = new URL('./worker/billing.js', import.meta.url);
const billingSafetyPatchUrl = new URL('./worker/billing-safety-patch.js', import.meta.url);
const billingRoutesUrl = new URL('./worker/billing-routes.js', import.meta.url);
const paymentProvidersUrl = new URL('./worker/payment-providers.js', import.meta.url);
const subscriptionModuleUrl = new URL('./worker/subscription-lifecycle.js', import.meta.url);
const webhookLifecycleUrl = new URL('./worker/billing-webhooks.js', import.meta.url);
const communityMigrationUrl = new URL('./worker/migrate-community-ratings-favorites.mjs', import.meta.url);

const source = await readFile(sourceUrl, 'utf8');
const notificationModule = await readFile(notificationModuleUrl, 'utf8');
const notificationRoutes = await readFile(notificationRoutesUrl, 'utf8');
const billingModule = await readFile(billingModuleUrl, 'utf8');
const billingSafetyPatch = await readFile(billingSafetyPatchUrl, 'utf8');
const billingRoutes = await readFile(billingRoutesUrl, 'utf8');
const paymentProviders = await readFile(paymentProvidersUrl, 'utf8');
const subscriptionModule = await readFile(subscriptionModuleUrl, 'utf8');
const webhookLifecycle = await readFile(webhookLifecycleUrl, 'utf8');

if (!source.trim()) throw new Error('[worker-build] worker.js is empty. Deployment stopped.');
if (!notificationModule.includes('async function ensureNotificationsSchema')) throw new Error('[worker-build] Notification module is incomplete.');
if (!notificationRoutes.includes('/api/admin/notifications')) throw new Error('[worker-build] Notification routes module is incomplete.');
if (!billingModule.includes('async function billingFinalizePayment')) throw new Error('[worker-build] Billing module is incomplete.');
if (!billingSafetyPatch.includes('async function billingUsageSafe')) throw new Error('[worker-build] Billing safety patch is incomplete.');
if (!billingRoutes.includes('/api/billing/catalog')) throw new Error('[worker-build] Billing routes module is incomplete.');
if (!paymentProviders.includes('NEXAUREN_PAYMENT_PROVIDERS')) throw new Error('[worker-build] Payment provider registry is incomplete.');
if (!subscriptionModule.includes('async function billingProcessSubscriptionCycle')) throw new Error('[worker-build] Subscription lifecycle module is incomplete.');
if (!webhookLifecycle.includes('async function billingWebhook')) throw new Error('[worker-build] Webhook lifecycle module is incomplete.');

let generated = source;

if (!generated.includes('async function ensureNotificationsSchema(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(generated)) throw new Error('[worker-build] Worker structure changed: enhanceHTML marker not found.');
  generated = generated.replace(marker, notificationModule + '\n\n$&', 1);
}

if (!generated.includes('const __notificationsUrl')) {
  const fetchMarker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!fetchMarker.test(generated)) throw new Error('[worker-build] Worker structure changed: fetch(r, e) marker not found.');
  generated = generated.replace(fetchMarker, '$&\n' + notificationRoutes + '\n', 1);
}

if (!generated.includes('async function billingFinalizePayment(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(generated)) throw new Error('[worker-build] Worker structure changed: billing insertion marker not found.');

  const billingModuleForBuild = billingModule.replace(
    /\nasync function billingWebhook\(r, e, providerName\) \{[\s\S]*?\n\}\n\n(?=async function billingFinalizePayment)/,
    '\n',
  );
  if (billingModuleForBuild.includes('async function billingWebhook(')) {
    throw new Error('[worker-build] Legacy billingWebhook declaration was not removed.');
  }

  generated = generated.replace(
    marker,
    billingModuleForBuild + '\n\n' + billingSafetyPatch + '\n\n' + subscriptionModule + '\n\n' + webhookLifecycle + '\n\n' + paymentProviders + '\n\n$&',
    1,
  );
}

if (!generated.includes('const __billingUrl')) {
  const fetchMarker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!fetchMarker.test(generated)) throw new Error('[worker-build] Worker structure changed: billing route marker not found.');
  generated = generated.replace(fetchMarker, '$&\n' + billingRoutes + '\n', 1);
}

// Fail closed for unknown API paths. API requests must never fall through to
// the static HTML asset, otherwise clients receive <!doctype html> where JSON
// was expected. This guard is intentionally inserted after all API modules.
const assetFallbackMarker = '      const response = await e.ASSETS.fetch(r);';
if (!generated.includes(assetFallbackMarker)) {
  throw new Error('[worker-build] Worker structure changed: asset fallback marker not found.');
}
generated = generated.replace(
  assetFallbackMarker,
  "      if (new URL(r.url).pathname.startsWith('/api/')) {\n        return json({ error: 'Not found' }, 404, cors(r));\n      }\n\n" + assetFallbackMarker,
  1,
);

const count = (text, needle) => text.split(needle).length - 1;
if (count(generated, 'async function billingWebhook(') !== 1) {
  throw new Error('[worker-build] billingWebhook must be included exactly once.');
}
if (count(generated, 'const __billingUrl') !== 1) {
  throw new Error('[worker-build] Billing route module must be included exactly once.');
}
if (count(generated, 'async function billingFinalizePayment(') !== 1) {
  throw new Error('[worker-build] billingFinalizePayment must be included exactly once.');
}

await mkdir(outputDir, { recursive: true });
await writeFile(outputUrl, generated, 'utf8');

function normalizeRawTemplate(sourceText, marker, closeMarker) {
  const start = sourceText.indexOf(marker);
  if (start < 0) return sourceText;
  const openTick = sourceText.indexOf('`', start + marker.length - 1);
  if (openTick < 0) throw new Error(`[worker-build] Opening template marker not found: ${marker}`);
  const closeTick = sourceText.indexOf(closeMarker, openTick + 1);
  if (closeTick < 0) throw new Error(`[worker-build] Closing template marker not found: ${marker}`);
  let body = '';
  for (let i = openTick + 1; i < closeTick; i += 1) {
    const ch = sourceText[i];
    if (ch === '\\' && i + 1 < closeTick) { body += ch + sourceText[i + 1]; i += 1; continue; }
    if (ch === '`') { body += '\\`'; continue; }
    if (ch === '$' && sourceText[i + 1] === '{') { body += '\\${'; i += 1; continue; }
    body += ch;
  }
  return sourceText.slice(0, openTick + 1) + body + sourceText.slice(closeTick);
}

let migrationSource = await readFile(communityMigrationUrl, 'utf8');
migrationSource = normalizeRawTemplate(migrationSource, 'const communityModule = String.raw`', '`;\n\nlet generated');
migrationSource = normalizeRawTemplate(migrationSource, 'const adminDashboard = String.raw`', '`;\n\ngenerated = generated.slice(0, adminStart)');
migrationSource = normalizeRawTemplate(migrationSource, 'const routes = String.raw`', '`;\n\ngenerated = generated.slice(0, routesStart)');
migrationSource = migrationSource.replaceAll('String.raw`', '`');
migrationSource = migrationSource.replace("new URL('../../.worker-build/worker.js', import.meta.url)", "new URL('./worker.js', import.meta.url)");

const normalizedMigrationUrl = new URL('../.worker-build/migrate-community-ratings-favorites.mjs', import.meta.url);
await writeFile(normalizedMigrationUrl, migrationSource, 'utf8');

for (const script of [
  normalizedMigrationUrl.pathname,
  new URL('./worker/ensure-community-schema.mjs', import.meta.url).pathname,
  new URL('./worker/harden-community-api.mjs', import.meta.url).pathname,
  new URL('./worker/inject-design-system.mjs', import.meta.url).pathname,
  new URL('./worker/inject-seo.mjs', import.meta.url).pathname,
  new URL('./worker/enforce-admin-routes.mjs', import.meta.url).pathname,
  new URL('./worker/harden-security.mjs', import.meta.url).pathname,
  new URL('./worker/harden-auth.mjs', import.meta.url).pathname,
  new URL('./extend-admin-users.mjs', import.meta.url).pathname,
  new URL('./protect-admin-user.mjs', import.meta.url).pathname,
  new URL('./extend-blocked-users.mjs', import.meta.url).pathname,
]) {
  execFileSync(process.execPath, [script], { stdio: 'inherit' });
}

try {
  execFileSync(process.execPath, ['--check', outputUrl.pathname], { stdio: 'inherit' });
} catch {
  throw new Error('[worker-build] Generated Worker failed JavaScript syntax validation. Deployment stopped.');
}

console.log('[worker-build] Source inspected.');
console.log('[worker-build] Notification domain module included once.');
console.log('[worker-build] Notification routes included once.');
console.log('[worker-build] Billing core module included once.');
console.log('[worker-build] Billing safety patch included once.');
console.log('[worker-build] Billing routes included once.');
console.log('[worker-build] Payment provider registry included once.');
console.log('[worker-build] Subscription lifecycle included once.');
console.log('[worker-build] Webhook lifecycle included once.');
console.log('[worker-build] Unknown API paths fail closed with JSON 404.');
console.log('[worker-build] Existing Worker source/routes preserved.');
console.log('[worker-build] JavaScript syntax check passed.');
console.log(`[worker-build] Deploy artifact: ${outputUrl.pathname}`);