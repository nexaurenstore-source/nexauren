import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../frontend/studios/', import.meta.url));
const SCRIPT = '<script src="/js/ads.js" defer></script>';

async function walk(directory, depth = 0) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const full = join(directory, entry.name);

    if (entry.isDirectory()) {
      await walk(full, depth + 1);
      continue;
    }

    // Only Experience pages: frontend/studios/<studio>/<experience>/index.html
    if (entry.name !== 'index.html' || depth !== 2) continue;

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
console.log('[experience-ads] All Studio Experience HTML files are ready for ads.');
