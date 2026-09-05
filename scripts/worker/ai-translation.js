const __translationLanguages = new Set(['en','pt','fr','es','zh','hi','sw']);
const __translationCodes = { en: 'en', pt: 'pt', fr: 'fr', es: 'es', zh: 'zh', hi: 'hi', sw: 'sw' };

const __translationCors = (r) => ({
  'access-control-allow-origin': r.headers.get('Origin') || 'https://nexaurenstory.com',
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'Content-Type, Accept',
  'access-control-allow-methods': 'POST, OPTIONS',
  'cache-control': 'no-store',
});

const __translationJson = (data, status, r) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...__translationCors(r),
    },
  });

const __translationRate = globalThis.__nexaurenTranslationRate || (globalThis.__nexaurenTranslationRate = new Map());

async function __handleAiTranslationRoute(r, e) {
  if (r.method === 'OPTIONS') return new Response(null, { status: 204, headers: __translationCors(r) });
  if (r.method !== 'POST') return __translationJson({ error: 'Method not allowed.' }, 405, r);
  if (!e.AI || typeof e.AI.run !== 'function') return __translationJson({ error: 'Workers AI is not configured.' }, 503, r);

  const origin = r.headers.get('Origin') || '';
  if (origin && !/^https:\/\/([a-z0-9-]+\.)?nexaurenstory\.com$/i.test(origin)) {
    return __translationJson({ error: 'Origin not allowed.' }, 403, r);
  }

  const ip = r.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const recent = __translationRate.get(ip) || [];
  const active = recent.filter((t) => now - t < 60_000);
  if (active.length >= 20) return __translationJson({ error: 'Too many translation requests. Try again shortly.' }, 429, r);
  active.push(now);
  __translationRate.set(ip, active);

  let d;
  try { d = await r.json(); } catch { return __translationJson({ error: 'Invalid JSON.' }, 400, r); }

  const source = String(d?.source_lang || 'en').toLowerCase().split('-')[0];
  const target = String(d?.target_lang || '').toLowerCase().split('-')[0];
  if (!__translationLanguages.has(source) || !__translationLanguages.has(target)) {
    return __translationJson({ error: 'Unsupported language.' }, 400, r);
  }
  if (source === target) {
    const same = Array.isArray(d?.texts) ? d.texts.map((text) => String(text ?? '')) : [String(d?.text || '')];
    return __translationJson({ translations: same }, 200, r);
  }

  const rawTexts = Array.isArray(d?.texts) ? d.texts : [d?.text];
  const texts = rawTexts.map((v) => String(v ?? '').trim()).filter(Boolean).slice(0, 40);
  if (!texts.length || texts.some((text) => text.length > 240)) {
    return __translationJson({ error: 'Provide 1–40 texts, each up to 240 characters.' }, 400, r);
  }

  try {
    const translations = [];
    for (const text of texts) {
      const response = await e.AI.run('@cf/meta/m2m100-1.2b', {
        text,
        source_lang: __translationCodes[source],
        target_lang: __translationCodes[target],
      });
      const translated = typeof response === 'string'
        ? response
        : response?.translated_text || response?.translation || response?.text || '';
      translations.push(String(translated || text));
    }
    return __translationJson({ translations, source_lang: source, target_lang: target }, 200, r);
  } catch (error) {
    console.error('[ai-translation] Workers AI failed', error);
    return __translationJson({ error: 'Translation service temporarily unavailable.' }, 502, r);
  }
}
