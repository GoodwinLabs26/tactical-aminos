import {validateSale} from './lib/sales-core.js';
import {CheckoutError} from './lib/checkout-core.js';
export function createSalesService({store,now=()=>Date.now(),timestamp=()=>new Date().toISOString()}){
  async function authorize(reader,uid){
    if(!uid)throw new CheckoutError('unauthenticated','Sign in to manage sales.');
    const admin=await reader.get('config/admin');
    if(admin?.uid!==uid&&!(Array.isArray(admin?.additionalUids)&&admin.additionalUids.includes(uid)))throw new CheckoutError('permission-denied','Admin access required.');
  }
  return {
    async save(uid,input){
      return store.transaction(async tx=>{
        await authorize(tx,uid);
        if(!/^[a-z0-9-]{1,80}$/.test(input.productId||'')||!Number.isSafeInteger(input.expectedRevision)||input.expectedRevision<0)throw new CheckoutError('invalid-argument','Choose a product and current sale revision.');
        const path='products/'+input.productId,product=await tx.get(path);
        if(!product)throw new CheckoutError('not-found','Product not found.');
        if((product.saleRevision||0)!==input.expectedRevision)throw new CheckoutError('failed-precondition','This sale changed. Reload sales before saving.');
        let sale;
        if(input.action==='stop')sale=product.sale?{...product.sale,enabled:false}:null;
        else if(input.action==='save'){
          try{sale=validateSale(input.sale||{},product.priceCents,now());}catch(e){throw new CheckoutError('invalid-argument',e.message);}
          if(sale.enabled&&product.published!==true)throw new CheckoutError('failed-precondition','Only published products can have an enabled sale.');
        }else throw new CheckoutError('invalid-argument','Choose save or stop.');
        const {id:ignored,...record}=product;
        tx.set(path,{...record,sale,saleRevision:(product.saleRevision||0)+1,saleUpdatedAt:timestamp(),saleUpdatedBy:uid});
        return {message:input.action==='stop'?'Sale stopped.':sale.enabled?'Sale saved. Its dates control when it is active.':'Sale draft saved. It is not active.'};
      });
    },
    authorize
  };
}
