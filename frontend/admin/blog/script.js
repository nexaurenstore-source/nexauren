const $ = (id) => document.getElementById(id);
let editingId = null;

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2600);
}

async function api(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function slugify(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 180);
}

async function loadCategories() {
  const data = await api('/api/blog/categories');
  $('category').innerHTML = '<option value="">Sem categoria</option>' + (data.categories || []).map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
}

async function loadPosts() {
  const data = await api('/api/admin/blog/posts?limit=100');
  const posts = data.posts || [];
  $('posts').innerHTML = posts.length ? posts.map(post => `<tr><td><strong>${esc(post.title)}</strong><br><small>${esc(post.slug)}</small></td><td>${esc(post.category_name || '—')}</td><td><span class="status ${post.status === 'published' ? 'published' : 'draft'}">${post.status === 'published' ? 'Publicado' : 'Rascunho'}</span></td><td>${post.published_at ? new Date(post.published_at * 1000).toLocaleDateString() : '—'}</td><td><button class="btn" data-edit="${esc(post.id)}">Editar</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty">Nenhum artigo criado.</td></tr>';
  document.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => editPost(btn.dataset.edit)));
}

async function editPost(id) {
  try { showEditor((await api(`/api/admin/blog/posts/${encodeURIComponent(id)}`)).post); }
  catch (e) { toast(e.message); }
}

function showEditor(post = null) {
  editingId = post?.id || null;
  $('panelTitle').textContent = editingId ? 'Editar artigo' : 'Novo artigo';
  $('list').classList.add('hidden'); $('editor').classList.remove('hidden');
  $('title').value = post?.title || ''; $('slug').value = post?.slug || ''; $('excerpt').value = post?.excerpt || '';
  $('content').value = post?.content || ''; $('cover_image').value = post?.cover_image || ''; $('og_image').value = post?.og_image || '';
  $('seo_title').value = post?.seo_title || ''; $('meta_description').value = post?.meta_description || '';
  $('author').value = post?.author || 'Nexauren'; $('status').value = post?.status || 'draft'; $('featured').value = post?.featured ? '1' : '0';
  $('category').value = post?.category_id || '';
}

$('title').addEventListener('input', () => { if (!editingId) $('slug').value = slugify($('title').value); });
$('newPost').addEventListener('click', () => showEditor());
$('cancel').addEventListener('click', () => { editingId = null; $('editor').classList.add('hidden'); $('list').classList.remove('hidden'); $('panelTitle').textContent = 'Artigos'; });
$('postForm').addEventListener('submit', async event => {
  event.preventDefault();
  const body = { title:$('title').value.trim(), slug:$('slug').value.trim(), excerpt:$('excerpt').value.trim(), content:$('content').value, cover_image:$('cover_image').value.trim(), og_image:$('og_image').value.trim(), seo_title:$('seo_title').value.trim(), meta_description:$('meta_description').value.trim(), author:$('author').value.trim() || 'Nexauren', category_id:$('category').value || null, status:$('status').value, featured:Number($('featured').value) };
  try {
    await api(editingId ? `/api/admin/blog/posts/${encodeURIComponent(editingId)}` : '/api/admin/blog/posts', { method:editingId?'PUT':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
    toast('Artigo salvo com sucesso.'); $('cancel').click(); await loadPosts();
  } catch (e) { toast(e.message); }
});

(async () => { try { await loadCategories(); await loadPosts(); } catch (e) { $('posts').innerHTML = `<tr><td colspan="5" class="empty">${esc(e.message)}</td></tr>`; } })();
