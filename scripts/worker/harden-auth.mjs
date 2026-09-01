import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const output = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(output, 'utf8');

if (!source.includes('async function login(r, e)')) {
  throw new Error('[auth] login function marker not found. Build stopped.');
}
if (!source.includes('async function register(r, e)')) {
  throw new Error('[auth] register function marker not found. Build stopped.');
}
if (!source.includes('/api/auth/login') || !source.includes('/api/auth/register')) {
  throw new Error('[auth] authentication routes are missing. Build stopped.');
}

const oldPasswordHash = `const passwordHash = async (p) => {
  const s = crypto.randomUUID();
  const d = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(\`${'${'}s}:${'${'}p}\`),
  );

  return \`sha256:${'${'}s}:${'${'}bytesToHex(d)}\`;
};`;

const oldPasswordVerify = `const passwordVerify = async (p, stored) => {
  const a = String(stored).split(':');

  if (a.length !== 3 || a[0] !== 'sha256') {
    return false;
  }

  const d = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(\`${'${'}a[1]}:${'${'}p}\`),
  );

  return bytesToHex(d) === a[2];
};`;

const passwordSecurity = `const PBKDF2_ITERATIONS = 120000;

const constantTimeHexEqual = (a, b) => {
  const left = String(a || '').toLowerCase();
  const right = String(b || '').toLowerCase();
  if (left.length !== right.length || left.length % 2 !== 0) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return diff === 0;
};

const passwordHash = async (p) => {
  const salt = crypto.randomUUID().replaceAll('-', '');
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(String(p)),
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(salt),
      iterations: PBKDF2_ITERATIONS,
    },
    key,
    256,
  );
  return \`pbkdf2:${'${'}salt}:${'${'}PBKDF2_ITERATIONS}:${'${'}bytesToHex(bits)}\`;
};

const passwordVerify = async (p, stored) => {
  const value = String(stored || '');
  const a = value.split(':');

  if (a[0] === 'pbkdf2' && a.length === 4) {
    const iterations = Number(a[2]);
    if (!Number.isInteger(iterations) || iterations < 100000) return { valid: false, needsUpgrade: false };
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(String(p)),
      { name: 'PBKDF2' },
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        hash: 'SHA-256',
        salt: new TextEncoder().encode(a[1]),
        iterations,
      },
      key,
      256,
    );
    return { valid: constantTimeHexEqual(bytesToHex(bits), a[3]), needsUpgrade: false };
  }

  if (a[0] === 'sha256' && a.length === 3) {
    const d = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(\`${'${'}a[1]}:${'${'}p}\`),
    );
    return { valid: constantTimeHexEqual(bytesToHex(d), a[2]), needsUpgrade: true };
  }

  return { valid: false, needsUpgrade: false };
};`;

if (source.includes(oldPasswordHash) && source.includes(oldPasswordVerify)) {
  source = source.replace(oldPasswordHash + '\n\n' + oldPasswordVerify, passwordSecurity);
} else if (!source.includes('const PBKDF2_ITERATIONS = 120000')) {
  throw new Error('[auth] password hashing markers not found. Build stopped.');
}

const loginStart = source.indexOf('async function login(r, e)');
const loginOpen = source.indexOf('{', loginStart);
let depth = 0;
let quote = null;
let escaped = false;
let loginEnd = -1;
for (let i = loginOpen; i < source.length; i += 1) {
  const ch = source[i];
  if (quote) {
    if (escaped) escaped = false;
    else if (ch === '\\') escaped = true;
    else if (ch === quote) quote = null;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
  if (ch === '{') depth += 1;
  else if (ch === '}' && --depth === 0) { loginEnd = i + 1; break; }
}
if (loginEnd < 0) throw new Error('[auth] login function could not be parsed. Build stopped.');

const hardenedLogin = `async function login(r, e) {
  const d = await body(r);
  const email = clean(d?.email).toLowerCase();
  const password = String(d?.password ?? '');
  const now = Math.floor(Date.now() / 1000);
  const ip = r.headers.get('CF-Connecting-IP') || r.headers.get('X-Forwarded-For') || 'unknown';
  const ipHash = await sha256(String(ip).split(',')[0].trim());

  const recentAttempts = await e.DB
    .prepare(
      'SELECT COUNT(*) AS total FROM auth_login_attempts ' +
        'WHERE created_at>?1 AND success=0 AND (email=?2 OR ip_hash=?3)',
    )
    .bind(now - 900, email, ipHash)
    .first();

  if (Number(recentAttempts?.total || 0) >= 5) {
    return json(
      { error: 'Too many login attempts. Please try again later.' },
      429,
      { ...cors(r), 'retry-after': '900' },
    );
  }

  const u = await e.DB
    .prepare(
      'SELECT id,email,username,password_hash FROM users ' +
        'WHERE email=?1 LIMIT 1',
    )
    .bind(email)
    .first();

  const verification = u
    ? await passwordVerify(password, u.password_hash)
    : { valid: false, needsUpgrade: false };

  if (!u || !verification.valid) {
    await e.DB
      .prepare(
        'INSERT INTO auth_login_attempts(email,ip_hash,success,created_at) ' +
          'VALUES (?1,?2,0,?3)',
      )
      .bind(email, ipHash, now)
      .run();
    return json(
      { error: 'Email ou senha incorretos.' },
      401,
      cors(r),
    );
  }

  await e.DB
    .prepare(
      'INSERT INTO auth_login_attempts(email,ip_hash,success,created_at) ' +
        'VALUES (?1,?2,1,?3)',
    )
    .bind(email, ipHash, now)
    .run();

  if (verification.needsUpgrade) {
    await e.DB
      .prepare('UPDATE users SET password_hash=?1,updated_at=?2 WHERE id=?3')
      .bind(await passwordHash(password), now, u.id)
      .run();
  }

  const session = uuid();

  await e.DB
    .prepare(
      'INSERT INTO sessions ' +
        '(id,user_id,token_hash,expires_at,created_at) ' +
        'VALUES (?1,?2,?3,?4,?5)',
    )
    .bind(
      uuid(),
      u.id,
      await sha256(session),
      now + 2592000,
      now,
    )
    .run();

  return json(
    {
      user: {
        id: u.id,
        email: u.email,
        username: u.username,
      },
      authenticated: true,
    },
    200,
    {
      ...cors(r),
      'set-cookie': cookie(
        'nexauren_session',
        session,
        2592000,
      ),
    },
  );
}`;

source = source.slice(0, loginStart) + hardenedLogin + source.slice(loginEnd);

await writeFile(output, source, 'utf8');
execFileSync(process.execPath, ['--check', output.pathname], { stdio: 'inherit' });
console.log('[auth] PBKDF2 password hashing and constant-time verification enabled.');
console.log('[auth] Login throttling enforced with auth_login_attempts.');
console.log('[auth] Legacy SHA-256 hashes are upgraded after successful login.');
console.log('[auth] Authentication routes preserved.');
