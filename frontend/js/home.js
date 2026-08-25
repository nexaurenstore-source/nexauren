(() => {
  'use strict';

  const input = document.querySelector('#tool-search');
  const grid = document.querySelector('#home-tools');
  const featuredGrid = document.querySelector('#home-featured');
  const count = document.querySelector('#search-result-count');
  if (!input || !grid) return;

  let tools = [];
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const card = tool => `<article class="card tool-card-item">
    <div class="tool-card-media">${tool.image ? `<img src="${escapeHTML(tool.image)}" alt="${escapeHTML(tool.name)} icon" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.add('media-fallback')">` : `<div class="card-icon blue">N</div>`}</div>
    <div class="tool-card-content">
      <span class="tool-category">${escapeHTML(tool.categoryName || tool.category || 'Tool')}</span>
      <h3>${escapeHTML(tool.name)}</h3>
      <p>${escapeHTML(tool.description)}</p>
      <a class="card-link" href="${escapeHTML(tool.url)}" data-tool-id="${escapeHTML(tool.id)}" data-tool-name="${escapeHTML(tool.name)}">Open tool →</a>
    </div>
  </article>`;
  const getActive = () => tools.filter(t => String(t.status || 'active').toLowerCase() !== 'inactive');
  const searchable = t => [t.name,t.description,t.category,t.categoryName,t.slug,t.id,...(Array.isArray(t.tags) ? t.tags : [])].join(' ');
  const render = query => {
    const q = normalize(query), active = getActive();
    const found = q ? active.filter(t => normalize(searchable(t)).includes(q)) : active;
    grid.innerHTML = found.length ? found.slice(0, 8).map(card).join('') : `<div class="empty"><strong>No tools found.</strong><br>Try another name, category or tag.</div>`;
    if (count) count.textContent = q ? `${found.length} tool${found.length === 1 ? '' : 's'} found` : `${active.length} active tool${active.length === 1 ? '' : 's'}`;
  };
  const renderFeatured = () => {
    if (!featuredGrid) return;
    const featured = getActive().filter(t => t.featured === true);
    featuredGrid.innerHTML = featured.length ? featured.slice(0, 6).map(card).join('') : '<div class="empty">Featured tools will appear here automatically.</div>';
  };
  const loadTools = () => fetch('/data/tools.json?v=' + Date.now(), { cache: 'no-store', headers: { Accept: 'application/json' } })
    .then(response => { if (!response.ok) throw new Error(`Tool registry returned ${response.status}`); return response.json(); })
    .then(data => { tools = Array.isArray(data?.tools) ? data.tools.filter(Boolean) : []; renderFeatured(); render(input.value); })
    .catch(error => { console.error('Nexauren tool search:', error); tools = []; if (featuredGrid) featuredGrid.innerHTML = '<div class="empty">Unable to load the tool registry.</div>'; grid.innerHTML = '<div class="empty">Unable to load tools right now. Please refresh the page.</div>'; if (count) count.textContent = ''; });
  input.addEventListener('input', event => render(event.target.value));
  input.addEventListener('search', event => render(event.target.value));
  input.addEventListener('keydown', event => { if (event.key === 'Escape') { input.value = ''; render(''); input.focus(); } });
  loadTools();
})();
