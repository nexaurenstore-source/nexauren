import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const moduleUrl = new URL('./ai-tools.js', import.meta.url);

const worker = await readFile(workerUrl, 'utf8');
const moduleSource = await readFile(moduleUrl, 'utf8');

if (!moduleSource.includes('async function __handleAiToolsRoute(')) {
  throw new Error('[ai-tools-patch] AI tools module is incomplete.');
}

let generated = worker;

if (!generated.includes('async function __handleAiToolsRoute(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(generated)) {
    throw new Error('[ai-tools-patch] Worker structure changed: enhanceHTML marker not found.');
  }
  generated = generated.replace(marker, moduleSource + '\n\n$&', 1);
}

if (!generated.includes('const __aiToolsRouteActive = true;')) {
  const fetchMarker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!fetchMarker.test(generated)) {
    throw new Error('[ai-tools-patch] Worker structure changed: fetch(r, e) marker not found.');
  }

  const dispatch = `\n    const __aiToolsRouteActive = true;\n    const __aiToolsPath = new URL(r.url).pathname;\n    if (__aiToolsPath === '/api/ai/tools' || __aiToolsPath === '/api/ai/pdf-summarizer') {\n      const __aiToolsResponse = await __handleAiToolsRoute(r, e);\n      if (__aiToolsResponse) return __aiToolsResponse;\n    }\n`;
  generated = generated.replace(fetchMarker, '$&' + dispatch, 1);
}

const count = (text, needle) => text.split(needle).length - 1;
if (count(generated, 'async function __handleAiToolsRoute(') !== 1) {
  throw new Error('[ai-tools-patch] AI tools module must be included exactly once.');
}
if (count(generated, 'const __aiToolsRouteActive = true;') !== 1) {
  throw new Error('[ai-tools-patch] AI tools dispatcher must be included exactly once.');
}

await writeFile(workerUrl, generated, 'utf8');
console.log('[ai-tools-patch] AI tools runtime included once.');
console.log('[ai-tools-patch] AI tools API dispatcher included once.');
console.log('[ai-tools-patch] Existing Worker source preserved.');
