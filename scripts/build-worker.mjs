import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const sourceUrl = new URL('../worker.js', import.meta.url);
const outputDir = new URL('../.worker-build/', import.meta.url);
const outputUrl = new URL('../.worker-build/worker.js', import.meta.url);
const notificationModuleUrl = new URL('./worker/notifications.js', import.meta.url);
const notificationRoutesUrl = new URL('./worker/notification-routes.js', import.meta.url);
const communityMigrationUrl = new URL('./worker/migrate-community-ratings-favorites.mjs', import.meta.url);

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
    if (ch === '\\' && i + 1 < closeTick) {
      body += ch + sourceText[i + 1];
      i += 1;
      continue;
    }
    if (ch === '`') {
      body += '\\`';
      continue;
    }
    if (ch === '$' && sourceText[i + 1] === '{') {
      body += '\\${';
      i += 1;
      continue;
    }
    body += ch;
  }

  return sourceText.slice(0, openTick + 1) + body + sourceText.slice(closeTick);
}

let migrationSource = await readFile(communityMigrationUrl, 'utf8');
migrationSource = normalizeRawTemplate(
  migrationSource,
  'const communityModule = String.raw`',
  '`;\n\nlet generated',
);
migrationSource = normalizeRawTemplate(
  migrationSource,
  'const adminDashboard = String.raw`',
  '`;\n\ngenerated = generated.slice(0, adminStart)',
);
migrationSource = normalizeRawTemplate(
  migrationSource,
  'const routes = String.raw`',
  '`;\n\ngenerated = generated.slice(0, routesStart)',
);

// normalizeRawTemplate escapes nested template syntax so the migration source
// can be parsed as a standalone module. Convert the outer String.raw templates
// to normal templates so those intentional escapes are interpreted instead of
// being emitted literally into the generated Worker.
migrationSource = migrationSource.replaceAll('String.raw`', '`');

migrationSource = migrationSource.replace(
  "new URL('../../.worker-build/worker.js', import.meta.url)",
  "new URL('./worker.js', import.meta.url)",
);

const normalizedMigrationUrl = new URL('../.worker-build/migrate-community-ratings-favorites.mjs', import.meta.url);
await writeFile(normalizedMigrationUrl, migrationSource, 'utf8');

for (const script of [
  normalizedMigrationUrl.pathname,
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
console.log('[worker-build] Studio/Experience ratings and favorites migration included once.');
console.log('[worker-build] Community rating ownership hardening included once.');
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