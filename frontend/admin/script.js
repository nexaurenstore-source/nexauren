const $=id=>document.getElementById(id);
const fields=['users','new_users','active_users','forms','responses','reviews','notifications'];
let userPage=1;
const userLimit=15;
function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),2600)}
function date(value){if(!value)return'—';const n=Number(value);const d=new Date((n>100000000000?n:n*1000));return Number.isNaN(d.getTime())?'—':d.toLocaleDateString(undefined,{day:'2-digit',month:'short',year:'numeric'})}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
async function load(){
  $('status').textContent='Checking administrator access…';
  fields.forEach(id=>$(id).textContent='—');
  try{
    const r=await fetch('/api/admin/dashboard?ts='+Date.now(),{credentials:'include',headers:{Accept:'application/json'},cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    if(r.status===401||r.status===403){$('status').textContent='Administrator access required.';toast('Admin access is required.');return}
    if(!r.ok)throw new Error(data.error||'Unable to load dashboard.');
    fields.forEach(id=>$(id).textContent=Number(data[id]??0).toLocaleString());
    $('status').textContent='Administrator access verified.';
    await loadUsers();
  }catch(err){$('status').textContent=err.message||'Unable to load dashboard.';toast('Dashboard data could not be loaded.')}
}
async function loadUsers(){
  const table=$('users-table');
  if(!table)return;
  table.innerHTML='<tr><td colspan="6" class="empty">Loading users…</td></tr>';
  const q=encodeURIComponent(($('user-search')?.value||'').trim());
  try{
    const r=await fetch('/api/admin/users?page='+userPage+'&limit='+userLimit+'&q='+q+'&ts='+Date.now(),{credentials:'include',headers:{Accept:'application/json'},cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    if(r.status===401||r.status===403){table.innerHTML='<tr><td colspan="6" class="empty">Administrator access required.</td></tr>';return}
    if(!r.ok)throw new Error(data.error||'Unable to load users.');
    const rows=Array.isArray(data.users)?data.users:(Array.isArray(data.results)?data.results:[]);
    if(!rows.length){table.innerHTML='<tr><td colspan="6" class="empty">No users found.</td></tr>'}
    else table.innerHTML=rows.map(u=>'<tr><td><strong>'+esc(u.username||'—')+'</strong><small>'+esc(u.id||'')+'</small></td><td>'+esc(u.email||'—')+'</td><td>'+date(u.created_at)+'</td><td>'+Number(u.xp??0).toLocaleString()+'</td><td><span class="level">Lv. '+Number(u.level??1)+'</span></td><td>'+date(u.last_access||u.last_login||u.updated_at)+'</td></tr>').join('');
    $('user-page').textContent='Page '+userPage+(data.total?' · '+Number(data.total).toLocaleString()+' users':'');
    $('prev-users').disabled=userPage<=1;
    $('next-users').disabled=rows.length<userLimit;
  }catch(err){table.innerHTML='<tr><td colspan="6" class="empty">'+esc(err.message||'Unable to load users.')+'</td></tr>'}
}
$('refresh').addEventListener('click',load);
$('user-load')?.addEventListener('click',()=>{userPage=1;loadUsers()});
$('user-search')?.addEventListener('keydown',e=>{if(e.key==='Enter'){userPage=1;loadUsers()}});
$('prev-users')?.addEventListener('click',()=>{if(userPage>1){userPage--;loadUsers()}});
$('next-users')?.addEventListener('click',()=>{userPage++;loadUsers()});
load();
