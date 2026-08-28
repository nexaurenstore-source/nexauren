import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const frontend = path.join(root, 'frontend');
const data = path.join(frontend, 'data');
const sitemapPath = path.join(frontend, 'sitemap.xml');
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

for (const tool of tools.filter(t => t?.status === 'active')) {
  const url = String(tool.url || '').trim();
  const page = path.join(frontend, url.replace(/^\//, ''), 'index.html');
  if (!fs.existsSync(page)) continue;
  const html = fs.readFileSync(page, 'utf8');
  const canonical = `${base}${url}`;
  if (!html.includes(`<link rel="canonical" href="${canonical}">`)) errors.push(`Experience ${tool.id} is missing canonical metadata for ${canonical}`);
  if (!html.includes('<meta name="description"')) errors.push(`Experience ${tool.id} is missing a meta description`);
  if (!html.match(/<title>[^<]+<\/title>/)) errors.push(`Experience ${tool.id} is missing a title`);
}

if (errors.length) {
  console.error('NEXAUREN SEO VALIDATION: FAILED');
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}

console.log(`NEXAUREN SEO VALIDATION: OK (${expected.size} canonical URLs)`);
