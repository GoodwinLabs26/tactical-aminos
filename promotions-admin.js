const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function initPromotions({getApi,demo,getGeneration}){
  let busy=false,next=null,contacts=[],prepared=null,prepareSignature='',testId=null;
  const status=(text,ok=false)=>{$('promoStatus').textContent=text;$('promoStatus').classList.toggle('success',ok);};
  const campaign=()=>Object.fromEntries(['subject','headline','message','deal','code','address'].map(key=>[key,$('promo-'+key).value]));
  const signature=()=>JSON.stringify({campaign:campaign(),audience:$('promoAudience').value,recipients:$('promoRecipients').value});
  const call=async(action,input={})=>{
    if(demo)throw new Error('Promotions are available in the live admin dashboard. Practice mode sends nothing.');
    const api=await getApi();return api.promotionsAdmin({action,...input});
  };
  async function run(task){if(busy)return;busy=true;const generation=getGeneration();$('promotionsPanel').querySelectorAll('button').forEach(b=>b.disabled=true);try{await task(generation);}catch(e){if(generation===getGeneration())status(e.message||'Unable to complete this request.');}finally{busy=false;$('promotionsPanel').querySelectorAll('button').forEach(b=>b.disabled=false);}}
  function renderContacts(counts){
    if(counts)$('promoContactCounts').textContent=`${counts.subscribed} subscribed · ${counts.pending} pending · ${counts.unsubscribed} unsubscribed`;
    const filter=$('promoContactSearch').value.toLowerCase();
    $('promoContacts').innerHTML=contacts.filter(c=>c.email.includes(filter)).map(c=>`<div class="promo-contact"><span>${esc(c.email)}<small>${esc(c.status)}${c.review?' · check possible email typo':''}</small></span>${c.status==='pending'?`<button type="button" data-subscribe="${c.id}">Confirm permission</button>`:''}${c.status!=='unsubscribed'?`<button type="button" data-unsubscribe="${c.id}">Unsubscribe</button>`:''}</div>`).join('')||'<p>No matching contacts loaded.</p>';
    $('promoMore').hidden=!next;
  }
  async function loadContacts(append=false){const generation=getGeneration(),result=await call('contacts',{after:append?next:null});if(generation!==getGeneration())return;contacts=append?[...contacts,...result.contacts]:result.contacts;next=result.next;renderContacts(result.counts);}
  async function loadHistory(){const generation=getGeneration(),result=await call('history');if(generation!==getGeneration())return;
    $('promoHistory').innerHTML=result.campaigns.map(c=>{const n=c.counts||{},done=['accepted','failed','skipped','review'].reduce((sum,k)=>sum+(n[k]||0),0);return `<article class="record"><h3>${esc(c.subject)}</h3><p>${esc(new Date(c.createdAt).toLocaleString())} · ${esc(c.status==='queued'&&done>=c.total?'Finished':c.status)}</p><p>${c.total} recipients · ${n.accepted||0} accepted · ${n.failed||0} failed · ${n.skipped||0} skipped · ${n.review||0} need review · ${Math.max(0,c.total-done)} remaining</p>${['building','queued','draft'].includes(c.status)&&done<c.total?`<button type="button" data-cancel-promo="${c.id}">Cancel remaining</button>`:''}</article>`;}).join('')||'<p>No campaigns yet.</p>';
  }
  async function load(){if(demo){status('Practice mode: email imports and sending are disabled.');return;}await run(async generation=>{const settings=await call('settings');if(generation!==getGeneration())return;if(!$('promo-address').value)$('promo-address').value=settings.address;await loadContacts();await loadHistory();status('Promotions ready.');});}
  $('promoFile').addEventListener('change',()=>run(async generation=>{const file=$('promoFile').files[0];if(!file)return;if(file.size>500000)throw new Error('Choose a CSV or text file under 500 KB.');const text=await file.text();if(generation===getGeneration()){$('promoImportText').value=text;status('File loaded. Select Import contacts to save it.');}}));
  $('promoImport').addEventListener('click',()=>run(async generation=>{
    status('Importing contacts…');const result=await call('import',{text:$('promoImportText').value,permission:$('promoPermission').checked,source:'Mark existing customers'});if(generation!==getGeneration())return;
    await loadContacts();$('promoImportResult').textContent=`${result.added} added; ${result.existing} already saved; ${result.duplicates} duplicates removed; ${result.invalid.length} invalid. ${result.review.length?'Review possible typos: '+result.review.join(', '):''}`;
    $('promoImportText').value='';$('promoFile').value='';status('Import complete. No emails were sent.',true);
  }));
  $('promoMore').addEventListener('click',()=>run(()=>loadContacts(true)));
  $('promoContactSearch').addEventListener('input',()=>renderContacts());
  $('promoContacts').addEventListener('click',event=>{const b=event.target.closest('[data-subscribe],[data-unsubscribe]');if(!b)return;const subscribe=!!b.dataset.subscribe;if(!window.confirm(subscribe?'Confirm this contact has agreed to receive promotional emails?':'Stop promotional emails to this contact?'))return;run(async()=>{await call('contactStatus',{id:b.dataset.subscribe||b.dataset.unsubscribe,status:subscribe?'subscribed':'unsubscribed',permission:subscribe});await loadContacts();status('Contact updated.',true);});});
  $('promoSaveAddress').addEventListener('click',()=>run(async()=>{await call('saveSettings',{address:$('promo-address').value});status('Mailing address saved.',true);}));
  $('promoAudience').addEventListener('change',()=>{$('promoRecipientsLabel').hidden=$('promoAudience').value==='all';invalidate();});
  function invalidate(){prepared=null;$('promoPreviewFrame').srcdoc='';$('promoSend').hidden=true;testId=null;}
  $('promoCompose').addEventListener('input',invalidate);
  $('promoPreview').addEventListener('click',()=>run(async generation=>{const result=await call('preview',{campaign:campaign()});if(generation!==getGeneration())return;$('promoPreviewFrame').srcdoc=result.html;status('Preview ready. No emails were sent.');}));
  $('promoTest').addEventListener('click',()=>run(async generation=>{testId??=crypto.randomUUID();status('Sending a test to your signed-in email…');const result=await call('test',{campaign:campaign(),requestId:testId});if(generation===getGeneration())status(result.message,true);}));
  $('promoPrepare').addEventListener('click',()=>run(async generation=>{const sig=signature();const result=await call('prepare',{campaign:campaign(),audience:$('promoAudience').value,recipients:$('promoRecipients').value});if(generation!==getGeneration()||sig!==signature())return;prepared=result;prepareSignature=sig;$('promoSend').hidden=false;$('promoSend').textContent=`Send to ${result.count} subscribed contacts`;status(`Ready to send “${result.subject}” to ${result.count} contacts. Review the preview, then select Send.`);}));
  $('promoSend').addEventListener('click',()=>{if(!prepared||prepareSignature!==signature())return status('Content changed. Review recipients again.');if(!window.confirm(`Send “${prepared.subject}” to ${prepared.count} subscribed contacts?`))return;run(async generation=>{const result=await call('send',{id:prepared.id,confirmToken:prepared.confirmToken});if(generation!==getGeneration())return;invalidate();await loadHistory();status(result.message,true);});});
  $('promoHistory').addEventListener('click',event=>{const b=event.target.closest('[data-cancel-promo]');if(!b||!window.confirm('Cancel remaining emails? Already accepted messages cannot be recalled.'))return;run(async()=>{const result=await call('cancel',{id:b.dataset.cancelPromo});await loadHistory();status(result.message,true);});});
  $('promoReload').addEventListener('click',()=>run(async()=>{await loadContacts();await loadHistory();status('Contacts and history updated.');}));
  return {load,reset(){contacts=[];next=null;invalidate();$('promoCompose').reset();$('promoPreviewFrame').srcdoc='';$('promoContacts').textContent='';$('promoHistory').textContent='';$('promoImportText').value='';$('promoFile').value='';$('promoPermission').checked=false;$('promoImportResult').textContent='';$('promoContactCounts').textContent='';status('');}};
}
