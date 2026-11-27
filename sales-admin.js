import {activeSale} from './shared/sales-core.js';
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(c/100);
export function initSalesAdmin({getApi,demo,getGeneration}){
  let products=[],selected=null,dirty=false,busy=false;
  const message=(text,ok=false)=>{$('saleMessage').textContent=text;$('saleMessage').classList.toggle('success',ok);};
  const now=()=>Date.now();
  const localDate=ms=>{if(ms==null)return '';const d=new Date(ms);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
  const parseDate=value=>value?new Date(value).getTime():null;
  function state(p){const sale=p.sale;if(!sale?.enabled)return sale?'Draft / stopped':'No sale';if(activeSale(p,now()))return 'Active';if(sale.endsAtMs!=null&&sale.endsAtMs<=now())return 'Ended';return 'Scheduled';}
  function renderList(){
    const q=$('saleSearch').value.toLowerCase();
    $('salesList').innerHTML=products.filter(p=>(p.name+' '+p.strength).toLowerCase().includes(q)).map(p=>`<article class="sale-row"><div><h3>${esc(p.name)} ${esc(p.strength)}</h3><p>${p.priceCents?money(p.priceCents)+' regular price':'Price pending'} · ${esc(state(p))}${!p.published?' · Unpublished':''}</p>${p.sale?`<p>Sale ${money(p.sale.priceCents)} · ${p.sale.allowAdditionalDiscounts?'Additional discounts allowed':'No additional discounts'}<br>${p.sale.startsAtMs?'Starts '+esc(new Date(p.sale.startsAtMs).toLocaleString()):'Starts when enabled'}${p.sale.endsAtMs?' · Ends '+esc(new Date(p.sale.endsAtMs).toLocaleString()):' · No end date'}</p>`:''}</div><button type="button" data-edit-sale="${esc(p.id)}" ${!p.priceCents?'disabled':''}>${p.sale?'Edit sale':'Create sale'}</button>${p.sale?.enabled?`<button type="button" data-stop-sale="${esc(p.id)}">Stop sale</button>`:''}</article>`).join('')||'<p>No matching products.</p>';
  }
  function edit(p){
    if(dirty&&!window.confirm('Discard the unsaved sale changes?'))return;
    selected=p;dirty=false;$('saleForm').reset();$('saleEditor').hidden=false;$('saleEditorTitle').textContent=p.name+' '+p.strength;$('saleRegularPrice').textContent='Regular price: '+money(p.priceCents);$('salePrice').value=p.sale?(p.sale.priceCents/100).toFixed(2):'';$('saleTitle').value=p.sale?.title||'Product sale';$('saleAnnouncement').value=p.sale?.announcement||'';$('saleStart').value=localDate(p.sale?.startsAtMs);$('saleEnd').value=localDate(p.sale?.endsAtMs);$('saleEnabled').checked=p.sale?.enabled===true;$('saleStack').checked=p.sale?.allowAdditionalDiscounts===true;$('salePopup').checked=p.sale?.showPopup??true;$('saleEditor').scrollIntoView({behavior:'smooth',block:'start'});message('');
  }
  async function call(input){if(demo)throw new Error('Product sales are available in the live admin dashboard. Practice mode cannot change prices.');return (await getApi()).manageSales(input);}
  async function load(force=false){
    if(busy)return;if(dirty&&!force)return message('Unsaved sale changes are preserved. Save or cancel before reloading.');
    const generation=getGeneration();busy=true;
    try{const result=await call({action:'list'});if(generation!==getGeneration())return;products=result.products.sort((a,b)=>(a.name+' '+a.strength).localeCompare(b.name+' '+b.strength));renderList();if(!dirty)message('Choose a product and strength to create or edit its sale.');}
    catch(e){if(generation===getGeneration())message(e.message||'Unable to load sales.');}finally{busy=false;}
  }
  $('saleTimezone').textContent='Dates and times use your device timezone: '+Intl.DateTimeFormat().resolvedOptions().timeZone+'. A blank start means immediately; a blank end means no automatic end.';
  $('saleSearch').addEventListener('input',renderList);
  $('saleReload').addEventListener('click',()=>load());
  $('saleForm').addEventListener('input',()=>{dirty=true;});
  $('saleCancel').addEventListener('click',()=>{dirty=false;selected=null;$('saleEditor').hidden=true;message('Changes discarded.');});
  $('salesList').addEventListener('click',async event=>{
    const editButton=event.target.closest('[data-edit-sale]'),stopButton=event.target.closest('[data-stop-sale]');
    if(busy)return;if(editButton){const p=products.find(p=>p.id===editButton.dataset.editSale);if(p)edit(p);}
    if(stopButton){const p=products.find(p=>p.id===stopButton.dataset.stopSale);if(!p||!window.confirm('Stop the sale for '+p.name+' '+p.strength+'?'))return;
      busy=true;const generation=getGeneration();try{const result=await call({action:'stop',productId:p.id,expectedRevision:p.saleRevision});if(generation!==getGeneration())return;dirty=false;selected=null;$('saleEditor').hidden=true;busy=false;await load(true);message(result.message,true);}catch(e){message(e.message||'Unable to stop sale.');}finally{busy=false;}}
  });
  $('saleForm').addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!selected)return;
    const raw=$('salePrice').value.trim();if(!/^\d+(\.\d{1,2})?$/.test(raw))return message('Enter a dollar amount with no more than two decimal places.');
    const priceCents=Math.round(Number(raw)*100),sale={priceCents,title:$('saleTitle').value,announcement:$('saleAnnouncement').value,startsAtMs:parseDate($('saleStart').value),endsAtMs:parseDate($('saleEnd').value),enabled:$('saleEnabled').checked,allowAdditionalDiscounts:$('saleStack').checked,showPopup:$('salePopup').checked};
    if(sale.enabled&&!window.confirm(`Save an enabled sale for ${selected.name} ${selected.strength} at ${money(priceCents)}? ${sale.startsAtMs&&sale.startsAtMs>now()?'It will start on the scheduled date.':'It will be active immediately.'} ${sale.allowAdditionalDiscounts?'Other discounts may stack.':'No additional discounts apply to this item.'}`))return;
    const generation=getGeneration(),product=selected;busy=true;$('saleSave').disabled=true;
    try{const result=await call({action:'save',productId:product.id,expectedRevision:product.saleRevision,sale});if(generation!==getGeneration())return;dirty=false;selected=null;$('saleEditor').hidden=true;busy=false;await load(true);message(result.message,true);}
    catch(e){if(generation===getGeneration())message(e.message||'Sale could not be saved.');}
    finally{busy=false;$('saleSave').disabled=false;}
  });
  return {load,hasDrafts:()=>dirty,reset(){products=[];selected=null;dirty=false;$('saleForm').reset();$('saleEditor').hidden=true;$('salesList').textContent='';message('');}};
}
