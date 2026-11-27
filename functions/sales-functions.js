import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {createSalesService} from './sales-service.js';
import {activeSale} from './lib/sales-core.js';
import {CheckoutError} from './lib/checkout-core.js';
const options={region:'us-central1',maxInstances:3,minInstances:0,timeoutSeconds:30,memory:'256MiB'};
function adapter(db){return {
  get:async path=>{const doc=await db.doc(path).get();return doc.exists?doc.data():null;},
  transaction:fn=>db.runTransaction(tx=>fn({get:async path=>{const doc=await tx.get(db.doc(path));return doc.exists?doc.data():null;},set:(path,value)=>tx.set(db.doc(path),value)}))
};}
export const manageSales=onCall(options,async request=>{
  const db=getFirestore(),service=createSalesService({store:adapter(db),timestamp:()=>FieldValue.serverTimestamp()});
  try{
    await service.authorize(adapter(db),request.auth?.uid);
    if(request.data?.action==='list'){
      const snap=await db.collection('products').limit(1001).get();
      if(snap.size>1000)throw new CheckoutError('failed-precondition','More than 1,000 products. Contact support to enable sale pagination.');
      return {products:snap.docs.map(doc=>{const p=doc.data();return {id:doc.id,name:p.name,strength:p.strength,published:p.published===true,priceCents:p.priceCents??null,stockQuantity:p.stockQuantity??null,sale:p.sale||null,saleRevision:p.saleRevision||0};}),serverNowMs:Date.now()};
    }
    return await service.save(request.auth?.uid,request.data||{});
  }catch(e){if(e instanceof CheckoutError)throw new HttpsError(e.code,e.message);console.error('Sale operation failed.');throw new HttpsError('internal','Sales could not be updated. Please try again.');}
});
// Only minimal public announcements; no customer, stock, admin, or draft data.
export const currentSales=onCall(options,async()=>{
  const snap=await getFirestore().collection('products').where('published','==',true).get(),now=Date.now();
  return {serverNowMs:now,sales:snap.docs.flatMap(doc=>{
    const p=doc.data(),sale=activeSale(p,now);
    if(!sale||sale.showPopup!==true||!(p.stockQuantity>0))return [];
    return [{productId:doc.id,name:p.name,strength:p.strength,regularPriceCents:p.priceCents,priceCents:sale.priceCents,title:sale.title,announcement:sale.announcement,endsAtMs:sale.endsAtMs,allowAdditionalDiscounts:sale.allowAdditionalDiscounts}];
  })};
});
