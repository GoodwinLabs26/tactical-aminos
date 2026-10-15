export const REPORT_VERSION='website-sales-v1';
export const REPORT_ZONES=['America/Chicago','America/New_York','America/Denver','America/Los_Angeles','UTC'];
export class ReportError extends Error {}
const fail=message=>{throw new ReportError(message);};
function midnight(year,month,timeZone){
 const target=Date.UTC(year,month,1);let instant=target;
 const formatter=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 for(let i=0;i<4;i++){
  const parts=Object.fromEntries(formatter.formatToParts(instant).filter(part=>part.type!=='literal').map(part=>[part.type,Number(part.value)]));
  const wall=Date.UTC(parts.year,parts.month-1,parts.day,parts.hour,parts.minute,parts.second);const delta=target-wall;if(!delta)return instant;instant+=delta;
 }
 fail('Unable to determine the report date range.');
}
export function reportWindow({year,quarter,timeZone='America/New_York'}){
 if(!Number.isInteger(year)||year<2000||year>2100||!Number.isInteger(quarter)||quarter<1||quarter>4)fail('Choose a year from 2000 to 2100 and quarter 1–4.');
 if(!REPORT_ZONES.includes(timeZone))fail('Choose one of the supported report time zones.');
 const startMonth=(quarter-1)*3,endMonth=startMonth+3;
 return {year,quarter,timeZone,startMs:midnight(year,startMonth,timeZone),endMs:midnight(endMonth===12?year+1:year,endMonth%12,timeZone)};
}
export function timestampMs(value){const result=typeof value==='number'?value:typeof value==='string'?Date.parse(value):value?.toMillis?.();return Number.isFinite(result)?result:null;}
function cents(value,label){if(!Number.isSafeInteger(value)||value<0)fail(`${label} is missing or invalid. Report generation stopped.`);return value;}
function add(a,b){const result=a+b;if(!Number.isSafeInteger(result))fail('Report totals exceed the supported range.');return result;}
export function buildSalesReport(orders,params,{generatedAt=Date.now(),demo=false}={}){
 const period=reportWindow(params);if(!Array.isArray(orders))fail('Order data was not received.');
 if(!Number.isSafeInteger(generatedAt)||generatedAt<0)fail('Invalid report generation date.');
 const seen=new Set(),detail=[],products=new Map(),payments=new Map();
 let grossCents=0,discountCents=0,shippingCents=0,totalCents=0,vialCount=0;
 for(const order of orders){
  if(order.paymentStatus!=='paid')continue;
  const paidAt=timestampMs(order.paidAt);
  if(paidAt===null)fail(`Paid date is missing on ${order.orderNumber||order.id}. Report generation stopped.`);
  if(paidAt<period.startMs||paidAt>=period.endMs||paidAt>=generatedAt)continue;
  if(typeof order.id!=='string'||!order.id||seen.has(order.id))fail('Missing or duplicate order ID. Report generation stopped.');seen.add(order.id);
  if(!['venmo','paypal'].includes(order.paymentMethod))fail(`Payment method needs review on ${order.orderNumber||order.id}.`);
  for(const key of ['salesTaxCents','taxCents','refundedCents','refundCents'])if(order[key]!==undefined&&order[key]!==null&&order[key]!==0)fail('Tax or refund data is present. This report version must be updated before exporting it.');
  const gross=cents(order.subtotalCents,'Product subtotal'),discount=cents(order.discountCents,'Discount'),shipping=cents(order.shippingCents,'Shipping'),total=cents(order.totalCents,'Order total');
  if(discount>gross||gross-discount+shipping!==total)fail(`Amounts do not reconcile on ${order.orderNumber||order.id}.`);
  if(!Array.isArray(order.lines)||!order.lines.length)fail(`Product details are missing on ${order.orderNumber||order.id}.`);
  let lineGross=0,quantity=0;const lineIds=new Set(),cleanLines=[];
  for(const line of order.lines){
   if(typeof line.productId!=='string'||!line.productId||lineIds.has(line.productId))fail('Missing or duplicate product ID in an order.');lineIds.add(line.productId);
   if(!Number.isSafeInteger(line.quantity)||line.quantity<1)fail('A product quantity needs review.');
   const unitPrice=cents(line.unitPriceCents??line.priceCents,'Unit price'),amount=unitPrice*line.quantity;cents(amount,'Product amount');
   if(line.lineTotalCents!==undefined&&line.lineTotalCents!==amount)fail('A product line total does not reconcile.');
   const name=String(line.name||line.productId),strength=String(line.strength||'');
   const key=JSON.stringify([line.productId,name,strength]);const product=products.get(key)||{productId:line.productId,name,strength,quantity:0,grossCents:0};
   product.quantity=add(product.quantity,line.quantity);product.grossCents=add(product.grossCents,amount);products.set(key,product);
   lineGross=add(lineGross,amount);quantity=add(quantity,line.quantity);cleanLines.push({productId:line.productId,name,strength,quantity:line.quantity,unitPriceCents:unitPrice,grossCents:amount});
  }
  if(lineGross!==gross)fail(`Product lines do not match the subtotal on ${order.orderNumber||order.id}.`);
  const method=payments.get(order.paymentMethod)||{method:order.paymentMethod,orderCount:0,totalCents:0};method.orderCount++;method.totalCents=add(method.totalCents,total);payments.set(method.method,method);
  grossCents=add(grossCents,gross);discountCents=add(discountCents,discount);shippingCents=add(shippingCents,shipping);totalCents=add(totalCents,total);vialCount=add(vialCount,quantity);
  detail.push({id:order.id,orderNumber:String(order.orderNumber||order.id),paidAt:new Date(paidAt).toISOString(),paymentMethod:order.paymentMethod,grossCents:gross,discountCents:discount,netProductCents:gross-discount,shippingCents:shipping,totalCents:total,quantity,lines:cleanLines,code:String(order.promoSnapshot?.code||'')});
 }
 detail.sort((a,b)=>a.paidAt.localeCompare(b.paidAt)||a.id.localeCompare(b.id));
 return {version:REPORT_VERSION,...period,generatedAt,demo,orderCount:detail.length,vialCount,grossCents,discountCents,netProductCents:grossCents-discountCents,shippingCents,totalCents,orders:detail,products:[...products.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.strength.localeCompare(b.strength)||a.productId.localeCompare(b.productId)),payments:[...payments.values()].sort((a,b)=>a.method.localeCompare(b.method))};
}
export const reportMoney=cents=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(cents/100);
export const reportDate=(value,timeZone)=>new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
function cell(value){let text=String(value??'');if(/^[\s\uFEFF]*[=+\-@]/u.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"';}
function csv(rows){return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';}
const dollars=value=>(value/100).toFixed(2);
export function ordersCsv(report){
 const headers=['data_mode','report_version','year','quarter','timezone','generated_at_utc','order_id','order_number','marked_paid_utc','marked_paid_local','payment_method','vials','products_before_discounts_usd','discounts_usd','net_product_sales_usd','shipping_collected_usd','total_payments_recorded_usd','promotional_code','products'];
 return csv([headers,...report.orders.map(order=>[report.demo?'SAMPLE':'WEBSITE RECORDS',report.version,report.year,report.quarter,report.timeZone,new Date(report.generatedAt).toISOString(),order.id,order.orderNumber,order.paidAt,reportDate(order.paidAt,report.timeZone),order.paymentMethod,order.quantity,dollars(order.grossCents),dollars(order.discountCents),dollars(order.netProductCents),dollars(order.shippingCents),dollars(order.totalCents),order.code,order.lines.map(line=>`${line.productId}: ${line.name} ${line.strength} x${line.quantity}`).join('; ')])]);
}
export function productsCsv(report){return csv([['data_mode','report_version','year','quarter','timezone','generated_at_utc','product_id','product_name','strength','vials_sold','product_sales_before_order_discounts_usd'],...report.products.map(product=>[report.demo?'SAMPLE':'WEBSITE RECORDS',report.version,report.year,report.quarter,report.timeZone,new Date(report.generatedAt).toISOString(),product.productId,product.name,product.strength,product.quantity,dollars(product.grossCents)])]);}
