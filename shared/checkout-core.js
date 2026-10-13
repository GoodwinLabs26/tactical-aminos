export class CheckoutError extends Error {
  constructor(code, message) { super(message); this.name = 'CheckoutError'; this.code = code; }
}
export const SHIPPING_CENTS = 800;
export const RULES_VERSION = '2026-10-09';
export function normalizeLines(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > 50) throw new CheckoutError('invalid-argument', 'Your cart must contain between 1 and 50 product lines.');
  const seen = new Set();
  return input.map(line => {
    if (!line || typeof line !== 'object' || Object.keys(line).some(key => !['productId', 'quantity'].includes(key)) || !/^[a-z0-9-]{1,80}$/.test(line.productId || '') || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 100 || seen.has(line.productId)) throw new CheckoutError('invalid-argument', 'Invalid cart quantities or product IDs.');
    seen.add(line.productId);
    return { productId: line.productId, quantity: line.quantity };
  }).sort((a, b) => a.productId.localeCompare(b.productId));
}
export function calculateQuote(input, productRecords, { firstOrderEligible = true, promo = null, enforceStock = false } = {}) {
  const normalized = normalizeLines(input.lines);
  const promotion = input.promotion || 'none';
  if (!['none', 'first', 'code'].includes(promotion)) throw new CheckoutError('invalid-argument', 'Select either first-order discount, one promotional code, or no promotion.');
  const records = new Map(productRecords.map(product => [product.id, product]));
  const lines = normalized.map(line => {
    const product = records.get(line.productId);
    if (!product || product.published === false || !Number.isSafeInteger(product.priceCents) || product.priceCents < 1 || product.priceCents > 10000000) throw new CheckoutError('failed-precondition', 'A product is unavailable. Refresh your catalog.');
    if (enforceStock && (!Number.isInteger(product.stockQuantity) || product.stockQuantity < 0)) throw new CheckoutError('failed-precondition', `Inventory is not configured for ${product.name}.`);
    if (Number.isInteger(product.stockQuantity) && product.stockQuantity < line.quantity) throw new CheckoutError('failed-precondition', `${product.name} ${product.strength}: not enough stock for this quantity.`);
    return { productId: line.productId, name: product.name, strength: product.strength, quantity: line.quantity, unitPriceCents: product.priceCents, lineTotalCents: product.priceCents * line.quantity, bulkEligible: product.bulkEligible === true, compoundKey: product.compoundKey || product.id };
  });
  const subtotalCents = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const discounts = [];
  if (promotion === 'first') {
    if (!firstOrderEligible) throw new CheckoutError('failed-precondition', 'The first-order discount has already been used for this account.');
    discounts.push({ kind: 'first', label: 'First order · 10%', amountCents: Math.round(subtotalCents * 0.1) });
  }
  if (promotion === 'code') {
    if (!promo || promo.active !== true || !Number.isFinite(promo.percentOff) || promo.percentOff <= 0 || promo.percentOff > 100) throw new CheckoutError('failed-precondition', 'This promotional code is not available.');
    discounts.push({ kind: 'code', label: `${promo.code} · ${promo.percentOff}%`, amountCents: Math.round(subtotalCents * promo.percentOff / 100) });
  }
  const eligible = lines.filter(line => line.bulkEligible);
  if (new Set(eligible.map(line => line.compoundKey)).size >= 5) {
    discounts.push({ kind: 'mixed', label: '5 distinct compounds · 5%', amountCents: Math.round(eligible.reduce((sum, line) => sum + line.lineTotalCents, 0) * 0.05) });
  }
  // Preserve Corey's cap: the first 5 identical vials get 10%, or the first
  // 10 get 20%. This is not a discount on all vials when quantity exceeds 10.
  for (const line of eligible) {
    if (line.quantity >= 10) discounts.push({ kind: 'bulk10', productId: line.productId, label: `${line.name} ${line.strength} · 10 vials, 20%`, amountCents: Math.round(line.unitPriceCents * 10 * 0.2) });
    else if (line.quantity >= 5) discounts.push({ kind: 'bulk5', productId: line.productId, label: `${line.name} ${line.strength} · 5 vials, 10%`, amountCents: Math.round(line.unitPriceCents * 5 * 0.1) });
  }
  const rawDiscountCents = discounts.reduce((sum, discount) => sum + discount.amountCents, 0);
  const discountCents = Math.min(subtotalCents, rawDiscountCents);
  const cleanLines = lines.map(({ bulkEligible, compoundKey, ...line }) => line);
  return { lines: cleanLines, subtotalCents, discounts, discountCents, discountCapCents: rawDiscountCents - discountCents, shippingCents: SHIPPING_CENTS, totalCents: subtotalCents - discountCents + SHIPPING_CENTS, promotion, rulesVersion: RULES_VERSION };
}
export function validateCustomer(input) {
  const address = input.shippingAddress || {};
  const text = (value, label, min, max) => {
    if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || /[\x00-\x1f]/.test(value)) throw new CheckoutError('invalid-argument', `Please enter a valid ${label}.`);
    return value.trim();
  };
  const name = text(input.name, 'full name', 2, 100);
  const phone = text(input.phone, 'phone number', 7, 30);
  if (!/^[+\d\s().-]+$/.test(phone) || phone.replace(/\D/g, '').length < 7) throw new CheckoutError('invalid-argument', 'Please enter a valid phone number.');
  const state = text(address.state, 'state', 2, 2).toUpperCase();
  if (!['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'].includes(state)) throw new CheckoutError('invalid-argument', 'Please enter a valid two-letter US state.');
  const zip = text(address.zip, 'ZIP code', 5, 10);
  if (!/^\d{5}(-\d{4})?$/.test(zip)) throw new CheckoutError('invalid-argument', 'Please enter a valid ZIP code.');
  if (!['venmo', 'paypal'].includes(input.paymentMethod)) throw new CheckoutError('invalid-argument', 'Choose Venmo or PayPal.');
  if (input.researchOnlyAccepted !== true) throw new CheckoutError('invalid-argument', 'Please confirm research-only purchase.');
  return { name, phone, shippingAddress: { street: text(address.street, 'street address', 3, 160), apartment: typeof address.apartment === 'string' ? address.apartment.trim().slice(0,80) : '', city: text(address.city, 'city', 2, 80), state, zip, country: 'US' }, paymentMethod: input.paymentMethod, notes: typeof input.notes === 'string' ? input.notes.trim().slice(0,1000) : '' };
}
