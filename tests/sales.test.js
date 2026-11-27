import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs/promises';
import {activeSale,validateSale} from '../shared/sales-core.js';
import {calculateQuote} from '../shared/checkout-core.js';
import {productCurrentPriceCents,productSale} from '../product-availability.js';
import {createSalesService} from '../functions/sales-service.js';
import {createOrderService} from '../functions/order-service.js';
const sale={enabled:true,priceCents:16500,startsAtMs:1000,endsAtMs:3000,title:'Flash sale',announcement:'This weekend',allowAdditionalDiscounts:false,showPopup:true};
const product={id:'r3-30',name:'TA-3RT',strength:'30mg',published:true,priceCents:20000,stockQuantity:100,bulkEligible:true,compoundKey:'r3',sale};
const other={...product,id:'r3-20',strength:'20mg',priceCents:14000,sale:null};
const normal={id:'bpc157',name:'BPC-157',strength:'10mg',published:true,priceCents:3800,stockQuantity:100,bulkEligible:true,compoundKey:'bpc'};
const lines=(...ids)=>ids.map(productId=>({productId,quantity:1}));
function fixture(){
 const docs=new Map([['config/admin',{uid:'admin',additionalUids:['mark']}],['config/store',{checkoutEnabled:true,venmoHandle:'@store'}],['users/member',{ageConfirmed:true,researchOnlyAccepted:true}],['products/r3-30',structuredClone(product)],['products/r3-20',structuredClone(other)]]);
 let serial=Promise.resolve(),time=2000;
 const get=async key=>structuredClone(docs.get(key)||null);
 const store={get,transaction:fn=>{const result=serial.then(async()=>{const writes=[];let wrote=false;const value=await fn({get:async key=>{assert(!wrote,'Firestore reads precede writes');return get(key);},set:(key,v)=>{wrote=true;writes.push([key,structuredClone(v)]);}});for(const[k,v]of writes)docs.set(k,v);return value;});serial=result.catch(()=>{});return result;}};
 return {docs,store,setTime:n=>time=n,sales:createSalesService({store,now:()=>time,timestamp:()=>123}),orders:createOrderService({store,now:()=>time,timestamp:()=>123})};
}
test('sale start is inclusive, end is exclusive, and invalid or disabled sales use regular prices',()=>{
 assert.equal(productCurrentPriceCents(product,999),20000);assert.equal(productCurrentPriceCents(product,1000),16500);assert.equal(productCurrentPriceCents(product,2999),16500);assert.equal(productCurrentPriceCents(product,3000),20000);
 for(const patch of [{enabled:false},{priceCents:20001},{priceCents:0},{startsAtMs:NaN},{endsAtMs:1000}])assert.equal(activeSale({...product,sale:{...sale,...patch}},2000),null);
 assert.equal(productCurrentPriceCents({price:200,sale},2000),16500);
});
test('sale validation rejects fake regular prices, invalid dates, fractional cents and missing options',()=>{
 for(const patch of [{priceCents:20000},{priceCents:16500.5},{endsAtMs:500},{enabled:'true'},{title:'bad\nheader'},{announcement:'x'.repeat(241)}])assert.throws(()=>validateSale({...sale,...patch},20000,2000));
 assert.throws(()=>validateSale(sale,null,2000));assert.equal(validateSale({...sale,startsAtMs:null,endsAtMs:null},20000,2000).priceCents,16500);
});
test('sale applies to only the chosen strength and snapshots actual unit price',()=>{
 const q=calculateQuote({lines:lines('r3-30','r3-20'),promotion:'none'},[product,other],{now:2000});assert.equal(q.subtotalCents,30500);assert.equal(q.totalCents,31300);assert.equal(q.lines.find(l=>l.productId==='r3-20').unitPriceCents,14000);assert.equal(q.lines.find(l=>l.productId==='r3-30').regularUnitPriceCents,20000);assert.equal(q.lines.find(l=>l.productId==='r3-30').saleSnapshot.priceCents,16500);
});
test('excluded sale items receive no first-order, code, bulk or mixed discount, even at the discount cap',()=>{
 const q=calculateQuote({lines:[{productId:'r3-30',quantity:10},...lines('bpc157')],promotion:'first'},[product,normal],{now:2000});assert.equal(q.discountCents,380);assert(!q.discounts.some(d=>d.kind==='bulk10'));assert.equal(q.totalCents,169220);
 const capped=calculateQuote({lines:[{productId:'r3-30',quantity:10},{productId:'bpc157',quantity:10}],promotion:'code'},[product,normal],{now:2000,promo:{code:'FULL',active:true,percentOff:100}});assert.equal(capped.discountCents,38000);assert.equal(capped.totalCents,165800);
 assert.throws(()=>calculateQuote({lines:lines('r3-30'),promotion:'code'},[product],{now:2000,promo:{code:'X',active:true,percentOff:30}}),/sale items exclude/);
 const q2=calculateQuote({lines:lines('r3-30'),promotion:'first'},[product],{now:2000});assert.equal(q2.totalCents,17300);assert.equal(q2.discountCents,0);
});
test('excluded sale compounds do not count toward five-compound mixed savings',()=>{
 const normals=Array.from({length:4},(_,i)=>({...normal,id:'normal-'+i,compoundKey:'compound-'+i}));const q=calculateQuote({lines:lines('r3-30',...normals.map(p=>p.id))},[product,...normals],{now:2000});assert(!q.discounts.some(d=>d.kind==='mixed'));
});
test('explicit stacking applies existing discounts to the sale price, never the regular price',()=>{
 const p={...product,sale:{...sale,allowAdditionalDiscounts:true}};const q=calculateQuote({lines:[{productId:p.id,quantity:5}],promotion:'first'},[p],{now:2000});assert.equal(q.subtotalCents,82500);assert.equal(q.discountCents,16500);assert.equal(q.totalCents,66800);
});
test('sales writes require admin access and leave regular prices, stock and orders unchanged',async()=>{
 const f=fixture(),input={action:'save',productId:'r3-30',expectedRevision:0,sale};await assert.rejects(f.sales.save(null,input),e=>e.code==='unauthenticated');await assert.rejects(f.sales.save('member',{...input,admin:true}),e=>e.code==='permission-denied');
 await f.sales.save('mark',input);const saved=f.docs.get('products/r3-30');assert.equal(saved.priceCents,20000);assert.equal(saved.stockQuantity,100);assert.equal(saved.saleRevision,1);assert.equal(f.docs.get('products/r3-20').sale,null);assert.equal([...f.docs.keys()].filter(k=>k.startsWith('orders/')).length,0);
 await assert.rejects(f.sales.save('admin',input),/sale changed/);await f.sales.save('admin',{action:'stop',productId:'r3-30',expectedRevision:1});assert.equal(productCurrentPriceCents(f.docs.get('products/r3-30'),2000),20000);
});
test('unpublished products cannot be enabled; saved drafts do not change checkout',async()=>{
 const f=fixture();f.docs.get('products/r3-30').published=false;await assert.rejects(f.sales.save('admin',{action:'save',productId:'r3-30',expectedRevision:0,sale}),/published/);await f.sales.save('admin',{action:'save',productId:'r3-30',expectedRevision:0,sale:{...sale,enabled:false}});assert.equal(activeSale(f.docs.get('products/r3-30'),2000),null);
});
const body={name:'Test Member',phone:'5155550123',shippingAddress:{street:'123 Sample St',apartment:'',city:'Des Moines',state:'IA',zip:'50309'},paymentMethod:'venmo',researchOnlyAccepted:true,notes:'',promotion:'none',lines:lines('r3-30'),requestId:'sale-request-0000001'};
test('a quote crossing the sale end is rejected atomically and requires the regular-price quote',async()=>{
 const f=fixture(),q=await f.orders.quote('member',body);assert.equal(q.totalCents,17300);f.setTime(3000);await assert.rejects(f.orders.submit('member','member@example.com',{...body,expectedQuoteId:q.quoteId}),/prices or discount eligibility changed/);assert.equal([...f.docs.keys()].filter(k=>k.startsWith('orders/')).length,0);const fresh=await f.orders.quote('member',body);assert.equal(fresh.totalCents,20800);
});
test('retry after sale expiry finds original receipt without repricing or duplicating the order',async()=>{
 const f=fixture(),q=await f.orders.quote('member',body),first=await f.orders.submit('member','member@example.com',{...body,expectedQuoteId:q.quoteId});f.setTime(4000);const repeat=await f.orders.submit('member','member@example.com',{...body,expectedQuoteId:q.quoteId});assert.equal(repeat.orderId,first.orderId);assert.equal(repeat.totalCents,17300);assert.equal(repeat.repeated,true);assert.equal([...f.docs.keys()].filter(k=>k.startsWith('orders/')).length,1);assert.equal(f.docs.get('products/r3-30').stockQuantity,100);
});
test('client-supplied sale prices cannot enter checkout lines',()=>{
 assert.throws(()=>calculateQuote({lines:[{productId:'r3-30',quantity:1,priceCents:1}]},[product],{now:2000}),/Invalid cart/);
});
test('popup escapes announcements, appears once per visit, and can be reopened manually',async()=>{
 const elements=new Map(),events=new Map(),storage=new Map();let opens=0;
 function el(id){if(!elements.has(id))elements.set(id,{hidden:true,innerHTML:'',open:false,listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},showModal(){this.open=true;opens++;},close(){this.open=false;}});return elements.get(id);}
 const context=vm.createContext({Intl,String,sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},document:{getElementById:el,querySelector:()=>null,addEventListener(){},hidden:false},window:{addEventListener(){}},location:{hash:''}});
 const module=new vm.SourceTextModule(await fs.readFile(new URL('../sales-storefront.js',import.meta.url),'utf8'),{context});await module.link(()=>{});await module.evaluate();let refreshed=0;
 const controller=module.namespace.initSaleAnnouncements({getService:async()=>({getCurrentSales:async()=>({sales:[{...sale,productId:'r3-30',name:'TA-3RT',strength:'30mg',regularPriceCents:20000,title:'<script>bad</script>',announcement:'<img onerror=bad>'}]})}),onRefresh:()=>{refreshed++;}});
 await new Promise(r=>setTimeout(r,5));assert.equal(opens,1);assert.match(el('salesDialogList').innerHTML,/&lt;script&gt;/);assert(!el('salesDialogList').innerHTML.includes('<img'));el('closeSalesDialog').listeners.click();await controller.refresh();assert.equal(opens,1);el('currentSalesButton').listeners.click();assert.equal(opens,2);assert(refreshed>=2);
});
