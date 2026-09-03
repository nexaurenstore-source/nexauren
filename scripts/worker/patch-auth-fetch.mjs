import fs from 'node:fs';

const workerPath = 'worker.js';
const authPath = 'frontend/auth/auth.js';

let worker = fs.readFileSync(workerPath, 'utf8');
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
fs.writeFileSync(workerPath, worker);

// frontend/auth/auth.js is already the canonical auth client. Do not rewrite it
// here: nested template literals in a generated source string can break Node's
// build parser. This patch only handles the Worker CORS compatibility layer.
const auth = fs.readFileSync(authPath, 'utf8');
if (!auth.includes("const API = '/api/auth';")) {
  throw new Error('[auth] Canonical auth client marker not found.');
}

console.log('Auth fetch/CORS patch applied.');
