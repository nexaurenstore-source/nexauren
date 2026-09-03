/* NEXA AI AGENT v2
 * Nexa is an action/orchestration assistant for EXISTING Nexauren tools.
 * It never creates tools, code, URLs or arbitrary capabilities.
 * Tool definitions remain owned by Nexauren; Nexa only selects and invokes them.
 */

function nexaAgentPlanFeature(plan) {
  if (plan === 'premium') return 'premium-generation';
  if (plan === 'pro') return 'quality-generation';
  if (plan === 'starter') return 'fast-generation';
  return 'basic-generation';
}

function nexaAgentWantsImageGeneration(text) {
  const s = String(text || '').toLowerCase();
  return /(cria|crie|gera|gerar|faz|faça|faca|desenha|desenhe|create|generate|draw|make|design)/.test(s) &&
    /(imagem|image|picture|photo|foto|ilustra|illustration|arte|artwork|poster|logo)/.test(s) &&
    !/(comprime|compress|reduz.*tamanho|resize|redimension|crop|corta|converter|converte)/.test(s);
}

function nexaAgentWantsToolAction(text) {
  const s = String(text || '').toLowerCase();
  return /(usa|use|utiliza|utilize|faz|faça|faca|quero|preciso|podes|pode|can you|please|make|do|convert|compress|resize|redimension|crop|corta|merge|junta|split|divide|trim|corta|edit|editar|clean|limpa|count|conta|compare|compara|format|formata|enhance|melhora|record|grava|transform|transforma)/.test(s);
}

function nexaAgentImagePrompt(text) {
  return String(text || '')
    .replace(/^\s*(nexa[,:]?\s*)/i, '')
    .replace(/\b(por favor|please)\b/gi, '')
    .trim().slice(0, 2048);
}

async function nexaAgentGenerateImage(r, e, userId, plan, text) {
  if (typeof aiImageGenerate !== 'function') throw new Error('AI image runtime is unavailable.');
  const form = new FormData();
  form.set('prompt', nexaAgentImagePrompt(text));
  form.set('feature', nexaAgentPlanFeature(plan));
  form.set('size', '512x512');
  form.set('request_id', `nexa-agent:${userId}:${uuid()}`);
  const origin = new URL(r.url).origin;
  const headers = new Headers(); const cookie = r.headers.get('cookie'); if (cookie) headers.set('cookie', cookie);
  const request = new Request(`${origin}/api/ai/image-generator`, { method: 'POST', headers, body: form });
  const response = await aiImageGenerate(request, e);
  const payload = await response.clone().json().catch(() => ({}));
  if (!response.ok) { const error = new Error(payload?.error || 'Image generation failed.'); error.status=response.status; error.payload=payload; throw error; }
  return payload;
}

function nexaAgentTokens(text) {
  return [...new Set(String(text || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(x => x.length > 2))];
}

async function nexaAgentCatalog(e, r) {
  const result = [];
  if (e?.TOOLS_DB) {
    try {
      const rows = await e.TOOLS_DB.prepare("SELECT id,slug,name,category,description,status FROM tools WHERE status='active'").all();
      for (const x of (rows?.results || [])) result.push(x);
    } catch {}
  }
  try {
    if (e?.ASSETS?.fetch) {
      const origin = new URL(r.url).origin;
      const response = await e.ASSETS.fetch(new Request(`${origin}/data/tools.json`));
      const data = await response.json().catch(() => ({}));
      for (const x of (Array.isArray(data?.tools) ? data.tools : [])) {
        if (String(x.status || 'active') !== 'active') continue;
        if (!result.some(y => y.id === x.id || y.slug === x.slug)) result.push(x);
      }
    }
  } catch {}
  return result;
}

function nexaAgentScoreTool(tool, tokens) {
  const hay = `${tool.id || ''} ${tool.slug || ''} ${tool.name || ''} ${tool.description || ''} ${(tool.tags || []).join(' ')}`.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    if (hay.includes(token)) score += 2;
    if (String(tool.name || '').toLowerCase().includes(token)) score += 3;
  }
  const pairs = [
    [['reduz','tamanho'],['compressor']], [['diminui','tamanho'],['compressor']],
    [['redimension'],['resizer']], [['converter'],['converter']], [['converte'],['converter']],
    [['junta'],['merger']], [['divide'],['splitter']], [['corta'],['cutter','trimmer']],
    [['limpa'],['cleaner']], [['conta'],['counter']], [['compara'],['diff']],
    [['formata'],['formatter']], [['melhora'],['enhancer']],
  ];
  for (const [words, hints] of pairs) if (words.every(w => tokens.includes(w)) && hints.some(h => hay.includes(h))) score += 8;
  return score;
}

async function nexaAgentPickTool(e, r, message) {
  const tokens = nexaAgentTokens(message);
  const catalog = await nexaAgentCatalog(e, r);
  const ranked = catalog.map(tool => ({ tool, score: nexaAgentScoreTool(tool, tokens) })).sort((a,b)=>b.score-a.score);
  if (!ranked[0] || ranked[0].score < 4) return null;
  if (ranked[1] && ranked[1].score === ranked[0].score) return null;
  return ranked[0].tool;
}

async function nexaAgentChat(r, e) {
  const cloned = r.clone();
  let data; try { data = await cloned.json(); } catch { return nexaChat(r, e); }
  const user = await currentUser(r, e);
  if (!user) return nexaChat(r, e);
  const account = await nexaAccount(e, user.id);
  const message = clean(data?.message).slice(0, NEXA_MAX_MESSAGE);
  if (!message || data?.agent === false) return nexaChat(r, e);

  const chatResponse = await nexaChat(r.clone(), e);
  if (!chatResponse.ok) return chatResponse;
  const chatPayload = await chatResponse.clone().json().catch(() => ({}));

  if (nexaAgentWantsImageGeneration(message)) {
    try {
      const imagePayload = await nexaAgentGenerateImage(r, e, user.id, account.plan, message);
      const image = imagePayload?.result || null;
      if (image && chatPayload?.conversation_id && e?.TOOLS_DB) {
        const now=Math.floor(Date.now()/1000);
        await e.TOOLS_DB.prepare(`INSERT INTO nexa_messages(id,conversation_id,user_id,role,content,created_at) VALUES(?1,?2,?3,'assistant',?4,?5)`).bind(uuid(),chatPayload.conversation_id,user.id,`Generated image: ${image.filename || 'nexauren-image.jpg'}`,now).run();
        await nexaLog(e,user.id,chatPayload.conversation_id,'agent_action',{action:'image_generation',feature:image.feature,tool:'ai_image_generator'});
      }
      return json({...chatPayload,agent_action:{type:'image_generation',success:true,result:image}},200,cors(r));
    } catch(error) {
      console.error('Nexa agent image action failed',nexaDetail(error));
      return json({...chatPayload,agent_action:{type:'image_generation',success:false,error:error?.payload?.error||error?.message||'Image generation failed.'}},200,cors(r));
    }
  }

  if (!nexaAgentWantsToolAction(message)) return chatResponse;
  const tool = await nexaAgentPickTool(e, r, message);
  if (!tool) return chatResponse;

  const action = {
    type: 'tool_execution',
    success: true,
    tool: { id: tool.id, slug: tool.slug, name: tool.name, url: tool.url || `/tools/${tool.slug}/`, category: tool.category || tool.studio || '' },
    mode: 'existing_nexauren_tool',
    requires_upload: /image|photo|picture|pdf|audio|video|file|arquivo|documento/.test(message.toLowerCase()),
    message: message.slice(0, 12000),
  };
  if (chatPayload?.conversation_id) {
    try { await nexaLog(e,user.id,chatPayload.conversation_id,'agent_action',{action:'tool_execution',tool:tool.id,slug:tool.slug}); } catch {}
  }
  return json({...chatPayload,agent_action:action},200,cors(r));
}

async function __handleNexaAgentRoute(r,e) {
  const p=new URL(r.url).pathname;
  if(p==='/api/nexa-ai/chat'&&r.method==='POST') return nexaAgentChat(r,e);
  return null;
}
