import { readFile, writeFile } from 'node:fs/promises';

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
  try { return await e.DB.prepare(sql).bind(...args).first(); } catch { return null; }
}
async function statisticsAll(e, sql, ...args) {
  try { return (await e.DB.prepare(sql).bind(...args).all())?.results || []; } catch { return []; }
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
  let toolsUsed = null; let tools = [];
  for (const table of ['tool_usage','tool_usages','tools_usage']) {
    const count = await statisticsSafe(e, 'SELECT COUNT(*) AS total FROM ' + table + ' WHERE created_at>=?1', since);
    if (count) { toolsUsed = Number(count.total || 0); tools = await statisticsAll(e, 'SELECT name AS label,COUNT(*) AS value FROM ' + table + ' WHERE created_at>=?1 GROUP BY name ORDER BY value DESC LIMIT 10', since); break; }
  }
  const usersSeries = await statisticsAll(e, "SELECT strftime('%Y-%m-%d',datetime(created_at,'unixepoch')) AS label,COUNT(*) AS value FROM users WHERE created_at>=?1 GROUP BY label ORDER BY label", since);
  const sentSeries = await statisticsAll(e, "SELECT strftime('%Y-%m-%d',datetime(r.created_at,'unixepoch')) AS label,COUNT(*) AS value FROM notification_recipients r JOIN notifications n ON n.id=r.notification_id WHERE n.status IN ('SENT','ACTIVE') AND r.created_at>=?1 GROUP BY label ORDER BY label", since);
  const readSeries = await statisticsAll(e, "SELECT strftime('%Y-%m-%d',datetime(r.read_at,'unixepoch')) AS label,COUNT(*) AS value FROM notification_recipients r JOIN notifications n ON n.id=r.notification_id WHERE n.status IN ('SENT','ACTIVE') AND r.read_at IS NOT NULL AND r.read_at>=?1 GROUP BY label ORDER BY label", since);
  const growth = []; let cumulative = Math.max(0, Number(totalUsers?.total || 0) - Number(newUsers?.total || 0));
  for (const row of usersSeries) { cumulative += Number(row.value || 0); growth.push({ label: row.label, value: cumulative }); }
  return json({ range_label: days === 1 ? 'Today' : 'Last ' + days + ' days', overview: { total_users:Number(totalUsers?.total||0), active_users:Number(activeUsers?.total||0), new_users:Number(newUsers?.total||0), notifications_sent:Number(notifSent?.total||0), notifications_read:Number(notifRead?.total||0), forms:forms?Number(forms.total||0):null, reviews:reviews?Number(reviews.total||0):null, tools_used:toolsUsed }, series:{users:usersSeries,notifications:sentSeries,notifications_read:readSeries,growth,activity:usersSeries}, top:{tools,users:[],content:[],events:[]} }, 200, cors(r));
}

async function ensureAdminSettingsSchema(e) {
  await e.DB.batch([
    e.DB.prepare("CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at INTEGER NOT NULL,updated_by TEXT)"),
    e.DB.prepare("CREATE TABLE IF NOT EXISTS tool_settings (tool_id TEXT PRIMARY KEY,ranking_score INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'available',available_at INTEGER,restore_at INTEGER,updated_at INTEGER NOT NULL,updated_by TEXT)"),
    e.DB.prepare("CREATE TABLE IF NOT EXISTS settings_audit_logs (id TEXT PRIMARY KEY,admin_id TEXT,setting_key TEXT NOT NULL,old_value TEXT,new_value TEXT,created_at INTEGER NOT NULL)"),
    e.DB.prepare("CREATE INDEX IF NOT EXISTS idx_settings_audit_created ON settings_audit_logs(created_at DESC)")
  ]);
}

const SETTINGS_DEFAULTS = { ranking_enabled:true, ranking_limit:10, notification_badge:true };
function settingsValue(key, value) {
  if (['ranking_enabled','notification_badge'].includes(key)) return value === true || value === 'true';
  if (key === 'ranking_limit') return Math.max(3, Math.min(100, Number(value) || 10));
  return clean(value).slice(0, 500);
}
function safeToolStatus(v) { return ['available','scheduled','maintenance','blocked'].includes(String(v)) ? String(v) : 'available'; }
function validTimestamp(v) { if (v === null || v === '' || v === undefined) return null; const n = Math.floor(new Date(v).getTime()/1000); return Number.isFinite(n) ? n : null; }

async function getAdminSettings(r,e) {
  const admin = await isAdmin(r,e); if (!admin) return json({error:'Forbidden'},403,cors(r));
  await ensureAdminSettingsSchema(e);
  const rows = await e.DB.prepare('SELECT key,value,updated_at,updated_by FROM platform_settings').all();
  const settings = {...SETTINGS_DEFAULTS};
  for (const row of rows?.results || []) { try { settings[row.key] = settingsValue(row.key, JSON.parse(row.value)); } catch { settings[row.key] = settingsValue(row.key,row.value); } }
  const tools = await e.DB.prepare('SELECT tool_id,ranking_score,status,available_at,restore_at,updated_at,updated_by FROM tool_settings ORDER BY ranking_score DESC,tool_id ASC').all();
  const audit = await e.DB.prepare('SELECT a.setting_key,a.old_value,a.new_value,a.created_at,u.username,u.email FROM settings_audit_logs a LEFT JOIN users u ON u.id=a.admin_id ORDER BY a.created_at DESC LIMIT 100').all();
  return json({settings,tools:tools?.results||[],audit:audit?.results||[]},200,cors(r));
}

async function updateAdminSettings(r,e) {
  const admin = await isAdmin(r,e); if (!admin) return json({error:'Forbidden'},403,cors(r));
  await ensureAdminSettingsSchema(e); const d=await body(r);
  if (!d || typeof d !== 'object') return json({error:'Invalid settings payload.'},400,cors(r));
  const now=Math.floor(Date.now()/1000); const changes=[];
  for (const key of Object.keys(SETTINGS_DEFAULTS)) {
    if (!(key in d)) continue;
    const value=settingsValue(key,d[key]); const serialized=JSON.stringify(value);
    const old=await e.DB.prepare('SELECT value FROM platform_settings WHERE key=?1').bind(key).first();
    const oldValue=old?.value ?? JSON.stringify(SETTINGS_DEFAULTS[key]); if(oldValue===serialized) continue;
    await e.DB.prepare('INSERT INTO platform_settings (key,value,updated_at,updated_by) VALUES (?1,?2,?3,?4) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by').bind(key,serialized,now,admin.id).run();
    await e.DB.prepare('INSERT INTO settings_audit_logs (id,admin_id,setting_key,old_value,new_value,created_at) VALUES (?1,?2,?3,?4,?5,?6)').bind(uuid(),admin.id,key,oldValue,serialized,now).run(); changes.push(key);
  }
  return json({success:true,changed:changes},200,cors(r));
}

async function updateAdminToolSetting(r,e) {
  const admin=await isAdmin(r,e); if(!admin)return json({error:'Forbidden'},403,cors(r));
  await ensureAdminSettingsSchema(e); const d=await body(r); const toolId=clean(d?.tool_id).slice(0,120);
  if(!toolId)return json({error:'tool_id is required.'},400,cors(r));
  const score=Math.max(0,Math.min(100,Math.round(Number(d?.ranking_score ?? d?.score ?? 0))));
  const status=safeToolStatus(d?.status); const availableAt=validTimestamp(d?.available_at); const restoreAt=validTimestamp(d?.restore_at);
  if(status==='scheduled' && !availableAt && !restoreAt)return json({error:'A scheduled tool needs a release time.'},400,cors(r));
  const old=await e.DB.prepare('SELECT * FROM tool_settings WHERE tool_id=?1').bind(toolId).first(); const now=Math.floor(Date.now()/1000);
  await e.DB.prepare('INSERT INTO tool_settings (tool_id,ranking_score,status,available_at,restore_at,updated_at,updated_by) VALUES (?1,?2,?3,?4,?5,?6,?7) ON CONFLICT(tool_id) DO UPDATE SET ranking_score=excluded.ranking_score,status=excluded.status,available_at=excluded.available_at,restore_at=excluded.restore_at,updated_at=excluded.updated_at,updated_by=excluded.updated_by').bind(toolId,score,status,availableAt,restoreAt,now,admin.id).run();
  await e.DB.prepare('INSERT INTO settings_audit_logs (id,admin_id,setting_key,old_value,new_value,created_at) VALUES (?1,?2,?3,?4,?5,?6)').bind(uuid(),admin.id,'tool:'+toolId,JSON.stringify(old||null),JSON.stringify({ranking_score:score,status,available_at:availableAt,restore_at:restoreAt}),now).run();
  return json({success:true,tool:{tool_id:toolId,ranking_score:score,status,available_at:availableAt,restore_at:restoreAt}},200,cors(r));
}

async function getPublicToolSetting(r,e,toolId) {
  await ensureAdminSettingsSchema(e); const id=clean(toolId).slice(0,120);
  const row=await e.DB.prepare('SELECT tool_id,ranking_score,status,available_at,restore_at FROM tool_settings WHERE tool_id=?1').bind(id).first();
  const now=Math.floor(Date.now()/1000);
  let state=row||{tool_id:id,ranking_score:0,status:'available',available_at:null,restore_at:null};
  if(state.available_at && now>=Number(state.available_at) && state.status==='scheduled') state={...state,status:'available'};
  if(state.restore_at && now>=Number(state.restore_at) && state.status==='maintenance') state={...state,status:'available'};
  return json({tool:state,server_time:now},200,cors(r));
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
        if (__blockedUsersUrl.pathname === '/api/admin/users/blocked' && r.method === 'GET') return adminBlockedUsers(r, e);
        if (__blockedUsersUrl.pathname === '/api/admin/statistics' && r.method === 'GET') return adminStatistics(r, e);
        if (__blockedUsersUrl.pathname === '/api/admin/settings' && r.method === 'GET') return getAdminSettings(r, e);
        if (__blockedUsersUrl.pathname === '/api/admin/settings' && r.method === 'PUT') return updateAdminSettings(r, e);
        if (__blockedUsersUrl.pathname === '/api/admin/settings/tools' && r.method === 'PUT') return updateAdminToolSetting(r, e);
        if (__blockedUsersUrl.pathname.startsWith('/api/tools/') && __blockedUsersUrl.pathname.endsWith('/status') && r.method === 'GET') return getPublicToolSetting(r, e, __blockedUsersUrl.pathname.split('/').filter(Boolean).at(-2));
      }
`;
if (!source.includes('__blockedUsersUrl')) {
  const fetchStart = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{/;
  if (!fetchStart.test(source)) throw new Error('[worker-check] fetch(r, e) marker missing.');
  source = source.replace(fetchStart, '$&\n' + route, 1);
}

await writeFile(output, source, 'utf8');
console.log('[worker-check] Blocked Users list extension applied.');
console.log('[worker-check] Admin Statistics API extension applied.');
console.log('[worker-check] Safe Admin Settings API extension applied.');
console.log('[worker-check] Tool maintenance, scheduling, countdown state and 0-100 ranking API included.');
