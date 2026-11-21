import { randomUUID, createHash } from 'node:crypto';
export const MAX_COA_BYTES = 4 * 1024 * 1024;
export function validateCoa(input) {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(input?.productId || '')) throw new Error('Choose a valid product.');
  const title = String(input.title || '').trim(), lot = String(input.lot || '').trim();
  if (!title || title.length > 120 || lot.length > 80 || /[\r\n]/.test(title+lot)) throw new Error('Enter a COA title (120 characters maximum) and optional lot (80 maximum).');
  if (typeof input.base64 !== 'string' || input.base64.length > Math.ceil(MAX_COA_BYTES/3)*4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64)) throw new Error('Upload a PDF, PNG or JPEG no larger than 4 MB.');
  const bytes = Buffer.from(input.base64,'base64');

  const mimeType = bytes.subarray(0,5).toString() === '%PDF-' ? 'application/pdf'
    : bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg' : null;
  if (bytes.length > MAX_COA_BYTES || !mimeType || bytes.toString('base64') !== input.base64) throw new Error('The file must be a PDF, PNG or JPEG no larger than 4 MB.');
  return {title,lot,bytes,mimeType,sha256:createHash('sha256').update(bytes).digest('hex')};
}
export {randomUUID};
