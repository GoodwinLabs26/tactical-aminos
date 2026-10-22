// Server/local use only. These templates do not send email or read Firebase.
export const PAYMENT_NOTE = 'When sending payment through your selected app, do not include product names in the payment note or memo field.';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = cents => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD'}).format(cents / 100);
const paragraph = text => `<p style="margin:0 0 16px;line-height:1.65">${escape(text)}</p>`;

function frame(title, body, test) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title></head><body style="margin:0;background:#f3f6fc;color:#14213b;font-family:Arial,sans-serif"><table role="presentation" style="width:100%;border-collapse:collapse"><tr><td style="padding:24px 12px"><table role="presentation" style="width:100%;max-width:600px;margin:auto;border-collapse:collapse;background:#fff"><tr><td style="padding:26px 24px;background:#142b65;color:#fff;font-size:22px;font-weight:bold">TACTICAL <span style="color:#91b7ff">AMINOS</span></td></tr><tr><td style="padding:24px;font-size:14px;overflow-wrap:anywhere">${test?'<p style="margin:0 0 22px;padding:14px;background:#fff1d6;color:#6b4200;font-weight:bold;line-height:1.6">TEST EMAIL · SAMPLE DATA<br>Do not send payment or ship anything.</p>':''}<h1 style="font-size:25px;line-height:1.3;margin:0 0 20px">${escape(title)}</h1>${body}</td></tr><tr><td style="padding:18px 24px;border-top:1px solid #e2e7f1;color:#66738a;font-size:12px;line-height:1.6">${test?'Development preview sent only to the Goodwin Labs test inbox. No real records were changed.':'Tactical Aminos · Store notification'}</td></tr></table></td></tr></table></body></html>`;
}

function validate(order) {
  if (!order || !/^[A-Z0-9_-]{1,60}$/i.test(order.orderNumber || '') || !order.customer?.name || !order.customer?.email) throw new Error('Order number and customer details are required.');
  const amounts=['subtotalCents','discountCents','shippingCents','totalCents'];
  if (amounts.some(key=>!Number.isSafeInteger(order[key]) || order[key]<0) || order.subtotalCents-order.discountCents+order.shippingCents!==order.totalCents) throw new Error('Order totals do not reconcile.');
  if (!Array.isArray(order.lines) || !order.lines.length) throw new Error('Order items are required.');
  let subtotal=0;
  for (const line of order.lines) {
    if (!line.name || !Number.isSafeInteger(line.quantity) || line.quantity<1 || !Number.isSafeInteger(line.unitPriceCents) || line.unitPriceCents<0 || !Number.isSafeInteger(line.quantity*line.unitPriceCents)) throw new Error('Order items are invalid.');
    subtotal+=line.quantity*line.unitPriceCents;
  }
  if (subtotal!==order.subtotalCents || !Number.isSafeInteger(subtotal)) throw new Error('Order items do not match the subtotal.');
  if (!['venmo','paypal'].includes(order.paymentMethod)) throw new Error('Unsupported payment method.');
  if (!order.paymentInstructions?.handle?.trim()) throw new Error('Payment details are missing.');
}

export function renderOrderEmails(order, {test=false}={}) {
  validate(order);
  const itemText=order.lines.map(line=>`${line.name} ${line.strength||''} × ${line.quantity} — ${money(line.quantity*line.unitPriceCents)}`).join('\n');
  const totalsText=`Products: ${money(order.subtotalCents)}\nDiscounts: −${money(order.discountCents)}\nShipping: ${money(order.shippingCents)}\nOrder total: ${money(order.totalCents)}`;
  const summary=`<h2 style="font-size:17px;margin:24px 0 12px">Order ${escape(order.orderNumber)}</h2><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr><th scope="col" style="padding:10px 0;text-align:left;border-bottom:1px solid #e2e7f1">Item</th><th scope="col" style="padding:10px 8px;text-align:center;border-bottom:1px solid #e2e7f1">Qty</th><th scope="col" style="padding:10px 0;text-align:right;border-bottom:1px solid #e2e7f1">Amount</th></tr></thead><tbody>${order.lines.map(line=>`<tr><td style="padding:12px 0;border-bottom:1px solid #e2e7f1">${escape(line.name)} ${escape(line.strength)}</td><td style="padding:12px 8px;text-align:center;border-bottom:1px solid #e2e7f1">${line.quantity}</td><td style="padding:12px 0;text-align:right;white-space:nowrap;border-bottom:1px solid #e2e7f1">${money(line.quantity*line.unitPriceCents)}</td></tr>`).join('')}</tbody></table><table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0 24px">${[['Products',order.subtotalCents],['Discounts',-order.discountCents],['Shipping',order.shippingCents],['Order total',order.totalCents]].map(([label,cents])=>`<tr><td style="padding:6px 0;${label==='Order total'?'font-weight:bold':''}">${label}</td><td style="padding:6px 0;text-align:right;${label==='Order total'?'font-weight:bold':''}">${money(cents)}</td></tr>`).join('')}</table>`;
  const method=order.paymentMethod==='venmo'?'Venmo':'PayPal';
  const paymentText=`Payment status: Awaiting payment\nPayment method: ${method}\nPayment account: ${order.paymentInstructions.handle}\n${PAYMENT_NOTE}`;
  const payment=`<h2 style="font-size:17px;margin:24px 0 12px">Payment instructions</h2>${paragraph(`Payment status: Awaiting payment`)}${paragraph(`${method}: ${order.paymentInstructions.handle}`)}<p style="padding:14px;background:#edf3ff;line-height:1.65"><strong>Important payment note:</strong><br>${escape(PAYMENT_NOTE)}</p>`;
  const address=order.shippingAddress||{};
  const addressLines=[address.street,address.apartment,[address.city,address.state,address.zip].filter(Boolean).join(', ')].filter(Boolean);
  const addressText=addressLines.join('\n');
  const addressHtml=`<h2 style="font-size:17px;margin:24px 0 12px">Ship to</h2><p style="line-height:1.65">${escape(order.customer.name)}<br>${addressLines.map(escape).join('<br>')}</p>`;
  const testText=test?'TEST EMAIL — SAMPLE ORDER. Do not send payment or ship anything.\n\n':'';
  const customerTitle='We received your order';
  const adminTitle='New order — awaiting payment';
  return [
    {kind:'customer-confirmation',subject:`${test?'[TEST] ':''}Tactical Aminos — Order ${order.orderNumber}`,html:frame(customerTitle,paragraph(`Hi ${order.customer.name},`)+paragraph('Your order has been received and is awaiting payment. This email confirms the order, not receipt of payment.')+summary+payment+addressHtml+paragraph('Once payment is confirmed, we will prepare your order. You will receive another email with USPS tracking when it ships.'),test),text:`${testText}${customerTitle}\n\nHi ${order.customer.name},\nYour order has been received and is awaiting payment. This confirms the order, not receipt of payment.\n\nOrder ${order.orderNumber}\n${itemText}\n\n${totalsText}\n\n${paymentText}\n\nShip to:\n${order.customer.name}\n${addressText}\n\nOnce payment is confirmed, we will prepare your order. You will receive another email with USPS tracking when it ships.`},
    {kind:'admin-order-alert',subject:`${test?'[TEST] ':''}Tactical Aminos — New order ${order.orderNumber}`,html:frame(adminTitle,paragraph(`${order.customer.name} placed an order.`)+paragraph('Verify the full payment in Venmo or PayPal before marking this order paid. Inventory and referral credit update when payment is recorded.')+summary+paragraph(`Payment method: ${method}`)+paragraph(`Customer email: ${order.customer.email}`)+(order.customer.phone?paragraph(`Phone: ${order.customer.phone}`):'')+addressHtml+(order.notes?`<h2 style="font-size:17px;margin:24px 0 12px">Customer note</h2>${paragraph(order.notes)}`:'')+paragraph('Open your admin dashboard to manage this order.'),test),text:`${testText}${adminTitle}\n\nOrder ${order.orderNumber}\n${order.customer.name} placed an order.\nVerify the full payment in Venmo or PayPal before marking this order paid. Inventory and referral credit update when payment is recorded.\n\n${itemText}\n\n${totalsText}\n\nPayment method: ${method}\nCustomer email: ${order.customer.email}\nPhone: ${order.customer.phone||'Not provided'}\n\nShip to:\n${order.customer.name}\n${addressText}\n\nCustomer note: ${order.notes||'None'}\n\nOpen your admin dashboard to manage this order.`}
  ];
}

export function renderShippingEmail(order,{test=false}={}) {
  if(!order || !/^[A-Z0-9_-]{1,60}$/i.test(order.orderNumber||'') || !order.customer?.name)throw new Error('Order number and customer name are required.');
  if(order.paymentStatus!=='paid'||order.fulfillmentStatus!=='shipped'||order.status==='cancelled')throw new Error('Shipping emails require a paid order marked shipped.');
  if(typeof order.trackingNumber!=='string'||!/^[0-9]{10,40}$/.test(order.trackingNumber))throw new Error('A valid USPS tracking number is required.');
  const title='Your order has been marked shipped';
  const url=`https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(order.trackingNumber)}`;
  const sample=test?'This is a sample tracking number. It does not track a real shipment.':'';
  const body=paragraph(`Hi ${order.customer.name},`)+paragraph(`Order ${order.orderNumber} has been marked shipped with USPS.`)+paragraph('Payment status: Paid')+`<h2 style="font-size:17px;margin:24px 0 12px">USPS tracking number</h2><p style="line-height:1.65;overflow-wrap:anywhere;word-break:break-all">${escape(order.trackingNumber)}</p><p style="margin:22px 0"><a href="${url}" style="display:inline-block;background:#1548ed;color:#fff;padding:14px 20px;border-radius:6px;text-decoration:none;font-weight:bold">View USPS tracking</a></p>`+(test?paragraph(sample):'')+paragraph('USPS tracking may take time to update after the shipping label is created. Check USPS for the latest delivery estimate.');
  return {kind:'shipping-confirmation',subject:`${test?'[TEST] ':''}Tactical Aminos — Shipping update ${order.orderNumber}`,html:frame(title,body,test),text:`${test?'TEST EMAIL — SAMPLE SHIPMENT. No real shipment was created.\n\n':''}${title}\n\nHi ${order.customer.name},\nOrder ${order.orderNumber} has been marked shipped with USPS.\nPayment status: Paid\n\nUSPS tracking number: ${order.trackingNumber}\nView USPS tracking: ${url}\n${sample}\n\nUSPS tracking may take time to update after the shipping label is created. Check USPS for the latest delivery estimate.`};
}

export function renderLowStockEmail(notice,{test=false}={}) {
  if(!notice || typeof notice.productName!=='string' || !notice.productName.trim() || /[\r\n]/.test(notice.productName) || typeof (notice.strength??'')!=='string' || /[\r\n]/.test(notice.strength||''))throw new Error('A product name and valid strength are required.');
  if(!Number.isSafeInteger(notice.stockQuantity)||notice.stockQuantity<0||!Number.isSafeInteger(notice.threshold)||notice.threshold<0||notice.stockQuantity>notice.threshold)throw new Error('A low-stock notice must have a valid count at or below its alert level.');
  const alertAt=new Date(notice.createdAt);
  if(!notice.createdAt||!Number.isFinite(alertAt.getTime()))throw new Error('The stock alert timestamp is required.');
  const name=[notice.productName,notice.strength].filter(Boolean).join(' ');
  const count=notice.stockQuantity===0?'Out of stock — no vials left':`Only ${notice.stockQuantity} ${notice.stockQuantity===1?'vial':'vials'} left`;
  const time=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',dateStyle:'medium',timeStyle:'short'}).format(alertAt)+' Eastern';
  const title=notice.stockQuantity===0?'Product is out of stock':'Low-stock alert';
  const body=`<h2 style="font-size:19px;margin:0 0 14px">${escape(name)}</h2><p style="font-size:24px;font-weight:bold;line-height:1.4;color:#9d5b12;margin:0 0 22px">${count}</p>`+paragraph(`Alert recorded: ${time}`)+paragraph('This was the vial count when the alert was created. Open Inventory in your admin dashboard to check the current count and record any restock.')+(test?paragraph('Sample notice only. No inventory was changed.'): '');
  return {kind:'low-stock-alert',subject:`${test?'[TEST] ':''}Tactical Aminos — ${notice.stockQuantity===0?'Out of stock':'Low stock'}: ${name}`,html:frame(title,body,test),text:`${test?'TEST EMAIL — SAMPLE STOCK ALERT. No inventory was changed.\n\n':''}${title}\n\n${name}\n${count}\n\nAlert recorded: ${time}\nThis was the vial count when the alert was created. Open Inventory in your admin dashboard to check the current count and record any restock.`};
}
