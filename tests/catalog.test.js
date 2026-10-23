import test from 'node:test';
import assert from 'node:assert/strict';
import {products} from '../catalog.js';
import {groupProducts,matchingVariants,selectVariant} from '../catalog-view.js';

test('D2 has one display family while original strength SKUs and prices remain separate',()=>{
  const original=structuredClone(products),groups=groupProducts(products),d2=groups.filter(group=>group.name==='D2');
  assert.equal(d2.length,1);assert.equal(groups.length,products.length-5);
  assert.deepEqual(d2[0].variants.map(product=>[product.id,product.strength,product.price]),[['d2-30','30mg',150],['d2-60','60mg',240]]);
  assert.match(d2[0].description,/39-amino-acid/);assert.match(d2[0].description,/GIP .*GLP-1/);assert.equal(d2[0].image,'assets/d2-product.png');assert.deepEqual(products,original);
  assert.equal(groups.filter(group=>group.name==='R3').length,1);
});
test('D2 selection and stock availability use each variant independently, including zero-stock choices',()=>{
  const records=products.map(product=>({...product,stockQuantity:product.id==='d2-30'?0:8}));
  const d2=groupProducts(records).find(group=>group.id==='d2');
  assert.equal(selectVariant(d2).id,'d2-60');assert.equal(selectVariant(d2,'d2-30').stockQuantity,0);
  assert.equal(selectVariant(d2,'d2-60').price,240);assert.equal(selectVariant(d2,'unknown').id,'d2-60');
  const only60=groupProducts(records.filter(product=>product.id!=='d2-30')).find(group=>group.id==='d2');assert.equal(only60.variants.length,1);assert.equal(selectVariant(only60,'d2-30').id,'d2-60');
});
test('search/category matching returns the original strength records without changing the family',()=>{
  const d2=groupProducts(products).find(group=>group.id==='d2');assert.equal(matchingVariants(d2,{query:'D2'}).length,2);
  assert.deepEqual(matchingVariants(d2,{query:'D2 60mg'}).map(product=>product.id),['d2-60']);
  assert.equal(matchingVariants(d2,{category:'compounds'}).length,0);assert.equal(matchingVariants(d2,{category:'regulators'}).length,2);
  assert.equal(d2.variants.length,2);
});


test('R3 shares one card while strength prices, zero stock, search and D2 remain independent',()=>{
  const records=products.map(product=>({...product,stockQuantity:product.id==='r3-20'?0:6}));
  const groups=groupProducts(records),r3=groups.find(group=>group.id==='r3');
  assert.deepEqual(r3.variants.map(product=>[product.id,product.strength,product.price]),[['r3-20','20mg',145],['r3-30','30mg',200]]);
  assert.equal(r3.image,'assets/r3-product.png');assert.equal(r3.description,'An investigational, once-weekly injectable peptide (a chain of amino acids).');
  assert.equal(selectVariant(r3).id,'r3-30');assert.equal(selectVariant(r3,'r3-20').stockQuantity,0);
  assert.deepEqual(matchingVariants(r3,{query:'R3 30mg'}).map(product=>product.id),['r3-30']);
  assert.equal(matchingVariants(r3,{category:'regulators'}).length,2);assert.equal(matchingVariants(r3,{category:'compounds'}).length,0);
  const d2=groups.find(group=>group.id==='d2');assert.deepEqual(d2.variants.map(product=>product.id),['d2-30','d2-60']);assert.equal(d2.image,'assets/d2-product.png');
});


test('NAD+ groups three confirmed strengths with distinct prices, stock and mechanism detail',()=>{
  const records=products.map(product=>({...product,stockQuantity:product.id==='nad-500'?0:5}));
  const groups=groupProducts(records),nad=groups.find(group=>group.id==='nad');
  assert.equal(groups.filter(group=>group.name==='NAD+').length,1);
  assert.deepEqual(nad.variants.map(product=>[product.id,product.strength,product.price]),[['nad-250','250mg',40],['nad-500','500mg',75],['nad-1000','1000mg',110]]);
  assert.equal(nad.image,'assets/nad-product.png');assert.match(nad.description,/two nucleotides/);assert.match(nad.sections[0].items[0],/ATP/);assert.match(nad.sections[0].items[1],/sirtuins and PARPs/);
  assert.equal(selectVariant(nad).id,'nad-250');assert.equal(selectVariant(nad,'nad-500').stockQuantity,0);
  assert.equal(selectVariant(nad,'nad-1000').price,110);
  assert.deepEqual(matchingVariants(nad,{query:'NAD+ 500mg'}).map(product=>product.id),['nad-500']);
  assert.equal(matchingVariants(nad,{category:'compounds'}).length,3);
});


test('GHK-Cu groups two confirmed strengths while prices, stock and existing families stay separate',()=>{
  const original=structuredClone(products),records=products.map(product=>({...product,stockQuantity:product.id==='ghk-cu-50'?0:7}));
  const groups=groupProducts(records),ghk=groups.find(group=>group.id==='ghk-cu');
  assert.equal(groups.filter(group=>group.name==='GHK-Cu').length,1);
  assert.deepEqual(ghk.variants.map(product=>[product.id,product.strength,product.price]),[['ghk-cu-50','50mg',45],['ghk-cu-100','100mg',75]]);
  assert.equal(ghk.image,'assets/ghk-cu-product.png');assert.match(ghk.description,/copper\(II\)/);assert.equal(ghk.sections[0].title,'Research areas');assert.equal(ghk.sections[0].items.length,3);
  assert.equal(selectVariant(ghk).id,'ghk-cu-100');assert.equal(selectVariant(ghk,'ghk-cu-50').stockQuantity,0);
  assert.deepEqual(matchingVariants(ghk,{query:'GHK-Cu 100mg'}).map(product=>product.id),['ghk-cu-100']);assert.equal(matchingVariants(ghk,{category:'compounds'}).length,2);
  assert.equal(groups.find(group=>group.id==='nad').variants.length,3);assert.equal(groups.find(group=>group.id==='d2').variants.length,2);assert.equal(groups.find(group=>group.id==='r3').variants.length,2);assert.deepEqual(products,original);
});
