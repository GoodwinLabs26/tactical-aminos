import {reportWindow,ReportError} from './lib/reports-core.js';
import {CheckoutError} from './lib/checkout-core.js';
export function createReportsService({store,now=()=>Date.now()}){
 return {async page(uid,input={}){
  if(!uid)throw new CheckoutError('unauthenticated','Sign in to generate reports.');
  const admin=await store.get('config/admin');
  if(admin?.uid!==uid)throw new CheckoutError('permission-denied','Only the configured admin can generate reports.');
  let period;try{period=reportWindow(input);}catch(error){if(error instanceof ReportError)throw new CheckoutError('invalid-argument',error.message);throw error;}
  const cutoffMs=input.cutoffMs??now();
  if(!Number.isSafeInteger(cutoffMs)||cutoffMs<0||cutoffMs>now())throw new CheckoutError('invalid-argument','Invalid report cutoff time.');
  const afterId=input.afterId||null;
  if(afterId&&!/^[A-Za-z0-9_-]{1,128}$/.test(afterId))throw new CheckoutError('invalid-argument','Invalid report page.');
  const endMs=Math.min(period.endMs,cutoffMs);
  if(endMs<=period.startMs)return {...period,cutoffMs,items:[],hasMore:false,nextId:null};
  const page=await store.reportPage({...period,endMs,afterId});
  return {...period,cutoffMs,...page};
 }};
}
