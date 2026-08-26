(() => {
  'use strict';
  const grid = document.querySelector('#category-grid');
  if (!grid) return;
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const load = id => fetch(`/categories/${encodeURIComponent(id)}/category.json?v=${Date.now()}`, {cache:'no-store',headers:{Accept:'application/json'}}).then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status}: ${id}`)));
  const categoryCard = category => `<article class="card category-card"><div class="card-icon blue">${escapeHTML(category.icon || '✦')}</div><div class="tool-card-content"><span class="tool-category">Category</span><h3>${escapeHTML(category.name)}</h3><p>${escapeHTML(category.description || `Explore ${category.name} tools.`)}</p><a class="card-link" href="/tools/${encodeURIComponent(category.id)}/" data-category-id="${escapeHTML(category.id)}">Open category <span aria-hidden="true">→</span></a></div></article>`;
  Promise.allSettled(['ai','image','video','audio','pdf','text','utilities','business'].map(load)).then(results => {
    const categories = results.filter(r => r.status === 'fulfilled' && r.value?.id).map(r => r.value).sort((a,b) => (Number(a.order)||99)-(Number(b.order)||99));
    grid.innerHTML = categories.length ? categories.map(categoryCard).join('') : '<div class="empty"><strong>No categories available</strong><p>Category files could not be loaded.</p></div>';
  });
})();
