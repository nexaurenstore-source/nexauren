import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(workerUrl, 'utf8');

const old = `if(path.startsWith('/blog/')&&path!=='/blog'){const blogPathParts=path.slice('/blog/'.length).split('/').filter(Boolean);const slug=decodeURIComponent(blogPathParts.at(-1)||'');if(slug){const article=await blogRenderArticlePage(r,e,slug);if(article)return article;return new Response('<!doctype html><html lang=\"pt\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Artigo não encontrado · Nexauren</title><meta name=\"robots\" content=\"noindex\"></head><body><main style=\"font-family:system-ui;text-align:center;padding:80px 20px\"><h1>Artigo não encontrado</h1><p>Este artigo não existe ou já não está publicado.</p><a href=\"/blog/\">← Voltar ao Blog</a></main></body></html>',{status:404,headers:{'Content-Type':'text/html; charset=UTF-8','Cache-Control':'no-store'}});}}return null;}`;

const replacement = `if(path.startsWith('/blog/')&&path!=='/blog'){const blogPathParts=path.slice('/blog/'.length).split('/').filter(Boolean);const slug=decodeURIComponent(blogPathParts.at(-1)||'');if(slug){const article=await blogRenderArticlePage(r,e,slug);if(article)return article;const template=await e.ASSETS.fetch(new Request(new URL('/blog/post.html',r.url).toString(),{method:'GET',headers:{Accept:'text/html'}}));if(template.ok){return new Response(await template.text(),{status:200,headers:{'Content-Type':'text/html; charset=UTF-8','Cache-Control':'public, max-age=60'}});}return new Response('<!doctype html><html lang=\"pt\"><head><meta charset=\"utf-8\"><title>Artigo não encontrado · Nexauren</title><meta name=\"robots\" content=\"noindex\"></head><body><main style=\"font-family:system-ui;text-align:center;padding:80px 20px\"><h1>Artigo não encontrado</h1><p>Este artigo não existe ou já não está publicado.</p><a href=\"/blog/\">← Voltar ao Blog</a></main></body></html>',{status:404,headers:{'Content-Type':'text/html; charset=UTF-8','Cache-Control':'no-store'}});}}return null;}`;

if (!source.includes(old)) {
  throw new Error('[blog-article-fallback-patch] Expected public blog route block not found.');
}
source = source.replace(old, replacement);
await writeFile(workerUrl, source, 'utf8');
console.log('[blog-article-fallback-patch] Public article routes now fall back to the universal post template.');
