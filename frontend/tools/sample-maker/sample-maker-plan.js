(()=>{'use strict';
const limits={free:{daily:10,max:10,effects:0},starter:{daily:25,max:50,effects:1},pro:{daily:Infinity,max:500,effects:2},premium:{daily:Infinity,max:500,effects:3}};
let currentPlan='free';
let authorizationBusy=false;
let allowNextGenerationClick=false;
function generationReference(){try{return `sample-maker:${crypto.randomUUID()}`}catch{return `sample-maker:${Date.now()}:${Math.random().toString(36).slice(2)}`}}
function showGenerationError(data,status){const message=status===401?'Please sign in to use Sample Maker.':status===429?'You have reached your daily Sample Maker generation limit.':data?.error||'This generation is not available on your current plan.';alert(message)}
async function authorizeGeneration(){
  const button=document.querySelector('#generate'),count=document.querySelector('#count'),effects=[...document.querySelectorAll('#effects input:checked')].map(x=>x.value);
  if(!button||authorizationBusy)return;
  authorizationBusy=true;button.disabled=true;
  try{
    const requested=Math.max(1,Number(count?.value||1));
    const r=await fetch('/api/tools/sample-maker/generation',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({count:requested,effects,reference:generationReference()})});
    let data={};try{data=await r.json()}catch{}
    if(!r.ok){showGenerationError(data,r.status);return}
    if(data.plan&&limits[data.plan]){currentPlan=data.plan;window.NEXAUREN_SAMPLE_MAKER_APPLY_PLAN?.(data.plan)}
    const usage=document.querySelector('#usage-label');
    if(usage&&data.daily_limit!=null)usage.textContent=`${Math.max(0,Number(data.remaining||0))} generations left today`;
    allowNextGenerationClick=true;
    button.disabled=false;
    button.click();
  }catch(e){console.warn('Sample Maker generation authorization failed',e);alert('Could not verify this generation. Please try again.');}
  finally{authorizationBusy=false;if(!allowNextGenerationClick)button.disabled=false}
}
function installGenerationGuard(){
  const button=document.querySelector('#generate');if(!button)return;
  button.addEventListener('click',event=>{
    if(allowNextGenerationClick){allowNextGenerationClick=false;return}
    event.preventDefault();event.stopImmediatePropagation();authorizeGeneration();
  },true);
}
async function loadPlan(){try{const r=await fetch('/api/billing/account',{credentials:'include',headers:{Accept:'application/json'}});if(!r.ok)return;const d=await r.json();const a=d?.account||{};let plan=String(a.plan_id||a.plan_name||'free').toLowerCase();if(plan.includes('premium'))plan='premium';else if(plan.includes('pro'))plan='pro';else if(plan.includes('starter'))plan='starter';else plan='free';currentPlan=plan;const l=limits[plan];const title=document.querySelector('#plan-label'),usage=document.querySelector('#usage-label'),count=document.querySelector('#count'),countValue=document.querySelector('#count-value'),countHelp=document.querySelector('#count-help'),note=document.querySelector('#control-note');if(title)title.textContent=`${plan[0].toUpperCase()+plan.slice(1)} plan`;if(usage)usage.textContent=Number.isFinite(l.daily)?`${l.daily} generations per day`:'Unlimited generations';if(count){count.max=String(l.max);if(Number(count.value)>l.max)count.value=String(l.max);if(countValue)countValue.textContent=count.value;if(countHelp)countHelp.textContent=`${plan[0].toUpperCase()+plan.slice(1)}: up to ${l.max} samples per generation`;}if(note)note.textContent=plan==='premium'?'All controls unlocked':plan==='pro'?'Advanced controls unlocked':plan==='starter'?'Expanded controls available':'Basic controls available';document.documentElement.dataset.sampleMakerPlan=plan;window.NEXAUREN_SAMPLE_MAKER_PLAN=plan;window.NEXAUREN_SAMPLE_MAKER_LIMITS=l;window.NEXAUREN_SAMPLE_MAKER_APPLY_PLAN?.(plan);}catch(e){console.warn('Sample Maker plan lookup failed',e)}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installGenerationGuard,{once:true});else installGenerationGuard();
loadPlan();
})();
