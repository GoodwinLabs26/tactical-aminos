import {buildSalesReport,reportWindow,reportMoney,reportDate,ordersCsv,productsCsv} from './reports-core.js';
import {createReportPdf} from './reports-pdf.js';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export async function loadAllReportOrders(fetchPage,params,{isCurrent=()=>true,onProgress=()=>{}}={}){
 const period=reportWindow(params);let cutoffMs,afterId=null;const items=[],cursors=new Set();
 do{
  if(!isCurrent())return null;
  const page=await fetchPage({...params,...(cutoffMs!==undefined?{cutoffMs}:{}),...(afterId?{afterId}:{})});
  if(!isCurrent())return null;
  if(!Array.isArray(page.items)||page.year!==period.year||page.quarter!==period.quarter||page.timeZone!==period.timeZone||page.startMs!==period.startMs||page.endMs!==period.endMs||!Number.isSafeInteger(page.cutoffMs))throw new Error('Report pages did not match the selected period. Generate again.');
  if(cutoffMs!==undefined&&page.cutoffMs!==cutoffMs)throw new Error('The report cutoff changed. Generate again.');
  cutoffMs=page.cutoffMs;items.push(...page.items);onProgress(items.length);
  if(items.length>50000)throw new Error('This quarter exceeds the current 50,000-order export limit. No partial report was created.');
  if(!page.hasMore)break;
  if(!page.nextId||cursors.has(page.nextId)||!page.items.length)throw new Error('Report pagination could not be completed. No partial report was created.');
  afterId=page.nextId;cursors.add(afterId);
 }while(true);
 return {items,cutoffMs};
}
export function initReports({getApi,demo}){
 let report=null,busy=false,externalLock=false,epoch=0;
 const status=(text,error=false)=>{$('reportMessage').textContent=text;$('reportMessage').classList.toggle('error',error);};
 function controls(){const locked=busy||externalLock;for(const id of ['reportYear','reportQuarter','reportZone','generateReport'])$(id).disabled=locked;for(const id of ['reportPdf','reportOrdersCsv','reportProductsCsv'])$(id).disabled=locked||!report;}
 function reset(){epoch++;busy=false;report=null;$('reportOutput').hidden=true;$('reportPeriod').textContent='';$('reportAsOf').textContent='';$('reportOrderNote').textContent='';$('reportSampleLabel').hidden=true;$('reportCards').innerHTML='';$('reportProducts').innerHTML='';$('reportPayments').innerHTML='';$('reportOrders').innerHTML='';status('Choose a quarter, then generate the report.');controls();}
 function render(){
  $('reportOutput').hidden=false;$('reportSampleLabel').hidden=!demo;
  $('reportPeriod').textContent=`Q${report.quarter} ${report.year} · ${report.timeZone}`;
  $('reportAsOf').textContent=`Generated ${reportDate(report.generatedAt,report.timeZone)} · ${report.orderCount} paid orders · ${report.vialCount} vials`;
  $('reportCards').innerHTML=[['Product sales before discounts',report.grossCents],['Discounts given',report.discountCents],['Product sales after discounts',report.netProductCents],['Shipping collected',report.shippingCents],['Customer payments recorded',report.totalCents]].map(([label,value])=>`<div class="stat"><span>${label}</span><strong>${reportMoney(value)}</strong></div>`).join('');
  $('reportPayments').innerHTML=['venmo','paypal'].map(method=>{const row=report.payments.find(item=>item.method===method);return `<tr><th scope="row">${method==='venmo'?'Venmo':'PayPal'}</th><td>${row?.orderCount||0}</td><td>${reportMoney(row?.totalCents||0)}</td></tr>`;}).join('');
  $('reportProducts').innerHTML=report.products.length?report.products.map(product=>`<tr><th scope="row">${escape(product.name)} <span class="muted">${escape(product.strength)}</span><small>${escape(product.productId)}</small></th><td>${product.quantity}</td><td>${reportMoney(product.grossCents)}</td></tr>`).join(''):'<tr><td colspan="3">No paid product sales in this period.</td></tr>';
  $('reportOrders').innerHTML=report.orders.slice(0,20).map(order=>`<tr><th scope="row">${escape(order.orderNumber)}<small>${escape(reportDate(order.paidAt,report.timeZone))}</small></th><td>${escape(order.paymentMethod==='venmo'?'Venmo':'PayPal')}</td><td>${reportMoney(order.totalCents)}</td></tr>`).join('')||'<tr><td colspan="3">No paid website orders in this period.</td></tr>';
  $('reportOrderNote').textContent=report.orders.length>20?`Showing the first 20 of ${report.orders.length} orders. Download Orders CSV for all matching orders.`:'Orders CSV includes every matching paid order.';
 }
 $('reportForm').addEventListener('submit',async event=>{
  event.preventDefault();if(busy||externalLock)return;
  const generation=++epoch;report=null;$('reportOutput').hidden=true;busy=true;controls();status('Loading all matching paid orders…');
  try{
   const params={year:Number($('reportYear').value),quarter:Number($('reportQuarter').value),timeZone:$('reportZone').value};
   const api=await getApi();
   const result=await loadAllReportOrders(input=>api.reportOrders(input),params,{isCurrent:()=>generation===epoch,onProgress:count=>status(`Loaded ${count} paid orders…`)});
   if(!result||generation!==epoch)return;
   report=buildSalesReport(result.items,params,{generatedAt:result.cutoffMs,demo});render();status(`Report complete. All ${report.orderCount} matching paid orders included.`);
  }catch(error){if(generation===epoch){report=null;$('reportOutput').hidden=true;status(error.code==='functions/failed-precondition'?'The report index may still be building. Wait until it is ready in Firebase, then generate again.':error.message||'Unable to generate this report. No partial export was created.',true);}}
  finally{if(generation===epoch){busy=false;controls();}}
 });
 function download(kind){if(!report||busy||externalLock)return;const filename=`Tactical-Aminos-${demo?'SAMPLE-':''}Q${report.quarter}-${report.year}-${report.timeZone.replaceAll('/','-')}`;
  const content=kind==='pdf'?createReportPdf(report):kind==='orders'?ordersCsv(report):productsCsv(report);
  const blob=new Blob([content],{type:kind==='pdf'?'application/pdf':'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download=filename+(kind==='pdf'?'-Website-Sales.pdf':`-${kind}.csv`);document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 $('reportPdf').addEventListener('click',()=>download('pdf'));$('reportOrdersCsv').addEventListener('click',()=>download('orders'));$('reportProductsCsv').addEventListener('click',()=>download('products'));
 for(const id of ['reportYear','reportQuarter','reportZone'])$(id).addEventListener('change',reset);
 const current=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'numeric'}).formatToParts(new Date()).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
 $('reportYear').value=current.year;$('reportQuarter').value=Math.ceil(current.month/3);$('reportZone').value='America/Chicago';reset();
 return {reset,setLocked:value=>{externalLock=value;controls();}};
}
