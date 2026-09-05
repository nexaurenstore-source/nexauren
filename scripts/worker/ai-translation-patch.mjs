import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const moduleUrl = new URL('./ai-translation.js', import.meta.url);

const worker = await readFile(workerUrl, 'utf8');
const moduleSource = await readFile(moduleUrl, 'utf8');
let generated = worker;

if (!generated.includes('async function __handleAiTranslationRoute(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(generated)) throw new Error('[ai-translation-patch] Worker structure changed: enhanceHTML marker not found.');
  generated = generated.replace(marker, moduleSource + '\n\n$&', 1);
}

if (!generated.includes('const __aiTranslationRouteActive = true;')) {
  const fetchMarker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!fetchMarker.test(generated)) throw new Error('[ai-translation-patch] Worker structure changed: fetch(r, e) marker not found.');
  const dispatch = `\n    const __aiTranslationRouteActive = true;\n    const __aiTranslationPath = new URL(r.url).pathname;\n    if (__aiTranslationPath === '/api/ai/translate') {\n      const __aiTranslationResponse = await __handleAiTranslationRoute(r, e);\n      if (__aiTranslationResponse) return __aiTranslationResponse;\n    }\n`;
  generated = generated.replace(fetchMarker, '$&' + dispatch, 1);
}

if (generated.split('async function __handleAiTranslationRoute(').length - 1 !== 1) {
  throw new Error('[ai-translation-patch] Translation handler must be included exactly once.');
}
if (generated.split('const __aiTranslationRouteActive = true;').length - 1 !== 1) {
  throw new Error('[ai-translation-patch] Translation dispatcher must be included exactly once.');
}

await writeFile(workerUrl, generated, 'utf8');
console.log('[ai-translation-patch] Workers AI translation route included once.');
