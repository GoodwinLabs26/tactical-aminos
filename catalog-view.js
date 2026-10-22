import {productFamilies} from './catalog.js';

// Group display cards, never the SKU records used for checkout or inventory.
export function groupProducts(products) {
  const families=new Map(productFamilies.flatMap(family=>family.variantIds.map(id=>[id,family])));
  const groups=new Map();
  for(const product of products){
    const family=families.get(product.id),key=family?'family:'+family.id:'sku:'+product.id;
    if(!groups.has(key))groups.set(key,{id:family?.id||product.id,name:family?.name||product.name,description:family?.description||product.description||'',image:family?.image||'',variants:[]});
    groups.get(key).variants.push(product);
  }
  for(const group of groups.values())if(group.variants.length>1)group.variants.sort((a,b)=>a.price-b.price);
  return [...groups.values()];
}
export function matchingVariants(group,{category='all',query=''}={}){
  const search=query.trim().toLowerCase();
  return group.variants.filter(product=>(category==='all'||product.category===category)&&`${product.name} ${product.strength}`.toLowerCase().includes(search));
}
export function selectVariant(group,selectedId,matching=group.variants){
  return matching.find(product=>product.id===selectedId)||matching.find(product=>product.stockQuantity!==0)||matching[0]||group.variants[0];
}
