// Shared by the storefront and trusted checkout. End times are exclusive.
export function activeSale(product,now=Date.now()){
  const sale=product?.sale,regular=product?.priceCents;
  if(sale?.enabled!==true||!Number.isSafeInteger(regular)||!Number.isSafeInteger(sale.priceCents)||sale.priceCents<1||sale.priceCents>=regular)return null;
  if(sale.startsAtMs!=null&&(!Number.isFinite(sale.startsAtMs)||sale.startsAtMs>now))return null;
  if(sale.endsAtMs!=null&&(!Number.isFinite(sale.endsAtMs)||sale.endsAtMs<=now))return null;
  if(sale.startsAtMs!=null&&sale.endsAtMs!=null&&sale.endsAtMs<=sale.startsAtMs)return null;
  return {...sale,allowAdditionalDiscounts:sale.allowAdditionalDiscounts===true};
}
export function effectivePriceCents(product,now=Date.now()){
  return activeSale(product,now)?.priceCents??product?.priceCents;
}
export function validateSale(input,regularPriceCents,now=Date.now()){
  if(!Number.isSafeInteger(regularPriceCents)||regularPriceCents<1)throw new Error('Set a confirmed regular product price first.');
  if(!Number.isSafeInteger(input.priceCents)||input.priceCents<1||input.priceCents>=regularPriceCents)throw new Error('Sale price must be at least $0.01 and below the regular price.');
  for(const field of ['enabled','allowAdditionalDiscounts','showPopup'])if(typeof input[field]!=='boolean')throw new Error('Choose the sale and announcement options.');
  const title=String(input.title||'Product sale').trim(),announcement=String(input.announcement||'').trim();
  if(!title||title.length>80||announcement.length>240||/[\x00-\x1f]/.test(title+announcement))throw new Error('Use a title up to 80 characters and a one-line announcement up to 240 characters.');
  const startsAtMs=input.startsAtMs??null,endsAtMs=input.endsAtMs??null;
  for(const n of [startsAtMs,endsAtMs])if(n!==null&&(!Number.isSafeInteger(n)||n<0||n>4102444800000))throw new Error('Choose valid sale dates before 2100.');
  if(endsAtMs!==null&&endsAtMs<=(startsAtMs??now))throw new Error('The end must be after the start (or now for an immediate sale).');
  return {enabled:input.enabled,priceCents:input.priceCents,startsAtMs,endsAtMs,title,announcement,allowAdditionalDiscounts:input.allowAdditionalDiscounts,showPopup:input.showPopup};
}
