import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sendShippingEmail } from '../functions/shipping-email.js';

try {
  const source = existsSync(new URL('./test-email.js',import.meta.url)) ? './test-email.js' : './test-email.mjs';
  const {readHiddenKey,sampleShipment,TEST_RECIPIENT} = await import(source);
  const apiKey = await readHiddenKey();
  if (!/^re_[A-Za-z0-9_-]+$/.test(apiKey)) throw new Error('Enter a valid Resend API key.');
  const id = await sendShippingEmail({...sampleShipment,customer:{...sampleShipment.customer,email:TEST_RECIPIENT}},{
    apiKey, from:'Tactical Aminos <orders@tacticalaminos.com>', requestId:'shipping-test-'+randomUUID(),test:true
  });
  console.log(`Resend accepted the shipping preview for ${TEST_RECIPIENT}: ${id}. Check Inbox and Spam.`);
} catch(error) {
  console.error(error.message);
  process.exitCode=1;
}
