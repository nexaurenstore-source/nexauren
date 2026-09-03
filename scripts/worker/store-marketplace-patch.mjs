import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(workerUrl, 'utf8');

if (!source.includes('const __storeMarketplaceUrl')) {
  const module = `
const __storeMarketplaceUrl = new URL(r.url);

async function __storeCategories(r, e) {
  if (!e.MARKETPLACE_DB) return json({ error: 'Marketplace database is not configured.' }, 503, cors(r));
  const rows = await e.MARKETPLACE_DB.prepare(
    'SELECT id,name,description,icon,sort_order FROM store_categories WHERE enabled=1 ORDER BY sort_order ASC,id ASC'
  ).all();
  return json({ categories: rows.results || [] }, 200, { ...cors(r), 'cache-control': 'public, max-age=60' });
}

async function __storeProducts(r, e) {
  if (!e.MARKETPLACE_DB) return json({ error: 'Marketplace database is not configured.' }, 503, cors(r));
  const u = new URL(r.url);
  const q = clean(u.searchParams.get('q'));
  const category = clean(u.searchParams.get('category'));
  const format = clean(u.searchParams.get('format'));
  const price = clean(u.searchParams.get('price'));
  const rating = Number(u.searchParams.get('rating') || 0);
  const sort = clean(u.searchParams.get('sort')) || 'relevance';
  const page = Math.max(1, Number.parseInt(u.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(48, Math.max(1, Number.parseInt(u.searchParams.get('limit') || '24', 10) || 24));
  const offset = (page - 1) * limit;
  const where = ['p.enabled=1'];
  const params = [];

  if (q) {
    where.push('(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.format) LIKE ? OR LOWER(c.name) LIKE ?)');
    const term = '%' + q.toLowerCase() + '%';
    params.push(term, term, term, term);
  }
  if (category) {
    where.push('(c.id=? OR LOWER(c.name)=LOWER(?))');
    params.push(category, category);
  }
  if (format) { where.push('LOWER(p.format)=LOWER(?)'); params.push(format); }
  if (rating > 0) { where.push('p.rating>=?'); params.push(rating); }
  if (price === 'free') where.push('p.price_minor=0');
  if (price === 'under5') where.push('p.price_minor>0 AND p.price_minor<500');
  if (price === '5to15') where.push('p.price_minor>=500 AND p.price_minor<=1500');
  if (price === 'over15') where.push('p.price_minor>1500');

  const orderBy = {
    newest: 'p.created_at DESC,p.id DESC',
    rating: 'p.rating DESC,p.created_at DESC,p.id DESC',
    'price-low': 'p.price_minor ASC,p.created_at DESC,p.id DESC',
    'price-high': 'p.price_minor DESC,p.created_at DESC,p.id DESC',
    relevance: 'p.featured DESC,p.sort_order ASC,p.created_at DESC,p.id DESC',
  }[sort] || 'p.featured DESC,p.sort_order ASC,p.created_at DESC,p.id DESC';
  const filterSql = where.join(' AND ');
  const count = await e.MARKETPLACE_DB.prepare(
    \`SELECT COUNT(*) AS total FROM store_products p JOIN store_categories c ON c.id=p.category_id WHERE \${filterSql}\`
  ).bind(...params).first();
  const rows = await e.MARKETPLACE_DB.prepare(
    \`SELECT p.id,p.name,p.slug,p.category_id,c.name AS category,p.description,p.format,p.price_minor,p.currency,p.rating,p.icon,p.tag,p.featured,p.metadata_json,p.created_at,p.updated_at FROM store_products p JOIN store_categories c ON c.id=p.category_id WHERE \${filterSql} ORDER BY \${orderBy} LIMIT ? OFFSET ?\`
  ).bind(...params, limit, offset).all();

  const products = (rows.results || []).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    categoryId: p.category_id,
    category: p.category,
    desc: p.description,
    format: p.format,
    price: Number(p.price_minor || 0) / 100,
    priceMinor: Number(p.price_minor || 0),
    currency: p.currency,
    rating: Number(p.rating || 0),
    icon: p.icon,
    tag: p.tag,
    featured: Boolean(p.featured),
    metadata: (() => { try { return p.metadata_json ? JSON.parse(p.metadata_json) : {}; } catch { return {}; } })(),
    date: Number(p.created_at || 0),
  }));
  return json({ products, pagination: { page, limit, total: Number(count?.total || 0), pages: Math.ceil(Number(count?.total || 0) / limit) } }, 200, { ...cors(r), 'cache-control': 'public, max-age=60' });
}

async function __handleStoreMarketplaceRoute(r, e) {
  const u = new URL(r.url);
  if (!u.pathname.startsWith('/api/store/')) return null;
  if (r.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(r) });
  if (r.method !== 'GET') return json({ error: 'Method not allowed' }, 405, cors(r));
  if (u.pathname === '/api/store/categories') return __storeCategories(r, e);
  if (u.pathname === '/api/store/products') return __storeProducts(r, e);
  return json({ error: 'Not found' }, 404, cors(r));
}
`;
  const marker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!marker.test(source)) throw new Error('[store-patch] Worker fetch marker not found.');
  source = source.replace(marker, '$&' + module + '\n', 1);
  source = source.replace(marker, '$&\n    const __storeResponse = await __handleStoreMarketplaceRoute(r, e);\n    if (__storeResponse) return __storeResponse;\n', 1);
}

await writeFile(workerUrl, source, 'utf8');
console.log('[store-patch] Marketplace Store API connected to MARKETPLACE_DB.');
