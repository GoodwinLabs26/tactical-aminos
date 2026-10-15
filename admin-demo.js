import { products } from './catalog.js';
import { createAdminService } from './functions/admin-service.js';
import { createReportsService } from './functions/reports-service.js';
import { reportWindow, timestampMs } from './reports-core.js';
const docs=new Map();
const now=()=>new Date().toISOString();
for(const product of products)docs.set(`products/${product.id}`,{...product,priceCents:Math.round(product.price*100),stockQuantity:product.id==='bpc157'?8:12,lowStockThreshold:3,revision:0});
const member={name:'Sample Customer',email:'customer@example.com',ageConfirmed:true,createdAt:now()};
const affiliate={...member,name:'Sample Affiliate',email:'affiliate@example.com'};
docs.set('users/demo-customer',member);docs.set('users/demo-affiliate',affiliate);docs.set('config/admin',{uid:'demo-admin'});
docs.set('discountCodes/DEMO10',{code:'DEMO10',percentOff:10,active:true,affiliateUid:'demo-affiliate',affiliateName:affiliate.name,usedCount:0,reservedUses:1,maxUses:0,revision:0});
docs.set('customerStats/demo-customer',{submittedOrderCount:2,firstOrderClaimed:true,firstOrderOrderId:'demo-first-order'});
const common={ownerUid:'demo-customer',customer:{...member,phone:'515-555-0123'},shippingAddress:{street:'123 Sample Street',apartment:'',city:'Des Moines',state:'IA',zip:'50309'},notes:'Sample order for practice only.',createdAt:now(),status:'pending',paymentStatus:'unpaid',fulfillmentStatus:'unfulfilled',inventoryDeducted:false,referralCounted:false,paymentMethod:'venmo',emailStatus:'not-configured'};
docs.set('orders/demo-referral-order',{...common,orderNumber:'TA-DEMO-001',lines:[{productId:'bpc157',name:'BPC-157',strength:'10mg',quantity:5,priceCents:3800}],subtotalCents:19000,discountCents:3800,shippingCents:800,totalCents:16000,promoSnapshot:{code:'DEMO10',percentOff:10,affiliateUid:'demo-affiliate'}});
docs.set('orders/demo-first-order',{...common,orderNumber:'TA-DEMO-002',lines:[{productId:'kpv',name:'KPV',strength:'10mg',quantity:1,priceCents:4500}],subtotalCents:4500,discountCents:450,shippingCents:800,totalCents:4850,promoSnapshot:null});
const get=async path=>structuredClone(docs.get(path)||null);
let serial=Promise.resolve();
const store={get,list:async(collection,settings={})=>{
  let items=[...docs].filter(([key])=>key.startsWith(collection+'/')).map(([key,data])=>({...structuredClone(data),id:key.split('/')[1]}));
  items.sort((a,b)=>settings.sort?String(b[settings.sort]).localeCompare(String(a[settings.sort]))||a.id.localeCompare(b.id):a.id.localeCompare(b.id));
  if(settings.afterId)items=items.slice(items.findIndex(item=>item.id===settings.afterId)+1);
  return {items:items.slice(0,50),hasMore:items.length>50,nextId:items.slice(0,50).at(-1)?.id||null};
},transaction:callback=>{
  const work=serial.then(async()=>{const writes=new Map();const result=await callback({get,set:(path,data)=>writes.set(path,structuredClone(data))});for(const[key,data]of writes)docs.set(key,data);return result;});
  serial=work.catch(()=>{});return work;
}};
const service=createAdminService({store,timestamp:now});
export const adminCommand=(action,input={})=>service[action]('demo-admin',input);
export const initializeCatalog=async()=>({message:'Practice catalog already loaded. Reload the page to reset sample data.'});

// Historical SAMPLE orders make reports testable without changing the two
// original unpaid practice orders or connecting to Firebase.
const currentParts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'numeric'}).formatToParts(new Date()).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
const period=reportWindow({year:currentParts.year,quarter:Math.ceil(currentParts.month/3)});
const examples=[
 {id:'sample-paid-101',orderNumber:'TA-SAMPLE-101',paymentMethod:'venmo',lines:[{productId:'bpc157',name:'BPC-157',strength:'10mg',quantity:2,unitPriceCents:3800,lineTotalCents:7600}],subtotalCents:7600,discountCents:760,shippingCents:800,totalCents:7640},
 {id:'sample-paid-102',orderNumber:'TA-SAMPLE-102',paymentMethod:'paypal',lines:[{productId:'d2-30',name:'D2',strength:'30mg',quantity:1,unitPriceCents:15000,lineTotalCents:15000}],subtotalCents:15000,discountCents:1500,shippingCents:800,totalCents:14300},
 {id:'sample-paid-103',orderNumber:'TA-SAMPLE-103',paymentMethod:'venmo',lines:[{productId:'kpv',name:'KPV',strength:'10mg',quantity:3,unitPriceCents:4500,lineTotalCents:13500},{productId:'bpc157',name:'BPC-157',strength:'10mg',quantity:1,unitPriceCents:3800,lineTotalCents:3800}],subtotalCents:17300,discountCents:0,shippingCents:800,totalCents:18100}
];
for(const [index,example]of examples.entries()){
 const {id,...fields}=example;
 docs.set(`orders/${id}`,{...common,...fields,paymentStatus:'paid',status:'shipped',fulfillmentStatus:'shipped',inventoryDeducted:true,paidAt:new Date(Math.max(period.startMs,Date.now()-(index+1)*3600000)).toISOString(),promoSnapshot:null});
}
const reportStore={get,reportPage:async ({startMs,endMs,afterId})=>{
 let items=[...docs].filter(([key,data])=>key.startsWith('orders/')&&data.paymentStatus==='paid'&&timestampMs(data.paidAt)>=startMs&&timestampMs(data.paidAt)<endMs).map(([key,data])=>({...structuredClone(data),id:key.split('/')[1]}));
 items.sort((a,b)=>a.paidAt.localeCompare(b.paidAt)||a.id.localeCompare(b.id));
 if(afterId)items=items.slice(items.findIndex(item=>item.id===afterId)+1);
 return {items:items.slice(0,200),hasMore:items.length>200,nextId:items.slice(0,200).at(-1)?.id||null};
}};
export const reportOrders=input=>createReportsService({store:reportStore}).page('demo-admin',input);
