(() => {
  const input = document.querySelector('#tool-search');
  const grid = document.querySelector('#home-tools');
  if (!input || !grid) return;

  let tools = [];
  const render = query => {
    const q = query.trim().toLowerCase();
    const found = tools.filter(tool => `${tool.name} ${tool.description} ${tool.category} ${tool.keywords || ''}`.toLowerCase().includes(q));
    if (!found.length) {
      grid.innerHTML = `<div class="empty">${tools.length ? 'No tools match your search.' : 'No tools are available yet. The foundation is ready.'}</div>`;
      return;
    }
    grid.innerHTML = found.map(tool => `<article class="card"><div class="card-icon blue">${(tool.short || 'TOOL').slice(0,4)}</div><h3>${tool.name}</h3><p>${tool.description}</p><a class="card-link" href="${tool.url}">Open tool →</a></article>`).join('');
  };

  fetch('/data/tools.json').then(r => r.ok ? r.json() : Promise.reject()).then(data => { tools = Array.isArray(data.tools) ? data.tools : []; render(''); }).catch(() => render(''));
  input.addEventListener('input', event => render(event.target.value));
})();
