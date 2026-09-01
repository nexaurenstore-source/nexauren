const $=id=>document.getElementById(id);
const fields=['users','new_users','active_users','forms','responses','reviews','notifications'];
async function load(){
  $('status').textContent='Checking administrator access…';
  fields.forEach(id=>$(id).textContent='—');
  try{
    const r=await fetch('/api/admin/dashboard',{credentials:'include',headers:{Accept:'application/json'}});
    const data=await r.json().catch(()=>({}));
    if(r.status===401||r.status===403){$('status').textContent='Administrator access required.';return}
    if(!r.ok)throw new Error(data.error||'Unable to load dashboard.');
    fields.forEach(id=>$(id).textContent=Number(data[id]??0).toLocaleString());
    $('status').textContent='Administrator access verified.';
  }catch(err){$('status').textContent=err.message||'Unable to load dashboard.'}
}
async function createPayPalProduct(event){
  event.preventDefault();
  const result=$('paypal-result');
  const button=$('paypal-create');
  const payload={
    name:$('paypal-name').value.trim(),
    description:$('paypal-description').value.trim(),
    type:$('paypal-type').value,
    category:$('paypal-category').value.trim()||'SOFTWARE',
    image_url:$('paypal-image').value.trim(),
    home_url:$('paypal-home').value.trim()
  };
  result.className='result';
  result.textContent='Creating product…';
  button.disabled=true;
  try{
    const r=await fetch('/api/admin/paypal/products',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(payload)});
    const data=await r.json().catch(()=>({}));
    if(r.status===401||r.status===403)throw new Error(data.error||'Administrator access required.');
    if(!r.ok)throw new Error(data.error||'Unable to create the PayPal product.');
    const product=data.product||{};
    result.className='result success';
    result.innerHTML=`<strong>Product created successfully.</strong><br>PayPal Product ID: <code>${escapeHtml(product.id||'—')}</code>`;
    $('paypal-product-form').reset();
    $('paypal-type').value='SERVICE';
    $('paypal-category').value='SOFTWARE';
  }catch(err){
    result.className='result error';
    result.textContent=err.message||'Unable to create the PayPal product.';
  }finally{button.disabled=false}
}
function escapeHtml(value){return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
$('refresh').addEventListener('click',load);load();
$('paypal-product-form')?.addEventListener('submit',createPayPalProduct);
