import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { validateCoa, randomUUID } from './coa-service.js';
const options={region:'us-central1',maxInstances:3,minInstances:0,timeoutSeconds:60,memory:'256MiB'};
const validId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id);
async function requireAdmin(db,uid) {
  if(!uid)throw new HttpsError('unauthenticated','Sign in first.');
  const admin=(await db.doc('config/admin').get()).data();
  if(admin?.uid!==uid&&!(Array.isArray(admin?.additionalUids)&&admin.additionalUids.includes(uid)))throw new HttpsError('permission-denied','Admin access required.');
}
export const manageProductCoa=onCall(options,async request=>{
  const db=getFirestore(),uid=request.auth?.uid;
  await requireAdmin(db,uid);
  const input=request.data||{};
  if(!validId(input.productId))throw new HttpsError('invalid-argument','Choose a valid product.');
  const ref=db.doc('products/'+input.productId);
  const snapshot=await ref.get();
  if(!snapshot.exists)throw new HttpsError('not-found','Product not found.');
  const existing=snapshot.data().coa;
  if((input.expectedVersion||null)!==(existing?.version||null))throw new HttpsError('failed-precondition','COA changed. Refresh and try again.');
  const batch=db.batch();
  let metadata=null;
  if(input.action==='upload'){
    let validated;
    try{validated=validateCoa(input);}catch(error){throw new HttpsError('invalid-argument',error.message);}
    const {title,lot,bytes,mimeType,sha256}=validated,version=randomUUID();
    const encoded=bytes.toString('base64'),chunks=encoded.match(/.{1,262144}/g);
    for(let i=0;i<chunks.length;i++)batch.set(db.doc('productCoaFiles/'+version+'-'+i),{data:chunks[i]});
    metadata={title,lot,mimeType,version,chunks:chunks.length,sizeBytes:bytes.length,sha256,uploadedAt:new Date().toISOString()};
  }else if(input.action!=='remove')throw new HttpsError('invalid-argument','Choose upload or remove.');
  // Atomic revision check protects against concurrent replacements.
  batch.update(ref,{coa:metadata,coaUpdatedBy:uid,coaUpdatedAt:FieldValue.serverTimestamp()},{lastUpdateTime:snapshot.updateTime});
  if(existing?.version&&Number.isInteger(existing.chunks))for(let i=0;i<existing.chunks;i++)batch.delete(db.doc('productCoaFiles/'+existing.version+'-'+i));
  try{await batch.commit();}catch{throw new HttpsError('aborted','COA changed or could not be saved. Refresh and retry.');}
  return {message:metadata?'COA uploaded.':'COA removed.',coa:metadata};
});
export const getProductCoa=onCall(options,async request=>{
  const db=getFirestore(),uid=request.auth?.uid;
  if(!uid)throw new HttpsError('unauthenticated','Sign in to view a COA.');
  const member=(await db.doc('users/'+uid).get()).data();
  if(!member?.ageConfirmed||!member?.researchOnlyAccepted)throw new HttpsError('permission-denied','Confirm member access first.');
  const id=request.data?.productId;
  if(!validId(id))throw new HttpsError('invalid-argument','Choose a valid product.');
  const product=(await db.doc('products/'+id).get()).data();
  if(!product?.published)throw new HttpsError('not-found','Product unavailable.');
  const coa=product.coa;
  if(!coa)return {coa:null};
  const documents=await db.getAll(...Array.from({length:coa.chunks},(_,i)=>db.doc('productCoaFiles/'+coa.version+'-'+i)));
  if(documents.some(doc=>!doc.exists))throw new HttpsError('unavailable','COA unavailable. Please contact us.');
  return {coa:{title:coa.title,lot:coa.lot,sizeBytes:coa.sizeBytes,mimeType:coa.mimeType||'application/pdf',base64:documents.map(doc=>doc.data().data).join('')}};
});
export const setLaunchInventory=onCall(options,async request=>{
  const db=getFirestore(),uid=request.auth?.uid;await requireAdmin(db,uid);
  if(request.data?.confirmation!=='SET ALL STOCK TO 100')throw new HttpsError('invalid-argument','Confirm the inventory change.');
  const count=await db.runTransaction(async tx=>{
    const settings=await tx.get(db.doc('config/store'));
    if(settings.data()?.checkoutEnabled!==false)throw new HttpsError('failed-precondition','Turn ordering off before setting launch inventory.');
    const products=await tx.get(db.collection('products'));
    if(products.size>450)throw new HttpsError('failed-precondition','Too many products for this bulk action.');
    for(const product of products.docs)tx.update(product.ref,{stockQuantity:100,lowStockThreshold:10,lowStockActive:false,revision:(product.data().revision||0)+1,updatedAt:FieldValue.serverTimestamp(),updatedBy:uid});
    return products.size;
  });
  return {message:count+' product stock counts set to 100; alerts set to 10. Checkout remains off.'};
});
