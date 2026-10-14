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
export function calculateDilution({capacity,vialAmount,vialUnit,desiredAmount,desiredUnit,waterMl}){
  if(![30,50,100].includes(capacity))throw new Error('Choose a 30-, 50-, or 100-unit U-100 syringe.');
  let vialMg,desiredMg;
  try{vialMg=massToMg(vialAmount,vialUnit);}catch(error){throw new Error('Vial strength: '+error.message);}
  try{desiredMg=massToMg(desiredAmount,desiredUnit);}catch(error){throw new Error('Desired amount: '+error.message);}
  if(typeof waterMl!=='number'||!Number.isFinite(waterMl)||waterMl<=0)throw new Error('Enter a water volume greater than zero in mL.');
  if(desiredMg>vialMg && (desiredMg-vialMg)>vialMg*1e-12)throw new Error('The desired amount is greater than the total amount in this vial.');
  const fraction=Math.min(1,desiredMg/vialMg);
  const volumeMl=fraction*waterMl,units=volumeMl*100,concentrationMgMl=vialMg/waterMl;
  if([volumeMl,units,concentrationMgMl].some(value=>!Number.isFinite(value)||value<=0))throw new Error('These values are outside the supported calculation range.');
  const exceedsCapacity=units>capacity && units-capacity>capacity*1e-12;
  return {capacity,vialMg,desiredMg,waterMl,volumeMl,units,concentrationMgMl,exceedsCapacity,fillFraction:exceedsCapacity?null:Math.min(1,units/capacity)};
}
export function formatCalculation(value){return new Intl.NumberFormat('en-US',{maximumSignificantDigits:6}).format(value);}
