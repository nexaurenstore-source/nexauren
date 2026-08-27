import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const output = new URL('../.worker-build/worker.js', import.meta.url);
let source = await readFile(output, 'utf8');

const functions = `

async function ensureAdminUserState(e) {
  await e.DB.prepare('CREATE TABLE IF NOT EXISTS admin_user_blocks (user_id TEXT PRIMARY KEY, blocked_at INTEGER NOT NULL)').run();
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
  const now = Math.floor(Date.now() / 1000);
  const statements = [e.DB.prepare('UPDATE users SET username=?1,updated_at=?2 WHERE id=?3').bind(username, now, id)];
  if (xp !== null || level !== null) {
    const current = await e.DB.prepare('SELECT xp,level FROM user_progress WHERE user_id=?1 LIMIT 1').bind(id).first();
    statements.push(e.DB.prepare('INSERT INTO user_progress (user_id,xp,level,updated_at) VALUES (?1,?2,?3,?4) ON CONFLICT(user_id) DO UPDATE SET xp=excluded.xp,level=excluded.level,updated_at=excluded.updated_at').bind(id, xp === null ? Number(current?.xp || 0) : xp, level === null ? Number(current?.level || 1) : level, now));
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
  const now = Math.floor(Date.now() / 1000);
  await e.DB.prepare('INSERT INTO admin_user_blocks (user_id,blocked_at) VALUES (?1,?2) ON CONFLICT(user_id) DO UPDATE SET blocked_at=excluded.blocked_at').bind(id, now).run();
  await e.DB.prepare('DELETE FROM sessions WHERE user_id=?1').bind(id).run();
  return json({ success: true, blocked: true, message: 'User blocked and all sessions revoked.' }, 200, cors(r));
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
`;

if (!source.includes('async function ensureAdminUserState(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(source)) throw new Error('[worker-check] enhanceHTML marker missing.');
  source = source.replace(marker, functions + '\n$&', 1);
}

const routes = `
        if (u.pathname.startsWith('/api/admin/users/') && u.pathname.endsWith('/edit') && r.method === 'PUT') {
          return adminUserEdit(r, e);
        }
        if (u.pathname.startsWith('/api/admin/users/') && u.pathname.endsWith('/block') && r.method === 'POST') {
          return adminUserBlock(r, e);
        }
        if (u.pathname.startsWith('/api/admin/users/') && u.pathname.endsWith('/unblock') && r.method === 'POST') {
          return adminUserUnblock(r, e);
        }
`;
if (!source.includes("u.pathname.endsWith('/edit')")) {
  const fallback = /\s*return\s+json\(\s*\{\s*error:\s*'Admin route not found\.'\s*\},\s*404,\s*cors\(r\),\s*\);/;
  if (!fallback.test(source)) throw new Error('[worker-check] Admin route fallback missing.');
  source = source.replace(fallback, routes + '\n        $&', 1);
}

if (!source.includes("admin_user_blocks")) throw new Error('[worker-check] Admin user state injection failed.');

const loginMarker = /async\s+function\s+login\(r,\s*e\)\s*\{\n/;
if (!source.includes('const blocked = await e.DB.prepare')) {
  if (!loginMarker.test(source)) throw new Error('[worker-check] login marker missing.');
  const loginPatch = `async function login(r, e) {\n  await ensureAdminUserState(e);\n`;
  source = source.replace(loginMarker, loginPatch, 1);
  const userQuery = /const u = await e\.DB\s*\.prepare\(\s*'SELECT id,email,username,password_hash FROM users ' \+\s*'WHERE email=\?1 LIMIT 1',\s*\)\s*\.bind\(email\)\s*\.first\(\);/;
  if (!userQuery.test(source)) throw new Error('[worker-check] login user query marker missing.');
  source = source.replace(userQuery, `$&\n\n  const blocked = u ? await e.DB.prepare('SELECT 1 AS blocked FROM admin_user_blocks WHERE user_id=?1 LIMIT 1').bind(u.id).first() : null;`, 1);
  source = source.replace(/if \(!u \|\| !\(await passwordVerify\(password, u\.password_hash\)\)\) \{/, `if (!u || blocked || !(await passwordVerify(password, u.password_hash))) {`, 1);
}

const detailQuery = "SELECT id,email,username,created_at,updated_at FROM users WHERE id=?1 LIMIT 1";
if (source.includes(detailQuery) && !source.includes("AS blocked FROM users WHERE id=?1 LIMIT 1")) {
  source = source.replace(detailQuery, "SELECT id,email,username,created_at,updated_at,(SELECT 1 FROM admin_user_blocks b WHERE b.user_id=users.id LIMIT 1) AS blocked FROM users WHERE id=?1 LIMIT 1", 1);
}

const assetRoute = `
      if (u.pathname === '/admin/users/' && r.method === 'GET') {
        const asset = await e.ASSETS.fetch(r);
        const injected = new HTMLRewriter().on('body', { element(el) { el.append('<script src="/admin/users/actions.js?v=1" defer></script>', { html: true }); } }).transform(asset);
        return enhanceHTML(injected, r);
      }
`;
if (!source.includes('/admin/users/actions.js?v=1')) {
  const fetchMarker = /\n    try \{\n/;
  if (!fetchMarker.test(source)) throw new Error('[worker-check] fetch marker missing.');
  source = source.replace(fetchMarker, '\n' + assetRoute + '\n    try {\n', 1);
}

await writeFile(output, source, 'utf8');
execFileSync(process.execPath, ['--check', output.pathname], { stdio: 'inherit' });
console.log('[worker-check] Admin Users edit/block/unblock extensions applied.');
