import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
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
