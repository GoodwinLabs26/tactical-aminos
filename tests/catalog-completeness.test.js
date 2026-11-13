import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {products,productFamilies} from '../catalog.js';
import {isProductReady,productPriceCents,productPendingLabel} from '../product-availability.js';
import {groupProducts} from '../catalog-view.js';
import {calculateQuote} from '../shared/checkout-core.js';

test('batch strengths/prices and original SKU identities match the supplied catalog',()=>{
 const expected={
 'epithalon-10':['10mg',30],'epithalon-40':['40mg',70],'epithalon-50':['50mg',95],
 'ss31-50':['50mg',125],'igf1-lr3-01':['0.1mg',20],'igf1-lr3-1':['1mg',60],
 'slupp-500':['500mcg',75],'slupp-1000':['1000mcg',150],
 'bpc-tb':['5/5mg',55],'bpc157':['10mg',38],'kpv':['10mg',45],
 'cjc-ipa':['5/5mg',55],'cjc-nodac':['10mg',50],'cjc-dac':['5mg',50],'ipamorelin':['10mg',55],
 'tesamorelin':['10mg',70],'melanotan1':['10mg',35],'melanotan2':['10mg',35],
 'pt141':['10mg',40],'klow':['80mg',100],'aod9604':['5mg',54],'glutathione':['1500mg',75],
 'lipo-c':['10mL',40],'5amino1q':['50mg',110],'dsip':['10mg',55],'selank':['10mg',48],
 'semax':['10mg',38],'pinealon':['10mg',30],'adamax':['10mg',45],'l-carnitine':['1200mg',30]
 };
 for(const [id,[strength,price]]of Object.entries(expected)){const product=products.find(item=>item.id===id);assert.ok(product,id);assert.equal(product.strength,strength,id);assert.equal(product.price,price,id);}
 assert.equal(new Set(products.map(item=>item.id)).size,products.length);
 assert.equal(groupProducts(products).length,37);assert.equal(products.length,47);
 for(const family of productFamilies){assert.ok(family.description,family.id);if(family.id!=='tb500')assert.ok(family.image,family.id);for(const id of family.variantIds)assert.ok(products.some(product=>product.id===id),id);}
});
test('all supplied catalog listings have confirmed prices',()=>{
 const pending=products.filter(item=>item.pendingDetails?.length);assert.deepEqual(pending.map(p=>p.id),['tb500']);assert.equal(products.find(item=>item.id==="5amino1q").name,"5-Amino-1MQ");
 assert.equal(productPriceCents(products.find(item=>item.id==='dsip')),5500);assert.equal(productPendingLabel(products.find(item=>item.id==='dsip')),'');
 for(const product of pending){assert.equal(isProductReady(product),false,product.id);assert.ok(productPendingLabel(product));}
 for(const product of products.filter(item=>!item.pendingDetails?.length)){assert.equal(isProductReady(product),true,product.id);assert.ok(productPriceCents(product)>0);}
 assert.equal(productPriceCents({price:0}),null);assert.equal(productPriceCents({price:null}),null);assert.equal(productPriceCents({priceCents:null,price:40}),null);
});
test('seed records preserve all strengths, zero inventory, confirmed cents and pending publication status',async()=>{
 const seed=JSON.parse(await fs.readFile(new URL('../functions/lib/catalog-draft.json',import.meta.url),'utf8'));
 assert.equal(seed.length,products.length);
 for(const product of products){const record=seed.find(item=>item.id===product.id);assert.equal(record.priceCents,productPriceCents(product));assert.equal(record.published,isProductReady(product));assert.equal(record.stockQuantity,0);assert.equal(record.compoundKey,product.name.toLowerCase());}
 const pending=seed.filter(item=>item.published===false);
 for(const record of pending){assert.throws(()=>calculateQuote({lines:[{productId:record.id,quantity:1}],promotion:'none'},[{...record,stockQuantity:100}],{}),/unavailable/);}
});

test('Mark updates preserve original SKU IDs/prices, add full descriptions and retain legacy-name search',()=>{
 for(const [id,name,legacy] of [['d2','TA-2TZ','D2'],['r3','TA-3RT','R3']]){
  const group=groupProducts(products).find(g=>g.id===id);assert.equal(group.name,name);assert.equal(group.descriptionParagraphs.length,2);assert.ok(group.variants.every(p=>p.name===name));assert.ok(group.aliases.includes(legacy));
 }
 for(const id of ['d2','r3','bpc-tb','cjc-ipa','tesamorelin','melanotan1','melanotan2','pt141','klow','glutathione']){const f=productFamilies.find(f=>f.id===id);assert.equal(f.descriptionParagraphs.length,2,id);assert.ok(f.researchTagline);assert.ok(f.researchDisclaimer);}
 assert.ok(!products.some(p=>p.id==='tb4'));
 assert.ok(!productFamilies.some(f=>f.id==='tb4'||f.variantIds.includes('tb4')));
 const klow=productFamilies.find(f=>f.id==='klow');assert.match(klow.description,/GHK-Cu \(50 mg\)/);assert.match(klow.description,/KPV \(10 mg\)/);
});
