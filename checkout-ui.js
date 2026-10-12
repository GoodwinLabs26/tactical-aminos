import { calculateQuote, validateCustomer } from './shared/checkout-core.js';
import { siteSettings } from './site-settings.js';

const $ = id => document.getElementById(id);
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[character]));
const dollars = cents => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(cents / 100);
export function initCheckout({ products: initialProducts, getService, onCatalog }) {
  let products = initialProducts, user = null, memberProfile = null, cart = new Map(), promotion = 'first', promo = null, firstOrderEligible = true, quote = null, serverQuote = null, sending = false, historyGeneration = 0;
  const records = () => products.map(product => ({ ...product, priceCents: product.priceCents ?? Math.round(product.price * 100), bulkEligible: product.bulkEligible ?? true, compoundKey: product.compoundKey || product.name.toLowerCase() }));
  const lines = () => [...cart].map(([productId, quantity]) => ({productId, quantity}));
  const feedback = (text, success = false) => { $('checkoutMessage').textContent = text; $('checkoutMessage').classList.toggle('success',success); };
  const savedKey = () => `ta-cart-v2:${user?.uid}`;
  function saveCart() { if (user) { try { sessionStorage.setItem(savedKey(),JSON.stringify(lines())); } catch {} } }
  function invalidate() { serverQuote = null; $('checkoutResult').hidden = true; feedback(''); render(); }
  function render() {
    $('cartButton').hidden = !user;
    $('cartCount').textContent = [...cart.values()].reduce((sum, quantity) => sum + quantity,0);
    $('cartEmpty').hidden = cart.size > 0;
    $('checkoutLayout').hidden = cart.size === 0;
    $('checkoutMode').textContent = siteSettings.previewCheckout ? 'Test checkout — no orders will be sent and no payment is due.' : 'Orders are submitted for manual payment. This website does not charge your card.';
    $('placeOrderButton').textContent = sending ? 'Please wait…' : siteSettings.previewCheckout ? 'Complete test checkout →' : serverQuote ? 'Submit order →' : 'Review current total →';
    $('placeOrderButton').disabled = sending || !cart.size || !user;
    $('codeControls').hidden = promotion !== 'code';
    $('firstOrderOption').hidden = !firstOrderEligible;
    document.querySelectorAll('input[name="promotion"]').forEach(input => { input.checked = input.value === promotion; });
    $('cartLines').innerHTML = lines().map(line => {
      const product = products.find(item => item.id === line.productId);
      if (!product) return '';
      const priceCents = product.priceCents ?? Math.round(product.price * 100);
      return `<article class="cart-line"><div><h3>${escape(product.name)} <span>${escape(product.strength)}</span></h3><p>${dollars(priceCents)} per vial</p><button class="inline-link small" data-remove="${product.id}">Remove</button></div><div class="quantity-control"><button type="button" data-quantity="${product.id}" data-delta="-1" aria-label="Decrease ${escape(product.name)} quantity">−</button><input type="number" min="1" max="100" step="1" value="${line.quantity}" data-quantity-input="${product.id}" aria-label="${escape(product.name)} quantity"><button type="button" data-quantity="${product.id}" data-delta="1" aria-label="Increase ${escape(product.name)} quantity">+</button></div><strong>${dollars(priceCents * line.quantity)}</strong></article>`;
    }).join('');
    if (!cart.size) { quote = null; return; }
    try {
      // A code only applies after validation; an un-applied code never changes totals.
      const selection = promotion === 'code' && !promo ? 'none' : promotion;
      quote = serverQuote || calculateQuote({ lines:lines(),promotion:selection },records(),{firstOrderEligible,promo});
      $('orderTotals').innerHTML = `<div><span>Product subtotal</span><strong>${dollars(quote.subtotalCents)}</strong></div>${quote.discounts.map(discount => `<div class="savings"><span>${escape(discount.label)}</span><strong>−${dollars(discount.amountCents)}</strong></div>`).join('')}${quote.discountCapCents > 0 ? `<div><span>Discount cap adjustment</span><strong>${dollars(quote.discountCapCents)}</strong></div>` : ''}<div><span>USPS shipping</span><strong>${dollars(quote.shippingCents)}</strong></div><div class="grand-total"><span>Total</span><strong>${dollars(quote.totalCents)}</strong></div>`;
    } catch (error) { quote = null; feedback(error.message); $('orderTotals').textContent='Total unavailable. Review your cart quantities.'; $('placeOrderButton').disabled = true; }
  }
  function addItem(productId, quantity = 1) {
    if (sending) return;
    if (!user || memberProfile?.ageConfirmed !== true) { location.hash='shop'; return; }
    const product = products.find(item => item.id === productId);
    if (!product || !Number.isInteger(quantity) || quantity < 1) return;
    const maximum = Number.isInteger(product.stockQuantity) ? Math.min(product.stockQuantity,100) : 100;
    const target = (cart.get(productId) || 0) + quantity;
    if (target > maximum) { $('cartFeedback').textContent = maximum === 0 ? 'This product is out of stock.' : `Only ${maximum} vials can be added for this product.`; return; }
    cart.set(productId,target); saveCart();invalidate();
    $('cartFeedback').textContent = `${product.name} ${product.strength} added to your cart.`;
  }
  $('cartButton').addEventListener('click', () => { location.hash='cart'; render(); });
  $('cartLines').addEventListener('click', event => {
    if (sending) return;
    const remove = event.target.closest('[data-remove]');
    const button = event.target.closest('[data-quantity]');
    if (remove) cart.delete(remove.dataset.remove);
    else if (button) {
      const id = button.dataset.quantity, next = (cart.get(id) || 0) + Number(button.dataset.delta);
      const product = products.find(item => item.id === id);
      const maximum = Number.isInteger(product?.stockQuantity) ? Math.min(product.stockQuantity,100) : 100;
      if (next > maximum) return feedback('This quantity is above the available limit.');
      if (next < 1) cart.delete(id); else cart.set(id,next);
    } else return;
    saveCart();invalidate();
  });
  $('cartLines').addEventListener('change', event => {
    const input = event.target.closest('[data-quantity-input]');
    if (!input || sending) return;
    const quantity = Number(input.value);
    const product = products.find(item => item.id === input.dataset.quantityInput);
    const maximum = Number.isInteger(product?.stockQuantity) ? Math.min(product.stockQuantity,100) : 100;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > maximum) { render();return feedback('Enter a whole-number quantity within the available limit.'); }
    cart.set(input.dataset.quantityInput,quantity);saveCart();invalidate();
  });
  document.querySelectorAll('input[name="promotion"]').forEach(input => input.addEventListener('change', () => {
    if (sending) return;
    promotion = input.value; if (promotion !== 'code') promo = null;
    $('promoMessage').textContent = '';$('promoMessage').classList.remove('success');invalidate();
  }));
  $('promoCode').addEventListener('input', () => { if (!sending) {promo=null;serverQuote=null;render();$('promoMessage').textContent='';} });
  $('applyPromoButton').addEventListener('click', async () => {
    if (!cart.size || sending) return;
    const code = $('promoCode').value.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,30}$/.test(code)) { $('promoMessage').textContent='Enter a valid code.';return; }
    const generation = historyGeneration, signature = JSON.stringify(lines());
    $('applyPromoButton').disabled=true;promo=null;serverQuote=null;$('promoMessage').classList.remove('success');
    try {
      if (siteSettings.previewCheckout) {
        const testCode=siteSettings.previewCodes.find(item=>item.code===code);
        if (!testCode) throw new Error('For test checkout, use TEST10. Real codes will be managed in the admin dashboard.');
        promo=testCode;
      } else {
        const result=await (await getService()).getOrderQuote({lines:lines(),promotion:'code',code});
        if (generation!==historyGeneration || signature!==JSON.stringify(lines()) || promotion!=='code' || $('promoCode').value.trim().toUpperCase()!==code) return;
        promo={...result.promo,active:true};serverQuote=result;firstOrderEligible=result.firstOrderEligible;
      }
      $('promoMessage').textContent=`${code} applied. The first-order discount is not combined with this code.`;
      $('promoMessage').classList.add('success');
    } catch(error) { $('promoMessage').textContent=error.message || 'Unable to validate this code.'; }
    finally { $('applyPromoButton').disabled=false;render(); }
  });
  document.querySelectorAll('input[name="paymentMethod"]').forEach(input => input.addEventListener('change', () => {
    $('paymentInstructions').textContent=input.value==='venmo' ? `Venmo: ${siteSettings.venmoHandle}` : siteSettings.paypalHandle ? `PayPal: ${siteSettings.paypalHandle}` : 'PayPal details coming soon. Available for test checkout only.';
  }));
  $('checkoutForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (sending || !user || !cart.size || !quote) return;
    const ownerUid = user.uid, generation = historyGeneration;
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value;
    const input={name:$('shippingName').value,phone:$('shippingPhone').value,shippingAddress:{street:$('shippingStreet').value,apartment:$('shippingApartment').value,city:$('shippingCity').value,state:$('shippingState').value,zip:$('shippingZip').value},paymentMethod,notes:$('orderNotes').value,researchOnlyAccepted:$('purchaseConfirmation').checked};
    try { validateCustomer(input); } catch(error) {feedback(error.message);return;}
    if (promotion==='code' && !promo) {feedback('Apply your promotional code, or choose another discount option.');return;}
    sending=true;render();feedback('');
    try {
      if (siteSettings.previewCheckout) {
        const testQuote=quote;
        $('checkoutResultContent').innerHTML=`<p class="eyebrow">TEST CHECKOUT COMPLETE</p><h2>Your checkout preview is ready.</h2><p>Test total: <strong>${dollars(testQuote.totalCents)}</strong> · ${escape(paymentMethod==='venmo'?'Venmo':'PayPal')}</p><p><strong>No order was sent. No payment is due.</strong> Your cart remains available so you can test other quantities and discounts.</p>`;
      } else {
        const api=await getService();
        if (!serverQuote) {
          const current=await api.getOrderQuote({lines:lines(),promotion,code:promo?.code || ''});
          if (generation!==historyGeneration || user?.uid!==ownerUid) return;
          serverQuote=current;firstOrderEligible=current.firstOrderEligible;
          feedback('Your current total has been verified. Review it, then select Submit order.',true);
          return;
        }
        const body={...input,lines:lines(),promotion,code:promo?.code || '',expectedQuoteId:serverQuote.quoteId};
        const signature=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(body))))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
        let request;
        try {request=JSON.parse(sessionStorage.getItem(`ta-request:${ownerUid}`) || 'null');}catch{}
        if (!request || request.signature!==signature) {request={signature,id:crypto.randomUUID()};sessionStorage.setItem(`ta-request:${ownerUid}`,JSON.stringify(request));}
        const result=await api.placeOrder({...body,requestId:request.id});
        if (generation!==historyGeneration || user?.uid!==ownerUid) return;
        sessionStorage.removeItem(`ta-request:${ownerUid}`);
        const payment=result.paymentInstructions;
        $('checkoutResultContent').innerHTML=`<p class="eyebrow">ORDER RECEIVED · AWAITING PAYMENT</p><h2>${escape(result.orderNumber)}</h2><p>Order total: <strong>${dollars(result.totalCents)}</strong></p><p>${escape(payment.method==='venmo'?'Venmo':'PayPal')}: <strong>${escape(payment.handle)}</strong></p><p>${escape(payment.note)}</p><p>This order is unpaid. Confirmation and tracking emails will become available when email delivery is connected.</p>`;
        cart.clear();saveCart();firstOrderEligible=false;promotion='none';promo=null;serverQuote=null;render();
        loadHistory();
      }
      $('checkoutResult').hidden=false;
      $('checkoutResult').scrollIntoView({behavior:'smooth',block:'start'});
    } catch(error) {
      if (generation!==historyGeneration) return;
      if(error.code==='functions/failed-precondition')serverQuote=null;
      feedback(error.message || 'Unable to submit this order. Please try again.');
    } finally {sending=false;render();}
  });
  async function loadHistory() {
    const generation=historyGeneration;
    if (!user) { $('orderHistory').innerHTML='';return; }
    if(siteSettings.previewCheckout){$('orderHistory').innerHTML='<p class="muted">Test checkouts are not saved as orders. Your real order history will appear here once ordering is connected.</p>';return;}
    $('orderHistory').textContent='Loading your orders…';
    try {
      const result=await (await getService()).getOrders(user.uid);
      if(generation!==historyGeneration)return;
      $('orderHistory').innerHTML=result.length?result.map(order=>`<article class="history-order"><div><strong>${escape(order.orderNumber)}</strong><span>${escape(order.paymentStatus || 'unpaid')} · ${escape(order.fulfillmentStatus || 'unfulfilled')}</span></div><strong>${dollars(order.totalCents)}</strong><p>${order.lines.map(line=>`${escape(line.name)} ${escape(line.strength)} × ${line.quantity}`).join(' · ')}</p></article>`).join(''):'<p class="muted">You have no orders yet.</p>';
    }catch(error){if(generation===historyGeneration)$('orderHistory').textContent='Unable to load your orders. Please try again.';}
  }
  function updateSession(nextUser,nextProfile) {
    const changed=user?.uid!==nextUser?.uid;
    const becameMember=memberProfile?.ageConfirmed!==true && nextProfile?.ageConfirmed===true;
    user=nextUser;memberProfile=nextProfile;
    if(changed){
      historyGeneration++;cart=new Map();promo=null;serverQuote=null;promotion='first';firstOrderEligible=true;
      $('checkoutForm').reset();$('checkoutResult').hidden=true;$('cartFeedback').textContent='';feedback('');
      if(user){try{const saved=JSON.parse(sessionStorage.getItem(savedKey()) || '[]');for(const line of saved){if((!siteSettings.previewCheckout || products.some(product=>product.id===line.productId))&&typeof line.productId==='string'&&Number.isInteger(line.quantity)&&line.quantity>0&&line.quantity<=100)cart.set(line.productId,line.quantity);}}catch{}}
    }
    if(user && !$('shippingName').value)$('shippingName').value=nextProfile?.name || user.displayName || '';
    render();
    if((changed || becameMember) && user && memberProfile?.ageConfirmed)loadHistory();
    if(!siteSettings.previewCheckout && user && memberProfile?.ageConfirmed && (changed || becameMember)){
      const generation=historyGeneration;
      getService().then(async api=>{
        const [catalog,stats]=await Promise.all([api.getLiveCatalog(),api.getCustomerStats(user.uid)]);
        if(generation!==historyGeneration)return;
        products=catalog.products.map(product=>({...product,price:product.priceCents/100}));
        for(const id of cart.keys())if(!products.some(product=>product.id===id))cart.delete(id);
        firstOrderEligible=stats.firstOrderClaimed!==true && !(stats.submittedOrderCount>0) && !(stats.paidOrderCount>0);
        if(!firstOrderEligible && promotion==='first')promotion='none';
        onCatalog(products);saveCart();render();
      }).catch(()=>{if(generation===historyGeneration){products=[];cart.clear();onCatalog([]);render();$('cartFeedback').textContent='The catalog is unavailable. Please try again later.';}});
    }
  }
  $('previewCodeHint').hidden=!siteSettings.previewCheckout;
  $('paymentInstructions').textContent=`Venmo: ${siteSettings.venmoHandle}`;
  $('paymentNote').textContent=siteSettings.paymentNote;
  if(!siteSettings.previewCheckout && !siteSettings.paypalHandle)$('paypalPayment').disabled=true;
  render();
  return {addItem,updateSession,render,loadHistory};
}
