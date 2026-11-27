const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
export function initSaleAnnouncements({getService,onRefresh=()=>{}}){
  const seenKey='ta-sales-popup-seen-v1';let seen=false,pending=false,loading=false,sales=[];
  try{seen=sessionStorage.getItem(seenKey)==='yes';}catch{}
  function markSeen(){seen=true;pending=false;try{sessionStorage.setItem(seenKey,'yes');}catch{}}
  function show(){
    if(!pending||seen||!sales.length||document.hidden)return;
    // Do not interrupt another dialog or someone entering account/checkout data.
    if(document.querySelector('dialog[open]')||document.activeElement?.matches?.('input,textarea,select'))return;
    if(typeof $('salesDialog').showModal!=='function')return;
    $('salesDialog').showModal();markSeen();
  }
  function render(){
    $('currentSalesButton').hidden=!sales.length;
    $('salesDialogList').innerHTML=sales.map(s=>`<article class="visitor-sale"><p class="eyebrow">${esc(s.title)}</p><h3>${esc(s.name)} ${esc(s.strength)}</h3><p class="visitor-sale-price"><del>${money(s.regularPriceCents)}</del> <strong>${money(s.priceCents)}</strong></p>${s.announcement?`<p>${esc(s.announcement)}</p>`:''}<p>${s.allowAdditionalDiscounts?'Eligible additional discounts apply at checkout.':'Sale price excludes additional discounts.'}${s.endsAtMs?' Ends '+esc(new Date(s.endsAtMs).toLocaleString())+'.':''}</p></article>`).join('');
    if(!sales.length&&$('salesDialog').open)$('salesDialog').close();
    pending=sales.length>0&&!seen;show();
  }
  async function refresh(){
    if(loading||document.hidden)return;loading=true;
    try{const api=await getService();const result=await api.getCurrentSales();sales=result.sales||[];render();}
    catch{/* A promotional service failure must never block shopping or login. */}
    finally{loading=false;await onRefresh();}
  }
  $('closeSalesDialog').addEventListener('click',()=>{markSeen();$('salesDialog').close();});
  $('salesDialog').addEventListener('cancel',markSeen);
  $('salesDialog').addEventListener('click',event=>{if(event.target===$('salesDialog')){markSeen();$('salesDialog').close();}});
  $('salesShopButton').addEventListener('click',()=>{markSeen();$('salesDialog').close();location.hash='shop';});
  $('currentSalesButton').addEventListener('click',()=>{if(sales.length&&!document.querySelector('dialog[open]'))$('salesDialog').showModal();});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  // At most once automatically per tab visit; shoppers can reopen Current sales.
  const timer=globalThis.setInterval?.(()=>refresh(),60000);
  window.addEventListener('pagehide',()=>{if(timer)globalThis.clearInterval?.(timer);});
  refresh();return {refresh};
}
