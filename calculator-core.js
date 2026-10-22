// U-100 scale: 100 syringe units = 1 mL. Capacity changes the
// maximum volume, never the conversion factor. No dose is suggested.
export function massToMg(value,unit){
  if(unit!=='mg'&&unit!=='mcg')throw new Error('Choose mg or mcg.');
  if(typeof value!=='number'||!Number.isFinite(value)||value<=0)throw new Error('Enter a number greater than zero.');
  const result=unit==='mcg'?value/1000:value;
  if(!Number.isFinite(result)||result<=0)throw new Error('This amount is outside the supported calculation range.');
  return result;
}
export function convertMass(value,from,to){
  const mg=massToMg(value,from);
  if(to!=='mg'&&to!=='mcg')throw new Error('Choose mg or mcg.');
  const result=to==='mcg'?mg*1000:mg;
  if(!Number.isFinite(result)||result<=0)throw new Error('This amount is outside the supported calculation range.');
  return result;
}
// Count full portions using the entered decimal masses, so 0.3 / 0.1
// counts as exactly three instead of losing one to floating-point division.
function decimalMass(value,unit){
  const [mantissa,exponent='0']=String(value).toLowerCase().split('e');
  const [whole,fraction='']=mantissa.split('.');
  const power=Number(exponent)-fraction.length-(unit==='mcg'?3:0);
  const digits=BigInt(whole+fraction);
  return power>=0?{n:digits*10n**BigInt(power),d:1n}:{n:digits,d:10n**BigInt(-power)};
}
function fractionNumber(n,d){
  if(n===0n)return 0;
  const numerator=n.toString(),denominator=d.toString();
  const leading=value=>Number(value.slice(0,16))/10**(Math.min(16,value.length)-1);
  return Number(`${leading(numerator)/leading(denominator)}e${numerator.length-denominator.length}`);
}
function doseYield(vialAmount,vialUnit,desiredAmount,desiredUnit){
  const vial=decimalMass(vialAmount,vialUnit),desired=decimalMass(desiredAmount,desiredUnit);
  const numerator=vial.n*desired.d,denominator=vial.d*desired.n;
  const count=numerator/denominator;
  if(count===0n)throw new Error('The desired amount is greater than the total amount in this vial.');
  const fullDoseCount=count<=BigInt(Number.MAX_SAFE_INTEGER)?Number(count):null;
  const remainder=numerator-count*denominator;
  return {fullDoseCount,remainderMg:fractionNumber(remainder,vial.d*desired.d),hasRemainder:remainder>0n};
}
export function calculateDilution({capacity,vialAmount,vialUnit,desiredAmount,desiredUnit,waterMl}){
  if(![30,50,100].includes(capacity))throw new Error('Choose a 30-, 50-, or 100-unit U-100 syringe.');
  let vialMg,desiredMg;
  try{vialMg=massToMg(vialAmount,vialUnit);}catch(error){throw new Error('Vial strength: '+error.message);}
  try{desiredMg=massToMg(desiredAmount,desiredUnit);}catch(error){throw new Error('Desired amount: '+error.message);}
  if(typeof waterMl!=='number'||!Number.isFinite(waterMl)||waterMl<=0)throw new Error('Enter a water volume greater than zero in mL.');
  const yieldResult=doseYield(vialAmount,vialUnit,desiredAmount,desiredUnit);
  const fraction=Math.min(1,desiredMg/vialMg);
  const volumeMl=fraction*waterMl,units=volumeMl*100,concentrationMgMl=vialMg/waterMl;
  if([volumeMl,units,concentrationMgMl].some(value=>!Number.isFinite(value)||value<=0))throw new Error('These values are outside the supported calculation range.');
  const exceedsCapacity=units>capacity && units-capacity>capacity*1e-12;
  return {capacity,vialMg,desiredMg,waterMl,volumeMl,units,concentrationMgMl,...yieldResult,exceedsCapacity,fillFraction:exceedsCapacity?null:Math.min(1,units/capacity)};
}
export function formatCalculation(value){return new Intl.NumberFormat('en-US',{maximumSignificantDigits:6}).format(value);}
