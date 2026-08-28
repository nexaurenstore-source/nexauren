import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const data = path.join(root, 'frontend', 'data');
const sitemapPath = path.join(root, 'frontend', 'sitemap.xml');
const studios = JSON.parse(fs.readFileSync(path.join(data, 'studios.json'), 'utf8')).studios || [];
const tools = JSON.parse(fs.readFileSync(path.join(data, 'tools.json'), 'utf8')).tools || [];
const base = 'https://nexaurenstory.com';
const fixed = ['/', '/studios/', '/ranking/', '/about.html', '/faq.html', '/privacy.html', '/terms.html'];
const expected = new Set([
  ...fixed,
  ...studios.filter(s => s?.status === 'active').map(s => `/studios/${s.slug}/`),
  ...tools.filter(t => t?.status === 'active' && typeof t.url === 'string').map(t => t.url.trim()),
]);

if (!fs.existsSync(sitemapPath)) {
  console.error('NEXAUREN SEO VALIDATION: FAILED');
  console.error('ERROR: frontend/sitemap.xml is missing.');
  process.exit(1);
}

const xml = fs.readFileSync(sitemapPath, 'utf8');
const actual = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].replace(base, '')));
const missing = [...expected].filter(url => !actual.has(url));
const stale = [...actual].filter(url => !expected.has(url));

if (missing.length || stale.length) {
  console.error('NEXAUREN SEO VALIDATION: FAILED');
  for (const url of missing) console.error(`ERROR: sitemap missing canonical registry URL: ${url}`);
  for (const url of stale) console.error(`ERROR: sitemap contains URL outside canonical registry: ${url}`);
  process.exit(1);
}

console.log(`NEXAUREN SEO VALIDATION: OK (${actual.size} canonical URLs)`);
