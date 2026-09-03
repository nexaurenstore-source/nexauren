import { readFile, writeFile } from 'node:fs/promises';

const workerUrl = new URL('../../.worker-build/worker.js', import.meta.url);
let source = await readFile(workerUrl, 'utf8');

const oldCheckoutGuard = "if (productType !== 'credit_purchase') throw new Error('Unsupported PayPal checkout type.');";
const newCheckoutGuard = "if (!['credit_purchase','store_purchase'].includes(productType)) throw new Error('Unsupported PayPal checkout type.');";
if (!source.includes(newCheckoutGuard)) {
  if (!source.includes(oldCheckoutGuard)) throw new Error('[store-payment-patch] PayPal checkout guard not found.');
  source = source.replace(oldCheckoutGuard, newCheckoutGuard);
}

if (!source.includes('async function __handleStorePaymentRoute')) {
  const module = `
async function __storeCreateOrderRecord(e, { userId, paymentId, reference, productId, productName, amountMinor, currency }) {
  const now = Math.floor(Date.now() / 1000);
  const existing = await e.MARKETPLACE_DB.prepare('SELECT id,status FROM store_orders WHERE reference=?1 LIMIT 1').bind(reference).first();
  if (existing) return existing;
  const orderId = uuid();
  await e.MARKETPLACE_DB.batch([
    e.MARKETPLACE_DB.prepare('INSERT INTO store_orders(id,user_id,payment_id,reference,status,amount_minor,currency,created_at,updated_at) VALUES(?1,?2,?3,?4,\'paid\',?5,?6,?7,?7)').bind(orderId,userId,paymentId,reference,amountMinor,currency,now),
    e.MARKETPLACE_DB.prepare('INSERT INTO store_order_items(id,order_id,product_id,product_name,quantity,unit_price_minor,currency,created_at) VALUES(?1,?2,?3,?4,1,?5,?6,?7)').bind(uuid(),orderId,productId,productName,amountMinor,currency,now),
    e.MARKETPLACE_DB.prepare('INSERT OR IGNORE INTO store_entitlements(id,user_id,product_id,order_id,status,granted_at,revoked_at) VALUES(?1,?2,?3,?4,\'active\',?5,NULL)').bind(uuid(),userId,productId,orderId,now),
  ]);
  return { id: orderId, status: 'paid' };
}

async function __storeCheckout(r,e) {
  const u=await currentUser(r,e);
  if(!u) return json({error:'Authentication required.'},401,cors(r));
  if(!e.MARKETPLACE_DB) return json({error:'Marketplace database is not configured.'},503,cors(r));
  const d=await body(r);
  const productId=clean(d?.product_id).slice(0,160);
  if(!productId) return json({error:'product_id is required.'},400,cors(r));
  const product=await e.MARKETPLACE_DB.prepare('SELECT id,name,price_minor,currency,enabled FROM store_products WHERE id=?1 AND enabled=1 LIMIT 1').bind(productId).first();
  if(!product) return json({error:'Product not found.'},404,cors(r));
  const amountMinor=Number(product.price_minor);
  const currency=String(product.currency||'').toUpperCase();
  if(!Number.isSafeInteger(amountMinor)||amountMinor<0||!/^[A-Z]{3}$/.test(currency)) return json({error:'Invalid product price.'},500,cors(r));
  const reference='store:'+uuid();
  const paymentId=uuid();
  const now=Math.floor(Date.now()/1000);
  if(amountMinor===0){
    await e.DB.prepare("INSERT INTO payments(id,user_id,provider,provider_transaction_id,reference,amount_minor,currency,status,type,metadata,created_at,updated_at) VALUES(?1,?2,'internal',?3,?4,0,?5,'successful','store_purchase',?6,?7,?7)").bind(paymentId,u.id,'free:'+reference,reference,currency,JSON.stringify({product_id:product.id,checkout_mode:'free'}),now).run();
    const order=await __storeCreateOrderRecord(e,{userId:u.id,paymentId,reference,productId:product.id,productName:product.name,amountMinor,currency});
    return json({success:true,free:true,reference,order},201,cors(r));
  }
  const providerName=clean(e.PAYMENT_PROVIDER).toLowerCase();
  const provider=billingProviderRegistry(e)[providerName];
  if(!provider) return json({error:'Payment provider not configured.',code:'provider_required',provider:providerName||null},503,cors(r));
  await e.DB.prepare("INSERT INTO payments(id,user_id,provider,provider_transaction_id,reference,amount_minor,currency,status,type,metadata,created_at,updated_at) VALUES(?1,?2,?3,NULL,?4,?5,?6,'pending','store_purchase',?7,?8,?8)").bind(paymentId,u.id,providerName,reference,amountMinor,currency,JSON.stringify({product_id:product.id,product_name:product.name}),now).run();
  try {
    const checkout=await provider.createCheckout({request:r,env:e,user:u,reference,product,productType:'store_purchase'});
    const providerTransactionId=clean(checkout?.transaction_id||checkout?.order_id);
    await e.DB.prepare('UPDATE payments SET provider_transaction_id=?1,metadata=?2,updated_at=?3 WHERE id=?4 AND status=\'pending\'').bind(providerTransactionId||null,JSON.stringify({product_id:product.id,product_name:product.name,checkout_mode:checkout?.mode||'payment'}),Math.floor(Date.now()/1000),paymentId).run();
    return json({success:true,provider:providerName,reference,checkout},201,cors(r));
  } catch(err) {
    await e.DB.prepare("UPDATE payments SET status='failed',metadata=?1,updated_at=?2 WHERE id=?3 AND status='pending'").bind(JSON.stringify({product_id:product.id,error:String(err).slice(0,500)}),Math.floor(Date.now()/1000),paymentId).run();
    console.error('Store checkout failed',String(err).slice(0,500));
    return json({error:'Unable to create checkout.'},502,cors(r));
  }
}

async function __storePaymentStatus(r,e) {
  const u=await currentUser(r,e);
  if(!u) return json({error:'Authentication required.'},401,cors(r));
  const reference=clean(new URL(r.url).searchParams.get('reference')).slice(0,180);
  if(!reference) return json({error:'reference is required.'},400,cors(r));
  const payment=await e.DB.prepare("SELECT id,user_id,provider,reference,amount_minor,currency,status,type,provider_transaction_id,metadata,created_at,updated_at FROM payments WHERE user_id=?1 AND reference=?2 AND type='store_purchase' LIMIT 1").bind(u.id,reference).first();
  if(!payment) return json({error:'Payment not found.'},404,cors(r));
  if(payment.status==='successful'){
    const order=e.MARKETPLACE_DB?await e.MARKETPLACE_DB.prepare('SELECT id,status FROM store_orders WHERE reference=?1 LIMIT 1').bind(reference).first():null;
    return json({success:true,payment,order:order||null},200,cors(r));
  }
  if(String(payment.provider).toLowerCase()!=='paypal') return json({error:'Payment provider mismatch.'},409,cors(r));
  const provider=billingProviderRegistry(e).paypal;
  if(!provider?.getOrder||!provider?.captureCheckout) return json({error:'PayPal provider is not configured.'},503,cors(r));
  const orderId=clean(payment.provider_transaction_id);
  if(!orderId) return json({error:'PayPal order is not associated with this payment.'},409,cors(r));
  try {
    const order=await provider.getOrder({env:e,orderId});
    const purchase=order?.purchase_units?.[0];
    const orderReference=clean(purchase?.custom_id||purchase?.invoice_id||purchase?.reference_id);
    const paypalAmount=String(purchase?.amount?.value||'');
    const paypalCurrency=String(purchase?.amount?.currency_code||'').toUpperCase();
    const expectedAmount=(Number(payment.amount_minor)/100).toFixed(2);
    if(orderReference!==reference||paypalAmount!==expectedAmount||paypalCurrency!==String(payment.currency).toUpperCase()) return json({error:'PayPal order verification mismatch.'},409,cors(r));
    if(String(order?.status||'').toUpperCase()!=='COMPLETED'){
      const captured=await provider.captureCheckout({env:e,orderId});
      if(String(captured?.status||'').toUpperCase()!=='COMPLETED') return json({error:'PayPal payment is not completed.'},409,cors(r));
    }
    const finalOrder=await provider.getOrder({env:e,orderId});
    const finalPurchase=finalOrder?.purchase_units?.[0];
    const finalAmount=String(finalPurchase?.amount?.value||'');
    const finalCurrency=String(finalPurchase?.amount?.currency_code||'').toUpperCase();
    if(String(finalOrder?.status||'').toUpperCase()!=='COMPLETED'||finalAmount!==expectedAmount||finalCurrency!==String(payment.currency).toUpperCase()) return json({error:'PayPal payment verification failed.'},409,cors(r));
    let metadata={};try{metadata=JSON.parse(payment.metadata||'{}')}catch{}
    const productId=clean(metadata.product_id);
    const product=await e.MARKETPLACE_DB.prepare('SELECT id,name,price_minor,currency FROM store_products WHERE id=?1 LIMIT 1').bind(productId).first();
    if(!product) return json({error:'Purchased product no longer exists.'},409,cors(r));
    if(Number(product.price_minor)!==Number(payment.amount_minor)||String(product.currency).toUpperCase()!==String(payment.currency).toUpperCase()) return json({error:'Product price changed after checkout.'},409,cors(r));
    await e.DB.prepare("UPDATE payments SET status='successful',provider_transaction_id=?1,metadata=?2,updated_at=?3 WHERE id=?4 AND status='pending'").bind(orderId,JSON.stringify({...metadata,paypal_order_id:orderId,paypal_status:'COMPLETED'}),Math.floor(Date.now()/1000),payment.id).run();
    const storeOrder=await __storeCreateOrderRecord(e,{userId:u.id,paymentId:payment.id,reference,productId:product.id,productName:product.name,amountMinor:Number(payment.amount_minor),currency:String(payment.currency).toUpperCase()});
    return json({success:true,payment:{...payment,status:'successful',provider_transaction_id:orderId},order:storeOrder},200,cors(r));
  } catch(err){console.error('Store payment verification failed',String(err).slice(0,500));return json({error:'Unable to verify or capture the Store payment.'},502,cors(r));}
}

async function __handleStorePaymentRoute(r,e){
  const u=new URL(r.url);
  if(u.pathname==='/api/store/checkout'&&r.method==='POST')return __storeCheckout(r,e);
  if(u.pathname==='/api/store/payment'&&r.method==='GET')return __storePaymentStatus(r,e);
  return null;
}
`;
  const marker = /async\s+fetch\(\s*r\s*,\s*e\s*\)\s*\{\s*/;
  if (!marker.test(source)) throw new Error('[store-payment-patch] Worker fetch marker not found.');
  source=source.replace(marker,'$&'+module+'\n',1);
  source=source.replace(marker,'$&\n    const __storePaymentResponse = await __handleStorePaymentRoute(r,e);\n    if (__storePaymentResponse) return __storePaymentResponse;\n',1);
}

await writeFile(workerUrl,source,'utf8');
console.log('[store-payment-patch] Marketplace one-time PayPal payments connected.');
