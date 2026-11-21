import {initPromotions} from './promotions-admin.js';
import {createLiveUpdates} from './admin-live.js';
import {initReports} from './reports.js';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format((value||0)/100);
const date=value=>value?new Date(value).toLocaleString('en-US'):'Date pending';
const demo=new URLSearchParams(location.search).get('demo')==='1';
let api,user=null,auth=null,data=null,busy=false,sessionGeneration=0,pendingAction=null,codeRevision=0;
let orderFilter='unpaid',codeOwnerLocked=false;
const stockFeedback=new Map();
const dirtyForms=new Map();
let liveController=null,stopLive=null,liveStart=0;
let refreshSequence=0;
function formKey(form){return form?.dataset.stock?'stock:'+form.dataset.stock:form?.dataset.coaProduct?'coa:'+form.dataset.coaProduct:form?.dataset.ship?'ship:'+form.dataset.ship:form?.id==='codeForm'?'code':null;}
function hasDrafts(){return dirtyForms.size>0;}
function liveStatus(text){$('liveStatus').textContent=text;$('discardLiveEdits').hidden=!hasDrafts();}
function stopLiveUpdates(){liveStart++;stopLive?.();stopLive=null;liveController?.stop();liveController=null;}
async function startLiveUpdates(){
  stopLiveUpdates();const token=liveStart,generation=sessionGeneration;
  liveController=createLiveUpdates({refresh:()=>refresh(true),canApply:()=>!busy&&!hasDrafts()&&!pendingAction&&!document.hidden&&!$('dashboard').hidden&&!document.activeElement?.closest('input,select,textarea'),status:liveStatus});
  liveStatus('Connecting live updates…');
  try{const stop=await api.watchDashboardChanges(()=>{if(token===liveStart)liveController?.notify();},()=>{if(token===liveStart)liveStatus('Live updates disconnected. Use Refresh, or reload to reconnect.');});
    if(token!==liveStart||generation!==sessionGeneration){stop();return;}stopLive=stop;
  }catch{if(token===liveStart)liveStatus('Live updates unavailable. Use Refresh, or reload to reconnect.');}
}
function markDraft(event){
  const form=event.target.closest('form'),key=formKey(form);if(!key)return;
  if(!dirtyForms.has(key)){
    const product=rows('products').find(item=>item.id===(form.dataset.stock||form.dataset.coaProduct));
    form.dataset.draftRevision=String(product?.revision||0);
    form.dataset.draftCoaVersion=product?.coa?.version||'';
  }
  dirtyForms.set(key,form);if(liveController)liveStatus('Live updates paused while you edit. Save to resume.');
}
function clearDraft(key){dirtyForms.delete(key);$('discardLiveEdits').hidden=!hasDrafts();liveController?.wake();}

function matchesOrder(order,filter){return filter==='all'||filter==='cancelled'&&order.status==='cancelled'||filter==='unpaid'&&order.paymentStatus==='unpaid'&&order.status!=='cancelled'||filter==='paid'&&order.paymentStatus==='paid'&&order.fulfillmentStatus!=='shipped'&&order.status!=='cancelled'||filter==='shipped'&&order.fulfillmentStatus==='shipped';}
function showCodeView(view){$('discountsView').hidden=view!=='discounts';$('referralsView').hidden=view!=='referrals';document.querySelectorAll('[data-code-view]').forEach(button=>{const selected=button.dataset.codeView===view;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});}
function updateCodeForm(){const referral=$('codeType').value==='referral';$('affiliateField').hidden=!referral;$('codeAffiliate').required=referral;$('codeAffiliate').disabled=busy||codeOwnerLocked;$('codeType').disabled=busy||codeOwnerLocked;$('affiliateLockNote').hidden=!codeOwnerLocked;const percent=Number($('codePercent').value),customer=rows('customers').find(item=>item.id===$('codeAffiliate').value);$('codeSummary').textContent=`Customers get ${percent>=1&&percent<=100?percent:'…'}% off with this code. `+(referral?`Paid orders give referral credit to ${customer?.name||($('codeAffiliate').value?$('codeAffiliate').selectedOptions[0]?.textContent:'the customer you choose')}.`:'No referral credit is tracked.');if(!codeRevision)$('codeHeading').textContent=referral?'Create a referral code':'Create a discount code';}
const reportsController=initReports({getApi:async()=>api,demo});
const promotionsController=initPromotions({getApi:async()=>api,demo,getGeneration:()=>sessionGeneration});
const message=(text,success=false)=>{$('pageMessage').textContent=text;$('pageMessage').classList.toggle('success',success);};
function lock(value){busy=value;document.querySelectorAll('#dashboard button,#dashboard input,#dashboard select,#confirmAction,#initialize').forEach(element=>{if(!element.closest('#reportsPanel'))element.disabled=value;});reportsController.setLocked(value);$('codeName').readOnly=codeRevision>0;updateCodeForm();}
function resetCode(){codeRevision=0;codeOwnerLocked=false;$('codeForm').reset();$('codeName').readOnly=false;updateCodeForm();}
function rows(section){return data?.[section]?.items||[];}
function renderDashboard(){
  const products=rows('products'),orders=rows('orders');
  const low=products.filter(product=>Number.isInteger(product.stockQuantity)&&product.stockQuantity<=(product.lowStockThreshold||0));
  $('stats').innerHTML=[['Unpaid orders loaded',orders.filter(order=>order.paymentStatus==='unpaid'&&order.status!=='cancelled').length],['Paid · awaiting shipment loaded',orders.filter(order=>order.paymentStatus==='paid'&&order.fulfillmentStatus!=='shipped').length],['Low/out-of-stock products loaded',low.length],['Paid referrals loaded',rows('affiliates').reduce((sum,item)=>sum+(item.paidReferralCount||0),0)]].map(([label,value])=>`<div class="stat"><span>${escape(label)}</span><strong>${value}</strong></div>`).join('');
  document.querySelectorAll('[data-order-filter]').forEach(button=>{const selected=button.dataset.orderFilter===orderFilter;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));button.querySelector('[data-order-count]').textContent=orders.filter(order=>matchesOrder(order,button.dataset.orderFilter)).length;});
  $('orderHelp').textContent={unpaid:'Verify payment in Venmo or PayPal before marking a new order paid.',paid:'Payment has been recorded. Add USPS tracking to mark an order shipped.',shipped:'These orders have been marked shipped. You can view or update USPS tracking.',cancelled:'These unpaid orders were cancelled.',all:'All loaded orders, including cancelled orders.'}[orderFilter];
  const visible=orders.filter(order=>matchesOrder(order,orderFilter));
  $('ordersList').innerHTML=visible.length?visible.map(order=>{
    const unpaid=order.paymentStatus==='unpaid'&&order.status!=='cancelled',paid=order.paymentStatus==='paid';
    const address=order.shippingAddress||{},customer=order.customer||{};
    return `<article class="order"><div class="order-top"><div><h3>${escape(order.orderNumber)}</h3><span class="badge ${paid?'paid':''}">${escape(order.paymentStatus)}</span><span class="badge">${escape(order.status==='cancelled'?'cancelled':order.fulfillmentStatus)}</span><p class="muted small">${escape(date(order.createdAt))}</p></div><strong class="order-total">${money(order.totalCents)}</strong></div><p>${(order.lines||[]).map(line=>`${escape(line.name)} ${escape(line.strength)} × ${line.quantity}`).join(' · ')}</p><p class="muted small">Products ${money(order.subtotalCents)} · Discounts ${money(order.discountCents)} · Shipping ${money(order.shippingCents)}</p><div class="order-details"><div><strong>${escape(customer.name)}</strong><p>${escape(customer.email)}</p><p>${escape(customer.phone)}</p><p>${escape(address.street)} ${escape(address.apartment)}</p><p>${escape(address.city)}, ${escape(address.state)} ${escape(address.zip)}</p></div><div><p>Payment: ${escape(order.paymentMethod)}</p>${order.promoSnapshot?`<p>Code: ${escape(order.promoSnapshot.code)}</p>`:''}<p>${escape(order.notes)}</p>${order.trackingNumber?`<p>USPS: <a target="_blank" rel="noopener noreferrer" href="https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(order.trackingNumber)}">${escape(order.trackingNumber)} ↗</a></p><p class="muted small">Tracking email: not connected</p>`:''}</div></div><div class="order-actions">${unpaid?`<button class="primary" data-paid="${escape(order.id)}">Paid</button><button data-cancel="${escape(order.id)}">Cancel unpaid order</button>`:''}</div>${paid?`<form class="tracking-entry" data-ship="${escape(order.id)}"><label class="small">USPS tracking number<input name="tracking" aria-label="USPS tracking for ${escape(order.orderNumber)}" value="${escape(order.trackingNumber||'')}" inputmode="numeric" pattern="[0-9]{10,40}" required maxlength="40"></label><button type="submit">${order.trackingNumber?'Update tracking':'Shipped'}</button></form>`:''}</article>`;
  }).join(''):'<p class="muted">No matching orders are loaded.</p>';
  const search=$('inventorySearch').value.trim().toLowerCase();
  $('inventoryList').innerHTML=products.filter(product=>`${product.name} ${product.strength}`.toLowerCase().includes(search)).map(product=>`<form class="inventory-row" data-stock="${escape(product.id)}"><div><h3>${escape(product.name)} ${escape(product.strength)}</h3><p class="muted small">${Number.isSafeInteger(product.priceCents)&&product.priceCents>0?money(product.priceCents)+' per vial':'Price pending'}${product.pendingDetails?.length?' · Details pending':''}</p>${product.stockQuantity===0?'<span class="badge low">Out of stock</span>':Number.isInteger(product.stockQuantity)&&product.stockQuantity<=(product.lowStockThreshold||0)?'<span class="badge low">Low stock</span>':''}</div><label>Vials on hand<input name="quantity" type="number" min="0" max="1000000" step="1" value="${Number.isInteger(product.stockQuantity)?product.stockQuantity:''}" required></label><label>Alert at or below<input name="threshold" type="number" min="0" max="1000000" step="1" value="${product.lowStockThreshold||0}" required></label><div class="stock-actions"><button type="submit">Save stock</button><p class="stock-status" role="status" aria-live="polite">${stockFeedback.get(product.id)?.revision===(product.revision||0)?escape(stockFeedback.get(product.id).text):''}</p></div></form>`).join('')||'<p class="muted">No products loaded. Initialize the draft catalog when the backend is connected.</p>';
  const selected=$('codeAffiliate').value;
  $('codeAffiliate').innerHTML='<option value="">Choose a registered customer</option>'+rows('customers').map(customer=>`<option value="${escape(customer.id)}">${escape(customer.name)} · ${escape(customer.email)}</option>`).join('');
  if(selected&&!rows('customers').some(customer=>customer.id===selected))$('codeAffiliate').insertAdjacentHTML('beforeend',`<option value="${escape(selected)}">Previously linked affiliate (${escape(selected)})</option>`);
  $('codeAffiliate').value=selected;
  $('codesList').innerHTML=rows('codes').map(code=>`<article class="record"><div class="record-top"><div><h3>${escape(code.code)} · ${code.percentOff}% off</h3><p><span class="badge ${code.active?'paid':''}">${code.active?'Active':'Turned off'}</span><span class="badge">${code.affiliateUid?'Referral code':'General discount'}</span></p><p>${code.usedCount||0} paid uses · ${code.reservedUses||0} awaiting payment</p>${code.affiliateUid?`<p>Referral credit goes to <strong>${escape(code.affiliateName||rows('customers').find(item=>item.id===code.affiliateUid)?.name||code.affiliateUid)}</strong></p>`:''}<p class="muted small">${code.maxUses?`Up to ${code.maxUses} total uses`:'No use limit'}</p></div><button data-edit-code="${escape(code.id)}">Edit code</button></div></article>`).join('')||'<p class="muted">No codes yet. Create your first offer using the form.</p>';
  const affiliateIds=new Set([...rows('affiliates').map(item=>item.id),...rows('codes').map(code=>code.affiliateUid).filter(Boolean)]);
  $('affiliatesList').innerHTML=[...affiliateIds].map(uid=>{const affiliate=rows('affiliates').find(item=>item.id===uid),customer=rows('customers').find(item=>item.id===uid),codes=rows('codes').filter(item=>item.affiliateUid===uid);return `<article class="record referral-record"><h3>${escape(customer?.name||codes[0]?.affiliateName||uid)}</h3>${customer?.email?`<p class="muted small">${escape(customer.email)}</p>`:''}<div class="referral-numbers"><p><strong>${affiliate?.paidReferralCount||0}</strong> paid referrals</p><p><strong>${money(affiliate?.referredSalesCents)}</strong> referred sales</p></div><p>Codes: ${codes.length?codes.map(code=>`<button class="code-link" data-referral-code="${escape(code.id)}">${escape(code.code)} · ${code.percentOff}% off${code.active?'':' · turned off'}</button>`).join(' '):'No linked codes loaded.'}</p><p class="muted small">Ready to reward this person? Create a separate discount code and share it with them.</p></article>`;}).join('')||'<p class="muted">No referrals to track yet. Create a referral code and choose the customer who will share it.</p>';
  $('customersList').innerHTML=rows('customers').map(customer=>`<article class="record"><h3>${escape(customer.name)}</h3><p>${escape(customer.email)}</p><p class="muted small">Joined ${escape(date(customer.createdAt))} · Member ${customer.ageConfirmed?'confirmed':'not confirmed'}</p></article>`).join('')||'<p class="muted">No customers loaded.</p>';
  $('coaInventoryList').innerHTML=products.map(product=>`<form class="record" data-coa-product="${escape(product.id)}"><h3>${escape(product.name)} ${escape(product.strength)}</h3><p>${product.coa?escape(product.coa.title)+(product.coa.lot?' · Lot '+escape(product.coa.lot):''):'No COA uploaded'}</p><label>Report title<input name="title" maxlength="120" value="${escape(product.coa?.title||'Certificate of analysis')}" required></label><label>Batch / lot (optional)<input name="lot" maxlength="80" value="${escape(product.coa?.lot||'')}"></label><label>PDF, PNG or JPEG (maximum 4 MB)<input name="pdf" type="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" required></label><button type="submit">${product.coa?'Replace COA':'Upload COA'}</button>${product.coa?`<button type="button" data-remove-coa="${escape(product.id)}">Remove COA</button>`:''}</form>`).join('');
  attachProductCoaForms();
  $('notificationsList').innerHTML=rows('notifications').map(notice=>`<article class="record"><h3>${escape(notice.productName)} ${escape(notice.strength)}</h3><p class="stock-alert">${notice.stockQuantity===0?'Out of stock — no vials left':`Only ${notice.stockQuantity} ${notice.stockQuantity===1?'vial':'vials'} left`}</p><p class="muted small">${escape(date(notice.createdAt))} · Email not connected</p></article>`).join('')||'<p class="muted">No stock notices yet.</p>';
  document.querySelectorAll('[data-more]').forEach(button=>button.hidden=!data?.[button.dataset.more]?.hasMore);
  lock(busy);
}

function render(){
  const active=document.activeElement,selection=active&&'selectionStart' in active?[active.selectionStart,active.selectionEnd]:null;
  const openCoas=new Set([...document.querySelectorAll('.product-coa-controls[open]')].map(details=>details.querySelector('[data-coa-product]')?.dataset.coaProduct));
  renderDashboard();
  for(const [key,form] of dirtyForms){
    const selector=key.startsWith('stock:')?'[data-stock]':key.startsWith('coa:')?'[data-coa-product]':key.startsWith('ship:')?'[data-ship]':'#codeForm';
    const replacement=[...document.querySelectorAll(selector)].find(item=>formKey(item)===key);
    if(replacement&&replacement!==form)replacement.replaceWith(form);
    if(key.startsWith('coa:'))form.closest('details')?.setAttribute('open','');
  }
  document.querySelectorAll('.product-coa-controls').forEach(details=>{if(openCoas.has(details.querySelector('[data-coa-product]')?.dataset.coaProduct))details.open=true;});
  if(active?.isConnected&&document.activeElement!==active){active.focus({preventScroll:true});if(selection&&selection[0]!==null)try{active.setSelectionRange(...selection);}catch{}}
}
function attachProductCoaForms() {
  const container = $('coaInventoryList');
  if (!container) return;

  for (const form of [...container.querySelectorAll('[data-coa-product]')]) {
    const productId = form.dataset.coaProduct;
    const stockForm = [...$('inventoryList').querySelectorAll('[data-stock]')]
      .find(item => item.dataset.stock === productId);
    if (!stockForm) continue;

    const wrapper = document.createElement('div');
    wrapper.className = 'product-inventory-entry';
    stockForm.before(wrapper);
    wrapper.append(stockForm);

    const details = document.createElement('details');
    details.className = 'product-coa-controls';
    const summary = document.createElement('summary');
    summary.textContent = 'COA · upload or replace';
    details.append(summary, form);
    wrapper.append(details);

    form.addEventListener('submit', event => {
      event.preventDefault();
      container.dispatchEvent(new CustomEvent('submit', {
        detail: { coaForm: form }
      }));
    });
    form.addEventListener('click', event => {
      const button = event.target.closest('[data-remove-coa]');
      if (button) container.dispatchEvent(new CustomEvent('click', {
        detail: { coaRemoveButton: button }
      }));
    });
  }

  const oldDropdown = container.closest('details');
  if (oldDropdown) oldDropdown.hidden = true;
}
async function refresh(automatic=false){const generation=sessionGeneration,sequence=++refreshSequence;
  const result=await api.adminCommand('dashboard');if(generation!==sessionGeneration||sequence!==refreshSequence)return;
  if(automatic&&(busy||hasDrafts()||pendingAction||document.hidden||document.activeElement?.closest('input,select,textarea'))){liveController?.notify();return;}
  // Reload every page already opened so older visible orders also stay current.
  for(const [section,prior] of Object.entries(data||{})){
    if(!result[section]?.items||prior.items.length<=50)continue;
    let page=result[section],items=[...page.items];
    while(page.hasMore&&items.length<prior.items.length){
      page=await api.adminCommand('page',{section,afterId:page.nextId});
      if(generation!==sessionGeneration||sequence!==refreshSequence)return;
      items.push(...page.items);
    }
    result[section]={...page,items};
  }
  if(automatic&&(busy||hasDrafts()||pendingAction||document.hidden||document.activeElement?.closest('input,select,textarea'))){liveController?.notify();return;}

  data=result;render();$('dashboard').hidden=false;
}
async function run(action,input){if(busy)return;let saved=false;const generation=sessionGeneration;lock(true);message('Saving…');try{const result=await api.adminCommand(action,input);saved=true;if(generation!==sessionGeneration)return;if(action==='inventory')clearDraft('stock:'+input.productId);if(action==='ship')clearDraft('ship:'+input.orderId);if(action==='saveCode')clearDraft('code');await refresh();if(generation!==sessionGeneration)return;if(action==='inventory'){const product=rows('products').find(item=>item.id===input.productId);if(product)stockFeedback.set(product.id,{revision:product.revision||0,text:`✓ Stock saved · ${product.stockQuantity} ${product.stockQuantity===1?'vial':'vials'}`});render();}message(result.message,true);if(action==='saveCode')resetCode();}catch(error){if(generation===sessionGeneration){message(error.message||'Unable to save. Try refreshing.');if(action==='inventory'){const status=[...document.querySelectorAll('[data-stock]')].find(form=>form.dataset.stock===input.productId)?.querySelector('.stock-status');if(status){status.textContent=saved?'Stock saved, but the dashboard could not refresh. Click Refresh.':'Not saved. '+(error.message||'Please try again.');status.classList.add('error');}}}}finally{if(generation===sessionGeneration)lock(false);}}
function confirm(action,orderId,tracking){const order=rows('orders').find(item=>item.id===orderId);if(!order||busy)return;pendingAction={action,input:{orderId,...(tracking?{tracking}:{})}};const paid=action==='paid',ship=action==='ship';$('dialogContent').innerHTML=`<h2 class="dialog-title">${paid?'Record payment?':ship?'Save USPS tracking?':'Cancel this unpaid order?'}</h2><p><strong>${escape(order.orderNumber)}</strong> · ${money(order.totalCents)}</p><p>${paid?'Confirm you received the full payment. This deducts vials and counts any affiliate referral once.':ship?'Tracking will be saved. Email delivery is not connected yet.':'This releases the order’s promotion reservation. Inventory and paid referral totals are unchanged.'}</p>`;$('confirmAction').textContent=paid?'Yes, payment received':ship?'Save tracking':'Cancel order';$('actionDialog').showModal();}
$('confirmAction').addEventListener('click',()=>{const action=pendingAction;pendingAction=null;$('actionDialog').close();if(action)run(action.action,action.input);});
$('cancelAction').addEventListener('click',()=>{$('actionDialog').close();pendingAction=null;});
$('tabs').addEventListener('click',event=>{const button=event.target.closest('[data-tab]');if(!button)return;document.querySelectorAll('[data-tab]').forEach(item=>item.classList.toggle('selected',item===button));for(const name of ['orders','inventory','codes','customers','notifications','reports','promotions'])$(name+'Panel').hidden=name!==button.dataset.tab;if(button.dataset.tab==='promotions')promotionsController.load();});
$('orderTabs').addEventListener('click',event=>{const button=event.target.closest('[data-order-filter]');if(!button||busy)return;orderFilter=button.dataset.orderFilter;render();});$('inventorySearch').addEventListener('input',render);
$('ordersList').addEventListener('click',event=>{const paid=event.target.closest('[data-paid]'),cancel=event.target.closest('[data-cancel]');if(paid)confirm('paid',paid.dataset.paid);if(cancel)confirm('cancel',cancel.dataset.cancel);});
$('ordersList').addEventListener('submit',event=>{event.preventDefault();const form=event.target.closest('[data-ship]');if(form)confirm('ship',form.dataset.ship,form.elements.tracking.value);});
$('inventoryList').addEventListener('submit',event=>{event.preventDefault();const form=event.target.closest('[data-stock]');if(!form||busy)return;const status=form.querySelector('.stock-status');status.textContent='Saving…';status.classList.remove('error','unsaved');const product=rows('products').find(item=>item.id===form.dataset.stock);run('inventory',{productId:product.id,quantity:Number(form.elements.quantity.value),threshold:Number(form.elements.threshold.value),expectedRevision:Number(form.dataset.draftRevision??product.revision??0)});});
$('codeForm').addEventListener('submit',event=>{event.preventDefault();run('saveCode',{code:$('codeName').value,percentOff:Number($('codePercent').value),maxUses:Number($('codeLimit').value),active:$('codeActive').checked,affiliateUid:$('codeType').value==='referral'?$('codeAffiliate').value||null:null,expectedRevision:codeRevision});});
$('newCode').addEventListener('click',()=>{clearDraft('code');resetCode();});
function editCode(id){if(busy)return;const code=rows('codes').find(item=>item.id===id);if(!code)return;codeRevision=code.revision||0;codeOwnerLocked=(code.usedCount||0)+(code.reservedUses||0)>0;$('codeType').value=code.affiliateUid?'referral':'general';$('codeName').value=code.code;$('codeName').readOnly=true;$('codePercent').value=code.percentOff;$('codeLimit').value=code.maxUses||0;$('codeActive').checked=code.active;if(code.affiliateUid&&!rows('customers').some(customer=>customer.id===code.affiliateUid))$('codeAffiliate').insertAdjacentHTML('beforeend',`<option value="${escape(code.affiliateUid)}">${escape(code.affiliateName||code.affiliateUid)}</option>`);$('codeAffiliate').value=code.affiliateUid||'';$('codeHeading').textContent='Edit '+code.code;updateCodeForm();showCodeView('discounts');$('codeForm').scrollIntoView({behavior:'smooth',block:'center'});}
$('codesList').addEventListener('click',event=>{const button=event.target.closest('[data-edit-code]');if(button)editCode(button.dataset.editCode);});
$('affiliatesList').addEventListener('click',event=>{const button=event.target.closest('[data-referral-code]');if(button)editCode(button.dataset.referralCode);});
$('codeTabs').addEventListener('click',event=>{const button=event.target.closest('[data-code-view]');if(button&&!busy)showCodeView(button.dataset.codeView);});
$('createReferral').addEventListener('click',()=>{clearDraft('code');resetCode();$('codeType').value='referral';updateCodeForm();showCodeView('discounts');$('codeName').focus();});
$('codeForm').addEventListener('input',updateCodeForm);
$('codeForm').addEventListener('change',updateCodeForm);
$('inventoryList').addEventListener('input',event=>{const form=event.target.closest('[data-stock]');if(!form)return;stockFeedback.delete(form.dataset.stock);const status=form.querySelector('.stock-status');status.textContent='Unsaved changes';status.classList.remove('error');status.classList.add('unsaved');});
$('refresh').addEventListener('click',async()=>{if(busy)return;lock(true);try{await refresh();message('Dashboard refreshed.',true);}catch(error){message(error.message);}finally{lock(false);}});
$('initialize').addEventListener('click',async()=>{if(busy)return;lock(true);try{const result=await api.initializeCatalog();await refresh();message(result.message,true);}catch(error){message(error.message);}finally{lock(false);}});
$('dashboard').addEventListener('click',async event=>{const button=event.target.closest('[data-more]');if(!button||busy)return;const section=button.dataset.more,generation=sessionGeneration;lock(true);try{const result=await api.adminCommand('page',{section,afterId:data[section].nextId});if(generation!==sessionGeneration)return;data[section]={...result,items:[...rows(section),...result.items].filter((item,index,array)=>array.findIndex(other=>other.id===item.id)===index)};render();}catch(error){message(error.message);}finally{if(generation===sessionGeneration)lock(false);}});
$('loginForm').addEventListener('submit',async event=>{event.preventDefault();const button=event.target.querySelector('button');button.disabled=true;$('loginMessage').textContent='';try{await auth.login($('adminEmail').value,$('adminPassword').value);$('adminPassword').value='';}catch(error){$('loginMessage').textContent='Unable to sign in. Check your email and password.';}finally{button.disabled=false;}});
$('signOut').addEventListener('click',()=>auth.logout());
if(demo){liveStatus('Practice mode — live updates off.');$('practiceBanner').hidden=false;api=await import('./admin-demo.js');await refresh();}
else{
  $('loginPanel').hidden=false;
  try{
    auth=await import('./firebase-service.js');api=await import('./admin-api.js');
    auth.watchSession(async next=>{stopLiveUpdates();dirtyForms.clear();$('discardLiveEdits').hidden=true;sessionGeneration++;reportsController.reset();promotionsController.reset();const generation=sessionGeneration;user=next;data=null;busy=false;stockFeedback.clear();$('dashboard').hidden=true;$('actionDialog').close();pendingAction=null;resetCode();$('adminPassword').value='';$('signOut').hidden=!user;$('loginPanel').hidden=!!user;message('');if(user){try{await refresh();await startLiveUpdates();}catch(error){if(generation===sessionGeneration)message(error.code==='functions/permission-denied'?'This account does not have admin access. Sign out and use the configured admin account.':'The admin backend is not connected yet, or could not be reached. Complete the setup in ADMIN-SETUP.md, then refresh.');}}});
  }catch(error){message('Unable to connect to Firebase. Check your connection and refresh.');}
}

$('coaInventoryList').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.detail?.coaForm || event.target.closest('[data-coa-product]');if(!form||busy)return;
  if(demo)return message('COA uploads are available in the live admin dashboard.');
  const file=form.elements.pdf.files[0];if(!file||file.size>4*1024*1024)return message('Choose a PDF, PNG or JPEG no larger than 4 MB.');
  const product=rows('products').find(item=>item.id===form.dataset.coaProduct),generation=sessionGeneration;
  lock(true);message('Uploading COA…');
  try{
    const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
    if(generation!==sessionGeneration)return;
    const result=await api.manageProductCoa({action:'upload',productId:product.id,expectedVersion:form.dataset.draftCoaVersion??product.coa?.version??null,title:form.elements.title.value,lot:form.elements.lot.value,base64:btoa(binary)});
    if(generation!==sessionGeneration)return;clearDraft('coa:'+product.id);await refresh();message(result.message,true);
  }catch(error){if(generation===sessionGeneration)message(error.message||'Upload failed.');}finally{if(generation===sessionGeneration)lock(false);}
});
$('coaInventoryList').addEventListener('click',async event=>{
  const button=event.detail?.coaRemoveButton || event.target.closest('[data-remove-coa]');if(!button||busy||demo)return;
  if(!window.confirm('Remove this product’s current COA?'))return;
  const product=rows('products').find(item=>item.id===button.dataset.removeCoa),generation=sessionGeneration;lock(true);
  try{const result=await api.manageProductCoa({action:'remove',productId:product.id,expectedVersion:product.coa.version});if(generation!==sessionGeneration)return;await refresh();message(result.message,true);}catch(error){if(generation===sessionGeneration)message(error.message);}finally{if(generation===sessionGeneration)lock(false);}
});


$('dashboard').addEventListener('input',markDraft);
$('dashboard').addEventListener('change',markDraft);
$('dashboard').addEventListener('focusout',()=>setTimeout(()=>liveController?.wake(),0));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)liveController?.notify();});
window.addEventListener('online',()=>{if(user&&!demo)startLiveUpdates();});
window.addEventListener('pagehide',stopLiveUpdates);

$('discardLiveEdits').addEventListener('click',async()=>{
  if(busy||!window.confirm('Discard unsaved stock, tracking, code and COA form edits and load the latest dashboard?'))return;
  dirtyForms.clear();resetCode();lock(true);
  try{await refresh();liveStatus('Live updates on');liveController?.notify();}catch(error){message(error.message);}finally{lock(false);}
});
