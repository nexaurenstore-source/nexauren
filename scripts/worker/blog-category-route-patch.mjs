import { readFile, writeFile } from 'node:fs/promises';

const outputUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const file = await readFile(outputUrl, 'utf8');

// Public article URLs may be either /blog/<slug>/ or /blog/<category>/<slug>/.
// The article is identified by the final path segment; the category is kept in
// the URL for SEO/navigation but is intentionally ignored for the DB lookup.
const from = "const slug=decodeURIComponent(path.slice('/blog/'.length));if(slug&&!slug.includes('/')){";
const to = "const blogPathParts=path.slice('/blog/'.length).split('/').filter(Boolean);const slug=decodeURIComponent(blogPathParts.at(-1)||'');if(slug){";

let patched = file;
if (!patched.includes(to)) {
  if (!patched.includes(from)) {
    throw new Error('[blog-category-route-patch] Expected public Blog slug marker was not found. Deployment stopped.');
  }
  patched = patched.replace(from, to);
}

if (!patched.includes("path.startsWith('/blog/')") || !patched.includes("blogPathParts.at(-1)")) {
  throw new Error('[blog-category-route-patch] Public category/article routing was not installed. Deployment stopped.');
}

await writeFile(outputUrl, patched, 'utf8');
console.log('[blog-category-route-patch] Public /blog/<slug> and /blog/<category>/<slug> article URLs enabled.');
