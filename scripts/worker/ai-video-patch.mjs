import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const moduleUrl = new URL('./ai-video-tools.js', import.meta.url);

const worker = await readFile(workerUrl, 'utf8');
const moduleSource = await readFile(moduleUrl, 'utf8');

if (!moduleSource.includes('async function __handleAiVideoToolsRoute(')) {
  throw new Error('[ai-video-patch] AI video module is incomplete.');
}

let generated = worker;

if (!generated.includes('async function __handleAiVideoToolsRoute(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(generated)) throw new Error('[ai-video-patch] Worker structure changed: enhanceHTML marker not found.');
  generated = generated.replace(marker, moduleSource + '\n\n$&', 1);
}

if (!generated.includes('const __aiVideoToolsRouteActive = true;')) {
  const fetchMarker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!fetchMarker.test(generated)) throw new Error('[ai-video-patch] Worker structure changed: fetch(r, e) marker not found.');
  const dispatch = `
    const __aiVideoToolsRouteActive = true;
    const __aiVideoPath = new URL(r.url).pathname;
    if (__aiVideoPath === '/api/ai/video-generator') {
      const __aiVideoResponse = await __handleAiVideoToolsRoute(r, e);
      if (__aiVideoResponse) return __aiVideoResponse;
    }
`;
  generated = generated.replace(fetchMarker, '$&' + dispatch, 1);
}

const count = (text, needle) => text.split(needle).length - 1;
if (count(generated, 'async function __handleAiVideoToolsRoute(') !== 1) throw new Error('[ai-video-patch] AI video module must be included exactly once.');
if (count(generated, 'const __aiVideoToolsRouteActive = true;') !== 1) throw new Error('[ai-video-patch] AI video dispatcher must be included exactly once.');

await writeFile(workerUrl, generated, 'utf8');
console.log('[ai-video-patch] AI video runtime included once.');
console.log('[ai-video-patch] AI video API dispatcher included once.');
