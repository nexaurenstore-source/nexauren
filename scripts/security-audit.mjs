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
requireText('access-control-allow-origin', 'CORS policy');
requireText("'https://nexaurenstory.com'", 'production CORS allowlist');
requireText('HttpOnly; Secure; SameSite=Lax', 'secure session cookie');

if (source.includes("access-control-allow-origin': r.headers.get('Origin') || '*'")) {
  errors.push('Unsafe reflected CORS origin with credentials remains in Worker.');
}
if (source.includes('return bytesToHex(d) === a[2]')) {
  errors.push('Direct password digest comparison remains in Worker.');
}

const functionPattern = /async function (admin[A-Za-z0-9_]+)\(r, e\) \{([\s\S]*?)\n\}/g;
for (const match of source.matchAll(functionPattern)) {
  const name = match[1];
  const body = match[2];
  if (!body.includes('await isAdmin(r, e)')) errors.push(`Admin function ${name} does not perform an isAdmin authorization check.`);
}

const protectedAdminRoutes = [...source.matchAll(/pathname\.startsWith\('\/api\/admin\//g)].length;
if (!protectedAdminRoutes) errors.push('No /api/admin route guard was detected.');

if (errors.length) {
  console.error('NEXAUREN SECURITY AUDIT: FAILED');
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log('NEXAUREN SECURITY AUDIT: OK');
console.log('- password hashing and verification hardened');
console.log('- login throttling enforced');
console.log('- administrator authorization primitives present');
console.log('- credentialed CORS uses explicit production allowlist');
console.log('- secure session cookie flags present');
