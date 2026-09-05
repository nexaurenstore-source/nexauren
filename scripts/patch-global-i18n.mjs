import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('frontend');
const appTag = '<script src="/js/app.js" defer></script>';

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'admin') out.push(...walk(full));
    } else if (/\.html$/i.test(entry.name)) out.push(full);
  }
  return out;
}

let changed = 0;
for (const file of walk(root)) {
  const before = fs.readFileSync(file, 'utf8');
  if (before.includes('data-nexauren-global-app')) continue;
  const marker = /<\/body>/i;
  if (!marker.test(before)) continue;
  const tag = appTag.replace('defer>', 'data-nexauren-global-app defer>');
  const after = before.replace(marker, `  ${tag}\n</body>`);
  if (after !== before) {
    fs.writeFileSync(file, after);
    changed += 1;
  }
}

console.log(`Global i18n injection: ${changed} public HTML file(s) updated.`);
