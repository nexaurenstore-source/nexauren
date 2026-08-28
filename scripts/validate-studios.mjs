import fs from 'node:fs';
import path from 'node:path';

const frontend = path.join(process.cwd(), 'frontend');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const studios = readJson(path.join(frontend, 'data', 'studios.json')).studios || [];
const tools = readJson(path.join(frontend, 'data', 'tools.json')).tools || [];
const errors = [];
const ids = new Set();
const slugs = new Set();
const toolMap = new Map();

for (const tool of tools) {
  if (!tool?.id) errors.push('Experience missing ID');
  if (ids.has(tool.id)) errors.push(`Duplicate ID: ${tool.id}`);
  ids.add(tool.id);
  if (slugs.has(tool.slug)) errors.push(`Duplicate slug: ${tool.slug}`);
  slugs.add(tool.slug);
  toolMap.set(tool.id, tool);
  if (!tool.studio) errors.push(`Invalid studio reference: ${tool.id}`);
  if (!tool.url) errors.push(`Missing URL: ${tool.id}`);
  else {
    const page = path.join(frontend, tool.url.replace(/^\//, '').replace(/\/$/, ''), 'index.html');
    if (!fs.existsSync(page)) errors.push(`Missing experience page: ${tool.id} -> ${tool.url}`);
  }
}

for (const studio of studios) {
  const registered = Array.isArray(studio.tools) ? studio.tools : [];
  const seen = new Set();
  for (const id of registered) {
    if (seen.has(id)) errors.push(`Duplicate Studio experience: ${studio.id} -> ${id}`);
    seen.add(id);
    const tool = toolMap.get(id);
    if (!tool) errors.push(`Unregistered experience: ${studio.id} -> ${id}`);
    else if (tool.studio !== studio.id) errors.push(`Studio mismatch: ${id} points to ${tool.studio}, registered in ${studio.id}`);
  }
  const active = registered.filter(id => toolMap.get(id)?.status === 'active');
  console.log(`${studio.name} Registry: ${registered.length} Visible: ${active.length} Pages: ${active.length} Status: ${active.length === registered.length ? 'OK' : 'ERROR'}`);
}

const registeredIds = new Set(studios.flatMap(s => Array.isArray(s.tools) ? s.tools : []));
for (const tool of tools.filter(t => t?.status === 'active')) {
  if (!registeredIds.has(tool.id)) errors.push(`Experience not registered in any Studio: ${tool.id}`);
}

if (errors.length) {
  console.error('\nNEXAUREN STUDIO REGISTRY ERRORS');
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log('NEXAUREN STUDIO REGISTRY: OK');
