(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const theme=$('#theme'),language=$('#language'),motion=$('#reduced-motion'),clear=$('#clear-data'),message=$('#settings-message');
  if(!theme&&!language)return;
  const get=(key,fallback)=>{try{const v=localStorage.getItem(key);return v===null?fallback:v}catch{return fallback}};
  const set=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
  const applyTheme=value=>{document.documentElement.dataset.theme=value;set('nexauren_theme',value)};
  const applyMotion=value=>{document.documentElement.dataset.reduceMotion=value?'true':'false';set('nexauren_reduce_motion',value?'true':'false')};
  const savedLanguage=get('nexauren_language','en'); if(language)language.value=['en','zh','hi','es','fr'].includes(savedLanguage)?savedLanguage:'en';
  const savedTheme=get('nexauren_theme','system');if(theme)theme.value=['system','light','dark'].includes(savedTheme)?savedTheme:'system';
  if(motion)motion.checked=get('nexauren_reduce_motion','false')==='true';
  language?.addEventListener('change',()=>{if(window.Nexauren?.i18n?.setLanguage)window.Nexauren.i18n.setLanguage(language.value);else set('nexauren_language',language.value);show('Language saved. Reloading the page…','success');setTimeout(()=>location.reload(),300)});
  theme?.addEventListener('change',()=>{applyTheme(theme.value);show('Theme preference saved.','success')});
  motion?.addEventListener('change',()=>{applyMotion(motion.checked);show('Animation preference saved.','success')});
  clear?.addEventListener('click',()=>{if(!confirm('Clear Nexauren history, usage and activity stored on this device?'))return;['nexauren_history','nexauren_usage','nexauren_activity'].forEach(k=>{try{localStorage.removeItem(k)}catch{}});show('Local history, usage and activity were cleared.','success')});
  function show(text,type){if(!message)return;message.hidden=false;message.className=`alert alert-${type}`;message.textContent=text;clearTimeout(show.timer);show.timer=setTimeout(()=>{message.hidden=true},3000)}
  applyTheme(savedTheme);applyMotion(motion?.checked||false);
})();
