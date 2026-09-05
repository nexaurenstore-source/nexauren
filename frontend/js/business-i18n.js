(()=>{'use strict';
// Business Studio now uses the same global Nexauren i18n runtime as every other page.
// Keep this compatibility bridge for older Business pages that still load this file.
const boot=()=>{const api=window.Nexauren?.i18n;if(!api)return;document.documentElement.lang=api.getLanguage();window.NexaurenBusinessI18n={setLanguage:api.setLanguage,translate:api.apply};};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.addEventListener('nexauren:language',e=>{if(e.detail?.language)document.documentElement.lang=e.detail.language;});
})();
