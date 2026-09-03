import { readFile, writeFile } from 'node:fs/promises';
const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const moduleUrl = new URL('./nexa-ai.js', import.meta.url);
const worker = await readFile(workerUrl, 'utf8');
const moduleSource = await readFile(moduleUrl, 'utf8');
if (!moduleSource.includes('async function __handleNexaAiRoute(')) throw new Error('[nexa-ai-patch] Nexa module is incomplete.');
let generated = worker;
if (!generated.includes('async function __handleNexaAiRoute(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(generated)) throw new Error('[nexa-ai-patch] enhanceHTML marker not found.');
  generated = generated.replace(marker, moduleSource + '\n\n$&', 1);
}
if (!generated.includes('const __nexaAiRouteActive = true;')) {
  const fetchMarker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!fetchMarker.test(generated)) throw new Error('[nexa-ai-patch] fetch marker not found.');
  const dispatch = `\n    const __nexaAiRouteActive = true;\n    const __nexaAiPath = new URL(r.url).pathname;\n    if (__nexaAiPath === '/api/nexa-ai' || __nexaAiPath === '/api/nexa-ai/chat' || __nexaAiPath === '/api/nexa-ai/conversations' || __nexaAiPath === '/api/nexa-ai/history') {\n      const __nexaAiResponse = await __handleNexaAiRoute(r, e);\n      if (__nexaAiResponse) return __nexaAiResponse;\n    }\n`;
  generated = generated.replace(fetchMarker, '$&' + dispatch, 1);
}
if (!generated.includes('async function __nexaOriginalEnhanceHTML(')) {
  generated = generated.replace(/async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/, 'async function __nexaOriginalEnhanceHTML(response, request) {');
  generated += `\n\nasync function enhanceHTML(response, request) {\n  const enhanced = await __nexaOriginalEnhanceHTML(response, request);\n  try {\n    const contentType = enhanced.headers.get('content-type') || '';\n    if (!contentType.includes('text/html')) return enhanced;\n    const html = await enhanced.text();\n    if (html.includes('/ai/nexa/nexa-widget.js')) return new Response(html, { status: enhanced.status, statusText: enhanced.statusText, headers: new Headers(enhanced.headers) });\n    const injection = '<link rel="stylesheet" href="/ai/nexa/nexa-widget.css"><script src="/ai/nexa/nexa-widget.js" defer></script>';\n    const out = html.includes('</head>') ? html.replace('</head>', injection + '</head>') : html.replace('</body>', injection + '</body>');\n    const headers = new Headers(enhanced.headers); headers.delete('content-length');\n    return new Response(out, { status: enhanced.status, statusText: enhanced.statusText, headers });\n  } catch (error) { console.error('Nexa global widget injection failed', error); return enhanced; }\n}\n`;
}
if (generated.split('async function __handleNexaAiRoute(').length - 1 !== 1) throw new Error('[nexa-ai-patch] duplicate route.');
if (generated.split('const __nexaAiRouteActive = true;').length - 1 !== 1) throw new Error('[nexa-ai-patch] duplicate dispatcher.');
await writeFile(workerUrl, generated, 'utf8');
console.log('[nexa-ai-patch] Nexa AI runtime included once.');
console.log('[nexa-ai-patch] Global floating widget enabled.');
