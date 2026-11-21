import { readFile } from 'node:fs/promises';
import { renderShippingEmail } from './email-templates.js';

let artwork;
export class ShippingEmailRejected extends Error {
  constructor(status) {
    super(`Resend rejected the shipping email (HTTP ${status}).`);
    this.retryable = status === 408 || status === 409 || status === 429 || status >= 500;
  }
}

export function isNewShipment(before, after) {
  return Boolean(before && after && before.fulfillmentStatus !== 'shipped'
    && after.fulfillmentStatus === 'shipped' && after.paymentStatus === 'paid'
    && after.status !== 'cancelled' && /^[0-9]{10,40}$/.test(after.trackingNumber ?? '')
    && typeof after.customer?.email === 'string'
    && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(after.customer.email));
}

export async function sendShippingEmail(order, {apiKey, from, requestId, test=false, fetchImpl=fetch}) {
  const {subject, html, text} = renderShippingEmail(order,{test,includeArtwork:true});
  artwork ??= await readFile(new URL('./assets/order-deployed.png',import.meta.url),'base64');
  const response = await fetchImpl('https://api.resend.com/emails', {
    method:'POST', redirect:'error', signal:AbortSignal.timeout(15000),
    headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':requestId},
    body:JSON.stringify({from,to:[order.customer.email],subject,html,text,
      attachments:[{filename:'order-deployed.png',content:artwork,content_type:'image/png',content_id:'order-deployed'}]})
  });
  if (!response.ok) throw new ShippingEmailRejected(response.status);
  const result = await response.json();
  if (typeof result.id !== 'string' || !result.id) throw new Error('Resend did not confirm the shipping email.');
  return result.id;
}
