// Plain-text campaign input only. Never accept HTML or arbitrary URLs from admins.
export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function parseContacts(text){
  if(typeof text!=='string'||text.length>500000)throw new Error('Paste or upload a list under 500 KB.');
  const candidates=text.match(/[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[^\s,;<>"()\[\]|]+/g)||[];
  const valid=[],invalid=[],seen=new Set();let duplicates=0;
  for(let email of candidates){email=email.toLowerCase().replace(/[.]+$/,'');
    if(!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(email)||email.length>254||email.split('@')[0].length>64||email.includes('..')){invalid.push(email);continue;}
    if(seen.has(email)){duplicates++;continue;}seen.add(email);valid.push(email);
  }
  if(!valid.length)throw new Error('No valid email addresses found.');
  if(valid.length>5000)throw new Error('Import no more than 5,000 contacts at once.');
  const review=valid.filter(e=>/@(?:gmil\.com|gmai\.com|gmal\.com|gmail10p\.com|yaho\.com|hotmai\.com)$/.test(e));
  return {emails:valid,invalid,duplicates,review};
}
export function validateCampaign(input){
  const read=(key,max,required=true)=>{const value=String(input[key]??'').trim();if(value.length>max||(required&&!value))throw new Error('Check '+key+' (maximum '+max+' characters).');return value;};
  const subject=read('subject',180),headline=read('headline',180),message=read('message',12000),address=read('address',350),code=read('code',30,false),deal=read('deal',240,false);
  if(/[\r\n]/.test(subject)||/[\r\n]/.test(headline)||/[\r\n]/.test(code))throw new Error('Subject, headline and code must each be one line.');
  if(code&&!/^[A-Za-z0-9_-]+$/.test(code))throw new Error('Choose a valid saved discount code.');
  return {subject,headline,message,address,code:code.toUpperCase(),deal};
}
export function renderPromotion(campaign,url,{test=false}={}){
  const c=validateCampaign(campaign),e=escapeHtml;
  const text=[test?'TEST PREVIEW — no campaign sent':'',c.headline,c.message,c.deal,c.code?'Discount code: '+c.code:'','Shop: https://www.tacticalaminos.com/#shop','Promotional email from Tactical Aminos',c.address,'Unsubscribe from promotional emails: '+url].filter(Boolean).join('\n\n');
  const html=`<!doctype html><html><body style="margin:0;background:#f4f7fc;font-family:Arial,sans-serif;color:#14213b"><main style="max-width:600px;margin:24px auto;background:#fff;border:1px solid #dce4f2;border-radius:12px;overflow:hidden"><header style="background:#0b0b0b;padding:24px;color:#fff;font-weight:bold;font-size:22px">TACTICAL AMINOS</header><div style="padding:28px">${test?'<p style="color:#805b00">TEST PREVIEW — no campaign sent</p>':''}<h1 style="font-size:26px">${e(c.headline)}</h1><div style="font-size:16px;line-height:1.7;white-space:pre-wrap">${e(c.message)}</div>${c.deal?`<p style="padding:16px;background:#edf3ff">${e(c.deal)}</p>`:''}${c.code?`<p>Discount code: <strong>${e(c.code)}</strong></p>`:''}<p><a href="https://www.tacticalaminos.com/#shop" style="display:inline-block;padding:14px 20px;background:#003b7e;color:#fff;text-decoration:none;border-radius:6px">Shop the catalog</a></p><hr style="border:0;border-top:1px solid #dce4f2"><p style="font-size:13px;line-height:1.6">Promotional email from Tactical Aminos<br>${e(c.address).replace(/\n/g,'<br>')}<br><a href="${e(url)}">Unsubscribe from promotional emails</a><br>Order and shipping emails are managed separately.</p></div></main></body></html>`;
  return {subject:(test?'[TEST] ':'')+c.subject,html,text};
}
export function eligibleContact(contact){return contact?.status==='subscribed';}
export function retryDecision({firstAttemptAt,now,status}){
  if(firstAttemptAt&&now-firstAttemptAt>=23*60*60*1000)return 'review';
  return !status||[408,409,429].includes(status)||status>=500?'retry':'failed';
}
