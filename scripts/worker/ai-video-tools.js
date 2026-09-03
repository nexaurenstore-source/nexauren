/* NEXAUREN AI VIDEO GENERATOR v1
 * Text-to-video and image-to-video through Cloudflare Workers AI.
 * Access is controlled by TOOLS_DB; credits remain authoritative in DB.
 */

const AI_VIDEO_TOOL_ID = 'ai_video_generator';
const AI_VIDEO_MODEL = 'pixverse/v6';
const AI_VIDEO_PLAN_LEVELS = Object.freeze({ free: 0, starter: 1, pro: 2, premium: 3 });
const AI_VIDEO_MAX_PROMPT = 2048;
const AI_VIDEO_MAX_NEGATIVE = 2048;
const AI_VIDEO_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function aiVideoError(message, code, status = 500, request, details = null) {
  return json({ error: message, code, ...(details ? { details } : {}) }, status, cors(request));
}

function aiVideoDetail(error) {
  const raw = error instanceof Error ? error.message : String(error || 'Unknown error');
  return raw.replace(/\s+/g, ' ').slice(0, 600);
}

function aiVideoPlan(value) {
  const raw = clean(value).toLowerCase();
  if (raw === 'premium' || raw.startsWith('premium_') || raw.startsWith('premium-')) return 'premium';
  if (raw === 'pro' || raw.startsWith('pro_') || raw.startsWith('pro-')) return 'pro';
  if (raw === 'starter' || raw.startsWith('starter_') || raw.startsWith('starter-')) return 'starter';
  return 'free';
}

function aiVideoLimits(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch { return {}; }
}

function aiVideoBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read reference image.'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

async function aiVideoJob(e, requestId) {
  return e.TOOLS_DB.prepare('SELECT id,status,output_json,error_message FROM tool_jobs WHERE request_id=?1 LIMIT 1').bind(requestId).first();
}

async function aiVideoCreateJob(e, { userId, featureId, requestId, input }) {
  const id = uuid();
  const now = Math.floor(Date.now() / 1000);
  await e.TOOLS_DB.prepare("INSERT INTO tool_jobs(id,user_id,tool_id,feature_id,request_id,status,provider,input_json,created_at,started_at) VALUES(?1,?2,?3,?4,?5,'processing','cloudflare-ai',?6,?7,?7)").bind(id, userId, AI_VIDEO_TOOL_ID, featureId, requestId, JSON.stringify(input || {}), now).run();
  return { id, createdAt: now };
}

async function aiVideoFinishJob(e, jobId, status, output, errorMessage = null) {
  const now = Math.floor(Date.now() / 1000);
  await e.TOOLS_DB.prepare('UPDATE tool_jobs SET status=?1,output_json=?2,error_message=?3,completed_at=?4 WHERE id=?5').bind(status, output == null ? null : JSON.stringify(output), errorMessage, now, jobId).run();
}

async function aiVideoLogUsage(e, { userId, featureId, jobId, requestId, creditsUsed, status, metadata }) {
  const now = Math.floor(Date.now() / 1000);
  await e.TOOLS_DB.prepare('INSERT OR REPLACE INTO tool_usage(id,user_id,tool_id,feature_id,job_id,request_id,credits_used,status,metadata_json,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)').bind(uuid(), userId, AI_VIDEO_TOOL_ID, featureId, jobId, requestId, Math.max(0, Math.floor(Number(creditsUsed) || 0)), status, JSON.stringify(metadata || {}), now).run();
}

async function aiVideoRefund(e, userId, credits, requestId) {
  if (!credits || typeof billingAddCredits !== 'function') return;
  await billingAddCredits(e, { userId, amount: credits, type: 'refund', description: `AI tool refund: ${AI_VIDEO_TOOL_ID}`, reference: `ai-refund:${requestId}`, toolId: AI_VIDEO_TOOL_ID });
}

async function aiVideoGenerate(r, e) {
  const user = await currentUser(r, e);
  if (!user) return aiVideoError('Authentication required.', 'authentication_required', 401, r);
  if (!e?.TOOLS_DB) return aiVideoError('AI tools database is unavailable.', 'tools_db_unavailable', 503, r);
  if (!e?.AI || typeof e.AI.run !== 'function') return aiVideoError('Workers AI binding is not configured.', 'ai_binding_unavailable', 503, r);

  let form;
  try { form = await r.formData(); } catch (error) { return aiVideoError('Invalid video generation request.', 'invalid_form_data', 400, r, aiVideoDetail(error)); }

  const prompt = clean(form.get('prompt')).slice(0, AI_VIDEO_MAX_PROMPT);
  const negativePrompt = clean(form.get('negative_prompt')).slice(0, AI_VIDEO_MAX_NEGATIVE);
  const featureSlug = clean(form.get('feature') || 'text-to-video');
  const requestId = clean(form.get('request_id') || uuid()).slice(0, 120);
  const referenceImage = form.get('image');
  const duration = Math.min(15, Math.max(1, Math.floor(Number(form.get('duration') || 5))));
  const aspectRatio = clean(form.get('aspect_ratio') || '16:9');
  const quality = clean(form.get('quality') || '720p');
  const generateAudio = String(form.get('generate_audio') ?? 'true') !== 'false';
  const seedRaw = clean(form.get('seed'));

  if (!prompt) return aiVideoError('Describe the video you want first.', 'prompt_required', 400, r);
  if (prompt.length > AI_VIDEO_MAX_PROMPT) return aiVideoError('Prompt is too long.', 'prompt_too_long', 400, r);
  if (!['text-to-video', 'image-to-video'].includes(featureSlug)) return aiVideoError('Unsupported video feature.', 'feature_invalid', 400, r);
  if (!['16:9', '4:3', '1:1', '3:4', '9:16', '2:3', '3:2', '21:9'].includes(aspectRatio)) return aiVideoError('Invalid aspect ratio.', 'aspect_ratio_invalid', 400, r);
  if (!['360p', '540p', '720p', '1080p'].includes(quality)) return aiVideoError('Invalid video quality.', 'quality_invalid', 400, r);
  if (!Number.isInteger(duration) || duration < 1 || duration > 15) return aiVideoError('Video duration must be between 1 and 15 seconds.', 'duration_invalid', 400, r);

  if (featureSlug === 'image-to-video') {
    if (!(referenceImage instanceof File)) return aiVideoError('Please upload a reference image.', 'image_required', 400, r);
    if (!String(referenceImage.type || '').startsWith('image/')) return aiVideoError('Only image files are supported.', 'image_only', 400, r);
    if (referenceImage.size <= 0 || referenceImage.size > AI_VIDEO_MAX_IMAGE_BYTES) return aiVideoError('Reference image must be between 1 byte and 8 MB.', 'image_size', 413, r);
  }

  const existing = await aiVideoJob(e, requestId);
  if (existing?.status === 'completed' && existing.output_json) {
    try { return json({ success: true, idempotent: true, result: JSON.parse(existing.output_json) }, 200, cors(r)); } catch {}
  }
  if (existing?.status === 'processing') return aiVideoError('This request is already being processed.', 'request_in_progress', 409, r);

  const feature = await e.TOOLS_DB.prepare("SELECT id,slug,name,description,access_level,credit_cost,limits_json,enabled FROM tool_features WHERE tool_id=?1 AND slug=?2 LIMIT 1").bind(AI_VIDEO_TOOL_ID, featureSlug).first();
  if (!feature || Number(feature.enabled) !== 1) return aiVideoError('AI video feature not found.', 'feature_not_found', 404, r);

  const planAccount = typeof billingEnsureAccount === 'function' ? await billingEnsureAccount(e, user.id) : null;
  const planId = aiVideoPlan(planAccount?.plan_id || planAccount?.plan_name);
  const requiredLevel = AI_VIDEO_PLAN_LEVELS[clean(feature.access_level).toLowerCase()] ?? 0;
  if ((AI_VIDEO_PLAN_LEVELS[planId] ?? 0) < requiredLevel) return aiVideoError('Your current plan does not include this feature.', 'plan_required', 403, r, { required: clean(feature.access_level).toLowerCase(), plan: planId });

  const limits = aiVideoLimits(feature.limits_json);
  const maxDuration = Math.min(15, Math.max(1, Number(limits.max_duration || 15)));
  if (duration > maxDuration) return aiVideoError(`Maximum duration for this feature is ${maxDuration} seconds.`, 'duration_limit', 400, r);

  const cost = Math.max(0, Math.floor(Number(feature.credit_cost) || 0));
  let imageInput = null;
  if (featureSlug === 'image-to-video') {
    try { imageInput = await aiVideoBase64(referenceImage); }
    catch (error) { return aiVideoError('Unable to read the reference image.', 'image_read_failed', 422, r, aiVideoDetail(error)); }
  }

  let job;
  try {
    job = await aiVideoCreateJob(e, {
      userId: user.id,
      featureId: feature.id,
      requestId,
      input: { feature: featureSlug, prompt, duration, aspect_ratio: aspectRatio, quality, generate_audio: generateAudio, has_reference_image: !!imageInput },
    });
  } catch (error) {
    return aiVideoError('Unable to create the AI video job.', 'job_create_failed', 500, r, aiVideoDetail(error));
  }

  let charged = false;
  try {
    if (cost > 0) {
      if (typeof billingDebitCredits !== 'function') throw new Error('Billing debit function unavailable.');
      const debit = await billingDebitCredits(e, { userId: user.id, amount: cost, toolId: AI_VIDEO_TOOL_ID, reference: `ai:${AI_VIDEO_TOOL_ID}:${requestId}` });
      if (debit?.insufficient) {
        await aiVideoFinishJob(e, job.id, 'failed', null, 'Insufficient credits.');
        return aiVideoError('Insufficient credits.', 'insufficient_credits', 402, r, { required: cost, balance: Number((await billingEnsureAccount(e, user.id))?.balance || 0) });
      }
      charged = !debit?.idempotent;
    }

    const input = { prompt, duration, aspect_ratio: aspectRatio, quality, generate_audio: generateAudio };
    if (negativePrompt) input.negative_prompt = negativePrompt;
    if (imageInput) input.image_input = imageInput;
    if (seedRaw) {
      const seed = Number(seedRaw);
      if (Number.isInteger(seed) && seed >= 0 && seed <= 2147483647) input.seed = seed;
    }

    const response = await e.AI.run(AI_VIDEO_MODEL, input);
    const videoUrl = clean(response?.video || response?.result?.video);
    const state = clean(response?.state || response?.result?.state || 'Completed');
    if (!videoUrl || !/^https:\/\//i.test(videoUrl)) throw new Error('AI_VIDEO_EMPTY_RESULT');

    const result = {
      tool: AI_VIDEO_TOOL_ID,
      feature: featureSlug,
      model: AI_VIDEO_MODEL,
      state,
      video: videoUrl,
      download: true,
      filename: `nexauren-ai-video-${requestId.slice(0, 8)}.mp4`,
      prompt,
      duration,
      aspect_ratio: aspectRatio,
      quality,
      generate_audio: generateAudio,
      plan: planId,
      credits_used: charged ? cost : 0,
    };

    await aiVideoFinishJob(e, job.id, 'completed', result);
    await aiVideoLogUsage(e, { userId: user.id, featureId: feature.id, jobId: job.id, requestId, creditsUsed: charged ? cost : 0, status: 'completed', metadata: { plan: planId, feature: featureSlug, duration, quality, aspect_ratio: aspectRatio } });
    const account = typeof billingEnsureAccount === 'function' ? await billingEnsureAccount(e, user.id) : null;
    return json({ success: true, result, balance: Number(account?.balance || 0) }, 200, cors(r));
  } catch (error) {
    const detail = aiVideoDetail(error);
    console.error('AI video generation failed', detail);
    if (charged) {
      try { await aiVideoRefund(e, user.id, cost, requestId); }
      catch (refundError) { console.error('AI video credit refund failed', aiVideoDetail(refundError)); }
    }
    try {
      await aiVideoFinishJob(e, job.id, 'failed', null, detail);
      await aiVideoLogUsage(e, { userId: user.id, featureId: feature.id, jobId: job.id, requestId, creditsUsed: charged ? cost : 0, status: charged ? 'refunded' : 'failed', metadata: { plan: planId, feature: featureSlug, refunded: charged, error: detail } });
    } catch (logError) { console.error('AI video failure logging failed', aiVideoDetail(logError)); }
    return aiVideoError('The AI video generation failed.', 'ai_video_execution_failed', 502, r, detail);
  }
}

async function aiVideoCatalog(r, e) {
  try {
    const tool = await e.TOOLS_DB.prepare("SELECT id,slug,name,category,description,status,config_json FROM tools WHERE id=?1 AND status='active' LIMIT 1").bind(AI_VIDEO_TOOL_ID).first();
    if (!tool) return aiVideoError('AI video tool is not registered.', 'tool_not_registered', 404, r);
    const features = await e.TOOLS_DB.prepare('SELECT id,tool_id,slug,name,description,access_level,credit_cost,limits_json,enabled FROM tool_features WHERE tool_id=?1 AND enabled=1 ORDER BY name').bind(AI_VIDEO_TOOL_ID).all();
    return json({ tool: { ...tool, features: features?.results || [] } }, 200, cors(r));
  } catch (error) {
    return aiVideoError('Unable to load AI video features.', 'ai_video_catalog', 500, r, aiVideoDetail(error));
  }
}

async function __handleAiVideoToolsRoute(r, e) {
  const url = new URL(r.url);
  if (url.pathname === '/api/ai/video-generator' && r.method === 'GET') return aiVideoCatalog(r, e);
  if (url.pathname === '/api/ai/video-generator' && r.method === 'POST') return aiVideoGenerate(r, e);
  return null;
}
