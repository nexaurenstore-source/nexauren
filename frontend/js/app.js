(()=>{'use strict';
const load=(src,attr)=>{if(document.querySelector(`script[${attr}]`))return;const s=document.createElement('script');s.src=src;s.defer=true;s.setAttribute(attr,'true');document.head.appendChild(s)};
const ensureMeta=()=>{if(!document.querySelector('link[rel="icon"]')){const l=document.createElement('link');l.rel='icon';l.type='image/png';l.href='/favicon.png?v=2';document.head.appendChild(l)}if(!document.querySelector('link[rel="apple-touch-icon"]')){const l=document.createElement('link');l.rel='apple-touch-icon';l.href='/favicon.png?v=2';document.head.appendChild(l)}};
ensureMeta();
load('/js/tool-status.js','data-nexauren-tool-status');
load('/js/notifications.js?v=2','data-nexauren-notifications');
load('/ai/nexa/nexa-widget.js?v=20260903','data-nexa-widget');
if(!document.querySelector('link[data-nexa-widget-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href='/ai/nexa/nexa-widget.css?v=20260903';l.dataset.nexaWidgetCss='true';document.head.appendChild(l)}
window.Nexauren=window.Nexauren||{};
window.Nexauren.trackTool=window.Nexauren.trackTool||(()=>{});
window.Nexauren.loadTools=()=>fetch('/data/tools.json',{cache:'default'}).then(r=>r.ok?r.json():Promise.reject(new Error('Tools unavailable'))).then(d=>Array.isArray(d.tools)?d.tools:[]);
// i18n owns the global shell so every public HTML page uses one navigation/footer.
load('/js/i18n.js','data-nexauren-i18n');
})();
