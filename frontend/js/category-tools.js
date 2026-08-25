(() => {
  'use strict';
  const category = document.currentScript?.dataset.category;
  const grid = document.querySelector('#tools-grid');
  if (!category || !grid) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  fetch('/data/tools.json?category=' + encodeURIComponent(category) + '&v=' + Date.now(), {cache:'no-store'})
    .then(r => { if (!r.ok) throw new Error('Registry unavailable'); return r.json(); })
    .then(data => {
      const tools = (Array.isArray(data.tools) ? data.tools : []).filter(t => String(t.category || '').toLowerCase() === category && String(t.status || 'active').toLowerCase() !== 'inactive');
      if (!tools.length) { grid.innerHTML = '<div class="empty"><strong>No tools in this category yet.</strong><p>New tools will appear here automatically when registered.</p></div>'; return; }
      grid.innerHTML = tools.map(t => `<article class="card"><div class="card-body"><span class="kicker">${esc(t.categoryName || category)}</span><h2>${esc(t.name)}</h2><p>${esc(t.description)}</p><a class="button button-primary" data-tool-id="${esc(t.id)}" data-tool-name="${esc(t.name)}" href="${esc(t.url)}">Open tool →</a></div></article>`).join('');
    })
    .catch(err => { console.error('[Nexauren] category tools:', err); grid.innerHTML = '<div class="empty"><strong>Could not load tools.</strong><p>Please try again.</p></div>'; });
})();
