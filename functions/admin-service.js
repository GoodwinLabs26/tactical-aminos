import { CheckoutError } from './lib/checkout-core.js';
const fail = (message, code='invalid-argument') => { throw new CheckoutError(code,message); };
const id = value => { if(typeof value!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(value))fail('Choose a valid record.');return value; };
const integer = (value,min,max,label) => { if(!Number.isSafeInteger(value)||value<min||value>max)fail(`${label} must be a whole number from ${min} to ${max}.`);return value; };
const revision = record => record?.revision || 0;
function stockAlert(tx,productId,product,quantity,threshold,nextRevision,timestamp) {
  const low = quantity<=threshold;
  if(low && product.lowStockActive!==true)tx.set(`notifications/stock-${productId}-${nextRevision}`,{kind:'low-stock',productId,productName:product.name,strength:product.strength,stockQuantity:quantity,threshold,recipient:'TacticalAminos@gmail.com',emailStatus:'not-connected',createdAt:timestamp()});
  return low;
}
export function createAdminService({store,timestamp}) {
  async function requireAdmin(reader,uid) {
    if(!uid)fail('Sign in to use the admin dashboard.','unauthenticated');
    const admin=await reader.get('config/admin');
    if(admin?.uid!==uid)fail('This account does not have admin access.','permission-denied');
  }
  async function transaction(uid,callback) {return store.transaction(async tx=>{await requireAdmin(tx,uid);return callback(tx);});}
  return {
    async dashboard(uid) {
      await requireAdmin(store,uid);
      const [products,orders,customers,codes,affiliates,notifications]=await Promise.all([
        store.list('products'),store.list('orders',{sort:'createdAt'}),store.list('users',{sort:'createdAt'}),store.list('discountCodes'),store.list('affiliates'),store.list('notifications',{sort:'createdAt'})
      ]);
      return {products,orders,customers,codes,affiliates,notifications};
    },
    async page(uid,input) {
      await requireAdmin(store,uid);
      const collections={orders:'orders',customers:'users',products:'products',codes:'discountCodes',affiliates:'affiliates',notifications:'notifications'};
      if(!collections[input.section])fail('Choose a valid dashboard section.');
      return store.list(collections[input.section],{sort:['orders','customers','notifications'].includes(input.section)?'createdAt':undefined,afterId:id(input.afterId)});
    },
    async inventory(uid,input) {
      const productId=id(input.productId),quantity=integer(input.quantity,0,1000000,'Stock'),threshold=integer(input.threshold,0,1000000,'Alert threshold');
      integer(input.expectedRevision,0,Number.MAX_SAFE_INTEGER,'Revision');
      return transaction(uid,async tx=>{
        const product=await tx.get(`products/${productId}`);if(!product)fail('Product was not found.','not-found');
        if(revision(product)!==input.expectedRevision)fail('Inventory changed. Refresh and try again.','failed-precondition');
        const nextRevision=revision(product)+1;
        const low=stockAlert(tx,productId,product,quantity,threshold,nextRevision,timestamp);
        const {id:ignored,...record}=product;
        tx.set(`products/${productId}`,{...record,stockQuantity:quantity,lowStockThreshold:threshold,lowStockActive:low,revision:nextRevision,updatedAt:timestamp(),updatedBy:uid});
        return {message:'Inventory saved.'};
      });
    },
    async saveCode(uid,input) {
      const code=String(input.code||'').trim().toUpperCase();if(!/^[A-Z0-9_-]{1,30}$/.test(code))fail('Use a code of 1–30 letters, numbers, hyphens, or underscores.');
      const percentOff=integer(input.percentOff,1,100,'Discount'),maxUses=integer(input.maxUses,0,1000000,'Maximum uses');
      if(typeof input.active!=='boolean')fail('Choose whether the code is active.');
      const affiliateUid=input.affiliateUid?id(input.affiliateUid):null;
      integer(input.expectedRevision,0,Number.MAX_SAFE_INTEGER,'Revision');
      return transaction(uid,async tx=>{
        const [existing,customer]=await Promise.all([tx.get(`discountCodes/${code}`),affiliateUid?tx.get(`users/${affiliateUid}`):Promise.resolve(null)]);
        if(affiliateUid&&!customer)fail('Choose an existing customer for the affiliate.');
        if(revision(existing)!==input.expectedRevision)fail('This code changed. Refresh and try again.','failed-precondition');
        if(existing?.affiliateUid!==affiliateUid && existing && ((existing.reservedUses||0)>0 || (existing.usedCount||0)>0))fail('This code already has orders. Keep its affiliate link and create a new code for another person.','failed-precondition');
        if(maxUses>0 && maxUses<(existing?.usedCount||0)+(existing?.reservedUses||0))fail('The limit cannot be below its paid and pending uses.');
        const {id:ignored,...record}=existing||{};
        tx.set(`discountCodes/${code}`,{...record,code,percentOff,maxUses,active:input.active,affiliateUid,affiliateName:customer?.name||'',revision:revision(existing)+1,usedCount:existing?.usedCount||0,reservedUses:existing?.reservedUses||0,createdAt:existing?.createdAt||timestamp(),updatedAt:timestamp()});
        return {message:'Promotional code saved.'};
      });
    },
    async paid(uid,input) {
      const orderId=id(input.orderId);
      return transaction(uid,async tx=>{
        const order=await tx.get(`orders/${orderId}`);if(!order)fail('Order was not found.','not-found');
        if(order.paymentStatus==='paid')return {message:'This order is already paid. No stock or referral count changed.',repeated:true};
        if(order.status==='cancelled'||order.paymentStatus!=='unpaid')fail('Only an unpaid, active order can be marked paid.','failed-precondition');
        if(order.inventoryDeducted||order.referralCounted)fail('This order needs review before payment can be recorded.','failed-precondition');
        const lines=order.lines;
        if(!Array.isArray(lines)||!lines.length||new Set(lines.map(line=>line.productId)).size!==lines.length)fail('Order inventory details need review.','failed-precondition');
        for(const line of lines){id(line.productId);integer(line.quantity,1,100,'Vial quantity');}
        const code=order.promoSnapshot?.code,affiliateUid=order.promoSnapshot?.affiliateUid;
        if(code)id(code);if(affiliateUid)id(affiliateUid);id(order.ownerUid);
        const [stats,promo,affiliate,...products]=await Promise.all([
          tx.get(`customerStats/${order.ownerUid}`),code?tx.get(`discountCodes/${code}`):Promise.resolve(null),affiliateUid?tx.get(`affiliates/${affiliateUid}`):Promise.resolve(null),...lines.map(line=>tx.get(`products/${line.productId}`))
        ]);
        for(let i=0;i<lines.length;i++)if(!products[i]||!Number.isSafeInteger(products[i].stockQuantity)||products[i].stockQuantity<lines[i].quantity)fail(`Not enough stock for ${lines[i].name}. Add actual stock before marking this order paid.`,'failed-precondition');
        if(code&&(!promo||!(promo.reservedUses>0)))fail('The code reservation needs review before recording payment.','failed-precondition');
        for(let i=0;i<lines.length;i++){
          const product=products[i],productId=lines[i].productId,quantity=product.stockQuantity-lines[i].quantity,nextRevision=revision(product)+1,threshold=product.lowStockThreshold||0;
          const low=stockAlert(tx,productId,product,quantity,threshold,nextRevision,timestamp);
          const {id:ignored,...record}=product;
          tx.set(`products/${productId}`,{...record,stockQuantity:quantity,revision:nextRevision,lowStockActive:low,updatedAt:timestamp()});
        }
        tx.set(`orders/${orderId}`,{...order,paymentStatus:'paid',status:'paid',inventoryDeducted:true,referralCounted:!!affiliateUid,paidAt:timestamp(),paidBy:uid,updatedAt:timestamp()});
        tx.set(`customerStats/${order.ownerUid}`,{...stats,paidOrderCount:(stats?.paidOrderCount||0)+1,updatedAt:timestamp()});
        if(code){const {id:ignored,...record}=promo;tx.set(`discountCodes/${code}`,{...record,reservedUses:promo.reservedUses-1,usedCount:(promo.usedCount||0)+1,revision:revision(promo)+1});}
        if(affiliateUid){const {id:ignored,...record}=affiliate||{};tx.set(`affiliates/${affiliateUid}`,{...record,uid:affiliateUid,paidReferralCount:(affiliate?.paidReferralCount||0)+1,referredSalesCents:(affiliate?.referredSalesCents||0)+order.totalCents,updatedAt:timestamp()});}
        return {message:'Payment recorded. Stock and paid referral totals updated.',repeated:false};
      });
    },
    async cancel(uid,input) {
      const orderId=id(input.orderId);
      return transaction(uid,async tx=>{
        const order=await tx.get(`orders/${orderId}`);if(!order)fail('Order was not found.','not-found');
        if(order.status==='cancelled')return {message:'This order is already cancelled.',repeated:true};
        if(order.paymentStatus!=='unpaid'||order.inventoryDeducted)fail('Only unpaid orders can be cancelled here. Paid-order refunds need a separate workflow.','failed-precondition');
        const code=order.promoSnapshot?.code;if(code)id(code);id(order.ownerUid);
        const [stats,promo]=await Promise.all([tx.get(`customerStats/${order.ownerUid}`),code?tx.get(`discountCodes/${code}`):Promise.resolve(null)]);
        if(code&&(!promo||!(promo.reservedUses>0)))fail('The code reservation needs review.','failed-precondition');
        const next={...stats,submittedOrderCount:Math.max(0,(stats?.submittedOrderCount||0)-1),updatedAt:timestamp()};
        if(next.firstOrderOrderId===orderId){next.firstOrderClaimed=false;next.firstOrderOrderId=null;}
        tx.set(`customerStats/${order.ownerUid}`,next);
        if(code){const {id:ignored,...record}=promo;tx.set(`discountCodes/${code}`,{...record,reservedUses:promo.reservedUses-1,revision:revision(promo)+1});}
        tx.set(`orders/${orderId}`,{...order,status:'cancelled',cancelledAt:timestamp(),cancelledBy:uid,updatedAt:timestamp()});
        return {message:'Unpaid order cancelled. Code/first-order reservations released.'};
      });
    },
    async ship(uid,input) {
      const orderId=id(input.orderId),tracking=String(input.tracking||'').trim();if(!/^[0-9]{10,40}$/.test(tracking))fail('Enter the USPS tracking number (10–40 digits, without spaces).');
      return transaction(uid,async tx=>{
        const order=await tx.get(`orders/${orderId}`);if(!order)fail('Order was not found.','not-found');
        if(order.paymentStatus!=='paid'||!order.inventoryDeducted)fail('Record payment before shipping this order.','failed-precondition');
        if(order.fulfillmentStatus==='shipped'&&order.trackingNumber===tracking)return {message:'This tracking number is already saved.',repeated:true};
        tx.set(`orders/${orderId}`,{...order,status:'shipped',fulfillmentStatus:'shipped',trackingNumber:tracking,shippingCarrier:'USPS',shippedAt:order.shippedAt||timestamp(),updatedAt:timestamp(),shippedBy:uid,trackingEmailStatus:'not-connected'});
        return {message:'Tracking saved. Email delivery is not connected yet.'};
      });
    }
  };
}
