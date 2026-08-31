/* Nexauren Blog API. Uses the dedicated BLOG_DB binding. */

async function blogListCategories(e) {
  const { results } = await e.BLOG_DB.prepare('SELECT id,name,slug,description FROM blog_categories ORDER BY name ASC').all();
  return results || [];
}

async function blogListTags(e) {
  const { results } = await e.BLOG_DB.prepare('SELECT id,name,slug FROM blog_tags ORDER BY name ASC').all();
  return results || [];
}

async function blogListPosts(r, e) {
  const url = new URL(r.url), category = clean(url.searchParams.get('category')), tag = clean(url.searchParams.get('tag')), q = clean(url.searchParams.get('q'));
  const featured = url.searchParams.get('featured') === '1';
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 12), 1), 50), offset = Math.max(Number(url.searchParams.get('offset') || 0), 0);
  const where = ["p.status='published'"], binds = [];
  if (category) { where.push('c.slug=?'); binds.push(category); }
  if (q) { where.push('(p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ?)'); const pattern=`%${q}%`; binds.push(pattern,pattern,pattern); }
  if (featured) where.push('p.featured=1');
  let sql='SELECT DISTINCT p.id,p.title,p.slug,p.excerpt,p.cover_image,p.author,p.published_at,p.created_at,p.updated_at,p.seo_title,p.meta_description,p.og_image,p.views,p.featured,c.id AS category_id,c.name AS category_name,c.slug AS category_slug FROM blog_posts p LEFT JOIN blog_categories c ON c.id=p.category_id ';
  if(tag){sql+='JOIN blog_post_tags pt ON pt.post_id=p.id JOIN blog_tags t ON t.id=pt.tag_id ';where.push('t.slug=?');binds.push(tag);}
  sql+=`WHERE ${where.join(' AND ')} ORDER BY p.published_at DESC, p.created_at DESC LIMIT ? OFFSET ?`;binds.push(limit,offset);
  const {results}=await e.BLOG_DB.prepare(sql).bind(...binds).all(); return results||[];
}

async function blogGetPostBySlug(r,e,slug){
  const row=await e.BLOG_DB.prepare('SELECT p.id,p.title,p.slug,p.excerpt,p.content,p.cover_image,p.author,p.published_at,p.created_at,p.updated_at,p.seo_title,p.meta_description,p.og_image,p.views,p.featured,c.id AS category_id,c.name AS category_name,c.slug AS category_slug FROM blog_posts p LEFT JOIN blog_categories c ON c.id=p.category_id WHERE p.slug=?1 AND p.status=\'published\' LIMIT 1').bind(slug).first();
  if(!row)return null;
  const {results:tags}=await e.BLOG_DB.prepare('SELECT t.id,t.name,t.slug FROM blog_tags t JOIN blog_post_tags pt ON pt.tag_id=t.id WHERE pt.post_id=?1 ORDER BY t.name ASC').bind(row.id).all();
  return {...row,tags:tags||[]};
}

async function blogGetAdminPost(e,id){
  const row=await e.BLOG_DB.prepare('SELECT p.*,c.name AS category_name,c.slug AS category_slug FROM blog_posts p LEFT JOIN blog_categories c ON c.id=p.category_id WHERE p.id=?1 LIMIT 1').bind(id).first();
  if(!row)return null;
  const {results:tags}=await e.BLOG_DB.prepare('SELECT t.id,t.name,t.slug FROM blog_tags t JOIN blog_post_tags pt ON pt.tag_id=t.id WHERE pt.post_id=?1 ORDER BY t.name ASC').bind(id).all();
  return {...row,tags:tags||[]};
}

function blogSlug(value){return clean(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120);}
async function blogUpsertTag(e,name){const tagName=clean(name);if(!tagName)return null;const slug=blogSlug(tagName);if(!slug)return null;const existing=await e.BLOG_DB.prepare('SELECT id FROM blog_tags WHERE slug=?1 LIMIT 1').bind(slug).first();if(existing)return existing.id;const id=uuid();await e.BLOG_DB.prepare('INSERT INTO blog_tags (id,name,slug,created_at) VALUES (?1,?2,?3,?4)').bind(id,tagName,slug,Math.floor(Date.now()/1000)).run();return id;}
async function blogValidateCategory(e,categoryId){if(!categoryId)return null;const row=await e.BLOG_DB.prepare('SELECT id FROM blog_categories WHERE id=?1 LIMIT 1').bind(categoryId).first();return row?.id||null;}

async function blogCreatePost(r,e){
  const admin=await isAdmin(r,e);if(!admin)return json({error:'Admin access required.'},403,cors(r));
  const d=await body(r),title=clean(d?.title),slug=blogSlug(d?.slug||title),excerpt=clean(d?.excerpt),content=String(d?.content??''),categoryId=await blogValidateCategory(e,clean(d?.category_id)),status=d?.status==='published'?'published':'draft',featured=d?.featured?1:0,now=Math.floor(Date.now()/1000);
  if(!title||!slug||!content)return json({error:'Title, slug and content are required.'},400,cors(r));
  if(d?.category_id&&!categoryId)return json({error:'Invalid category.'},400,cors(r));
  const id=uuid(),publishedAt=status==='published'?(Number(d?.published_at)||now):null;
  try{await e.BLOG_DB.prepare('INSERT INTO blog_posts (id,title,slug,excerpt,content,cover_image,author,category_id,status,featured,published_at,created_at,updated_at,seo_title,meta_description,og_image,views) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16,0)').bind(id,title,slug,excerpt,content,clean(d?.cover_image),clean(d?.author)||admin.username||'Nexauren',categoryId,status,featured,publishedAt,now,now,clean(d?.seo_title),clean(d?.meta_description),clean(d?.og_image)).run();}catch(err){if(String(err?.message||'').toLowerCase().includes('unique'))return json({error:'That slug is already in use.'},409,cors(r));throw err;}
  for(const tag of (Array.isArray(d?.tags)?d.tags:[]).slice(0,30)){const tagId=await blogUpsertTag(e,tag);if(tagId)await e.BLOG_DB.prepare('INSERT OR IGNORE INTO blog_post_tags (post_id,tag_id) VALUES (?1,?2)').bind(id,tagId).run();}
  return json({post:await blogGetAdminPost(e,id)},201,cors(r));
}

async function blogUpdatePost(r,e,id){
  const admin=await isAdmin(r,e);if(!admin)return json({error:'Admin access required.'},403,cors(r));
  const existing=await blogGetAdminPost(e,id);if(!existing)return json({error:'Post not found.'},404,cors(r));
  const d=await body(r),title=clean(d?.title??existing.title),slug=blogSlug(d?.slug??existing.slug),excerpt=clean(d?.excerpt??existing.excerpt),content=String(d?.content??existing.content),categoryId=await blogValidateCategory(e,clean(d?.category_id??existing.category_id)),status=d?.status==='published'||(d?.status==null&&existing.status==='published')?'published':'draft',featured=d?.featured==null?Number(existing.featured):(d.featured?1:0),now=Math.floor(Date.now()/1000),publishedAt=status==='published'?(Number(d?.published_at)||Number(existing.published_at)||now):null;
  if(!title||!slug||!content)return json({error:'Title, slug and content are required.'},400,cors(r));if(d?.category_id&&!categoryId)return json({error:'Invalid category.'},400,cors(r));
  try{await e.BLOG_DB.prepare('UPDATE blog_posts SET title=?1,slug=?2,excerpt=?3,content=?4,cover_image=?5,author=?6,category_id=?7,status=?8,featured=?9,published_at=?10,updated_at=?11,seo_title=?12,meta_description=?13,og_image=?14 WHERE id=?15').bind(title,slug,excerpt,content,clean(d?.cover_image??existing.cover_image),clean(d?.author??existing.author)||admin.username||'Nexauren',categoryId,status,featured,publishedAt,now,clean(d?.seo_title??existing.seo_title),clean(d?.meta_description??existing.meta_description),clean(d?.og_image??existing.og_image),id).run();}catch(err){if(String(err?.message||'').toLowerCase().includes('unique'))return json({error:'That slug is already in use.'},409,cors(r));throw err;}
  await e.BLOG_DB.prepare('DELETE FROM blog_post_tags WHERE post_id=?1').bind(id).run();const tags=Array.isArray(d?.tags)?d.tags:(existing.tags||[]).map(tag=>tag.name);for(const tag of tags.slice(0,30)){const tagId=await blogUpsertTag(e,tag);if(tagId)await e.BLOG_DB.prepare('INSERT OR IGNORE INTO blog_post_tags (post_id,tag_id) VALUES (?1,?2)').bind(id,tagId).run();}
  return json({post:await blogGetAdminPost(e,id)},200,cors(r));
}
async function blogDeletePost(r,e,id){const admin=await isAdmin(r,e);if(!admin)return json({error:'Admin access required.'},403,cors(r));const result=await e.BLOG_DB.prepare('DELETE FROM blog_posts WHERE id=?1').bind(id).run();if(!result.meta?.changes)return json({error:'Post not found.'},404,cors(r));return json({success:true},200,cors(r));}
async function blogAdminListPosts(r,e){const admin=await isAdmin(r,e);if(!admin)return json({error:'Admin access required.'},403,cors(r));const url=new URL(r.url),limit=Math.min(Math.max(Number(url.searchParams.get('limit')||50),1),100),offset=Math.max(Number(url.searchParams.get('offset')||0),0),status=clean(url.searchParams.get('status')),binds=[];let sql='SELECT p.id,p.title,p.slug,p.excerpt,p.cover_image,p.author,p.category_id,p.status,p.featured,p.published_at,p.created_at,p.updated_at,p.seo_title,p.meta_description,p.og_image,p.views,c.name AS category_name FROM blog_posts p LEFT JOIN blog_categories c ON c.id=p.category_id';if(status==='draft'||status==='published'){sql+=' WHERE p.status=?';binds.push(status);}sql+=' ORDER BY COALESCE(p.published_at,p.updated_at) DESC LIMIT ? OFFSET ?';binds.push(limit,offset);const {results}=await e.BLOG_DB.prepare(sql).bind(...binds).all();return json({posts:results||[]},200,cors(r));}
async function blogIncrementViews(e,id){try{await e.BLOG_DB.prepare("UPDATE blog_posts SET views=views+1 WHERE id=?1 AND status='published'").bind(id).run();}catch(err){console.error('Blog view increment failed',err);}}

function blogHtmlEscape(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function blogRenderArticlePage(r,e,slug){
  const post=await blogGetPostBySlug(r,e,slug);
  if(!post)return null;
  const assetUrl=new URL('/blog/post.html',r.url);
  const assetResponse=await e.ASSETS.fetch(new Request(assetUrl.toString(),{method:'GET',headers:{'Accept':'text/html'}}));
  let html=await assetResponse.text();
  const title=blogHtmlEscape(clean(post.seo_title)||post.title),description=blogHtmlEscape(clean(post.meta_description)||clean(post.excerpt)||'Artigo do Blog Nexauren.'),image=blogHtmlEscape(clean(post.og_image)||clean(post.cover_image)),canonical=blogHtmlEscape(new URL('/blog/'+encodeURIComponent(post.slug)+'/',r.url).toString());
  html=html.replace(/<title>[^<]*<\/title>/i,`<title>${title} · Nexauren</title>`).replace(/<meta name="description"[^>]*>/i,`<meta name="description" content="${description}">`).replace(/<link rel="canonical"[^>]*>/i,`<link rel="canonical" href="${canonical}">`).replace(/<meta property="og:title"[^>]*>/i,`<meta property="og:title" content="${title}">`).replace(/<meta property="og:description"[^>]*>/i,`<meta property="og:description" content="${description}">`).replace(/<meta property="og:image"[^>]*>/i,`<meta property="og:image" content="${image}">`).replace(/<meta property="og:url"[^>]*>/i,`<meta property="og:url" content="${canonical}">`).replace(/<meta name="twitter:title"[^>]*>/i,`<meta name="twitter:title" content="${title}">`).replace(/<meta name="twitter:description"[^>]*>/i,`<meta name="twitter:description" content="${description}">`).replace(/<meta name="twitter:image"[^>]*>/i,`<meta name="twitter:image" content="${image}">`);
  return new Response(html,{status:200,headers:{'Content-Type':'text/html; charset=UTF-8','Cache-Control':'public, max-age=60'}});
}

const __blogUrl=new URL('https://nexauren.local/blog-routes');
async function __handleBlogRoute(r,e){
  const url=new URL(r.url),path=url.pathname.replace(/\/+$/,'')||'/';
  if(path==='/api/blog/categories'&&r.method==='GET')return json({categories:await blogListCategories(e)},200,cors(r));
  if(path==='/api/blog/tags'&&r.method==='GET')return json({tags:await blogListTags(e)},200,cors(r));
  if(path==='/api/blog/posts'&&r.method==='GET')return json({posts:await blogListPosts(r,e)},200,cors(r));
  if(path.startsWith('/api/blog/posts/')&&r.method==='GET'){const slug=decodeURIComponent(path.slice('/api/blog/posts/'.length));const post=await blogGetPostBySlug(r,e,slug);if(!post)return json({error:'Post not found.'},404,cors(r));e.waitUntil(blogIncrementViews(e,post.id));return json({post},200,cors(r));}
  if(path==='/api/admin/blog/posts'&&r.method==='GET')return blogAdminListPosts(r,e);
  if(path==='/api/admin/blog/posts'&&r.method==='POST')return blogCreatePost(r,e);
  if(path.startsWith('/api/admin/blog/posts/')&&r.method==='GET'){const id=decodeURIComponent(path.slice('/api/admin/blog/posts/'.length));const admin=await isAdmin(r,e);if(!admin)return json({error:'Admin access required.'},403,cors(r));const post=await blogGetAdminPost(e,id);return post?json({post},200,cors(r)):json({error:'Post not found.'},404,cors(r));}
  if(path.startsWith('/api/admin/blog/posts/')&&r.method==='PUT')return blogUpdatePost(r,e,decodeURIComponent(path.slice('/api/admin/blog/posts/'.length)));
  if(path.startsWith('/api/admin/blog/posts/')&&r.method==='DELETE')return blogDeletePost(r,e,decodeURIComponent(path.slice('/api/admin/blog/posts/'.length)));
  if(path.startsWith('/blog/')&&path!=='/blog'){const slug=decodeURIComponent(path.slice('/blog/'.length));if(slug&&!slug.includes('/'))return blogRenderArticlePage(r,e,slug);}
  return null;
}