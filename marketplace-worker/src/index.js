const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
});

const uuid = () => crypto.randomUUID();
const clean = (v) => String(v ?? '').trim();
const now = () => Math.floor(Date.now() / 1000);
const cors = (r) => ({
  'access-control-allow-origin': r.headers.get('Origin') || 'https://nexaurenstory.com',
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
  return env.DB.prepare(
    'SELECT u.id,u.email,u.username,u.created_at,u.updated_at FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=?1 AND s.expires_at>?2 LIMIT 1',
  ).bind(await sha256(raw), now()).first();
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
  return json({ products:(rows.results || []).map(productView), pagination:{page,limit,total:Number(count?.total || 0),pages:Math.ceil(Number(count?.total || 0)/limit)} }, 200, { ...cors(r), 'cache-control':'public, max-age=60' });
}

async function productBySlug(r, env, slug) {
  const p = await env.MARKETPLACE_DB.prepare('SELECT p.*,c.name AS category FROM store_products p LEFT JOIN store_categories c ON c.id=p.category_id WHERE p.slug=?1 AND p.enabled=1 LIMIT 1').bind(slug).first();
  if (!p) return json({ error:'Product not found.' }, 404, cors(r));
  const related = await env.MARKETPLACE_DB.prepare('SELECT p.*,c.name AS category FROM store_related_products rel JOIN store_products p ON p.id=rel.related_product_id LEFT JOIN store_categories c ON c.id=p.category_id WHERE rel.product_id=?1 AND p.enabled=1 ORDER BY rel.sort_order,p.created_at DESC LIMIT 12').bind(p.id).all();
  const reviews = await env.MARKETPLACE_DB.prepare('SELECT id,rating,title,body,created_at FROM store_reviews WHERE product_id=?1 AND status=\'approved\' ORDER BY created_at DESC LIMIT 20').bind(p.id).all();
  return json({ product:productView(p), related:(related.results || []).map(productView), reviews:reviews.results || [] }, 200, { ...cors(r), 'cache-control':'public, max-age=30' });
}

async function recordView(r, env, productId) {
  const user = await currentUser(r, env);
  const sessionKey = sessionToken(r) ? await sha256(sessionToken(r)) : null;
  await env.MARKETPLACE_DB.prepare('INSERT INTO store_product_views(id,product_id,user_id,session_key,created_at) VALUES(?1,?2,?3,?4,?5)').bind(uuid(), productId, user?.id || null, sessionKey, now()).run();
  return json({ success:true }, 201, cors(r));
}

async function cart(r, env) {
  const user = await requireUser(r, env);
  if (!user) return json({ error:'Authentication required.' }, 401, cors(r));
  let cart = await env.MARKETPLACE_DB.prepare("SELECT id,status FROM store_carts WHERE user_id=?1 AND status='active' ORDER BY updated_at DESC LIMIT 1").bind(user.id).first();
  if (!cart) { cart={id:uuid(),status:'active'}; await env.MARKETPLACE_DB.prepare("INSERT INTO store_carts(id,user_id,status,created_at,updated_at) VALUES(?1,?2,'active',?3,?3)").bind(cart.id,user.id,now()).run(); }
  const items = await env.MARKETPLACE_DB.prepare('SELECT i.id,i.product_id,i.quantity,p.name,p.slug,p.price_minor,p.currency,p.cover_image_url FROM store_cart_items i JOIN store_products p ON p.id=i.product_id WHERE i.cart_id=?1 AND p.enabled=1 ORDER BY i.created_at DESC').bind(cart.id).all();
  return json({ cart:{id:cart.id,items:items.results || []} }, 200, cors(r));
}

async function cartMutation(r, env, action) {
  const user = await requireUser(r, env);
  if (!user) return json({ error:'Authentication required.' }, 401, cors(r));
  const d = await body(r) || {};
  const productId = clean(d.product_id);
  if (!productId) return json({ error:'product_id is required.' }, 400, cors(r));
  const product = await env.MARKETPLACE_DB.prepare('SELECT id FROM store_products WHERE id=?1 AND enabled=1').bind(productId).first();
  if (!product) return json({ error:'Product not found.' }, 404, cors(r));
  let cart = await env.MARKETPLACE_DB.prepare("SELECT id FROM store_carts WHERE user_id=?1 AND status='active' LIMIT 1").bind(user.id).first();
  if (!cart) { cart={id:uuid()}; await env.MARKETPLACE_DB.prepare("INSERT INTO store_carts(id,user_id,status,created_at,updated_at) VALUES(?1,?2,'active',?3,?3)").bind(cart.id,user.id,now()).run(); }
  if (action === 'remove') await env.MARKETPLACE_DB.prepare('DELETE FROM store_cart_items WHERE cart_id=?1 AND product_id=?2').bind(cart.id,productId).run();
  else { const quantity=Math.min(99,Math.max(1,Number.parseInt(d.quantity || '1',10) || 1)); await env.MARKETPLACE_DB.prepare("INSERT INTO store_cart_items(id,cart_id,product_id,quantity,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?5) ON CONFLICT(cart_id,product_id) DO UPDATE SET quantity=excluded.quantity,updated_at=excluded.updated_at").bind(uuid(),cart.id,productId,quantity,now()).run(); }
  await env.MARKETPLACE_DB.prepare('UPDATE store_carts SET updated_at=?1 WHERE id=?2').bind(now(),cart.id).run();
  return cart(r, env);
}

async function wishlist(r, env) {
  const user = await requireUser(r, env); if (!user) return json({error:'Authentication required.'},401,cors(r));
  const rows=await env.MARKETPLACE_DB.prepare('SELECT p.*,c.name AS category FROM store_wishlist w JOIN store_products p ON p.id=w.product_id LEFT JOIN store_categories c ON c.id=p.category_id WHERE w.user_id=?1 AND p.enabled=1 ORDER BY w.created_at DESC').bind(user.id).all();
  return json({products:(rows.results||[]).map(productView)},200,cors(r));
}

async function wishlistMutation(r, env, remove=false) {
  const user=await requireUser(r,env); if(!user)return json({error:'Authentication required.'},401,cors(r));
  const d=await body(r)||{}; const productId=clean(d.product_id); if(!productId)return json({error:'product_id is required.'},400,cors(r));
  if(remove) await env.MARKETPLACE_DB.prepare('DELETE FROM store_wishlist WHERE user_id=?1 AND product_id=?2').bind(user.id,productId).run();
  else await env.MARKETPLACE_DB.prepare('INSERT OR IGNORE INTO store_wishlist(user_id,product_id,created_at) VALUES(?1,?2,?3)').bind(user.id,productId,now()).run();
  return wishlist(r,env);
}

async function orders(r, env) {
  const user=await requireUser(r,env); if(!user)return json({error:'Authentication required.'},401,cors(r));
  const rows=await env.MARKETPLACE_DB.prepare('SELECT o.id,o.reference,o.status,o.amount_minor,o.currency,o.created_at,o.updated_at,i.product_id,i.product_name,i.quantity,i.unit_price_minor FROM store_orders o LEFT JOIN store_order_items i ON i.order_id=o.id WHERE o.user_id=?1 ORDER BY o.created_at DESC').bind(user.id).all();
  return json({orders:rows.results||[]},200,cors(r));
}

async function reviews(r, env, productId) {
  const rows=await env.MARKETPLACE_DB.prepare('SELECT id,rating,title,body,status,created_at FROM store_reviews WHERE product_id=?1 AND status=\'approved\' ORDER BY created_at DESC LIMIT 50').bind(productId).all();
  return json({reviews:rows.results||[]},200,cors(r));
}

async function createReview(r, env, productId) {
  const user=await requireUser(r,env); if(!user)return json({error:'Authentication required.'},401,cors(r));
  const purchased=await env.MARKETPLACE_DB.prepare("SELECT 1 FROM store_entitlements WHERE user_id=?1 AND product_id=?2 AND status='active' LIMIT 1").bind(user.id,productId).first();
  if(!purchased)return json({error:'You can review a product only after purchasing it.'},403,cors(r));
  const d=await body(r)||{}; const rating=Number(d.rating); if(!Number.isInteger(rating)||rating<1||rating>5)return json({error:'Rating must be between 1 and 5.'},400,cors(r));
  try { await env.MARKETPLACE_DB.prepare('INSERT INTO store_reviews(id,product_id,user_id,rating,title,body,status,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,\'pending\',?7,?7)').bind(uuid(),productId,user.id,rating,clean(d.title).slice(0,200),clean(d.body).slice(0,5000),now()).run(); } catch { return json({error:'You have already reviewed this product.'},409,cors(r)); }
  return json({success:true,status:'pending'},201,cors(r));
}

async function questions(r, env, productId) {
  const rows=await env.MARKETPLACE_DB.prepare("SELECT id,question,answer,status,created_at,answered_at FROM store_product_questions WHERE product_id=?1 AND status IN ('answered','published') ORDER BY created_at DESC LIMIT 50").bind(productId).all();
  return json({questions:rows.results||[]},200,cors(r));
}

async function createQuestion(r, env, productId) {
  const user=await requireUser(r,env); if(!user)return json({error:'Authentication required.'},401,cors(r));
  const d=await body(r)||{}; const question=clean(d.question).slice(0,3000); if(!question)return json({error:'question is required.'},400,cors(r));
  await env.MARKETPLACE_DB.prepare("INSERT INTO store_product_questions(id,product_id,user_id,question,status,created_at) VALUES(?1,?2,?3,?4,'pending',?5)").bind(uuid(),productId,user.id,question,now()).run();
  return json({success:true,status:'pending'},201,cors(r));
}

async function adminProducts(r,env) {
  const admin=await requireAdmin(r,env); if(!admin)return json({error:'Admin access required.'},403,cors(r));
  const rows=await env.MARKETPLACE_DB.prepare('SELECT p.*,c.name AS category FROM store_products p LEFT JOIN store_categories c ON c.id=p.category_id ORDER BY p.created_at DESC,p.id DESC').all();
  return json({products:rows.results||[]},200,cors(r));
}

async function adminProduct(r,env,id=null) {
  const admin=await requireAdmin(r,env); if(!admin)return json({error:'Admin access required.'},403,cors(r));
  const d=await body(r)||{};
  const name=clean(d.name),slug=clean(d.slug),categoryId=clean(d.category_id),format=clean(d.format)||'DIGITAL',currency=(clean(d.currency)||'USD').toUpperCase();
  const priceMinor=Number(d.price_minor),rating=Number(d.rating||0); const featured=d.featured?1:0,enabled=d.enabled===false?0:1,sortOrder=Number(d.sort_order||0);
  if(!name||!slug||!categoryId||!Number.isSafeInteger(priceMinor)||priceMinor<0||!Number.isFinite(rating)||rating<0||rating>5||!/^[A-Z]{3}$/.test(currency))return json({error:'Invalid product data.'},400,cors(r));
  const category=await env.MARKETPLACE_DB.prepare('SELECT id FROM store_categories WHERE id=?1 AND enabled=1').bind(categoryId).first(); if(!category)return json({error:'Invalid or disabled category.'},400,cors(r));
  const idValue=id||clean(d.id)||uuid(), t=now();
  const fields={
    name,slug,category_id:categoryId,description:clean(d.description),short_description:clean(d.short_description),long_description:clean(d.long_description),format,
    price_minor:priceMinor,currency,rating,icon:clean(d.icon)||'📦',tag:clean(d.tag),featured,enabled,sort_order:sortOrder,
    cover_image_url:clean(d.cover_image_url),gallery_json:typeof d.gallery_json==='string'?d.gallery_json:JSON.stringify(d.gallery||[]),video_url:clean(d.video_url),
    features_json:typeof d.features_json==='string'?d.features_json:JSON.stringify(d.features||[]),included_json:typeof d.included_json==='string'?d.included_json:JSON.stringify(d.included||[]),requirements:clean(d.requirements),
    license_type:clean(d.license_type),license_text:clean(d.license_text),version:clean(d.version),file_size:d.file_size==null?null:Number(d.file_size)||null,preview_url:clean(d.preview_url),
    tags_json:typeof d.tags_json==='string'?d.tags_json:JSON.stringify(d.tags||[]),seo_title:clean(d.seo_title),seo_description:clean(d.seo_description),metadata_json:typeof d.metadata_json==='string'?d.metadata_json:JSON.stringify(d.metadata||{}),
  };
  try {
    if(id) {
      await env.MARKETPLACE_DB.prepare(`UPDATE store_products SET name=?1,slug=?2,category_id=?3,description=?4,short_description=?5,long_description=?6,format=?7,price_minor=?8,currency=?9,rating=?10,icon=?11,tag=?12,featured=?13,enabled=?14,sort_order=?15,cover_image_url=?16,gallery_json=?17,video_url=?18,features_json=?19,included_json=?20,requirements=?21,license_type=?22,license_text=?23,version=?24,file_size=?25,preview_url=?26,tags_json=?27,seo_title=?28,seo_description=?29,metadata_json=?30,updated_at=?31 WHERE id=?32`).bind(...Object.values(fields),t,idValue).run();
    } else {
      await env.MARKETPLACE_DB.prepare(`INSERT INTO store_products(id,name,slug,category_id,description,short_description,long_description,format,price_minor,currency,rating,icon,tag,featured,enabled,sort_order,cover_image_url,gallery_json,video_url,features_json,included_json,requirements,license_type,license_text,version,file_size,preview_url,tags_json,seo_title,seo_description,metadata_json,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,?17,?18,?19,?20,?21,?22,?23,?24,?25,?26,?27,?28,?29,?30,?31,?32,?33)`).bind(idValue,...Object.values(fields),t,t).run();
    }
  } catch(e) { console.error('Marketplace admin product save failed',e); return json({error:'Unable to save product. ID or slug may already exist.'},409,cors(r)); }
  return json({product:await env.MARKETPLACE_DB.prepare('SELECT p.*,c.name AS category FROM store_products p LEFT JOIN store_categories c ON c.id=p.category_id WHERE p.id=?1').bind(idValue).first()},id?200:201,cors(r));
}

async function adminDeleteProduct(r,env,id) {
  const admin=await requireAdmin(r,env); if(!admin)return json({error:'Admin access required.'},403,cors(r));
  if(!id)return json({error:'Product ID required.'},400,cors(r));
  await env.MARKETPLACE_DB.prepare('UPDATE store_products SET enabled=0,updated_at=?1 WHERE id=?2').bind(now(),id).run();
  return json({success:true,disabled:true},200,cors(r));
}

function paypalBase(env) {
  const mode=String(env.PAYPAL_ENVIRONMENT||env.PAYPAL_ENV||'live').toLowerCase();
  return mode==='sandbox'?'https://api-m.sandbox.paypal.com':'https://api-m.paypal.com';
}

async function paypalAccessToken(env) {
  if(!env.PAYPAL_CLIENT_ID||!env.PAYPAL_CLIENT_SECRET)throw new Error('PayPal credentials are not configured.');
  const auth=btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const res=await fetch(`${paypalBase(env)}/v1/oauth2/token`,{method:'POST',headers:{Authorization:`Basic ${auth}`,'Content-Type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  if(!res.ok)throw new Error(`PayPal OAuth ${res.status}`);
  const data=await res.json(); return data.access_token;
}

async function paypalRequest(env,path,options={}) {
  const token=await paypalAccessToken(env);
  const res=await fetch(`${paypalBase(env)}${path}`,{...options,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(options.headers||{})}});
  const text=await res.text(); let data=null; try{data=JSON.parse(text);}catch{data={raw:text};}
  if(!res.ok)throw new Error(`PayPal ${res.status}: ${text.slice(0,500)}`);
  return data;
}

function money(minor,currency){return {currency_code:currency,value:(Number(minor)/100).toFixed(2)};}

async function createPayPalOrder(env, product, reference) {
  const returnBase=env.PAYMENT_RETURN_URL||'https://nexaurenstory.com/nexauren-store/';
  const cancelBase=env.PAYMENT_CANCEL_URL||'https://nexaurenstory.com/nexauren-store/';
  const join=(base)=>{try{const u=new URL(base);u.searchParams.set('reference',reference);u.searchParams.set('store_payment','success');return u.toString();}catch{return base;}};
  return paypalRequest(env,'/v2/checkout/orders',{method:'POST',body:JSON.stringify({intent:'CAPTURE',purchase_units:[{reference_id:reference,custom_id:reference,invoice_id:reference,description:String(product.name).slice(0,127),amount:money(product.price_minor,product.currency)}],application_context:{brand_name:env.PAYMENT_BRAND_NAME||'Nexauren',user_action:'PAY_NOW',return_url:join(returnBase),cancel_url:cancelBase}})});
}

async function capturePayPalOrder(env,orderId){return paypalRequest(env,`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,{method:'POST',body:'{}'});}
async function getPayPalOrder(env,orderId){return paypalRequest(env,`/v2/checkout/orders/${encodeURIComponent(orderId)}`,{method:'GET'});}

async function fulfillPayment(env,payment) {
  if(!env.MARKETPLACE_DB)return null;
  const existing=await env.MARKETPLACE_DB.prepare('SELECT id,status FROM store_orders WHERE reference=?1 LIMIT 1').bind(payment.reference).first();
  if(existing)return existing;
  const metadata=parseJson(payment.metadata,{}); const productId=clean(metadata.product_id);
  const product=await env.MARKETPLACE_DB.prepare('SELECT id,name,price_minor,currency FROM store_products WHERE id=?1 LIMIT 1').bind(productId).first();
  if(!product)throw new Error('Purchased product no longer exists.');
  if(Number(product.price_minor)!==Number(payment.amount_minor)||String(product.currency).toUpperCase()!==String(payment.currency).toUpperCase())throw new Error('Product price changed after checkout.');
  const orderId=uuid(),t=now();
  await env.MARKETPLACE_DB.batch([
    env.MARKETPLACE_DB.prepare("INSERT INTO store_orders(id,user_id,payment_id,reference,status,amount_minor,currency,created_at,updated_at) VALUES(?1,?2,?3,?4,'paid',?5,?6,?7,?7)").bind(orderId,payment.user_id,payment.id,payment.reference,payment.amount_minor,payment.currency,t),
    env.MARKETPLACE_DB.prepare('INSERT INTO store_order_items(id,order_id,product_id,product_name,quantity,unit_price_minor,currency,created_at) VALUES(?1,?2,?3,?4,1,?5,?6,?7)').bind(uuid(),orderId,product.id,product.name,payment.amount_minor,product.currency,t),
    env.MARKETPLACE_DB.prepare("INSERT OR IGNORE INTO store_entitlements(id,user_id,product_id,order_id,status,granted_at,revoked_at) VALUES(?1,?2,?3,?4,'active',?5,NULL)").bind(uuid(),payment.user_id,product.id,orderId,t),
  ]);
  return {id:orderId,status:'paid'};
}

async function checkout(r,env) {
  const user=await requireUser(r,env); if(!user)return json({error:'Authentication required.'},401,cors(r));
  const d=await body(r)||{},productId=clean(d.product_id); if(!productId)return json({error:'product_id is required.'},400,cors(r));
  const product=await env.MARKETPLACE_DB.prepare('SELECT id,name,price_minor,currency,enabled FROM store_products WHERE id=?1 AND enabled=1 LIMIT 1').bind(productId).first();
  if(!product)return json({error:'Product not found.'},404,cors(r));
  const amount=Number(product.price_minor),currency=String(product.currency||'').toUpperCase(); if(!Number.isSafeInteger(amount)||amount<0||!/^[A-Z]{3}$/.test(currency))return json({error:'Invalid product price.'},500,cors(r));
  const reference=`store:${uuid()}`,paymentId=uuid(),t=now();
  if(amount===0){
    await env.DB.prepare("INSERT INTO payments(id,user_id,provider,provider_transaction_id,reference,amount_minor,currency,status,type,metadata,created_at,updated_at) VALUES(?1,?2,'internal',?3,?4,0,?5,'successful','store_purchase',?6,?7,?7)").bind(paymentId,user.id,`free:${reference}`,reference,currency,JSON.stringify({product_id:product.id,product_name:product.name,checkout_mode:'free'}),t).run();
    const order=await fulfillPayment(env,{id:paymentId,user_id:user.id,reference,amount_minor:0,currency,metadata:JSON.stringify({product_id:product.id})});
    return json({success:true,free:true,reference,order},201,cors(r));
  }
  await env.DB.prepare("INSERT INTO payments(id,user_id,provider,provider_transaction_id,reference,amount_minor,currency,status,type,metadata,created_at,updated_at) VALUES(?1,?2,'paypal',NULL,?3,?4,?5,'pending','store_purchase',?6,?7,?7)").bind(paymentId,user.id,reference,amount,currency,JSON.stringify({product_id:product.id,product_name:product.name}),t).run();
  try {
    const pp=await createPayPalOrder(env,product,reference),providerOrderId=clean(pp?.id),approval=(pp?.links||[]).find(x=>x.rel==='approve')?.href;
    if(!providerOrderId||!approval)throw new Error('PayPal did not return an approval URL.');
    await env.DB.prepare('UPDATE payments SET provider_transaction_id=?1,metadata=?2,updated_at=?3 WHERE id=?4').bind(providerOrderId,JSON.stringify({product_id:product.id,product_name:product.name,paypal_order_id:providerOrderId}),now(),paymentId).run();
    return json({success:true,provider:'paypal',reference,payment_id:paymentId,checkout:{order_id:providerOrderId,approval_url:approval}},201,cors(r));
  } catch(e) {
    await env.DB.prepare("UPDATE payments SET status='failed',metadata=?1,updated_at=?2 WHERE id=?3 AND status='pending'").bind(JSON.stringify({product_id:product.id,error:String(e).slice(0,500)}),now(),paymentId).run();
    console.error('Marketplace checkout failed',e); return json({error:'Unable to create checkout.'},502,cors(r));
  }
}

async function paymentStatus(r,env) {
  const user=await requireUser(r,env); if(!user)return json({error:'Authentication required.'},401,cors(r));
  const reference=clean(new URL(r.url).searchParams.get('reference')); if(!reference)return json({error:'reference is required.'},400,cors(r));
  const payment=await env.DB.prepare("SELECT id,user_id,provider,provider_transaction_id,reference,amount_minor,currency,status,type,metadata,created_at,updated_at FROM payments WHERE user_id=?1 AND reference=?2 AND type='store_purchase' LIMIT 1").bind(user.id,reference).first();
  if(!payment)return json({error:'Payment not found.'},404,cors(r));
  if(payment.status==='successful'){
    const order=await fulfillPayment(env,payment).catch(e=>{console.error('Marketplace recovery failed',e);return null;});
    return json({success:true,payment,order},200,cors(r));
  }
  if(String(payment.provider).toLowerCase()!=='paypal')return json({error:'Payment provider mismatch.'},409,cors(r));
  const orderId=clean(payment.provider_transaction_id); if(!orderId)return json({error:'PayPal order is not associated with this payment.'},409,cors(r));
  try {
    let pp=await getPayPalOrder(env,orderId); let status=String(pp?.status||'').toUpperCase();
    const purchase=pp?.purchase_units?.[0],amount=String(purchase?.amount?.value||''),currency=String(purchase?.amount?.currency_code||'').toUpperCase();
    const expected=(Number(payment.amount_minor)/100).toFixed(2); const ref=clean(purchase?.custom_id||purchase?.invoice_id||purchase?.reference_id);
    if(ref!==reference||amount!==expected||currency!==String(payment.currency).toUpperCase())return json({error:'PayPal order verification mismatch.'},409,cors(r));
    if(status!=='COMPLETED'){pp=await capturePayPalOrder(env,orderId);status=String(pp?.status||'').toUpperCase();}
    if(status!=='COMPLETED')return json({error:'PayPal payment is not completed.'},409,cors(r));
    const final=await getPayPalOrder(env,orderId),finalPurchase=final?.purchase_units?.[0],finalAmount=String(finalPurchase?.amount?.value||''),finalCurrency=String(finalPurchase?.amount?.currency_code||'').toUpperCase();
    if(String(final?.status||'').toUpperCase()!=='COMPLETED'||finalAmount!==expected||finalCurrency!==String(payment.currency).toUpperCase())return json({error:'PayPal payment verification failed.'},409,cors(r));
    let metadata=parseJson(payment.metadata,{}); metadata={...metadata,paypal_order_id:orderId,paypal_status:'COMPLETED'};
    await env.DB.prepare("UPDATE payments SET status='successful',metadata=?,updated_at=? WHERE id=? AND status='pending'").bind(JSON.stringify(metadata),now(),payment.id).run();
    const refreshed=await env.DB.prepare('SELECT id,user_id,provider,provider_transaction_id,reference,amount_minor,currency,status,type,metadata,created_at,updated_at FROM payments WHERE id=?1').bind(payment.id).first();
    const order=await fulfillPayment(env,refreshed); return json({success:true,payment:refreshed,order},200,cors(r));
  } catch(e){console.error('Marketplace payment verification failed',e);return json({error:'Unable to verify or capture the Store payment.'},502,cors(r));}
}

async function download(r,env,fileId) {
  const user=await requireUser(r,env); if(!user)return json({error:'Authentication required.'},401,cors(r));
  const file=await env.MARKETPLACE_DB.prepare("SELECT f.*,e.id AS entitlement_id FROM store_product_files f JOIN store_entitlements e ON e.product_id=f.product_id AND e.user_id=?1 AND e.status='active' WHERE f.id=?2 AND f.enabled=1 LIMIT 1").bind(user.id,fileId).first();
  if(!file)return json({error:'File not found or access denied.'},404,cors(r));
  if(!env.STORE_FILES)return json({error:'Digital file storage is not configured.'},503,cors(r));
  await env.MARKETPLACE_DB.prepare('INSERT INTO store_downloads(id,user_id,product_id,file_id,entitlement_id,created_at) VALUES(?1,?2,?3,?4,?5,?6)').bind(uuid(),user.id,file.product_id,file.id,file.entitlement_id,now()).run();
  const object=await env.STORE_FILES.get(file.storage_key); if(!object)return json({error:'Digital file is unavailable.'},404,cors(r));
  const headers=new Headers(); object.writeHttpMetadata(headers); headers.set('etag',object.httpEtag); headers.set('content-disposition',`attachment; filename="${String(file.name).replace(/[^a-zA-Z0-9._-]/g,'_')}"`); return new Response(object.body,{headers});
}

async function api(r,env) {
  if(!env.MARKETPLACE_DB)return json({error:'Marketplace database is not configured.'},503,cors(r));
  const u=new URL(r.url),p=u.pathname;
  if(r.method==='OPTIONS')return new Response(null,{status:204,headers:cors(r)});
  if(p==='/api/store/categories'&&r.method==='GET')return categories(r,env);
  if(p==='/api/store/products'&&r.method==='GET')return products(r,env);
  const productMatch=p.match(/^\/api\/store\/products\/([^/]+)$/); if(productMatch&&r.method==='GET')return productBySlug(r,env,decodeURIComponent(productMatch[1]));
  const viewMatch=p.match(/^\/api\/store\/products\/([^/]+)\/view$/); if(viewMatch&&r.method==='POST')return recordView(r,env,decodeURIComponent(viewMatch[1]));
  const reviewMatch=p.match(/^\/api\/store\/products\/([^/]+)\/reviews$/); if(reviewMatch&&r.method==='GET')return reviews(r,env,decodeURIComponent(reviewMatch[1])); if(reviewMatch&&r.method==='POST')return createReview(r,env,decodeURIComponent(reviewMatch[1]));
  const qMatch=p.match(/^\/api\/store\/products\/([^/]+)\/questions$/); if(qMatch&&r.method==='GET')return questions(r,env,decodeURIComponent(qMatch[1])); if(qMatch&&r.method==='POST')return createQuestion(r,env,decodeURIComponent(qMatch[1]));
  if(p==='/api/store/cart'&&r.method==='GET')return cart(r,env); if(p==='/api/store/cart'&&r.method==='POST')return cartMutation(r,env,'add'); if(p==='/api/store/cart'&&r.method==='DELETE')return cartMutation(r,env,'remove');
  if(p==='/api/store/wishlist'&&r.method==='GET')return wishlist(r,env); if(p==='/api/store/wishlist'&&r.method==='POST')return wishlistMutation(r,env,false); if(p==='/api/store/wishlist'&&r.method==='DELETE')return wishlistMutation(r,env,true);
  if(p==='/api/store/orders'&&r.method==='GET')return orders(r,env);
  if(p==='/api/store/checkout'&&r.method==='POST')return checkout(r,env);
  if(p==='/api/store/payment'&&r.method==='GET')return paymentStatus(r,env);
  const dl=p.match(/^\/api\/store\/downloads\/([^/]+)$/); if(dl&&r.method==='GET')return download(r,env,decodeURIComponent(dl[1]));
  if(p==='/api/store/admin/products'&&r.method==='GET')return adminProducts(r,env); if(p==='/api/store/admin/products'&&r.method==='POST')return adminProduct(r,env,null);
  const adminMatch=p.match(/^\/api\/store\/admin\/products\/([^/]+)$/); if(adminMatch&&r.method==='PUT')return adminProduct(r,env,decodeURIComponent(adminMatch[1])); if(adminMatch&&r.method==='DELETE')return adminDeleteProduct(r,env,decodeURIComponent(adminMatch[1]));
  return json({error:'Not found'},404,cors(r));
}

export default {
  async fetch(request, env) {
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/store/'))return api(request,env);
    if(url.pathname==='/nexauren-store'||url.pathname.startsWith('/nexauren-store/')){
      const path=url.pathname.replace(/^\/nexauren-store/,'')||'/';
      const assetUrl=new URL(request.url); assetUrl.pathname=path;
      return env.ASSETS.fetch(new Request(assetUrl.toString(),request));
    }
    return new Response('Nexauren Marketplace Worker',{status:200,headers:{'content-type':'text/plain;charset=UTF-8'}});
  },
};
