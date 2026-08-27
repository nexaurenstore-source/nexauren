import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const source = new URL('../worker.js', import.meta.url);
const outputDir = new URL('../.worker-build/', import.meta.url);
const output = new URL('../.worker-build/worker.js', import.meta.url);

const sourceCode = await readFile(source, 'utf8');

if (!sourceCode.trim()) {
  throw new Error('[worker-check] worker.js is empty. Deployment stopped.');
}

// Keep the production source untouched. The build step only copies the
// current Worker into the deployment artifact and validates its syntax.
// Do not guess, rewrite, or replace Worker routes during CI.
const buildCode = sourceCode;

await mkdir(outputDir, { recursive: true });
await writeFile(output, buildCode, 'utf8');

try {
  execFileSync(process.execPath, ['--check', output.pathname], { stdio: 'inherit' });
} catch {
  throw new Error('[worker-check] Generated worker failed JavaScript syntax validation. Deployment stopped.');
}

console.log('[worker-check] Source inspected.');
console.log('[worker-check] No Worker code was rewritten during build.');
console.log('[worker-check] JavaScript syntax check passed.');
console.log(`[worker-check] Deploy artifact: ${output.pathname}`);
