(()=>{'use strict';
const limits={free:{daily:10,max:10,effects:0},starter:{daily:25,max:50,effects:1},pro:{daily:Infinity,max:500,effects:2},premium:{daily:Infinity,max:500,effects:3}};
let currentPlan='free',authorizationBusy=false;
function normalizePlan(value){const raw=String(value||'free').toLowerCase();if(raw.includes('premium'))return'premium';if(raw.includes('pro'))return'pro';if(raw.includes('starter'))return'starter';return'free'}
function generationReference(){try{return`sample-maker:${crypto.randomUUID()}`}catch{return`sample-maker:${Date.now()}:${Math.random().toString(36).slice(2)}`}}
function showGenerationError(data,status){let message=data?.error||'This generation is not available on your current plan.';if(status===401)message='Please sign in to use Sample Maker.';else if(status===429)message='You have reached your daily Sample Maker generation limit.';alert(message)}
async function authorizeGeneration(){
 const button=document.querySelector('#generate'),count=document.querySelector('#count'),effects=[...document.querySelectorAll('#effects input:checked')].map(x=>x.value);
 if(!button||authorizationBusy)return;
 authorizationBusy=true;button.disabled=true;
 try{
  const requested=Math.max(1,Math.floor(Number(count?.value||1)));
  const r=await fetch('/api/tools/sample-maker/generation',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({count:requested,effects,reference:generationReference()})});
  let data={};try{data=await r.json()}catch{}
  if(!r.ok){showGenerationError(data,r.status);return}
  if(data.plan&&limits[data.plan]){currentPlan=data.plan;window.NEXAUREN_SAMPLE_MAKER_APPLY_PLAN?.(data.plan)}
  if(data.daily_limit!=null)window.NEXAUREN_SAMPLE_MAKER_SET_USAGE?.(data.remaining);
  if(typeof window.NEXAUREN_SAMPLE_MAKER_RUN==='function'){await window.NEXAUREN_SAMPLE_MAKER_RUN()}else{throw new Error('Sample Maker engine is not ready.')}
 }catch(e){console.warn('Sample Maker generation authorization failed',e);if(e?.message==='Sample Maker engine is not ready.')alert('Sample Maker is still loading. Please try again.');else if(e?.name!=='AbortError')alert('Could not verify this generation. Please try again.')}finally{authorizationBusy=false;button.disabled=false}
}
function installGenerationGuard(){const button=document.querySelector('#generate');if(!button)return;button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();authorizeGeneration()},true)}
async function loadPlan(){try{const r=await fetch('/api/billing/account',{credentials:'include',headers:{Accept:'application/json'}});if(!r.ok)return;const d=await r.json(),a=d?.account||{},plan=normalizePlan(a.plan_id||a.plan_name||'free');currentPlan=plan;const l=limits[plan],title=document.querySelector('#plan-label'),usage=document.querySelector('#usage-label'),count=document.querySelector('#count'),countValue=document.querySelector('#count-value'),countHelp=document.querySelector('#count-help'),note=document.querySelector('#control-note');if(title)title.textContent=`${plan[0].toUpperCase()+plan.slice(1)} plan`;if(usage)usage.textContent=Number.isFinite(l.daily)?`${l.daily} generations per day`:'Unlimited generations';if(count){count.max=String(l.max);if(Number(count.value)>l.max)count.value=String(l.max);if(countValue)countValue.textContent=count.value;if(countHelp)countHelp.textContent=`${plan[0].toUpperCase()+plan.slice(1)}: up to ${l.max} samples per generation`;}if(note)note.textContent=plan==='premium'?'All controls unlocked':plan==='pro'?'Advanced controls unlocked':plan==='starter'?'Expanded controls available':'Basic controls available';document.documentElement.dataset.sampleMakerPlan=plan;window.NEXAUREN_SAMPLE_MAKER_PLAN=plan;window.NEXAUREN_SAMPLE_MAKER_LIMITS=l;window.NEXAUREN_SAMPLE_MAKER_APPLY_PLAN?.(plan)}catch(e){console.warn('Sample Maker plan lookup failed',e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installGenerationGuard,{once:true});else installGenerationGuard();
loadPlan();
})();