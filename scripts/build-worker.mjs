import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const sourceUrl = new URL('../worker.js', import.meta.url);
const outputDir = new URL('../.worker-build/', import.meta.url);
const outputUrl = new URL('../.worker-build/worker.js', import.meta.url);
const notificationModuleUrl = new URL('./worker/notifications.js', import.meta.url);
const notificationRoutesUrl = new URL('./worker/notification-routes.js', import.meta.url);

const source = await readFile(sourceUrl, 'utf8');
const notificationModule = await readFile(notificationModuleUrl, 'utf8');
const notificationRoutes = await readFile(notificationRoutesUrl, 'utf8');

if (!source.trim()) throw new Error('[worker-build] worker.js is empty. Deployment stopped.');
if (!notificationModule.includes('async function ensureNotificationsSchema')) throw new Error('[worker-build] Notification module is incomplete.');
if (!notificationRoutes.includes('/api/admin/notifications')) throw new Error('[worker-build] Notification routes module is incomplete.');

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

await mkdir(outputDir, { recursive: true });
await writeFile(outputUrl, generated, 'utf8');

for (const script of [
  'worker/migrate-community-ratings-favorites.mjs',
  'worker/inject-design-system.mjs',
  'worker/inject-seo.mjs',
  'worker/enforce-admin-routes.mjs',
  'worker/harden-security.mjs',
  'worker/harden-auth.mjs',
  'extend-admin-users.mjs',
  'protect-admin-user.mjs',
  'extend-blocked-users.mjs',
]) {
  execFileSync(process.execPath, [new URL(`./${script}`, import.meta.url).pathname], { stdio: 'inherit' });
}

try {
  execFileSync(process.execPath, ['--check', outputUrl.pathname], { stdio: 'inherit' });
} catch {
  throw new Error('[worker-build] Generated Worker failed JavaScript syntax validation. Deployment stopped.');
}

console.log('[worker-build] Source inspected.');
console.log('[worker-build] Notification domain module included once.');
console.log('[worker-build] Notification routes included once.');
console.log('[worker-build] Studio/Experience ratings and favorites migration included once.');
console.log('[worker-build] Canonical design system injection included once.');
console.log('[worker-build] Registry-driven SEO injection included once.');
console.log('[worker-build] Administrator API perimeter guard included once.');
console.log('[worker-build] Security hardening included once.');
console.log('[worker-build] Authentication hardening included once.');
console.log('[worker-build] Admin Users extension included once.');
console.log('[worker-build] Administrator self-edit protection included.');
console.log('[worker-build] Blocked Users extension included once.');
console.log('[worker-build] Existing Worker source/routes preserved.');
console.log('[worker-build] JavaScript syntax check passed.');
console.log(`[worker-build] Deploy artifact: ${outputUrl.pathname}`);