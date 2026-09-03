import { readFile, writeFile } from 'node:fs/promises';

const output = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(output, 'utf8');

if (!source.includes('PBKDF2_ITERATIONS = 120000')) {
  const hashStart = source.indexOf('const passwordHash = async (p) => {');
  const verifyEnd = source.indexOf('\n};', source.indexOf('const passwordVerify = async (p, stored) => {'));
  if (hashStart < 0 || verifyEnd < 0) throw new Error('[auth] password hashing markers not found.');
  const end = verifyEnd + 3;
  const hardened = `const PBKDF2_ITERATIONS = 120000;

const hexToBytes = (hex) => {
  const value = String(hex);
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2) return new Uint8Array();
  const out = new Uint8Array(value.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = Number.parseInt(value.slice(i * 2, i * 2 + 2), 16);
  return out;
};

const constantTimeHexEqual = (a, b) => {
  const aa = hexToBytes(a);
  const bb = hexToBytes(b);
  const length = Math.max(aa.length, bb.length);
  let diff = aa.length ^ bb.length;
  for (let i = 0; i < length; i += 1) diff |= (aa[i] || 0) ^ (bb[i] || 0);
  return diff === 0;
};

const passwordHash = async (p) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return \`pbkdf2-sha256:\${PBKDF2_ITERATIONS}:\${bytesToHex(salt)}:\${bytesToHex(bits)}\`;
};

const passwordVerify = async (p, stored) => {
  const a = String(stored).split(':');
  if (a[0] === 'pbkdf2-sha256' && a.length === 4) {
    const iterations = Number(a[1]);
    const salt = hexToBytes(a[2]);
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000 || salt.length < 16) return false;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
    return constantTimeHexEqual(bytesToHex(bits), a[3]);
  }
  if (a[0] === 'sha256' && a.length === 3) {
    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(\`\${a[1]}:\${p}\`));
    return constantTimeHexEqual(bytesToHex(d), a[2]);
  }
  return false;
};

const needsPasswordRehash = (stored) => !String(stored).startsWith('pbkdf2-sha256:');`;
  source = source.slice(0, hashStart) + hardened + source.slice(end);
}

const loginStart = 'async function login(r, e) {\n  const d = await body(r);\n  const email = clean(d?.email).toLowerCase();\n  const password = String(d?.password ?? \'\');';
if (!source.includes('const recentAttempts')) {
  if (!source.includes(loginStart)) throw new Error('[auth] login marker not found.');
  const hardenedStart = `async function login(r, e) {
  const d = await body(r);
  const email = clean(d?.email).toLowerCase();
  const password = String(d?.password ?? '');
  const ipHash = await sha256(r.headers.get('CF-Connecting-IP') || r.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() || 'unknown');
  const throttleNow = Math.floor(Date.now() / 1000);
  let recentAttempts = { total: 0 };
  try {
    recentAttempts = await e.DB.prepare('SELECT COUNT(*) AS total FROM auth_login_attempts WHERE (email=?1 OR ip_hash=?2) AND success=0 AND created_at>?3').bind(email, ipHash, throttleNow - 900).first() || recentAttempts;
  } catch (error) {
    console.warn('[auth] login throttle table unavailable; continuing without throttle until migration is applied.', error);
  }
  if (Number(recentAttempts?.total || 0) >= 8) {
    return json({ error: 'Too many login attempts. Please try again later.' }, 429, { ...cors(r), 'retry-after': '900' });
  }`;
  source = source.replace(loginStart, hardenedStart, 1);
}

const queryNeedle = `  const u = await e.DB
    .prepare(
      'SELECT id,email,username,password_hash FROM users ' +
        'WHERE email=?1 LIMIT 1',
    )
    .bind(email)
    .first();`;
if (!source.includes('const validPassword =') && source.includes(queryNeedle)) {
  const replacement = `${queryNeedle}

  const validPassword = !!u && await passwordVerify(password, u.password_hash);
  try {
    await e.DB.prepare('INSERT INTO auth_login_attempts (email,ip_hash,success,created_at) VALUES (?1,?2,?3,?4)').bind(email, ipHash, validPassword ? 1 : 0, throttleNow).run();
  } catch (error) {
    console.warn('[auth] login attempt could not be recorded.', error);
  }`;
  source = source.replace(queryNeedle, replacement, 1);
}

source = source.replace('if (!u || !(await passwordVerify(password, u.password_hash))) {', 'if (!validPassword) {');

if (!source.includes('needsPasswordRehash(u.password_hash)')) {
  const marker = '  const now = Math.floor(Date.now() / 1000);\n  const session = uuid();';
  const replacement = `  const now = Math.floor(Date.now() / 1000);

  if (u && needsPasswordRehash(u.password_hash)) {
    await e.DB.prepare('UPDATE users SET password_hash=?1,updated_at=?2 WHERE id=?3').bind(await passwordHash(password), now, u.id).run();
  }

  const session = uuid();`;
  if (!source.includes(marker)) throw new Error('[auth] login success marker not found.');
  source = source.replace(marker, replacement, 1);
}

await writeFile(output, source, 'utf8');
console.log('[auth] Authentication hardening applied to generated Worker.');
