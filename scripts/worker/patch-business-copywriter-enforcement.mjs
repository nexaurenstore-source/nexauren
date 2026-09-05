import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const outputUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const moduleUrl = new URL('./business-copywriter-limits.js', import.meta.url);
const source = await readFile(outputUrl, 'utf8');
const moduleSource = await readFile(moduleUrl, 'utf8');

if (!moduleSource.includes('async function businessCopywriterConsume(') || !moduleSource.includes('async function businessCopywriterUsage(')) {
  throw new Error('[business-copywriter-build] Server enforcement module is incomplete.');
}

let generated = source;

if (!generated.includes('async function businessCopywriterConsume(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(generated)) throw new Error('[business-copywriter-build] enhanceHTML marker not found.');
  generated = generated.replace(marker, moduleSource + '\n\n$&', 1);
}

if (!generated.includes('const __businessCopywriterUrl')) {
  const fetchMarker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!fetchMarker.test(generated)) throw new Error('[business-copywriter-build] fetch(r, e) marker not found.');
  const route = `\n    const __businessCopywriterUrl = new URL(r.url);\n    if (__businessCopywriterUrl.pathname === '/api/business/copywriter/consume' && r.method === 'POST') return businessCopywriterConsume(r, e);\n    if (__businessCopywriterUrl.pathname === '/api/business/copywriter/usage' && r.method === 'GET') return businessCopywriterUsage(r, e);\n`;
  generated = generated.replace(fetchMarker, '$&' + route, 1);
}

const count = (text, needle) => text.split(needle).length - 1;
if (count(generated, 'async function businessCopywriterConsume(') !== 1 || count(generated, 'async function businessCopywriterUsage(') !== 1) {
  throw new Error('[business-copywriter-build] Enforcement functions must be included exactly once.');
}
if (count(generated, 'const __businessCopywriterUrl') !== 1) {
  throw new Error('[business-copywriter-build] Route marker must be included exactly once.');
}

await writeFile(outputUrl, generated, 'utf8');
execFileSync(process.execPath, ['--check', outputUrl.pathname], { stdio: 'inherit' });
console.log('[business-copywriter-build] Server-side D1 consumption included.');
console.log('[business-copywriter-build] Usage and consume routes included once.');
console.log('[business-copywriter-build] JavaScript syntax check passed.');
