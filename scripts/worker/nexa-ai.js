/* NEXA AI v2 — conversational assistant for Nexauren.
 * Authenticated assistant with conversation history, account context and billing navigation.
 */

const NEXA_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const NEXA_PLAN_LEVELS = Object.freeze({ free: 0, starter: 1, pro: 2, premium: 3 });
const NEXA_LIMITS = Object.freeze({
  free: { conversations: 5, messages: 30, web: 0, analyses: 0, maxOutput: 900 },
  starter: { conversations: 20, messages: 150, web: 30, analyses: 10, maxOutput: 1400 },
  pro: { conversations: 50, messages: 500, web: 150, analyses: 50, maxOutput: 2200 },
  premium: { conversations: 200, messages: 2000, web: 500, analyses: 200, maxOutput: 3200 },
});
const NEXA_MAX_MESSAGE = 12000;
const NEXA_HISTORY = 20;

function nexaError(r, message, code, status = 500, details = null) {
  return json({ error: message, code, ...(details ? { details } : {}) }, status, cors(r));
}
function nexaPlan(value) {
  const raw = clean(value).toLowerCase();
  if (raw === 'premium' || raw.startsWith('premium_') || raw.startsWith('premium-')) return 'premium';
  if (raw === 'pro' || raw.startsWith('pro_') || raw.startsWith('pro-')) return 'pro';
  if (raw === 'starter' || raw.startsWith('starter_') || raw.startsWith('starter-')) return 'starter';
  return 'free';
}
function nexaLimits(plan) { return NEXA_LIMITS[plan] || NEXA_LIMITS.free; }
function nexaMonthStart() { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0,0,0,0); return Math.floor(d.getTime()/1000); }
function nexaDetail(error) { return String(error?.message || error || 'Unknown error').replace(/\s+/g,' ').slice(0,600); }

async function nexaEnsureSchema(e) {
  if (!e?.TOOLS_DB) throw new Error('TOOLS_DB binding is unavailable.');
  await e.TOOLS_DB.batch([
    e.TOOLS_DB.prepare(`CREATE TABLE IF NOT EXISTS nexa_plan_limits (plan_id TEXT PRIMARY KEY, conversations_monthly INTEGER NOT NULL, messages_monthly INTEGER NOT NULL, web_searches_monthly INTEGER NOT NULL, analyses_monthly INTEGER NOT NULL, max_output_tokens INTEGER NOT NULL)`),
    e.TOOLS_DB.prepare(`CREATE TABLE IF NOT EXISTS nexa_conversations (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL DEFAULT 'New conversation', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, archived INTEGER NOT NULL DEFAULT 0)`),
    e.TOOLS_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_nexa_conv_user_updated ON nexa_conversations(user_id,updated_at DESC)`),
    e.TOOLS_DB.prepare(`CREATE TABLE IF NOT EXISTS nexa_messages (id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL)`),
    e.TOOLS_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_nexa_msg_conv_created ON nexa_messages(conversation_id,created_at)`),
    e.TOOLS_DB.prepare(`CREATE TABLE IF NOT EXISTS nexa_usage (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, conversation_id TEXT, kind TEXT NOT NULL, created_at INTEGER NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}')`),
    e.TOOLS_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_nexa_usage_user_kind_created ON nexa_usage(user_id,kind,created_at)`),
    ...Object.entries(NEXA_LIMITS).map(([plan,v]) => e.TOOLS_DB.prepare(`INSERT OR IGNORE INTO nexa_plan_limits(plan_id,conversations_monthly,messages_monthly,web_searches_monthly,analyses_monthly,max_output_tokens) VALUES(?1,?2,?3,?4,?5,?6)`).bind(plan,v.conversations,v.messages,v.web,v.analyses,v.maxOutput)),
  ]);
}
async function nexaAccount(e,userId) {
  if (typeof billingEnsureAccount !== 'function') throw new Error('Billing core is unavailable.');
  const account = await billingEnsureAccount(e,userId);
  const plan = nexaPlan(account?.plan_id || account?.plan_name);
  return { account, plan, level: NEXA_PLAN_LEVELS[plan], limits: nexaLimits(plan) };
}
async function nexaCount(e,userId,kind) {
  const row = await e.TOOLS_DB.prepare(`SELECT COUNT(*) AS total FROM nexa_usage WHERE user_id=?1 AND kind=?2 AND created_at>=?3`).bind(userId,kind,nexaMonthStart()).first();
  return Number(row?.total || 0);
}
async function nexaConversationCount(e,userId) {
  const row = await e.TOOLS_DB.prepare(`SELECT COUNT(*) AS total FROM nexa_conversations WHERE user_id=?1 AND created_at>=?2 AND archived=0`).bind(userId,nexaMonthStart()).first();
  return Number(row?.total || 0);
}
async function nexaLog(e,userId,conversationId,kind,metadata={}) {
  await e.TOOLS_DB.prepare(`INSERT INTO nexa_usage(id,user_id,conversation_id,kind,created_at,metadata_json) VALUES(?1,?2,?3,?4,?5,?6)`).bind(uuid(),userId,conversationId,kind,Math.floor(Date.now()/1000),JSON.stringify(metadata)).run();
}
async function nexaGetConversation(e,userId,id) {
  return e.TOOLS_DB.prepare(`SELECT id,title,created_at,updated_at FROM nexa_conversations WHERE id=?1 AND user_id=?2 AND archived=0 LIMIT 1`).bind(id,userId).first();
}
async function nexaMessages(e,userId,conversationId) {
  const rows=await e.TOOLS_DB.prepare(`SELECT role,content FROM nexa_messages WHERE conversation_id=?1 AND user_id=?2 ORDER BY created_at DESC LIMIT ?3`).bind(conversationId,userId,NEXA_HISTORY).all();
  return (rows?.results||[]).reverse();
}
function nexaHtmlToText(html) { return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim(); }
async function nexaWebSearch(query,maxResults=5) {
  const q=encodeURIComponent(query.slice(0,300)); const res=await fetch(`https://html.duckduckgo.com/html/?q=${q}`,{headers:{'user-agent':'Nexauren-NexaAI/2.0'}});
  if(!res.ok) throw new Error(`WEB_SEARCH_HTTP_${res.status}`); const html=await res.text(); const results=[];
  const re=/<a[^>]+class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>)/gi; let m;
  while((m=re.exec(html))&&results.length<maxResults){const url=m[1].replace(/&amp;/g,'&');const title=nexaHtmlToText(m[2]);const snippet=nexaHtmlToText(m[3]||m[4]);if(title&&url)results.push({title,url,snippet});}
  return results;
}
async function nexaToolSearch(e,query) {
  const like=`%${query.replace(/[%_]/g,'').slice(0,80)}%`;
  const rows=await e.TOOLS_DB.prepare(`SELECT id,slug,name,category,description,status FROM tools WHERE status='active' AND (name LIKE ?1 OR slug LIKE ?1 OR category LIKE ?1 OR description LIKE ?1) ORDER BY name LIMIT 8`).bind(like).all();
  return rows?.results||[];
}
function nexaSystem(plan,webResults,siteTools,userAccount=null) {
  const toolText=siteTools?.length?`\nAVAILABLE NEXAUREN TOOLS:\n${siteTools.map(t=>`- ${t.name} (${t.slug}): ${t.description||'Nexauren tool'}`).join('\n')}`:'';
  const webText=webResults?.length?`\nWEB SOURCES FOUND:\n${webResults.map((x,i)=>`${i+1}. ${x.title}\n${x.url}\n${x.snippet}`).join('\n')}`:'';
  const accountText=userAccount?`\nAUTHENTICATED ACCOUNT CONTEXT:\n- Account user id: ${userAccount.user_id}\n- Current plan: ${plan}\n- Credits balance: ${Number(userAccount.balance||0)}\n- Plan credits/cycle: ${Number(userAccount.credits_per_cycle||0)}\n- Billing currency: ${userAccount.currency||'USD'}\n- Billing interval: ${userAccount.billing_interval||'none'}\nYou may explain this account context. Never expose private authentication credentials, cookies, payment secrets or internal database identifiers to the user.`:'';
  return `You are Nexa AI, the intelligent assistant inside Nexauren. You are an operational assistant, not a tool creator. You may only use existing Nexauren tools and existing Nexauren account/billing capabilities. Never invent a tool, capability, URL, completed action or account fact. Answer in the user's language. If the user asks about their account, credits or plan, use the supplied authenticated account context. If they want to buy credits or change/upgrade a plan, direct them to the real Nexauren billing page instead of pretending the purchase happened. Current user plan: ${plan}.${accountText}${toolText}${webText}`;
}
async function nexaRun(e,messages,maxOutput) {
  const response=await e.AI.run(NEXA_MODEL,{messages,max_completion_tokens:maxOutput,chat_template_kwargs:{enable_thinking:false}});
  const text=clean(response?.response||response?.choices?.[0]?.message?.content||response?.result?.response||response?.result?.choices?.[0]?.message?.content);
  if(!text) throw new Error('NEXA_EMPTY_RESPONSE'); return text;
}

async function nexaAccountSnapshot(e,userId) {
  const account=await nexaAccount(e,userId);
  const subscription=await e.DB.prepare(`SELECT id,provider,plan_id,status,start_date,next_billing_date,cancelled_at,current_period_start,current_period_end,cancel_at_period_end FROM subscriptions WHERE user_id=?1 ORDER BY created_at DESC LIMIT 1`).bind(userId).first();
  const tx=await e.DB.prepare(`SELECT id,amount,type,description,reference,created_at FROM credit_transactions WHERE user_id=?1 ORDER BY created_at DESC LIMIT 10`).bind(userId).all();
  const catalog=await e.DB.prepare(`SELECT id,name,price_minor,currency,billing_interval,credits_per_cycle FROM plans WHERE enabled=1 ORDER BY price_minor ASC`).all();
  const packages=await e.DB.prepare(`SELECT id,name,credits,price_minor,currency FROM credit_packages WHERE enabled=1 ORDER BY credits ASC`).all();
  return { account:account.account, plan:account.plan, limits:account.limits, subscription:subscription||null, recent_transactions:tx?.results||[], plans:catalog?.results||[], credit_packages:packages?.results||[], links:{billing:'/billing/',account:'/account/',plans:'/billing/#plans',credits:'/billing/#credits'} };
}

async function nexaCatalog(r,e,user) {
  try { await nexaEnsureSchema(e); const account=await nexaAccount(e,user.id); return json({success:true,assistant:'Nexa AI',plan:account.plan,limits:account.limits,used:{messages:await nexaCount(e,user.id,'message'),web:await nexaCount(e,user.id,'web_search'),analyses:await nexaCount(e,user.id,'analysis'),conversations:await nexaConversationCount(e,user.id)},account:account.account},200,cors(r)); }
  catch(err) { return nexaError(r,'Unable to load Nexa AI account.','nexa_catalog_failed',500,nexaDetail(err)); }
}
async function nexaAccountRoute(r,e) {
  const user=await currentUser(r,e); if(!user) return nexaError(r,'Authentication required.','authentication_required',401);
  try { await nexaEnsureSchema(e); return json({success:true,...await nexaAccountSnapshot(e,user.id)},200,cors(r)); }
  catch(err) { return nexaError(r,'Unable to load account context.','nexa_account_failed',500,nexaDetail(err)); }
}
async function nexaChat(r,e) {
  const user=await currentUser(r,e); if(!user) return nexaError(r,'Authentication required.','authentication_required',401);
  await nexaEnsureSchema(e); const d=await body(r); const message=clean(d?.message).slice(0,NEXA_MAX_MESSAGE); if(!message)return nexaError(r,'Message is required.','message_required',400);
  const account=await nexaAccount(e,user.id); const limits=account.limits; const usedMessages=await nexaCount(e,user.id,'message');
  if(usedMessages>=limits.messages)return nexaError(r,`Monthly message limit reached for ${account.plan}.`,'message_limit_reached',429);
  let conversation=null; const requestedId=clean(d?.conversation_id).slice(0,100); if(requestedId)conversation=await nexaGetConversation(e,user.id,requestedId);
  if(!conversation){const conversations=await nexaConversationCount(e,user.id);if(conversations>=limits.conversations)return nexaError(r,`Monthly conversation limit reached for ${account.plan}.`,'conversation_limit_reached',429);const now=Math.floor(Date.now()/1000),id=uuid();await e.TOOLS_DB.prepare(`INSERT INTO nexa_conversations(id,user_id,title,created_at,updated_at) VALUES(?1,?2,?3,?4,?4)`).bind(id,user.id,message.slice(0,80)||'New conversation',now).run();conversation={id,title:message.slice(0,80)||'New conversation',created_at:now,updated_at:now};}
  const wantsWeb=d?.web===true||d?.web==='true', wantsTools=d?.tools!==false, wantsAnalysis=d?.analysis===true||d?.analysis==='true'; let webResults=[],siteTools=[];
  if(wantsWeb){if(account.level<1)return nexaError(r,'Web search is available from the Starter plan.','feature_plan_required',402);if(await nexaCount(e,user.id,'web_search')>=limits.web)return nexaError(r,'Monthly web-search limit reached.','web_limit_reached',429);try{webResults=await nexaWebSearch(message,account.level>=2?7:5);await nexaLog(e,user.id,conversation.id,'web_search',{query:message.slice(0,300),results:webResults.length});}catch(err){console.error('Nexa web search failed',nexaDetail(err));}}
  if(wantsTools&&/(outil|tool|ferrament|resiz|pdf|image|vídeo|video|compress|comprime|redimension|corta|junta|divide|converter)/i.test(message))siteTools=await nexaToolSearch(e,message);
  if(wantsAnalysis){if(account.level<1)return nexaError(r,'Advanced analysis is available from the Starter plan.','feature_plan_required',402);if(await nexaCount(e,user.id,'analysis')>=limits.analyses)return nexaError(r,'Monthly analysis limit reached.','analysis_limit_reached',429);await nexaLog(e,user.id,conversation.id,'analysis',{mode:account.level>=2?'advanced':'standard'});}
  const history=await nexaMessages(e,user.id,conversation.id); const accountContext=account.account;
  const promptMessages=[{role:'system',content:nexaSystem(account.plan,webResults,siteTools,accountContext)},...history,{role:'user',content:message}];
  let answer; try{answer=await nexaRun(e,promptMessages,limits.maxOutput);}catch(err){console.error('Nexa model failed',nexaDetail(err));return nexaError(r,'Nexa AI could not complete the request.','nexa_ai_failed',502,nexaDetail(err));}
  const now=Math.floor(Date.now()/1000); await e.TOOLS_DB.batch([
    e.TOOLS_DB.prepare(`INSERT INTO nexa_messages(id,conversation_id,user_id,role,content,created_at) VALUES(?1,?2,?3,'user',?4,?5)`).bind(uuid(),conversation.id,user.id,message,now),
    e.TOOLS_DB.prepare(`INSERT INTO nexa_messages(id,conversation_id,user_id,role,content,created_at) VALUES(?1,?2,?3,'assistant',?4,?5)`).bind(uuid(),conversation.id,user.id,answer,now),
    e.TOOLS_DB.prepare(`UPDATE nexa_conversations SET updated_at=?1 WHERE id=?2 AND user_id=?3`).bind(now,conversation.id,user.id),
  ]); await nexaLog(e,user.id,conversation.id,'message',{web:wantsWeb,analysis:wantsAnalysis});
  const lower=message.toLowerCase(); let account_action=null;
  if(/\b(meus?|minha|minhas|meu)\b.*(crédito|credit|saldo|plano|conta)|\b(crédito|credit|saldo|plano)\b.*\b(conta|meu|minha)\b/i.test(lower))account_action={type:'account',label:'Ver minha conta',url:'/account/'};
  if(/(comprar|buy|adquirir|recarregar|adicionar).*(crédito|credit)|crédito.*(comprar|buy)/i.test(lower))account_action={type:'credits',label:'Comprar créditos',url:'/billing/#credits'};
  else if(/(mudar|alterar|atualizar|upgrade|upgrad|assinar|trocar).*(plano)|plano.*(mudar|upgrade|atualizar|trocar)/i.test(lower))account_action={type:'plans',label:'Atualizar plano',url:'/billing/#plans'};
  return json({success:true,conversation_id:conversation.id,title:conversation.title,answer,plan:account.plan,account:{user_id:account.account.user_id,plan_id:account.account.plan_id,plan_name:account.account.plan_name,balance:Number(account.account.balance||0),credits_per_cycle:Number(account.account.credits_per_cycle||0),currency:account.account.currency,billing_interval:account.account.billing_interval},usage:{messages:usedMessages+1,web:await nexaCount(e,user.id,'web_search'),analyses:await nexaCount(e,user.id,'analysis'),conversations:await nexaConversationCount(e,user.id)},web_sources:webResults,tools:siteTools,account_action},200,cors(r));
}
async function nexaConversations(r,e){const user=await currentUser(r,e);if(!user)return nexaError(r,'Authentication required.','authentication_required',401);await nexaEnsureSchema(e);const rows=await e.TOOLS_DB.prepare(`SELECT id,title,created_at,updated_at FROM nexa_conversations WHERE user_id=?1 AND archived=0 ORDER BY updated_at DESC LIMIT 50`).bind(user.id).all();return json({success:true,conversations:rows?.results||[]},200,cors(r));}
async function nexaHistory(r,e){const user=await currentUser(r,e);if(!user)return nexaError(r,'Authentication required.','authentication_required',401);await nexaEnsureSchema(e);const id=clean(new URL(r.url).searchParams.get('id'));const c=await nexaGetConversation(e,user.id,id);if(!c)return nexaError(r,'Conversation not found.','conversation_not_found',404);const rows=await e.TOOLS_DB.prepare(`SELECT role,content,created_at FROM nexa_messages WHERE conversation_id=?1 AND user_id=?2 ORDER BY created_at ASC LIMIT 100`).bind(id,user.id).all();return json({success:true,conversation:c,messages:rows?.results||[]},200,cors(r));}
async function __handleNexaAiRoute(r,e){const p=new URL(r.url).pathname;if(p==='/api/nexa-ai'&&r.method==='GET'){const u=await currentUser(r,e);return u?nexaCatalog(r,e,u):nexaError(r,'Authentication required.','authentication_required',401);}if(p==='/api/nexa-ai/account'&&r.method==='GET')return nexaAccountRoute(r,e);if(p==='/api/nexa-ai/chat'&&r.method==='POST')return nexaChat(r,e);if(p==='/api/nexa-ai/conversations'&&r.method==='GET')return nexaConversations(r,e);if(p==='/api/nexa-ai/history'&&r.method==='GET')return nexaHistory(r,e);return null;}
