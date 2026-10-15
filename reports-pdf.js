import {reportMoney,reportDate} from './reports-core.js';
// A small, dependency-free PDF writer. Text is encoded in the standard PDF
// Helvetica fonts; CSV exports preserve full Unicode product names.
const ascii=value=>String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[–—]/g,'-').replace(/[^\x20-\x7E]/g,'?');
const escape=value=>ascii(value).replace(/([\\()])/g,'\\$1');
export function createReportPdf(report){
 const width=612,height=792,left=46,right=566;
 const pages=[];let commands=[],y=0;
 const text=(value,x,top,{size=10,bold=false,color=[.08,.13,.24]}={})=>{commands.push(`${color.join(' ')} rg BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${x} ${height-top} Tm (${escape(value)}) Tj ET`);};
 const line=(top)=>commands.push(`0.86 0.89 0.94 RG 0.7 w ${left} ${height-top} m ${right} ${height-top} l S`);
 function wrapped(value,maxChars){const words=ascii(value).split(/\s+/);const lines=[];let current='';for(let word of words){while(word.length>maxChars){if(current){lines.push(current);current='';}lines.push(word.slice(0,maxChars));word=word.slice(maxChars);}if(current.length+word.length+1>maxChars){lines.push(current);current='';}current+=(current?' ':'')+word;}if(current)lines.push(current);return lines;}
 function paragraph(value,{size=9,maxChars=100,color=[.36,.42,.52]}={}){for(const row of wrapped(value,maxChars)){text(row,left,y,{size,color});y+=14;}y+=5;}
 function newPage(section){if(commands.length)pages.push(commands.join('\n'));commands=[];
  text('TACTICAL AMINOS',left,43,{size:15,bold:true,color:[.08,.27,.88]});text('WEBSITE SALES REPORT',left,66,{size:10,bold:true});
  text(`Q${report.quarter} ${report.year} | ${report.timeZone}`,left,87,{size:10});
  if(report.demo){commands.push(`0.99 0.94 0.83 rg ${left} ${height-124} ${right-left} 23 re f`);text('SAMPLE DATA - NOT REAL SALES',left+10,116,{size:10,bold:true,color:[.5,.29,.02]});}
  y=report.demo?151:119;text(section,left,y,{size:18,bold:true});y+=26;line(y-10);
 }
 const ensure=space=>{if(y+space>713)newPage('Products continued');};
 function metric(label,value,{bold=false}={}){text(label,left,y,{size:11,bold});text(value,416,y,{size:11,bold});y+=27;}
 newPage('Quarterly summary');
 paragraph(`Period: ${reportDate(report.startMs,report.timeZone)} through ${reportDate(report.endMs-1,report.timeZone)}. End boundary excluded.`);
 paragraph(`Generated: ${reportDate(report.generatedAt,report.timeZone)} (${report.timeZone}). Current-quarter activity is included only before this generation time.`);
 paragraph('Basis: website timestamp when an order was marked paid. This is not necessarily the date payment reached Venmo, PayPal, or a bank account.');
 y+=8;metric('Paid orders',String(report.orderCount));metric('Vials sold',String(report.vialCount));line(y-10);
 metric('Product sales before discounts',reportMoney(report.grossCents));metric('Discounts given','- '+reportMoney(report.discountCents));metric('Product sales after discounts',reportMoney(report.netProductCents));metric('Shipping fees collected',reportMoney(report.shippingCents));line(y-10);metric('Total customer payments recorded',reportMoney(report.totalCents),{bold:true});
 y+=15;text('Payments by method',left,y,{size:12,bold:true});y+=23;
 for(const method of ['venmo','paypal']){const record=report.payments.find(item=>item.method===method);metric(`${method==='venmo'?'Venmo':'PayPal'} (${record?.orderCount||0} paid orders)`,reportMoney(record?.totalCents||0));}
 y+=5;paragraph('Totals reconcile: products before discounts - discounts + shipping = total customer payments recorded. All amounts are USD.');
 paragraph('Not included: expenses, inventory purchase costs, processing fees, refunds, sales tax accounting, off-site sales, bank deposits, or tax owed. These are not recorded by the current website.');
 paragraph('Give this sales activity report and its CSV detail to your tax preparer with your payment-app statements and other business records. It is not a profit statement or tax return.');
 newPage('Sales by product');
 paragraph('Product amounts below are before order discounts. They reconcile to product sales before discounts on the summary page. Shipping and discounts are not allocated to individual products.');
 function productHeader(){text('PRODUCT / STRENGTH',left,y,{size:9,bold:true});text('VIALS',380,y,{size:9,bold:true});text('GROSS SALES',466,y,{size:9,bold:true});y+=12;line(y);y+=21;}
 productHeader();
 if(!report.products.length){text('No paid website orders in this period.',left,y,{size:11});y+=28;}
 for(const product of report.products){const names=wrapped(`${product.name} ${product.strength}`,47);const space=Math.max(30,names.length*14+12);if(y+space>704){newPage('Sales by product continued');productHeader();}
  names.forEach((name,index)=>text(name,left,y+index*14,{size:10}));text(String(product.quantity),389,y,{size:10});text(reportMoney(product.grossCents),466,y,{size:10});y+=space;line(y-10);
 }
 ensure(70);y+=10;metric('Total product sales before discounts',reportMoney(report.grossCents),{bold:true});
 paragraph('Order detail and product detail are available as separate CSV exports. Source: website order snapshots; no customer passwords or payment credentials are exported.');
 pages.push(commands.join('\n'));
 const objects=[];const put=value=>{objects.push(value);return objects.length;};
 put('');put('');const regular=put('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');const bold=put('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');
 const pageIds=[];
 for(const [index,content]of pages.entries()){
  const footer=`0.4 0.45 0.54 rg BT /F1 8 Tf 1 0 0 1 ${left} 31 Tm (${escape(`${report.demo?'SAMPLE | ':''}Q${report.quarter} ${report.year} | Website sales activity | Page ${index+1} of ${pages.length}`)}) Tj ET`;
  const stream=content+'\n'+footer;
  const streamId=put(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  pageIds.push(put(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 ${regular} 0 R /F2 ${bold} 0 R >> >> /Contents ${streamId} 0 R >>`));
 }
 objects[0]='<< /Type /Catalog /Pages 2 0 R >>';objects[1]=`<< /Type /Pages /Kids [${pageIds.map(id=>`${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
 let pdf='%PDF-1.4\n';const offsets=[0];
 objects.forEach((object,index)=>{offsets.push(pdf.length);pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});
 const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
 for(const offset of offsets.slice(1))pdf+=String(offset).padStart(10,'0')+' 00000 n \n';
 pdf+=`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return new TextEncoder().encode(pdf);
}
