import fs from 'node:fs';
import vm from 'node:vm';
const workerPath='.worker-build/worker.js';
const modulePath='scripts/worker/business-tools-limits.js';
let worker=fs.readFileSync(workerPath,'utf8');
const module=fs.readFileSync(modulePath,'utf8');
if(!worker.includes('const BUSINESS_TOOLS_FREE_DAILY')) worker='\n'+module+'\n'+worker;
const marker='const __businessToolsUrl = new URL(r.url);';
if(!worker.includes(marker)){
 const routes=`const __businessToolsUrl = new URL(r.url);\n    if (__businessToolsUrl.pathname === '/api/business/tools/usage' && r.method === 'GET') return businessToolsUsage(r, e);\n    if (__businessToolsUrl.pathname === '/api/business/tools/consume' && r.method === 'POST') return businessToolsConsume(r, e);`;
 const m=worker.match(/async function fetch\s*\(r\s*,\s*e\)\s*\{/);
 if(!m) throw new Error('fetch handler not found');
 worker=worker.slice(0,m.index+m[0].length)+'\n    '+routes+worker.slice(m.index+m[0].length);
}
if((worker.match(/const BUSINESS_TOOLS_FREE_DAILY/g)||[]).length!==1) throw new Error('business tools module injected incorrectly');
if((worker.match(/__businessToolsUrl/g)||[]).length!==3) throw new Error('business tools routes injected incorrectly');
new vm.Script(worker,{filename:workerPath});
fs.writeFileSync(workerPath,worker);
console.log('Business tools enforcement patched successfully.');
