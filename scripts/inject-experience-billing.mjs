import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../frontend/studios/', import.meta.url));
const helper = '<script src="/js/experience-billing.js" defer></script>';
const chargeIds = /id=["'](?:run|processBtn|process|generate|generateBtn|convert|convertBtn|compress|compressBtn|merge|mergeBtn|resize|resizeBtn|execute|executeBtn|create|createBtn)["']/i;

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(path));
    else if (entry.isFile() && entry.name === 'index.html') out.push(path);
  }
  return out;
}

const files = await walk(root);
let changed = 0;
for (const path of files) {
  const original = await readFile(path, 'utf8');
  let html = original;
  const rel = relative(root, path).replaceAll('\\', '/');
  const experienceId = rel.split('/').slice(0, -1).at(-1) || 'experience';

  if (!html.includes('src="/js/experience-billing.js"')) {
    html = html.replace('</head>', `${helper}</head>`);
  }

  // Prefer explicit processing/run controls. Never charge reset/preview/download controls.
  if (!html.includes('data-nexauren-charge="1"')) {
    html = html.replace(
      new RegExp(`(<button\\b[^>]*${chargeIds.source}[^>]*)(>)`, 'i'),
      `$1 data-nexauren-charge="1" data-nexauren-experience="${experienceId}"$2`,
    );
  }

  if (html !== original) {
    await writeFile(path, html, 'utf8');
    changed += 1;
  }
}

console.log(`[experience-billing] Scanned ${files.length} experience pages; updated ${changed}.`);
