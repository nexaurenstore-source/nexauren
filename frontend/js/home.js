(() => {
  'use strict';
  const input=document.querySelector('#tool-search'),grid=document.querySelector('#home-tools'),featuredGrid=document.querySelector('#home-featured'),count=document.querySelector('#search-result-count');
  if(!input||!grid)return;
  let tools=[],selected=-1;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const searchable=t=>[t.name,t.description,t.category,t.categoryName,t.slug,t.id,...(Array.isArray(t.tags)?t.tags:[])].join(' ');
  const active=()=>tools.filter(t=>String(t.status||'active').toLowerCase()!=='inactive');
  const matches=q=>{const n=norm(q);return active().filter(t=>!n||norm(searchable(t)).includes(n));};
  const card=t=>`<article class="card tool-card-item"><div class="tool-card-content"><span class="tool-category">${esc(t.categoryName||t.category||'Tool')}</span><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p><a class="card-link" href="${esc(t.url)}" data-tool-id="${esc(t.id)}" data-tool-name="${esc(t.name)}">Open tool →</a></div></article>`;
  let box=document.querySelector('#tool-search-suggestions');
  if(!box){box=document.createElement('div');box.id='tool-search-suggestions';box.className='tool-search-suggestions';box.setAttribute('role','listbox');input.parentElement.appendChild(box)}
  const renderSuggestions=q=>{
    const found=matches(q);
    selected=-1;
    box.innerHTML=found.slice(0,7).map((t,i)=>`<a role="option" class="tool-suggestion" data-index="${i}" href="${esc(t.url)}"><span class="suggestion-icon">${esc(t.icon||'🔧')}</span><span><strong>${esc(t.name)}</strong><small>${esc(t.categoryName||t.category||'Tool')}</small></span></a>`).join('');
    box.hidden=!q.trim()||!found.length;
    if(count)count.textContent=q.trim()?(found.length?`${found.length} suggestion${found.length===1?'':'s'} found`:'No suggestions'):`${active().length} active tools`;
    if(q.trim()){grid.innerHTML=found.length?found.map(card).join(''):`<div class="empty"><strong>No tools found.</strong><br>Try another name, category or tag.</div>`}
    else grid.innerHTML=active().slice(0,8).map(card).join('');
  };
  const setSelected=i=>{const items=[...box.querySelectorAll('.tool-suggestion')];items.forEach(x=>x.classList.remove('selected'));if(items[i]){items[i].classList.add('selected');selected=i;input.setAttribute('aria-activedescendant',`tool-suggestion-${i}`)}};
  input.setAttribute('aria-controls','tool-search-suggestions');input.setAttribute('aria-autocomplete','list');
  input.addEventListener('input',e=>renderSuggestions(e.target.value));
  input.addEventListener('focus',()=>renderSuggestions(input.value));
  input.addEventListener('keydown',e=>{const items=[...box.querySelectorAll('.tool-suggestion')];if(e.key==='ArrowDown'&&items.length){e.preventDefault();setSelected(Math.min(selected+1,items.length-1))}else if(e.key==='ArrowUp'&&items.length){e.preventDefault();setSelected(Math.max(selected-1,0))}else if(e.key==='Enter'&&selected>=0&&items[selected]){e.preventDefault();location.href=items[selected].href}else if(e.key==='Escape'){input.value='';box.hidden=true;renderSuggestions('');input.blur()}});
  document.addEventListener('click',e=>{if(!e.target.closest('.search-wrap'))box.hidden=true});
  const load=()=>fetch('/data/tools.json?v='+Date.now(),{cache:'no-store',headers:{Accept:'application/json'}}).then(r=>{if(!r.ok)throw Error('Registry '+r.status);return r.json()}).then(d=>{tools=Array.isArray(d?.tools)?d.tools.filter(Boolean):[];if(featuredGrid)featuredGrid.innerHTML=active().filter(t=>t.featured===true).slice(0,6).map(card).join('');renderSuggestions(input.value)}).catch(e=>{console.error('Nexauren search:',e);grid.innerHTML='<div class="empty">Unable to load tools right now. Please refresh the page.</div>'});
  load();
})();
