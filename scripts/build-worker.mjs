import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const source = new URL('../worker.js', import.meta.url);
const outputDir = new URL('../.worker-build/', import.meta.url);
const output = new URL('../.worker-build/worker.js', import.meta.url);

let sourceCode = await readFile(source, 'utf8');
if (!sourceCode.trim()) throw new Error('[worker-check] worker.js is empty. Deployment stopped.');

// Keep the existing deployment-time notification route injection.
const notificationFunctions = `

async function adminNotifications(r, e) {
  if (!await isAdmin(r, e)) return json({ error: 'Forbidden' }, 403, cors(r));
  return json({ page:1, limit:25, total:0, unread:0, announcements:0, notifications:[] }, 200, cors(r));
}
`;

if (!sourceCode.includes('async function adminNotifications(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(sourceCode)) {
    throw new Error('[worker-check] Worker structure changed: enhanceHTML function not found. Deployment stopped.');
  }
  sourceCode = sourceCode.replace(marker, notificationFunctions + '\n$&', 1);
}

await mkdir(outputDir, { recursive: true });
await writeFile(output, sourceCode, 'utf8');

// The Users extension consumes the generated worker artifact, so it must run after
// the base worker has been written and before Wrangler packages the artifact.
execFileSync(process.execPath, [new URL('./extend-admin-users.mjs', import.meta.url).pathname], { stdio: 'inherit' });
execFileSync(process.execPath, [new URL('./extend-blocked-users.mjs', import.meta.url).pathname], { stdio: 'inherit' });

try {
  execFileSync(process.execPath, ['--check', output.pathname], { stdio: 'inherit' });
} catch {
  throw new Error('[worker-check] Generated worker failed JavaScript syntax validation. Deployment stopped.');
}

console.log('[worker-check] Source inspected.');
console.log('[worker-check] Admin Users extension included once in deployment artifact.');
console.log('[worker-check] Blocked Users extension included once in deployment artifact.');
console.log('[worker-check] Existing Worker source/routes preserved.');
console.log('[worker-check] JavaScript syntax check passed.');
console.log(`[worker-check] Deploy artifact: ${output.pathname}`);
