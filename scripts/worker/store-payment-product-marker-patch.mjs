import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(workerUrl, 'utf8');
const oldCall = "provider.createCheckout({request:r,env:e,user:u,reference,product,productType:'store_purchase'})";
const newCall = "provider.createCheckout({request:r,env:e,user:u,reference,product:{...product,__store_purchase:true},productType:'store_purchase'})";
if (!source.includes(newCall)) {
  if (!source.includes(oldCall)) throw new Error('[store-payment-product-marker-patch] Store checkout provider call not found.');
  source = source.replace(oldCall, newCall);
}
await writeFile(workerUrl, source, 'utf8');
console.log('[store-payment-product-marker-patch] Store product marker applied.');
