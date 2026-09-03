const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
});

const uuid = () => crypto.randomUUID();
const clean = (v) => String(v ?? '').trim();
const now = () => Math.floor(Date.now() / 1000);
const cors = () => ({
  'access-control-allow-origin': 'https://nexaurenstory.com',
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'Content-Type, Accept',
  'access-control-allow-methods': 'GET,POST,PUT,DELETE,OPTIONS',
});
const body = async (r) => { try { return await r.json(); } catch { return null; } };

async function sha256(value) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

function sessionToken(r) {
  const cookie = r.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)nexauren_session=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

async function currentUser(r, env) {
  const raw = sessionToken(r);
  if (!raw || !env.DB) return null;
  const user = await env.DB.prepare(
    'SELECT u.id,u.email,u.username,u.created_at,u.updated_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?1 AND s.expires_at>?2 LIMIT 1',
  ).bind(await sha256(raw), now()).first();
  if (user && env.MARKETPLACE_DB) {
    const timestamp = now();
    await env.MARKETPLACE_DB.prepare(
      'INSERT INTO store_users(user_id,email,username,created_at,updated_at) VALUES(?1,?2,?3,?4,?4) ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,username=excluded.username,updated_at=excluded.updated_at',
    ).bind(user.id, user.email || '', user.username || '', user.created_at || timestamp).run();
  }
  return user;
}

async function requireUser(r, env) {
  const user = await currentUser(r, env);
  return user || null;
}

async function requireAdmin(r, env) {
  const user = await currentUser(r, env);
  if (!user) return null;
  return String(user.email || '').toLowerCase() === String(env.ADMIN_EMAIL || '').trim().toLowerCase() ? user : null;
}

function parseJson(value, fallback) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function productView(p) {
  if (!p) return null;
  return {
    id: p.id, name: p.name, slug: p.slug, categoryId: p.category_id, category: p.category,
    description: p.description, shortDescription: p.short_description, longDescription: p.long_description,
    format: p.format, price: Number(p.price_minor || 0) / 100, priceMinor: Number(p.price_minor || 0),
    currency: p.currency, rating: Number(p.rating || 0), icon: p.icon, tag: p.tag,
    featured: Boolean(p.featured), enabled: Boolean(p.enabled), sortOrder: Number(p.sort_order || 0),
    coverImageUrl: p.cover_image_url, gallery: parseJson(p.gallery_json, []), videoUrl: p.video_url,
    features: parseJson(p.features_json, []), included: parseJson(p.included_json, []), requirements: p.requirements,
    licenseType: p.license_type, licenseText: p.license_text, version: p.version, fileSize: p.file_size,
    previewUrl: p.preview_url, tags: parseJson(p.tags_json, []), seoTitle: p.seo_title,
    seoDescription: p.seo_description, metadata: parseJson(p.metadata_json, {}),
    createdAt: Number(p.created_at || 0), updatedAt: Number(p.updated_at || 0),
  };
}

async function categories(r, env) {
  const rows = await env.MARKETPLACE_DB.prepare(
    'SELECT id,name,description,icon,sort_order FROM store_categories WHERE enabled=1 ORDER BY sort_order,id',
  ).all();
  return json({ categories: rows.results || [] }, 200, { ...cors(r), 'cache-control': 'public, max-age=60' });
}

async function products(r, env) {
  const u = new URL(r.url);
  const q = clean(u.searchParams.get('q')).toLowerCase();
  const category = clean(u.searchParams.get('category'));
  const format = clean(u.searchParams.get('format')).toLowerCase();
  const price = clean(u.searchParams.get('price'));
  const rating = Number(u.searchParams.get('rating') || 0);
  const sort = clean(u.searchParams.get('sort')) || 'relevance';
  const page = Math.max(1, Number.parseInt(u.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(48, Math.max(1, Number.parseInt(u.searchParams.get('limit') || '24', 10) || 24));
  const offset = (page - 1) * limit;
  const where = ['p.enabled=1', 'c.enabled=1'];
  const params = [];
  if (q) { where.push('(LOWER(p.name) LIKE ? OR LOWER(COALESCE(p.description,\'\')) LIKE ? OR LOWER(COALESCE(p.format,\'\')) LIKE ? OR LOWER(c.name) LIKE ?)'); const t = `%${q}%`; params.push(t, t, t, t); }
  if (category) { where.push('(c.id=? OR LOWER(c.name)=LOWER(?))'); params.push(category, category); }
  if (format) { where.push('LOWER(COALESCE(p.format,\'\'))=?'); params.push(format); }
  if (rating > 0) { where.push('p.rating>=?'); params.push(rating); }
  if (price === 'free') where.push('p.price_minor=0');
  if (price === 'under5') where.push('p.price_minor>0 AND p.price_minor<500');
  if (price === '5to15') where.push('p.price_minor>=500 AND p.price_minor<=1500');
  if (price === 'over15') where.push('p.price_minor>1500');
  const order = ({ newest:'p.created_at DESC,p.id DESC', rating:'p.rating DESC,p.created_at DESC,p.id DESC', 'price-low':'p.price_minor ASC,p.created_at DESC,p.id DESC', 'price-high':'p.price_minor DESC,p.created_at DESC,p.id DESC', relevance:'p.featured DESC,p.sort_order ASC,p.created_at DESC,p.id DESC' })[sort] || 'p.featured DESC,p.sort_order ASC,p.created_at DESC,p.id DESC';
  const filter = where.join(' AND ');
  const count = await env.MARKETPLACE_DB.prepare(`SELECT COUNT(*) AS total FROM store_products p JOIN store_categories c ON c.id=p.category_id WHERE ${filter}`).bind(...params).first();
  const rows = await env.MARKETPLACE_DB.prepare(`SELECT p.*,c.name AS category FROM store_products p JOIN store_categories c ON c.id=p.category_id WHERE ${filter} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...params, limit, offset).all();
  return json({ products:(rows.results || []).map(productView), pagination:{page,limit,total:Number(count?.total || 0),pages:Math.ceil(Number(count?.total || 0)/limit)} }, 200, { ...cors(r), 'cache-control': 'public, max-age=60' });
}

async function productBySlug(r, env, slug) {
  const p = await env.MARKETPLACE_DB.prepare('SELECT p.*,c.name AS category FROM store_products p LEFT JOIN store_categories c ON c.id=p.category_id WHERE p.slug=?1 AND p.enabled=1 LIMIT 1').bind(slug).first();
  if (!p) return json({ error:'Product not found.' }, 404, cors(r));
  const related = await env.MARKETPLACE_DB.prepare('SELECT p.*,c.name AS category FROM store_related_products rel JOIN store_products p ON p.id=rel.related_product_id LEFT JOIN store_categories c ON c.id=p.category_id WHERE rel.product_id=?1 AND p.enabled=1 ORDER BY rel.sort_order,p.created_at DESC LIMIT 12').bind(p.id).all();
  const reviews = await env.MARKETPLACE_DB.prepare('SELECT id,rating,title,body,created_at FROM store_reviews WHERE product_id=?1 AND status=\'approved\' ORDER BY created_at DESC LIMIT 20').bind(p.id).all();
  return json({ product:productView(p), related:(related.results || []).map(productView), reviews:reviews.results || [] }, 200, { ...cors(r), 'cache-control':'public, max-age=30' });
}

// ... existing Marketplace API handlers remain unchanged ...

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/store/'))return api(request,env);
    if(url.pathname==='/nexauren-store'||url.pathname.startsWith('/nexauren-store/')){
      const path=url.pathname.replace(/^\/nexauren-store/,'')||'/';
      const assetUrl=new URL(request.url);
      // Cloudflare Assets reliably resolves explicit index files, including nested Marketplace pages.
      assetUrl.pathname=path.endsWith('/') ? `${path}index.html` : path;
      return env.ASSETS.fetch(new Request(assetUrl.toString(),request));
    }
    return new Response('Nexauren Marketplace Worker',{status:200,headers:{'content-type':'text/plain;charset=UTF-8'}});
  },
};
