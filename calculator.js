import {calculateDilution,convertMass,formatCalculation as number} from './calculator-core.js';
const $=id=>document.getElementById(id);
export function initCalculator(){
  let shown=false,lastVialUnit=$('calcVialUnit').value||'mg',lastDesiredUnit=$('calcDesiredUnit').value||'mg';
  function graphic(result=null){
    const capacity=Number($('calcCapacity').value)||100;
    const fill=result?.fillFraction??0;
    const marker=130+500*fill;
    const major=capacity===30?5:capacity===50?10:20;
    const minor=capacity===30?1:capacity===50?2:5;
    let ticks='';
    for(let unit=0;unit<=capacity;unit+=minor){const x=130+500*unit/capacity;const isMajor=unit%major===0;ticks+=`<line x1="${x}" y1="82" x2="${x}" y2="${isMajor?106:95}" stroke="#203454" stroke-width="${isMajor?1.8:1}"/>`;}
    for(let unit=0;unit<=capacity;unit+=major){const x=130+500*unit/capacity;ticks+=`<text x="${x}" y="65" text-anchor="middle" fill="#203454" font-size="20" font-family="Arial,sans-serif">${unit}</text>`;}
    const valid=result&&!result.exceedsCapacity;
    const title=valid?`U-100 syringe: ${number(result.units)} units on a ${capacity}-unit capacity scale.`:`${capacity}-unit U-100 syringe illustration. ${result?.exceedsCapacity?'Calculated amount exceeds capacity.':'Enter your values to calculate a volume.'}`;
    $('calculatorGraphic').innerHTML=`<svg viewBox="0 0 760 185" role="img" aria-labelledby="syringeTitle"><title id="syringeTitle">${title}</title><defs><clipPath id="calcBarrelClip"><rect x="130" y="80" width="500" height="60" rx="6"/></clipPath></defs><line x1="20" y1="110" x2="85" y2="110" stroke="#8794a9" stroke-width="3"/><rect x="85" y="99" width="45" height="22" rx="3" fill="#c4d0e5"/><rect x="130" y="80" width="500" height="60" rx="6" fill="#fff" stroke="#9cabc4" stroke-width="2"/><rect x="130" y="80" width="${500*fill}" height="60" fill="#c7d9ff" clip-path="url(#calcBarrelClip)"/>${ticks}<line x1="${valid?marker:630}" y1="110" x2="710" y2="110" stroke="#b6c4da" stroke-width="13"/><rect x="${valid?Math.max(130,marker-3):627}" y="99" width="6" height="38" fill="#142d62"/><line x1="710" y1="85" x2="710" y2="135" stroke="#9cabc4" stroke-width="8"/><line x1="630" y1="70" x2="630" y2="150" stroke="#9cabc4" stroke-width="5"/>${valid?`<line x1="${marker}" y1="143" x2="${marker}" y2="158" stroke="#1648ed" stroke-width="3"/><circle cx="${marker}" cy="164" r="5" fill="#1648ed"/>`:''}<text x="380" y="183" text-anchor="middle" fill="#64728a" font-size="15" font-family="Arial,sans-serif">U-100 · ${capacity} units = ${number(capacity/100)} mL capacity</text></svg>`;
  }
  function clearResult(){shown=false;$('calcResult').hidden=true;$('calcDoseYield').hidden=true;$('calcEmpty').hidden=false;$('calcError').textContent='';graphic();}
  function calculate(event){
    event?.preventDefault();
    try{
      const result=calculateDilution({capacity:Number($('calcCapacity').value),vialAmount:Number($('calcVialAmount').value),vialUnit:$('calcVialUnit').value,desiredAmount:Number($('calcDesiredAmount').value),desiredUnit:$('calcDesiredUnit').value,waterMl:Number($('calcWater').value)});
      $('calcError').textContent='';$('calcEmpty').hidden=true;$('calcResult').hidden=false;
      $('calcUnits').textContent=number(result.units);$('calcVolume').textContent=number(result.volumeMl)+' mL';
      $('calcConcentration').textContent=number(result.concentrationMgMl)+' mg/mL';
      $('calcResult').classList.toggle('over-capacity',result.exceedsCapacity);
      $('calcResultLabel').textContent=result.exceedsCapacity?'ABOVE SELECTED CAPACITY':'CALCULATED VOLUME';
      $('calcCapacityMessage').textContent=result.exceedsCapacity?`This volume exceeds the selected ${result.capacity}-unit syringe capacity. No fill marker is shown.`:`Shown on the ${result.capacity}-unit U-100 scale below.`;
      $('calcFormula').textContent=`${number(result.desiredMg)} mg ÷ ${number(result.vialMg)} mg × ${number(result.waterMl)} mL = ${number(result.volumeMl)} mL`;
      $('calcDoseYield').hidden=false;
      $('calcDoseCount').textContent=result.fullDoseCount===null?'Count exceeds display range':new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(result.fullDoseCount);
      $('calcDoseCountUnit').textContent=result.fullDoseCount===null?'':result.fullDoseCount===1?'full dose':'full doses';
      const unit=$('calcVialUnit').value,remaining=unit==='mcg'?result.remainderMg*1000:result.remainderMg;
      $('calcDoseRemainder').textContent=result.fullDoseCount===null?'The full-dose count is too large to display accurately.':result.hasRemainder?`${number(remaining)} ${unit} left over — less than one additional full dose.`:'No amount left over based on these inputs.';
      $('calcDoseBasis').textContent=`Based on ${number(Number($('calcVialAmount').value))} ${$('calcVialUnit').value} in the vial and ${number(Number($('calcDesiredAmount').value))} ${$('calcDesiredUnit').value} per dose. This is a calculated count; it does not account for handling losses.`;
      graphic(result);shown=true;
    }catch(error){clearResult();$('calcError').textContent=error.message;}
  }
  $('calculatorForm').addEventListener('submit',calculate);
  for(const id of ['calcVialAmount','calcDesiredAmount','calcWater'])$(id).addEventListener('input',clearResult);
  $('calcCapacity').addEventListener('change',()=>{if(shown)calculate();else graphic();});
  function changeUnit(inputId,unitId,previous){
    const input=$(inputId),next=$(unitId).value;
    if(input.value.trim()!==''){try{input.value=String(Number(convertMass(Number(input.value),previous,next).toPrecision(14)));}catch{}}
    clearResult();return next;
  }
  $('calcVialUnit').addEventListener('change',()=>{lastVialUnit=changeUnit('calcVialAmount','calcVialUnit',lastVialUnit);});
  $('calcDesiredUnit').addEventListener('change',()=>{lastDesiredUnit=changeUnit('calcDesiredAmount','calcDesiredUnit',lastDesiredUnit);});
  $('calcReset').addEventListener('click',()=>{$('calculatorForm').reset();lastVialUnit='mg';lastDesiredUnit='mg';clearResult();$('calcVialAmount').focus();});
  graphic();
}
