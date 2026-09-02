const $=id=>document.getElementById(id);
function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),2600)}
function escapeHtml(value){return String(value).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
async function load(){
  const status=$('result'),list=$('tool-list');
  status.className='result';status.textContent='Loading tool credit settings…';list.innerHTML='';
  try{
    const r=await fetch('/api/admin/tool-billing?ts='+Date.now(),{credentials:'include',headers:{Accept:'application/json'},cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    if(r.status===401||r.status===403){status.className='result error';status.textContent=data.error||'Administrator access required.';return}
    if(!r.ok)throw new Error(data.error||'Unable to load tool credit settings.');
    const tools=Array.isArray(data.tools)?data.tools:[];
    if(!tools.length){status.textContent='No active tools found.';return}
    tools.forEach(tool=>{
      const cost=Math.max(0,Math.floor(Number(tool.credit_cost||0)));
      const row=document.createElement('div');
      row.style.cssText='display:grid;grid-template-columns:minmax(180px,1fr) 140px 150px 100px;gap:10px;align-items:center;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)';
      row.innerHTML=`<div><strong>${escapeHtml(tool.name)}</strong><small style="display:block;opacity:.65">${escapeHtml(tool.studio||tool.tool_id)}</small></div><label style="margin:0">Credits<input data-credit-tool="${escapeHtml(tool.tool_id)}" type="number" min="0" max="1000000000" step="1" value="${cost}" style="width:100%"></label><span>${cost===0?'🟢 Free':'🟡 '+cost.toLocaleString()+' credits / use'}</span><button class="primary" type="button" data-save-tool="${escapeHtml(tool.tool_id)}">Save</button>`;
      list.appendChild(row);
    });
    list.querySelectorAll('[data-save-tool]').forEach(button=>button.addEventListener('click',()=>save(button.dataset.saveTool)));
    status.className='result success';status.textContent=`${tools.length} active tools loaded. Changes are controlled by the Admin.`;
  }catch(err){status.className='result error';status.textContent=err.message||'Unable to load tool credit settings.'}
}
async function save(toolId){
  const input=document.querySelector(`[data-credit-tool="${CSS.escape(toolId)}"]`),status=$('result'),button=document.querySelector(`[data-save-tool="${CSS.escape(toolId)}"]`);
  const cost=Number(input?.value);
  if(!Number.isSafeInteger(cost)||cost<0||cost>1000000000){toast('Enter a valid whole-number credit cost.');return}
  if(button)button.disabled=true;
  try{
    const r=await fetch('/api/admin/tool-billing',{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({tool_id:toolId,credit_cost:cost,enabled:true})});
    const data=await r.json().catch(()=>({}));
    if(r.status===401||r.status===403)throw new Error(data.error||'Administrator access required.');
    if(!r.ok)throw new Error(data.error||'Unable to save tool credit cost.');
    status.className='result success';status.textContent=`Saved: ${toolId} now costs ${cost.toLocaleString()} credit${cost===1?'':'s'} per use.`;toast('Tool credit cost saved.');await load();
  }catch(err){status.className='result error';status.textContent=err.message||'Unable to save tool credit cost.';toast('Could not save tool credit cost.')}
  finally{if(button)button.disabled=false}
}
$('refresh').addEventListener('click',load);load();
