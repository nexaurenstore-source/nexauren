import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const source = new URL('../worker.js', import.meta.url);
const outputDir = new URL('../.worker-build/', import.meta.url);
const output = new URL('../.worker-build/worker.js', import.meta.url);

let sourceCode = await readFile(source, 'utf8');

if (!sourceCode.trim()) throw new Error('[worker-check] worker.js is empty. Deployment stopped.');

const notificationFunctions = `

async function adminNotifications(r, e) {
  if (!await isAdmin(r, e)) return json({ error: 'Forbidden' }, 403, cors(r));
  const u = new URL(r.url);
  const page = Math.max(1, Number(u.searchParams.get('page')) || 1);
  const limit = Math.max(1, Math.min(100, Number(u.searchParams.get('limit')) || 25));
  const offset = (page - 1) * limit;
  const q = clean(u.searchParams.get('q'));
  const type = clean(u.searchParams.get('type'));
  const conditions = [];
  const args = [];
  if (q) { const value = '%' + q + '%'; conditions.push('(n.title LIKE ? OR n.body LIKE ? OR n.type LIKE ?)'); args.push(value, value, value); }
  if (type) { conditions.push('n.type = ?'); args.push(type); }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const total = await e.DB.prepare('SELECT COUNT(*) AS total FROM notifications n' + where).bind(...args).first();
  const unread = await e.DB.prepare('SELECT COUNT(*) AS total FROM notifications WHERE read_at IS NULL').first();
  const announcements = await e.DB.prepare("SELECT COUNT(*) AS total FROM notifications WHERE type='announcement'").first();
  const rows = await e.DB.prepare('SELECT n.id,n.user_id,n.type,n.title,n.body,n.url,n.icon,n.read_at,n.created_at,u.username,u.email FROM notifications n LEFT JOIN users u ON u.id=n.user_id' + where + ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?').bind(...args, limit, offset).all();
  return json({ page, limit, total: Number(total?.total || 0), unread: Number(unread?.total || 0), announcements: Number(announcements?.total || 0), notifications: rows?.results || [] }, 200, cors(r));
}

async function adminNotificationUpdate(r, e) {
  if (!await isAdmin(r, e)) return json({ error: 'Forbidden' }, 403, cors(r));
  const id = clean(new URL(r.url).pathname.split('/').pop());
  if (!id) return json({ error: 'Notification id required.' }, 400, cors(r));
  const d = await body(r); const sets = []; const args = [];
  if (d?.type !== undefined) { sets.push('type=?'); args.push(clean(d.type).slice(0,80)); }
  if (d?.title !== undefined) { sets.push('title=?'); args.push(clean(d.title).slice(0,160)); }
  if (d?.body !== undefined) { sets.push('body=?'); args.push(clean(d.body).slice(0,2000)); }
  if (d?.url !== undefined) { sets.push('url=?'); args.push(clean(d.url).slice(0,500)); }
  if (d?.icon !== undefined) { sets.push('icon=?'); args.push(clean(d.icon).slice(0,40)); }
  if (d?.read_at !== undefined) { sets.push('read_at=?'); args.push(d.read_at === null ? null : clean(d.read_at)); }
  if (!sets.length) return json({ error: 'No fields to update.' }, 400, cors(r));
  args.push(id); await e.DB.prepare('UPDATE notifications SET ' + sets.join(',') + ' WHERE id=?').bind(...args).run();
  return json({ success:true }, 200, cors(r));
}

async function adminNotificationDelete(r, e) {
  if (!await isAdmin(r, e)) return json({ error:'Forbidden' }, 403, cors(r));
  const id = clean(new URL(r.url).pathname.split('/').pop());
  if (!id) return json({ error:'Notification id required.' }, 400, cors(r));
  await e.DB.prepare('DELETE FROM notifications WHERE id=?').bind(id).run();
  return json({ success:true }, 200, cors(r));
}

async function adminUserDetails(r, e) {
  const admin = await isAdmin(r, e);
  if (!admin) return json({ error:'Forbidden' }, 403, cors(r));
  const parts = new URL(r.url).pathname.split('/').filter(Boolean);
  const detailsIndex = parts.lastIndexOf('details');
  const id = detailsIndex > 0 ? clean(parts[detailsIndex - 1]) : '';
  if (!id) return json({ error:'User id required.' }, 400, cors(r));
  const user = await e.DB.prepare('SELECT id,email,username,created_at,updated_at FROM users WHERE id=?1 LIMIT 1').bind(id).first();
  if (!user) return json({ error:'User not found.' }, 404, cors(r));
  const [progress, sessions] = await Promise.all([
    e.DB.prepare('SELECT xp,level,updated_at FROM user_progress WHERE user_id=?1 LIMIT 1').bind(id).first(),
    e.DB.prepare('SELECT COUNT(*) AS total,MAX(created_at) AS last_access FROM sessions WHERE user_id=?1 AND expires_at>?2').bind(id, Math.floor(Date.now()/1000)).first(),
  ]);
  return json({ user, progress:progress || {xp:0,level:1}, sessions:{active:Number(sessions?.total||0),last_access:sessions?.last_access||null} }, 200, cors(r));
}

async function adminUserRevokeSessions(r,e) {
  if(!await isAdmin(r,e))return json({error:'Forbidden'},403,cors(r));
  const id=clean(new URL(r.url).pathname.split('/').slice(-2,-1)[0]); if(!id)return json({error:'User id required.'},400,cors(r));
  const user=await e.DB.prepare('SELECT id,email,username FROM users WHERE id=?1 LIMIT 1').bind(id).first(); if(!user)return json({error:'User not found.'},404,cors(r));
  const admin=await isAdmin(r,e); if(admin&&String(admin.id)===String(id))return json({error:'You cannot revoke your own admin session.'},400,cors(r));
  await e.DB.prepare('DELETE FROM sessions WHERE user_id=?1').bind(id).run(); return json({success:true,message:'All sessions revoked.'},200,cors(r));
}

async function adminUserPasswordReset(r,e) {
  if(!await isAdmin(r,e))return json({error:'Forbidden'},403,cors(r));
  const id=clean(new URL(r.url).pathname.split('/').slice(-2,-1)[0]); if(!id)return json({error:'User id required.'},400,cors(r));
  const admin=await isAdmin(r,e); if(admin&&String(admin.id)===String(id))return json({error:'Use the normal password reset for your own account.'},400,cors(r));
  const user=await e.DB.prepare('SELECT id,email,username FROM users WHERE id=?1 LIMIT 1').bind(id).first(); if(!user)return json({error:'User not found.'},404,cors(r));
  if(typeof ensurePasswordResetSchema!=='function'||typeof sendPasswordResetEmail!=='function')return json({error:'Password reset service unavailable.'},503,cors(r));
  await ensurePasswordResetSchema(e); const now=Math.floor(Date.now()/1000); await e.DB.prepare('DELETE FROM password_reset_tokens WHERE user_id=?1 OR expires_at<=?2').bind(id,now).run();
  const token=crypto.randomUUID()+crypto.randomUUID(); const tokenHash=await sha256(token);
  await e.DB.prepare('INSERT INTO password_reset_tokens (id,user_id,token_hash,expires_at,created_at,used_at) VALUES (?1,?2,?3,?4,?5,NULL)').bind(uuid(),id,tokenHash,now+1800,now).run();
  try{await sendPasswordResetEmail(e,user.email,token)}catch(err){console.error('Admin password reset email failed',err);await e.DB.prepare('DELETE FROM password_reset_tokens WHERE token_hash=?1').bind(tokenHash).run();return json({error:'Unable to send the reset email right now.'},503,cors(r));}
  await e.DB.prepare('DELETE FROM sessions WHERE user_id=?1').bind(id).run(); return json({success:true,message:'Password reset email sent.'},200,cors(r));
}
`;

if (!sourceCode.includes('async function adminNotifications(')) {
  const marker=/async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if(!marker.test(sourceCode))throw new Error('[worker-check] Worker structure changed: enhanceHTML function not found. Deployment stopped.');
  sourceCode=sourceCode.replace(marker,notificationFunctions+'\n$&',1);
}

if(!sourceCode.includes("u.pathname === '/api/admin/notifications'")){
  const routeBlock=`\n  if (u.pathname === '/api/admin/notifications' && r.method === 'GET') return adminNotifications(r,e);\n  if (u.pathname.startsWith('/api/admin/notifications/') && r.method === 'PUT') return adminNotificationUpdate(r,e);\n  if (u.pathname.startsWith('/api/admin/notifications/') && r.method === 'DELETE') return adminNotificationDelete(r,e);\n`;
  const fallback=/\breturn\s+(?:await\s+)?enhanceHTML\s*\([^;]*\)\s*;/;
  if(!fallback.test(sourceCode))throw new Error('[worker-check] Worker structure changed: enhanceHTML response fallback not found. Deployment stopped.');
  sourceCode=sourceCode.replace(fallback,routeBlock+'\n  $&',1);
}

const userRouteBlock=`\n        if (u.pathname.startsWith('/api/admin/users/') && u.pathname.endsWith('/details') && r.method === 'GET') return adminUserDetails(r,e);\n        if (u.pathname.startsWith('/api/admin/users/') && u.pathname.endsWith('/revoke-sessions') && r.method === 'POST') return adminUserRevokeSessions(r,e);\n        if (u.pathname.startsWith('/api/admin/users/') && u.pathname.endsWith('/reset-password') && r.method === 'POST') return adminUserPasswordReset(r,e);\n`;
if(!sourceCode.includes("u.pathname.endsWith('/revoke-sessions')")){
  const fallback=/\s*return\s+json\(\s*\{\s*error:\s*'Admin route not found\.'\s*\},\s*404,\s*cors\(r\),\s*\);/;
  if(!fallback.test(sourceCode))throw new Error('[worker-check] Worker structure changed: Admin route fallback not found. Deployment stopped.');
  sourceCode=sourceCode.replace(fallback,userRouteBlock+'\n        $&',1);
}

await mkdir(outputDir,{recursive:true});
await writeFile(output,sourceCode,'utf8');

// The Users edit/block/unblock extension must run as part of every production
// build. Previously it existed as a separate script but was never invoked by
// the actual Wrangler build command, so the UI could expose actions whose API
// routes were absent from the deployed Worker.
execFileSync(process.execPath,[new URL('./extend-admin-users.mjs', import.meta.url).pathname],{stdio:'inherit'});

try{execFileSync(process.execPath,['--check',output.pathname],{stdio:'inherit'})}catch{throw new Error('[worker-check] Generated worker failed JavaScript syntax validation. Deployment stopped.')}
console.log('[worker-check] Source inspected.');
console.log('[worker-check] Admin Notifications and User Actions API added to deployment artifact.');
console.log('[worker-check] Admin Users edit/block/unblock extension included in deployment artifact.');
console.log('[worker-check] Existing Worker source/routes preserved.');
console.log('[worker-check] JavaScript syntax check passed.');
console.log(`[worker-check] Deploy artifact: ${output.pathname}`);