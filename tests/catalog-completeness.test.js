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
 'ss31-10':['10mg',49],'ss31-50':['50mg',125],'igf1-lr3-01':['0.1mg',20],'igf1-lr3-1':['1mg',60],
 'slupp-500':['500mcg',75],'slupp-1000':['1000mcg',150],
 'bpc-tb':['5/5mg',55],'bpc157':['10mg',38],'tb4':['10mg',50],'kpv':['10mg',45],
 'cjc-ipa':['5/5mg',55],'cjc-nodac':['10mg',50],'cjc-dac':['5mg',50],'ipamorelin':['10mg',55],
 'tesamorelin':['10mg',70],'melanotan1':['10mg',35],'melanotan2':['10mg',35],
 'pt141':['10mg',40],'klow':['80mg',100],'aod9604':['5mg',54],'glutathione':['1500mg',75],
 'lipo-c':['10mL',40],'5amino1q':['50mg',110],'dsip':['10mg',null],'selank':['10mg',48],
 'semax':['10mg',38],'pinealon':['10mg',30],'adamax':['10mg',45],'l-carnitine':['1200mg',30]
 };
 for(const [id,[strength,price]]of Object.entries(expected)){const product=products.find(item=>item.id===id);assert.ok(product,id);assert.equal(product.strength,strength,id);assert.equal(product.price,price,id);}
 assert.equal(new Set(products.map(item=>item.id)).size,products.length);
 assert.equal(groupProducts(products).length,37);assert.equal(products.length,48);
 for(const family of productFamilies){assert.ok(family.description,family.id);assert.ok(family.image,family.id);for(const id of family.variantIds)assert.ok(products.some(product=>product.id===id),id);}
});
test('missing prices and specifications are never treated as a zero price or an orderable product',()=>{
 const pending=products.filter(item=>item.pendingDetails?.length);assert.equal(pending.length,12);
 assert.equal(productPriceCents(products.find(item=>item.id==='dsip')),null);assert.equal(productPendingLabel(products.find(item=>item.id==='dsip')),'Price pending');
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
