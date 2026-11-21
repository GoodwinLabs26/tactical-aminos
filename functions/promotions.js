import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {onCall,onRequest,HttpsError} from 'firebase-functions/v2/https';
import {onDocumentCreated} from 'firebase-functions/v2/firestore';
import {onSchedule} from 'firebase-functions/v2/scheduler';
import {defineSecret,defineString} from 'firebase-functions/params';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {parseContacts,validateCampaign,renderPromotion,eligibleContact,retryDecision,escapeHtml} from './promotions-core.js';
const key=defineSecret('RESEND_API_KEY'),from=defineString('SHIPPING_EMAIL_FROM');
const options={region:'us-central1',memory:'256MiB',timeoutSeconds:120,maxInstances:3};
const hash=value=>createHash('sha256').update(value).digest('hex');
const base='https://us-central1-tactical-aminos.cloudfunctions.net/promotionUnsubscribe';
const stamp=()=>new Date().toISOString();
export async function requirePromotionAdmin(db,auth){
  if(!auth?.uid)throw new HttpsError('unauthenticated','Sign in first.');
  const admin=(await db.doc('config/admin').get()).data();
  if(admin?.uid!==auth.uid&&!(Array.isArray(admin?.additionalUids)&&admin.additionalUids.includes(auth.uid)))throw new HttpsError('permission-denied','Admin access required.');
}
function publicContact(doc){const d=doc.data();return {id:doc.id,email:d.email,status:d.status,review:d.review||false,source:d.source,updatedAt:d.updatedAt};}
async function providerSend(payload,id){
  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+key.value(),'Content-Type':'application/json','Idempotency-Key':id},body:JSON.stringify(payload)});
    if(!response.ok){const error=new Error('Email provider did not accept the message (HTTP '+response.status+').');error.status=response.status;throw error;}
    const data=await response.json();if(typeof data.id!=='string')throw new Error('Provider acceptance could not be confirmed.');return data.id;
  }catch(error){if(error.status)throw error;throw new Error('Provider acceptance could not be confirmed.');}
}
function envelope(campaign,email,url,test=false){return {from:from.value(),to:[email],reply_to:'tacticalaminos@gmail.com',...renderPromotion(campaign,url,{test}),...(!test?{headers:{'List-Unsubscribe':'<'+url+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}}:{})};}
async function getCampaign(db,input){
  let c;try{c=validateCampaign(input);}catch(e){throw new HttpsError('invalid-argument',e.message);}
  if(c.code){const code=(await db.doc('discountCodes/'+c.code).get()).data();const time=Date.now();if(!code?.active||code.code!==c.code||(code.expiresAt?.toMillis?.()??code.expiresAtMs??Infinity)<=time||(code.startsAt?.toMillis?.()??code.startsAtMs??0)>time)throw new HttpsError('failed-precondition','Choose an active saved discount code.');}
  return c;
}
export const promotionsAdmin=onCall({...options,secrets:[key]},async request=>{
  const db=getFirestore();await requirePromotionAdmin(db,request.auth);
  const input=request.data||{},action=input.action;
  if(action==='contacts'){
    let query=db.collection('marketingContacts').orderBy('__name__').limit(100);
    if(input.after&&/^[a-f0-9]{64}$/.test(input.after))query=query.startAfter(input.after);
    const [page,sub,pending,unsub]=await Promise.all([query.get(),db.collection('marketingContacts').where('status','==','subscribed').count().get(),db.collection('marketingContacts').where('status','==','pending').count().get(),db.collection('marketingContacts').where('status','==','unsubscribed').count().get()]);
    return {contacts:page.docs.map(publicContact),next:page.size===100?page.docs.at(-1).id:null,counts:{subscribed:sub.data().count,pending:pending.data().count,unsubscribed:unsub.data().count}};
  }
  if(action==='import'){
    let parsed;try{parsed=parseContacts(input.text);}catch(e){throw new HttpsError('invalid-argument',e.message);}
    const approved=input.permission===true,source=String(input.source||'Admin import').slice(0,100);let added=0,existing=0;
    // Transactions preserve an unsubscribe that races with an import. No automatic resubscriptions.
    for(let offset=0;offset<parsed.emails.length;offset+=150){const emails=parsed.emails.slice(offset,offset+150);const result=await db.runTransaction(async tx=>{
      const refs=emails.map(email=>db.doc('marketingContacts/'+hash(email))),docs=await tx.getAll(...refs);let fresh=0,old=0;
      docs.forEach((doc,i)=>{if(doc.exists){old++;return;}fresh++;tx.create(refs[i],{email:emails[i],status:approved&&!parsed.review.includes(emails[i])?'subscribed':'pending',review:parsed.review.includes(emails[i]),source,consentConfirmedBy:approved?request.auth.uid:null,consentConfirmedAt:approved?stamp():null,token:randomBytes(32).toString('hex'),createdAt:stamp(),updatedAt:stamp()});});return {fresh,old};});added+=result.fresh;existing+=result.old;}
    return {added,existing,duplicates:parsed.duplicates,invalid:parsed.invalid,review:parsed.review};
  }
  if(action==='contactStatus'){
    if(!/^[a-f0-9]{64}$/.test(input.id)||!['subscribed','unsubscribed'].includes(input.status))throw new HttpsError('invalid-argument','Choose a contact and status.');
    if(input.status==='subscribed'&&input.permission!==true)throw new HttpsError('failed-precondition','Confirm promotional email permission first.');
    await db.runTransaction(async tx=>{const ref=db.doc('marketingContacts/'+input.id),doc=await tx.get(ref);if(!doc.exists)throw new HttpsError('not-found','Contact not found.');if(doc.data().status==='unsubscribed'&&input.status==='subscribed')throw new HttpsError('failed-precondition','An unsubscribed contact cannot be reactivated here.');tx.update(ref,{status:input.status,updatedAt:stamp(),...(input.status==='subscribed'?{consentConfirmedBy:request.auth.uid,consentConfirmedAt:stamp()}:{})});});return {message:'Contact updated.'};
  }
  if(action==='settings')return {address:(await db.doc('config/promotions').get()).data()?.address||''};
  if(action==='saveSettings'){
    const address=String(input.address||'').trim();if(address.length<5||address.length>350)throw new HttpsError('invalid-argument','Enter the business mailing address (up to 350 characters).');
    await db.doc('config/promotions').set({address},{merge:true});return {message:'Mailing address saved.'};
  }
  if(action==='history'){
    const page=await db.collection('promotionCampaigns').orderBy('createdAt','desc').limit(30).get();
    const campaigns=page.docs.map(doc=>{const d=doc.data();return {id:doc.id,subject:d.subject,createdAt:d.createdAt,status:d.status,total:d.total,counts:d.counts||{}};});
    return {campaigns};
  }
  if(action==='preview'||action==='test'||action==='prepare'){
    const raw=input.campaign||{};
    const campaign=await getCampaign(db,(action==='preview'||action==='test')&&!String(raw.address||'').trim()?{...raw,address:'[Business mailing address must be added before sending a campaign]'}:raw);
    if(action==='preview')return renderPromotion(campaign,'https://www.tacticalaminos.com/#account',{test:true});
    if(action==='test'){
      const email=request.auth.token?.email;if(!email)throw new HttpsError('failed-precondition','Your signed-in account needs an email.');
      if(!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId||''))throw new HttpsError('invalid-argument','Reload and try again.');
      const id=await providerSend(envelope(campaign,email,'https://www.tacticalaminos.com/#account',true),'promotion-test-'+hash(request.auth.uid+input.requestId));
      return {message:'Resend accepted the test email for '+email+'.',providerId:id};
    }
    if(!['all','one','custom'].includes(input.audience))throw new HttpsError('invalid-argument','Choose a recipient group.');
    let selected;
    if(input.audience==='all')selected=await db.collection('marketingContacts').where('status','==','subscribed').limit(5001).get();
    else{
      let parsed;try{parsed=parseContacts(input.recipients||'');}catch(e){throw new HttpsError('invalid-argument',e.message);}
      if(input.audience==='one'&&parsed.emails.length!==1)throw new HttpsError('invalid-argument','Enter exactly one recipient.');
      if(parsed.invalid.length)throw new HttpsError('invalid-argument','Remove invalid recipient addresses.');
      const docs=[];for(let i=0;i<parsed.emails.length;i+=150)docs.push(...await db.getAll(...parsed.emails.slice(i,i+150).map(email=>db.doc('marketingContacts/'+hash(email)))));
      selected={docs:docs.filter(doc=>doc.exists&&eligibleContact(doc.data()))};
      if(selected.docs.length!==parsed.emails.length)throw new HttpsError('failed-precondition','Every selected recipient must already be an imported, subscribed contact.');
    }
    if(!selected.docs.length||selected.docs.length>5000)throw new HttpsError('failed-precondition','Choose between 1 and 5,000 subscribed contacts.');
    const id=randomUUID(),ref=db.doc('promotionCampaigns/'+id),ids=selected.docs.map(doc=>doc.id);
    await ref.create({...campaign,createdAt:stamp(),createdBy:request.auth.uid,status:'draft',contactIds:ids,total:ids.length,counts:{accepted:0,failed:0,skipped:0,review:0},confirmToken:randomBytes(24).toString('hex')});
    const d=(await ref.get()).data();return {id,confirmToken:d.confirmToken,count:ids.length,subject:campaign.subject};
  }
  if(action==='send'){
    if(!/^[a-zA-Z0-9-]{36}$/.test(input.id||''))throw new HttpsError('invalid-argument','Prepare a campaign first.');
    const ref=db.doc('promotionCampaigns/'+input.id);
    await db.runTransaction(async tx=>{const doc=await tx.get(ref),d=doc.data();if(!d||d.createdBy!==request.auth.uid||d.confirmToken!==input.confirmToken)throw new HttpsError('permission-denied','Prepare this campaign with your account first.');if(d.status==='draft')tx.update(ref,{status:'building',queuedAt:stamp()});});
    await buildQueue(db,ref,input.id);return {message:'Campaign queued. Sending continues in the background. Check history for results.'};
  }
  if(action==='cancel'){
    if(!/^[a-zA-Z0-9-]{36}$/.test(input.id||''))throw new HttpsError('invalid-argument','Choose a campaign.');
    await db.doc('promotionCampaigns/'+input.id).update({status:'cancelled'});return {message:'Campaign cancelled. Messages already accepted by Resend cannot be recalled.'};
  }
  throw new HttpsError('invalid-argument','Unknown promotions action.');
});



export async function buildQueue(db,ref,id){
  const d=(await ref.get()).data();if(!d||d.status!=='building')return;
  // Create-only deterministic jobs let the callable or scheduler resume a partial queue.
  for(let start=0;start<d.contactIds.length;start+=200){
    const ids=d.contactIds.slice(start,start+200);
    await db.runTransaction(async tx=>{
      const current=await tx.get(ref);if(current.data().status!=='building')return;
      const refs=ids.map(contactId=>db.doc('promotionDeliveries/'+id+'_'+contactId)),docs=await tx.getAll(...refs);
      docs.forEach((doc,i)=>{if(!doc.exists)tx.create(refs[i],{campaignId:id,contactId:ids[i],status:'pending',createdAt:stamp(),attempts:0});});
    });
  }
  await db.runTransaction(async tx=>{const doc=await tx.get(ref);if(doc.data().status==='building')tx.update(ref,{status:'queued'});});
}

async function finishDelivery(db,ref,status,extra={}){
  await db.runTransaction(async tx=>{
    const doc=await tx.get(ref);if(!doc.exists||!['pending','sending'].includes(doc.data().status))return;
    tx.update(ref,{...extra,status});
    tx.update(db.doc('promotionCampaigns/'+doc.data().campaignId),{['counts.'+status]:FieldValue.increment(1)});
  });
}

// A GET shows a confirmation page (email scanners must not unsubscribe people).
// POST also supports the standard one-click unsubscribe header.
export const promotionUnsubscribe=onRequest({...options,maxInstances:5},async(req,res)=>{
  res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');res.set('X-Content-Type-Options','nosniff');res.set('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  if(!['GET','POST'].includes(req.method)){res.status(405).send('Method not allowed');return;}
  const id=String(req.query.c||''),token=String(req.query.t||'');
  if(!/^[a-f0-9]{64}$/.test(id)||!/^[a-f0-9]{64}$/.test(token)){res.status(400).send('Invalid unsubscribe link.');return;}
  const ref=getFirestore().doc('marketingContacts/'+id);const doc=await ref.get();
  if(!doc.exists||doc.data().token!==token){res.status(400).send('Invalid unsubscribe link.');return;}
  if(req.method==='POST')await ref.update({status:'unsubscribed',updatedAt:stamp()});
  const done=req.method==='POST'||doc.data().status==='unsubscribed';
  res.status(200).type('html').send(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tactical Aminos email preferences</title><body style="font:16px Arial;max-width:540px;padding:30px;margin:auto"><h1>Tactical Aminos</h1><h2>${done?'You are unsubscribed':'Unsubscribe from promotions'}</h2><p>${done?'You will no longer receive promotional emails. Order and shipping emails are unaffected.':'Select the button below to stop promotional emails.'}</p>${done?'':`<form method="post" action="?c=${escapeHtml(id)}&amp;t=${escapeHtml(token)}"><button style="font:inherit;padding:12px" type="submit">Unsubscribe</button></form>`}</body></html>`);
});

// Low-rate queue shares the existing Resend account with order emails. Never
// automatically retry ambiguous sends beyond Resend's 24-hour idempotency window.
export const sendPromotionQueue=onSchedule({...options,timeoutSeconds:120,maxInstances:1,secrets:[key],schedule:'every 1 minutes',timeZone:'Etc/UTC'},async()=>{
  const db=getFirestore(),lock=db.doc('promotionLocks/worker'),lease=randomUUID(),now=Date.now(),deadline=Date.now()+90000;
  const acquired=await db.runTransaction(async tx=>{const doc=await tx.get(lock);if((doc.data()?.until||0)>now)return false;tx.set(lock,{until:now+150000,lease});return true;});if(!acquired)return;
  try{
    const incomplete=await db.collection('promotionCampaigns').where('status','==','building').limit(2).get();
    for(const campaign of incomplete.docs)await buildQueue(db,campaign.ref,campaign.id);
    const rows=await db.collection('promotionDeliveries').where('status','in',['pending','sending']).limit(100).get();let processed=0;
    for(const row of rows.docs){if(processed>=20||Date.now()>deadline)break;let job=row.data();if((job.retryAt||0)>Date.now())continue;
      const campaign=(await db.doc('promotionCampaigns/'+job.campaignId).get()).data();if(!campaign)continue;
      if(campaign.status==='cancelled'){await finishDelivery(db,row.ref,'skipped');continue;}if(campaign.status!=='queued')continue;
      const contact=(await db.doc('marketingContacts/'+job.contactId).get()).data();
      if(!eligibleContact(contact)){await finishDelivery(db,row.ref,'skipped');continue;}
      if(job.firstAttemptAt&&Date.now()-job.firstAttemptAt>=23*3600000){await finishDelivery(db,row.ref,'review',{error:'Acceptance uncertain after retry window. Check Resend before sending again.'});continue;}
      processed++;
      const url=base+'?c='+job.contactId+'&t='+contact.token;
      // Freeze the payload (including sender) before its first network attempt.
      // Contact opt-out is still rechecked before every attempt.
      const payload=job.payload||envelope(campaign,contact.email,url);
      await row.ref.update({status:'sending',payload,firstAttemptAt:job.firstAttemptAt||Date.now(),attempts:FieldValue.increment(1)});
      let accepted;
      try{accepted=await providerSend(payload,'promotion-'+row.id);}
      catch(e){
        const decision=retryDecision({firstAttemptAt:job.firstAttemptAt||Date.now(),now:Date.now(),status:e.status});
        if(decision==='retry')await row.ref.update({status:'pending',retryAt:Date.now()+Math.min(3600000,60000*2**Math.min(job.attempts||0,6)),error:e.message});
        else await finishDelivery(db,row.ref,decision,{error:e.message});
        if([401,403,429].includes(e.status))break;
      }
      if(accepted)await finishDelivery(db,row.ref,'accepted',{providerId:accepted,acceptedAt:stamp(),error:FieldValue.delete()});
      await new Promise(resolve=>setTimeout(resolve,1100));
    }
  }finally{await db.runTransaction(async tx=>{const doc=await tx.get(lock);if(doc.data()?.lease===lease)tx.delete(lock);});}
});


// Runs after the existing protected membership profile is first saved.
// Retry-safe: a signup never overwrites an imported contact or an unsubscribe.
export const addSignupEmailContact=onDocumentCreated({...options,document:'users/{uid}',retry:true},async event=>{
  if(!event.data)return;
  const profile=event.data.data();
  if(profile?.ageConfirmed!==true||profile?.researchOnlyAccepted!==true||typeof profile.email!=='string')return;
  let parsed;try{parsed=parseContacts(profile.email);}catch{return;}
  const email=profile.email.trim().toLowerCase();
  if(parsed.emails.length!==1||parsed.emails[0]!==email)return;
  const db=getFirestore(),ref=db.doc('marketingContacts/'+hash(email));
  await db.runTransaction(async tx=>{
    const existing=await tx.get(ref);if(existing.exists)return;
    tx.create(ref,{email,status:parsed.review.includes(email)?'pending':'subscribed',review:parsed.review.includes(email),source:'Website signup',signupUid:event.params.uid,enrollmentMethod:'automatic-at-signup',token:randomBytes(32).toString('hex'),createdAt:stamp(),updatedAt:stamp()});
  });
});
