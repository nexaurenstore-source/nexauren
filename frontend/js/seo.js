(() => {
  'use strict';
  const BASE='https://nexaurenstory.com';
  const SOCIAL_IMAGE=BASE+'/assets/nexauren-social-preview.png';
  const clean=s=>String(s||'').replace(/<[^>]*>/g,'').trim();
  const meta=(name,content,attr='name')=>{if(!content)return;let el=document.head.querySelector(`meta[${attr}="${name}"]`);if(!el){el=document.createElement('meta');el.setAttribute(attr,name);document.head.appendChild(el)}el.setAttribute('content',content)};
  const link=(rel,href)=>{let el=document.head.querySelector(`link[rel="${rel}"]`);if(!el){el=document.createElement('link');el.rel=rel;document.head.appendChild(el)}el.href=href};
  const addJsonLd=data=>{const s=document.createElement('script');s.type='application/ld+json';s.textContent=JSON.stringify(data);document.head.appendChild(s)};
  const slug=location.pathname.split('/').filter(Boolean).pop()||'';
  const run=async()=>{try{const r=await fetch('/data/tools.json',{cache:'no-store'});if(!r.ok)return;const d=await r.json();const tools=Array.isArray(d.tools)?d.tools:[];const tool=tools.find(x=>String(x.url||'').replace(/\/$/,'').endsWith('/'+slug));if(!tool)return;
    const name=clean(tool.name),description=clean(tool.description),url=BASE+String(tool.url||location.pathname);document.title=`${name} — ${description.split('. ')[0]||'Online Tool'} | Nexauren`;meta('description',description);meta('keywords',[name,tool.category,...(tool.tags||[])].join(', '));link('canonical',url);meta('og:title',`${name} — Nexauren`,'property');meta('og:description',description,'property');meta('og:url',url,'property');meta('og:type','website','property');meta('og:image',SOCIAL_IMAGE,'property');meta('og:image:secure_url',SOCIAL_IMAGE,'property');meta('og:image:type','image/png','property');meta('og:image:width','1730','property');meta('og:image:height','909','property');meta('og:image:alt',name,'property');meta('twitter:card','summary_large_image');meta('twitter:image',SOCIAL_IMAGE);meta('twitter:image:alt',name);
    addJsonLd({'@context':'https://schema.org','@type':'SoftwareApplication','name':name,'description':description,'url':url,'applicationCategory':'UtilitiesApplication','operatingSystem':'Web','isAccessibleForFree':true,'publisher':{'@type':'Organization','name':'Nexauren','url':BASE}});
    addJsonLd({'@context':'https://schema.org','@type':'WebPage','name':name,'description':description,'url':url,'inLanguage':document.documentElement.lang||'en'});
  }catch(e){console.warn('Nexauren SEO metadata unavailable',e)}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
