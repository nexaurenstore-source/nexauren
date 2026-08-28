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

async function statisticsSafe(e, sql, ...args) {
  try {
    return await e.DB.prepare(sql).bind(...args).first();
  } catch {
    return null;
  }
}

async function statisticsAll(e, sql, ...args) {
  try {
    return (await e.DB.prepare(sql).bind(...args).all())?.results || [];
  } catch {
    return [];
  }
}

async function adminStatistics(r, e) {
  const admin = await isAdmin(r, e);
  if (!admin) return json({ error: 'Forbidden' }, 403, cors(r));

  const u = new URL(r.url);
  const days = Math.min(365, Math.max(1, Number.parseInt(u.searchParams.get('days') || '7', 10) || 7));
  const now = Math.floor(Date.now() / 1000);
  const since = now - days * 86400;

  const totalUsers = await statisticsSafe(e, 'SELECT COUNT(*) AS total FROM users');
  const newUsers = await statisticsSafe(e, 'SELECT COUNT(*) AS total FROM users WHERE created_at>=?1', since);
  const activeUsers = await statisticsSafe(e, 'SELECT COUNT(DISTINCT user_id) AS total FROM sessions WHERE expires_at>?1', now);

  const notifSent = await statisticsSafe(e, "SELECT COUNT(*) AS total FROM notification_recipients r JOIN notifications n ON n.id=r.notification_id WHERE n.status IN ('SENT','ACTIVE') AND r.created_at>=?1", since);
  const notifRead = await statisticsSafe(e, "SELECT COUNT(*) AS total FROM notification_recipients r JOIN notifications n ON n.id=r.notification_id WHERE n.status IN ('SENT','ACTIVE') AND r.read_at IS NOT NULL AND r.created_at>=?1", since);

  const forms = await statisticsSafe(e, 'SELECT COUNT(*) AS total FROM forms WHERE created_at>=?1', since);
  const reviews = await statisticsSafe(e, 'SELECT COUNT(*) AS total FROM reviews WHERE created_at>=?1', since);

  let toolsUsed = null;
  let tools = [];
  for (const table of ['tool_usage','tool_usages','tools_usage']) {
    const count = await statisticsSafe(e, `SELECT COUNT(*) AS total FROM ${table} WHERE created_at>=?1`, since);
    if (count) {
      toolsUsed = Number(count.total || 0);
      tools = await statisticsAll(e, `SELECT name AS label,COUNT(*) AS value FROM ${table} WHERE created_at>=?1 GROUP BY name ORDER BY value DESC LIMIT 10`, since);
      break;
    }
  }

  const usersSeries = await statisticsAll(e, "SELECT strftime('%Y-%m-%d',datetime(created_at,'unixepoch')) AS label,COUNT(*) AS value FROM users WHERE created_at>=?1 GROUP BY label ORDER BY label", since);
  const sentSeries = await statisticsAll(e, "SELECT strftime('%Y-%m-%d',datetime(r.created_at,'unixepoch')) AS label,COUNT(*) AS value FROM notification_recipients r JOIN notifications n ON n.id=r.notification_id WHERE n.status IN ('SENT','ACTIVE') AND r.created_at>=?1 GROUP BY label ORDER BY label", since);
  const readSeries = await statisticsAll(e, "SELECT strftime('%Y-%m-%d',datetime(r.read_at,'unixepoch')) AS label,COUNT(*) AS value FROM notification_recipients r JOIN notifications n ON n.id=r.notification_id WHERE n.status IN ('SENT','ACTIVE') AND r.read_at IS NOT NULL AND r.read_at>=?1 GROUP BY label ORDER BY label", since);

  const growth = [];
  let cumulative = Math.max(0, Number(totalUsers?.total || 0) - Number(newUsers?.total || 0));
  for (const row of usersSeries) { cumulative += Number(row.value || 0); growth.push({ label: row.label, value: cumulative }); }

  return json({
    range_label: days === 1 ? 'Today' : `Last ${days} days`,
    overview: {
      total_users: Number(totalUsers?.total || 0),
      active_users: Number(activeUsers?.total || 0),
      new_users: Number(newUsers?.total || 0),
      notifications_sent: Number(notifSent?.total || 0),
      notifications_read: Number(notifRead?.total || 0),
      forms: forms ? Number(forms.total || 0) : null,
      reviews: reviews ? Number(reviews.total || 0) : null,
      tools_used: toolsUsed
    },
    series: {
      users: usersSeries,
      notifications: sentSeries,
      notifications_read: readSeries,
      growth,
      activity: usersSeries
    },
    top: {
      tools,
      users: [],
      content: [],
      events: []
    }
  }, 200, cors(r));
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
        if (__blockedUsersUrl.pathname === '/api/admin/statistics' && r.method === 'GET') {
          return adminStatistics(r, e);
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
console.log('[worker-check] Admin Statistics API extension applied.');
