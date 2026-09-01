import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

const outputUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const file = await readFile(outputUrl, 'utf8');

const dispatcherFrom = "new URL(r.url).pathname.startsWith('/api/blog/') || new URL(r.url).pathname.startsWith('/api/admin/blog/')";
const dispatcherTo = "new URL(r.url).pathname.startsWith('/api/blog/') || new URL(r.url).pathname.startsWith('/api/admin/blog/') || new URL(r.url).pathname.startsWith('/blog/')";

let patched = file;
if (patched.includes(dispatcherFrom) && !patched.includes(dispatcherTo)) {
  patched = patched.replace(dispatcherFrom, dispatcherTo);
}

const routeFrom = "const slug=decodeURIComponent(path.slice('/blog/'.length));if(slug&&!slug.includes('/')){";
const routeTo = "const blogPathParts=path.slice('/blog/'.length).split('/').filter(Boolean);const slug=decodeURIComponent(blogPathParts.at(-1)||'');if(slug){";

if (patched.includes(routeFrom)) {
  patched = patched.replace(routeFrom, routeTo);
}

if (!patched.includes(dispatcherTo)) {
  throw new Error('[blog-public-route-patch] Public /blog dispatcher marker was not found. Deployment stopped.');
}
if (!patched.includes(routeTo)) {
  throw new Error('[blog-public-route-patch] Public article route marker was not found. Deployment stopped.');
}

await writeFile(outputUrl, patched, 'utf8');
execFileSync(process.execPath, ['--check', outputUrl.pathname], { stdio: 'inherit' });
console.log('[blog-public-route-patch] Public /blog/* routes now dispatch to the Blog article renderer.');
console.log('[blog-public-route-patch] Category-prefixed URLs use the final path segment as the article slug.');
