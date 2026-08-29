import { readFile, writeFile } from 'node:fs/promises';

const output = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(output, 'utf8');

const additions = [];
if (!source.includes('design-system.css')) {
  additions.push("el.append('<link rel=\"stylesheet\" href=\"/css/design-system.css\">', { html: true });");
}
if (!source.includes('/js/experience-state.js')) {
  additions.push("el.append('<script src=\"/js/experience-state.js\" defer></script>', { html: true });");
}
if (!source.includes('/js/ads.js')) {
  additions.push("if (new URL(request.url).pathname.startsWith('/studios/')) el.append('<script src=\"/js/ads.js\" defer></script>', { html: true });");
}

if (additions.length) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(source)) throw new Error('[design-system] enhanceHTML marker not found. Build stopped.');
  const injection = `\n  response = new HTMLRewriter().on('head', {\n    element(el) {\n      ${additions.join('\n      ')}\n    },\n  }).transform(response);\n`;
  source = source.replace(marker, '$&' + injection, 1);
}

await writeFile(output, source, 'utf8');
console.log('[runtime] Canonical design system, isolated Experience state runtime, and Studio ads runtime injected into HTML responses.');
