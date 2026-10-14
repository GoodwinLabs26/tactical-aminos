import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminService } from '../functions/admin-service.js';
function fixture(){
 const docs=new Map([
  ['config/admin',{uid:'admin'}],['users/member',{name:'Member',email:'member@example.com'}],['users/affiliate',{name:'Affiliate'}],
  ['products/bpc',{name:'BPC',strength:'10mg',stockQuantity:8,lowStockThreshold:3,revision:0}],
  ['discountCodes/REF10',{code:'REF10',percentOff:10,active:true,affiliateUid:'affiliate',reservedUses:1,usedCount:0,revision:0}],
  ['customerStats/member',{submittedOrderCount:1,firstOrderClaimed:true,firstOrderOrderId:'order1'}],
  ['orders/order1',{ownerUid:'member',orderNumber:'TA-ONE',lines:[{productId:'bpc',name:'BPC',quantity:5}],status:'pending',paymentStatus:'unpaid',fulfillmentStatus:'unfulfilled',inventoryDeducted:false,referralCounted:false,totalCents:16000,promoSnapshot:{code:'REF10',affiliateUid:'affiliate'}}]
 ]);
 const get=async key=>structuredClone(docs.get(key)||null);
 let serial=Promise.resolve();
 const store={get,list:async collection=>({items:[...docs].filter(([key])=>key.startsWith(collection+'/')).map(([key,data])=>({...data,id:key.split('/')[1]})),hasMore:false}),transaction:callback=>{
  const work=serial.then(async()=>{const writes=new Map();let wrote=false;const result=await callback({get:async key=>{assert(!wrote,'Firestore reads must precede writes');return get(key);},set:(key,data)=>{wrote=true;writes.set(key,structuredClone(data));}});for(const[key,data]of writes)docs.set(key,data);return result;});serial=work.catch(()=>{});return work;
 }};
 return {docs,service:createAdminService({store,timestamp:()=>12345})};
}
test('admin authorization protects reads and all mutations, including forged client roles',async()=>{
 const {docs,service}=fixture();
 await assert.rejects(service.dashboard(null),error=>error.code==='unauthenticated');
 await assert.rejects(service.dashboard('member'),error=>error.code==='permission-denied');
 for(const[action,input]of [['inventory',{productId:'bpc',quantity:999,threshold:3,expectedRevision:0}],['saveCode',{code:'FREE',percentOff:100,maxUses:0,active:true,expectedRevision:0}],['paid',{orderId:'order1'}],['cancel',{orderId:'order1'}],['ship',{orderId:'order1',tracking:'9400111899223856920000'}]])await assert.rejects(service[action]('member',{...input,admin:true}),error=>error.code==='permission-denied');
 assert.equal(docs.get('products/bpc').stockQuantity,8);assert.equal(docs.get('orders/order1').paymentStatus,'unpaid');
});
test('concurrent paid clicks deduct stock and count referral/code/customer exactly once',async()=>{
 const {docs,service}=fixture();const results=await Promise.all([service.paid('admin',{orderId:'order1'}),service.paid('admin',{orderId:'order1'})]);
 assert.equal(results.filter(item=>item.repeated).length,1);
 assert.equal(docs.get('products/bpc').stockQuantity,3);assert.equal(docs.get('discountCodes/REF10').usedCount,1);assert.equal(docs.get('discountCodes/REF10').reservedUses,0);
 assert.equal(docs.get('affiliates/affiliate').paidReferralCount,1);assert.equal(docs.get('customerStats/member').paidOrderCount,1);
 assert.equal(docs.get('orders/order1').paidAt,12345);assert.equal([...docs.keys()].filter(key=>key.startsWith('notifications/')).length,1);
});
test('insufficient stock rolls back payment, every product, promotions, and referrals',async()=>{
 const {docs,service}=fixture();docs.get('orders/order1').lines.push({productId:'kpv',name:'KPV',quantity:2});docs.set('products/kpv',{stockQuantity:1});
 await assert.rejects(service.paid('admin',{orderId:'order1'}),/Not enough stock/);
 assert.equal(docs.get('products/bpc').stockQuantity,8);assert.equal(docs.get('discountCodes/REF10').reservedUses,1);assert.equal(docs.has('affiliates/affiliate'),false);assert.equal(docs.get('orders/order1').paymentStatus,'unpaid');
});
test('competing unpaid orders cannot deduct more than available stock',async()=>{
 const {docs,service}=fixture();docs.set('orders/order2',{...structuredClone(docs.get('orders/order1')),promoSnapshot:null});
 const results=await Promise.allSettled([service.paid('admin',{orderId:'order1'}),service.paid('admin',{orderId:'order2'})]);
 assert.equal(results.filter(item=>item.status==='fulfilled').length,1);assert.equal(docs.get('products/bpc').stockQuantity,3);
});
test('inventory revisions prevent stale overwrites and low-stock alerts reset only after restock',async()=>{
 const {docs,service}=fixture();
 await service.inventory('admin',{productId:'bpc',quantity:3,threshold:3,expectedRevision:0});
 await assert.rejects(service.inventory('admin',{productId:'bpc',quantity:100,threshold:3,expectedRevision:0}),/Inventory changed/);
 await service.inventory('admin',{productId:'bpc',quantity:2,threshold:3,expectedRevision:1});
 assert.equal([...docs.keys()].filter(key=>key.startsWith('notifications/')).length,1);
 await service.inventory('admin',{productId:'bpc',quantity:8,threshold:3,expectedRevision:2});
 await service.inventory('admin',{productId:'bpc',quantity:0,threshold:3,expectedRevision:3});
 assert.equal([...docs.keys()].filter(key=>key.startsWith('notifications/')).length,2);
 await assert.rejects(service.inventory('admin',{productId:'bpc',quantity:-1,threshold:3,expectedRevision:4}));
});
test('unpaid cancellation releases reservations once and blocks paid transition',async()=>{
 const {docs,service}=fixture();await service.cancel('admin',{orderId:'order1'});await service.cancel('admin',{orderId:'order1'});
 assert.equal(docs.get('products/bpc').stockQuantity,8);assert.equal(docs.get('discountCodes/REF10').reservedUses,0);assert.equal(docs.get('customerStats/member').submittedOrderCount,0);assert.equal(docs.get('customerStats/member').firstOrderClaimed,false);
 await assert.rejects(service.paid('admin',{orderId:'order1'}),/Only an unpaid/);
});
test('codes link only to existing customers and cannot change affiliate while orders reference them',async()=>{
 const {docs,service}=fixture();
 const input={code:'NEW10',percentOff:10,maxUses:0,active:true,affiliateUid:'affiliate',expectedRevision:0};
 await service.saveCode('admin',input);assert.equal(docs.get('discountCodes/NEW10').affiliateName,'Affiliate');
 await assert.rejects(service.saveCode('admin',{...input,expectedRevision:0}),/code changed/);
 await assert.rejects(service.saveCode('admin',{...input,code:'UNKNOWN',affiliateUid:'missing'}),/existing customer/);
 await assert.rejects(service.saveCode('admin',{...input,code:'REF10',affiliateUid:null}),/already has orders/);
 await assert.rejects(service.saveCode('admin',{...input,percentOff:101}));
});
test('shipping requires paid status and leaves inventory/referral counters unchanged on tracking edits',async()=>{
 const {docs,service}=fixture();const input={orderId:'order1',tracking:'9400111899223856920000'};
 await assert.rejects(service.ship('admin',input),/Record payment/);
 await service.paid('admin',{orderId:'order1'});await service.ship('admin',input);await service.ship('admin',input);
 assert.equal(docs.get('orders/order1').fulfillmentStatus,'shipped');assert.equal(docs.get('orders/order1').trackingEmailStatus,'not-connected');assert.equal(docs.get('products/bpc').stockQuantity,3);assert.equal(docs.get('affiliates/affiliate').paidReferralCount,1);
 await assert.rejects(service.cancel('admin',{orderId:'order1'}),/Only unpaid/);
});
