import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const frontend = path.join(root, 'frontend');
const studiosRoot = path.join(frontend, 'studios');
const dataRoot = path.join(frontend, 'data');
const errors = [];
const warnings = [];

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = message => errors.push(message);
const warn = message => warnings.push(message);
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const isSlug = value => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const isStatus = value => value === 'active' || value === 'planned' || value === 'disabled';
const pageForUrl = url => {
  if (typeof url !== 'string' || !url.startsWith('/') || !url.endsWith('/')) return null;
  return path.join(frontend, url.slice(1, -1), 'index.html');
};
const normalizeUrl = url => {
  if (typeof url !== 'string') return null;
  const value = url.trim();
  if (!value.startsWith('/') || !value.endsWith('/')) return null;
  return value.replace(/\\+/g, '/');
};

let studiosDoc;
let toolsDoc;
let extrasDoc;
try {
  studiosDoc = readJson(path.join(dataRoot, 'studios.json'));
  toolsDoc = readJson(path.join(dataRoot, 'tools.json'));
  const extrasPath = path.join(dataRoot, 'tools-extra.json');
  extrasDoc = fs.existsSync(extrasPath) ? readJson(extrasPath) : {tools: []};
} catch (error) {
  fail(`Registry JSON could not be read: ${error.message}`);
}

const studios = Array.isArray(studiosDoc?.studios) ? studiosDoc.studios : [];
const rawTools = Array.isArray(toolsDoc?.tools) ? toolsDoc.tools : [];
const extraTools = Array.isArray(extrasDoc?.tools) ? extrasDoc.tools : [];

// These two entries are legacy aliases left in tools.json. Their canonical
// registry entries live in the studio tree / tools-extra.json and are used
// for architecture validation. Keeping this compatibility filter prevents a
// stale /tools/* alias from making the canonical Studio registry invalid.
const legacyAliasIds = new Set(['document-studio', 'document-templates']);
const tools = [
  ...rawTools.filter(tool => !legacyAliasIds.has(tool?.id)),
  ...extraTools.filter(tool => !legacyAliasIds.has(tool?.id)),
  ...extraTools.filter(tool => legacyAliasIds.has(tool?.id)),
];

if (!Number.isInteger(studiosDoc?.schemaVersion) || studiosDoc.schemaVersion < 3) fail('studios.json schemaVersion must be an integer >= 3');
if (studiosDoc?.architecture !== 'studios') fail('studios.json architecture must be "studios"');
if (!Number.isInteger(toolsDoc?.version) || toolsDoc.version < 6) fail('tools.json version must be an integer >= 6');
if (toolsDoc?.architecture !== 'studios') fail('tools.json architecture must be "studios"');
if (!studios.length) fail('No Studios are registered');
if (!tools.length) warn('No Experiences are registered');

const studioIds = new Set();
const studioSlugs = new Set();
const studioById = new Map();
const studioBySlug = new Map();
for (const studio of studios) {
  if (!isObject(studio)) {
    fail('Invalid Studio entry');
    continue;
  }
  if (!studio.id) fail('Studio missing ID');
  if (studio.id && studioIds.has(studio.id)) fail(`Duplicate Studio ID: ${studio.id}`);
  if (studio.id) studioIds.add(studio.id);
  if (!isSlug(studio.id)) fail(`Invalid Studio ID slug: ${studio.id}`);
  if (!studio.name) fail(`Studio missing name: ${studio.id || '<unknown>'}`);
  if (!isSlug(studio.slug)) fail(`Invalid Studio slug: ${studio.id || '<unknown>'}`);
  if (studio.slug && studioSlugs.has(studio.slug)) fail(`Duplicate Studio slug: ${studio.slug}`);
  if (studio.slug) studioSlugs.add(studio.slug);
  if (!isStatus(studio.status)) fail(`Invalid Studio status: ${studio.id}: ${studio.status}`);
  if (!Array.isArray(studio.tools)) fail(`Studio tools must be an array: ${studio.id}`);
  if (studio.status === 'planned' && Array.isArray(studio.tools) && studio.tools.length) fail(`Planned Studio cannot expose Experiences: ${studio.id}`);
  studioById.set(studio.id, studio);
  if (studio.slug) studioBySlug.set(studio.slug, studio);
}

const toolIds = new Set();
const toolSlugs = new Set();
const toolUrls = new Set();
const toolById = new Map();
const registeredIds = new Set();

for (const tool of tools) {
  if (!isObject(tool)) {
    fail('Invalid Experience entry');
    continue;
  }
  const id = tool.id || '<unknown>';
  if (!tool.id) fail('Experience missing ID');
  if (tool.id && toolIds.has(tool.id)) fail(`Duplicate Experience ID: ${tool.id}`);
  if (tool.id) toolIds.add(tool.id);
  if (!isSlug(tool.slug)) fail(`Invalid Experience slug: ${id}: ${tool.slug}`);
  if (tool.slug && toolSlugs.has(tool.slug)) fail(`Duplicate Experience slug: ${tool.slug}`);
  if (tool.slug) toolSlugs.add(tool.slug);
  if (!tool.name) fail(`Experience missing name: ${id}`);
  if (!studioById.has(tool.studio)) fail(`Experience references unknown Studio: ${id} -> ${tool.studio}`);
  if (tool.studioName !== studioById.get(tool.studio)?.name) fail(`Studio name mismatch: ${id}`);
  if (!isStatus(tool.status)) fail(`Invalid Experience status: ${id}: ${tool.status}`);
  if (!Number.isFinite(tool.rankScore)) fail(`Experience rankScore must be numeric: ${id}`);
  if (!Array.isArray(tool.tags)) fail(`Experience tags must be an array: ${id}`);

  const url = normalizeUrl(tool.url);
  if (!url) {
    fail(`Invalid Experience URL: ${id}: ${tool.url}`);
  } else {
    if (toolUrls.has(url)) fail(`Duplicate Experience URL: ${url}`);
    toolUrls.add(url);
    const studio = studioById.get(tool.studio);
    const expected = studio && tool.slug ? `/studios/${studio.slug}/${tool.slug}/` : null;
    if (expected && url !== expected) fail(`Non-canonical Experience URL: ${id}: expected ${expected}, got ${url}`);
    const page = pageForUrl(url);
    if (!page || !fs.existsSync(page)) fail(`Missing Experience page: ${id} -> ${url}`);
  }
  toolById.set(tool.id, tool);
}

for (const studio of studios) {
  const registered = Array.isArray(studio.tools) ? studio.tools : [];
  const seen = new Set();
  for (const id of registered) {
    if (seen.has(id)) fail(`Duplicate Studio Experience: ${studio.id} -> ${id}`);
    seen.add(id);
    if (registeredIds.has(id)) fail(`Experience registered in multiple Studios: ${id}`);
    registeredIds.add(id);
    const tool = toolById.get(id);
    if (!tool) {
      fail(`Unregistered Experience reference: ${studio.id} -> ${id}`);
      continue;
    }
    if (tool.studio !== studio.id) fail(`Studio mismatch: ${id} points to ${tool.studio}, registered in ${studio.id}`);
  }
}

for (const tool of tools) {
  if (!registeredIds.has(tool.id)) fail(`Experience not registered in any Studio: ${tool.id}`);
}

const physicalPages = [];
if (fs.existsSync(studiosRoot)) {
  for (const studioEntry of fs.readdirSync(studiosRoot, { withFileTypes: true })) {
    if (!studioEntry.isDirectory()) continue;
    const studio = studioBySlug.get(studioEntry.name);
    if (!studio) fail(`Physical Studio directory has no registry entry: ${studioEntry.name}`);
    const studioDir = path.join(studiosRoot, studioEntry.name);
    for (const experienceEntry of fs.readdirSync(studioDir, { withFileTypes: true })) {
      if (!experienceEntry.isDirectory()) continue;
      const url = `/studios/${studioEntry.name}/${experienceEntry.name}/`;
      const index = path.join(studioDir, experienceEntry.name, 'index.html');
      if (!fs.existsSync(index)) continue;
      physicalPages.push(url);
      const tool = tools.find(item => item.url === url);
      if (!tool) fail(`Physical Experience page has no registry entry: ${url}`);
      else if (tool.status !== 'active') fail(`Physical Experience page must be active: ${tool.id}`);
      else if (!registeredIds.has(tool.id)) fail(`Physical Experience page is not registered in a Studio: ${url}`);
    }
  }
}

for (const tool of tools.filter(item => item.status === 'active')) {
  const page = pageForUrl(tool.url);
  if (page && !fs.existsSync(page)) fail(`Active Experience has no physical page: ${tool.id}`);
}

for (const studio of studios.filter(item => item.status === 'active')) {
  const registeredActive = (studio.tools || []).filter(id => toolById.get(id)?.status === 'active');
  const physical = physicalPages.filter(url => url.startsWith(`/studios/${studio.slug}/`));
  if (registeredActive.length !== physical.length) {
    fail(`Studio page count mismatch: ${studio.id}: active registry=${registeredActive.length}, physical=${physical.length}`);
  }
}

for (const studio of studios) {
  if (!isSlug(studio.slug)) continue;
  const page = path.join(studiosRoot, studio.slug, 'index.html');
  if (studio.status === 'active' && !fs.existsSync(page)) fail(`Active Studio has no page: /studios/${studio.slug}/`);
  if (studio.status !== 'active' && fs.existsSync(page)) warn(`Non-active Studio has a physical page: /studios/${studio.slug}/`);
}

if (errors.length) {
  console.error('\nNEXAUREN ARCHITECTURE VALIDATION FAILED');
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log('NEXAUREN ARCHITECTURE VALIDATION: OK');
for (const studio of studios) {
  const active = (studio.tools || []).filter(id => toolById.get(id)?.status === 'active').length;
  console.log(`- ${studio.name}: ${studio.status}; ${active} active Experience(s)`);
}
for (const warning of warnings) console.warn(`WARNING: ${warning}`);
