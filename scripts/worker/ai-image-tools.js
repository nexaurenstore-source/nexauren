/* NEXAUREN AI IMAGE GENERATOR v1
 * Image generation runtime backed by TOOLS_DB + Cloudflare Workers AI.
 * Credit balance remains authoritative in the main DB (DB).
 */

const AI_IMAGE_TOOL_ID = 'ai_image_generator';
const AI_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
const AI_IMAGE_PLAN_LEVELS = Object.freeze({ free: 0, starter: 1, pro: 2, premium: 3 });
const AI_IMAGE_MAX_PROMPT = 2048;
const AI_IMAGE_MAX_UPLOAD = 10 * 1024 * 1024;
const AI_IMAGE_ALLOWED_SIZES = new Set(['512x512']);

function aiImageNormalizePlan(value) {
  const raw = clean(value).toLowerCase();
  if (raw === 'premium' || raw.startsWith('premium_') || raw.startsWith('premium-')) return 'premium';
  if (raw === 'pro' || raw.startsWith('pro_') || raw.startsWith('pro-')) return 'pro';
  if (raw === 'starter' || raw.startsWith('starter_') || raw.startsWith('starter-')) return 'starter';
  return 'free';
}

async function aiImageUser(r, e) { return currentUser(r, e); }

async function aiImagePlan(e, userId) {
  if (typeof billingEnsureAccount !== 'function') throw new Error('Billing core is unavailable.');
  const account = await billingEnsureAccount(e, userId);
  const id = aiImageNormalizePlan(account?.plan_id || account?.plan_name);
  return { id, level: AI_IMAGE_PLAN_LEVELS[id], account };
}

function aiImageParseLimits(value) {
  try { const parsed = typeof value === 'string' ? JSON.parse(value) : value; return parsed && typeof parsed === 'object' ? parsed : {}; }
  catch { return {}; }
}

async function aiImageMonthlyUsage(e, userId, featureId) {
  const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0);
  const row = await e.TOOLS_DB.prepare("SELECT COUNT(*) AS total FROM tool_usage WHERE user_id=?1 AND tool_id=?2 AND feature_id=?3 AND status='completed' AND created_at>=?4")
    .bind(userId, AI_IMAGE_TOOL_ID, featureId, Math.floor(start.getTime() / 1000)).first();
  return Number(row?.total || 0);
}

async function aiImageJobByRequest(e, requestId) {
  return e.TOOLS_DB.prepare('SELECT id,status,output_json,error_message FROM tool_jobs WHERE request_id=?1 LIMIT 1').bind(requestId).first();
}

async function aiImageCreateJob(e, { userId, featureId, requestId, input }) {
  const id = uuid(); const now = Math.floor(Date.now() / 1000);
  await e.TOOLS_DB.prepare("INSERT INTO tool_jobs(id,user_id,tool_id,feature_id,request_id,status,provider,input_json,created_at) VALUES(?1,?2,?3,?4,?5,'processing','cloudflare-workers-ai',?6,?7)")
    .bind(id, userId, AI_IMAGE_TOOL_ID, featureId, requestId, JSON.stringify(input || {}), now).run();
  return { id, createdAt: now };
}

async function aiImageFinishJob(e, jobId, status, output, errorMessage = null) {
  const now = Math.floor(Date.now() / 1000);
  await e.TOOLS_DB.prepare('UPDATE tool_jobs SET status=?1,output_json=?2,error_message=?3,started_at=COALESCE(started_at,?4),completed_at=?4 WHERE id=?5')
    .bind(status, output == null ? null : JSON.stringify(output), errorMessage, now, jobId).run();
}

async function aiImageLogUsage(e, { userId, featureId, jobId, requestId, creditsUsed, status, metadata }) {
  const now = Math.floor(Date.now() / 1000);
  await e.TOOLS_DB.prepare('INSERT OR REPLACE INTO tool_usage(id,user_id,tool_id,feature_id,job_id,request_id,credits_used,status,metadata_json,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)')
    .bind(uuid(), userId, AI_IMAGE_TOOL_ID, featureId, jobId, requestId, Math.max(0, Math.floor(Number(creditsUsed) || 0)), status, JSON.stringify(metadata || {}), now).run();
}

async function aiImageRefund(e, userId, credits, requestId) {
  if (!credits || typeof billingAddCredits !== 'function') return;
  await billingAddCredits(e, { userId, amount: credits, type: 'refund', description: `AI tool refund: ${AI_IMAGE_TOOL_ID}`, reference: `ai-refund:${requestId}`, toolId: AI_IMAGE_TOOL_ID });
}

function aiImageDataUri(image) {
  const base64 = clean(image);
  if (!base64) throw new Error('AI_IMAGE_EMPTY_RESPONSE');
  return `data:image/jpeg;base64,${base64}`;
}

function aiImageFeatureModel(feature) {
  return feature.slug === 'premium-generation' ? AI_IMAGE_MODEL : AI_IMAGE_MODEL;
}

async function aiImageRunModel(e, { prompt, steps }) {
  if (!e?.AI || typeof e.AI.run !== 'function') throw new Error('Workers AI binding is not configured.');
  try {
    // Do not send seed to the deployed FLUX.1 Schnell schema. The current
    // runtime is rejecting that property with "Additional or unevaluated
    // properties '/seed' at '/'" even though some Cloudflare docs show seed.
    const response = await e.AI.run(aiImageFeatureModel({ slug: 'generation' }), {
      prompt,
      steps: Math.max(1, Math.min(8, Number(steps) || 4)),
    });
    return aiImageDataUri(response?.image);
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error || 'Unknown error');
    throw new Error(`AI_IMAGE_REQUEST_FAILED: ${raw.replace(/\s+/g, ' ').slice(0, 600)}`);
  }
}

async function aiImageCatalog(r, e) {
  try {
    if (!e?.TOOLS_DB) throw new Error('TOOLS_DB binding is unavailable.');
    const tool = await e.TOOLS_DB.prepare("SELECT id,slug,name,category,description,status,config_json FROM tools WHERE id=?1 AND status='active' LIMIT 1").bind(AI_IMAGE_TOOL_ID).first();
    if (!tool) return json({ error: 'AI image tool is unavailable.' }, 404, cors(r));
    const features = await e.TOOLS_DB.prepare('SELECT id,tool_id,slug,name,description,access_level,credit_cost,limits_json,enabled FROM tool_features WHERE tool_id=?1 AND enabled=1 ORDER BY credit_cost,name').bind(AI_IMAGE_TOOL_ID).all();
    return json({ tool: { ...tool, features: features?.results || [] } }, 200, cors(r));
  } catch (error) {
    console.error('AI image catalog failed', String(error));
    return json({ error: 'Unable to load AI image tool.', code: 'ai_image_catalog_failed' }, 500, cors(r));
  }
}

async function aiImageGenerate(r, e) {
  const user = await aiImageUser(r, e);
  if (!user) return json({ error: 'Authentication required.', code: 'authentication_required' }, 401, cors(r));
  if (!e?.TOOLS_DB) return json({ error: 'AI tools database is unavailable.', code: 'tools_db_unavailable' }, 503, cors(r));

  let form;
  try { form = await r.formData(); } catch (error) { return json({ error: 'Invalid image request.', code: 'invalid_form_data', details: String(error).slice(0, 400) }, 400, cors(r)); }

  const prompt = clean(form.get('prompt')).slice(0, AI_IMAGE_MAX_PROMPT);
  const featureSlug = clean(form.get('feature') || 'basic-generation');
  const requestId = clean(form.get('request_id') || uuid()).slice(0, 120);
  const size = clean(form.get('size') || '512x512');
  const seedRaw = clean(form.get('seed'));
  const seed = seedRaw ? Number(seedRaw) : null;
  const file = form.get('image');

  if (!prompt) return json({ error: 'A prompt is required.', code: 'prompt_required' }, 400, cors(r));
  if (prompt.length > AI_IMAGE_MAX_PROMPT) return json({ error: 'Prompt is too long.', code: 'prompt_too_long' }, 400, cors(r));
  if (!AI_IMAGE_ALLOWED_SIZES.has(size)) return json({ error: 'Unsupported image size.', code: 'invalid_size' }, 400, cors(r));
  if (seed != null && (!Number.isSafeInteger(seed) || seed < 1 || seed > 9999999999)) return json({ error: 'Invalid seed.', code: 'invalid_seed' }, 400, cors(r));

  const existing = await aiImageJobByRequest(e, requestId);
  if (existing?.status === 'completed' && existing.output_json) {
    try { return json({ success: true, idempotent: true, result: JSON.parse(existing.output_json) }, 200, cors(r)); } catch {}
  }
  if (existing?.status === 'processing') return json({ error: 'This request is already being processed.', code: 'request_in_progress' }, 409, cors(r));

  const feature = await e.TOOLS_DB.prepare("SELECT id,slug,name,description,access_level,credit_cost,limits_json,enabled FROM tool_features WHERE tool_id=?1 AND slug=?2 LIMIT 1")
    .bind(AI_IMAGE_TOOL_ID, featureSlug).first();
  if (!feature || Number(feature.enabled) !== 1) return json({ error: 'AI image feature not found.', code: 'feature_not_found' }, 404, cors(r));

  const plan = await aiImagePlan(e, user.id);
  const requiredLevel = AI_IMAGE_PLAN_LEVELS[aiImageNormalizePlan(feature.access_level)] ?? 0;
  const included = plan.level >= requiredLevel;
  const cost = included ? 0 : Math.max(0, Math.floor(Number(feature.credit_cost) || 0));
  const limits = aiImageParseLimits(feature.limits_json);
  const monthlyLimit = Number(limits?.monthly_limit?.[plan.id] ?? 0);
  if (monthlyLimit > 0) {
    const used = await aiImageMonthlyUsage(e, user.id, feature.id);
    if (used >= monthlyLimit) return json({ error: `Monthly limit reached for ${feature.name}.`, code: 'monthly_limit_reached' }, 429, cors(r));
  }

  if (feature.slug === 'image-to-image') {
    return json({ error: 'Image-to-image is prepared in the catalog but requires an image-capable model before activation.', code: 'feature_not_supported_yet' }, 422, cors(r));
  }
  if (file instanceof File && file.size > AI_IMAGE_MAX_UPLOAD) return json({ error: 'Reference image must be 10 MB or smaller.', code: 'image_size' }, 413, cors(r));

  let job;
  try {
    job = await aiImageCreateJob(e, { userId: user.id, featureId: feature.id, requestId, input: { prompt, feature: feature.slug, size, seed: seed || null } });
  } catch (error) {
    const detail = String(error).replace(/\s+/g, ' ').slice(0, 500);
    console.error('AI image job creation failed', detail);
    return json({ error: 'Unable to create the AI job.', code: 'job_create_failed', details: detail }, 500, cors(r));
  }

  let charged = false;
  try {
    if (cost > 0) {
      if (typeof billingDebitCredits !== 'function') throw new Error('Billing debit function unavailable.');
      const debit = await billingDebitCredits(e, { userId: user.id, amount: cost, toolId: AI_IMAGE_TOOL_ID, reference: `ai:${AI_IMAGE_TOOL_ID}:${requestId}` });
      if (debit?.insufficient) {
        await aiImageFinishJob(e, job.id, 'failed', null, 'Insufficient credits.');
        return json({ error: 'Insufficient credits.', code: 'insufficient_credits' }, 402, cors(r));
      }
      charged = !debit?.idempotent;
    }

    const steps = feature.slug === 'basic-generation' || feature.slug === 'fast-generation' ? 4 : 8;
    const dataUri = await aiImageRunModel(e, { prompt, steps });
    const result = {
      tool: AI_IMAGE_TOOL_ID,
      feature: feature.slug,
      filename: `nexauren-${Date.now()}.jpg`,
      image: dataUri,
      prompt,
      size,
      plan: plan.id,
      credits_used: charged ? cost : 0,
    };
    await aiImageFinishJob(e, job.id, 'completed', result);
    await aiImageLogUsage(e, { userId: user.id, featureId: feature.id, jobId: job.id, requestId, creditsUsed: charged ? cost : 0, status: 'completed', metadata: { plan: plan.id, included, prompt_length: prompt.length, size, feature: feature.slug } });
    const account = await billingEnsureAccount(e, user.id);
    return json({ success: true, result, balance: Number(account?.balance || 0) }, 200, cors(r));
  } catch (error) {
    const detail = String(error instanceof Error ? error.message : error).replace(/\s+/g, ' ').slice(0, 600);
    console.error('AI image generation failed', detail);
    if (charged) { try { await aiImageRefund(e, user.id, cost, requestId); } catch (refundError) { console.error('AI image refund failed', String(refundError).slice(0, 500)); } }
    try {
      await aiImageFinishJob(e, job.id, 'failed', null, detail);
      await aiImageLogUsage(e, { userId: user.id, featureId: feature.id, jobId: job.id, requestId, creditsUsed: charged ? cost : 0, status: charged ? 'refunded' : 'failed', metadata: { plan: plan.id, included, refunded: charged, error: detail } });
    } catch (logError) { console.error('AI image failure logging failed', String(logError).slice(0, 500)); }
    return json({ error: 'The image generation failed.', code: 'ai_image_execution_failed', details: detail }, 502, cors(r));
  }
}

async function __handleAiImageToolsRoute(r, e) {
  const url = new URL(r.url);
  if (url.pathname === '/api/ai/image-generator' && r.method === 'GET') return aiImageCatalog(r, e);
  if (url.pathname === '/api/ai/image-generator' && r.method === 'POST') return aiImageGenerate(r, e);
  return null;
}
