import test from 'node:test';
import assert from 'node:assert/strict';
import { isNewShipment, sendShippingEmail } from '../functions/shipping-email.js';

const pending = {paymentStatus:'paid',fulfillmentStatus:'unfulfilled'};
const shipped = {orderNumber:'TA-EXAMPLE',customer:{name:'Sample',email:'customer@example.com'},paymentStatus:'paid',fulfillmentStatus:'shipped',status:'shipped',trackingNumber:'123456789012'};

test('only the first paid shipment sends a notification',()=>{
  assert.equal(isNewShipment(pending,shipped),true);
  assert.equal(isNewShipment(shipped,{...shipped,trackingNumber:'987654321012'}),false);
  assert.equal(isNewShipment(pending,{...shipped,paymentStatus:'unpaid'}),false);
  assert.equal(isNewShipment(pending,{...shipped,customer:{email:'a@example.com,b@example.com'}}),false);
});

test('shipping email sends inline artwork and tracking only to the order customer',async()=>{
  const result=await sendShippingEmail(shipped,{apiKey:'mock',from:'test@example.com',requestId:'stable-event-id',fetchImpl:async(url,request)=>{
    assert.equal(url,'https://api.resend.com/emails');
    assert.equal(request.headers['Idempotency-Key'],'stable-event-id');
    const body=JSON.parse(request.body);
    assert.deepEqual(body.to,['customer@example.com']);
    assert.match(body.html,/cid:order-deployed/);
    assert.match(body.text,/https:\/\/tools\.usps\.com\/go\/TrackConfirmAction\?tLabels=123456789012/);
    assert.ok(body.html.indexOf('cid:order-deployed')<body.html.indexOf('USPS tracking number'));
    for(const content of [body.html,body.text])assert.doesNotMatch(content,/sample tracking number|Payment status: Paid|Hi Sample|Thank you for being part of the mission!/i);
    assert.doesNotMatch(body.html,/<h1/);
    assert.equal(body.attachments[0].content_id,'order-deployed');
    assert.equal(Buffer.from(body.attachments[0].content,'base64').subarray(1,4).toString(),'PNG');
    return {ok:true,json:async()=>({id:'accepted-id'})};
  }});
  assert.equal(result,'accepted-id');
});
