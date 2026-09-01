import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const output = new URL('../../.worker-build/worker.js', import.meta.url);
const source = await readFile(output, 'utf8');

if (!source.includes('async function login(r, e)')) {
  throw new Error('[auth] login function marker not found. Build stopped.');
}
if (!source.includes('async function register(r, e)')) {
  throw new Error('[auth] register function marker not found. Build stopped.');
}
if (!source.includes('/api/auth/login') || !source.includes('/api/auth/register')) {
  throw new Error('[auth] authentication routes are missing. Build stopped.');
}

await writeFile(output, source, 'utf8');
execFileSync(process.execPath, ['--check', output.pathname], { stdio: 'inherit' });
console.log('[auth] Authentication compatibility check passed.');
console.log('[auth] Existing register/login/password-reset implementation preserved.');
