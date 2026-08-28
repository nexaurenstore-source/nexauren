import fs from 'node:fs';
import path from 'node:path';

const frontend = path.join(process.cwd(), 'frontend');
const studiosRoot = path.join(frontend, 'studios');
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const studios = readJson(path.join(frontend, 'data', 'studios.json')).studios || [];
const tools = readJson(path.join(frontend, 'data', 'tools.json')).tools || [];
const errors = [];
const ids = new Set();
const slugs = new Set();
const toolMap = new Map();
const registeredIds = new Set(studios.flatMap(s => Array.isArray(s.tools) ? s.tools : []));

const pageForUrl = url => {
  if (!url) return null;
  return path.join(frontend, url.replace(/^\//, '').replace(/\/$/, ''), 'index.html');
};

const physicalExperiencePages = () => {
  const pages = [];
  if (!fs.existsSync(studiosRoot)) return pages;
  for (const studioEntry of fs.readdirSync(studiosRoot, { withFileTypes: true })) {
    if (!studioEntry.isDirectory()) continue;
    const studioDir = path.join(studiosRoot, studioEntry.name);
    for (const experienceEntry of fs.readdirSync(studioDir, { withFileTypes: true })) {
      if (!experienceEntry.isDirectory()) continue;
      const index = path.join(studioDir, experienceEntry.name, 'index.html');
      if (fs.existsSync(index)) pages.push(`/studios/${studioEntry.name}/${experienceEntry.name}/`);
    }
  }
  return pages;
};

for (const tool of tools) {
  if (!tool?.id) {
    errors.push('Experience missing ID');
    continue;
  }
  if (ids.has(tool.id)) errors.push(`Duplicate ID: ${tool.id}`);
  ids.add(tool.id);
  if (!tool.slug) errors.push(`Experience missing slug: ${tool.id}`);
  if (tool.slug && slugs.has(tool.slug)) errors.push(`Duplicate slug: ${tool.slug}`);
  if (tool.slug) slugs.add(tool.slug);
  toolMap.set(tool.id, tool);
  if (!tool.studio) errors.push(`Invalid studio reference: ${tool.id}`);
  if (!tool.url) errors.push(`Missing URL: ${tool.id}`);
  const page = pageForUrl(tool.url);
  if (page && !fs.existsSync(page)) errors.push(`Missing experience page: ${tool.id} -> ${tool.url}`);
}

for (const studio of studios) {
  const registered = Array.isArray(studio.tools) ? studio.tools : [];
  const seen = new Set();
  let visible = 0;
  let pages = 0;

  for (const id of registered) {
    if (seen.has(id)) errors.push(`Duplicate Studio experience: ${studio.id} -> ${id}`);
    seen.add(id);
    const tool = toolMap.get(id);
    if (!tool) {
      errors.push(`Unregistered experience: ${studio.id} -> ${id}`);
      continue;
    }
    if (tool.studio !== studio.id) errors.push(`Studio mismatch: ${id} points to ${tool.studio}, registered in ${studio.id}`);
    if (tool.status === 'active') visible++;
    const page = pageForUrl(tool.url);
    if (page && fs.existsSync(page)) pages++;
  }

  const physical = physicalExperiencePages().filter(url => url.startsWith(`/studios/${studio.slug}/`));
  const physicalRegistered = physical.filter(url => {
    const tool = tools.find(t => t.url === url);
    return tool && tool.studio === studio.id;
  });
  for (const url of physical) {
    const tool = tools.find(t => t.url === url);
    if (!tool) errors.push(`Unregistered experience page: ${url}`);
    else if (!registeredIds.has(tool.id)) errors.push(`Experience page not registered in Studio: ${url}`);
  }

  if (pages !== visible) errors.push(`Studio page count mismatch: ${studio.id} registry=${visible} pages=${pages}`);
  if (physicalRegistered.length !== visible) errors.push(`Studio physical page mismatch: ${studio.id} active=${visible} physical=${physicalRegistered.length}`);

  console.log(`${studio.name} Registry: ${registered.length} Visible: ${visible} Pages: ${pages} Status: ${pages === visible && physicalRegistered.length === visible ? 'OK' : 'ERROR'}`);
}

for (const tool of tools.filter(t => t?.status === 'active')) {
  if (!registeredIds.has(tool.id)) errors.push(`Experience not registered in any Studio: ${tool.id}`);
}

if (errors.length) {
  console.error('\nNEXAUREN STUDIO REGISTRY ERRORS');
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log('NEXAUREN STUDIO REGISTRY: OK');
