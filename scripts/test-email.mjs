// Run manually from the VS Code terminal. Never imported by the website.
import {renderOrderEmails} from '../functions/email-templates.js';
import {randomUUID} from 'node:crypto';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

export const TEST_RECIPIENT='goodwinlabs.co@gmail.com';
const TEST_FROM='Tactical Aminos <onboarding@resend.dev>';
export const sampleOrder={
  orderNumber:'TA-EMAIL-TEST',customer:{name:'Sample Customer',email:'sample-customer@example.com',phone:'515-555-0100'},
  shippingAddress:{street:'123 Sample Street',city:'Des Moines',state:'IA',zip:'50309'},
  lines:[{name:'BPC-157',strength:'10mg',quantity:1,unitPriceCents:3800},{name:'KPV',strength:'10mg',quantity:1,unitPriceCents:4500}],
  subtotalCents:8300,discountCents:830,shippingCents:800,totalCents:8270,paymentMethod:'venmo',
  paymentInstructions:{handle:'SAMPLE ONLY — DO NOT PAY'},notes:'Sample order for email testing only.'
};
export function buildTestMessages(){return renderOrderEmails(sampleOrder,{test:true}).map(({kind,...content})=>({from:TEST_FROM,to:[TEST_RECIPIENT],...content}));}

// This sender deliberately cannot accept arbitrary recipients, orders, or CC/BCC.
export async function sendTestEmails(apiKey,{fetchImpl=globalThis.fetch,requestId=randomUUID()}={}){
  if(typeof apiKey!=='string'||!/^re_[A-Za-z0-9_-]+$/.test(apiKey.trim()))throw new Error('That does not look like a Resend API key. Run again and paste the key starting with re_.');
  let response;
  try{
    response=await fetchImpl('https://api.resend.com/emails/batch',{method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),headers:{Authorization:`Bearer ${apiKey.trim()}`,'Content-Type':'application/json','Idempotency-Key':`tactical-email-test-${requestId}`},body:JSON.stringify(buildTestMessages())});
  }catch{
    throw new Error('Could not confirm whether Resend accepted the emails. Check Resend → Emails before running again.');
  }
  if(!response.ok){
    const hints={401:'The API key was not accepted. Check that you copied the current key.',403:'Check that this key can send emails and belongs to the Resend account registered as goodwinlabs.co@gmail.com.',429:'Resend has reached a sending or rate limit. Check your Resend dashboard before retrying.'};
    throw new Error(`Resend returned HTTP ${response.status}. ${hints[response.status]||'Check the request in Resend → Logs. No success was confirmed.'}`);
  }
  let result;try{result=await response.json();}catch{throw new Error('Resend responded, but the email IDs could not be read. Check Resend → Emails before running again.');}
  if(result?.data?.length!==2||result.data.some(item=>typeof item.id!=='string'||!/^[A-Za-z0-9_-]+$/.test(item.id)))throw new Error('Resend did not confirm both email IDs. Check Resend → Emails before running again.');
  return result.data.map(item=>item.id);
}

export function readHiddenKey(input=process.stdin,output=process.stdout){
  if(!input.isTTY||!input.setRawMode)throw new Error('Run this command in the VS Code integrated terminal so the key can be entered privately.');
  return new Promise((resolve,reject)=>{
    let value='';const previousRaw=!!input.isRaw;
    const finish=(error)=>{input.removeListener('data',onData);input.removeListener('end',onEnd);input.setRawMode(previousRaw);input.pause();output.write('\n');if(error)reject(error);else resolve(value.trim());value='';};
    const onEnd=()=>finish(new Error('Key entry cancelled. No email was sent.'));
    const onData=chunk=>{for(const char of String(chunk)){
      if(char==='\u0003'||char==='\u0004'){finish(new Error('Cancelled. No email was sent.'));return;}
      if(char==='\r'||char==='\n'){finish();return;}
      if(char==='\u007f'||char==='\b')value=value.slice(0,-1);
      else if(char>=' '&&char<='~'&&value.length<2048)value+=char;
    }};
    output.write('Paste your Resend API key, then press Enter (the key stays hidden): ');
    input.setEncoding('utf8');input.setRawMode(true);input.on('data',onData);input.once('end',onEnd);input.resume();
  });
}

async function main(){
  const args=process.argv.slice(2);
  if(args.length!==1||!['--preview','--send'].includes(args[0])){
    console.log('Preview without sending: node scripts/test-email.mjs --preview\nSend two sample emails to goodwinlabs.co@gmail.com: node scripts/test-email.mjs --send');return;
  }
  if(args[0]==='--preview'){
    const directory=await mkdtemp(join(tmpdir(),'tactical-email-preview-'));
    for(const [index,email]of buildTestMessages().entries()){
      const name=index===0?'customer-confirmation':'admin-order-alert';await writeFile(join(directory,name+'.html'),email.html);await writeFile(join(directory,name+'.txt'),email.text);
    }
    console.log('Preview files created. No email was sent and no API key is needed.\n'+directory);return;
  }
  console.log(`Sending TWO sample emails only to ${TEST_RECIPIENT}.\nNo order, stock, payment, or customer record will change.`);
  let apiKey=await readHiddenKey();
  try{const ids=await sendTestEmails(apiKey);console.log('Resend accepted both emails for delivery. Check your Inbox and Spam folders.\nCustomer confirmation ID: '+ids[0]+'\nAdmin alert ID: '+ids[1]);}finally{apiKey='';}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){main().catch(error=>{console.error(error.message);process.exitCode=1;});}
