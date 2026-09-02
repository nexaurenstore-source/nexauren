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
const toolCreditAdminUrl = new URL('./worker/tool-credit-admin.js', import.meta.url);
const paymentProvidersUrl = new URL('./worker/payment-providers.js', import.meta.url);
const paypalProviderUrl = new URL('./worker/paypal-provider.js', import.meta.url);
const subscriptionModuleUrl = new URL('./worker/subscription-lifecycle.js', import.meta.url);
const webhookLifecycleUrl = new URL('./worker/billing-webhooks.js', import.meta.url);
const blogRoutesUrl = new URL('./worker/blog-routes.js', import.meta.url);
const communityMigrationUrl = new URL('./worker/migrate-community-ratings-favorites.mjs', import.meta.url);
const toolRegistryUrl = new URL('../frontend/data/tools.json', import.meta.url);

const source = await readFile(sourceUrl, 'utf8');
const notificationModule = await readFile(notificationModuleUrl, 'utf8');
const notificationRoutes = await readFile(notificationRoutesUrl, 'utf8');
const billingModule = await readFile(billingModuleUrl, 'utf8');
const billingSafetyPatch = await readFile(billingSafetyPatchUrl, 'utf8');
const billingRoutes = await readFile(billingRoutesUrl, 'utf8');
const toolCreditAdmin = await readFile(toolCreditAdminUrl, 'utf8');
const paymentProviders = await readFile(paymentProvidersUrl, 'utf8');
const paypalProvider = await readFile(paypalProviderUrl, 'utf8');
const subscriptionModule = await readFile(subscriptionModuleUrl, 'utf8');
const webhookLifecycle = await readFile(webhookLifecycleUrl, 'utf8');
const blogRoutes = await readFile(blogRoutesUrl, 'utf8');
const toolRegistryData = JSON.parse(await readFile(toolRegistryUrl, 'utf8'));
const activeToolRegistry = (Array.isArray(toolRegistryData?.tools) ? toolRegistryData.tools : [])
  .filter((tool) => tool?.id && String(tool.status || 'active') === 'active')
  .map((tool) => ({
    id: String(tool.id),
    name: String(tool.name || tool.id),
    slug: String(tool.slug || tool.id),
    studio: String(tool.studio || ''),
    studioName: String(tool.studioName || tool.studio || ''),
    url: String(tool.url || ''),
    status: 'active',
  }));

if (!source.trim()) throw new Error('[worker-build] worker.js is empty. Deployment stopped.');
if (!activeToolRegistry.length) throw new Error('[worker-build] Active tool registry is empty. Deployment stopped.');
if (!notificationModule.includes('async function ensureNotificationsSchema')) throw new Error('[worker-build] Notification module is incomplete.');
if (!notificationRoutes.includes('/api/admin/notifications')) throw new Error('[worker-build] Notification routes module is incomplete.');
if (!billingModule.includes('async function billingFinalizePayment')) throw new Error('[worker-build] Billing module is incomplete.');
if (!billingSafetyPatch.includes('async function billingUsageSafe')) throw new Error('[worker-build] Billing safety patch is incomplete.');
if (!billingRoutes.includes('/api/billing/catalog')) throw new Error('[worker-build] Billing routes module is incomplete.');
if (!toolCreditAdmin.includes("'/api/admin/tool-billing'")) throw new Error('[worker-build] Tool credit admin routes module is incomplete.');
if (!toolCreditAdmin.includes('async function adminToolBilling')) throw new Error('[worker-build] Tool credit admin handler is incomplete.');
if (!paymentProviders.includes('NEXAUREN_PAYMENT_PROVIDERS')) throw new Error('[worker-build] Payment provider registry is incomplete.');
if (!paypalProvider.includes('async function paypalAccessToken')) throw new Error('[worker-build] PayPal provider module is incomplete.');
if (!subscriptionModule.includes('async function billingProcessSubscriptionCycle')) throw new Error('[worker-build] Subscription lifecycle module is incomplete.');
if (!webhookLifecycle.includes('async function billingWebhook')) throw new Error('[worker-build] Webhook lifecycle module is incomplete.');
if (!blogRoutes.includes('async function __handleBlogRoute')) throw new Error('[worker-build] Blog routes module is incomplete.');
if (!blogRoutes.includes("'/api/blog/posts'")) throw new Error('[worker-build] Blog public routes are incomplete.');
if (!blogRoutes.includes("'/api/admin/blog/posts'")) throw new Error('[worker-build] Blog admin routes are incomplete.');

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
  if (billingModuleForBuild.includes('async function billingWebhook(')) throw new Error('[worker-build] Legacy billingWebhook declaration was not removed.');
  generated = generated.replace(
    marker,
    billingModuleForBuild + '\n\n' + billingSafetyPatch + '\n\n' + subscriptionModule + '\n\n' + webhookLifecycle + '\n\n' + paymentProviders + '\n\n' + paypalProvider + '\n\n$&',
    1,
  );
}

if (!generated.includes('const __billingUrl')) {
  const fetchMarker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!fetchMarker.test(generated)) throw new Error('[worker-build] Worker structure changed: billing route marker not found.');
  generated = generated.replace(fetchMarker, '$&\n' + billingRoutes + '\n', 1);
}

if (!generated.includes('const __toolBillingUrl')) {
  const billingMarker = 'const __billingUrl = new URL(r.url);';
  if (!generated.includes(billingMarker)) throw new Error('[worker-build] Worker structure changed: tool credit admin insertion marker not found.');
  generated = generated.replace(billingMarker, billingMarker + '\n' + toolCreditAdmin + '\n', 1);
}

const staticRegistryMarker = 'const __toolCreditStaticRegistry = [];';
if (!generated.includes(staticRegistryMarker)) throw new Error('[worker-build] Tool credit static registry marker not found.');
generated = generated.replace(
  staticRegistryMarker,
  `const __toolCreditStaticRegistry = ${JSON.stringify(activeToolRegistry)};`,
);

if (!generated.includes('const __blogUrl')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(generated)) throw new Error('[worker-build] Worker structure changed: blog insertion marker not found.');
  generated = generated.replace(marker, blogRoutes + '\n\n$&', 1);
}

if (!generated.includes('const __blogRouteActive')) {
  const fetchMarker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!fetchMarker.test(generated)) throw new Error('[worker-build] Worker structure changed: blog route marker not found.');
  const blogDispatch = `\n    if (new URL(r.url).pathname.startsWith('/api/blog/') || new URL(r.url).pathname.startsWith('/api/admin/blog/')) {\n      const __blogResponse = await __handleBlogRoute(r, e);\n      if (__blogResponse) return __blogResponse;\n    }\n    const __blogRouteActive = true;\n`;
  generated = generated.replace(fetchMarker, '$&' + blogDispatch, 1);
}

const assetFallbackMarker = '      const response = await e.ASSETS.fetch(r);';
if (!generated.includes(assetFallbackMarker)) throw new Error('[worker-build] Worker structure changed: asset fallback marker not found.');
generated = generated.replace(assetFallbackMarker, "      if (new URL(r.url).pathname.startsWith('/api/')) {\n        return json({ error: 'Not found' }, 404, cors(r));\n      }\n\n" + assetFallbackMarker, 1);

const count = (text, needle) => text.split(needle).length - 1;
if (count(generated, 'async function billingWebhook(') !== 1) throw new Error('[worker-build] billingWebhook must be included exactly once.');
if (count(generated, 'const __billingUrl') !== 1) throw new Error('[worker-build] Billing route module must be included exactly once.');
if (count(generated, 'const __toolBillingUrl') !== 1) throw new Error('[worker-build] Tool credit admin routes must be included exactly once.');
if (count(generated, 'async function adminToolBilling(') !== 1) throw new Error('[worker-build] Admin tool billing handler must be included exactly once.');
if (count(generated, 'async function billingFinalizePayment(') !== 1) throw new Error('[worker-build] billingFinalizePayment must be included exactly once.');
if (count(generated, 'async function paypalAccessToken(') !== 1) throw new Error('[worker-build] PayPal provider must be included exactly once.');
if (count(generated, 'async function __handleBlogRoute(') !== 1) throw new Error('[worker-build] Blog route module must be included exactly once.');
if (count(generated, 'const __blogRouteActive = true;') !== 1) throw new Error('[worker-build] Blog dispatcher must be included exactly once.');

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
]) execFileSync(process.execPath, [script], { stdio: 'inherit' });

try { execFileSync(process.execPath, ['--check', outputUrl.pathname], { stdio: 'inherit' }); }
catch { throw new Error('[worker-build] Generated Worker failed JavaScript syntax validation. Deployment stopped.'); }

console.log('[worker-build] Source inspected.');
console.log('[worker-build] Notification domain module included once.');
console.log('[worker-build] Notification routes included once.');
console.log('[worker-build] Billing core module included once.');
console.log('[worker-build] Billing safety patch included once.');
console.log('[worker-build] Billing routes included once.');
console.log('[worker-build] Tool credit admin routes included once.');
console.log('[worker-build] Active tool registry embedded in Worker build.');
console.log('[worker-build] Payment provider registry included once.');
console.log('[worker-build] PayPal provider included once.');
console.log('[worker-build] Subscription lifecycle included once.');
console.log('[worker-build] Webhook lifecycle included once.');
console.log('[worker-build] Blog API module included once.');
console.log('[worker-build] Blog API dispatcher included once.');
console.log('[worker-build] Unknown API paths fail closed with JSON 404.');
console.log('[worker-build] Existing Worker source/routes preserved.');
console.log('[worker-build] JavaScript syntax check passed.');
console.log(`[worker-build] Deploy artifact: ${outputUrl.pathname}`);