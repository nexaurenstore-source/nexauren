(() => {
  'use strict';
  const input = document.querySelector('#tool-search');
  const grid = document.querySelector('#home-tools');
  const featuredGrid = document.querySelector('#home-featured');
  if (!input || !grid) return;
  let tools = [];
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const card = tool => `<article class="card tool-card-item"><div class="tool-card-media">${tool.image ? `<img src="${escapeHTML(tool.image)}" alt="" loading="lazy">` : `<div class="card-icon blue">TOOL</div>`}</div><div class="tool-card-content"><span class="tool-category">${escapeHTML(tool.categoryName || tool.category || 'Tool')}</span><h3>${escapeHTML(tool.name)}</h3><p>${escapeHTML(tool.description)}</p><a class="card-link" href="${escapeHTML(tool.url)}">Open tool →</a></div></article>`;
  const render = query => {
    const q = query.trim().toLowerCase();
    const active = tools.filter(t => t.status !== 'inactive');
    const found = active.filter(t => [t.name, t.description, t.category, t.categoryName, ...(Array.isArray(t.tags) ? t.tags : [])].join(' ').toLowerCase().includes(q));
    grid.innerHTML = found.length ? found.slice(0, 8).map(card).join('') : `<div class="empty">${active.length ? 'No tools match your search.' : 'No tools are available yet. The foundation is ready.'}</div>`;
  };
  const renderFeatured = () => {
    if (!featuredGrid) return;
    const featured = tools.filter(t => t.status !== 'inactive' && t.featured);
    featuredGrid.innerHTML = featured.length ? featured.map(card).join('') : '<div class="empty">Featured tools will appear here automatically.</div>';
  };
  fetch('/data/tools.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject()).then(data => {
    tools = Array.isArray(data.tools) ? data.tools : [];
    renderFeatured();
    render('');
  }).catch(() => { tools = []; renderFeatured(); render(''); });
  input.addEventListener('input', event => render(event.target.value));
})();
