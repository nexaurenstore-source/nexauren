import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const outputUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const moduleUrl = new URL('./sample-maker-limits.js', import.meta.url);
const source = await readFile(outputUrl, 'utf8');
const moduleSource = await readFile(moduleUrl, 'utf8');

if (!moduleSource.includes('async function sampleMakerGeneration(') || !moduleSource.includes('async function sampleMakerUsage(')) {
  throw new Error('[sample-maker-build] Server enforcement module is incomplete.');
}

let generated = source;

if (!generated.includes('async function sampleMakerGeneration(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(generated)) throw new Error('[sample-maker-build] enhanceHTML marker not found.');
  generated = generated.replace(marker, moduleSource + '\n\n$&', 1);
}

if (!generated.includes('const __sampleMakerUrl')) {
  const fetchMarker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!fetchMarker.test(generated)) throw new Error('[sample-maker-build] fetch(r, e) marker not found.');
  const route = `\n    const __sampleMakerUrl = new URL(r.url);\n    if (__sampleMakerUrl.pathname === '/api/tools/sample-maker/generation' && r.method === 'POST') return sampleMakerGeneration(r, e);\n    if (__sampleMakerUrl.pathname === '/api/tools/sample-maker/usage' && r.method === 'GET') return sampleMakerUsage(r, e);\n`;
  generated = generated.replace(fetchMarker, '$&' + route, 1);
}

const count = (text, needle) => text.split(needle).length - 1;
if (count(generated, 'async function sampleMakerGeneration(') !== 1 || count(generated, 'async function sampleMakerUsage(') !== 1) {
  throw new Error('[sample-maker-build] Sample Maker enforcement functions must be included exactly once.');
}
if (count(generated, 'const __sampleMakerUrl') !== 1) {
  throw new Error('[sample-maker-build] Sample Maker route marker must be included exactly once.');
}

await writeFile(outputUrl, generated, 'utf8');
execFileSync(process.execPath, ['--check', outputUrl.pathname], { stdio: 'inherit' });
console.log('[sample-maker-build] Server-side Sample Maker enforcement included.');
console.log('[sample-maker-build] Sample Maker generation and usage routes included once.');
console.log('[sample-maker-build] JavaScript syntax check passed.');
