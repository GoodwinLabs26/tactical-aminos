// Display/preview guard. The trusted backend also rejects unpublished SKUs.
export function productPriceCents(product){
  if(!product)return null;
  if(Object.hasOwn(product,'priceCents'))return Number.isSafeInteger(product.priceCents)&&product.priceCents>0?product.priceCents:null;
  if(typeof product.price!=='number'||!Number.isFinite(product.price)||product.price<=0)return null;
  const cents=Math.round(product.price*100);return Number.isSafeInteger(cents)&&cents>0?cents:null;
}
export function isProductReady(product){return !!product&&product.published!==false&&productPriceCents(product)!==null&&!(product.pendingDetails?.length);}
export function productPendingLabel(product){return productPriceCents(product)===null?'Price pending':!isProductReady(product)?'Details pending':'';}
