(() => {
  if (window.__NEXA_AI_WIDGET__) return;
  window.__NEXA_AI_WIDGET__ = true;
  const root = document.createElement('div');
  root.innerHTML = `
    <button class="nexa-launcher" aria-label="Open Nexa AI"><span class="nexa-orb">✦</span><span>Nexa AI</span></button>
    <div class="nexa-panel" hidden>
      <div class="nexa-head"><div><strong>Nexa AI</strong><small id="nexa-plan">AI assistant</small></div><div class="nexa-head-actions"><button data-action="new" title="New chat">＋</button><button data-action="close" title="Close">×</button></div></div>
      <div class="nexa-toolbar"><button class="nexa-toggle" data-toggle="web">🌐 Web</button><button class="nexa-toggle" data-toggle="analysis">✦ Analysis</button><span id="nexa-usage">Loading limits…</span></div>
      <div class="nexa-messages" id="nexa-messages"><div class="nexa-empty"><div class="nexa-empty-orb">✦</div><h3>How can I help?</h3><p>Ask me to explain, write, research, solve, plan, or find a Nexauren tool.</p></div></div>
      <div class="nexa-suggestions"><button>Find an image tool</button><button>Help me write</button><button>Explain something</button></div>
      <form class="nexa-form"><textarea id="nexa-input" rows="1" maxlength="12000" placeholder="Message Nexa AI…"></textarea><button type="submit" aria-label="Send">➤</button></form>
      <div class="nexa-foot"><span>Powered by Nexauren AI</span><a href="/billing/">Plans & credits</a></div>
    </div>`;
  document.body.appendChild(root);
  const launcher=root.querySelector('.nexa-launcher'), panel=root.querySelector('.nexa-panel'), messages=root.querySelector('#nexa-messages'), input=root.querySelector('#nexa-input'), form=root.querySelector('.nexa-form'), usage=root.querySelector('#nexa-usage'), plan=root.querySelector('#nexa-plan');
  let conversationId=null, web=false, analysis=false, busy=false;
  const esc=s=>String(s||'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\':'&#92;'}[c]));
  const md=s=>esc(s).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\n/g,'<br>');
  function open(){panel.hidden=false;launcher.classList.add('is-open');input.focus();loadLimits();}
  function close(){panel.hidden=true;launcher.classList.remove('is-open');}
  function add(role,text,loading=false){const el=document.createElement('div');el.className='nexa-msg '+role+(loading?' loading':'');el.innerHTML=loading?'<span></span><span></span><span></span>':md(text);messages.appendChild(el);messages.scrollTop=messages.scrollHeight;return el;}
  function clear(){messages.innerHTML='<div class="nexa-empty"><div class="nexa-empty-orb">✦</div><h3>New conversation</h3><p>Ask Nexa AI anything you need.</p></div>';conversationId=null;}
  async function loadLimits(){try{const r=await fetch('/api/nexa-ai',{credentials:'include'});const d=await r.json();if(!r.ok)throw new Error(d.error||'Login required');plan.textContent=(d.plan||'free').toUpperCase();usage.textContent=`${d.used?.messages||0}/${d.limits?.messages||0} messages`;web=(d.plan!=='free'&&web);document.querySelectorAll('[data-toggle]').forEach(b=>b.disabled=(b.dataset.toggle==='web'&&d.plan==='free')||(b.dataset.toggle==='analysis'&&d.plan==='free'));}catch(e){plan.textContent='Sign in to use';usage.textContent='';}}
  async function send(){if(busy)return;const text=input.value.trim();if(!text)return;busy=true;input.value='';add('user',text);const loading=add('assistant','',true);try{const r=await fetch('/api/nexa-ai/chat',{method:'POST',credentials:'include',headers:{'content-type':'application/json'},body:JSON.stringify({message:text,conversation_id:conversationId,web,analysis,tools:true})});const d=await r.json();loading.remove();if(!r.ok){add('assistant',d.error||'Something went wrong.');if(d.code==='feature_plan_required')loadLimits();return;}conversationId=d.conversation_id;add('assistant',d.answer);if(d.web_sources?.length){const box=document.createElement('div');box.className='nexa-sources';box.innerHTML='<strong>Sources</strong>'+d.web_sources.map(x=>`<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a>`).join('');messages.appendChild(box);}if(d.tools?.length){const box=document.createElement('div');box.className='nexa-tools-found';box.innerHTML='<strong>Nexauren tools</strong>'+d.tools.map(x=>`<a href="/tools/${esc(x.slug)}/">${esc(x.name)}</a>`).join('');messages.appendChild(box);}loadLimits();}catch(e){loading.remove();add('assistant','I could not reach Nexa AI right now. Please try again.');}finally{busy=false;input.focus();}}
  launcher.onclick=open;root.querySelector('[data-action="close"]').onclick=close;root.querySelector('[data-action="new"]').onclick=clear;root.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{if(b.dataset.toggle==='web')web=!web;else analysis=!analysis;b.classList.toggle('active',b.dataset.toggle==='web'?web:analysis);});root.querySelectorAll('.nexa-suggestions button').forEach(b=>b.onclick=()=>{input.value=b.textContent;input.focus();});form.onsubmit=e=>{e.preventDefault();send();};input.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send();}};
})();
