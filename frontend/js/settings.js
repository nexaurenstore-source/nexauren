(() => {
  'use strict';
  const $=s=>document.querySelector(s);
  const theme=$('#theme'),language=$('#language'),motion=$('#reduced-motion'),clear=$('#clear-data'),save=$('#save-settings'),message=$('#settings-message');
  if(!theme&&!language)return;
  const get=(key,fallback)=>{try{const v=localStorage.getItem(key);return v===null?fallback:v}catch{return fallback}};
  const set=(key,value)=>{try{localStorage.setItem(key,value)}catch{}};
  const languages=['en','zh','hi','es','fr','pt'];
  const applyTheme=value=>{document.documentElement.dataset.theme=value;set('nexauren_theme',value)};
  const applyMotion=value=>{document.documentElement.dataset.reduceMotion=value?'true':'false';set('nexauren_reduce_motion',value?'true':'false');document.documentElement.classList.toggle('reduce-motion',!!value)};
  const savedLanguage=get('nexauren_language','en');
  const savedTheme=get('nexauren_theme','system');
  const savedMotion=get('nexauren_reduce_motion','false')==='true';
  if(language)language.value=languages.includes(savedLanguage)?savedLanguage:'en';
  if(theme)theme.value=['system','light','dark'].includes(savedTheme)?savedTheme:'system';
  if(motion)motion.checked=savedMotion;
  applyTheme(theme?.value||'system');applyMotion(!!motion?.checked);
  function show(text,type='success'){if(!message)return;message.hidden=false;message.className=`alert alert-${type}`;message.textContent=text;clearTimeout(show.timer);show.timer=setTimeout(()=>{message.hidden=true},2500)}
  save?.addEventListener('click',()=>{
    const nextLanguage=language?.value||'en';
    const nextTheme=theme?.value||'system';
    const nextMotion=!!motion?.checked;
    set('nexauren_language',nextLanguage);set('nexauren_theme',nextTheme);set('nexauren_reduce_motion',nextMotion?'true':'false');
    applyTheme(nextTheme);applyMotion(nextMotion);
    document.documentElement.lang=nextLanguage;
    if(window.Nexauren?.i18n?.setLanguage)window.Nexauren.i18n.setLanguage(nextLanguage);
    show(nextLanguage==='pt'?'Definições guardadas. A atualizar…':'Settings saved. Refreshing…');
    setTimeout(()=>window.location.reload(),600);
  });
  clear?.addEventListener('click',()=>{if(!confirm('Clear Nexauren history, usage and activity stored on this device?'))return;['nexauren_history','nexauren_usage','nexauren_activity'].forEach(k=>{try{localStorage.removeItem(k)}catch{}});show('Local history, usage and activity were cleared.')});
})();
