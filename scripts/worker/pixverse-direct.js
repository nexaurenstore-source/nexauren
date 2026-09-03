/* Direct PixVerse provider runtime.
 * Keeps provider billing separate from Cloudflare AI Gateway credits.
 * Nexauren user credits are handled by ai-video-tools.js before/after this call.
 * Requires a Worker secret named PIXVERSE_API_KEY.
 */

const PIXVERSE_DIRECT_BASE = 'https://app-api.pixverse.ai/openapi/v2';

function pixVerseErrorDetail(error) {
  const raw = error instanceof Error ? error.message : String(error || 'Unknown error');
  return raw.replace(/\s+/g, ' ').slice(0, 600);
}

async function pixVerseJson(response) {
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) {
    const msg = data?.ErrMsg || data?.error || `PixVerse HTTP ${response.status}`;
    throw new Error(`PIXVERSE_HTTP_${response.status}: ${String(msg).slice(0, 400)}`);
  }
  if (!data || Number(data.ErrCode || 0) !== 0) {
    throw new Error(`PIXVERSE_API_${Number(data?.ErrCode || -1)}: ${String(data?.ErrMsg || 'PixVerse request failed').slice(0, 400)}`);
  }
  return data;
}

async function pixVerseHeaders(apiKey, traceId) {
  return {
    'API-KEY': apiKey,
    'Ai-trace-id': traceId,
    Accept: 'application/json',
  };
}

async function pixVerseUploadImage(apiKey, traceId, file) {
  const body = new FormData();
  body.append('image', file, file.name || 'reference-image');
  const response = await fetch(`${PIXVERSE_DIRECT_BASE}/image/upload`, {
    method: 'POST',
    headers: await pixVerseHeaders(apiKey, traceId),
    body,
  });
  const data = await pixVerseJson(response);
  const imageId = Number(data?.Resp?.img_id);
  if (!Number.isInteger(imageId) || imageId <= 0) throw new Error('PIXVERSE_IMAGE_UPLOAD_EMPTY');
  return imageId;
}

async function pixVerseSubmit(apiKey, traceId, input) {
  let endpoint = `${PIXVERSE_DIRECT_BASE}/video/text/generate`;
  const payload = {
    model: 'v6',
    prompt: input.prompt,
    duration: input.duration,
    quality: input.quality,
    aspect_ratio: input.aspect_ratio,
    seed: Number.isInteger(input.seed) ? input.seed : 0,
    motion_mode: 'normal',
  };

  if (input.negative_prompt) payload.negative_prompt = input.negative_prompt;
  if (input.image_file instanceof File) {
    const imageTrace = crypto.randomUUID();
    const imgId = await pixVerseUploadImage(apiKey, imageTrace, input.image_file);
    endpoint = `${PIXVERSE_DIRECT_BASE}/video/img/generate`;
    delete payload.aspect_ratio;
    payload.img_id = imgId;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { ...(await pixVerseHeaders(apiKey, traceId)), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await pixVerseJson(response);
  const videoId = Number(data?.Resp?.video_id);
  if (!Number.isInteger(videoId) || videoId <= 0) throw new Error('PIXVERSE_VIDEO_ID_EMPTY');
  return videoId;
}

async function pixVerseWaitForResult(apiKey, videoId) {
  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(`${PIXVERSE_DIRECT_BASE}/video/result/${videoId}`, {
      method: 'GET',
      headers: await pixVerseHeaders(apiKey, crypto.randomUUID()),
    });
    const data = await pixVerseJson(response);
    const result = data?.Resp || {};
    const status = Number(result.status);
    if (status === 1) {
      const url = String(result.url || '').trim();
      if (!/^https:\/\//i.test(url)) throw new Error('PIXVERSE_RESULT_URL_EMPTY');
      return url;
    }
    if ([6, 7, 8].includes(status)) {
      throw new Error(`PIXVERSE_GENERATION_FAILED_${status}: ${String(data?.ErrMsg || 'Generation failed').slice(0, 300)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error('PIXVERSE_GENERATION_TIMEOUT');
}

async function pixVerseDirectGenerate(e, input) {
  const apiKey = clean(e?.PIXVERSE_API_KEY);
  if (!apiKey) {
    throw new Error('PIXVERSE_API_KEY_NOT_CONFIGURED: configure the PixVerse API key in the Worker secret.');
  }

  const traceId = crypto.randomUUID();
  const videoId = await pixVerseSubmit(apiKey, traceId, input);
  const video = await pixVerseWaitForResult(apiKey, videoId);
  return { video, provider: 'pixverse-direct', provider_video_id: videoId };
}
