import original from './.worker-build/worker.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-credentials': 'true',
  },
});

const clean = (v) => String(v ?? '').trim();
const now = () => Math.floor(Date.now() / 1000);
const id = () => crypto.randomUUID();

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function sessionToken(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)nexauren_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function adminUser(request, env) {
  const token = sessionToken(request);
  if (!token) return null;
  const user = await env.DB.prepare(
    'SELECT u.id,u.email,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?1 AND s.expires_at>?2 LIMIT 1'
  ).bind(await sha256(token), now()).first();
  if (!user) return null;
  return String(user.email || '').toLowerCase() === String(env.ADMIN_EMAIL || '').trim().toLowerCase() ? user : null;
}

async function schema(env) {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY,title TEXT NOT NULL,message TEXT NOT NULL,type TEXT NOT NULL DEFAULT 'information',priority TEXT NOT NULL DEFAULT 'LOW',status TEXT NOT NULL DEFAULT 'DRAFT',created_by TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,published_at INTEGER,archived_at INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS notification_recipients (notification_id TEXT NOT NULL,user_id TEXT NOT NULL,read_at INTEGER,created_at INTEGER NOT NULL,PRIMARY KEY(notification_id,user_id))"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS notification_audit_logs (id TEXT PRIMARY KEY,notification_id TEXT NOT NULL,admin_id TEXT,action TEXT NOT NULL,metadata TEXT,created_at INTEGER NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status,created_at DESC)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_notification_recipients_user ON notification_recipients(user_id,read_at,created_at DESC)"),
  ]);
}

async function audit(env, notificationId, adminId, action, metadata = {}) {
  await env.DB.prepare('INSERT INTO notification_audit_logs (id,notification_id,admin_id,action,metadata,created_at) VALUES (?1,?2,?3,?4,?5,?6)')
    .bind(id(), notificationId, adminId, action, JSON.stringify(metadata), now()).run();
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
  const timestamp = now();
  if (rows.length) await env.DB.batch(rows.map((u) => env.DB.prepare('INSERT OR IGNORE INTO notification_recipients (notification_id,user_id,read_at,created_at) VALUES (?1,?2,NULL,?3)').bind(notificationId, u.id, timestamp)));
  return rows.length;
}

async function adminNotifications(request, env) {
  const admin = await adminUser(request, env);
  if (!admin) return json({ error: 'Forbidden' }, 403);
  await schema(env);
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25));
  const q = clean(url.searchParams.get('q'));
  const type = clean(url.searchParams.get('type')).toLowerCase();
  const status = clean(url.searchParams.get('status')).toUpperCase();
  const where = []; const args = [];
  if (q) { where.push('(n.title LIKE ? OR n.message LIKE ? OR n.type LIKE ?)'); const v = `%${q}%`; args.push(v, v, v); }
  if (type) { where.push('n.type=?'); args.push(type); }
  if (status) { where.push('n.status=?'); args.push(status); }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const total = await env.DB.prepare(`SELECT COUNT(*) total FROM notifications n${clause}`).bind(...args).first();
  const rows = await env.DB.prepare(`SELECT n.*,COUNT(r.user_id) recipients,SUM(CASE WHEN r.read_at IS NOT NULL THEN 1 ELSE 0 END) read_count,SUM(CASE WHEN r.read_at IS NULL THEN 1 ELSE 0 END) unread_count FROM notifications n LEFT JOIN notification_recipients r ON r.notification_id=n.id${clause} GROUP BY n.id ORDER BY n.created_at DESC LIMIT ? OFFSET ?`).bind(...args, limit, (page - 1) * limit).all();
  const stats = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) total FROM notifications WHERE status='ACTIVE'"),
    env.DB.prepare("SELECT COUNT(*) total FROM notifications WHERE status='DRAFT'"),
    env.DB.prepare("SELECT COUNT(*) total FROM notifications WHERE status='SENT'"),
    env.DB.prepare('SELECT COUNT(*) total FROM notification_recipients WHERE read_at IS NULL'),
    env.DB.prepare('SELECT COUNT(*) total FROM notification_recipients WHERE read_at IS NOT NULL'),
  ]);
  const n = stats.map((x) => Number(x.results?.[0]?.total || 0));
  return json({ page, limit, total: Number(total?.total || 0), active: n[0], drafts: n[1], sent: n[2], unread: n[3], read: n[4], notifications: rows.results || [] });
}

async function createNotification(request, env) {
  const admin = await adminUser(request, env);
  if (!admin) return json({ error: 'Forbidden' }, 403);
  await schema(env);
  const d = await request.json().catch(() => null);
  const title = clean(d?.title).slice(0, 160);
  const message = clean(d?.message ?? d?.body).slice(0, 5000);
  if (!title || !message) return json({ error: 'Title and message are required.' }, 400);
  const type = ['information','success','warning','important','update','system'].includes(clean(d?.type).toLowerCase()) ? clean(d.type).toLowerCase() : 'information';
  const priority = ['LOW','MEDIUM','HIGH','CRITICAL'].includes(String(d?.priority).toUpperCase()) ? String(d.priority).toUpperCase() : 'LOW';
  const notificationId = id(); const timestamp = now();
  const publish = d?.publish_immediately === true;
  const status = publish ? 'SENT' : 'DRAFT';
  await env.DB.prepare('INSERT INTO notifications (id,title,message,type,priority,status,created_by,created_at,updated_at,published_at,archived_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?8,?9,NULL)')
    .bind(notificationId, title, message, type, priority, status, admin.id, timestamp, publish ? timestamp : null).run();
  if (publish) await recipients(env, notificationId, d?.audience || 'all', d?.user_ids || []);
  await audit(env, notificationId, admin.id, publish ? 'PUBLISHED' : 'CREATED', { audience: d?.audience || 'all' });
  return json({ success: true, id: notificationId, status }, 201);
}

async function notificationDetail(request, env, notificationId) {
  const admin = await adminUser(request, env);
  if (!admin) return json({ error: 'Forbidden' }, 403);
  await schema(env);
  const notification = await env.DB.prepare('SELECT * FROM notifications WHERE id=?1').bind(notificationId).first();
  if (!notification) return json({ error: 'Notification not found.' }, 404);
  const recipientsRows = await env.DB.prepare('SELECT r.user_id,r.read_at,r.created_at,u.username,u.email FROM notification_recipients r LEFT JOIN users u ON u.id=r.user_id WHERE r.notification_id=?1 ORDER BY r.created_at DESC').bind(notificationId).all();
  const auditRows = await env.DB.prepare('SELECT a.*,u.username,u.email FROM notification_audit_logs a LEFT JOIN users u ON u.id=a.admin_id WHERE a.notification_id=?1 ORDER BY a.created_at DESC').bind(notificationId).all();
  return json({ notification, recipients: recipientsRows.results || [], audit: auditRows.results || [] });
}

async function updateNotification(request, env, notificationId) {
  const admin = await adminUser(request, env);
  if (!admin) return json({ error: 'Forbidden' }, 403);
  await schema(env);
  const existing = await env.DB.prepare('SELECT * FROM notifications WHERE id=?1').bind(notificationId).first();
  if (!existing) return json({ error: 'Notification not found.' }, 404);
  if (['SENT','ARCHIVED'].includes(existing.status)) return json({ error: 'Sent or archived notifications cannot be silently edited. Duplicate it to create a new revision.' }, 409);
  const d = await request.json().catch(() => null); const sets = []; const args = [];
  if (d?.title !== undefined) { const v = clean(d.title).slice(0,160); if (!v) return json({error:'Title is required.'},400); sets.push('title=?'); args.push(v); }
  if (d?.message !== undefined) { const v = clean(d.message).slice(0,5000); if (!v) return json({error:'Message is required.'},400); sets.push('message=?'); args.push(v); }
  if (d?.type !== undefined) { sets.push('type=?'); args.push(clean(d.type).toLowerCase()); }
  if (d?.priority !== undefined) { sets.push('priority=?'); args.push(String(d.priority).toUpperCase()); }
  if (!sets.length) return json({error:'No changes supplied.'},400);
  sets.push('updated_at=?'); args.push(now(), notificationId);
  await env.DB.prepare(`UPDATE notifications SET ${sets.join(',')} WHERE id=?`).bind(...args).run();
  await audit(env, notificationId, admin.id, 'EDITED', { fields: sets });
  return json({success:true});
}

async function publishNotification(request, env, notificationId) {
  const admin = await adminUser(request, env);
  if (!admin) return json({ error: 'Forbidden' }, 403);
  await schema(env);
  const existing = await env.DB.prepare('SELECT * FROM notifications WHERE id=?1').bind(notificationId).first();
  if (!existing) return json({error:'Notification not found.'},404);
  if (['SENT','ARCHIVED'].includes(existing.status)) return json({error:'Notification is already sent or archived.'},409);
  const d = await request.json().catch(() => ({}));
  const count = await recipients(env, notificationId, d?.audience || 'all', d?.user_ids || []);
  if (!count) return json({error:'No recipients selected.'},400);
  const timestamp = now();
  await env.DB.prepare("UPDATE notifications SET status='SENT',published_at=?1,updated_at=?1 WHERE id=?2").bind(timestamp,notificationId).run();
  await audit(env,notificationId,admin.id,'PUBLISHED',{audience:d?.audience || 'all',recipients:count});
  return json({success:true,status:'SENT',recipients:count});
}

async function actionNotification(request, env, notificationId, action) {
  const admin = await adminUser(request, env);
  if (!admin) return json({error:'Forbidden'},403);
  await schema(env);
  const n = await env.DB.prepare('SELECT * FROM notifications WHERE id=?1').bind(notificationId).first();
  if (!n) return json({error:'Notification not found.'},404);
  const timestamp = now();
  if (action === 'disable') await env.DB.prepare("UPDATE notifications SET status='DISABLED',updated_at=?1 WHERE id=?2").bind(timestamp,notificationId).run();
  if (action === 'archive') await env.DB.prepare("UPDATE notifications SET status='ARCHIVED',archived_at=?1,updated_at=?1 WHERE id=?2").bind(timestamp,notificationId).run();
  if (action === 'delete') await env.DB.batch([env.DB.prepare('DELETE FROM notification_recipients WHERE notification_id=?1').bind(notificationId),env.DB.prepare('DELETE FROM notification_audit_logs WHERE notification_id=?1').bind(notificationId),env.DB.prepare('DELETE FROM notifications WHERE id=?1').bind(notificationId)]);
  await audit(env,notificationId,admin.id,action.toUpperCase());
  return json({success:true});
}

function adminApi(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/admin/notifications')) return null;
  const parts = url.pathname.split('/').filter(Boolean);
  const notificationId = parts.length >= 4 ? parts[3] : null;
  const action = parts.length >= 5 ? parts[4] : null;
  if (url.pathname === '/api/admin/notifications' && request.method === 'GET') return adminNotifications(request,env);
  if (url.pathname === '/api/admin/notifications' && request.method === 'POST') return createNotification(request,env);
  if (notificationId && request.method === 'GET' && !action) return notificationDetail(request,env,notificationId);
  if (notificationId && request.method === 'PUT' && !action) return updateNotification(request,env,notificationId);
  if (notificationId && action === 'publish' && request.method === 'POST') return publishNotification(request,env,notificationId);
  if (notificationId && ['disable','archive','delete'].includes(action) && request.method === 'POST') return actionNotification(request,env,notificationId,action);
  return json({error:'Admin route not found.'},404);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:{'access-control-allow-origin':'*','access-control-allow-credentials':'true','access-control-allow-methods':'GET,POST,PUT,DELETE,OPTIONS','access-control-allow-headers':'Content-Type,Accept'}});
    if (new URL(request.url).pathname.startsWith('/api/admin/notifications')) {
      try { return await adminApi(request,env); } catch (error) { console.error(error); return json({error:'Internal notifications error.'},500); }
    }
    return original.fetch(request,env,ctx);
  },
};
