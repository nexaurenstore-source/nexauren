import { readFile, writeFile } from 'node:fs/promises';

const output = new URL('../../.worker-build/worker.js', import.meta.url);
const moduleUrl = new URL('./integrations.js', import.meta.url);

let source = await readFile(output, 'utf8');
const integrationModule = await readFile(moduleUrl, 'utf8');

if (!integrationModule.includes('async function __integrationCreate')) {
  throw new Error('[integrations] Integration module is incomplete.');
}
if (!source.includes('async function currentUser(')) {
  throw new Error('[integrations] Worker auth helper currentUser not found.');
}

const dispatchMarker = 'const __integrationDispatch = `';
const dispatchStart = integrationModule.indexOf(dispatchMarker);
if (dispatchStart < 0) throw new Error('[integrations] Route dispatch marker not found.');
const dispatchEnd = integrationModule.lastIndexOf('`;');
if (dispatchEnd <= dispatchStart) throw new Error('[integrations] Route dispatch closing marker not found.');
const functions = integrationModule.slice(0, dispatchStart).trim();
const dispatch = integrationModule.slice(dispatchStart + dispatchMarker.length, dispatchEnd).replaceAll('\\n', '\n');

if (!source.includes('async function __integrationCreate(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(source)) throw new Error('[integrations] Worker structure changed: function insertion marker not found.');
  source = source.replace(marker, functions + '\n\n$&', 1);
}

if (!source.includes("const __integrationUrl = new URL(r.url);")) {
  const marker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!marker.test(source)) throw new Error('[integrations] Worker structure changed: fetch insertion marker not found.');
  source = source.replace(marker, '$&\n' + dispatch + '\n', 1);
}

if ((source.match(/const __integrationUrl = new URL\(r\.url\);/g) || []).length !== 1) {
  throw new Error('[integrations] Integration route dispatch must be included exactly once.');
}

await writeFile(output, source, 'utf8');
console.log('[integrations] Encrypted integration API injected into Worker.');
