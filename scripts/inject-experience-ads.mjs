import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../frontend/studios/', import.meta.url);
const SCRIPT = '<script src="/js/ads.js" defer></script>';

async function walk(directory, depth = 0) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const full = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (depth < 2) await walk(full, depth + 1);
      continue;
    }

    if (depth !== 2 || entry.name !== 'index.html') continue;

    let html = await readFile(full, 'utf8');
    if (html.includes(SCRIPT)) continue;

    const marker = '</head>';
    const index = html.toLowerCase().lastIndexOf(marker);
    if (index < 0) {
      throw new Error(`[experience-ads] Missing </head>: ${full}`);
    }

    html = `${html.slice(0, index)}${SCRIPT}\n${html.slice(index)}`;
    await writeFile(full, html, 'utf8');
    console.log(`[experience-ads] Added ads.js: ${full}`);
  }
}

await walk(root);
console.log('[experience-ads] All Experience HTML files are ready for ads.');
