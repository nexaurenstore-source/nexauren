import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const source = new URL('../worker.js', import.meta.url);
const outputDir = new URL('../.worker-build/', import.meta.url);
const output = new URL('../.worker-build/worker.js', import.meta.url);

let sourceCode = await readFile(source, 'utf8');
if (!sourceCode.trim()) throw new Error('[worker-check] worker.js is empty. Deployment stopped.');

// The legacy Worker already defines these two user-notification handlers.
// Rename only the legacy source references before injecting the newer
// notification system so the generated ES module has no duplicate symbols.
sourceCode = sourceCode
  .replace(/\bmarkNotificationRead\b/g, 'legacyMarkNotificationRead')
  .replace(/\bmarkAllNotificationsRead\b/g, 'legacyMarkAllNotificationsRead');

const notificationFunctions = `

async function ensureNotificationsSchema(e) {
  await e.DB.batch([
    e.DB.prepare(\"CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY,title TEXT NOT NULL,message TEXT NOT NULL,type TEXT NOT NULL DEFAULT 'information',priority TEXT NOT NULL DEFAULT 'LOW',status TEXT NOT NULL DEFAULT 'DRAFT',created_by TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,published_at INTEGER,archived_at INTEGER)\"),
    e.DB.prepare(\"CREATE TABLE IF NOT EXISTS notification_recipients (notification_id TEXT NOT NULL,user_id TEXT NOT NULL,read_at INTEGER,created_at INTEGER NOT NULL,PRIMARY KEY(notification_id,user_id))\"),
    e.DB.prepare(\"CREATE TABLE IF NOT EXISTS notification_audit_logs (id TEXT PRIMARY KEY,notification_id TEXT NOT NULL,admin_id TEXT,action TEXT NOT NULL,metadata TEXT,created_at INTEGER NOT NULL)\"),
    e.DB.prepare(\"CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status,created_at DESC)\"),
    e.DB.prepare(\"CREATE INDEX IF NOT EXISTS idx_notification_recipients_user ON notification_recipients(user_id,read_at,created_at DESC)\"),
    e.DB.prepare(\"CREATE INDEX IF NOT EXISTS idx_notification_audit_notification ON notification_audit_logs(notification_id,created_at DESC)\")
  ]);
}

const notificationAllowed = (v, list, fallback) => list.includes(String(v || '').toUpperCase()) ? String(v).toUpperCase() : fallback;
const notificationType = (v) => ['information','success','warning','important','update','system'].includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : 'information';
const notificationPriority = (v) => notificationAllowed(v,['LOW','MEDIUM','HIGH','CRITICAL'],'LOW');
const notificationStatus = (v) => notificationAllowed(v,['DRAFT','ACTIVE','SENT','DISABLED','ARCHIVED'],'DRAFT');

async function notificationAudit(e, notificationId, adminId, action, metadata = {}) {
  await e.DB.prepare('INSERT INTO notification_audit_logs (id,notification_id,admin_id,action,metadata,created_at) VALUES (?1,?2,?3,?4,?5,?6)').bind(uuid(),notificationId,adminId,action,JSON.stringify(metadata),Math.floor(Date.now()/1000)).run();
}

async function notificationRecipients(e, notificationId, audience, userIds = []) {
  const mode = String(audience || 'all').toLowerCase();
  let rows = [];
  if (mode === 'specific') {
    const ids = [...new Set((Array.isArray(userIds) ? userIds : []).map(clean).filter(Boolean))].slice(0,5000);
    if (ids.length) {
      const placeholders = ids.map((_,i)=>'?' + (i+1)).join(',');
      const result = await e.DB.prepare('SELECT id FROM users WHERE id IN (' + placeholders + ')').bind(...ids).all();
      rows = result?.results || [];
    }
  } else if (mode === 'active') {
    const now = Math.floor(Date.now()/1000);
    const result = await e.DB.prepare('SELECT DISTINCT u.id FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.expires_at>?1').bind(now).all();
    rows = result?.results || [];
  } else {
    const result = await e.DB.prepare('SELECT id FROM users').all();
    rows = result?.results || [];
  }
  const now = Math.floor(Date.now()/1000);
  if (rows.length) await e.DB.batch(rows.map(x=>e.DB.prepare('INSERT OR IGNORE INTO notification_recipients (notification_id,user_id,read_at,created_at) VALUES (?1,?2,NULL,?3)').bind(notificationId,x.id,now)));
  return rows.length;
}

async function getAdminNotifications(r,e) {
  const admin = await isAdmin(r,e);
  if (!admin) return json({error:'Forbidden'},403,cors(r));
  await ensureNotificationsSchema(e);
  const u = new URL(r.url);
  const page = Math.max(1,Math.floor(Number(u.searchParams.get('page'))||1));
  const limit = Math.min(100,Math.max(1,Math.floor(Number(u.searchParams.get('limit'))||25)));
  const q = clean(u.searchParams.get('q'));
  const type = clean(u.searchParams.get('type')).toLowerCase();
  const status = clean(u.searchParams.get('status')).toUpperCase();
  const where=[]; const args=[];
  if(q){where.push('(n.title LIKE ? OR n.message LIKE ? OR n.type LIKE ?)');const v='%'+q+'%';args.push(v,v,v)}
  if(type){where.push('n.type=?');args.push(type)}
  if(status){where.push('n.status=?');args.push(status)}
  const w=where.length?' WHERE '+where.join(' AND '):'';
  const total=await e.DB.prepare('SELECT COUNT(*) total FROM notifications n'+w).bind(...args).first();
  const stats=await e.DB.batch([
    e.DB.prepare(\"SELECT COUNT(*) total FROM notifications WHERE status='ACTIVE'\"),
    e.DB.prepare(\"SELECT COUNT(*) total FROM notifications WHERE status='DRAFT'\"),
    e.DB.prepare(\"SELECT COUNT(*) total FROM notifications WHERE status='SENT'\"),
    e.DB.prepare(\"SELECT COUNT(*) total FROM notifications WHERE status='ARCHIVED'\"),
    e.DB.prepare('SELECT COUNT(*) total FROM notification_recipients WHERE read_at IS NULL'),
    e.DB.prepare('SELECT COUNT(*) total FROM notification_recipients WHERE read_at IS NOT NULL')
  ]);
  const offset=(page-1)*limit;
  const rows=await e.DB.prepare('SELECT n.id,n.title,n.message,n.type,n.priority,n.status,n.created_by,n.created_at,n.updated_at,n.published_at,n.archived_at,COUNT(r.user_id) recipients,SUM(CASE WHEN r.read_at IS NOT NULL THEN 1 ELSE 0 END) read_count,SUM(CASE WHEN r.read_at IS NULL THEN 1 ELSE 0 END) unread_count,u.username created_by_username,u.email created_by_email FROM notifications n LEFT JOIN notification_recipients r ON r.notification_id=n.id LEFT JOIN users u ON u.id=n.created_by'+w+' GROUP BY n.id ORDER BY n.created_at DESC LIMIT ? OFFSET ?').bind(...args,limit,offset).all();
  const s=stats.map(x=>Number(x?.results?.[0]?.total||0));
  return json({page,limit,total:Number(total?.total||0),active:s[0],drafts:s[1],sent:s[2],archived:s[3],unread:s[4],read:s[5],notifications:rows?.results||[]},200,cors(r));
}

async function getAdminNotification(r,e,id) {
  const admin=await isAdmin(r,e); if(!admin)return json({error:'Forbidden'},403,cors(r));
  await ensureNotificationsSchema(e);
  const n=await e.DB.prepare('SELECT * FROM notifications WHERE id=?1 LIMIT 1').bind(id).first();
  if(!n)return json({error:'Notification not found.'},404,cors(r));
  const recipients=await e.DB.prepare('SELECT r.user_id,r.read_at,r.created_at,u.username,u.email FROM notification_recipients r LEFT JOIN users u ON u.id=r.user_id WHERE r.notification_id=?1 ORDER BY r.created_at DESC').bind(id).all();
  const audit=await e.DB.prepare('SELECT a.*,u.username,u.email FROM notification_audit_logs a LEFT JOIN users u ON u.id=a.admin_id WHERE a.notification_id=?1 ORDER BY a.created_at DESC').bind(id).all();
  return json({notification:n,recipients:recipients?.results||[],audit:audit?.results||[]},200,cors(r));
}

async function createAdminNotification(r,e) {
  const admin=await isAdmin(r,e); if(!admin)return json({error:'Forbidden'},403,cors(r));
  await ensureNotificationsSchema(e);
  const d=await body(r);
  const title=clean(d?.title).slice(0,160); const message=clean(d?.message ?? d?.body).slice(0,5000);
  if(!title||!message)return json({error:'Title and message are required.'},400,cors(r));
  const type=notificationType(d?.type); const priority=notificationPriority(d?.priority);
  const audience=clean(d?.audience||d?.recipient_type||'all').toLowerCase();
  const id=uuid(); const now=Math.floor(Date.now()/1000);
  let status='DRAFT'; let publishedAt=null;
  if(d?.publish_immediately===true){status='SENT';publishedAt=now}else if(d?.scheduled_at){status='ACTIVE';publishedAt=Math.max(now,Math.floor(new Date(d.scheduled_at).getTime()/1000))}
  await e.DB.prepare('INSERT INTO notifications (id,title,message,type,priority,status,created_by,created_at,updated_at,published_at,archived_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?8,?9,NULL)').bind(id,title,message,type,priority,status,admin.id,now,publishedAt).run();
  if(status!=='DRAFT') await notificationRecipients(e,id,audience,d?.user_ids);
  await notificationAudit(e,id,admin.id,status==='DRAFT'?'CREATED':'PUBLISHED',{audience,priority,type});
  return json({success:true,id,status},201,cors(r));
}

async function updateAdminNotification(r,e,id) {
  const admin=await isAdmin(r,e); if(!admin)return json({error:'Forbidden'},403,cors(r));
  await ensureNotificationsSchema(e);
  const n=await e.DB.prepare('SELECT * FROM notifications WHERE id=?1 LIMIT 1').bind(id).first();
  if(!n)return json({error:'Notification not found.'},404,cors(r));
  if(['SENT','ARCHIVED'].includes(String(n.status))) return json({error:'Sent or archived notifications cannot be silently edited. Duplicate it to create a new revision.'},409,cors(r));
  const d=await body(r); const sets=[]; const args=[];
  if(d?.title!==undefined){const v=clean(d.title).slice(0,160);if(!v)return json({error:'Title is required.'},400,cors(r));sets.push('title=?');args.push(v)}
  if(d?.message!==undefined){const v=clean(d.message).slice(0,5000);if(!v)return json({error:'Message is required.'},400,cors(r));sets.push('message=?');args.push(v)}
  if(d?.type!==undefined){sets.push('type=?');args.push(notificationType(d.type))}
  if(d?.priority!==undefined){sets.push('priority=?');args.push(notificationPriority(d.priority))}
  if(!sets.length)return json({error:'No changes supplied.'},400,cors(r));
  sets.push('updated_at=?');args.push(Math.floor(Date.now()/1000));args.push(id);
  await e.DB.prepare('UPDATE notifications SET '+sets.join(',')+' WHERE id=?').bind(...args).run();
  await notificationAudit(e,id,admin.id,'EDITED',{fields:sets.filter(x=>!x.startsWith('updated_at'))});
  return json({success:true},200,cors(r));
}

async function publishAdminNotification(r,e,id) {
  const admin=await isAdmin(r,e); if(!admin)return json({error:'Forbidden'},403,cors(r));
  await ensureNotificationsSchema(e); const n=await e.DB.prepare('SELECT * FROM notifications WHERE id=?1 LIMIT 1').bind(id).first();
  if(!n)return json({error:'Notification not found.'},404,cors(r)); if(n.status==='ARCHIVED'||n.status==='SENT')return json({error:'Notification is already archived or sent.'},409,cors(r));
  const d=await body(r); const audience=clean(d?.audience||'all').toLowerCase(); const count=await notificationRecipients(e,id,audience,d?.user_ids);
  if(!count)return json({error:'No recipients selected.'},400,cors(r));
  const now=Math.floor(Date.now()/1000); await e.DB.prepare(\"UPDATE notifications SET status='SENT',published_at=?1,updated_at=?1 WHERE id=?2\").bind(now,id).run();
  await notificationAudit(e,id,admin.id,'PUBLISHED',{recipients:count,audience}); return json({success:true,recipients:count,status:'SENT'},200,cors(r));
}

async function disableAdminNotification(r,e,id) { const admin=await isAdmin(r,e);if(!admin)return json({error:'Forbidden'},403,cors(r));await ensureNotificationsSchema(e);const n=await e.DB.prepare('SELECT id,status FROM notifications WHERE id=?1').bind(id).first();if(!n)return json({error:'Notification not found.'},404,cors(r));await e.DB.prepare(\"UPDATE notifications SET status='DISABLED',updated_at=?1 WHERE id=?2\").bind(Math.floor(Date.now()/1000),id).run();await notificationAudit(e,id,admin.id,'DISABLED');return json({success:true},200,cors(r)); }
async function archiveAdminNotification(r,e,id) { const admin=await isAdmin(r,e);if(!admin)return json({error:'Forbidden'},403,cors(r));await ensureNotificationsSchema(e);const now=Math.floor(Date.now()/1000);const n=await e.DB.prepare('SELECT id FROM notifications WHERE id=?1').bind(id).first();if(!n)return json({error:'Notification not found.'},404,cors(r));await e.DB.prepare(\"UPDATE notifications SET status='ARCHIVED',archived_at=?1,updated_at=?1 WHERE id=?2\").bind(now,id).run();await notificationAudit(e,id,admin.id,'ARCHIVED');return json({success:true},200,cors(r)); }
async function deleteAdminNotification(r,e,id) { const admin=await isAdmin(r,e);if(!admin)return json({error:'Forbidden'},403,cors(r));await ensureNotificationsSchema(e);const n=await e.DB.prepare('SELECT id FROM notifications WHERE id=?1').bind(id).first();if(!n)return json({error:'Notification not found.'},404,cors(r));await e.DB.batch([e.DB.prepare('DELETE FROM notification_recipients WHERE notification_id=?1').bind(id),e.DB.prepare('DELETE FROM notification_audit_logs WHERE notification_id=?1').bind(id),e.DB.prepare('DELETE FROM notifications WHERE id=?1').bind(id)]);return json({success:true},200,cors(r)); }
async function duplicateAdminNotification(r,e,id) { const admin=await isAdmin(r,e);if(!admin)return json({error:'Forbidden'},403,cors(r));await ensureNotificationsSchema(e);const n=await e.DB.prepare('SELECT * FROM notifications WHERE id=?1').bind(id).first();if(!n)return json({error:'Notification not found.'},404,cors(r));const now=Math.floor(Date.now()/1000),newId=uuid();await e.DB.prepare(\"INSERT INTO notifications (id,title,message,type,priority,status,created_by,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,'DRAFT',?6,?7,?7)\").bind(newId,n.title,n.message,n.type,n.priority,admin.id,now).run();await notificationAudit(e,newId,admin.id,'DUPLICATED',{source_notification_id:id});return json({success:true,id:newId,status:'DRAFT'},201,cors(r)); }

async function userNotifications(r,e) { const user=await currentUser(r,e);if(!user)return json({error:'Unauthorized'},401,cors(r));await ensureNotificationsSchema(e);const u=new URL(r.url),page=Math.max(1,Math.floor(Number(u.searchParams.get('page'))||1)),limit=Math.min(50,Math.max(1,Math.floor(Number(u.searchParams.get('limit'))||20))),offset=(page-1)*limit;const rows=await e.DB.prepare(\"SELECT n.id,n.title,n.message,n.type,n.priority,n.published_at,n.created_at,r.read_at FROM notification_recipients r JOIN notifications n ON n.id=r.notification_id WHERE r.user_id=?1 AND n.status IN ('ACTIVE','SENT') ORDER BY COALESCE(n.published_at,n.created_at) DESC LIMIT ?2 OFFSET ?3\").bind(user.id,limit,offset).all();const unread=await e.DB.prepare(\"SELECT COUNT(*) total FROM notification_recipients r JOIN notifications n ON n.id=r.notification_id WHERE r.user_id=?1 AND r.read_at IS NULL AND n.status IN ('ACTIVE','SENT')\").bind(user.id).first();return json({page,limit,unread:Number(unread?.total||0),notifications:rows?.results||[]},200,cors(r)); }
async function markNotificationRead(r,e,id) { const user=await currentUser(r,e);if(!user)return json({error:'Unauthorized'},401,cors(r));await ensureNotificationsSchema(e);const now=Math.floor(Date.now()/1000);const result=await e.DB.prepare('UPDATE notification_recipients SET read_at=?1 WHERE notification_id=?2 AND user_id=?3 AND read_at IS NULL').bind(now,id,user.id).run();return json({success:true,read:!!result?.meta?.changes},200,cors(r)); }
async function markAllNotificationsRead(r,e) { const user=await currentUser(r,e);if(!user)return json({error:'Unauthorized'},401,cors(r));await ensureNotificationsSchema(e);const now=Math.floor(Date.now()/1000);await e.DB.prepare(\"UPDATE notification_recipients SET read_at=?1 WHERE user_id=?2 AND read_at IS NULL\").bind(now,user.id).run();return json({success:true},200,cors(r)); }
async function unreadNotifications(r,e) { const user=await currentUser(r,e);if(!user)return json({error:'Unauthorized'},401,cors(r));await ensureNotificationsSchema(e);const rows=await e.DB.prepare(\"SELECT n.id,n.title,n.message,n.type,n.priority,n.published_at,n.created_at,r.read_at FROM notification_recipients r JOIN notifications n ON n.id=r.notification_id WHERE r.user_id=?1 AND r.read_at IS NULL AND n.status IN ('ACTIVE','SENT') ORDER BY COALESCE(n.published_at,n.created_at) DESC LIMIT 50\").bind(user.id).all();return json({notifications:rows?.results||[],unread:rows?.results?.length||0},200,cors(r)); }
`;

if (!sourceCode.includes('async function ensureNotificationsSchema(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(sourceCode)) throw new Error('[worker-check] Worker structure changed: enhanceHTML function not found. Deployment stopped.');
  sourceCode = sourceCode.replace(marker, notificationFunctions + '\n$&', 1);
}

const notificationRoutes = `
  const __notificationsUrl = new URL(r.url);
  if (__notificationsUrl.pathname === '/api/admin/notifications' && r.method === 'GET') return getAdminNotifications(r,e);
  if (__notificationsUrl.pathname === '/api/admin/notifications' && r.method === 'POST') return createAdminNotification(r,e);
  if (__notificationsUrl.pathname.startsWith('/api/admin/notifications/')) {
    const __parts = __notificationsUrl.pathname.split('/').filter(Boolean);
    const __id = clean(__parts[__parts.length-1]);
    const __action = __parts[__parts.length-1];
    const __base = __parts.length === 4;
    if (__base && r.method === 'GET') return getAdminNotification(r,e,__id);
    if (__base && r.method === 'PUT') return updateAdminNotification(r,e,__id);
    if (__base && r.method === 'DELETE') return deleteAdminNotification(r,e,__id);
    if (__action === 'publish' && r.method === 'POST') return publishAdminNotification(r,e,__parts[__parts.length-2]);
    if (__action === 'disable' && r.method === 'POST') return disableAdminNotification(r,e,__parts[__parts.length-2]);
    if (__action === 'archive' && r.method === 'POST') return archiveAdminNotification(r,e,__parts[__parts.length-2]);
    if (__action === 'duplicate' && r.method === 'POST') return duplicateAdminNotification(r,e,__parts[__parts.length-2]);
  }
  if (__notificationsUrl.pathname === '/api/notifications' && r.method === 'GET') return userNotifications(r,e);
  if (__notificationsUrl.pathname === '/api/notifications/unread' && r.method === 'GET') return unreadNotifications(r,e);
  if (__notificationsUrl.pathname === '/api/notifications/read-all' && r.method === 'POST') return markAllNotificationsRead(r,e);
  if (__notificationsUrl.pathname.startsWith('/api/notifications/') && r.method === 'POST') return markNotificationRead(r,e,clean(__notificationsUrl.pathname.split('/').pop()));
`;

if (!sourceCode.includes('const __notificationsUrl')) {
  const fetchMarker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!fetchMarker.test(sourceCode)) throw new Error('[worker-check] Worker fetch marker not found. Deployment stopped.');
  sourceCode = sourceCode.replace(fetchMarker, '$&' + notificationRoutes + '\n', 1);
}

await mkdir(outputDir, { recursive: true });
await writeFile(output, sourceCode, 'utf8');

execFileSync(process.execPath, [new URL('./extend-admin-users.mjs', import.meta.url).pathname], { stdio: 'inherit' });
execFileSync(process.execPath, [new URL('./protect-admin-user.mjs', import.meta.url).pathname], { stdio: 'inherit' });
execFileSync(process.execPath, [new URL('./extend-blocked-users.mjs', import.meta.url).pathname], { stdio: 'inherit' });

try {
  execFileSync(process.execPath, ['--check', output.pathname], { stdio: 'inherit' });
} catch {
  throw new Error('[worker-check] Generated worker failed JavaScript syntax validation. Deployment stopped.');
}

console.log('[worker-check] Source inspected.');
console.log('[worker-check] Complete internal notifications API included once in deployment artifact.');
console.log('[worker-check] Admin Users extension included once in deployment artifact.');
console.log('[worker-check] Administrator self-edit protection included.');
console.log('[worker-check] Blocked Users extension included once in deployment artifact.');
console.log('[worker-check] Existing Worker source/routes preserved.');
console.log('[worker-check] JavaScript syntax check passed.');
console.log(`[worker-check] Deploy artifact: ${output.pathname}`);
