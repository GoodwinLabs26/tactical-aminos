import test from 'node:test';
import assert from 'node:assert/strict';
import {reportWindow,buildSalesReport,ordersCsv,productsCsv} from '../reports-core.js';
import {createReportsService} from '../functions/reports-service.js';
import {loadAllReportOrders} from '../reports.js';
import {createReportPdf} from '../reports-pdf.js';
const params={year:2026,quarter:1,timeZone:'America/Chicago'};
const window=reportWindow(params),generatedAt=Date.parse('2026-05-01T00:00:00Z');
const order=(id='a',overrides={})=>({id,orderNumber:'TA-'+id,paymentStatus:'paid',paidAt:'2026-02-03T12:00:00Z',paymentMethod:'venmo',subtotalCents:7600,discountCents:760,shippingCents:800,totalCents:7640,lines:[{productId:'bpc',name:'BPC-157',strength:'10mg',quantity:2,unitPriceCents:3800,lineTotalCents:7600}],...overrides});
test('quarter boundaries honor business time zones and daylight-saving changes',()=>{
 assert.equal(new Date(window.startMs).toISOString(),'2026-01-01T06:00:00.000Z');assert.equal(new Date(window.endMs).toISOString(),'2026-04-01T05:00:00.000Z');
 const fourth=reportWindow({year:2026,quarter:4,timeZone:'America/Chicago'});assert.equal(new Date(fourth.startMs).toISOString(),'2026-10-01T05:00:00.000Z');assert.equal(new Date(fourth.endMs).toISOString(),'2027-01-01T06:00:00.000Z');
 assert.equal(new Date(reportWindow({year:2028,quarter:1,timeZone:'UTC'}).endMs).toISOString(),'2028-04-01T00:00:00.000Z');
 assert.throws(()=>reportWindow({...params,timeZone:'invalid'}));assert.throws(()=>reportWindow({...params,quarter:5}));
});
test('reports count paid timestamp in range, not placement or shipped date, with an exclusive end/cutoff',()=>{
 const report=buildSalesReport([order('first',{paidAt:new Date(window.startMs).toISOString()}),order('last',{paidAt:new Date(window.endMs-1).toISOString()}),order('before',{paidAt:new Date(window.startMs-1).toISOString()}),order('after',{paidAt:new Date(window.endMs).toISOString()}),order('unpaid',{paymentStatus:'unpaid'}),order('created',{createdAt:'2025-12-01',shippedAt:'2026-04-02'})],params,{generatedAt});
 assert.equal(report.orderCount,3);assert.equal(report.totalCents,22920);assert.equal(report.vialCount,6);
 const cutoff=Date.parse('2026-02-03T12:00:00Z');assert.equal(buildSalesReport([order()],params,{generatedAt:cutoff}).orderCount,0);
});
test('sales, discounts, shipping, payment methods, and historical product snapshots reconcile',()=>{
 const report=buildSalesReport([order(),order('b',{paymentMethod:'paypal',discountCents:0,totalCents:8400,lines:[{productId:'bpc',name:'Original label',strength:'10mg',quantity:2,unitPriceCents:3800}]})],params,{generatedAt});
 assert.equal(report.grossCents,15200);assert.equal(report.discountCents,760);assert.equal(report.netProductCents,14440);assert.equal(report.shippingCents,1600);assert.equal(report.totalCents,16040);
 assert.equal(report.products.reduce((sum,p)=>sum+p.grossCents,0),report.grossCents);assert.equal(report.payments.reduce((sum,p)=>sum+p.totalCents,0),report.totalCents);assert.equal(report.products.length,2);
 assert.equal(report.orders[0].id,'a');assert(!('customer' in report.orders[0]));
});
test('missing/duplicate/corrupt data and unsupported tax/refunds stop exports instead of partial totals',()=>{
 for(const bad of [order('x',{paidAt:null}),order('x',{subtotalCents:undefined}),order('x',{totalCents:1}),order('x',{discountCents:9000}),order('x',{paymentMethod:'cash'}),order('x',{taxCents:100}),order('x',{refundCents:100}),order('x',{lines:[]}),order('x',{lines:[{productId:'bpc',quantity:-1,unitPriceCents:3800}]}),order('x',{lines:[{productId:'bpc',quantity:2,unitPriceCents:1}]})])assert.throws(()=>buildSalesReport([bad],params,{generatedAt}));
 assert.throws(()=>buildSalesReport([order(),order()],params,{generatedAt}),/duplicate/);
 const empty=buildSalesReport([],params,{generatedAt});assert.equal(empty.orderCount,0);assert.equal(empty.totalCents,0);
});
test('CSV exports preserve USD cents, metadata, Unicode, quotes, and neutralize spreadsheet formulas',()=>{
 const report=buildSalesReport([order('a',{orderNumber:'=1+1',lines:[{productId:'bpc',name:'=HYPERLINK("bad") café',strength:'10mg',quantity:2,unitPriceCents:3800}]})],params,{generatedAt,demo:true});
 const orders=ordersCsv(report),products=productsCsv(report);assert(orders.startsWith('\uFEFF'));assert(orders.includes('"76.40"'));assert(orders.includes('"SAMPLE"'));assert(orders.includes("'="));assert(products.includes("'=HYPERLINK("));assert(products.includes('café'));assert(products.includes('"76.00"'));assert(orders.includes('America/Chicago'));
});
test('report retrieval checks admin authorization before reading report data and validates ranges/cursors',async()=>{
 let calls=0;const service=createReportsService({store:{get:async()=>({uid:'admin'}),reportPage:async()=>{calls++;return {items:[],hasMore:false,nextId:null};}},now:()=>generatedAt});
 await assert.rejects(service.page(null,params),error=>error.code==='unauthenticated');await assert.rejects(service.page('member',params),error=>error.code==='permission-denied');assert.equal(calls,0);
 await assert.rejects(service.page('admin',{...params,afterId:'../orders'}));await assert.rejects(service.page('admin',{...params,cutoffMs:generatedAt+1}));
 const result=await service.page('admin',params);assert.equal(calls,1);assert.equal(result.cutoffMs,generatedAt);
});
test('report loader reads every page independently of the dashboard 50-record page',async()=>{
 let calls=0;const all=Array.from({length:237},(_,i)=>order(String(i)));const result=await loadAllReportOrders(async input=>{const page=calls++;assert.equal(input.cutoffMs,page?generatedAt:undefined);return {...window,cutoffMs:generatedAt,items:page===0?all.slice(0,200):all.slice(200),hasMore:page===0,nextId:page===0?'199':'236'};},params);
 assert.equal(calls,2);assert.equal(result.items.length,237);assert.equal(buildSalesReport(result.items,params,{generatedAt}).orderCount,237);
});
test('a failed or inconsistent later page cannot produce a partial report',async()=>{
 let call=0;await assert.rejects(loadAllReportOrders(async()=>{if(call++)throw new Error('network failure');return {...window,cutoffMs:generatedAt,items:[order()],hasMore:true,nextId:'a'};},params),/network failure/);
 await assert.rejects(loadAllReportOrders(async()=>({...window,cutoffMs:generatedAt,items:[order()],hasMore:true,nextId:'a'}),params),/pagination/);
 assert.equal(await loadAllReportOrders(()=>{throw Error('should not run');},params,{isCurrent:()=>false}),null);
});
test('PDF output is a real PDF, labels practice mode, and includes summary/product pages',()=>{
 const bytes=createReportPdf(buildSalesReport([order()],params,{generatedAt,demo:true}));const text=new TextDecoder().decode(bytes);assert(text.startsWith('%PDF-1.4'));assert(text.includes('SAMPLE DATA - NOT REAL SALES'));assert(text.includes('76.40'));assert(text.includes('/Count 2'));assert(text.includes('startxref'));
});
