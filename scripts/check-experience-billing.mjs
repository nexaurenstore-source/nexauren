import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../frontend/studios/',import.meta.url));
const walk=async dir=>{const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else if(e.isFile()&&e.name==='index.html')out.push(p)}return out};
const files=await walk(root);
const helper=await readFile(new URL('../frontend/js/experience-billing.js',import.meta.url),'utf8');
if(!helper.includes("/api/billing/usage"))throw new Error('[experience-billing] Missing billing endpoint.');
if(!helper.includes('credentials:\'include\''))throw new Error('[experience-billing] Session credentials are not included.');
for(const path of files){const html=await readFile(path,'utf8');if(!html.includes('experience-billing.js'))throw new Error(`[experience-billing] Missing helper in ${path}`);}
console.log(`[experience-billing] ${files.length} experience pages are covered by the billing gate.`);
