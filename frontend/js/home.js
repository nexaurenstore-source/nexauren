(() => {
  'use strict';
  const input=document.querySelector('#tool-search'),grid=document.querySelector('#home-tools'),featuredGrid=document.querySelector('#home-featured'),count=document.querySelector('#search-result-count');
  if(!input||!grid)return;
  let tools=[];
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const searchable=t=>[t.name,t.description,t.category,t.categoryName,t.slug,t.id,...(Array.isArray(t.tags)?t.tags:[])].join(' ');
  const card=t=>`<article class="card tool-card-item"><div class="tool-card-content"><span class="tool-category">${esc(t.categoryName||t.category||'Tool')}</span><h3>${esc(t.name)}</h3><p>${esc(t.description)}</p><a class="card-link" href="${esc(t.url)}" data-tool-id="${esc(t.id)}" data-tool-name="${esc(t.name)}">Open tool →</a></div></article>`;
  const active=()=>tools.filter(t=>String(t.status||'active').toLowerCase()!=='inactive');
  const matches=q=>{const n=norm(q);return active().filter(t=>!n||norm(searchable(t)).includes(n));};
  const renderSuggestions=q=>{
    const found=matches(q);
    if(!q){grid.innerHTML=active().slice(0,8).map(card).join('');if(count)count.textContent=`${active().length} active tools`;return;}
    grid.innerHTML=found.length?found.slice(0,8).map(card).join(''):`<div class="empty"><strong>No tools found.</strong><br>Try another name, category or tag.</div>`;
    if(count)count.textContent=found.length?`${found.length} suggestion${found.length===1?'':'s'} found`:'No suggestions';
  };
  const load=()=>fetch('/data/tools.json?v='+Date.now(),{cache:'no-store',headers:{Accept:'application/json'}}).then(r=>{if(!r.ok)throw Error('Registry '+r.status);return r.json()}).then(d=>{tools=Array.isArray(d?.tools)?d.tools.filter(Boolean):[];if(featuredGrid){const f=active().filter(t=>t.featured===true);featuredGrid.innerHTML=f.slice(0,6).map(card).join('')}renderSuggestions(input.value)}).catch(e=>{console.error(e);grid.innerHTML='<div class="empty">Unable to load tools right now. Please refresh the page.</div>'});
  input.addEventListener('input',e=>renderSuggestions(e.target.value));
  input.addEventListener('focus',()=>{if(input.value)renderSuggestions(input.value)});
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.value='';renderSuggestions('');input.blur()}});
  load();
})();
