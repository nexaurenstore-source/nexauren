/* Nexauren Website Builder — Integration Center
 * UI-first integration registry. Connection state intentionally lives in JS memory only.
 * Secrets must be handled by a server-side connector/OAuth flow; never persist API keys in the builder.
 */
(function(){
  'use strict';

  const PROVIDERS = [
    {id:'cloudflare-r2',name:'Cloudflare R2',kind:'Storage',icon:'☁️',desc:'Guardar imagens e ficheiros em object storage.',method:'API / Access Keys',fields:['Account ID','Access Key ID','Secret Access Key','Bucket']},
    {id:'amazon-s3',name:'Amazon S3',kind:'Storage',icon:'🗄️',desc:'Guardar imagens, ficheiros e exports.',method:'Access Keys',fields:['Region','Access Key ID','Secret Access Key','Bucket']},
    {id:'google-drive',name:'Google Drive',kind:'Storage',icon:'📁',desc:'Guardar e organizar ficheiros através da conta Google.',method:'OAuth',fields:[]},
    {id:'dropbox',name:'Dropbox',kind:'Storage',icon:'📦',desc:'Guardar ficheiros e imagens numa conta Dropbox.',method:'OAuth',fields:[]},
    {id:'supabase',name:'Supabase',kind:'Database',icon:'⚡',desc:'Base de dados, Storage e APIs para o seu projeto.',method:'URL + API Key',fields:['Project URL','Anon / Service Key']},
    {id:'firebase',name:'Firebase',kind:'Database',icon:'🔥',desc:'Firestore, Storage e outros serviços Firebase.',method:'Project Config / OAuth',fields:['Project ID','API Key']},
    {id:'paypal',name:'PayPal',kind:'Payments',icon:'💳',desc:'Pagamentos e subscrições PayPal.',method:'OAuth / Client ID + Secret',fields:['Client ID','Client Secret','Environment']},
    {id:'stripe',name:'Stripe',kind:'Payments',icon:'💰',desc:'Pagamentos, checkout e subscrições Stripe.',method:'API Key / OAuth',fields:['Publishable Key','Secret Key']},
    {id:'flutterwave',name:'Flutterwave',kind:'Payments',icon:'🌍',desc:'Pagamentos e checkout com Flutterwave.',method:'API Keys',fields:['Public Key','Secret Key','Environment']},
    {id:'google',name:'Google Account',kind:'Accounts',icon:'G',desc:'Login e ligação de conta Google.',method:'OAuth',fields:[]},
    {id:'github',name:'GitHub',kind:'Accounts',icon:'◉',desc:'Ligar uma conta GitHub ou repositório.',method:'OAuth / Token',fields:['Token (server-side)']},
    {id:'custom-api',name:'Custom API',kind:'Custom',icon:'⌘',desc:'Ligue qualquer serviço REST/HTTP compatível.',method:'API Key / Bearer / OAuth',fields:['Base URL','Authentication']}
  ];

  const state = {connections:{}, selectedCategory:'All', selectedProvider:null};

  const esc = s => String(s ?? '').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

  function injectStyle(){
    if(document.getElementById('nx-integration-style')) return;
    const css = `
      .nx-int-overlay{position:fixed;inset:0;background:rgba(15,23,42,.48);backdrop-filter:blur(4px);z-index:9998;display:none;align-items:center;justify-content:center;padding:20px}
      .nx-int-overlay.open{display:flex}
      .nx-int-modal{width:min(1080px,100%);max-height:min(820px,92vh);overflow:hidden;background:#fff;border:1px solid #e5e7eb;border-radius:22px;box-shadow:0 24px 80px rgba(15,23,42,.22);display:flex;flex-direction:column}
      .nx-int-head{display:flex;align-items:center;gap:16px;padding:20px 22px;border-bottom:1px solid #eef0f4}.nx-int-head h2{margin:0;font-size:20px}.nx-int-head p{margin:4px 0 0;color:#667085;font-size:13px}.nx-int-close{margin-left:auto}
      .nx-int-body{display:grid;grid-template-columns:210px 1fr;min-height:520px;overflow:hidden}.nx-int-nav{padding:14px;border-right:1px solid #eef0f4;background:#fafbfc;overflow:auto}.nx-int-nav button{width:100%;border:0;background:transparent;text-align:left;padding:10px 12px;border-radius:10px;cursor:pointer;color:#475467}.nx-int-nav button.active{background:#e9eefc;color:#273b91;font-weight:700}.nx-int-content{padding:20px;overflow:auto}
      .nx-int-toolbar{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:16px}.nx-int-toolbar input{width:min(330px,100%);padding:10px 12px;border:1px solid #d9dee8;border-radius:10px;outline:none}.nx-int-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.nx-int-card{border:1px solid #e5e7eb;border-radius:16px;padding:16px;background:#fff}.nx-int-card:hover{border-color:#c7d2fe}.nx-int-card-top{display:flex;align-items:flex-start;gap:12px}.nx-int-icon{width:40px;height:40px;border-radius:11px;background:#f1f5f9;display:grid;place-items:center;font-weight:800}.nx-int-card h3{margin:0;font-size:15px}.nx-int-card p{margin:5px 0 0;color:#667085;font-size:12px;line-height:1.45}.nx-int-meta{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}.nx-int-pill{font-size:11px;padding:4px 7px;border-radius:999px;background:#f2f4f7;color:#475467}.nx-int-pill.ok{background:#ecfdf3;color:#027a48}.nx-int-actions{display:flex;justify-content:flex-end;gap:8px}.nx-int-btn{border:1px solid #d0d5dd;background:#fff;border-radius:9px;padding:8px 11px;cursor:pointer;font-size:12px}.nx-int-btn.primary{background:#635bff;border-color:#635bff;color:#fff}.nx-int-empty{padding:40px 10px;text-align:center;color:#667085}.nx-int-form{display:grid;gap:12px}.nx-int-form label{font-size:12px;font-weight:700;color:#344054}.nx-int-form input,.nx-int-form select{width:100%;box-sizing:border-box;padding:10px 11px;border:1px solid #d0d5dd;border-radius:9px}.nx-int-warning{padding:11px 12px;border-radius:10px;background:#fffaeb;color:#92400e;font-size:12px;line-height:1.45}.nx-int-foot{display:flex;justify-content:flex-end;gap:8px;padding-top:6px}.nx-int-back{display:none}.nx-int-detail{max-width:620px}.nx-int-detail h3{margin:0 0 4px}.nx-int-detail .sub{margin:0 0 18px;color:#667085;font-size:13px}.nx-int-check{display:flex;gap:9px;align-items:center;padding:11px 0;font-size:12px;color:#475467}.nx-int-check input{width:auto}.nx-int-connected{margin-top:16px;padding:12px;border:1px solid #abefc6;background:#f6fef9;border-radius:12px;color:#027a48;font-size:12px}
      @media(max-width:760px){.nx-int-body{grid-template-columns:1fr}.nx-int-nav{display:flex;gap:6px;border-right:0;border-bottom:1px solid #eef0f4;overflow:auto}.nx-int-nav button{white-space:nowrap}.nx-int-grid{grid-template-columns:1fr}.nx-int-toolbar{align-items:stretch;flex-direction:column}.nx-int-toolbar input{width:100%}.nx-int-back{display:inline-flex}}
    `;
    const style=document.createElement('style');style.id='nx-integration-style';style.textContent=css;document.head.appendChild(style);
  }

  function open(){
    injectStyle();
    if(!document.getElementById('nxIntegrationOverlay')) build();
    document.getElementById('nxIntegrationOverlay').classList.add('open');
    render();
  }
  function close(){const el=document.getElementById('nxIntegrationOverlay');if(el)el.classList.remove('open')}

  function build(){
    const el=document.createElement('div');el.id='nxIntegrationOverlay';el.className='nx-int-overlay';
    el.innerHTML=`<div class="nx-int-modal" role="dialog" aria-modal="true" aria-labelledby="nxIntTitle">
      <div class="nx-int-head"><div><h2 id="nxIntTitle">Connections</h2><p>Conecte armazenamento, pagamentos, bases de dados e contas ao seu projeto.</p></div><button class="nx-int-btn nx-int-close" data-int="close">Fechar</button></div>
      <div class="nx-int-body"><nav class="nx-int-nav" id="nxIntNav"></nav><section class="nx-int-content" id="nxIntContent"></section></div>
    </div>`;
    el.addEventListener('click',e=>{
      if(e.target===el || e.target.closest('[data-int="close"]')) return close();
      const cat=e.target.closest('[data-category]'); if(cat){state.selectedCategory=cat.dataset.category;state.selectedProvider=null;render();return}
      const connect=e.target.closest('[data-connect]'); if(connect){state.selectedProvider=connect.dataset.connect;renderDetail();return}
      const back=e.target.closest('[data-back]'); if(back){state.selectedProvider=null;render();return}
      const disconnect=e.target.closest('[data-disconnect]'); if(disconnect){delete state.connections[disconnect.dataset.disconnect];render();return}
      if(e.target.closest('[data-save-connection]')){saveConnection();return}
    });
    document.body.appendChild(el);
  }

  function categories(){return ['All','Storage','Database','Payments','Accounts','Custom']}

  function renderNav(){
    document.getElementById('nxIntNav').innerHTML=categories().map(c=>`<button class="${state.selectedCategory===c?'active':''}" data-category="${c}">${c==='All'?'✦ Todos':c==='Storage'?'☁️ Armazenamento':c==='Database'?'▦ Dados':c==='Payments'?'💳 Pagamentos':c==='Accounts'?'◎ Contas':'⌘ APIs personalizadas'}</button>`).join('');
  }

  function render(){
    renderNav();
    if(state.selectedProvider){renderDetail();return}
    const q=(document.getElementById('nxIntSearch')?.value||'').toLowerCase();
    const list=PROVIDERS.filter(p=>(state.selectedCategory==='All'||p.kind===state.selectedCategory)&&(!q||`${p.name} ${p.kind} ${p.desc}`.toLowerCase().includes(q)));
    document.getElementById('nxIntContent').innerHTML=`<div class="nx-int-toolbar"><div><strong>${list.length} serviços</strong></div><input id="nxIntSearch" placeholder="Pesquisar serviço..."></div><div class="nx-int-grid">${list.map(card).join('')}</div>`;
    const search=document.getElementById('nxIntSearch');search.addEventListener('input',()=>render());
  }

  function card(p){
    const connected=state.connections[p.id];
    return `<article class="nx-int-card"><div class="nx-int-card-top"><div class="nx-int-icon">${p.icon}</div><div><h3>${esc(p.name)}</h3><p>${esc(p.desc)}</p></div></div><div class="nx-int-meta"><span class="nx-int-pill">${esc(p.kind)}</span><span class="nx-int-pill">${esc(p.method)}</span>${connected?'<span class="nx-int-pill ok">✓ Ligado</span>':''}</div><div class="nx-int-actions">${connected?`<button class="nx-int-btn" data-disconnect="${p.id}">Desligar</button>`:''}<button class="nx-int-btn primary" data-connect="${p.id}">${connected?'Gerir':'Conectar'}</button></div></article>`;
  }

  function renderDetail(){
    const p=PROVIDERS.find(x=>x.id===state.selectedProvider); if(!p)return;
    const connected=state.connections[p.id];
    document.getElementById('nxIntContent').innerHTML=`<div class="nx-int-detail"><button class="nx-int-btn nx-int-back" data-back>← Voltar</button><div style="margin-top:14px"><div class="nx-int-icon" style="margin-bottom:12px">${p.icon}</div><h3>${esc(p.name)}</h3><p class="sub">${esc(p.desc)} Método disponível: <strong>${esc(p.method)}</strong>.</p></div>
      ${connected?`<div class="nx-int-connected">✓ Esta ligação está ativa nesta sessão. ${esc(connected.label||'Configuração pronta')}.</div>`:''}
      <div class="nx-int-warning"><strong>Segurança:</strong> chaves secretas e tokens não devem ser guardados no HTML, localStorage ou sessionStorage. Em produção, esta ligação deve passar por OAuth ou por um endpoint seguro do backend.</div>
      <form class="nx-int-form" id="nxIntForm" style="margin-top:16px">${p.fields.map((f,i)=>`<div><label>${esc(f)}</label><input type="${/secret|token|key/i.test(f)?'password':'text'}" name="f${i}" placeholder="${esc(f)}" autocomplete="off"></div>`).join('')}${!p.fields.length?`<p style="font-size:13px;color:#667085">Este serviço usa OAuth. O botão abaixo prepara o fluxo de autorização; o callback seguro deve ser implementado no backend.</p>`:''}<label class="nx-int-check"><input type="checkbox" required> Confirmo que esta ligação pertence a mim e tenho autorização para a utilizar.</label><div class="nx-int-foot"><button type="button" class="nx-int-btn" data-back>Cancelar</button><button type="button" class="nx-int-btn primary" data-save-connection>Guardar ligação</button></div></form></div>`;
  }

  function saveConnection(){
    const p=PROVIDERS.find(x=>x.id===state.selectedProvider);if(!p)return;
    const form=document.getElementById('nxIntForm');if(form && !form.querySelector('input[type=checkbox]').checked){form.querySelector('input[type=checkbox]').focus();return}
    state.connections[p.id]={connectedAt:Date.now(),label:p.method==='OAuth'?'OAuth pendente':'Configuração pronta'};
    render();
    if(window.NexaurenWebsiteBuilder && typeof window.NexaurenWebsiteBuilder.emit==='function') window.NexaurenWebsiteBuilder.emit('integration:connected',{provider:p.id,kind:p.kind});
  }

  window.NexaurenIntegrations={open,close,providers:PROVIDERS,getConnections:()=>({...state.connections}),connect:(id)=>{if(PROVIDERS.some(p=>p.id===id)){state.connections[id]={connectedAt:Date.now(),label:'Conectado via API/OAuth'};render();}}};

  function mountButton(){
    const top=document.querySelector('.wb-top');if(!top||document.getElementById('integrationBtn'))return;
    const b=document.createElement('button');b.id='integrationBtn';b.className='wb-ghost';b.textContent='Connections';b.title='Conectar serviços externos';b.addEventListener('click',open);top.insertBefore(b,document.getElementById('previewBtn')||null);
  }
  const timer=setInterval(mountButton,500);setTimeout(()=>clearInterval(timer),15000);mountButton();
})();
