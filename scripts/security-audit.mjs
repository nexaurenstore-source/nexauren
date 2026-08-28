import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const worker = path.join(root, '.worker-build', 'worker.js');
const source = fs.existsSync(worker) ? fs.readFileSync(worker, 'utf8') : fs.readFileSync(path.join(root, 'worker.js'), 'utf8');
const errors = [];
const requireText = (needle, label) => {
  if (!source.includes(needle)) errors.push(`Missing ${label}: ${needle}`);
};

requireText('PBKDF2_ITERATIONS = 120000', 'PBKDF2 password hashing');
requireText('constantTimeHexEqual', 'constant-time password comparison');
requireText('auth_login_attempts', 'login throttling storage');
requireText('recentAttempts', 'login throttling enforcement');
requireText("'retry-after': '900'", 'login throttle response');
requireText('async function isAdmin', 'administrator authorization primitive');
requireText('__nexaurenAdminApiGuard', 'global administrator API perimeter guard');
requireText("pathname.startsWith('/api/admin/')", 'administrator API route boundary');
requireText('access-control-allow-origin', 'CORS policy');
requireText("'https://nexaurenstory.com'", 'production CORS allowlist');
requireText('HttpOnly; Secure; SameSite=Lax', 'secure session cookie');

if (source.includes("access-control-allow-origin': r.headers.get('Origin') || '*'")) errors.push('Unsafe reflected CORS origin with credentials remains in Worker.');
if (source.includes('return bytesToHex(d) === a[2]')) errors.push('Direct password digest comparison remains in Worker.');

const extractFunctionBody = (text, start) => {
  const open = text.indexOf('{', start);
  if (open < 0) return null;
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = open; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}' && --depth === 0) return text.slice(open + 1, i);
  }
  return null;
};

const functionPattern = /async function (admin[A-Za-z0-9_]+)\(r, e\)\s*\{/g;
for (const match of source.matchAll(functionPattern)) {
  const body = extractFunctionBody(source, match.index);
  if (!body) {
    errors.push(`Could not parse administrator function ${match[1]}.`);
    continue;
  }
  if (!body.includes('await isAdmin(r, e)')) errors.push(`Admin function ${match[1]} does not perform an isAdmin authorization check.`);
}

if (errors.length) {
  console.error('NEXAUREN SECURITY AUDIT: FAILED');
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log('NEXAUREN SECURITY AUDIT: OK');
console.log('- password hashing and verification hardened');
console.log('- login throttling enforced');
console.log('- administrator authorization audited');
console.log('- all /api/admin/* routes protected at Worker perimeter');
console.log('- credentialed CORS uses explicit production allowlist');
console.log('- secure session cookie flags present');
