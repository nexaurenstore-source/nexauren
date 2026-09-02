const NEXAUREN_SAMPLE_MAKER_PLANS = {
  free: { daily: 10, max: 10, effects: 0 },
  starter: { daily: 25, max: 50, effects: 1 },
  pro: { daily: Infinity, max: 500, effects: 2 },
  premium: { daily: Infinity, max: 500, effects: 3 },
};

const NEXAUREN_SAMPLE_MAKER_EFFECT_TIERS = {
  gain: 0,
  eq: 0,
  lowpass: 0,
  highpass: 0,
  reverb: 0,
  delay: 0,
  compressor: 1,
  saturation: 1,
  distortion: 1,
  chorus: 1,
  flanger: 1,
  phaser: 1,
  bitcrusher: 1,
  stereo: 1,
  transient: 2,
  stretch: 2,
  granular: 2,
  chain: 3,
};

function normalizeSampleMakerPlan(value) {
  const raw = String(value || 'free').trim().toLowerCase();
  if (raw.includes('premium')) return 'premium';
  if (raw.includes('pro')) return 'pro';
  if (raw.includes('starter')) return 'starter';
  return 'free';
}

function sampleMakerJson(data, status, request) {
  return json(data, status, cors(request));
}

async function sampleMakerGeneration(r, e) {
  const user = await currentUser(r, e);
  if (!user) return sampleMakerJson({ error: 'Authentication required' }, 401, r);

  let payload;
  try {
    payload = await r.json();
  } catch {
    return sampleMakerJson({ error: 'Invalid JSON body' }, 400, r);
  }

  const count = Number(payload?.count);
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    return sampleMakerJson({ error: 'Sample count must be an integer from 1 to 500.' }, 400, r);
  }

  const reference = String(payload?.reference || '').trim();
  if (!reference || reference.length > 160) {
    return sampleMakerJson({ error: 'A valid generation reference is required.' }, 400, r);
  }

  const rawEffects = Array.isArray(payload?.effects) ? payload.effects : [];
  const effects = [...new Set(rawEffects.map((x) => String(x || '').trim().toLowerCase()))].filter(Boolean);
  const invalidEffects = effects.filter((effect) => !Object.prototype.hasOwnProperty.call(NEXAUREN_SAMPLE_MAKER_EFFECT_TIERS, effect));
  if (invalidEffects.length) {
    return sampleMakerJson({ error: 'Unsupported Sample Maker effect.', effects: invalidEffects }, 400, r);
  }

  const account = await e.DB.prepare(
    'SELECT plan_id FROM billing_accounts WHERE user_id = ? LIMIT 1',
  ).bind(user.id).first();
  const plan = normalizeSampleMakerPlan(account?.plan_id);
  const limits = NEXAUREN_SAMPLE_MAKER_PLANS[plan];

  if (count > limits.max) {
    return sampleMakerJson({
      error: 'Sample generation exceeds your plan limit.',
      code: 'SAMPLE_MAKER_SAMPLE_LIMIT',
      plan,
      max_samples: limits.max,
    }, 403, r);
  }

  const highestEffectTier = effects.reduce(
    (highest, effect) => Math.max(highest, NEXAUREN_SAMPLE_MAKER_EFFECT_TIERS[effect]),
    0,
  );
  if (highestEffectTier > limits.effects) {
    return sampleMakerJson({
      error: 'One or more selected effects require a higher plan.',
      code: 'SAMPLE_MAKER_EFFECT_LOCKED',
      plan,
      required_tier: highestEffectTier,
    }, 403, r);
  }

  const usageDate = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  const dailyLimit = Number.isFinite(limits.daily) ? limits.daily : 2147483647;
  const generationId = uuid();
  const effectsJson = JSON.stringify(effects);

  try {
    const batchResult = await e.DB.batch([
      e.DB.prepare(
        `INSERT OR IGNORE INTO sample_maker_daily_usage
          (user_id, usage_date, generations, updated_at)
         VALUES (?, ?, 0, ?)`,
      ).bind(user.id, usageDate, now),
      e.DB.prepare(
        `INSERT INTO sample_maker_generations
          (id, user_id, usage_date, reference, sample_count, effects_json, created_at)
         SELECT ?, ?, ?, ?, ?, ?, ?
         WHERE (SELECT generations FROM sample_maker_daily_usage WHERE user_id = ? AND usage_date = ?) < ?
           AND NOT EXISTS (
             SELECT 1 FROM sample_maker_generations WHERE user_id = ? AND reference = ?
           )`,
      ).bind(
        generationId,
        user.id,
        usageDate,
        reference,
        count,
        effectsJson,
        now,
        user.id,
        usageDate,
        dailyLimit,
        user.id,
        reference,
      ),
    ]);

    const inserted = Number(batchResult?.[1]?.meta?.changes || 0) > 0;
    const existing = await e.DB.prepare(
      `SELECT id, sample_count, usage_date, effects_json
       FROM sample_maker_generations
       WHERE user_id = ? AND reference = ? LIMIT 1`,
    ).bind(user.id, reference).first();

    if (!inserted && !existing) {
      const row = await e.DB.prepare(
        'SELECT generations FROM sample_maker_daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1',
      ).bind(user.id, usageDate).first();
      const used = Number(row?.generations || 0);
      return sampleMakerJson({
        error: 'Daily Sample Maker generation limit reached.',
        code: 'SAMPLE_MAKER_DAILY_LIMIT',
        plan,
        generations_used: used,
        daily_limit: Number.isFinite(limits.daily) ? limits.daily : null,
        remaining: Number.isFinite(limits.daily) ? Math.max(0, limits.daily - used) : null,
      }, 429, r);
    }

    const row = await e.DB.prepare(
      'SELECT generations FROM sample_maker_daily_usage WHERE user_id = ? AND usage_date = ? LIMIT 1',
    ).bind(user.id, usageDate).first();
    const used = Number(row?.generations || 0);

    return sampleMakerJson({
      success: true,
      id: existing?.id || generationId,
      reference,
      idempotent: !inserted,
      plan,
      sample_count: Number(existing?.sample_count || count),
      generations_used: used,
      daily_limit: Number.isFinite(limits.daily) ? limits.daily : null,
      remaining: Number.isFinite(limits.daily) ? Math.max(0, limits.daily - used) : null,
      max_samples: limits.max,
      effect_tier: limits.effects,
    }, 200, r);
  } catch (error) {
    console.error('Sample Maker generation authorization failed:', error);
    return sampleMakerJson({ error: 'Unable to authorize this generation.' }, 500, r);
  }
}
