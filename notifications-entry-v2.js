import original from './.worker-build/worker.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const clean = (v) => String(v ?? '').trim();
const now = () => Math.floor(Date.now() / 1000);
const uid = () => crypto.randomUUID();

async function isAdmin(request, env, ctx) {
  try {
    const u = new URL('/api/admin/users?limit=1', request.url);
    const probe = new Request(u, { method: 'GET', headers: request.headers });
    const response = await original.fetch(probe, env, ctx);
    return response.status === 200;
  } catch (_) { return false; }
}

async function schema(env) {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS nexauren_notifications (id TEXT PRIMARY KEY,title TEXT NOT NULL,message TEXT NOT NULL,type TEXT NOT NULL DEFAULT 'information',priority TEXT NOT NULL DEFAULT 'LOW',status TEXT NOT NULL DEFAULT 'DRAFT',created_by TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,published_at INTEGER,archived_at INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS nexauren_notification_recipients (notification_id TEXT NOT NULL,user_id TEXT NOT NULL,read_at INTEGER,created_at INTEGER NOT NULL,PRIMARY KEY(notification_id,user_id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS nexauren_notification_audit_logs (id TEXT PRIMARY KEY,notification_id TEXT NOT NULL,admin_id TEXT,action TEXT NOT NULL,metadata TEXT,created_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_nexauren_notifications_status ON nexauren_notifications(status,created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_nexauren_notification_recipients_user ON nexauren_notification_recipients(user_id,read_at,created_at DESC)"),
  ]);
}

async function audit(env, notificationId, adminId, action, metadata = {}) {
  await env.DB.prepare('INSERT INTO nexauren_notification_audit_logs (id,notification_id,admin_id,action,metadata,created_at) VALUES (?1,?2,?3,?4,?5,?6)').bind(uid(), notificationId, adminId, action, JSON.stringify(metadata), now()).run();
}

async function recipients(env, notificationId, audience, userIds = []) {
  const mode = clean(audience || 'all').toLowerCase();
  let rows = [];
  if (mode === 'specific') {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : []).map(clean).filter(Boolean))].slice(0, 5000);
    if (ids.length) {
      const marks = ids.map((_, i) => '?' + (i + 1)).join(',');
      rows = (await env.DB.prepare(`SELECT id FROM users WHERE id IN (${marks})`).bind(...ids).all()).results || [];
    }
  } else if (mode === 'active') {
    rows = (await env.DB.prepare('SELECT DISTINCT u.id FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.expires_at>?1').bind(now()).all()).results || [];
  } else {
    rows = (await env.DB.prepare('SELECT id FROM users').all()).results || [];
  }
  const t = now();
  if (rows.length) await env.DB.batch(rows.map((u) => env.DB.prepare('INSERT OR IGNORE INTO nexauren_notification_recipients (notification_id,user_id,read_at,created_at) VALUES (?1,?2,NULL,?3)').bind(notificationId, u.id, t)));
  return rows.length;
}

async function list(request, env, ctx) {
  if (!await isAdmin(request, env, ctx)) return json({ error: 'Forbidden' }, 403);
  await schema(env);
  const u = new URL(request.url); const page = Math.max(1, Number(u.searchParams.get('page')) || 1); const limit = Math.min(100, Math.max(1, Number(u.searchParams.get('limit')) || 25));
  const q = clean(u.searchParams.get('q')); const type = clean(u.searchParams.get('type')).toLowerCase(); const status = clean(u.searchParams.get('status')).toUpperCase();
  const where = []; const args = [];
  if (q) { const v = `%${q}%`; where.push('(n.title LIKE ? OR n.message LIKE ? OR n.type LIKE ?)'); args.push(v,v,v); }
  if (type) { where.push('n.type=?'); args.push(type); }
  if (status) { where.push('n.status=?'); args.push(status); }
  const clause = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const total = await env.DB.prepare(`SELECT COUNT(*) total FROM nexauren_notifications n${clause}`).bind(...args).first();
  const rows = await env.DB.prepare(`SELECT n.*,COUNT(r.user_id) recipients,SUM(CASE WHEN r.read_at IS NOT NULL THEN 1 ELSE 0 END) read_count,SUM(CASE WHEN r.read_at IS NULL THEN 1 ELSE 0 END) unread_count FROM nexauren_notifications n LEFT JOIN nexauren_notification_recipients r ON r.notification_id=n.id${clause} GROUP BY n.id ORDER BY n.created_at DESC LIMIT ? OFFSET ?`).bind(...args,limit,(page-1)*limit).all();
  const stats = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) total FROM nexauren_notifications WHERE status='ACTIVE'"),
    env.DB.prepare("SELECT COUNT(*) total FROM nexauren_notifications WHERE status='DRAFT'"),
    env.DB.prepare("SELECT COUNT(*) total FROM nexauren_notifications WHERE status='SENT'"),
    env.DB.prepare("SELECT COUNT(*) total FROM nexauren_notifications WHERE status='ARCHIVED'"),
    env.DB.prepare('SELECT COUNT(*) total FROM nexauren_notification_recipients WHERE read_at IS NULL'),
    env.DB.prepare('SELECT COUNT(*) total FROM nexauren_notification_recipients WHERE read_at IS NOT NULL'),
  ]);
  const s = stats.map(x => Number(x.results?.[0]?.total || 0));
  return json({ page, limit, total: Number(total?.total || 0), active:s[0], drafts:s[1], sent:s[2], archived:s[3], unread:s[4], read:s[5], notifications: rows.results || [] });
}

async function create(request, env, ctx) {
  if (!await isAdmin(request, env, ctx)) return json({ error: 'Forbidden' }, 403);
  await schema(env); const d = await request.json().catch(() => null); const title = clean(d?.title).slice(0,160); const message = clean(d?.message ?? d?.body).slice(0,5000);
  if (!title || !message) return json({ error:'Title and message are required.' },400);
  const type = ['information','success','warning','important','update','system'].includes(clean(d?.type).toLowerCase()) ? clean(d.type).toLowerCase() : 'information';
  const priority = ['LOW','MEDIUM','HIGH','CRITICAL'].includes(String(d?.priority).toUpperCase()) ? String(d.priority).toUpperCase() : 'LOW';
  const notificationId = uid(); const t = now(); const publish = d?.publish_immediately === true; const status = publish ? 'SENT' : 'DRAFT';
  const adminId = clean(d?.created_by) || null;
  await env.DB.prepare('INSERT INTO nexauren_notifications (id,title,message,type,priority,status,created_by,created_at,updated_at,published_at,archived_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?8,?9,NULL)').bind(notificationId,title,message,type,priority,status,adminId,t,publish?t:null).run();
  if (publish) await recipients(env,notificationId,d?.audience || 'all',d?.user_ids || []);
  await audit(env,notificationId,adminId,publish?'PUBLISHED':'CREATED',{audience:d?.audience || 'all'});
  return json({ success:true,id:notificationId,status },201);
}

async function detail(request, env, ctx, id) {
  if (!await isAdmin(request, env, ctx)) return json({error:'Forbidden'},403); await schema(env);
  const n = await env.DB.prepare('SELECT * FROM nexauren_notifications WHERE id=?1').bind(id).first(); if (!n) return json({error:'Notification not found.'},404);
  const r = await env.DB.prepare('SELECT * FROM nexauren_notification_recipients WHERE notification_id=?1 ORDER BY created_at DESC').bind(id).all();
  const a = await env.DB.prepare('SELECT * FROM nexauren_notification_audit_logs WHERE notification_id=?1 ORDER BY created_at DESC').bind(id).all();
  return json({notification:n,recipients:r.results||[],audit:a.results||[]});
}

async function update(request, env, ctx, id) {
  if (!await isAdmin(request, env, ctx)) return json({error:'Forbidden'},403); await schema(env); const n=await env.DB.prepare('SELECT * FROM nexauren_notifications WHERE id=?1').bind(id).first(); if(!n)return json({error:'Notification not found.'},404);
  if(['SENT','ARCHIVED'].includes(n.status))return json({error:'Sent or archived notifications cannot be silently edited. Duplicate it instead.'},409);
  const d=await request.json().catch(()=>null);const sets=[];const args=[];
  if(d?.title!==undefined){sets.push('title=?');args.push(clean(d.title).slice(0,160));} if(d?.message!==undefined){sets.push('message=?');args.push(clean(d.message).slice(0,5000));} if(d?.type!==undefined){sets.push('type=?');args.push(clean(d.type).toLowerCase());} if(d?.priority!==undefined){sets.push('priority=?');args.push(String(d.priority).toUpperCase());}
  if(!sets.length)return json({error:'No changes supplied.'},400);sets.push('updated_at=?');args.push(now(),id);await env.DB.prepare(`UPDATE nexauren_notifications SET ${sets.join(',')} WHERE id=?`).bind(...args).run();return json({success:true});
}

async function publish(request, env, ctx, id) {
  if (!await isAdmin(request, env, ctx)) return json({error:'Forbidden'},403); await schema(env); const n=await env.DB.prepare('SELECT * FROM nexauren_notifications WHERE id=?1').bind(id).first(); if(!n)return json({error:'Notification not found.'},404); if(['SENT','ARCHIVED'].includes(n.status))return json({error:'Notification is already sent or archived.'},409);
  const d=await request.json().catch(()=>({}));const count=await recipients(env,id,d?.audience||'all',d?.user_ids||[]);if(!count)return json({error:'No recipients selected.'},400);const t=now();await env.DB.prepare("UPDATE nexauren_notifications SET status='SENT',published_at=?1,updated_at=?1 WHERE id=?2").bind(t,id).run();await audit(env,id,null,'PUBLISHED',{recipients:count});return json({success:true,status:'SENT',recipients:count});
}

async function action(request, env, ctx, id, actionName) {
  if (!await isAdmin(request, env, ctx)) return json({error:'Forbidden'},403); await schema(env); const n=await env.DB.prepare('SELECT id FROM nexauren_notifications WHERE id=?1').bind(id).first();if(!n)return json({error:'Notification not found.'},404);const t=now();
  if(actionName==='disable')await env.DB.prepare("UPDATE nexauren_notifications SET status='DISABLED',updated_at=?1 WHERE id=?2").bind(t,id).run();
  if(actionName==='archive')await env.DB.prepare("UPDATE nexauren_notifications SET status='ARCHIVED',archived_at=?1,updated_at=?1 WHERE id=?2").bind(t,id).run();
  if(actionName==='delete')await env.DB.batch([env.DB.prepare('DELETE FROM nexauren_notification_recipients WHERE notification_id=?1').bind(id),env.DB.prepare('DELETE FROM nexauren_notification_audit_logs WHERE notification_id=?1').bind(id),env.DB.prepare('DELETE FROM nexauren_notifications WHERE id=?1').bind(id)]);
  await audit(env,id,null,actionName.toUpperCase()); return json({success:true});
}

export default { async fetch(request,env,ctx) {
  const url=new URL(request.url);
  if(url.pathname.startsWith('/api/admin/notifications')) {
    try {
      const p=url.pathname.split('/').filter(Boolean); const id=p.length>=4?p[3]:null; const actionName=p.length>=5?p[4]:null;
      if(url.pathname==='/api/admin/notifications'&&request.method==='GET')return await list(request,env,ctx);
      if(url.pathname==='/api/admin/notifications'&&request.method==='POST')return await create(request,env,ctx);
      if(id&&request.method==='GET'&&!actionName)return await detail(request,env,ctx,id);
      if(id&&request.method==='PUT'&&!actionName)return await update(request,env,ctx,id);
      if(id&&actionName==='publish'&&request.method==='POST')return await publish(request,env,ctx,id);
      if(id&&['disable','archive','delete'].includes(actionName)&&request.method==='POST')return await action(request,env,ctx,id,actionName);
      return json({error:'Admin route not found.'},404);
    } catch(error) { console.error('Notifications API:',error); return json({error:'Internal notifications error.'},500); }
  }
  return original.fetch(request,env,ctx);
} };
