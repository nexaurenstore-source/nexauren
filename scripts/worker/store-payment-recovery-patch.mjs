import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(workerUrl, 'utf8');
const oldBlock = "if(payment.status==='successful'){\n    const order=e.MARKETPLACE_DB?await e.MARKETPLACE_DB.prepare('SELECT id,status FROM store_orders WHERE reference=?1 LIMIT 1').bind(reference).first():null;\n    return json({success:true,payment,order:order||null},200,cors(r));\n  }";
const newBlock = "if(payment.status==='successful'){\n    let order=e.MARKETPLACE_DB?await e.MARKETPLACE_DB.prepare('SELECT id,status FROM store_orders WHERE reference=?1 LIMIT 1').bind(reference).first():null;\n    if(!order&&e.MARKETPLACE_DB){\n      let metadata={};try{metadata=JSON.parse(payment.metadata||'{}')}catch{}\n      const productId=clean(metadata.product_id);\n      const product=productId?await e.MARKETPLACE_DB.prepare('SELECT id,name,price_minor,currency FROM store_products WHERE id=?1 LIMIT 1').bind(productId).first():null;\n      if(product) order=await __storeCreateOrderRecord(e,{userId:u.id,paymentId:payment.id,reference,productId:product.id,productName:product.name,amountMinor:Number(payment.amount_minor),currency:String(payment.currency).toUpperCase()});\n    }\n    return json({success:true,payment,order:order||null},200,cors(r));\n  }";
if(!source.includes(newBlock)){
  if(!source.includes(oldBlock)) throw new Error('[store-payment-recovery-patch] Successful-payment block not found.');
  source=source.replace(oldBlock,newBlock);
}
await writeFile(workerUrl,source,'utf8');
console.log('[store-payment-recovery-patch] Store payment fulfillment is retry-safe.');
