import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const output = new URL('../.worker-build/worker.js', import.meta.url);
let source = await readFile(output, 'utf8');

const functions = `

async function ensureAdminUserState(e) {
  await e.DB.prepare('CREATE TABLE IF NOT EXISTS admin_user_blocks (user_id TEXT PRIMARY KEY, blocked_at INTEGER NOT NULL)').run();
  const cols = await e.DB.prepare('PRAGMA table_info(admin_user_blocks)').all();
  if (!(cols.results || []).some(c => c.name === 'blocked_until')) {
    await e.DB.prepare('ALTER TABLE admin_user_blocks ADD COLUMN blocked_until INTEGER').run();
  }
}

async function adminUserEdit(r, e) {
  const admin = await isAdmin(r, e);
  if (!admin) return json({ error: 'Forbidden' }, 403, cors(r));
  await ensureAdminUserState(e);
  const id = clean(new URL(r.url).pathname.split('/').slice(-2, -1)[0]);
  if (!id) return json({ error: 'User id required.' }, 400, cors(r));
  const user = await e.DB.prepare('SELECT id,email,username FROM users WHERE id=?1 LIMIT 1').bind(id).first();
  if (!user) return json({ error: 'User not found.' }, 404, cors(r));
  const d = await body(r);
  const username = d?.username === undefined ? user.username : clean(d.username).slice(0, 80);
  const xp = d?.xp === undefined ? null : Math.max(0, Math.floor(Number(d.xp) || 0));
  const level = d?.level === undefined ? null : Math.max(1, Math.floor(Number(d.level) || 1));
  if (!username || username.length < 2) return json({ error: 'Username must contain at least 2 characters.' }, 400, cors(r));
  if (xp === null && level === null) return json({ error: 'No changes supplied.' }, 400, cors(r));
  const editNow = Math.floor(Date.now() / 1000);
  const statements = [e.DB.prepare('UPDATE users SET username=?1,updated_at=?2 WHERE id=?3').bind(username, editNow, id)];
  if (xp !== null || level !== null) {
    const current = await e.DB.prepare('SELECT xp,level FROM user_progress WHERE user_id=?1 LIMIT 1').bind(id).first();
    statements.push(e.DB.prepare('INSERT INTO user_progress (user_id,xp,level,updated_at) VALUES (?1,?2,?3,?4) ON CONFLICT(user_id) DO UPDATE SET xp=excluded.xp,level=excluded.level,updated_at=excluded.updated_at').bind(id, xp === null ? Number(current?.xp || 0) : xp, level === null ? Number(current?.level || 1) : level, editNow));
  }
  await e.DB.batch(statements);
  return json({ success: true, message: 'User updated successfully.' }, 200, cors(r));
}

async function adminUserBlock(r, e) {
  const admin = await isAdmin(r, e);
  if (!admin) return json({ error: 'Forbidden' }, 403, cors(r));
  await ensureAdminUserState(e);
  const id = clean(new URL(r.url).pathname.split('/').slice(-2, -1)[0]);
  if (!id) return json({ error: 'User id required.' }, 400, cors(r));
  if (String(admin.id) === String(id)) return json({ error: 'You cannot block your own administrator account.' }, 400, cors(r));
  const user = await e.DB.prepare('SELECT id FROM users WHERE id=?1 LIMIT 1').bind(id).first();
  if (!user) return json({ error: 'User not found.' }, 404, cors(r));
  const d = await body(r);
  const duration = Math.floor(Number(d?.duration_seconds));
  if (!Number.isFinite(duration) || duration < 60 || duration > 31536000) return json({ error: 'Invalid block duration. Choose between 1 minute and 365 days.' }, 400, cors(r));
  const blockNow = Math.floor(Date.now() / 1000);
  const until = blockNow + duration;
  await e.DB.prepare('INSERT INTO admin_user_blocks (user_id,blocked_at,blocked_until) VALUES (?1,?2,?3) ON CONFLICT(user_id) DO UPDATE SET blocked_at=excluded.blocked_at,blocked_until=excluded.blocked_until').bind(id, blockNow, until).run();
  await e.DB.prepare('DELETE FROM sessions WHERE user_id=?1').bind(id).run();
  return json({ success: true, blocked: true, blocked_until: until, message: 'User temporarily blocked and all sessions revoked.' }, 200, cors(r));
}

async function adminUserUnblock(r, e) {
  const admin = await isAdmin(r, e);
  if (!admin) return json({ error: 'Forbidden' }, 403, cors(r));
  await ensureAdminUserState(e);
  const id = clean(new URL(r.url).pathname.split('/').slice(-2, -1)[0]);
  if (!id) return json({ error: 'User id required.' }, 400, cors(r));
  await e.DB.prepare('DELETE FROM admin_user_blocks WHERE user_id=?1').bind(id).run();
  return json({ success: true, blocked: false, message: 'User unblocked successfully.' }, 200, cors(r));
}

async function adminUserDelete(r, e) {
  const admin = await isAdmin(r, e);
  if (!admin) return json({ error: 'Forbidden' }, 403, cors(r));
  await ensureAdminUserState(e);
  const id = clean(new URL(r.url).pathname.split('/').slice(-2, -1)[0]);
  if (!id) return json({ error: 'User id required.' }, 400, cors(r));
  if (String(admin.id) === String(id)) return json({ error: 'You cannot permanently delete your own administrator account.' }, 400, cors(r));
  const user = await e.DB.prepare('SELECT id FROM users WHERE id=?1 LIMIT 1').bind(id).first();
  if (!user) return json({ error: 'User not found.' }, 404, cors(r));
  const tables = await e.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  const statements = [];
  for (const row of (tables.results || [])) {
    const table = String(row.name || '');
    if (!table || table === 'users') continue;
    const columns = await e.DB.prepare('PRAGMA table_info("' + table.replace(/"/g, '""') + '")').all();
    if ((columns.results || []).some(c => c.name === 'user_id')) statements.push(e.DB.prepare('DELETE FROM "' + table.replace(/"/g, '""') + '" WHERE user_id=?1').bind(id));
  }
  statements.push(e.DB.prepare('DELETE FROM users WHERE id=?1').bind(id));
  await e.DB.batch(statements);
  return json({ success: true, deleted: true, message: 'User permanently deleted.' }, 200, cors(r));
}
`;

if (!source.includes('async function ensureAdminUserState(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(source)) throw new Error('[worker-check] enhanceHTML marker missing.');
  source = source.replace(marker, functions + '\n$&', 1);
}

const routes = `
      {
        const __adminUsersUrl = new URL(r.url);
        if (__adminUsersUrl.pathname.startsWith('/api/admin/users/')) {
          if (__adminUsersUrl.pathname.endsWith('/edit') && r.method === 'PUT') return adminUserEdit(r, e);
          if (__adminUsersUrl.pathname.endsWith('/block') && r.method === 'POST') return adminUserBlock(r, e);
          if (__adminUsersUrl.pathname.endsWith('/unblock') && r.method === 'POST') return adminUserUnblock(r, e);
          if (__adminUsersUrl.pathname.endsWith('/delete') && r.method === 'DELETE') return adminUserDelete(r, e);
        }
      }
`;
if (!source.includes('__adminUsersUrl')) {
  const fetchStart = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{/;
  if (!fetchStart.test(source)) throw new Error('[worker-check] fetch(r, e) marker missing.');
  source = source.replace(fetchStart, '$&\n' + routes, 1);
}

if (!source.includes('admin_user_blocks')) throw new Error('[worker-check] Admin user state injection failed.');

const loginMarker = /async\s+function\s+login\(r,\s*e\)\s*\{\n/;
if (!source.includes('const blocked = u ? await e.DB.prepare')) {
  if (!loginMarker.test(source)) throw new Error('[worker-check] login marker missing.');
  source = source.replace(loginMarker, 'async function login(r, e) {\n  await ensureAdminUserState(e);\n', 1);
  const userQuery = /const u = await e\.DB\s*\.prepare\(\s*'SELECT id,email,username,password_hash FROM users ' \+\s*'WHERE email=\?1 LIMIT 1',\s*\)\s*\.bind\(email\)\s*\.first\(\);/;
  if (!userQuery.test(source)) throw new Error('[worker-check] login user query marker missing.');
  source = source.replace(userQuery, `$&\n\n  const loginNow = Math.floor(Date.now() / 1000);\n  const blocked = u ? await e.DB.prepare('SELECT 1 AS blocked FROM admin_user_blocks WHERE user_id=?1 AND (blocked_until IS NULL OR blocked_until>?2) LIMIT 1').bind(u.id, loginNow).first() : null;\n  if (u) await e.DB.prepare('DELETE FROM admin_user_blocks WHERE user_id=?1 AND blocked_until IS NOT NULL AND blocked_until<=?2').bind(u.id, loginNow).run();`, 1);
  source = source.replace(/if \(!u \|\| !\(await passwordVerify\(password, u\.password_hash\)\)\) \{/, `if (!u || blocked || !(await passwordVerify(password, u.password_hash))) {`, 1);
}

const detailQuery = "SELECT id,email,username,created_at,updated_at FROM users WHERE id=?1 LIMIT 1";
if (source.includes(detailQuery) && !source.includes("AS blocked FROM users WHERE id=?1 LIMIT 1")) source = source.replace(detailQuery, "SELECT id,email,username,created_at,updated_at,(SELECT 1 FROM admin_user_blocks b WHERE b.user_id=users.id AND (b.blocked_until IS NULL OR b.blocked_until>strftime('%s','now')) LIMIT 1) AS blocked FROM users WHERE id=?1 LIMIT 1", 1);

const assetRoute = `
      if (u.pathname === '/admin/users/' && r.method === 'GET') {
        const asset = await e.ASSETS.fetch(r);
        const injected = new HTMLRewriter().on('body', { element(el) { el.append('<script src="/admin/users/actions.js?v=1" defer></script>', { html: true }); } }).transform(asset);
        return enhanceHTML(injected, r);
      }
`;
if (!source.includes('/admin/users/actions.js?v=1')) {
  const fetchMarker = /\n    try \{/;
  if (!fetchMarker.test(source)) throw new Error('[worker-check] fetch marker missing.');
  source = source.replace(fetchMarker, '\n' + assetRoute + '\n    try {', 1);
}

await writeFile(output, source, 'utf8');
execFileSync(process.execPath, ['--check', output.pathname], { stdio: 'inherit' });
console.log('[worker-check] Admin Users edit/block/unblock/delete extensions applied.');
