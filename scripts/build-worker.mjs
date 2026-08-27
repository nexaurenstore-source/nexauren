import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const source = new URL('../worker.js', import.meta.url);
const outputDir = new URL('../.worker-build/', import.meta.url);
const output = new URL('../.worker-build/worker.js', import.meta.url);

let sourceCode = await readFile(source, 'utf8');

if (!sourceCode.trim()) {
  throw new Error('[worker-check] worker.js is empty. Deployment stopped.');
}

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
  if (q) {
    const value = '%' + q + '%';
    conditions.push('(n.title LIKE ? OR n.body LIKE ? OR n.type LIKE ?)');
    args.push(value, value, value);
  }
  if (type) {
    conditions.push('n.type = ?');
    args.push(type);
  }
  const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
  const total = await e.DB.prepare('SELECT COUNT(*) AS total FROM notifications n' + where).bind(...args).first();
  const unread = await e.DB.prepare('SELECT COUNT(*) AS total FROM notifications WHERE read_at IS NULL').first();
  const announcements = await e.DB.prepare("SELECT COUNT(*) AS total FROM notifications WHERE type='announcement'").first();
  const rows = await e.DB.prepare(
    'SELECT n.id,n.user_id,n.type,n.title,n.body,n.url,n.icon,n.read_at,n.created_at,u.username,u.email ' +
    'FROM notifications n LEFT JOIN users u ON u.id=n.user_id' + where +
    ' ORDER BY n.created_at DESC LIMIT ? OFFSET ?'
  ).bind(...args, limit, offset).all();
  return json({ page, limit, total: Number(total?.total || 0), unread: Number(unread?.total || 0), announcements: Number(announcements?.total || 0), notifications: rows?.results || [] }, 200, cors(r));
}

async function adminNotificationUpdate(r, e) {
  if (!await isAdmin(r, e)) return json({ error: 'Forbidden' }, 403, cors(r));
  const id = clean(new URL(r.url).pathname.split('/').pop());
  if (!id) return json({ error: 'Notification id required.' }, 400, cors(r));
  const d = await body(r);
  const sets = [];
  const args = [];
  if (d?.type !== undefined) { sets.push('type=?'); args.push(clean(d.type).slice(0, 80)); }
  if (d?.title !== undefined) { sets.push('title=?'); args.push(clean(d.title).slice(0, 160)); }
  if (d?.body !== undefined) { sets.push('body=?'); args.push(clean(d.body).slice(0, 2000)); }
  if (d?.url !== undefined) { sets.push('url=?'); args.push(clean(d.url).slice(0, 500)); }
  if (d?.icon !== undefined) { sets.push('icon=?'); args.push(clean(d.icon).slice(0, 40)); }
  if (d?.read_at !== undefined) { sets.push('read_at=?'); args.push(d.read_at === null ? null : clean(d.read_at)); }
  if (!sets.length) return json({ error: 'No fields to update.' }, 400, cors(r));
  args.push(id);
  await e.DB.prepare('UPDATE notifications SET ' + sets.join(',') + ' WHERE id=?').bind(...args).run();
  return json({ success: true }, 200, cors(r));
}

async function adminNotificationDelete(r, e) {
  if (!await isAdmin(r, e)) return json({ error: 'Forbidden' }, 403, cors(r));
  const id = clean(new URL(r.url).pathname.split('/').pop());
  if (!id) return json({ error: 'Notification id required.' }, 400, cors(r));
  await e.DB.prepare('DELETE FROM notifications WHERE id=?').bind(id).run();
  return json({ success: true }, 200, cors(r));
}
`;

if (!sourceCode.includes('async function adminNotifications(')) {
  // Match enhanceHTML regardless of spacing or line breaks so harmless
  // formatting changes in worker.js do not break deployments.
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(sourceCode)) {
    throw new Error('[worker-check] Worker structure changed: enhanceHTML function not found. Deployment stopped.');
  }
  sourceCode = sourceCode.replace(marker, notificationFunctions + '\n$&', 1);
}

if (!sourceCode.includes("u.pathname === '/api/admin/notifications'")) {
  const routeBlock = `
  if (u.pathname === '/api/admin/notifications' && r.method === 'GET') return adminNotifications(r, e);
  if (u.pathname.startsWith('/api/admin/notifications/') && r.method === 'PUT') return adminNotificationUpdate(r, e);
  if (u.pathname.startsWith('/api/admin/notifications/') && r.method === 'DELETE') return adminNotificationDelete(r, e);
`;

  // Insert immediately before the existing HTML response fallback. This is
  // intentionally pattern-based so unrelated Admin routes do not need to be
  // rewritten or have a hard-coded Tools signature.
  const fallbackPattern = /\breturn\s+(?:await\s+)?enhanceHTML\s*\([^;]*\)\s*;/;
  if (!fallbackPattern.test(sourceCode)) {
    throw new Error('[worker-check] Worker structure changed: enhanceHTML response fallback not found. Deployment stopped.');
  }
  sourceCode = sourceCode.replace(fallbackPattern, routeBlock + '\n  $&', 1);
}

await mkdir(outputDir, { recursive: true });
await writeFile(output, sourceCode, 'utf8');

try {
  execFileSync(process.execPath, ['--check', output.pathname], { stdio: 'inherit' });
} catch {
  throw new Error('[worker-check] Generated worker failed JavaScript syntax validation. Deployment stopped.');
}

console.log('[worker-check] Source inspected.');
console.log('[worker-check] Admin Notifications API added to deployment artifact.');
console.log('[worker-check] Existing Worker source/routes preserved.');
console.log('[worker-check] JavaScript syntax check passed.');
console.log(`[worker-check] Deploy artifact: ${output.pathname}`);
