import fs from 'node:fs';
import path from 'node:path';

const app = path.resolve('frontend/js/app.js');
if (fs.existsSync(app)) {
  let s = fs.readFileSync(app, 'utf8');
  s = s.replaceAll('ensureLevels();', '');
  s = s.replace(/const recordHistory=.*?;const recordActivity=/, 'const recordHistory=()=>{};const recordActivity=');
  s = s.replace(/const recordActivity=.*?;const recordUsage=/, 'const recordActivity=()=>{};const recordUsage=');
  s = s.replace(/const xpFor=.*?;const trackTool=/, 'const trackTool=');
  s = s.replace(/recordHistory\(tool\);recordUsage\(tool\)/g, '');
  s = s.replace(/recordActivity\(type,tool,extra\);/g, '');
  s = s.replace(/const xp=xpFor\(type\),id=tool\?\.id\|\|extra\.toolId\|\|location\.pathname;if\(xp&&window\.NexaurenLevels\)window\.NexaurenLevels\.award\(xp,type,id\+':\'+type\)/g, '');
  s = s.replace(/window\.dispatchEvent\(new CustomEvent\('nexauren:activity',[\s\S]*?\}\)\);/g, '');
  s = s.replaceAll('<a href="/history/">History</a>', '');
  s = s.replaceAll('<a href="/activity/">Activity</a>', '');
  s = s.replaceAll('<a href="/levels.html">Levels</a>', '');

  // Cache the tools registry in-session for 10 minutes instead of forcing a Worker request on every use.
  s = s.replace(/const toolData=\(\)=>fetch\('\/data\/tools\.json',\{cache:'no-store'\}\)\.then\(r=>r\.ok\?r\.json\(\):Promise\.reject\(new Error\('Experience registry unavailable'\)\)\)\.then\(d=>Array\.isArray\(d\.tools\)\?d\.tools:\[\]\);/, "const toolData=()=>{const k='nexauren_tools_registry_v1';try{const c=JSON.parse(sessionStorage.getItem(k)||'null');if(c&&Date.now()-c.time<600000&&Array.isArray(c.data))return Promise.resolve(c.data)}catch{}return fetch('/data/tools.json',{cache:'default'}).then(r=>r.ok?r.json():Promise.reject(new Error('Experience registry unavailable'))).then(d=>{const a=Array.isArray(d.tools)?d.tools:[];try{sessionStorage.setItem(k,JSON.stringify({time:Date.now(),data:a}))}catch{}return a})};");

  // Use one short-lived auth result for the shared header instead of another uncached auth request.
  s = s.replace(/const updateAuthLinks=async\(\)=>\{try\{const r=await fetch\('\/api\/auth\/me',\{credentials:'include',cache:'no-store'\}\),d=await r\.json\(\)\.catch\(\(\)=>\(\{\}\)\);/, "const updateAuthLinks=async()=>{try{const k='nexauren_auth_state_v1';let d=null;try{const c=JSON.parse(sessionStorage.getItem(k)||'null');if(c&&Date.now()-c.time<600000)d=c.data}catch{}if(!d){const r=await fetch('/api/account/me',{credentials:'include',cache:'default'});d=await r.json().catch(()=>({}));try{sessionStorage.setItem(k,JSON.stringify({time:Date.now(),data:d}))}catch{}};");

  // Replace the animated mascot process overlay with a minimal CSS spinner.
  s = s.replace(/let overlay=\$\('\[data-process-overlay\]'\);if\(!overlay\)\{document\.body\.insertAdjacentHTML\('beforeend',[\s\S]*?window\.Nexauren\.showPageProcess=showProcess;/, "let overlay=$('[data-process-overlay]');if(!overlay){document.body.insertAdjacentHTML('beforeend','<div class=\"process-overlay\" data-process-overlay aria-hidden=\"true\"><div class=\"process-spinner\" role=\"status\" aria-label=\"Processing\"></div></div>');overlay=$('[data-process-overlay]')}let timer;const showProcess=(duration=2400)=>{if(!overlay)return;overlay.classList.add('is-visible');overlay.setAttribute('aria-hidden','false');clearTimeout(timer);timer=setTimeout(()=>{overlay.classList.remove('is-visible');overlay.setAttribute('aria-hidden','true')},Math.max(500,duration))};window.Nexauren.showPageProcess=showProcess;");
  s = s.replace(/document\.addEventListener\('submit',event=>\{if\(event\.defaultPrevented\)return;showProcess\(2400\)\}\);/, "document.addEventListener('submit',event=>{if(event.defaultPrevented)return;showProcess(2400)});");
  s = s.replace(/\}\)\(\);$/, "const spinnerStyle=document.createElement('style');spinnerStyle.textContent='.process-overlay{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;background:rgba(0,0,0,.08);opacity:0;pointer-events:none;transition:opacity .15s}.process-overlay.is-visible{opacity:1;pointer-events:auto}.process-spinner{width:38px;height:38px;border:4px solid currentColor;border-right-color:transparent;border-radius:50%;animation:nexauren-spin .7s linear infinite}@keyframes nexauren-spin{to{transform:rotate(360deg)}}';document.head.appendChild(spinnerStyle)})();");
  fs.writeFileSync(app, s);
}

// Prevent the legacy activity/levels/history clients from being loaded or used if referenced by an older page.
const frontend = path.resolve('frontend');
function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(html|js)$/i.test(entry.name)) out.push(full);
  }
  return out;
}
for (const file of walk(frontend)) {
  if (file === app) continue;
  let s = fs.readFileSync(file, 'utf8');
  const before = s;
  s = s.replaceAll('ensureLevels();', '');
  s = s.replaceAll("window.NexaurenLevels.award", "void 0 /* levels disabled */");
  if (s !== before) fs.writeFileSync(file, s);
}
console.log('Lightweight mode: activity, history, XP/levels and mascot UI disabled; shared requests cached.');
