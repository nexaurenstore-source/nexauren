import fs from 'node:fs';

const workerPath = 'worker.js';
const authPath = 'frontend/auth/auth.js';

let worker = fs.readFileSync(workerPath, 'utf8');

// Keep the auth API on a dedicated namespace. The old /api/auth namespace can
// remain for backward compatibility, while the account namespace avoids stale
// edge/WAF rules that may have been attached to the legacy path.
const oldCors = [
  "const cors = (r) => ({",
  "  'access-control-allow-origin': r.headers.get('Origin') || '*',",
  "  'access-control-allow-credentials': 'true',",
  "  'access-control-allow-headers': 'Content-Type, Accept',",
  "  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',",
  "});"
].join('\n');

const newCors = [
  'const cors = (r) => {',
  "  const origin = r.headers.get('Origin');",
  "  const allowed = new Set([",
  "    'https://nexaurenstory.com',",
  "    'https://www.nexaurenstory.com',",
  '  ]);',
  "  const allowOrigin = origin && allowed.has(origin) ? origin : 'https://nexaurenstory.com';",
  '  return {',
  "    'access-control-allow-origin': allowOrigin,",
  "    'access-control-allow-credentials': 'true',",
  "    'access-control-allow-headers': 'Content-Type, Accept',",
  "    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',",
  "    'access-control-max-age': '86400',",
  "    'vary': 'Origin',",
  '  };',
  '};'
].join('\n');

if (worker.includes(oldCors)) {
  worker = worker.replace(oldCors, newCors);
}

const authRoutes = [
  "      if (",
  "        u.pathname === '/api/auth/register' &&",
  "        r.method === 'POST'",
  "      ) {",
  "        return register(r, e);",
  "      }",
  "",
  "      if (",
  "        u.pathname === '/api/auth/login' &&",
  "        r.method === 'POST'",
  "      ) {",
  "        return login(r, e);",
  "      }",
  "",
  "      if (",
  "        u.pathname === '/api/auth/forgot-password' &&",
  "        r.method === 'POST'",
  "      ) {",
  "        return forgotPassword(r, e);",
  "      }",
  "",
  "      if (",
  "        u.pathname === '/api/auth/reset-password' &&",
  "        r.method === 'POST'",
  "      ) {",
  "        return resetPassword(r, e);",
  "      }",
  "",
  "      if (",
  "        u.pathname === '/api/auth/logout' &&",
  "        r.method === 'POST'",
  "      ) {",
  "        return logout(r, e);",
  "      }",
  "",
  "      if (",
  "        u.pathname === '/api/auth/me' &&",
  "        r.method === 'GET'",
  "      ) {",
  "        return me(r, e);",
  "      }"
].join('\n');

const accountRoutes = [
  "      if (",
  "        u.pathname === '/api/account/register' &&",
  "        r.method === 'POST'",
  "      ) {",
  "        return register(r, e);",
  "      }",
  "",
  "      if (",
  "        u.pathname === '/api/account/login' &&",
  "        r.method === 'POST'",
  "      ) {",
  "        return login(r, e);",
  "      }",
  "",
  "      if (",
  "        u.pathname === '/api/account/forgot-password' &&",
  "        r.method === 'POST'",
  "      ) {",
  "        return forgotPassword(r, e);",
  "      }",
  "",
  "      if (",
  "        u.pathname === '/api/account/reset-password' &&",
  "        r.method === 'POST'",
  "      ) {",
  "        return resetPassword(r, e);",
  "      }",
  "",
  "      if (",
  "        u.pathname === '/api/account/logout' &&",
  "        r.method === 'POST'",
  "      ) {",
  "        return logout(r, e);",
  "      }",
  "",
  "      if (",
  "        u.pathname === '/api/account/me' &&",
  "        r.method === 'GET'",
  "      ) {",
  "        return me(r, e);",
  "      }"
].join('\n');

if (!worker.includes("u.pathname === '/api/account/login'")) {
  if (!worker.includes(authRoutes)) {
    throw new Error('[auth] Auth route marker not found. Build stopped.');
  }
  worker = worker.replace(authRoutes, `${authRoutes}\n\n${accountRoutes}`);
}

fs.writeFileSync(workerPath, worker);

const auth = fs.readFileSync(authPath, 'utf8');
if (!auth.includes("const API = '/api/account';")) {
  throw new Error('[auth] Dedicated account auth client marker not found.');
}

console.log('Auth fetch/CORS/account namespace patch applied.');
