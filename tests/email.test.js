import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough,Writable} from 'node:stream';
import {renderOrderEmails,PAYMENT_NOTE} from '../functions/email-templates.js';
import {buildTestMessages,sampleOrder,sendTestEmails,readHiddenKey,TEST_RECIPIENT} from '../scripts/test-email.mjs';
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
