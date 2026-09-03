import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const moduleUrl = new URL('./ai-video-tools.js', import.meta.url);
const providerUrl = new URL('./pixverse-direct.js', import.meta.url);

const worker = await readFile(workerUrl, 'utf8');
const moduleSource = await readFile(moduleUrl, 'utf8');
const providerSource = await readFile(providerUrl, 'utf8');

if (!moduleSource.includes('async function __handleAiVideoToolsRoute(')) {
  throw new Error('[ai-video-patch] AI video module is incomplete.');
}
if (!providerSource.includes('async function pixVerseDirectGenerate(')) {
  throw new Error('[ai-video-patch] Direct PixVerse provider module is incomplete.');
}

// AI Image uses a Cloudflare-hosted @cf model. AI Video currently uses
// PixVerse, which is a third-party model. Calling it through env.AI.run()
// without a provider key falls through to Cloudflare Unified Billing and can
// consume AI Gateway credits. Use the provider API directly instead.
const gatewayCall = 'const response = await e.AI.run(AI_VIDEO_MODEL, input);';
const directCall = 'const response = await pixVerseDirectGenerate(e, input);';
const providerBillingReturn = `
    if (/2021\\s*:\\s*Insufficient AI Gateway credits/i.test(detail)) {
      return aiVideoError(
        'AI video provider billing is unavailable. This is separate from your Nexauren credits.',
        'ai_provider_credits_required',
        503,
        r,
        { provider: 'cloudflare-ai-gateway', nexauren_credits_separate: true },
      );
    }
    return aiVideoError('The AI video generation failed.', 'ai_video_execution_failed', 502, r, detail);`;
const originalReturn = `    return aiVideoError('The AI video generation failed.', 'ai_video_execution_failed', 502, r, detail);`;

let patchedModuleSource = moduleSource.includes(gatewayCall)
  ? moduleSource.replace(gatewayCall, directCall)
  : moduleSource;

if (!patchedModuleSource.includes('pixVerseDirectGenerate(e, input)')) {
  throw new Error('[ai-video-patch] AI video model call was not redirected to PixVerse direct API.');
}

patchedModuleSource = patchedModuleSource.includes(originalReturn)
  ? patchedModuleSource.replace(originalReturn, providerBillingReturn)
  : patchedModuleSource;

if (!patchedModuleSource.includes('ai_provider_credits_required')) {
  throw new Error('[ai-video-patch] Provider billing error guard was not installed.');
}

let generated = worker;

if (!generated.includes('async function __handleAiVideoToolsRoute(')) {
  const marker = /async\\s+function\\s+enhanceHTML\\s*\\(\\s*response\\s*,\\s*request\\s*\\)\\s*\\{/;
  if (!marker.test(generated)) throw new Error('[ai-video-patch] Worker structure changed: enhanceHTML marker not found.');
  generated = generated.replace(marker, providerSource + '\n\n' + patchedModuleSource + '\n\n$&', 1);
} else if (!generated.includes('async function pixVerseDirectGenerate(')) {
  const marker = /async\\s+function\\s+enhanceHTML\\s*\\(\\s*response\\s*,\\s*request\\s*\\)\\s*\\{/;
  if (!marker.test(generated)) throw new Error('[ai-video-patch] Worker structure changed: provider insertion marker not found.');
  generated = generated.replace(marker, providerSource + '\n\n$&', 1);
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
if (count(generated, 'async function pixVerseDirectGenerate(') !== 1) throw new Error('[ai-video-patch] Direct PixVerse provider must be included exactly once.');
if (count(generated, 'const __aiVideoToolsRouteActive = true;') !== 1) throw new Error('[ai-video-patch] AI video dispatcher must be included exactly once.');
if (count(generated, 'const response = await e.AI.run(AI_VIDEO_MODEL, input);') !== 0) throw new Error('[ai-video-patch] AI video still contains the AI Gateway model call.');
if (count(generated, 'const response = await pixVerseDirectGenerate(e, input);') !== 1) throw new Error('[ai-video-patch] Direct PixVerse call missing.');

await writeFile(workerUrl, generated, 'utf8');
console.log('[ai-video-patch] AI video runtime included once.');
console.log('[ai-video-patch] AI video API dispatcher included once.');
console.log('[ai-video-patch] PixVerse is called directly; no AI Gateway Unified Billing fallback.');
console.log('[ai-video-patch] Nexauren credits remain handled by the main DB billing functions.');
