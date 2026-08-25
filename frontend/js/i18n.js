(() => {
  'use strict';
  const SUPPORTED=['en','zh','hi','es','fr'];
  const KEY='nexauren_language';
  let catalog=null;
  const normalize=code=>{const c=String(code||'').toLowerCase().split('-')[0];return SUPPORTED.includes(c)?c:'en'};
  const getLanguage=()=>{try{return normalize(localStorage.getItem(KEY)||navigator.language)}catch{return 'en'}};
  const setLanguage=lang=>{const next=normalize(lang);try{localStorage.setItem(KEY,next)}catch{};document.documentElement.lang=next;window.dispatchEvent(new CustomEvent('nexauren:language',{detail:{language:next}}));return next};
  const t=(key,fallback=key)=>{const lang=getLanguage();return catalog?.strings?.[lang]?.[key]??catalog?.strings?.en?.[key]??fallback};
  const apply=()=>{$$('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(key)el.textContent=t(key,el.textContent)});$$('[data-i18n-placeholder]').forEach(el=>{el.placeholder=t(el.dataset.i18nPlaceholder,el.placeholder)});$$('[data-i18n-title]').forEach(el=>{el.title=t(el.dataset.i18nTitle,el.title)});document.documentElement.lang=getLanguage()};
  const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const load=()=>fetch('/data/i18n.json',{cache:'no-store'}).then(r=>r.ok?r.json():Promise.reject(new Error('Translation catalog unavailable'))).then(data=>{catalog=data;setLanguage(getLanguage());apply();return data}).catch(()=>{document.documentElement.lang=getLanguage()});
  window.Nexauren=window.Nexauren||{};window.Nexauren.i18n={languages:SUPPORTED,getLanguage,setLanguage,t,apply,load};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
