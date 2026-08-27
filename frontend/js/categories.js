(() => {
  'use strict';

  const grid = document.querySelector('#category-grid');
  if (!grid) return;

  const overlay = document.querySelector('[data-process-overlay]');
  const finish = () => {
    if (!overlay) return;
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    overlay.style.display = 'none';
  };

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));

  const isDiscoverable = tool => !['disabled', 'inactive'].includes(
    String(tool?.status || 'active').toLowerCase()
  );

  const render = (categories, tools) => {
    const counts = new Map();
    (Array.isArray(tools) ? tools : []).forEach(tool => {
      if (!tool || !isDiscoverable(tool)) return;
      const id = String(tool.category || '').trim().toLowerCase();
      if (id) counts.set(id, (counts.get(id) || 0) + 1);
    });

    const ordered = (Array.isArray(categories) ? categories : [])
      .filter(category => category?.id)
      .map(category => ({
        ...category,
        count: counts.get(String(category.id).toLowerCase()) || 0
      }))
      .sort((a, b) => (Number(a.order) || 99) - (Number(b.order) || 99));

    if (!ordered.length) {
      grid.innerHTML = '<div class="empty"><strong>No categories available yet</strong><p>The category registry is empty.</p></div>';
      finish();
      return;
    }

    grid.innerHTML = ordered.map(category => `
      <article class="card category-card">
        <div class="category-card-content">
          <div class="card-icon blue" aria-hidden="true">${escapeHTML(category.icon || '✦')}</div>
          <span class="tool-category">${category.count} ${category.count === 1 ? 'tool' : 'tools'}</span>
          <h2>${escapeHTML(category.name)}</h2>
          <p>${escapeHTML(category.description || `Explore ${category.name} tools.`)}</p>
          <a class="card-link" href="/tools/?category=${encodeURIComponent(category.id)}">Explore category <span aria-hidden="true">→</span></a>
        </div>
      </article>`).join('');

    finish();
  };

  const registry = window.NexaurenRegistry;
  if (!registry) {
    grid.innerHTML = '<div class="empty"><strong>Registry unavailable</strong><p>Please refresh the page.</p></div>';
    finish();
    return;
  }

  Promise.all([registry.loadCategories(), registry.loadTools()])
    .then(([categories, tools]) => render(categories, tools))
    .catch(error => {
      console.warn('[Nexauren] Category registry unavailable:', error);
      grid.innerHTML = '<div class="empty"><strong>Unable to load categories</strong><p>Please refresh the page.</p></div>';
      finish();
    });
})();
