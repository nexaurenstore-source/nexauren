const $=id=>document.getElementById(id);
const fields=['users','new_users','active_users','forms','responses','reviews','notifications'];
function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),2600)}
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
  }catch(err){$('status').textContent=err.message||'Unable to load dashboard.';toast('Dashboard data could not be loaded.')}
}
$('refresh').addEventListener('click',load);
document.querySelectorAll('[data-section]').forEach(button=>button.addEventListener('click',()=>toast(button.dataset.section+' module is being prepared.')));
load();
