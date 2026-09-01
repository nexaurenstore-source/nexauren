import { readFile, writeFile } from 'node:fs/promises';

const outputUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const file = await readFile(outputUrl, 'utf8');

const from = "const slug=decodeURIComponent(path.slice('/blog/'.length));if(slug&&!slug.includes('/')){";
const to = "const blogPathParts=path.slice('/blog/'.length).split('/').filter(Boolean).map(decodeURIComponent);const slug=blogPathParts.at(-1)||'';if(slug){";

if (file.includes(to)) {
  console.log('[blog-category-route-patch] Category/article Blog URLs already enabled.');
  process.exit(0);
}
if (!file.includes(from)) {
  throw new Error('[blog-category-route-patch] Expected public Blog slug marker was not found. Deployment stopped.');
}

const patched = file.replace(from, to);
await writeFile(outputUrl, patched, 'utf8');
console.log('[blog-category-route-patch] Public /blog/<category>/<slug> article URLs enabled.');
