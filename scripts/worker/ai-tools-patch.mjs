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

// Keep the Google Gemma model through Cloudflare Workers AI, but make the
// request safer for large PDFs and expose the real failure reason to the UI.
generated = generated.replace(
  "const maxChars = requiredLevel >= 3 ? 900000 : requiredLevel >= 2 ? 700000 : 450000;",
  "const maxChars = 450000;",
);
generated = generated.replace(
  '    max_tokens: 5000,',
  '    max_completion_tokens: 3000,',
);
generated = generated.replace(
  "    return aiToolsError('The AI tool could not complete the request.', 'ai_execution_failed', 502, r);",
  "    return json({ error: 'The AI tool could not complete the request.', code: 'ai_execution_failed', details: String(error?.message || error || 'Unknown AI error').slice(0, 500) }, 502, cors(r));",
);

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
console.log('[ai-tools-patch] Gemma request safeguards applied.');
console.log('[ai-tools-patch] Existing Worker source preserved.');
