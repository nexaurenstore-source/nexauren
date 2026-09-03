import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const moduleUrl = new URL('./ai-video-tools.js', import.meta.url);

const worker = await readFile(workerUrl, 'utf8');
const moduleSource = await readFile(moduleUrl, 'utf8');

if (!moduleSource.includes('async function __handleAiVideoToolsRoute(')) {
  throw new Error('[ai-video-patch] AI video module is incomplete.');
}

// PixVerse v6 is invoked through the documented Cloudflare AI binding.
// Provider billing is intentionally not mixed with Nexauren credits.
const gatewayCall = 'const response = await e.AI.run(AI_VIDEO_MODEL, input);';
const directCall = gatewayCall;

let patchedModuleSource = moduleSource;
if (!patchedModuleSource.includes(gatewayCall)) {
  throw new Error('[ai-video-patch] PixVerse v6 Cloudflare AI call is missing.');
}

let generated = worker;

if (!generated.includes('async function __handleAiVideoToolsRoute(')) {
  const marker = /async\\s+function\\s+enhanceHTML\\s*\\(\\s*response\\s*,\\s*request\\s*\\)\\s*\\{/;
  if (!marker.test(generated)) throw new Error('[ai-video-patch] Worker structure changed: enhanceHTML marker not found.');
  generated = generated.replace(marker, patchedModuleSource + '\n\n$&', 1);
}

if (!generated.includes('const __aiVideoToolsRouteActive = true;')) {
  const fetchMarker = /async\\s+fetch\\(\\s*r\\s*,\\s*e\\s*\\)\\s*\\{\\s*/;
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
if (count(generated, gatewayCall) !== 1) throw new Error('[ai-video-patch] PixVerse v6 Cloudflare AI call must exist exactly once.');
if (count(generated, 'pixVerseDirectGenerate(') !== 0) throw new Error('[ai-video-patch] Direct PixVerse provider must not be included.');

await writeFile(workerUrl, generated, 'utf8');
console.log('[ai-video-patch] AI video runtime included once.');
console.log('[ai-video-patch] PixVerse v6 uses env.AI.run().');
console.log('[ai-video-patch] Nexauren credits remain separate from provider billing.');
