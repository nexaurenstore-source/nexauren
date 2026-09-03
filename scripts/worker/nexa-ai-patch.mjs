import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const moduleUrl = new URL('./nexa-ai.js', import.meta.url);
const agentUrl = new URL('./nexa-agent.js', import.meta.url);
const worker = await readFile(workerUrl, 'utf8');
const moduleSource = await readFile(moduleUrl, 'utf8');
const agentSource = await readFile(agentUrl, 'utf8');

if (!moduleSource.includes('async function __handleNexaAiRoute(')) throw new Error('[nexa-ai-patch] Nexa module is incomplete.');
if (!agentSource.includes('async function __handleNexaAgentRoute(')) throw new Error('[nexa-ai-patch] Nexa agent module is incomplete.');
let generated = worker;
if (!generated.includes('async function __handleNexaAiRoute(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(generated)) throw new Error('[nexa-ai-patch] Worker structure changed: enhanceHTML marker not found.');
  generated = generated.replace(marker, moduleSource + '\n\n' + agentSource + '\n\n$&', 1);
}
if (!generated.includes('const __nexaAiRouteActive = true;')) {
  const fetchMarker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!fetchMarker.test(generated)) throw new Error('[nexa-ai-patch] Worker structure changed: fetch marker not found.');
  const dispatch = `\n    const __nexaAiRouteActive = true;\n    const __nexaAiPath = new URL(r.url).pathname;\n    if (__nexaAiPath === '/api/nexa-ai/chat') {\n      const __nexaAgentResponse = await __handleNexaAgentRoute(r, e);\n      if (__nexaAgentResponse) return __nexaAgentResponse;\n    }\n    if (__nexaAiPath === '/api/nexa-ai' || __nexaAiPath === '/api/nexa-ai/chat' || __nexaAiPath === '/api/nexa-ai/conversations' || __nexaAiPath === '/api/nexa-ai/history') {\n      const __nexaAiResponse = await __handleNexaAiRoute(r, e);\n      if (__nexaAiResponse) return __nexaAiResponse;\n    }\n`;
  generated = generated.replace(fetchMarker, '$&' + dispatch, 1);
}

// Rename the existing HTML enhancer and add a tiny global launcher to every HTML page.
if (!generated.includes('async function __nexaOriginalEnhanceHTML(')) {
  generated = generated.replace(
    /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/,
    'async function __nexaOriginalEnhanceHTML(response, request) {'
  );
  const wrapper = `\n\nasync function enhanceHTML(response, request) {\n  const enhanced = await __nexaOriginalEnhanceHTML(response, request);\n  try {\n    const contentType = enhanced.headers.get('content-type') || '';\n    if (!contentType.includes('text/html')) return enhanced;\n    const html = await enhanced.text();\n    if (html.includes('/ai/nexa/nexa-widget.js')) return new Response(html, enhanced);\n    const injection = '<link rel="stylesheet" href="/ai/nexa/nexa-widget.css"><script src="/ai/nexa/nexa-widget.js" defer></script>';\n    const out = html.includes('</head>') ? html.replace('</head>', injection + '</head>') : html.replace('</body>', injection + '</body>');\n    const headers = new Headers(enhanced.headers);\n    headers.delete('content-length');\n    return new Response(out, { status: enhanced.status, statusText: enhanced.statusText, headers });\n  } catch (error) {\n    console.error('Nexa global widget injection failed', error);\n    return enhanced;\n  }\n}\n`;
  generated += wrapper;
}

if (generated.split('async function __handleNexaAiRoute(').length - 1 !== 1) throw new Error('[nexa-ai-patch] Nexa route included more than once.');
if (generated.split('async function __handleNexaAgentRoute(').length - 1 !== 1) throw new Error('[nexa-ai-patch] Nexa agent route included more than once.');
if (generated.split('const __nexaAiRouteActive = true;').length - 1 !== 1) throw new Error('[nexa-ai-patch] Nexa dispatcher included more than once.');
await writeFile(workerUrl, generated, 'utf8');
console.log('[nexa-ai-patch] Nexa AI runtime included once.');
console.log('[nexa-ai-patch] Nexa safe agent orchestration enabled.');
console.log('[nexa-ai-patch] Nexa global floating widget injection enabled.');
