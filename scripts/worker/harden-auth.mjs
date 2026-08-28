import { readFile, writeFile } from 'node:fs/promises';

const output = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(output, 'utf8');

const oldHash = `const passwordHash = async (p) => {\n  const s = crypto.randomUUID();\n  const d = await crypto.subtle.digest(\n    'SHA-256',\n    new TextEncoder().encode(\`${'${'}s}:${'${'}p}\`),\n  );\n\n  return \`sha256:${'${'}s}:${'${'}bytesToHex(d)}\`;\n};\n\nconst passwordVerify = async (p, stored) => {\n  const a = String(stored).split(':');\n\n  if (a.length !== 3 || a[0] !== 'sha256') {\n    return false;\n  }\n\n  const d = await crypto.subtle.digest(\n    'SHA-256',\n    new TextEncoder().encode(\`${'${'}a[1]}:${'${'}p}\`),\n  );\n\n  return bytesToHex(d) === a[2];\n};`;

const newHash = `const PBKDF2_ITERATIONS = 120000;\n\nconst hexToBytes = (hex) => {\n  const out = new Uint8Array(hex.length / 2);\n  for (let i = 0; i < out.length; i += 1) {\n    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);\n  }\n  return out;\n};\n\nconst constantTimeHexEqual = (a, b) => {\n  const aa = hexToBytes(String(a));\n  const bb = hexToBytes(String(b));\n  const length = Math.max(aa.length, bb.length);\n  let diff = aa.length ^ bb.length;\n  for (let i = 0; i < length; i += 1) diff |= (aa[i] || 0) ^ (bb[i] || 0);\n  return diff === 0;\n};\n\nconst passwordHash = async (p) => {\n  const salt = crypto.getRandomValues(new Uint8Array(16));\n  const key = await crypto.subtle.importKey(\n    'raw',\n    new TextEncoder().encode(p),\n    'PBKDF2',\n    false,\n    ['deriveBits'],\n  );\n  const bits = await crypto.subtle.deriveBits(\n    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },\n    key,\n    256,\n  );\n  return \`pbkdf2-sha256:${'${'}PBKDF2_ITERATIONS}:${'${'}bytesToHex(salt)}:${'${'}bytesToHex(bits)}\`;\n};\n\nconst passwordVerify = async (p, stored) => {\n  const a = String(stored).split(':');\n  if (a[0] === 'pbkdf2-sha256' && a.length === 4) {\n    const iterations = Number(a[1]);\n    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;\n    const salt = hexToBytes(a[2]);\n    if (salt.length < 16) return false;\n    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(p), 'PBKDF2', false, ['deriveBits']);\n    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);\n    return constantTimeHexEqual(bytesToHex(bits), a[3]);\n  }\n  if (a[0] === 'sha256' && a.length === 3) {\n    const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(\`${'${'}a[1]}:${'${'}p}\`));\n    return constantTimeHexEqual(bytesToHex(d), a[2]);\n  }\n  return false;\n};\n\nconst needsPasswordRehash = (stored) => !String(stored).startsWith('pbkdf2-sha256:');`;

if (!source.includes(oldHash)) throw new Error('[auth] password hashing marker not found. Build stopped.');
source = source.replace(oldHash, newHash);

const loginNeedle = `  if (!u || !(await passwordVerify(password, u.password_hash))) {`;
const loginReplacement = `  if (!u || !(await passwordVerify(password, u.password_hash))) {`;
if (!source.includes(loginNeedle)) throw new Error('[auth] login verification marker not found. Build stopped.');

const successNeedle = `  const now = Math.floor(Date.now() / 1000);\n  const session = uuid();`;
const successReplacement = `  const now = Math.floor(Date.now() / 1000);\n\n  if (u && needsPasswordRehash(u.password_hash)) {\n    await e.DB.prepare('UPDATE users SET password_hash=?1,updated_at=?2 WHERE id=?3')\n      .bind(await passwordHash(password), now, u.id).run();\n  }\n\n  const session = uuid();`;
if (!source.includes(successNeedle)) throw new Error('[auth] login success marker not found. Build stopped.');
source = source.replace(successNeedle, successReplacement);

await writeFile(output, source, 'utf8');
console.log('[auth] Password storage hardened to PBKDF2-SHA-256 with transparent legacy SHA-256 upgrade.');
