import { readFile, writeFile } from 'node:fs/promises';

const output = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(output, 'utf8');

const unsafeCors = `const cors = (r) => ({
  'access-control-allow-origin': r.headers.get('Origin') || '*',
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'Content-Type, Accept',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
});`;

const hardenedCors = `const cors = (r) => {
  const origin = r.headers.get('Origin');
  const allowed = new Set([
    'https://nexaurenstory.com',
    'https://www.nexaurenstory.com',
  ]);
  const headers = {
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'Content-Type, Accept',
    'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'vary': 'Origin',
  };
  if (origin && allowed.has(origin)) headers['access-control-allow-origin'] = origin;
  return headers;
};`;

if (source.includes(unsafeCors)) {
  source = source.replace(unsafeCors, hardenedCors);
} else if (!source.includes("'https://nexaurenstory.com'")) {
  throw new Error('[security] CORS implementation marker not found. Deployment stopped.');
}

await writeFile(output, source, 'utf8');
console.log('[security] CORS origin reflection hardened with an explicit production allowlist.');
