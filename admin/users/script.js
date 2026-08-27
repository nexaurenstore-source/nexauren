const state={page:1,limit:25,total:0,q:''};
const $=s=>document.querySelector(s);
const tbody=$('#users'),status=$('#status'),search=$('#search'),pageLabel=$('#page'),prev=$('#prev'),next=$('#next');
let timer;
function escapeHTML(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function date(v){if(!v)return '—';const n=Number(v);const d=new Date(n<100000000000?n*1000:n);return Number.isNaN(d.getTime())?'—':d.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});}
async function load(){
  tbody.innerHTML='<tr><td colspan="5" class="empty">Loading…</td></tr>';
  status.textContent='Loading users…';
  const params=new URLSearchParams({page:String(state.page),limit:String(state.limit)});
  if(state.q)params.set('q',state.q);
  try{
    const res=await fetch('/api/admin/users?'+params.toString(),{credentials:'include',headers:{Accept:'application/json'}});
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||'Unable to load users.');
    state.total=Number(data.total||0);
    const users=Array.isArray(data.users)?data.users:[];
    if(!users.length)tbody.innerHTML='<tr><td colspan="5" class="empty">No users found.</td></tr>';
    else tbody.innerHTML=users.map(u=>`<tr><td><div class="user-email">${escapeHTML(u.email)}</div><div class="user-name">${escapeHTML(u.username||'No username')}</div></td><td>${Number(u.xp||0).toLocaleString()}</td><td>${Number(u.level||1)}</td><td>${date(u.created_at)}</td><td>${date(u.updated_at)}</td></tr>`).join('');
    const pages=Math.max(1,Math.ceil(state.total/state.limit));
    pageLabel.textContent=`Page ${state.page} of ${pages}`;
    prev.disabled=state.page<=1;
    next.disabled=state.page>=pages;
    status.textContent=`${state.total.toLocaleString()} user${state.total===1?'':'s'} found`;
  }catch(err){tbody.innerHTML=`<tr><td colspan="5" class="empty">${escapeHTML(err.message)}</td></tr>`;status.textContent='Could not load users.';prev.disabled=true;next.disabled=true;}
}
search.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(()=>{state.q=search.value.trim();state.page=1;load();},300)});
$('#refresh').addEventListener('click',load);
prev.addEventListener('click',()=>{if(state.page>1){state.page--;load();}});
next.addEventListener('click',()=>{if(state.page<Math.ceil(state.total/state.limit)){state.page++;load();}});
load();
