(() => {
  'use strict';
  const grid = document.querySelector('#category-grid');
  if (!grid) return;

  const overlay = document.querySelector('[data-process-overlay]');
  const finish = () => { if (overlay) overlay.style.display = 'none'; };
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const renderEmpty = text => { grid.innerHTML = `<div class="empty"><strong>${escapeHTML(text)}</strong><p>Try refreshing the page.</p></div>`; finish(); };
  const render = data => {
    const tools = Array.isArray(data?.tools) ? data.tools.filter(t => t && String(t.status || 'active').toLowerCase() !== 'inactive') : [];
    const map = new Map();
    tools.forEach(t => {
      const id = String(t.category || 'other').trim().toLowerCase();
      const name = String(t.categoryName || t.category || 'Other').trim() || 'Other';
      if (!map.has(id)) map.set(id, {id,name,count:0});
      map.get(id).count++;
    });
    const categories = [...map.values()].sort((a,b) => a.name.localeCompare(b.name));
    if (!categories.length) return renderEmpty('No categories available yet');
    grid.innerHTML = categories.map(c => `<article class="card category-card"><div class="category-card-content"><span class="tool-category">${c.count} ${c.count === 1 ? 'tool' : 'tools'}</span><h2>${escapeHTML(c.name)}</h2><p>Explore useful ${escapeHTML(c.name.toLowerCase())} tools.</p><a class="card-link" href="/tools/?category=${encodeURIComponent(c.id)}">Explore category <span aria-hidden="true">→</span></a></div></article>`).join('');
    finish();
  };

  const urls = [
    new URL('/data/tools.json?v=' + Date.now(), location.origin).href,
    new URL('../data/tools.json?v=' + Date.now(), location.href).href,
    new URL('/frontend/data/tools.json?v=' + Date.now(), location.origin).href
  ];
  const load = async () => {
    let lastError;
    for (const url of [...new Set(urls)]) {
      try {
        const response = await fetch(url, {cache:'no-store',headers:{Accept:'application/json'}});
        if (!response.ok) throw new Error(`${response.status} ${url}`);
        const data = await response.json();
        render(data); return;
      } catch (e) { lastError = e; }
    }
    console.error('[Nexauren] categories registry:', lastError);
    renderEmpty('Categories could not be loaded');
  };
  load();
})();
