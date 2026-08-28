import { readFile, writeFile } from 'node:fs/promises';

const output = new URL('../../.worker-build/worker.js', import.meta.url);
const registryUrl = new URL('../../frontend/data/tools.json', import.meta.url);
let source = await readFile(output, 'utf8');
const registry = JSON.parse(await readFile(registryUrl, 'utf8'));
const tools = Array.isArray(registry.tools) ? registry.tools : [];
const seoMap = Object.fromEntries(tools.filter(t => t?.status === 'active' && t?.url).map(t => [
  t.url,
  { title: String(t.name || 'Nexauren').slice(0, 160), description: String(t.description || '').slice(0, 300) },
]));

if (!source.includes('const __nexaurenSeoMap')) {
  const exportMarker = 'export default {';
  const exportIndex = source.indexOf(exportMarker);
  if (exportIndex < 0) throw new Error('[seo] export default marker missing. Build stopped.');
  const module = `const __nexaurenSeoMap = ${JSON.stringify(seoMap)};\n`;
  source = source.slice(0, exportIndex) + module + source.slice(exportIndex);
}

if (!source.includes('__nexaurenSeoInjection')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(source)) throw new Error('[seo] enhanceHTML marker missing. Build stopped.');
  const injection = `\n  const __nexaurenSeoInjection = new URL(request.url);\n  const __nexaurenSeo = __nexaurenSeoMap[__nexaurenSeoInjection.pathname];\n  if (__nexaurenSeo) {\n    const __nexaurenCanonical = __nexaurenSeoInjection.origin + __nexaurenSeoInjection.pathname;\n    response = new HTMLRewriter().on('head', {\n      element(el) {\n        el.append('<link rel="canonical" href="' + __nexaurenCanonical.replace(/&/g, '&amp;').replace(/\\\"/g, '&quot;') + '">', { html: true });\n        el.append('<meta name="description" content="' + __nexaurenSeo.description.replace(/&/g, '&amp;').replace(/\\\"/g, '&quot;') + '">', { html: true });\n      },\n    }).transform(response);\n  }\n`;
  source = source.replace(marker, '$&' + injection, 1);
}

await writeFile(output, source, 'utf8');
console.log(`[seo] Registry metadata prepared for ${Object.keys(seoMap).length} active Experiences.`);
