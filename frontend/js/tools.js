(() => {
  'use strict';
  const input = document.querySelector('#tools-search');
  const grid = document.querySelector('#tools-grid');
  if (!input || !grid) return;

  const categorySelect = document.querySelector('#tools-category');
  let tools = [];

  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const card = tool => `
    <article class="card tool-card-item">
      <div class="tool-card-media">${tool.image ? `<img src="${escapeHTML(tool.image)}" alt="" loading="lazy">` : `<div class="card-icon blue">${escapeHTML((tool.name || 'TOOL').slice(0,4))}</div>`}</div>
      <div class="tool-card-content"><span class="tool-category">${escapeHTML(tool.categoryName || tool.category || 'Tool')}</span><h3>${escapeHTML(tool.name)}</h3><p>${escapeHTML(tool.description)}</p><a class="card-link" href="${escapeHTML(tool.url)}" data-tool-id="${escapeHTML(tool.id)}">Open tool →</a></div>
    </article>`;

  const renderCategories = () => {
    if (!categorySelect) return;
    const current = new URLSearchParams(location.search).get('category') || '';
    categorySelect.innerHTML = '<option value="">All categories</option>' + [...new Map(tools.map(t => [t.category, t.categoryName || t.category])).entries()].sort((a,b) => a[1].localeCompare(b[1])).map(([id,name]) => `<option value="${escapeHTML(id)}">${escapeHTML(name)}</option>`).join('');
    categorySelect.value = current;
  };

  const render = () => {
    const q = input.value.trim().toLowerCase();
    const category = categorySelect?.value || '';
    const found = tools.filter(t => t.status !== 'inactive').filter(t => {
      const haystack = [t.name, t.description, t.category, t.categoryName, ...(Array.isArray(t.tags) ? t.tags : [])].join(' ').toLowerCase();
      return (!q || haystack.includes(q)) && (!category || t.category === category);
    });
    grid.innerHTML = found.length ? found.map(card).join('') : `<div class="empty"><strong>No tools found</strong><p>${tools.length ? 'Try another name, category or tag.' : 'No tools are available yet.'}</p></div>`;
  };

  fetch('/data/tools.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : Promise.reject()).then(data => {
    tools = Array.isArray(data.tools) ? data.tools : [];
    renderCategories();
    render();
  }).catch(() => { tools = []; render(); });

  input.addEventListener('input', render);
  categorySelect?.addEventListener('change', () => {
    const url = new URL(location.href);
    if (categorySelect.value) url.searchParams.set('category', categorySelect.value); else url.searchParams.delete('category');
    history.replaceState({}, '', url);
    render();
  });
})();
