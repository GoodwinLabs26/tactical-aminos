import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAddress, initAccountSettings } from '../account-settings.js';
const address = {name:'Jasmine Goodwin',phone:'515-555-0123',street:'123 Sample St',apartment:'',city:'Des Moines',state:'ia',zip:'50309'};
test('saved addresses normalize state and reject invalid or oversized fields', () => {
  assert.equal(normalizeAddress(address).state,'IA');
  for (const bad of [{zip:'123'}, {state:'Iowa'}, {name:''}, {street:'x'.repeat(161)}]) {
    assert.throws(() => normalizeAddress({...address,...bad}));
  }
});
test('saved address prefill preserves checkout edits and clears on account switch', async () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id,{value:'',textContent:'',dataset:{},listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},querySelectorAll(){return [];},reset(){}});
    return elements.get(id);
  };
  globalThis.document = {getElementById:element};
  let resolve;
  const api = {getSavedAddress:()=>new Promise(done=>{resolve=done;})};
  const controller = initAccountSettings({getService:async()=>api});
  const loading = controller.updateSession({uid:'one'});
  await Promise.resolve(); await Promise.resolve();
  element('shippingStreet').value='Different destination';
  element('shippingStreet').listeners.input();
  resolve(normalizeAddress(address)); await loading;
  assert.equal(element('shippingStreet').value,'Different destination');
  assert.equal(element('saved-name').value,'Jasmine Goodwin');
  await controller.updateSession(null);
  assert.equal(element('shippingStreet').value,'');
  assert.equal(element('saved-name').value,'');
  const next = controller.updateSession({uid:'two'});
  await Promise.resolve(); await Promise.resolve();
  await controller.updateSession(null);
  resolve(normalizeAddress(address)); await next;
  assert.equal(element('shippingStreet').value,'');
  delete globalThis.document;
});
