import { readFile, writeFile } from 'node:fs/promises';

const output = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(output, 'utf8');

const adOne = "<script>(function(s){s.dataset.zone='11183778',s.src='https://nap5k.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>";
const adTwo = "<script>(function(s){s.dataset.zone='11177602',s.src='https://n6wxm.com/vignette.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))</script>";

if (!source.includes('11183778') || !source.includes('11177602')) {
  const marker = /async\s+function\s+enhanceHTML\s*\(\s*response\s*,\s*request\s*\)\s*\{/;
  if (!marker.test(source)) {
    throw new Error('[ads] enhanceHTML marker not found. Build stopped.');
  }

  const injection = `\n  if (new URL(request.url).pathname.startsWith('/studios/')) {\n    response = new HTMLRewriter().on('head', {\n      element(el) {\n        el.append(${JSON.stringify(adOne)}, { html: true });\n        el.append(${JSON.stringify(adTwo)}, { html: true });\n      },\n    }).transform(response);\n  }\n`;

  source = source.replace(marker, '$&' + injection, 1);
}

await writeFile(output, source, 'utf8');
console.log('[ads] Ad scripts injected into every /studios/ HTML response.');
console.log('[ads] Current and future Studio/Experience pages are covered centrally.');
