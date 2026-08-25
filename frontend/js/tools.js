(() => {
  const input = document.querySelector('#tools-search');
  const grid = document.querySelector('#tools-grid');
  if (!input || !grid) return;
  let tools = [];
  const render = query => {
    const q = query.trim().toLowerCase();
    const found = tools.filter(t => `${t.name} ${t.description} ${t.category} ${t.keywords || ''}`.toLowerCase().includes(q));
    grid.innerHTML = found.length ? found.map(t => `<article class="card"><div class="card-icon blue">${(t.short || 'TOOL').slice(0,4)}</div><h3>${t.name}</h3><p>${t.description}</p><a class="card-link" href="${t.url}">Open tool →</a></article>`).join('') : `<div class="empty">${tools.length ? 'No tools match your search.' : 'No tools are available yet.'}</div>`;
  };
  fetch('/data/tools.json').then(r => r.json()).then(data => { tools = Array.isArray(data.tools) ? data.tools : []; render(''); }).catch(() => render(''));
  input.addEventListener('input', e => render(e.target.value));
})();
