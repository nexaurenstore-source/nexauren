/* NEXAUREN AI TOOLS v1
 * Generic AI tool runtime backed by TOOLS_DB.
 * Credit balance remains authoritative in the main DB (DB).
 */

const AI_TOOL_ID = 'ai_pdf_summarizer';
const AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const PLAN_LEVELS = Object.freeze({ free: 0, starter: 1, pro: 2, premium: 3 });

const aiToolsError = (message, code, status = 500, request) =>
  json({ error: message, code }, status, cors(request));

async function aiToolUser(r, e) {
  return currentUser(r, e);
}

async function aiToolRegistry(e) {
  if (!e?.TOOLS_DB) throw new Error('TOOLS_DB binding is unavailable.');
  const rows = await e.TOOLS_DB.prepare(
    "SELECT id,slug,name,category,description,status,config_json FROM tools WHERE status='active' ORDER BY name",
  ).all();
  return rows?.results || [];
}

async function aiToolFeatures(e, toolId) {
  const rows = await e.TOOLS_DB.prepare(
    'SELECT id,tool_id,slug,name,description,access_level,credit_cost,limits_json,enabled FROM tool_features WHERE tool_id=?1 AND enabled=1 ORDER BY name',
  ).bind(toolId).all();
  return rows?.results || [];
}

async function aiToolPlan(e, userId) {
  if (typeof billingEnsureAccount !== 'function') {
    throw new Error('Billing core is unavailable.');
  }
  const account = await billingEnsureAccount(e, userId);
  const plan = clean(account?.plan_id).toLowerCase() || 'free';
  return {
    id: plan,
    level: PLAN_LEVELS[plan] ?? 0,
    account,
  };
}

function aiToolParseLimits(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function aiToolMonthlyUsage(e, userId, featureId) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const row = await e.TOOLS_DB.prepare(
    "SELECT COUNT(*) AS total FROM tool_usage WHERE user_id=?1 AND tool_id=?2 AND feature_id=?3 AND status='completed' AND created_at>=?4",
  ).bind(userId, AI_TOOL_ID, featureId, Math.floor(start.getTime() / 1000)).first();
  return Number(row?.total || 0);
}

async function aiToolJobByRequest(e, requestId) {
  return e.TOOLS_DB.prepare(
    'SELECT id,status,output_json,error_message,credits_used FROM tool_jobs WHERE request_id=?1 LIMIT 1',
  ).bind(requestId).first();
}

async function aiToolCreateJob(e, { userId, featureId, requestId, input }) {
  const id = uuid();
  const now = Math.floor(Date.now() / 1000);
  await e.TOOLS_DB.prepare(
    "INSERT INTO tool_jobs(id,user_id,tool_id,feature_id,request_id,status,provider,input_json,created_at) VALUES(?1,?2,?3,?4,?5,'processing','cloudflare-workers-ai',?6,?7)",
  ).bind(id, userId, AI_TOOL_ID, featureId, requestId, JSON.stringify(input || {}), now).run();
  return { id, createdAt: now };
}

async function aiToolFinishJob(e, jobId, status, output, errorMessage = null) {
  const now = Math.floor(Date.now() / 1000);
  await e.TOOLS_DB.prepare(
    'UPDATE tool_jobs SET status=?1,output_json=?2,error_message=?3,started_at=COALESCE(started_at,?4),completed_at=?4 WHERE id=?5',
  ).bind(status, output == null ? null : JSON.stringify(output), errorMessage, now, jobId).run();
}

async function aiToolLogUsage(e, { userId, featureId, jobId, requestId, creditsUsed, status, metadata }) {
  const now = Math.floor(Date.now() / 1000);
  await e.TOOLS_DB.prepare(
    'INSERT OR REPLACE INTO tool_usage(id,user_id,tool_id,feature_id,job_id,request_id,credits_used,status,metadata_json,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)',
  ).bind(
    uuid(), userId, AI_TOOL_ID, featureId, jobId, requestId,
    Math.max(0, Math.floor(Number(creditsUsed) || 0)), status,
    JSON.stringify(metadata || {}), now,
  ).run();
}

async function aiToolRefund(e, userId, credits, requestId) {
  if (!credits || typeof billingAddCredits !== 'function') return;
  await billingAddCredits(e, {
    userId,
    amount: credits,
    type: 'refund',
    description: `AI tool refund: ${AI_TOOL_ID}`,
    reference: `ai-refund:${requestId}`,
    toolId: AI_TOOL_ID,
  });
}

function aiToolExtractText(result) {
  const item = Array.isArray(result) ? result[0] : result;
  if (!item || item.format === 'error') {
    throw new Error(item?.error || 'Unable to read the PDF.');
  }
  const text = clean(item.data);
  if (!text) throw new Error('No readable text was found in this PDF.');
  return text;
}

function aiToolPrompt(feature, documentText, question) {
  const common = `You are Nexauren AI PDF Summarizer. Analyze only the supplied document. Do not invent facts. Keep the answer clear and structured.\n\nDOCUMENT:\n${documentText}`;
  switch (feature.slug) {
    case 'basic-summary':
      return `${common}\n\nTASK: Produce a concise summary with a short overview, 5-8 key points, and the main conclusion.`;
    case 'advanced-summary':
      return `${common}\n\nTASK: Produce a detailed structured summary. Include overview, section-by-section points, important facts, themes, conclusions, and practical implications.`;
    case 'key-points':
      return `${common}\n\nTASK: Extract the most important points. Return a numbered list and a short explanation for each point.`;
    case 'keywords':
      return `${common}\n\nTASK: Extract the most important keywords and topics. Group related terms and briefly explain the main topics.`;
    case 'pdf-chat':
      return `${common}\n\nTASK: Answer this question using only the document. If the document does not contain enough information, say so.\nQUESTION: ${question}`;
    case 'flashcards':
      return `${common}\n\nTASK: Create useful study flashcards. Format each as Q: question / A: answer. Cover the most important concepts.`;
    case 'quiz':
      return `${common}\n\nTASK: Create a quiz with multiple-choice questions. Give 4 options for each question and identify the correct answer with a brief explanation.`;
    case 'notes':
      return `${common}\n\nTASK: Create organized study notes with headings, definitions, important details, and a final recap.`;
    case 'complete-analysis':
      return `${common}\n\nTASK: Perform a comprehensive analysis. Include executive summary, key points, themes, important evidence, conclusions, keywords, questions a reader may ask, and practical takeaways.`;
    default:
      throw new Error('Unsupported AI feature.');
  }
}

async function aiToolRunModel(e, prompt) {
  if (!e?.AI || typeof e.AI.run !== 'function') {
    throw new Error('Workers AI binding is not configured.');
  }
  const response = await e.AI.run(AI_MODEL, {
    messages: [
      { role: 'system', content: 'You are a precise document analysis assistant.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 5000,
    chat_template_kwargs: { enable_thinking: false },
  });
  const text = clean(response?.response || response?.choices?.[0]?.message?.content);
  if (!text) throw new Error('The AI model returned an empty response.');
  return text;
}

async function aiToolsCatalog(r, e) {
  try {
    const tools = await aiToolRegistry(e);
    const result = [];
    for (const tool of tools) {
      const features = await aiToolFeatures(e, String(tool.id));
      result.push({ ...tool, features });
    }
    return json({ tools: result }, 200, cors(r));
  } catch (error) {
    console.error('AI tools catalog failed', String(error).slice(0, 500));
    return aiToolsError('Unable to load AI tools.', 'ai_tools_catalog', 500, r);
  }
}

async function aiPdfSummarizer(r, e) {
  const user = await aiToolUser(r, e);
  if (!user) return aiToolsError('Authentication required.', 'authentication_required', 401, r);

  if (!e?.TOOLS_DB) return aiToolsError('AI tools database is unavailable.', 'tools_db_unavailable', 503, r);

  const form = await r.formData();
  const file = form.get('file');
  const featureSlug = clean(form.get('feature') || 'basic-summary');
  const requestId = clean(form.get('request_id') || uuid()).slice(0, 120);
  const question = clean(form.get('question')).slice(0, 4000);

  if (!(file instanceof File)) return aiToolsError('Please upload a PDF file.', 'pdf_required', 400, r);
  if (file.type !== 'application/pdf' && !String(file.name || '').toLowerCase().endsWith('.pdf')) {
    return aiToolsError('Only PDF files are supported.', 'pdf_only', 400, r);
  }
  if (file.size <= 0 || file.size > 25 * 1024 * 1024) {
    return aiToolsError('PDF must be between 1 byte and 25 MB.', 'pdf_size', 413, r);
  }

  const existing = await aiToolJobByRequest(e, requestId);
  if (existing?.status === 'completed' && existing.output_json) {
    try { return json({ success: true, idempotent: true, result: JSON.parse(existing.output_json) }, 200, cors(r)); }
    catch {}
  }
  if (existing?.status === 'processing') return aiToolsError('This request is already being processed.', 'request_in_progress', 409, r);

  const feature = await e.TOOLS_DB.prepare(
    "SELECT id,slug,name,description,access_level,credit_cost,limits_json,enabled FROM tool_features WHERE tool_id=?1 AND slug=?2 LIMIT 1",
  ).bind(AI_TOOL_ID, featureSlug).first();
  if (!feature || Number(feature.enabled) !== 1) return aiToolsError('AI feature not found.', 'feature_not_found', 404, r);

  const plan = await aiToolPlan(e, user.id);
  const requiredLevel = PLAN_LEVELS[clean(feature.access_level).toLowerCase()] ?? 0;
  const included = plan.level >= requiredLevel;
  const cost = included ? 0 : Math.max(0, Math.floor(Number(feature.credit_cost) || 0));
  const limits = aiToolParseLimits(feature.limits_json);
  const monthlyLimit = Number(limits?.monthly_limit?.[plan.id] ?? 0);

  if (monthlyLimit > 0) {
    const used = await aiToolMonthlyUsage(e, user.id, feature.id);
    if (used >= monthlyLimit) {
      return aiToolsError(`Monthly limit reached for ${feature.name}.`, 'monthly_limit_reached', 429, r);
    }
  }

  let markdown;
  try {
    const converted = await e.AI.toMarkdown(
      { name: String(file.name || 'document.pdf').slice(0, 200), blob: file },
      { conversionOptions: { output: { format: 'text' }, pdf: { metadata: false } } },
    );
    markdown = aiToolExtractText(converted);
  } catch (error) {
    console.error('PDF conversion failed', String(error).slice(0, 500));
    return aiToolsError('Unable to read this PDF.', 'pdf_conversion_failed', 422, r);
  }

  const maxChars = requiredLevel >= 3 ? 900000 : requiredLevel >= 2 ? 700000 : 450000;
  if (markdown.length > maxChars) {
    return aiToolsError('This PDF is too large for the selected feature. Try a smaller document or a higher plan.', 'document_too_large', 413, r);
  }

  if (feature.slug === 'pdf-chat' && !question) return aiToolsError('A question is required for PDF Chat.', 'question_required', 400, r);

  let job;
  try {
    job = await aiToolCreateJob(e, {
      userId: user.id,
      featureId: feature.id,
      requestId,
      input: { filename: String(file.name || 'document.pdf').slice(0, 200), size: file.size, feature: feature.slug },
    });
  } catch (error) {
    console.error('AI job creation failed', String(error).slice(0, 500));
    return aiToolsError('Unable to create the AI job.', 'job_create_failed', 500, r);
  }

  let charged = false;
  try {
    if (cost > 0) {
      if (typeof billingDebitCredits !== 'function') throw new Error('Billing debit function unavailable.');
      const debit = await billingDebitCredits(e, {
        userId: user.id,
        amount: cost,
        toolId: AI_TOOL_ID,
        reference: `ai:${AI_TOOL_ID}:${requestId}`,
      });
      if (debit?.insufficient) {
        await aiToolFinishJob(e, job.id, 'failed', null, 'Insufficient credits.');
        return aiToolsError('Insufficient credits.', 'insufficient_credits', 402, r);
      }
      charged = !debit?.idempotent;
    }

    const prompt = aiToolPrompt(feature, markdown, question);
    const output = await aiToolRunModel(e, prompt);
    const result = {
      tool: AI_TOOL_ID,
      feature: feature.slug,
      filename: String(file.name || 'document.pdf'),
      content: output,
      plan: plan.id,
      credits_used: charged ? cost : 0,
    };

    await aiToolFinishJob(e, job.id, 'completed', result);
    await aiToolLogUsage(e, {
      userId: user.id,
      featureId: feature.id,
      jobId: job.id,
      requestId,
      creditsUsed: charged ? cost : 0,
      status: 'completed',
      metadata: { plan: plan.id, included, filename: String(file.name || 'document.pdf'), size: file.size },
    });

    const account = await billingEnsureAccount(e, user.id);
    return json({ success: true, result, balance: Number(account?.balance || 0) }, 200, cors(r));
  } catch (error) {
    console.error('AI PDF tool failed', String(error).slice(0, 500));
    if (charged) {
      try { await aiToolRefund(e, user.id, cost, requestId); } catch (refundError) { console.error('AI credit refund failed', String(refundError).slice(0, 500)); }
    }
    try {
      await aiToolFinishJob(e, job.id, 'failed', null, String(error).slice(0, 500));
      await aiToolLogUsage(e, {
        userId: user.id,
        featureId: feature.id,
        jobId: job.id,
        requestId,
        creditsUsed: charged ? cost : 0,
        status: charged ? 'refunded' : 'failed',
        metadata: { plan: plan.id, included, refunded: charged },
      });
    } catch (logError) { console.error('AI failure logging failed', String(logError).slice(0, 500)); }
    return aiToolsError('The AI tool could not complete the request.', 'ai_execution_failed', 502, r);
  }
}

async function __handleAiToolsRoute(r, e) {
  const url = new URL(r.url);
  if (url.pathname === '/api/ai/tools' && r.method === 'GET') return aiToolsCatalog(r, e);
  if (url.pathname === '/api/ai/pdf-summarizer' && r.method === 'POST') return aiPdfSummarizer(r, e);
  return null;
}
