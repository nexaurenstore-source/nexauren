import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const sourceUrl = new URL('../worker.js', import.meta.url);
const outputDir = new URL('../.worker-build/', import.meta.url);
const outputUrl = new URL('../.worker-build/worker.js', import.meta.url);
const notificationModuleUrl = new URL('./worker/notifications.js', import.meta.url);
const notificationRoutesUrl = new URL('./worker/notification-routes.js', import.meta.url);
const studiosUrl = new URL('../frontend/data/studios.json', import.meta.url);
const toolsUrl = new URL('../frontend/data/tools.json', import.meta.url);

const source = await readFile(sourceUrl, 'utf8');
const notificationModule = await readFile(notificationModuleUrl, 'utf8');
const notificationRoutes = await readFile(notificationRoutesUrl, 'utf8');
const studiosData = JSON.parse(await readFile(studiosUrl, 'utf8'));
const toolsData = JSON.parse(await readFile(toolsUrl, 'utf8'));

if (!source.trim()) throw new Error('[worker-build] worker.js is empty. Deployment stopped.');
if (!notificationModule.includes('async function ensureNotificationsSchema')) throw new Error('[worker-build] Notification module is incomplete.');
if (!notificationRoutes.includes('/api/admin/notifications')) throw new Error('[worker-build] Notification routes module is incomplete.');

const seoEntries = [
  { path: '/', title: 'Nexauren — Creative Tools', description: 'A focused suite of browser-based creative tools.' },
  { path: '/studios/', title: 'Studios — Nexauren', description: 'Explore Nexauren Studios and their browser-based Experiences.' },
  { path: '/ranking/', title: 'Ranking — Nexauren', description: 'Discover the most useful Nexauren Experiences.' },
  { path: '/about.html', title: 'About — Nexauren', description: 'Learn about Nexauren and its creative tools platform.' },
  { path: '/faq.html', title: 'FAQ — Nexauren', description: 'Frequently asked questions about Nexauren.' },
  { path: '/privacy.html', title: 'Privacy — Nexauren', description: 'Nexauren privacy information.' },
  { path: '/terms.html', title: 'Terms — Nexauren', description: 'Nexauren terms of service.' },
  ...((studiosData.studios || []).filter(s => s?.status === 'active').map(s => ({
    path: `/studios/${s.slug}/`,
    title: `${s.name} — Nexauren`,
    description: s.description || `${s.name} on Nexauren.`,
  }))),
  ...((toolsData.tools || []).filter(t => t?.status === 'active' && typeof t.url === 'string').map(t => ({
    path: t.url.trim(),
    title: `${t.name} — Nexauren`,
    description: t.description || `${t.name} — a Nexauren Experience.`,
  }))),
];
const seoMap = Object.fromEntries(seoEntries.map(entry => [entry.path, entry]));
const seoInjection = `\nconst __nexaurenSeoMap = ${JSON.stringify(seoMap)};\nasync function __nexaurenSeoInjection(response, request) {\n  if (!response || !response.headers.get('content-type')?.includes('text/html')) return response;\n  const key = new URL(request.url).pathname.replace(/\\/+$/, '/') || '/';\n  const meta = __nexaurenSeoMap[key];\n  if (!meta) return response;\n  const html = await response.text();\n  const title = String(meta.title).replace(/[<>]/g, '');\n  const description = String(meta.description).replace(/[<>]/g, '');\n  let repaired = html;\n  if (/<title>[^<]*<\\/title>/i.test(repaired)) repaired = repaired.replace(/<title>[^<]*<\\/title>/i, `<title>${title}</title>`);\n  else repaired = repaired.replace(/<head([^>]*)>/i, `<head$1><title>${title}</title>`);\n  if (/<meta\\s+name=["']description["'][^>]*>/i.test(repaired)) repaired = repaired.replace(/<meta\\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${description}">`);\n  else repaired = repaired.replace(/<head([^>]*)>/i, `<head$1><meta name="description" content="${description}">`);\n  return new Response(repaired, { status: response.status, statusText: response.statusText, headers: response.headers });\n}\n`;

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

if (!generated.includes('const __nexaurenSeoMap')) {
  const enhanceMarker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!enhanceMarker.test(generated)) throw new Error('[worker-build] Worker structure changed: enhanceHTML marker not found for SEO.');
  generated = generated.replace(enhanceMarker, seoInjection + '\n$&', 1);
  generated = generated.replace(
    'async function enhanceHTML(response, request) {',
    'async function __nexaurenOriginalEnhanceHTML(response, request) {',
  );
  generated += '\nasync function enhanceHTML(response, request) {\n  return __nexaurenSeoInjection(await __nexaurenOriginalEnhanceHTML(response, request), request);\n}\n';
}

await mkdir(outputDir, { recursive: true });
await writeFile(outputUrl, generated, 'utf8');

for (const script of [
  'worker/inject-design-system.mjs',
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
console.log('[worker-build] Canonical design system injection included once.');
console.log('[worker-build] Administrator API perimeter guard included once.');
console.log('[worker-build] Security hardening included once.');
console.log('[worker-build] Authentication hardening included once.');
console.log('[worker-build] Registry-driven SEO metadata map included once.');
console.log('[worker-build] SEO metadata repair injection included once.');
console.log('[worker-build] Admin Users extension included once.');
console.log('[worker-build] Administrator self-edit protection included.');
console.log('[worker-build] Blocked Users extension included once.');
console.log('[worker-build] Existing Worker source/routes preserved.');
console.log('[worker-build] JavaScript syntax check passed.');
console.log(`[worker-build] Deploy artifact: ${outputUrl.pathname}`);
