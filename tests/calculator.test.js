import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateDilution,convertMass,formatCalculation} from '../calculator-core.js';
const base={capacity:100,vialAmount:30,vialUnit:'mg',desiredAmount:1.5,desiredUnit:'mg',waterMl:3};
const close=(actual,expected)=>assert(Math.abs(actual-expected)<1e-10,`${actual} !== ${expected}`);
test('calculator uses total vial mass and returns concentration, mL, and U-100 units',()=>{
 const result=calculateDilution(base);assert.equal(result.concentrationMgMl,10);close(result.volumeMl,.15);close(result.units,15);close(result.fillFraction,.15);assert.equal(result.exceedsCapacity,false);
});
test('all four mg/mcg combinations represent the same physical quantity',()=>{
 for(const vialUnit of ['mg','mcg'])for(const desiredUnit of ['mg','mcg']){
  const result=calculateDilution({...base,vialUnit,vialAmount:vialUnit==='mg'?30:30000,desiredUnit,desiredAmount:desiredUnit==='mg'?1.5:1500});close(result.units,15);
 }
 close(convertMass(1.5,'mg','mcg'),1500);close(convertMass(1500,'mcg','mg'),1.5);
});
test('30/50/100 syringe capacity changes the fill fraction, never units per mL',()=>{
 for(const capacity of [30,50,100]){const result=calculateDilution({...base,capacity});close(result.units,15);close(result.fillFraction,15/capacity);}
});
test('over-capacity calculations keep the numeric result but do not show a clipped fill',()=>{
 const result=calculateDilution({...base,capacity:30,desiredAmount:6});close(result.units,60);assert.equal(result.exceedsCapacity,true);assert.equal(result.fillFraction,null);
 const exact=calculateDilution({...base,capacity:30,desiredAmount:3});close(exact.units,30);assert.equal(exact.exceedsCapacity,false);assert.equal(exact.fillFraction,1);
});
test('empty/zero/negative/unsupported/nonfinite inputs and amounts above the vial are rejected',()=>{
 for(const field of ['vialAmount','desiredAmount','waterMl'])for(const value of [0,-1,NaN,Infinity,''])assert.throws(()=>calculateDilution({...base,[field]:value}));
 for(const capacity of [0,40,NaN,'100'])assert.throws(()=>calculateDilution({...base,capacity}));
 assert.throws(()=>calculateDilution({...base,vialUnit:'g'}));assert.throws(()=>calculateDilution({...base,desiredUnit:'iu'}));assert.throws(()=>calculateDilution({...base,desiredAmount:31}),/greater than the total/);
 assert.throws(()=>calculateDilution({...base,waterMl:Number.MIN_VALUE}),/outside/);
});
test('fractional results are retained instead of rounding to a whole syringe marking',()=>{
 const result=calculateDilution({...base,desiredAmount:.25});close(result.units,2.5);assert.equal(formatCalculation(result.units),'2.5');
 const tiny=calculateDilution({...base,desiredAmount:.00000001});assert(tiny.units>0);assert.notEqual(formatCalculation(tiny.units),'0');
});
