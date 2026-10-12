// Keep true until the order backend and real inventory/payment details are ready.
// Preview checkout never writes an order or requests payment.
export const siteSettings = {
  previewCheckout: true,
  functionsRegion: 'us-central1',
  venmoHandle: '@Mark-Williams-1389',
  paypalHandle: '',
  paymentNote: 'When sending payment through your selected app, do not include product names in the payment note or memo field.',
  previewCodes: [{ code: 'TEST10', percentOff: 10, active: true }]
};
