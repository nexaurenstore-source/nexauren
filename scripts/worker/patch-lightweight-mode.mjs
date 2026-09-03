import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve('frontend/js/app.js');
if (fs.existsSync(app)) {
  let s = fs.readFileSync(app, 'utf8');
  s = s.replaceAll('ensureLevels();', '');
  s = s.replace(/const recordHistory=.*?;const recordActivity=/, 'const recordHistory=()=>{};const recordActivity=');
  s = s.replace(/const recordActivity=.*?;const recordUsage=/, 'const recordActivity=()=>{};const recordUsage=');
  s = s.replace(/const xpFor=.*?;const trackTool=/, 'const trackTool=');
  s = s.replace(/recordHistory\(tool\);recordUsage\(tool\)/g, '');
  s = s.replace(/recordActivity\(type,tool,extra\);/g, '');
  s = s.replace(/const xp=xpFor\(type\),id=tool\?\.id\|\|extra\.toolId\|\|location\.pathname;if\(xp&&window\.NexaurenLevels\)window\.NexaurenLevels\.award\(xp,type,id\+':\'+type\)/g, '');
  s = s.replace(/window\.dispatchEvent\(new CustomEvent\('nexauren:activity',[\s\S]*?\}\)\);/g, '');
  s = s.replaceAll('<a href="/history/">History</a>', '');
  s = s.replaceAll('<a href="/activity/">Activity</a>', '');
  s = s.replaceAll('<a href="/levels.html">Levels</a>', '');
  fs.writeFileSync(app, s);
}

// Prevent the legacy activity/levels/history clients from being loaded or used if referenced by an older page.
const frontend = path.resolve('frontend');
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(html|js)$/i.test(entry.name)) out.push(full);
  }
  return out;
}
for (const file of walk(frontend)) {
  if (file === app) continue;
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  s = s.replaceAll('ensureLevels();', '');
  s = s.replaceAll("window.NexaurenLevels.award", "void 0 /* levels disabled */");
  if (s !== before) fs.writeFileSync(file, s);
}
console.log('Lightweight mode: activity, history and XP/levels tracking disabled.');
