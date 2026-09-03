/* NEXA AI AGENT v1
 * Safe orchestration layer: the model remains the conversational brain,
 * while explicit intents can invoke existing Nexauren tools.
 * No arbitrary URL/code execution is exposed to the user.
 */

function nexaAgentPlanFeature(plan) {
  if (plan === 'premium') return 'premium-generation';
  if (plan === 'pro') return 'quality-generation';
  if (plan === 'starter') return 'fast-generation';
  return 'basic-generation';
}

function nexaAgentWantsImage(text) {
  const s = String(text || '').toLowerCase();
  const action = /(cria|crie|ger(a|e)|gera|gerar|faz|faca|faça|desenha|desenhe|create|generate|draw|make|design)/.test(s);
  const subject = /(imagem|image|picture|photo|foto|ilustra|illustration|arte|artwork|poster|logo)/.test(s);
  return action && subject;
}

function nexaAgentImagePrompt(text) {
  return String(text || '')
    .replace(/^\s*(nexa[,:]?\s*)/i, '')
    .replace(/\b(por favor|please)\b/gi, '')
    .trim()
    .slice(0, 2048);
}

async function nexaAgentGenerateImage(r, e, userId, plan, text) {
  if (typeof aiImageGenerate !== 'function') throw new Error('AI image runtime is unavailable.');
  const form = new FormData();
  form.set('prompt', nexaAgentImagePrompt(text));
  form.set('feature', nexaAgentPlanFeature(plan));
  form.set('size', '512x512');
  form.set('request_id', `nexa-agent:${userId}:${uuid()}`);
  const origin = new URL(r.url).origin;
  const headers = new Headers();
  const cookie = r.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  const request = new Request(`${origin}/api/ai/image-generator`, { method: 'POST', headers, body: form });
  const response = await aiImageGenerate(request, e);
  const payload = await response.clone().json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || 'Image generation failed.');
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function nexaAgentChat(r, e) {
  const cloned = r.clone();
  let data;
  try { data = await cloned.json(); } catch { return nexaChat(r, e); }
  const user = await currentUser(r, e);
  if (!user) return nexaChat(r, e);
  const account = await nexaAccount(e, user.id);
  const message = clean(data?.message).slice(0, NEXA_MAX_MESSAGE);
  if (!message || !nexaAgentWantsImage(message) || data?.agent === false) return nexaChat(r, e);

  /* First create the normal conversational turn. This preserves history,
     message limits and the Nexa explanation; the actual tool action follows. */
  const chatResponse = await nexaChat(r.clone(), e);
  if (!chatResponse.ok) return chatResponse;
  const chatPayload = await chatResponse.clone().json().catch(() => ({}));
  try {
    const imagePayload = await nexaAgentGenerateImage(r, e, user.id, account.plan, message);
    const image = imagePayload?.result || null;
    if (image && chatPayload?.conversation_id && e?.TOOLS_DB) {
      const now = Math.floor(Date.now() / 1000);
      const content = `Generated image: ${image.filename || 'nexauren-image.jpg'}`;
      await e.TOOLS_DB.prepare(`INSERT INTO nexa_messages(id,conversation_id,user_id,role,content,created_at) VALUES(?1,?2,?3,'assistant',?4,?5)`)
        .bind(uuid(), chatPayload.conversation_id, user.id, content, now).run();
      await nexaLog(e, user.id, chatPayload.conversation_id, 'agent_action', { action: 'image_generation', feature: image.feature, tool: 'ai_image_generator' });
    }
    return json({ ...chatPayload, agent_action: { type: 'image_generation', success: true, result: image } }, 200, cors(r));
  } catch (error) {
    console.error('Nexa agent image action failed', nexaDetail(error));
    return json({ ...chatPayload, agent_action: { type: 'image_generation', success: false, error: error?.payload?.error || error?.message || 'Image generation failed.' } }, 200, cors(r));
  }
}

async function __handleNexaAgentRoute(r, e) {
  const p = new URL(r.url).pathname;
  if (p === '/api/nexa-ai/chat' && r.method === 'POST') return nexaAgentChat(r, e);
  return null;
}
