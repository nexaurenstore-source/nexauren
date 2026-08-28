import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const frontend = path.join(root, 'frontend');
const data = path.join(frontend, 'data');
const workerPath = path.join(root, '.worker-build', 'worker.js');
const errors = [];

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const studiosDoc = readJson(path.join(data, 'studios.json'));
const toolsDoc = readJson(path.join(data, 'tools.json'));
const studios = Array.isArray(studiosDoc.studios) ? studiosDoc.studios : [];
const tools = Array.isArray(toolsDoc.tools) ? toolsDoc.tools : [];
const worker = fs.existsSync(workerPath) ? fs.readFileSync(workerPath, 'utf8') : '';
const fail = (message) => errors.push(message);
const unique = (values, label) => {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) fail(`Duplicate ${label}: ${value}`);
    seen.add(value);
  }
};

if (studiosDoc.schemaVersion !== 3) fail(`Unexpected studios registry schemaVersion: ${studiosDoc.schemaVersion}`);
if (studiosDoc.architecture !== 'studios' || toolsDoc.architecture !== 'studios') fail('Registry architecture marker is not "studios" in both registries.');

unique(studios.map((studio) => studio.id), 'Studio id');
unique(studios.map((studio) => studio.slug), 'Studio slug');
unique(tools.map((tool) => tool.id), 'Experience id');
unique(tools.map((tool) => tool.url), 'Experience URL');
unique(tools.map((tool) => tool.slug), 'Experience slug');

const studioById = new Map(studios.map((studio) => [studio.id, studio]));
const activeStudioSlugs = new Set(studios.filter((studio) => studio.status === 'active').map((studio) => studio.slug));
const activeToolUrls = new Set();

for (const studio of studios) {
  if (!studio.id || !studio.slug || !studio.name) fail('Studio entry is missing id, slug, or name.');
  if (!['active', 'planned'].includes(studio.status)) fail(`Studio ${studio.id} has invalid status: ${studio.status}`);
  if (studio.status === 'active') {
    const page = path.join(frontend, 'studios', studio.slug, 'index.html');
    if (!fs.existsSync(page)) fail(`Active Studio page is missing: /studios/${studio.slug}/`);
  }
  if (!Array.isArray(studio.tools)) fail(`Studio ${studio.id} must define a tools array.`);
}

for (const tool of tools) {
  if (!tool.id || !tool.slug || !tool.name || !tool.url || !tool.studio) fail('Experience entry is missing a required identity field.');
  const studio = studioById.get(tool.studio);
  if (!studio) {
    fail(`Experience ${tool.id} references unknown Studio ${tool.studio}.`);
    continue;
  }
  if (!studio.tools.includes(tool.id)) fail(`Experience ${tool.id} is not registered by Studio ${studio.id}.`);
  if (tool.status === 'active') {
    const url = String(tool.url).trim();
    activeToolUrls.add(url);
    const expectedPrefix = `/studios/${studio.slug}/`;
    if (!url.startsWith(expectedPrefix)) fail(`Experience ${tool.id} URL is outside its Studio: ${url}`);
    const page = path.join(frontend, url.replace(/^\//, ''), 'index.html');
    if (!fs.existsSync(page)) fail(`Active Experience page is missing: ${url}`);
  }
}

for (const studio of studios) {
  const registered = new Set(studio.tools);
  for (const tool of tools.filter((candidate) => candidate.studio === studio.id)) {
    if (!registered.has(tool.id)) fail(`Registry mismatch: ${tool.id} is missing from ${studio.id}.tools.`);
  }
}

if (!fs.existsSync(workerPath)) fail('Generated Worker is missing.');
if (worker && !worker.includes('const __nexaurenSeoMap')) fail('Generated Worker lacks the registry-driven SEO map.');
if (worker && !worker.includes('__nexaurenAdminApiGuard')) fail('Generated Worker lacks the administrator API perimeter guard.');
if (worker && !worker.includes('HttpOnly; Secure; SameSite=Lax')) fail('Generated Worker lacks secure session cookie flags.');
if (worker && worker.includes("access-control-allow-origin': r.headers.get('Origin') || '*'")) fail('Generated Worker still reflects arbitrary CORS origins.');
if (worker && worker.includes('return bytesToHex(d) === a[2]')) fail('Generated Worker still contains direct password digest comparison.');

const sourceFiles = [
  'worker.js',
  'scripts/build-worker.mjs',
  'scripts/security-audit.mjs',
  'scripts/runtime-audit.mjs',
  'scripts/validate-seo.mjs',
];
for (const relative of sourceFiles) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) fail(`Required source file is missing or empty: ${relative}`);
}

const suspiciousSecret = /(?:sk-[A-Za-z0-9_-]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA|EC|OPENSSH|PRIVATE) KEY-----)/;
for (const relative of sourceFiles) {
  const file = path.join(root, relative);
  if (fs.existsSync(file) && suspiciousSecret.test(fs.readFileSync(file, 'utf8'))) fail(`Possible hard-coded secret detected in ${relative}.`);
}

const wrangler = readJson(path.join(root, 'wrangler.json'));
if (wrangler.compatibility_date !== '2026-08-28') fail(`Wrangler compatibility_date must be 2026-08-28, got ${wrangler.compatibility_date}.`);
if (!Array.isArray(wrangler.compatibility_flags) || !wrangler.compatibility_flags.includes('nodejs_compat')) fail('Wrangler nodejs_compat flag is missing.');
if (!wrangler.observability?.enabled) fail('Wrangler observability must be enabled for production.');
if (wrangler.main !== '.worker-build/worker.js') fail('Wrangler main must point to the canonical generated Worker artifact.');
if (!wrangler.d1_databases?.some((binding) => binding.binding === 'DB')) fail('D1 DB binding is missing from Wrangler configuration.');

if (errors.length) {
  console.error('NEXAUREN FINAL PRODUCTION AUDIT: FAILED');
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log('NEXAUREN FINAL PRODUCTION AUDIT: OK');
console.log(`- ${studios.length} Studios validated (${activeStudioSlugs.size} active)`);
console.log(`- ${tools.length} Experiences validated (${activeToolUrls.size} active)`);
console.log('- registry identity, ownership, URLs and physical pages consistent');
console.log('- generated Worker security/runtime/SEO invariants present');
console.log('- production Wrangler configuration validated');
console.log('- no obvious hard-coded secret pattern detected');
