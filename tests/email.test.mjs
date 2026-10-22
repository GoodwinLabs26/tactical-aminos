import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough,Writable} from 'node:stream';
import {renderOrderEmails,renderShippingEmail,renderLowStockEmail,PAYMENT_NOTE} from '../functions/email-templates.js';
import {buildTestMessages,sampleOrder,sendTestEmails,readHiddenKey,TEST_RECIPIENT,sampleShipment,sampleStockNotice} from '../scripts/test-email.mjs';
import {siteSettings} from '../site-settings.js';

const fakeKey='re_unit_test_not_a_real_key';
test('sample emails go only to the test inbox and clearly distinguish an order from payment',()=>{
  const messages=buildTestMessages();assert.equal(messages.length,2);
  for(const message of messages){
    assert.deepEqual(message.to,[TEST_RECIPIENT]);assert.equal(message.from,'Tactical Aminos <onboarding@resend.dev>');assert.match(message.subject,/^\[TEST\]/);
    assert.match(message.html,/Do not send payment or ship anything/);assert.match(message.text,/Do not send payment or ship anything/);
    assert.equal(message.cc,undefined);assert.equal(message.bcc,undefined);assert.equal(message.reply_to,undefined);assert.doesNotMatch(JSON.stringify(message),/@Mark-Williams-1389|TacticalAminos@gmail.com/);
  }
  assert.match(messages[0].text,/not receipt of payment/);assert.match(messages[1].text,/Verify the full payment/);
  assert.match(messages[0].text,/Order total: \$82\.70/);assert.ok(messages[0].html.includes(PAYMENT_NOTE));assert.ok(messages[0].text.includes(PAYMENT_NOTE));assert.equal(PAYMENT_NOTE,siteSettings.paymentNote);
});
test('templates escape customer input and reject mismatched totals and invalid order lines',()=>{
  const order=structuredClone(sampleOrder);order.customer.name='<script>alert("name")</script>';order.notes='<img src=x onerror=alert(1)>';
  const rendered=renderOrderEmails(order,{test:true});assert.match(rendered[0].html,/&lt;script&gt;/);assert.doesNotMatch(rendered[0].html,/<script>/);assert.doesNotMatch(rendered[1].html,/<img src=x/);
  assert.throws(()=>renderOrderEmails({...sampleOrder,totalCents:1}),/reconcile/);
  const invalid=structuredClone(sampleOrder);invalid.lines[0].quantity=-1;assert.throws(()=>renderOrderEmails(invalid),/invalid/);
  assert.throws(()=>renderOrderEmails({...sampleOrder,paymentMethod:'card'}),/Unsupported/);
  assert.throws(()=>renderOrderEmails({...sampleOrder,paymentInstructions:{handle:''}}),/missing/);
});
test('sender posts a single two-email batch with an idempotency key and never accepts a recipient argument',async()=>{
  let calls=0;
  const ids=await sendTestEmails(fakeKey,{requestId:'same-request',fetchImpl:async(url,options)=>{
    calls++;assert.equal(url,'https://api.resend.com/emails/batch');assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,`Bearer ${fakeKey}`);assert.equal(options.headers['Idempotency-Key'],'tactical-email-test-same-request');assert.ok(options.signal instanceof AbortSignal);
    const body=JSON.parse(options.body);assert.deepEqual(body,buildTestMessages());assert.equal(body.length,2);assert.ok(body.every(message=>message.to.length===1&&message.to[0]===TEST_RECIPIENT));
    return {ok:true,json:async()=>({data:[{id:'email-one'},{id:'email-two'}]})};
  }});
  assert.deepEqual(ids,['email-one','email-two']);assert.equal(calls,1);
});
test('invalid keys never reach the network',async()=>{
  let calls=0;for(const key of ['',undefined,'not-a-key','re_bad\nheader'])await assert.rejects(sendTestEmails(key,{fetchImpl:async()=>{calls++;}}),/API key/);assert.equal(calls,0);
});
test('provider errors never claim success or expose credentials',async()=>{
  for(const status of [401,403,429,500])await assert.rejects(sendTestEmails(fakeKey,{fetchImpl:async()=>({ok:false,status,json:async()=>({message:fakeKey})})}),error=>error.message.includes(`HTTP ${status}`)&&!error.message.includes(fakeKey));
  await assert.rejects(sendTestEmails(fakeKey,{fetchImpl:async()=>{throw new Error(fakeKey);}}),error=>/Could not confirm/.test(error.message)&&!error.message.includes(fakeKey));
  await assert.rejects(sendTestEmails(fakeKey,{fetchImpl:async()=>({ok:true,json:async()=>({data:[{id:'only-one'}]})})}),/did not confirm both/);
});
function terminal(){const input=new PassThrough();input.isTTY=true;input.isRaw=false;input.setRawMode=value=>{input.isRaw=value;};let displayed='';const output=new Writable({write(chunk,encoding,callback){displayed+=chunk.toString();callback();}});return {input,output,getDisplayed:()=>displayed};}
test('hidden key entry accepts paste/backspace, restores the terminal, and never echoes the key',async()=>{
  const {input,output,getDisplayed}=terminal();const pending=readHiddenKey(input,output);input.write(fakeKey+'X\u007f\r');assert.equal(await pending,fakeKey);assert.equal(input.isRaw,false);assert.equal(input.listenerCount('data'),0);assert.doesNotMatch(getDisplayed(),/re_unit_test/);input.destroy();
});
test('cancelled or noninteractive key entry never proceeds to sending',async()=>{
  const {input,output,getDisplayed}=terminal();const pending=readHiddenKey(input,output);input.write(fakeKey+'\u0003');await assert.rejects(pending,/Cancelled/);assert.equal(input.isRaw,false);assert.doesNotMatch(getDisplayed(),/re_unit_test/);input.destroy();assert.throws(()=>readHiddenKey({isTTY:false},output),/VS Code/);
});

test('shipping and stock samples are separately selectable and can only reach the test inbox',async()=>{
  const messages=buildTestMessages('alerts');assert.equal(messages.length,2);
  for(const message of messages){assert.deepEqual(message.to,[TEST_RECIPIENT]);assert.match(message.subject,/^\[TEST\]/);assert.equal(message.cc,undefined);assert.equal(message.bcc,undefined);assert.equal(message.from,'Tactical Aminos <onboarding@resend.dev>');}
  assert.match(messages[0].subject,/Shipping update/);assert.match(messages[1].subject,/Low stock/);
  assert.match(messages[0].text,/sample tracking number/);assert.match(messages[1].text,/No inventory was changed/);
  let calls=0;await sendTestEmails(fakeKey,{group:'alerts',fetchImpl:async(url,options)=>{calls++;assert.deepEqual(JSON.parse(options.body),messages);return {ok:true,json:async()=>({data:[{id:'shipping-test'},{id:'stock-test'}]})};}});assert.equal(calls,1);
  await assert.rejects(sendTestEmails(fakeKey,{group:'customers',fetchImpl:async()=>{calls++;}}),/Choose orders or alerts/);assert.equal(calls,1);
});
test('shipping emails require paid/shipped status and include only the validated USPS tracking URL',()=>{
  const email=renderShippingEmail(sampleShipment,{test:true});const link='https://tools.usps.com/go/TrackConfirmAction?tLabels='+sampleShipment.trackingNumber;
  assert.ok(email.html.includes(`href="${link}"`));assert.ok(email.text.includes(link));assert.match(email.text,/Payment status: Paid/);assert.doesNotMatch(email.text,/Payment account|awaiting payment/i);
  for(const overrides of [{paymentStatus:'unpaid'},{fulfillmentStatus:'unfulfilled'},{status:'cancelled'}])assert.throws(()=>renderShippingEmail({...sampleShipment,...overrides}),/paid order marked shipped/);
  for(const trackingNumber of ['', '123', '1'.repeat(41), '1234567890\n','https://untrusted.example/12345','1234567890" onclick="alert(1)'])assert.throws(()=>renderShippingEmail({...sampleShipment,trackingNumber}),/tracking number/);
  const escaped=renderShippingEmail({...sampleShipment,customer:{name:'<img src=x onerror=alert(1)>'}});assert.match(escaped.html,/&lt;img/);assert.doesNotMatch(escaped.html,/<img src=x/);
});
test('low-stock emails use plain counts, singular and zero wording, and identify historical stock readings',()=>{
  for(const [stockQuantity,expected]of [[10,'Only 10 vials left'],[1,'Only 1 vial left'],[0,'Out of stock — no vials left']]){
    const email=renderLowStockEmail({...sampleStockNotice,stockQuantity},{test:true});assert.ok(email.html.includes(expected));assert.ok(email.text.includes(expected));assert.match(email.text,/when the alert was created/);assert.match(email.text,/Oct 22, 2026, 3:00 PM Eastern/);
  }
  const escaped=renderLowStockEmail({...sampleStockNotice,productName:'KPV <test>'});assert.match(escaped.html,/KPV &lt;test&gt;/);assert.doesNotMatch(escaped.html,/KPV <test>/);
  for(const overrides of [{stockQuantity:-1},{stockQuantity:1.5},{stockQuantity:11},{threshold:-1},{createdAt:'not-a-date'},{productName:'KPV\nBcc: other@example.com'}])assert.throws(()=>renderLowStockEmail({...sampleStockNotice,...overrides}));
});
