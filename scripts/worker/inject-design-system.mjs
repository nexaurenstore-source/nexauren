import { readFile, writeFile } from 'node:fs/promises';

const output = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(output, 'utf8');

if (!source.includes('design-system.css')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(source)) throw new Error('[design-system] enhanceHTML marker not found. Build stopped.');
  const injection = `\n  response = new HTMLRewriter().on('head', {\n    element(el) {\n      el.append('<link rel="stylesheet" href="/css/design-system.css">', { html: true });\n    },\n  }).transform(response);\n`;
  source = source.replace(marker, '$&' + injection, 1);
}

await writeFile(output, source, 'utf8');
console.log('[design-system] Canonical design system stylesheet injected into HTML responses.');
