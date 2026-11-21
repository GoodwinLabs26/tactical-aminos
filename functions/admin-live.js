import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
const options={region:'us-central1',maxInstances:3,minInstances:0,timeoutSeconds:30,memory:'256MiB',retry:true};
function changed(collection){return onDocumentWritten({...options,document:collection+'/{id}'},async()=>{
  await getFirestore().doc('adminLive/dashboard').set({changedAt:FieldValue.serverTimestamp()});
});}
export const liveOrders=changed('orders');
export const liveProducts=changed('products');
export const liveCustomers=changed('users');
export const liveCodes=changed('discountCodes');
export const liveAffiliates=changed('affiliates');
export const liveNotices=changed('notifications');
