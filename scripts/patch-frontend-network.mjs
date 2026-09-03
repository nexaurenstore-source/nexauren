import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('frontend');
const replacements = [
  ['/api/auth/me', '/api/account/me'],
  ['/api/auth/logout', '/api/account/logout'],
  [
    "const auth=()=>fetch('/api/account/me',{credentials:'include',cache:'no-store'}).then(r=>r.json()).catch(()=>({}));",
    "let authCache=null,authCacheAt=0,authInFlight=null;const auth=async()=>{const now=Date.now();if(authCache&&now-authCacheAt<30000)return authCache;if(authInFlight)return authInFlight;authInFlight=fetch('/api/account/me',{credentials:'include',cache:'no-store'}).then(r=>r.json()).catch(()=>({})).then(d=>{authCache=d;authCacheAt=Date.now();return d}).finally(()=>{authInFlight=null});return authInFlight};"
  ],
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.js$/i.test(entry.name)) out.push(full);
  }
  return out;
}

let changed = 0;
for (const file of walk(root)) {
  const before = fs.readFileSync(file, 'utf8');
  let source = before;
  for (const [from, to] of replacements) source = source.replaceAll(from, to);
  if (source !== before) {
    fs.writeFileSync(file, source);
    changed += 1;
  }
}

console.log(`Frontend network optimization: ${changed} file(s) updated.`);
