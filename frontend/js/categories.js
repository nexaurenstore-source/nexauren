(() => {
  'use strict';
  const grid = document.querySelector('#category-grid');
  if (!grid) return;

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const renderEmpty = message => { grid.innerHTML = `<div class="empty"><strong>${escapeHTML(message)}</strong><p>Try again in a moment.</p></div>`; };

  fetch('/data/tools.json', { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(response => {
      if (!response.ok) throw new Error(`Registry request failed: ${response.status}`);
      return response.json();
    })
    .then(data => {
      const tools = Array.isArray(data?.tools) ? data.tools.filter(tool => tool && tool.status !== 'inactive') : [];
      const categories = new Map();
      tools.forEach(tool => {
        const id = String(tool.category || 'other').trim().toLowerCase();
        if (!categories.has(id)) categories.set(id, { id, name: tool.categoryName || tool.category || 'Other', tools: [] });
        categories.get(id).tools.push(tool);
      });

      const groups = [...categories.values()].sort((a, b) => a.name.localeCompare(b.name));
      if (!groups.length) {
        renderEmpty('No categories available yet');
        return;
      }

      grid.innerHTML = groups.map(category => {
        const first = category.tools[0];
        const image = first.image || first.icon || '';
        return `<article class="card category-card">
          <div class="category-card-media">${image ? `<img src="${escapeHTML(image)}" alt="" loading="lazy" onerror="this.parentElement.classList.add('media-fallback');this.remove()">` : ''}<div class="category-fallback" aria-hidden="true">${escapeHTML(category.name.slice(0, 2).toUpperCase())}</div></div>
          <div class="category-card-content"><span class="tool-category">${category.tools.length} ${category.tools.length === 1 ? 'tool' : 'tools'}</span><h2>${escapeHTML(category.name)}</h2><p>Explore useful ${escapeHTML(category.name.toLowerCase())} tools.</p><a class="card-link" href="/tools/?category=${encodeURIComponent(category.id)}">Explore category <span aria-hidden="true">→</span></a></div>
        </article>`;
      }).join('');
    })
    .catch(error => {
      console.error('[Nexauren] categories:', error);
      renderEmpty('Categories could not be loaded');
    });
})();
