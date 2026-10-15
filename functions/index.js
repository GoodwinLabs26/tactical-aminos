import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { createOrderService } from './order-service.js';
import { CheckoutError } from './lib/checkout-core.js';
import draftProducts from './lib/catalog-draft.json' with { type: 'json' };

initializeApp();
const db = getFirestore();
const read = async path => { const snapshot = await db.doc(path).get(); return snapshot.exists ? { ...snapshot.data(), ...(path.startsWith('products/') ? { id: snapshot.id } : {}) } : null; };
const store = {
  get: read,
  transaction: callback => db.runTransaction(transaction => callback({
    get: async path => { const snapshot = await transaction.get(db.doc(path)); return snapshot.exists ? { ...snapshot.data(), ...(path.startsWith('products/') ? { id: snapshot.id } : {}) } : null; },
    set: (path, data) => transaction.set(db.doc(path), data)
  }))
};
const service = createOrderService({ store, timestamp: () => FieldValue.serverTimestamp() });
const options = { region: 'us-central1', maxInstances: 3, minInstances: 0, timeoutSeconds: 30, memory: '256MiB' };
function translated(error) {
  if (error instanceof CheckoutError) return new HttpsError(error.code, error.message);
  console.error('Checkout operation failed', error);
  return new HttpsError('internal', 'Unable to complete checkout. Please try again.');
}
export const quoteOrder = onCall(options, async request => {
  try { return await service.quote(request.auth?.uid, request.data || {}); }
  catch (error) { throw translated(error); }
});
export const submitOrder = onCall(options, async request => {
  try { return await service.submit(request.auth?.uid, request.auth?.token.email, request.data || {}); }
  catch (error) { throw translated(error); }
});
export const memberCatalog = onCall(options, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in to view the catalog.');
  const profile = await read(`users/${request.auth.uid}`);
  if (!profile?.ageConfirmed || !profile?.researchOnlyAccepted) throw new HttpsError('permission-denied', 'Confirm member access first.');
  const snapshot = await db.collection('products').where('published','==',true).get();
  return { products: snapshot.docs.map(document => {
    const product = document.data();
    return { id: document.id, name: product.name, strength: product.strength, category: product.category, compoundKey: product.compoundKey, bulkEligible: product.bulkEligible, published: true, priceCents: product.priceCents, stockQuantity: Number.isInteger(product.stockQuantity) ? product.stockQuantity : null };
  }) };
});
export const initializeDraftCatalog = onCall(options, async request => {
  const admin = await read('config/admin');
  if (!request.auth || admin?.uid !== request.auth.uid) throw new HttpsError('permission-denied', 'Only the configured store admin can initialize the catalog.');
  const existing = await db.collection('products').get();
  const ids = new Set(existing.docs.map(document => document.id));
  const settings = await read('config/store');
  const batch = db.batch();
  let created=0;
  for (const product of draftProducts) {
    if(ids.has(product.id))continue;
    const { id, price, ...record } = product;
    batch.create(db.doc(`products/${id}`), record);
    created++;
  }
  if(!settings)batch.create(db.doc('config/store'),{checkoutEnabled:false,venmoHandle:'@Mark-Williams-1389',paypalHandle:''});
  if(created || !settings)await batch.commit();
  return { created, message:'Draft catalog prepared with zero stock. Ordering remains off until actual inventory and store settings are ready.' };
});

// All admin operations verify the one configured admin on the server.
export const adminCommand = onCall(options, async request => {
  try {
    const { createAdminService } = await import('./admin-service.js');
    const adminStore = { ...store, list: async (collectionName, settings={}) => {
      let query=db.collection(collectionName).orderBy(settings.sort || '__name__',settings.sort?'desc':'asc');
      if(settings.afterId){const cursor=await db.doc(`${collectionName}/${settings.afterId}`).get();if(!cursor.exists)throw new CheckoutError('failed-precondition','This page changed. Refresh the dashboard.');query=query.startAfter(cursor);}
      const snapshot=await query.limit(51).get();
      const documents=snapshot.docs.slice(0,50);
      return {items:documents.map(document=>({ ...document.data(),id:document.id })),hasMore:snapshot.size>50,nextId:documents.at(-1)?.id||null};
    }};
    const adminService=createAdminService({store:adminStore,timestamp:()=>FieldValue.serverTimestamp()});
    const actions=['dashboard','page','inventory','saveCode','paid','cancel','ship'];
    if(!actions.includes(request.data?.action))throw new CheckoutError('invalid-argument','Choose a valid admin action.');
    const result=await adminService[request.data.action](request.auth?.uid,request.data?.input||{});
    // Callable payloads use ISO dates rather than SDK-specific Timestamp objects.
    const clean=value=>value?.toDate instanceof Function?value.toDate().toISOString():Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([key,item])=>[key,clean(item)])):value;
    return clean(result);
  } catch(error) {throw translated(error);}
});

// Report pages use their own query; dashboard pagination never limits an export.
export const reportOrders = onCall(options, async request => {
  try {
    const {createReportsService}=await import('./reports-service.js');
    const reportStore={get:read,reportPage:async ({startMs,endMs,afterId})=>{
      let query=db.collection('orders').where('paymentStatus','==','paid').where('paidAt','>=',Timestamp.fromMillis(startMs)).where('paidAt','<',Timestamp.fromMillis(endMs)).orderBy('paidAt','asc');
      if(afterId){
        const cursor=await db.doc(`orders/${afterId}`).get();const paidMs=cursor.data()?.paidAt?.toMillis?.();
        if(!cursor.exists||cursor.data().paymentStatus!=='paid'||!Number.isFinite(paidMs)||paidMs<startMs||paidMs>=endMs)throw new CheckoutError('failed-precondition','Report records changed. Generate the report again.');
        query=query.startAfter(cursor);
      }
      const snapshot=await query.limit(201).get();const documents=snapshot.docs.slice(0,200);
      return {items:documents.map(document=>{
        const order=document.data();
        return {id:document.id,orderNumber:order.orderNumber,paymentStatus:order.paymentStatus,paidAt:order.paidAt.toDate().toISOString(),paymentMethod:order.paymentMethod,subtotalCents:order.subtotalCents,discountCents:order.discountCents,shippingCents:order.shippingCents,totalCents:order.totalCents,lines:(order.lines||[]).map(line=>({productId:line.productId,name:line.name,strength:line.strength,quantity:line.quantity,unitPriceCents:line.unitPriceCents??line.priceCents,...(line.lineTotalCents!==undefined?{lineTotalCents:line.lineTotalCents}:{})})),promoSnapshot:order.promoSnapshot?{code:order.promoSnapshot.code}:null,...Object.fromEntries(['salesTaxCents','taxCents','refundedCents','refundCents'].filter(key=>order[key]!==undefined).map(key=>[key,order[key]]))};
      }),hasMore:snapshot.size>200,nextId:documents.at(-1)?.id||null};
    }};
    return await createReportsService({store:reportStore}).page(request.auth?.uid,request.data||{});
  }catch(error){throw translated(error);}
});
