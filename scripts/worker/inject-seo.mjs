import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const output = new URL('../../.worker-build/worker.js', import.meta.url);
const registryUrl = new URL('../../frontend/data/tools.json', import.meta.url);
const frontendRoot = new URL('../../frontend/', import.meta.url);
let source = await readFile(output, 'utf8');
const registry = JSON.parse(await readFile(registryUrl, 'utf8'));
const tools = Array.isArray(registry.tools) ? registry.tools : [];
const seoMap = {};

for (const tool of tools.filter(t => t?.status === 'active' && t?.url)) {
  const url = String(tool.url).trim();
  const pagePath = path.join(frontendRoot.pathname, url.replace(/^\//, ''), 'index.html');
  const html = await readFile(pagePath, 'utf8').catch(() => '');
  seoMap[url] = {
    title: String(tool.name || 'Nexauren').slice(0, 160),
    description: String(tool.description || '').slice(0, 300),
    needsTitle: !/<title>[^<]+<\/title>/.test(html),
    needsCanonical: !/<link\s+rel=["']canonical["']/.test(html),
    needsDescription: !/<meta\s+name=["']description["']/.test(html),
  };
}

if (!source.includes('const __nexaurenSeoMap')) {
  const exportMarker = 'export default {';
  const exportIndex = source.indexOf(exportMarker);
  if (exportIndex < 0) throw new Error('[seo] export default marker missing. Build stopped.');
  source = source.slice(0, exportIndex) + `const __nexaurenSeoMap = ${JSON.stringify(seoMap)};\n` + source.slice(exportIndex);
}

if (!source.includes('__nexaurenSeoInjection')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(source)) throw new Error('[seo] enhanceHTML marker missing. Build stopped.');
  const injection = `\n  const __nexaurenSeoInjection = new URL(request.url);\n  const __nexaurenSeo = __nexaurenSeoMap[__nexaurenSeoInjection.pathname];\n  if (__nexaurenSeo && (__nexaurenSeo.needsTitle || __nexaurenSeo.needsCanonical || __nexaurenSeo.needsDescription)) {\n    const __nexaurenEscape = value => String(value).replace(/&/g, '&amp;').replace(/\\\"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');\n    const __nexaurenCanonical = __nexaurenSeoInjection.origin + __nexaurenSeoInjection.pathname;\n    response = new HTMLRewriter()\n      .on('head', { element(el) {\n        if (__nexaurenSeo.needsTitle) el.append('<title>' + __nexaurenEscape(__nexaurenSeo.title) + '</title>', { html: true });\n        if (__nexaurenSeo.needsCanonical) el.append('<link rel="canonical" href="' + __nexaurenEscape(__nexaurenCanonical) + '">', { html: true });\n        if (__nexaurenSeo.needsDescription) el.append('<meta name="description" content="' + __nexaurenEscape(__nexaurenSeo.description) + '">', { html: true });\n      } })\n      .transform(response);\n  }\n`;
  source = source.replace(marker, '$&' + injection, 1);
}

await writeFile(output, source, 'utf8');
const repaired = Object.values(seoMap).filter(x => x.needsTitle || x.needsCanonical || x.needsDescription).length;
console.log(`[seo] Registry metadata prepared for ${Object.keys(seoMap).length} active Experiences; runtime repair enabled for ${repaired}.`);
