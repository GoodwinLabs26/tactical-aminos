// Keep true until the order backend and real inventory/payment details are ready.
// Preview checkout never writes an order or requests payment.
export const siteSettings = {
  previewCheckout: !['localhost', '127.0.0.1'].includes(globalThis.location?.hostname),
  functionsRegion: 'us-central1',
  venmoHandle: '@Mark-Williams-1389',
  paypalHandle: 'tacticalaminos@gmail.com',
  paypalMerchantId: 'UFYAF6QJ57VLN',
  paymentNote: 'When sending payment, please add 🍕 only in the payment note or memo field.',
  previewCodes: [{ code: 'TEST10', percentOff: 10, active: true }]
};
