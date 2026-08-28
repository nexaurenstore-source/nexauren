const fs = require('fs');
const path = require('path');

const BASE = 'https://nexaurenstory.com';
const toolsPath = path.join(process.cwd(), 'frontend', 'data', 'tools.json');
const sitemapPath = path.join(process.cwd(), 'frontend', 'sitemap.xml');

const fixedUrls = [
  '/',
  '/tools/',
  '/categories/',
  '/about.html',
  '/faq.html',
  '/privacy.html',
  '/terms.html'
];

const data = JSON.parse(fs.readFileSync(toolsPath, 'utf8'));
const tools = Array.isArray(data.tools) ? data.tools : [];
const toolUrls = tools
  .filter(tool =>
    tool &&
    tool.status === 'active' &&
    typeof tool.url === 'string' &&
    tool.url.trim()
  )
  .map(tool => tool.url.trim());

const urls = [...new Set([...fixedUrls, ...toolUrls])]
  .filter(url => url.startsWith('/'))
  .map(url => `${BASE}${url}`);

const escapeXml = value => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`),
  '</urlset>',
  ''
].join('\n');

fs.writeFileSync(sitemapPath, xml, 'utf8');
console.log(`Generated ${sitemapPath} with ${urls.length} URLs.`);
