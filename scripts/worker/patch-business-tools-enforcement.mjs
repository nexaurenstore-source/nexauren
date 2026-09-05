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
 // Support both the current module-style Cloudflare Worker handler and the
 // older standalone function form. The build pipeline uses `async fetch(...)`.
 const m=worker.match(/async\s+fetch\s*\(\s*r\s*,\s*e\s*\)\s*\{|async\s+function\s+fetch\s*\(\s*r\s*,\s*e\s*\)\s*\{/);
 if(!m) throw new Error('fetch handler not found');
 worker=worker.slice(0,m.index+m[0].length)+'\n    '+routes+worker.slice(m.index+m[0].length);
}
if((worker.match(/const BUSINESS_TOOLS_FREE_DAILY/g)||[]).length!==1) throw new Error('business tools module injected incorrectly');
if((worker.match(/__businessToolsUrl/g)||[]).length!==3) throw new Error('business tools routes injected incorrectly');
// The generated Worker is an ES module and therefore contains `export default`.
// vm.Script parses classic scripts, so normalize only that module export for the
// syntax-only validation instead of executing or changing the deploy artifact.
const syntaxSource=worker.replace(/\bexport\s+default\s+/, 'const __worker_default__ = ');
new vm.Script(syntaxSource,{filename:workerPath});
fs.writeFileSync(workerPath,worker);
console.log('Business tools enforcement patched successfully.');
