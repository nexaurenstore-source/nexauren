import { readFile, writeFile } from 'node:fs/promises';

const outputUrl = new URL('../../.worker-build/worker.js', import.meta.url);
const file = await readFile(outputUrl, 'utf8');

// Public article URLs may be either /blog/<slug>/ or /blog/<category>/<slug>/.
// The article itself is identified by the final path segment; the category is
// intentionally ignored here because the database lookup is slug-based.
// The generated Worker must dispatch HTML Blog routes to __handleBlogRoute;
// otherwise Assets receives the request and returns the site's 404 page.
const from = "if (new URL(r.url).pathname.startsWith('/api/blog/') || new URL(r.url).pathname.startsWith('/api/admin/blog/')) {\n      const __blogResponse = await __handleBlogRoute(r, e);\n      if (__blogResponse) return __blogResponse;\n    }";
const to = "if (new URL(r.url).pathname.startsWith('/api/blog/') || new URL(r.url).pathname.startsWith('/api/admin/blog/') || new URL(r.url).pathname.startsWith('/blog/')) {\n      const __blogResponse = await __handleBlogRoute(r, e);\n      if (__blogResponse) return __blogResponse;\n    }";

if (file.includes("new URL(r.url).pathname.startsWith('/blog/')")) {
  console.log('[blog-category-route-patch] Public Blog HTML route dispatch already enabled.');
  process.exit(0);
}
if (!file.includes(from)) {
  throw new Error('[blog-category-route-patch] Expected Blog API dispatch marker was not found. Deployment stopped.');
}

const patched = file.replace(from, to);
await writeFile(outputUrl, patched, 'utf8');
console.log('[blog-category-route-patch] Public /blog/<category>/<slug> HTML routes enabled.');
