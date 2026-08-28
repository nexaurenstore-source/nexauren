import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const frontend = path.join(root, 'frontend');
const data = path.join(frontend, 'data');
const sitemapPath = path.join(frontend, 'sitemap.xml');
const workerPath = path.join(root, '.worker-build', 'worker.js');
const studios = JSON.parse(fs.readFileSync(path.join(data, 'studios.json'), 'utf8')).studios || [];
const tools = JSON.parse(fs.readFileSync(path.join(data, 'tools.json'), 'utf8')).tools || [];
const base = 'https://nexaurenstory.com';
const fixed = ['/', '/studios/', '/ranking/', '/about.html', '/faq.html', '/privacy.html', '/terms.html'];
const expected = new Set([
  ...fixed,
  ...studios.filter(s => s?.status === 'active').map(s => `/studios/${s.slug}/`),
  ...tools.filter(t => t?.status === 'active' && typeof t.url === 'string').map(t => t.url.trim()),
]);
const errors = [];

if (!fs.existsSync(sitemapPath)) errors.push('frontend/sitemap.xml is missing.');
else {
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const actual = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(base, '')));
  for (const url of expected) if (!actual.has(url)) errors.push(`sitemap missing canonical registry URL: ${url}`);
  for (const url of actual) if (!expected.has(url)) errors.push(`sitemap contains URL outside canonical registry: ${url}`);
}

if (!fs.existsSync(workerPath)) errors.push('Generated Worker is missing; registry-driven SEO cannot be verified.');
else {
  const worker = fs.readFileSync(workerPath, 'utf8');
  if (!worker.includes('const __nexaurenSeoMap')) errors.push('Generated Worker is missing registry-driven SEO metadata map.');
  if (!worker.includes('__nexaurenSeoInjection')) errors.push('Generated Worker is missing SEO metadata repair injection.');
}

for (const tool of tools.filter(t => t?.status === 'active')) {
  const url = String(tool.url || '').trim();
  const page = path.join(frontend, url.replace(/^\//, ''), 'index.html');
  if (!fs.existsSync(page)) continue;
  const html = fs.readFileSync(page, 'utf8');
  if (!html.match(/<title>[^<]+<\/title>/)) errors.push(`Experience ${tool.id} is missing a title`);
}

if (errors.length) {
  console.error('NEXAUREN SEO VALIDATION: FAILED');
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`NEXAUREN SEO VALIDATION: OK (${expected.size} canonical URLs; registry-driven runtime metadata verified)`);
