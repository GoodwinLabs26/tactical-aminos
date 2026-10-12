import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateQuote, normalizeLines, validateCustomer } from '../shared/checkout-core.js';
import { createOrderService } from '../functions/order-service.js';

const products=[
  {id:'bpc157',name:'BPC-157',strength:'10mg',priceCents:3800,stockQuantity:100,published:true,bulkEligible:true,compoundKey:'bpc'},
  {id:'d2-30',name:'D2',strength:'30mg',priceCents:15000,stockQuantity:100,published:true,bulkEligible:true,compoundKey:'d2'},
  {id:'d2-60',name:'D2',strength:'60mg',priceCents:24000,stockQuantity:100,published:true,bulkEligible:true,compoundKey:'d2'},
  {id:'kpv',name:'KPV',strength:'10mg',priceCents:4500,stockQuantity:100,published:true,bulkEligible:true,compoundKey:'kpv'},
  {id:'tb4',name:'TB-4',strength:'10mg',priceCents:5000,stockQuantity:100,published:true,bulkEligible:true,compoundKey:'tb4'},
  {id:'tesamorelin',name:'Tesamorelin',strength:'10mg',priceCents:7000,stockQuantity:100,published:true,bulkEligible:true,compoundKey:'tesa'},
  {id:'ipamorelin',name:'Ipamorelin',strength:'10mg',priceCents:5500,stockQuantity:100,published:true,bulkEligible:true,compoundKey:'ipa'}
];
const line=(productId='bpc157',quantity=1)=>({productId,quantity});
const body={name:'Test Member',phone:'515-555-0123',shippingAddress:{street:'123 Sample St',apartment:'',city:'Des Moines',state:'IA',zip:'50309'},paymentMethod:'venmo',researchOnlyAccepted:true,notes:''};
const uid='member-1',email='member@example.com';
function fakeStore() {
  const docs=new Map(products.map(product=>[`products/${product.id}`,structuredClone(product)]));
  docs.set(`users/${uid}`,{ageConfirmed:true,researchOnlyAccepted:true});
  docs.set('config/store',{checkoutEnabled:true,venmoHandle:'@Mark-Williams-1389',paypalHandle:''});
  docs.set('discountCodes/MARK10',{code:'MARK10',percentOff:10,active:true,affiliateUid:'affiliate-1',usedCount:0,reservedUses:0,maxUses:2});
  let serial=Promise.resolve();
  const get=async path=>structuredClone(docs.get(path) || null);
  const store={get,transaction:callback=>{
    const work=serial.then(async()=>{
      const writes=new Map();
      const result=await callback({get,set:(path,data)=>writes.set(path,structuredClone(data))});
      for(const [path,data]of writes)docs.set(path,data);
      return result;
    });
    serial=work.catch(()=>{});return work;
  }};
  return {docs,service:createOrderService({store,timestamp:()=>123456,now:()=>10000})};
}
test('one vial has flat shipping, with no processing fee',()=>{
  const quote=calculateQuote({lines:[line()],promotion:'none'},products);
  assert.equal(quote.totalCents,4600);assert.equal(quote.shippingCents,800);assert.equal(quote.discountCents,0);
});
test('same-vial bulk and first-order discounts match the existing additive rules',()=>{
  assert.equal(calculateQuote({lines:[line('bpc157',5)],promotion:'first'},products).totalCents,16000);
  assert.equal(calculateQuote({lines:[line('bpc157',10)],promotion:'first'},products).totalCents,27400);
  const above=calculateQuote({lines:[line('bpc157',11)],promotion:'none'},products);
  assert.equal(above.discountCents,7600);assert.equal(above.totalCents,35000);
});
test('five distinct compounds get mixed savings; strength variants do not count twice',()=>{
  const mixed=calculateQuote({lines:['bpc157','kpv','tb4','tesamorelin','ipamorelin'].map(id=>line(id)),promotion:'none'},products);
  assert.equal(mixed.discounts.find(discount=>discount.kind==='mixed').amountCents,1290);
  const strengths=calculateQuote({lines:['bpc157','kpv','tb4','d2-30','d2-60'].map(id=>line(id))},products);
  assert(!strengths.discounts.some(discount=>discount.kind==='mixed'));
});
test('one promo is selected and shipping is never discounted, even with capped discounts',()=>{
  const quote=calculateQuote({lines:[line('bpc157',10)],promotion:'code'},products,{promo:{code:'FULL',percentOff:100,active:true}});
  assert.equal(quote.totalCents,800);assert(quote.discountCapCents>0);assert(!quote.discounts.some(discount=>discount.kind==='first'));
  assert.throws(()=>calculateQuote({lines:[line()],promotion:['first','code']},products),/Select either/);
  assert.throws(()=>calculateQuote({lines:[line()],promotion:'first'},products,{firstOrderEligible:false}),/already been used/);
});
test('invalid quantities, duplicate SKUs, client prices and out-of-stock items are rejected',()=>{
  for(const quantity of [0,-1,1.5,101,NaN])assert.throws(()=>normalizeLines([line('bpc157',quantity)]));
  assert.throws(()=>normalizeLines([line(),line()]));
  assert.throws(()=>normalizeLines([{...line(),priceCents:1}]));
  assert.throws(()=>calculateQuote({lines:[line()]},[{...products[0],stockQuantity:0}],{enforceStock:true}),/not enough stock/);
  assert.throws(()=>calculateQuote({lines:[line()]},[{...products[0],stockQuantity:null}],{enforceStock:true}),/not configured/);
});
test('shipping details and payment method are validated',()=>{
  assert.equal(validateCustomer({...body,shippingAddress:{...body.shippingAddress,state:'ia'}}).shippingAddress.state,'IA');
  assert.throws(()=>validateCustomer({...body,paymentMethod:'cash'}));
  assert.throws(()=>validateCustomer({...body,researchOnlyAccepted:false}));
  assert.throws(()=>validateCustomer({...body,shippingAddress:{...body.shippingAddress,zip:'abcde'}}));
});
test('server ignores forged paid/owner fields, leaves inventory and affiliate credit unchanged',async()=>{
  const {docs,service}=fakeStore();
  const input={lines:[line()],promotion:'code',code:'mark10'};
  const quote=await service.quote(uid,input);
  const result=await service.submit(uid,email,{...body,...input,requestId:'request-00000001',expectedQuoteId:quote.quoteId,status:'paid',ownerUid:'someone-else',totalCents:1});
  const order=docs.get(`orders/${result.orderId}`);
  assert.equal(order.ownerUid,uid);assert.equal(order.paymentStatus,'unpaid');assert.equal(order.totalCents,4220);
  assert.equal(docs.get('products/bpc157').stockQuantity,100);assert.equal(order.referralCounted,false);assert.equal(order.inventoryDeducted,false);
  assert.equal(order.promoSnapshot.affiliateUid,'affiliate-1');assert.equal(docs.get('discountCodes/MARK10').usedCount,0);assert.equal(docs.get('discountCodes/MARK10').reservedUses,1);
});
test('concurrent retries save exactly one order and consume the first-order discount once',async()=>{
  const {docs,service}=fakeStore();const input={lines:[line()],promotion:'first'};
  const quote=await service.quote(uid,input);const request={...body,...input,requestId:'request-00000002',expectedQuoteId:quote.quoteId};
  const result=await Promise.all([service.submit(uid,email,request),service.submit(uid,email,request)]);
  assert.equal(result[0].orderId,result[1].orderId);assert.equal(result[1].repeated,true);
  assert.equal([...docs.keys()].filter(key=>key.startsWith('orders/')).length,1);
  assert.equal(docs.get(`customerStats/${uid}`).submittedOrderCount,1);
  await assert.rejects(service.quote(uid,input),/already been used/);
  await assert.rejects(service.submit(uid,email,{...request,lines:[line('bpc157',2)]}),/different checkout/);
});
test('stale quotes, expired/maxed codes, missing member acceptance and absent PayPal block orders',async()=>{
  const {docs,service}=fakeStore();const input={lines:[line()],promotion:'none'};
  const quote=await service.quote(uid,input);docs.get('products/bpc157').priceCents=4000;
  await assert.rejects(service.submit(uid,email,{...body,...input,requestId:'request-00000003',expectedQuoteId:quote.quoteId}),/changed/);
  assert.equal([...docs.keys()].filter(key=>key.startsWith('orders/')).length,0);
  const latest=await service.quote(uid,input);
  await assert.rejects(service.submit(uid,email,{...body,...input,paymentMethod:'paypal',requestId:'request-00000004',expectedQuoteId:latest.quoteId}),/PayPal details/);
  docs.get('discountCodes/MARK10').expiresAtMs=9000;
  await assert.rejects(service.quote(uid,{...input,promotion:'code',code:'MARK10'}),/not currently/);
  delete docs.get('discountCodes/MARK10').expiresAtMs;docs.get('discountCodes/MARK10').reservedUses=2;
  await assert.rejects(service.quote(uid,{...input,promotion:'code',code:'MARK10'}),/usage limit/);
  docs.get(`users/${uid}`).ageConfirmed=false;
  await assert.rejects(service.quote(uid,input),/Confirm your member/);
  await assert.rejects(service.quote(null,input),/Sign in/);
});
test('store disable prevents new orders, but idempotent retry still finds an existing receipt',async()=>{
  const {docs,service}=fakeStore();const input={lines:[line()],promotion:'none'};
  const quote=await service.quote(uid,input);const request={...body,...input,requestId:'request-00000005',expectedQuoteId:quote.quoteId};
  const first=await service.submit(uid,email,request);docs.get('config/store').checkoutEnabled=false;
  const retry=await service.submit(uid,email,request);assert.equal(first.orderId,retry.orderId);
  await assert.rejects(service.quote(uid,input),/not accepting/);
});
