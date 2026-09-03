import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(workerUrl, 'utf8');

if (!source.includes('async function __handleStoreMarketplaceRoute')) {
  const module = `
async function __storeCategories(r, e) {
  if (!e.MARKETPLACE_DB) return json({ error: 'Marketplace database is not configured.' }, 503, cors(r));
  const rows = await e.MARKETPLACE_DB.prepare('SELECT id,name,description,icon,sort_order FROM store_categories WHERE enabled=1 ORDER BY sort_order ASC,id ASC').all();
  return json({ categories: rows.results || [] }, 200, { ...cors(r), 'cache-control': 'public, max-age=60' });
}

async function __storeProducts(r, e) {
  if (!e.MARKETPLACE_DB) return json({ error: 'Marketplace database is not configured.' }, 503, cors(r));
  const u = new URL(r.url);
  const q = clean(u.searchParams.get('q')), category = clean(u.searchParams.get('category')), format = clean(u.searchParams.get('format')), price = clean(u.searchParams.get('price'));
  const rating = Number(u.searchParams.get('rating') || 0), sort = clean(u.searchParams.get('sort')) || 'relevance';
  const page = Math.max(1, Number.parseInt(u.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(48, Math.max(1, Number.parseInt(u.searchParams.get('limit') || '24', 10) || 24));
  const offset = (page - 1) * limit, where = ['p.enabled=1'], params = [];
  if (q) { where.push('(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(p.format) LIKE ? OR LOWER(c.name) LIKE ?)'); const term = '%' + q.toLowerCase() + '%'; params.push(term,term,term,term); }
  if (category) { where.push('(c.id=? OR LOWER(c.name)=LOWER(?))'); params.push(category,category); }
  if (format) { where.push('LOWER(p.format)=LOWER(?)'); params.push(format); }
  if (rating > 0) { where.push('p.rating>=?'); params.push(rating); }
  if (price === 'free') where.push('p.price_minor=0');
  if (price === 'under5') where.push('p.price_minor>0 AND p.price_minor<500');
  if (price === '5to15') where.push('p.price_minor>=500 AND p.price_minor<=1500');
  if (price === 'over15') where.push('p.price_minor>1500');
  const orderBy = { newest:'p.created_at DESC,p.id DESC', rating:'p.rating DESC,p.created_at DESC,p.id DESC', 'price-low':'p.price_minor ASC,p.created_at DESC,p.id DESC', 'price-high':'p.price_minor DESC,p.created_at DESC,p.id DESC', relevance:'p.featured DESC,p.sort_order ASC,p.created_at DESC,p.id DESC' }[sort] || 'p.featured DESC,p.sort_order ASC,p.created_at DESC,p.id DESC';
  const filterSql = where.join(' AND ');
  const count = await e.MARKETPLACE_DB.prepare(\`SELECT COUNT(*) AS total FROM store_products p JOIN store_categories c ON c.id=p.category_id WHERE \${filterSql}\`).bind(...params).first();
  const rows = await e.MARKETPLACE_DB.prepare(\`SELECT p.id,p.name,p.slug,p.category_id,c.name AS category,p.description,p.format,p.price_minor,p.currency,p.rating,p.icon,p.tag,p.featured,p.metadata_json,p.created_at,p.updated_at FROM store_products p JOIN store_categories c ON c.id=p.category_id WHERE \${filterSql} ORDER BY \${orderBy} LIMIT ? OFFSET ?\`).bind(...params,limit,offset).all();
  const products = (rows.results || []).map(p => ({id:p.id,name:p.name,slug:p.slug,categoryId:p.category_id,category:p.category,desc:p.description,format:p.format,price:Number(p.price_minor||0)/100,priceMinor:Number(p.price_minor||0),currency:p.currency,rating:Number(p.rating||0),icon:p.icon,tag:p.tag,featured:Boolean(p.featured),metadata:(()=>{try{return p.metadata_json?JSON.parse(p.metadata_json):{};}catch{return {};}})(),date:Number(p.created_at||0)}));
  return json({products,pagination:{page,limit,total:Number(count?.total||0),pages:Math.ceil(Number(count?.total||0)/limit)}},200,{...cors(r),'cache-control':'public,max-age=60'});
}

async function __storeAdminProducts(r,e) {
  if (!e.MARKETPLACE_DB) return json({error:'Marketplace database is not configured.'},503,cors(r));
  if (!(await isAdmin(r,e))) return json({error:'Admin access required.'},403,cors(r));
  const rows = await e.MARKETPLACE_DB.prepare('SELECT p.id,p.name,p.slug,p.category_id,c.name AS category,p.description,p.format,p.price_minor,p.currency,p.rating,p.icon,p.tag,p.featured,p.enabled,p.sort_order,p.metadata_json,p.created_at,p.updated_at FROM store_products p JOIN store_categories c ON c.id=p.category_id ORDER BY p.created_at DESC,p.id DESC').all();
  return json({products:rows.results||[]},200,cors(r));
}

async function __storeAdminProduct(r,e,id) {
  if (!e.MARKETPLACE_DB) return json({error:'Marketplace database is not configured.'},503,cors(r));
  if (!(await isAdmin(r,e))) return json({error:'Admin access required.'},403,cors(r));
  const d = await body(r) || {}, isUpdate = Boolean(id);
  const name=clean(d.name), slug=clean(d.slug), categoryId=clean(d.category_id), description=clean(d.description), format=clean(d.format)||'DIGITAL', currency=clean(d.currency)||'USD', icon=clean(d.icon)||'📦', tag=clean(d.tag);
  const priceMinor=Number(d.price_minor), rating=Number(d.rating||0), featured=d.featured?1:0, enabled=d.enabled===false?0:1, sortOrder=Number(d.sort_order||0), metadataJson=typeof d.metadata_json==='string'?d.metadata_json:JSON.stringify(d.metadata||{});
  if (!name||!slug||!categoryId||!Number.isSafeInteger(priceMinor)||priceMinor<0||!Number.isFinite(rating)||rating<0||rating>5) return json({error:'Name, slug, category, non-negative integer price_minor and rating 0–5 are required.'},400,cors(r));
  const category=await e.MARKETPLACE_DB.prepare('SELECT id FROM store_categories WHERE id=?1 AND enabled=1').bind(categoryId).first();
  if (!category) return json({error:'Invalid or disabled category.'},400,cors(r));
  const now=Math.floor(Date.now()/1000);
  try {
    if (isUpdate) {
      await e.MARKETPLACE_DB.prepare('UPDATE store_products SET name=?1,slug=?2,category_id=?3,description=?4,format=?5,price_minor=?6,currency=?7,rating=?8,icon=?9,tag=?10,featured=?11,enabled=?12,sort_order=?13,metadata_json=?14,updated_at=?15 WHERE id=?16').bind(name,slug,categoryId,description,format,priceMinor,currency,rating,icon,tag,featured,enabled,sortOrder,metadataJson,now,id).run();
    } else {
      id=clean(d.id)||uuid();
      await e.MARKETPLACE_DB.prepare('INSERT INTO store_products (id,name,slug,category_id,description,format,price_minor,currency,rating,icon,tag,featured,enabled,sort_order,metadata_json,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?16)').bind(id,name,slug,categoryId,description,format,priceMinor,currency,rating,icon,tag,featured,enabled,sortOrder,metadataJson,now).run();
    }
  } catch(err) { console.error('Marketplace product save failed',err); return json({error:'Unable to save product. Check that the ID and slug are unique.'},409,cors(r)); }
  const product=await e.MARKETPLACE_DB.prepare('SELECT * FROM store_products WHERE id=?1').bind(id).first();
  return json({product},isUpdate?200:201,cors(r));
}

async function __storeAdminDeleteProduct(r,e,id) {
  if (!e.MARKETPLACE_DB) return json({error:'Marketplace database is not configured.'},503,cors(r));
  if (!(await isAdmin(r,e))) return json({error:'Admin access required.'},403,cors(r));
  if (!id) return json({error:'Product ID required.'},400,cors(r));
  const result=await e.MARKETPLACE_DB.prepare('DELETE FROM store_products WHERE id=?1').bind(id).run();
  return json({success:true,deleted:Number(result.meta?.changes||0)>0},200,cors(r));
}

async function __handleStoreMarketplaceRoute(r,e) {
  const u=new URL(r.url);
  if (!u.pathname.startsWith('/api/store/')) return null;
  if (r.method==='OPTIONS') return new Response(null,{status:204,headers:cors(r)});
  if (u.pathname==='/api/store/categories'&&r.method==='GET') return __storeCategories(r,e);
  if (u.pathname==='/api/store/products'&&r.method==='GET') return __storeProducts(r,e);
  if (u.pathname==='/api/store/admin/products'&&r.method==='GET') return __storeAdminProducts(r,e);
  if (u.pathname==='/api/store/admin/products'&&r.method==='POST') return __storeAdminProduct(r,e,null);
  if (u.pathname.startsWith('/api/store/admin/products/')&&r.method==='PUT') return __storeAdminProduct(r,e,decodeURIComponent(u.pathname.split('/').pop()));
  if (u.pathname.startsWith('/api/store/admin/products/')&&r.method==='DELETE') return __storeAdminDeleteProduct(r,e,decodeURIComponent(u.pathname.split('/').pop()));
  if (u.pathname.startsWith('/api/store/')) return json({error:'Not found'},404,cors(r));
  return null;
}
`;
  const marker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!marker.test(source)) throw new Error('[store-patch] Worker fetch marker not found.');
  source=source.replace(marker,'$&'+module+'\n',1);
  source=source.replace(marker,'$&\n    const __storeResponse = await __handleStoreMarketplaceRoute(r,e);\n    if (__storeResponse) return __storeResponse;\n',1);
}

await writeFile(workerUrl,source,'utf8');
console.log('[store-patch] Marketplace Store API connected to MARKETPLACE_DB with admin product management.');
