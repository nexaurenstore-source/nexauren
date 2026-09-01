import { readFile, writeFile } from 'node:fs/promises';

const output = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(output, 'utf8');

const oldHash = `const passwordHash = async (p) => {\n  const s = crypto.randomUUID();\n  const d = await crypto.subtle.digest(\n    'SHA-256',\n    new TextEncoder().encode(\`${'${'}s}:${'${'}p}\`),\n  );\n\n  return \`sha256:${'${'}s}:${'${'}bytesToHex(d)}\`;\n};\n\nconst passwordVerify = async (p, stored) => {\n  const a = String(stored).split(':');\n\n  if (a.length !== 3 || a[0] !== 'sha256') {\n    return false;\n  }\n\n  const d = await crypto.subtle.digest(\n    'SHA-256',\n    new TextEncoder().encode(\`${'${'}a[1]}:${'${'}p}\`),\n  );\n\n  return bytesToHex(d) === a[2];\n};`;

const newHash = `const PBKDF2_ITERATIONS = 120000;\n\nconst hexToBytes = (hex) => {\n  const cleanHex = String(hex);\n  if (!/^[0-9a-f]+$/i.test(cleanHex) || cleanHex.length % 2) return new Uint8Array();\n  const out = new Uint8Array(cleanHex.length / 2);\n  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);\n  return out;\n};\n\nconst constantTimeHexEqual = (a, b) => {\n  const aa = hexToBytes(a);\n  const bb = hexToBytes(b);\n  const length = Math.max(aa.length, bb.length);\n  let diff = aa.length ^ bb.length;\n  for (let i = 0; i < length; i += 1) diff |= (aa[i] || 0) ^ (bb[i] || 0);\n  return diff === 0;\n};\n\nconst passwordHash = async (p) => {\n  const salt = crypto.getRandomValues(new Uint8Array(16));\n  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']);\n  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);\n  return \`pbkdf2-sha256:${'${'}PBKDF2_ITERATIONS}:${'${'}bytesToHex(salt)}:${'${'}bytesToHex(bits)}\`;\n};\n\nconst passwordVerify = async (p, stored) => {\n  const a = String(stored).split(':');\n  if (a[0] === 'pbkdf2-sha256' && a.length === 4) {\n    const iterations = Number(a[1]);\n    const salt = hexToBytes(a[2]);\n    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000 || salt.length < 16) return false;\n    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']);\n    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);\n    return constantTimeHexEqual(bytesToHex(bits), a[3]);\n  }\n  if (a[0] === 'sha256' && a.length === 3) {\n    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(\`${'${'}a[1]}:${'${'}p}\`));\n    return constantTimeHexEqual(bytesToHex(d), a[2]);\n  }\n  return false;\n};\n\nconst needsPasswordRehash = (stored) => !String(stored).startsWith('pbkdf2-sha256:');`;

if (!source.includes(oldHash)) throw new Error('[auth] password hashing marker not found. Build stopped.');
source = source.replace(oldHash, newHash);

const loginMarker = `async function login(r, e) {\n`;
if (!source.includes(loginMarker)) throw new Error('[auth] login function marker not found. Build stopped.');

const throttleFunctions = `\nconst ensureAuthThrottleSchema = async (e) => {\n  await e.DB.batch([\n    e.DB.prepare('CREATE TABLE IF NOT EXISTS auth_login_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT NOT NULL,ip_hash TEXT NOT NULL,success INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL)'),\n    e.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_email_time ON auth_login_attempts(email,created_at DESC)'),\n    e.DB.prepare('CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_ip_time ON auth_login_attempts(ip_hash,created_at DESC)'),\n    e.DB.prepare('CREATE TABLE IF NOT EXISTS admin_user_blocks (user_id TEXT PRIMARY KEY,blocked_at INTEGER NOT NULL,blocked_until INTEGER)'),\n    e.DB.prepare('CREATE INDEX IF NOT EXISTS idx_admin_user_blocks_until ON admin_user_blocks(blocked_until)'),\n  ]);\n};\n\nconst getClientIpHash = async (r) => sha256(r.headers.get('CF-Connecting-IP') || r.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown');\n`;
if (!source.includes('const ensureAuthThrottleSchema = async')) {
  source = source.replace(loginMarker, throttleFunctions + '\n' + loginMarker, 1);
}

const loginStart = `async function login(r, e) {\n  const d = await body(r);\n  const email = clean(d?.email).toLowerCase();\n  const password = String(d?.password ?? '');`;
const loginHardenedStart = `async function login(r, e) {\n  await ensureAuthThrottleSchema(e);\n  const d = await body(r);\n  const email = clean(d?.email).toLowerCase();\n  const password = String(d?.password ?? '');\n  const ipHash = await getClientIpHash(r);\n  const throttleNow = Math.floor(Date.now() / 1000);\n  const recentAttempts = await e.DB.prepare(\n    'SELECT COUNT(*) AS total FROM auth_login_attempts WHERE (email=?1 OR ip_hash=?2) AND success=0 AND created_at>?3'\n  ).bind(email, ipHash, throttleNow - 900).first();\n  if (Number(recentAttempts?.total || 0) >= 8) {\n    return json({ error: 'Too many login attempts. Please try again later.' }, 429, { ...cors(r), 'retry-after': '900' });\n  }`;
if (!source.includes(loginHardenedStart)) {
  if (!source.includes(loginStart)) throw new Error('[auth] exact login start marker not found. Build stopped.');
  source = source.replace(loginStart, loginHardenedStart, 1);
}

const queryNeedle = `  const u = await e.DB\n    .prepare(\n      'SELECT id,email,username,password_hash FROM users ' +\n        'WHERE email=?1 LIMIT 1',\n    )\n    .bind(email)\n    .first();`;
const queryReplacement = `${queryNeedle}\n\n  let blocked = false;\n  if (u) {\n    try {\n      blocked = !!(await e.DB.prepare('SELECT 1 FROM admin_user_blocks WHERE user_id=?1 AND (blocked_until IS NULL OR blocked_until>?2) LIMIT 1').bind(u.id, throttleNow).first());\n    } catch (err) {\n      console.error('[auth] admin block lookup failed; continuing with normal authentication', err);\n    }\n  }\n  const validPassword = !!u && !blocked && await passwordVerify(password, u.password_hash);\n  await e.DB.prepare('INSERT INTO auth_login_attempts (email,ip_hash,success,created_at) VALUES (?1,?2,?3,?4)').bind(email, ipHash, validPassword ? 1 : 0, throttleNow).run();`;
if (!source.includes(queryReplacement)) {
  if (!source.includes(queryNeedle)) throw new Error('[auth] login query marker not found. Build stopped.');
  source = source.replace(queryNeedle, queryReplacement, 1);
}

const invalidNeedle = `  if (!u || !(await passwordVerify(password, u.password_hash))) {`;
if (source.includes(invalidNeedle)) {
  source = source.replace(invalidNeedle, `  if (!validPassword) {`, 1);
} else if (!source.includes('if (!validPassword) {')) {
  throw new Error('[auth] login verification marker not found. Build stopped.');
}

const successMarker = `  const now = Math.floor(Date.now() / 1000);\n  const session = uuid();`;
const loginSuccessMarker = `  const now = Math.floor(Date.now() / 1000);\n\n  if (u && needsPasswordRehash(u.password_hash)) {\n    await e.DB.prepare('UPDATE users SET password_hash=?1,updated_at=?2 WHERE id=?3').bind(await passwordHash(password), now, u.id).run();\n  }\n\n  const session = uuid();`;
const loginIndex = source.indexOf('async function login(r, e) {');
const successIndex = source.indexOf(successMarker, loginIndex);
if (successIndex < 0) throw new Error('[auth] login success marker not found. Build stopped.');
source = source.slice(0, successIndex) + loginSuccessMarker + source.slice(successIndex + successMarker.length);

await writeFile(output, source, 'utf8');
console.log('[auth] PBKDF2 password hashing, legacy upgrade, constant-time verification and login throttling applied.');
console.log('[auth] Admin user block schema is now ensured before login checks.');
console.log('[auth] Missing admin block state cannot take authentication offline.');
