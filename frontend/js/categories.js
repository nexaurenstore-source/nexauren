(() => {
  const grid = document.querySelector('#category-grid');
  if (!grid) return;
  fetch('/data/tools.json').then(r => r.json()).then(data => {
    const tools = Array.isArray(data.tools) ? data.tools : [];
    const groups = [...new Set(tools.map(t => t.category).filter(Boolean))];
    grid.innerHTML = groups.length ? groups.map((category, i) => `<article class="card"><div class="card-icon ${i % 2 ? 'purple' : 'blue'}">${category.slice(0,4).toUpperCase()}</div><h3>${category}</h3><p>${tools.filter(t => t.category === category).length} tool(s) available.</p><a class="card-link" href="/tools/?category=${encodeURIComponent(category)}">View category →</a></article>`).join('') : '<div class="empty">No categories yet. Add a tool to data/tools.json and its category will appear automatically.</div>';
  }).catch(() => { grid.innerHTML = '<div class="empty">The category registry is temporarily unavailable.</div>'; });
})();
