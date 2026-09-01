import { readFile, writeFile } from 'node:fs/promises';

const outputUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const file = await readFile(outputUrl, 'utf8');

const from = "if (new URL(r.url).pathname.startsWith('/api/blog/') || new URL(r.url).pathname.startsWith('/api/admin/blog/')) {";
const to = "if (new URL(r.url).pathname.startsWith('/api/blog/') || new URL(r.url).pathname.startsWith('/api/admin/blog/') || new URL(r.url).pathname.startsWith('/blog/')) {";

if (!file.includes(from)) {
  if (file.includes(to)) {
    console.log('[blog-route-patch] Public Blog route already enabled.');
    process.exit(0);
  }
  throw new Error('[blog-route-patch] Expected Blog dispatcher marker was not found. Deployment stopped.');
}

const patched = file.replace(from, to);
await writeFile(outputUrl, patched, 'utf8');
console.log('[blog-route-patch] Public /blog/<slug> routes enabled in deploy artifact.');
