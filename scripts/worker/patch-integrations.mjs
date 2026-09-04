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

if (!source.includes('async function __integrationCreate(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(source)) throw new Error('[integrations] Worker structure changed: function insertion marker not found.');
  source = source.replace(marker, integrationModule + '\n\n$&', 1);
}

if (!source.includes('const __integrationUrl')) {
  const marker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!marker.test(source)) throw new Error('[integrations] Worker structure changed: fetch insertion marker not found.');
  source = source.replace(marker, '$&\n' + integrationModule.split('\n\nif (__integrationUrl.pathname')[1]?.split('\n').slice(0, 0).join('') || '', 1);
  // The route fragment is already included with the functions above; extract only its dispatch block.
  const dispatchStart = integrationModule.indexOf("if (__integrationUrl.pathname === '/api/integrations'");
  if (dispatchStart < 0) throw new Error('[integrations] Route dispatch marker not found.');
  const dispatch = integrationModule.slice(dispatchStart);
  const fetchMarker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  source = source.replace(fetchMarker, '$&\n' + dispatch + '\n', 1);
}

if ((source.match(/const __integrationUrl/g) || []).length !== 1) {
  throw new Error('[integrations] Integration route dispatch must be included exactly once.');
}

await writeFile(output, source, 'utf8');
console.log('[integrations] Encrypted integration API injected into Worker.');
