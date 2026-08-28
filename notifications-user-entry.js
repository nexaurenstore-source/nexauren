import adminApp from './notifications-entry-v2.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'Content-Type, Accept',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  },
});

const now = () => Math.floor(Date.now() / 1000);

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function sessionToken(request) {
  const value = request.headers.get('Cookie') || '';
  const match = value.match(/(?:^|;\s*)nexauren_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function currentUser(request, env) {
  const token = sessionToken(request);
  if (!token) return null;
  return env.DB.prepare(
    'SELECT u.id,u.email,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?1 AND s.expires_at>?2 LIMIT 1'
  ).bind(await sha256(token), now()).first();
}

async function schema(env) {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS nexauren_notifications (id TEXT PRIMARY KEY,title TEXT NOT NULL,message TEXT NOT NULL,type TEXT NOT NULL DEFAULT 'information',priority TEXT NOT NULL DEFAULT 'LOW',status TEXT NOT NULL DEFAULT 'DRAFT',created_by TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,published_at INTEGER,archived_at INTEGER)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS nexauren_notification_recipients (notification_id TEXT NOT NULL,user_id TEXT NOT NULL,read_at INTEGER,created_at INTEGER NOT NULL,PRIMARY KEY(notification_id,user_id))"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS idx_nexauren_notification_recipients_user ON nexauren_notification_recipients(user_id,read_at,created_at DESC)"),
  ]);
}

async function userNotifications(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  await schema(env);
  const url = new URL(request.url);
  const page = Math.max(1, Math.floor(Number(url.searchParams.get('page')) || 1));
  const limit = Math.min(50, Math.max(1, Math.floor(Number(url.searchParams.get('limit')) || 20)));
  const offset = (page - 1) * limit;
  const rows = await env.DB.prepare(
    "SELECT n.id,n.title,n.message,n.type,n.priority,n.published_at,n.created_at,r.read_at FROM nexauren_notification_recipients r JOIN nexauren_notifications n ON n.id=r.notification_id WHERE r.user_id=?1 AND n.status IN ('ACTIVE','SENT') ORDER BY COALESCE(n.published_at,n.created_at) DESC LIMIT ?2 OFFSET ?3"
  ).bind(user.id, limit, offset).all();
  const unread = await env.DB.prepare(
    "SELECT COUNT(*) total FROM nexauren_notification_recipients r JOIN nexauren_notifications n ON n.id=r.notification_id WHERE r.user_id=?1 AND r.read_at IS NULL AND n.status IN ('ACTIVE','SENT')"
  ).bind(user.id).first();
  return json({ page, limit, unread: Number(unread?.total || 0), notifications: rows.results || [] });
}

async function unreadNotifications(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  await schema(env);
  const rows = await env.DB.prepare(
    "SELECT n.id,n.title,n.message,n.type,n.priority,n.published_at,n.created_at,r.read_at FROM nexauren_notification_recipients r JOIN nexauren_notifications n ON n.id=r.notification_id WHERE r.user_id=?1 AND r.read_at IS NULL AND n.status IN ('ACTIVE','SENT') ORDER BY COALESCE(n.published_at,n.created_at) DESC LIMIT 50"
  ).bind(user.id).all();
  const items = rows.results || [];
  return json({ unread: items.length, notifications: items });
}

async function markRead(request, env, id) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  await schema(env);
  const result = await env.DB.prepare(
    'UPDATE nexauren_notification_recipients SET read_at=?1 WHERE notification_id=?2 AND user_id=?3 AND read_at IS NULL'
  ).bind(now(), id, user.id).run();
  return json({ success: true, read: Number(result?.meta?.changes || 0) > 0 });
}

async function markAllRead(request, env) {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Unauthorized' }, 401);
  await schema(env);
  await env.DB.prepare(
    'UPDATE nexauren_notification_recipients SET read_at=?1 WHERE user_id=?2 AND read_at IS NULL'
  ).bind(now(), user.id).run();
  return json({ success: true });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/notifications')) {
      if (request.method === 'OPTIONS') return json({}, 204);
      try {
        if (url.pathname === '/api/notifications' && request.method === 'GET') return userNotifications(request, env);
        if (url.pathname === '/api/notifications/unread' && request.method === 'GET') return unreadNotifications(request, env);
        if (url.pathname === '/api/notifications/read-all' && request.method === 'POST') return markAllRead(request, env);
        if (url.pathname.startsWith('/api/notifications/') && request.method === 'POST') {
          const id = decodeURIComponent(url.pathname.split('/').pop() || '');
          if (id && id !== 'unread' && id !== 'read-all') return markRead(request, env, id);
        }
        return json({ error: 'Notification route not found.' }, 404);
      } catch (error) {
        console.error('User Notifications API:', error);
        return json({ error: 'Internal notifications error.' }, 500);
      }
    }
    return adminApp.fetch(request, env, ctx);
  },
};
