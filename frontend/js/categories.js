(() => {
  'use strict';

  const grid = document.querySelector('#category-grid');
  if (!grid) return;

  const overlay = document.querySelector('[data-process-overlay]');
  const finish = () => {
    if (overlay) {
      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.display = 'none';
    }
  };

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;'
  }[c]));

  const render = tools => {
    const map = new Map();
    (Array.isArray(tools) ? tools : []).forEach(tool => {
      if (!tool || String(tool.status || 'active').toLowerCase() === 'inactive') return;
      const id = String(tool.category || 'other').trim().toLowerCase();
      const name = String(tool.categoryName || tool.category || 'Other').trim() || 'Other';
      if (!map.has(id)) map.set(id, { id, name, count: 0 });
      map.get(id).count += 1;
    });

    const categories = [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
    if (!categories.length) {
      grid.innerHTML = '<div class="empty"><strong>No categories available yet</strong><p>There are no active tools registered.</p></div>';
      finish();
      return;
    }

    grid.innerHTML = categories.map(c => `
      <article class="card category-card">
        <div class="category-card-content">
          <span class="tool-category">${c.count} ${c.count === 1 ? 'tool' : 'tools'}</span>
          <h2>${escapeHTML(c.name)}</h2>
          <p>Explore useful ${escapeHTML(c.name.toLowerCase())} tools.</p>
          <a class="card-link" href="/tools/?category=${encodeURIComponent(c.id)}">Explore category <span aria-hidden="true">→</span></a>
        </div>
      </article>`).join('');

    finish();
  };

  const fallbackTools = [
    { category: 'image', categoryName: 'Image', status: 'active' },
    { category: 'audio', categoryName: 'Audio', status: 'active' },
    { category: 'pdf', categoryName: 'PDF', status: 'active' }
  ];

  const urls = [
    '/data/tools.json?v=' + Date.now(),
    './data/tools.json?v=' + Date.now(),
    '../data/tools.json?v=' + Date.now()
  ];

  (async () => {
    for (const url of urls) {
      try {
        const response = await fetch(url, { cache: 'no-store', headers: { Accept: 'application/json' } });
        if (!response.ok) continue;
        const data = await response.json();
        if (Array.isArray(data?.tools)) {
          render(data.tools);
          return;
        }
      } catch (error) {
        console.warn('[Nexauren] Categories registry attempt failed:', url, error);
      }
    }

    // Categories must never remain stuck on the loading state. If the registry
    // is temporarily unavailable, show the known categories immediately.
    render(fallbackTools);
  })();
})();
