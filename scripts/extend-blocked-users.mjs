import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const output = new URL('../.worker-build/worker.js', import.meta.url);
let source = await readFile(output, 'utf8');

const functions = `

async function adminBlockedUsers(r, e) {
  const admin = await isAdmin(r, e);
  if (!admin) return json({ error: 'Forbidden' }, 403, cors(r));
  await ensureAdminUserState(e);
  const u = new URL(r.url);
  const page = Math.max(1, Number.parseInt(u.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(u.searchParams.get('limit') || '50', 10) || 50));
  const offset = (page - 1) * limit;
  const q = clean(u.searchParams.get('q') || '').slice(0, 120).replace(/[%_]/g, '');
  const like = '%' + q + '%';
  const countStmt = q
    ? e.DB.prepare('SELECT COUNT(*) AS total FROM admin_user_blocks b JOIN users u ON u.id=b.user_id WHERE u.username LIKE ?1 OR u.email LIKE ?1').bind(like)
    : e.DB.prepare('SELECT COUNT(*) AS total FROM admin_user_blocks');
  const listStmt = q
    ? e.DB.prepare('SELECT u.id,u.email,u.username,u.created_at,u.updated_at,b.blocked_at,COALESCE(p.xp,0) AS xp,COALESCE(p.level,1) AS level FROM admin_user_blocks b JOIN users u ON u.id=b.user_id LEFT JOIN user_progress p ON p.user_id=u.id WHERE u.username LIKE ?1 OR u.email LIKE ?1 ORDER BY b.blocked_at DESC LIMIT ?2 OFFSET ?3').bind(like, limit, offset)
    : e.DB.prepare('SELECT u.id,u.email,u.username,u.created_at,u.updated_at,b.blocked_at,COALESCE(p.xp,0) AS xp,COALESCE(p.level,1) AS level FROM admin_user_blocks b JOIN users u ON u.id=b.user_id LEFT JOIN user_progress p ON p.user_id=u.id ORDER BY b.blocked_at DESC LIMIT ?1 OFFSET ?2').bind(limit, offset);
  const [count, rows] = await Promise.all([countStmt.first(), listStmt.all()]);
  return json({ page, limit, total: Number(count?.total || 0), users: rows.results || [] }, 200, cors(r));
}
`;

if (!source.includes('async function adminBlockedUsers(')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(source)) throw new Error('[worker-check] enhanceHTML marker missing.');
  source = source.replace(marker, functions + '\n$&', 1);
}

const route = `
      {
        const __blockedUsersUrl = new URL(r.url);
        if (__blockedUsersUrl.pathname === '/api/admin/users/blocked' && r.method === 'GET') {
          return adminBlockedUsers(r, e);
        }
      }
`;
if (!source.includes('__blockedUsersUrl')) {
  const fetchStart = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{/;
  if (!fetchStart.test(source)) throw new Error('[worker-check] fetch(r, e) marker missing.');
  source = source.replace(fetchStart, '$&\n' + route, 1);
}

await writeFile(output, source, 'utf8');
execFileSync(process.execPath, ['--check', output.pathname], { stdio: 'inherit' });
console.log('[worker-check] Blocked Users list extension applied.');
