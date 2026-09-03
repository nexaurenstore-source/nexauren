import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(workerUrl, 'utf8');

const oldLine = "const returnUrl = new URL('/payment/success', origin); returnUrl.searchParams.set('reference', reference);";
const newLine = "const returnUrl = new URL('/payment/success', origin); returnUrl.searchParams.set('reference', reference); if (product?.__store_purchase) returnUrl.searchParams.set('type', 'store_purchase');";
if (!source.includes(newLine)) {
  if (!source.includes(oldLine)) throw new Error('[store-payment-return-patch] PayPal return URL marker not found.');
  source = source.replace(oldLine, newLine);
}

await writeFile(workerUrl, source, 'utf8');
console.log('[store-payment-return-patch] Store payment returns marked correctly.');
