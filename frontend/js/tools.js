(() => {
  'use strict';
  const input = document.querySelector('#tools-search');
  const grid = document.querySelector('#tools-grid');
  if (!input || !grid) return;
  const categorySelect = document.querySelector('#tools-category');
  const suggestions = document.createElement('div');
  suggestions.className = 'search-suggestions';
  suggestions.hidden = true;
  input.parentElement?.appendChild(suggestions);
  let tools = [], categories = [], activeSuggestion = -1;
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const matches = (tool, query) => normalize([tool.name,tool.description,tool.category,tool.categoryName,tool.slug,tool.id,...(Array.isArray(tool.tags) ? tool.tags : [])].join(' ')).includes(normalize(query));
  const activeTools = () => tools.filter(t => String(t.status || 'active').toLowerCase() !== 'inactive');
  const card = tool => `<article class="card tool-card-item"><div class="tool-card-media">${tool.image ? `<img src="${escapeHTML(tool.image)}" alt="${escapeHTML(tool.name)} icon" loading="lazy" onerror="this.hidden=true;this.parentElement.classList.add('media-fallback')">` : `<div class="card-icon blue">${escapeHTML((tool.name || 'TOOL').slice(0,2).toUpperCase())}</div>`}</div><div class="tool-card-content"><span class="tool-category">${escapeHTML(tool.categoryName || tool.category || 'Tool')}</span><h3>${escapeHTML(tool.name)}</h3><p>${escapeHTML(tool.description)}</p><a class="card-link" href="${escapeHTML(tool.url)}" data-tool-id="${escapeHTML(tool.id)}" data-tool-name="${escapeHTML(tool.name)}">Open tool <span aria-hidden="true">→</span></a></div></article>`;
  const renderCategories = () => {
    if (!categorySelect) return;
    const current = new URLSearchParams(location.search).get('category') || '';
    const registered = new Map(activeTools().map(t => [String(t.category || 'other'), t.categoryName || t.category || 'Other']));
    const merged = categories.map(c => [c.id, c.name]).filter(([id]) => registered.has(id));
    registered.forEach((name,id) => { if (!merged.some(([x]) => x === id)) merged.push([id,name]); });
    merged.sort((a,b) => { const ao=categories.find(c=>c.id===a[0])?.order??99, bo=categories.find(c=>c.id===b[0])?.order??99; return ao-bo || a[1].localeCompare(b[1]); });
    categorySelect.innerHTML = '<option value="">All categories</option>' + merged.map(([id,name]) => `<option value="${escapeHTML(id)}">${escapeHTML(name)}</option>`).join('');
    categorySelect.value = current;
    if (categorySelect.value !== current) categorySelect.value = '';
  };
  const render = () => {
    const q = normalize(input.value), category = categorySelect?.value || '';
    const found = activeTools().filter(t => (!q || matches(t,q)) && (!category || String(t.category || '') === category));
    grid.innerHTML = found.length ? found.map(card).join('') : `<div class="empty"><strong>No tools found</strong><p>${tools.length ? 'Try another name, category or tag.' : 'No tools are available yet.'}</p></div>`;
  };
  const renderSuggestions = () => {
    const q = normalize(input.value);
    if (!q) { suggestions.hidden = true; suggestions.innerHTML = ''; return; }
    const found = activeTools().filter(t => matches(t,q)).slice(0,6);
    if (!found.length) { suggestions.hidden = true; suggestions.innerHTML = ''; return; }
    suggestions.innerHTML = found.map((tool,index) => `<a class="search-suggestion" href="${escapeHTML(tool.url)}" data-index="${index}" data-tool-id="${escapeHTML(tool.id)}"><span class="suggestion-icon">${tool.icon ? `<img src="${escapeHTML(tool.icon)}" alt="">` : '✦'}</span><span><strong>${escapeHTML(tool.name)}</strong><small>${escapeHTML(tool.categoryName || tool.category || 'Tool')} · ${escapeHTML(tool.description || '')}</small></span><span class="suggestion-arrow">→</span></a>`).join('');
    suggestions.hidden = false; activeSuggestion = -1;
  };
  const loadJSON = url => fetch(url + (url.includes('?')?'&':'?') + 'v=' + Date.now(), {cache:'no-store',headers:{Accept:'application/json'}}).then(r => r.ok ? r.json() : Promise.reject(new Error(`${r.status}: ${url}`)));
  const loadCategories = () => Promise.allSettled(['image','video','audio','pdf','text'].map(id => loadJSON(`/categories/${id}/category.json`).then(data => data))).then(results => { categories = results.filter(r=>r.status==='fulfilled' && r.value?.id).map(r=>r.value); });
  Promise.all([loadJSON('/data/tools.json'), loadCategories()]).then(([data]) => { tools = Array.isArray(data?.tools) ? data.tools.filter(Boolean) : []; renderCategories(); render(); }).catch(error => { console.error('[Nexauren] tools:', error); tools = []; renderCategories(); render(); });
  input.addEventListener('input', () => { render(); renderSuggestions(); });
  input.addEventListener('search', () => { render(); renderSuggestions(); });
  input.addEventListener('keydown', event => { if (event.key === 'Escape') { suggestions.hidden=true; input.value=''; render(); input.focus(); return; } if (suggestions.hidden) return; const items=[...suggestions.querySelectorAll('.search-suggestion')]; if(event.key==='ArrowDown'){event.preventDefault();activeSuggestion=Math.min(activeSuggestion+1,items.length-1);items.forEach((x,i)=>x.classList.toggle('is-active',i===activeSuggestion));} if(event.key==='ArrowUp'){event.preventDefault();activeSuggestion=Math.max(activeSuggestion-1,0);items.forEach((x,i)=>x.classList.toggle('is-active',i===activeSuggestion));} if(event.key==='Enter'&&activeSuggestion>=0){event.preventDefault();items[activeSuggestion]?.click();} });
  document.addEventListener('click', event => { if (!input.parentElement?.contains(event.target)) suggestions.hidden = true; });
  categorySelect?.addEventListener('change', () => { const url = new URL(location.href); categorySelect.value ? url.searchParams.set('category',categorySelect.value) : url.searchParams.delete('category'); history.replaceState({},'',url); render(); });
})();
