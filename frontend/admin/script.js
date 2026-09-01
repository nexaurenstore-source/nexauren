const $=id=>document.getElementById(id);
const fields=['users','new_users','active_users','forms','responses','reviews','notifications'];
function toast(message){const el=$('toast');if(!el)return;el.textContent=message;el.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>el.classList.remove('show'),2600)}
function escapeHtml(value){return String(value).replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
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
async function createPayPalProduct(event){
  event.preventDefault();const result=$('paypal-result'),button=$('paypal-create');
  const payload={name:$('paypal-name').value.trim(),description:$('paypal-description').value.trim(),type:$('paypal-type').value,category:$('paypal-category').value.trim()||'SOFTWARE',image_url:$('paypal-image').value.trim(),home_url:$('paypal-home').value.trim()};
  result.className='result';result.textContent='Creating product…';button.disabled=true;
  try{const r=await fetch('/api/admin/paypal/products',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});const data=await r.json().catch(()=>({}));if(r.status===401||r.status===403)throw new Error(data.error||'Administrator access required.');if(!r.ok)throw new Error(data.error||'Unable to create the PayPal product.');const product=data.product||{};result.className='result success';result.innerHTML=`<strong>Product created successfully.</strong><br>PayPal Product ID: <code>${escapeHtml(product.id||'—')}</code>`;$('paypal-product-form').reset();$('paypal-type').value='SERVICE';$('paypal-category').value='SOFTWARE';}catch(err){result.className='result error';result.textContent=err.message||'Unable to create the PayPal product.'}finally{button.disabled=false}
}
async function createPayPalPlan(event){
  event.preventDefault();const result=$('paypal-plan-result'),button=$('paypal-plan-create');
  const price=Number($('paypal-plan-price').value);const payload={plan_id:$('paypal-plan-id').value.trim(),product_id:$('paypal-plan-product').value.trim(),name:$('paypal-plan-name').value.trim(),description:$('paypal-plan-description').value.trim(),price_minor:Math.round(price*100),currency:$('paypal-plan-currency').value,interval_unit:$('paypal-plan-interval').value,interval_count:Number($('paypal-plan-count').value),trial_days:Number($('paypal-plan-trial').value),credits_per_cycle:Number($('paypal-plan-credits').value)};
  result.className='result';result.textContent='Creating PayPal subscription plan…';button.disabled=true;
  try{const r=await fetch('/api/admin/paypal/plans',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});const data=await r.json().catch(()=>({}));if(r.status===401||r.status===403)throw new Error(data.error||'Administrator access required.');if(!r.ok)throw new Error(data.error||'Unable to create the PayPal plan.');const plan=data.plan||{};result.className='result success';result.innerHTML=`<strong>Plan created successfully.</strong><br>Local plan: <code>${escapeHtml(plan.id||'—')}</code><br>PayPal Plan ID: <code>${escapeHtml(plan.paypal_plan_id||'—')}</code>`;$('paypal-plan-form').reset();$('paypal-plan-count').value='1';$('paypal-plan-trial').value='0';$('paypal-plan-credits').value='1000';$('paypal-plan-currency').value='USD';$('paypal-plan-interval').value='MONTH';}catch(err){result.className='result error';result.textContent=err.message||'Unable to create the PayPal plan.'}finally{button.disabled=false}
}
$('refresh').addEventListener('click',load);
$('paypal-product-form')?.addEventListener('submit',createPayPalProduct);
$('paypal-plan-form')?.addEventListener('submit',createPayPalPlan);
load();
