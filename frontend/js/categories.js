(() => {
  'use strict';
  const grid = document.querySelector('#category-grid');
  if (!grid) return;
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  fetch('/data/tools.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject()).then(data => {
    const tools = Array.isArray(data.tools) ? data.tools.filter(t => t.status !== 'inactive') : [];
    const groups = [...new Map(tools.map(t => [t.category, t])).entries()].sort((a,b) => String(a[1].categoryName || a[0]).localeCompare(String(b[1].categoryName || b[0])));
    grid.innerHTML = groups.length ? groups.map(([category, first]) => {
      const count = tools.filter(t => t.category === category).length;
      return `<article class="card tool-card-item"><div class="tool-card-media">${first.image ? `<img src="${escapeHTML(first.image)}" alt="" loading="lazy">` : `<div class="card-icon blue">${escapeHTML(category.slice(0,4).toUpperCase())}</div>`}</div><div class="tool-card-content"><span class="tool-category">Category</span><h3>${escapeHTML(first.categoryName || category)}</h3><p>${count} tool${count === 1 ? '' : 's'} available.</p><a class="card-link" href="/tools/?category=${encodeURIComponent(category)}">View category →</a></div></article>`;
    }).join('') : '<div class="empty">No categories yet. Add a tool to data/tools.json and its category will appear automatically.</div>';
  }).catch(() => { grid.innerHTML = '<div class="empty">The category registry is temporarily unavailable.</div>'; });
})();
