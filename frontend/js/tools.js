(() => {
  'use strict';
  const grid = document.querySelector('#category-grid');
  if (!grid) return;

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const categoryIds = ['image','video','audio','pdf','text'];
  const loadCategory = id => fetch(`/categories/${encodeURIComponent(id)}/category.json?v=${Date.now()}`, {cache:'no-store',headers:{Accept:'application/json'}})
    .then(response => response.ok ? response.json() : Promise.reject(new Error(`${id}: ${response.status}`)))
    .then(data => ({...data, id: data.id || id}))
    .catch(error => { console.error('[Nexauren] category:', error); return null; });
  const card = category => `<article class="card tool-card-item category-card"><div class="tool-card-media"><div class="card-icon blue" aria-hidden="true">${escapeHTML(category.icon || '✦')}</div></div><div class="tool-card-content"><span class="tool-category">Category</span><h3>${escapeHTML(category.name)}</h3><p>${escapeHTML(category.description || `Explore ${category.name} tools.`)}</p><a class="card-link" href="/tools/?category=${encodeURIComponent(category.id)}">Open category <span aria-hidden="true">→</span></a></div></article>`;
  Promise.all(categoryIds.map(loadCategory)).then(categories => {
    const valid = categories.filter(Boolean).sort((a,b) => Number(a.order || 999) - Number(b.order || 999));
    grid.innerHTML = valid.length ? valid.map(card).join('') : '<div class="empty"><strong>No categories available</strong><p>Category files could not be loaded.</p></div>';
  }).catch(error => { console.error('[Nexauren] categories:', error); grid.innerHTML = '<div class="empty"><strong>Categories could not be loaded</strong><p>Please try again.</p></div>'; });
})();