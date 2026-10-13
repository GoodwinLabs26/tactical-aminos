import { createHash } from 'node:crypto';
import { calculateQuote, CheckoutError, normalizeLines, validateCustomer } from './lib/checkout-core.js';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const normalizedCode = value => String(value || '').trim().toUpperCase();
function requireMember(uid, profile) {
  if (!uid) throw new CheckoutError('unauthenticated', 'Sign in to place an order.');
  if (!profile || profile.ageConfirmed !== true || profile.researchOnlyAccepted !== true) throw new CheckoutError('permission-denied', 'Confirm your member access before ordering.');
}
function validateSettings(settings, paymentMethod) {
  if (settings?.checkoutEnabled !== true) throw new CheckoutError('failed-precondition', 'The store is not accepting orders yet.');
  if (paymentMethod === 'venmo' && !settings.venmoHandle) throw new CheckoutError('failed-precondition', 'Venmo payment details are not configured.');
  if (paymentMethod === 'paypal' && !settings.paypalHandle) throw new CheckoutError('failed-precondition', 'PayPal details are pending. Please choose Venmo.');
}
function validatePromo(promo, code, now) {
  if (!code || !/^[A-Z0-9_-]{1,30}$/.test(code) || !promo || promo.code !== code || promo.active !== true) throw new CheckoutError('failed-precondition', 'This promotional code is not available.');
  const expiresAt = promo.expiresAt?.toMillis?.() ?? promo.expiresAtMs;
  const startsAt = promo.startsAt?.toMillis?.() ?? promo.startsAtMs;
  if ((Number.isFinite(expiresAt) && expiresAt <= now) || (Number.isFinite(startsAt) && startsAt > now)) throw new CheckoutError('failed-precondition', 'This promotional code is not currently available.');
  if (Number.isInteger(promo.maxUses) && promo.maxUses > 0 && (promo.usedCount || 0) + (promo.reservedUses || 0) >= promo.maxUses) throw new CheckoutError('failed-precondition', 'This promotional code has reached its usage limit.');
  return promo;
}
function makeQuote(input, records, stats, promo, now) {
  const code = normalizedCode(input.code);
  const activePromo = input.promotion === 'code' ? validatePromo(promo, code, now) : null;
  const firstOrderEligible = stats?.firstOrderClaimed !== true && !(stats?.submittedOrderCount > 0) && !(stats?.paidOrderCount > 0);
  const quote = calculateQuote(input, records, { firstOrderEligible, promo: activePromo, enforceStock: true });
  return { ...quote, firstOrderEligible, promo: activePromo ? { code: activePromo.code, percentOff: activePromo.percentOff } : null, quoteId: hash(quote) };
}
// Firestore adapter is injected so order behavior can be tested without live
// accounts. All reads/writes for a submission run in one server transaction.
export function createOrderService({ store, timestamp, now = () => Date.now() }) {
  async function context(reader, uid, input) {
    const normalized = normalizeLines(input.lines);
    const code = input.promotion === 'code' ? normalizedCode(input.code) : '';
    if (code && !/^[A-Z0-9_-]{1,30}$/.test(code)) throw new CheckoutError('invalid-argument', 'Use a valid promotional code.');
    const [profile, settings, stats, promo, ...records] = await Promise.all([
      reader.get(`users/${uid}`), reader.get('config/store'), reader.get(`customerStats/${uid}`), code ? reader.get(`discountCodes/${code}`) : Promise.resolve(null), ...normalized.map(line => reader.get(`products/${line.productId}`))
    ]);
    requireMember(uid, profile);
    validateSettings(settings);
    return { settings, stats, promo, records: records.filter(Boolean) };
  }
  return {
    async quote(uid, input) {
      if (!uid) throw new CheckoutError('unauthenticated', 'Sign in to place an order.');
      const data = await context(store, uid, input);
      return makeQuote(input, data.records, data.stats, data.promo, now());
    },
    async submit(uid, email, input) {
      if (!uid || !email) throw new CheckoutError('unauthenticated', 'Sign in to place an order.');
      if (!/^[a-zA-Z0-9-]{16,80}$/.test(input.requestId || '')) throw new CheckoutError('invalid-argument', 'A valid checkout request ID is required.');
      if (!/^[a-f0-9]{64}$/.test(input.expectedQuoteId || '')) throw new CheckoutError('invalid-argument', 'Review the current order total before submitting.');
      const customer = validateCustomer(input);
      const lines = normalizeLines(input.lines);
      const promotion = input.promotion || 'none';
      const code = promotion === 'code' ? normalizedCode(input.code) : '';
      const requestHash = hash({ lines, promotion, code, customer });
      const orderId = hash([uid, input.requestId]);
      return store.transaction(async transaction => {
        const existing = await transaction.get(`orders/${orderId}`);
        if (existing) {
          if (existing.ownerUid !== uid || existing.requestHash !== requestHash) throw new CheckoutError('already-exists', 'This request ID belongs to a different checkout. Start a new order.');
          return { orderId, orderNumber: existing.orderNumber, totalCents: existing.totalCents, paymentInstructions: existing.paymentInstructions, repeated: true };
        }
        const data = await context(transaction, uid, { lines, promotion, code });
        validateSettings(data.settings, customer.paymentMethod);
        const quote = makeQuote({ lines, promotion, code }, data.records, data.stats, data.promo, now());
        if (quote.quoteId !== input.expectedQuoteId) throw new CheckoutError('failed-precondition', 'Your prices or discount eligibility changed. Review the latest total and try again.');
        const orderNumber = `TA-${orderId.slice(0,10).toUpperCase()}`;
        const paymentInstructions = {
          method: customer.paymentMethod,
          handle: customer.paymentMethod === 'venmo' ? data.settings.venmoHandle : data.settings.paypalHandle,
          note: 'When sending payment through your selected app, do not include product names in the payment note or memo field.'
        };
        const { firstOrderEligible, promo, quoteId, ...totals } = quote;
        transaction.set(`orders/${orderId}`, {
          ...totals, orderNumber, ownerUid: uid, customer: { name: customer.name, phone: customer.phone, email }, shippingAddress: customer.shippingAddress, notes: customer.notes, paymentMethod: customer.paymentMethod, paymentInstructions,
          status: 'pending', paymentStatus: 'unpaid', fulfillmentStatus: 'unfulfilled', inventoryDeducted: false, referralCounted: false,
          promoSnapshot: promo ? { ...promo, affiliateUid: data.promo.affiliateUid || null } : null,
          requestHash, quoteId, createdAt: timestamp(), emailStatus: 'not-configured'
        });
        transaction.set(`customerStats/${uid}`, { ...data.stats, submittedOrderCount: (data.stats?.submittedOrderCount || 0) + 1, ...(promotion === 'first' ? { firstOrderClaimed: true, firstOrderOrderId: orderId } : {}), updatedAt: timestamp() });
        if (promotion === 'code') transaction.set(`discountCodes/${code}`, { ...data.promo, reservedUses: (data.promo.reservedUses || 0) + 1 });
        // No inventory deduction or affiliate credit at submission; those
        // actions belong to the paid transition in the admin phase.
        return { orderId, orderNumber, totalCents: quote.totalCents, paymentInstructions, repeated: false };
      });
    }
  };
}
