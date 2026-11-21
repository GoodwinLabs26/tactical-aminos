import test from 'node:test';
import assert from 'node:assert/strict';
import {validateCoa,MAX_COA_BYTES} from '../functions/coa-service.js';
test('COA upload validates PDF bytes, size, title, lot and product identity',()=>{
 const input={productId:'d2-30',title:'Sample COA',lot:'Batch A',base64:Buffer.from('%PDF-1.4\nSample\n%%EOF').toString('base64')};
 const value=validateCoa(input);assert.equal(value.lot,'Batch A');assert.equal(value.sha256.length,64);
 for(const bad of [{productId:'../admin'},{title:''},{lot:'bad\nlot'},{base64:Buffer.from('<html>bad</html>').toString('base64')},{base64:Buffer.alloc(MAX_COA_BYTES+1).toString('base64')}])assert.throws(()=>validateCoa({...input,...bad}));
});

import vm from 'node:vm';
import fs from 'node:fs/promises';
async function handlers(db){
 const context=vm.createContext({console,Buffer,Date,Array,Number,String,Promise});
 class HttpsError extends Error{constructor(code,message){super(message);this.code=code;}}
 const definitions={
 'firebase-functions/v2/https':{onCall:(_,handler)=>handler,HttpsError},
 'firebase-admin/firestore':{getFirestore:()=>db,FieldValue:{serverTimestamp:()=>0}},
 './coa-service.js':{validateCoa,randomUUID:()=> 'version-test'}
 };
 const module=new vm.SourceTextModule(await fs.readFile(new URL('../functions/coa-functions.js',import.meta.url),'utf8'),{context});
 await module.link(async name=>{const values=definitions[name];return new vm.SyntheticModule(Object.keys(values),function(){for(const [key,value]of Object.entries(values))this.setExport(key,value);},{context});});
 await module.evaluate();return module.namespace;
}
test('COA admin operations reject members, while member downloads require membership',async()=>{
 const db={doc:path=>({get:async()=>({data:()=>path==='config/admin'?{uid:'owner',additionalUids:['mark']}:{ageConfirmed:false}})})};
 const api=await handlers(db);
 await assert.rejects(api.manageProductCoa({auth:{uid:'member'},data:{}}),e=>e.code==='permission-denied');
 await assert.rejects(api.getProductCoa({auth:{uid:'member'},data:{productId:'d2-30'}}),e=>e.code==='permission-denied');
 await assert.rejects(api.manageProductCoa({auth:{uid:'mark'},data:{productId:'../bad'}}),e=>e.code==='invalid-argument');
});
test('bulk inventory refuses an open store without writing product stock',async()=>{
 let writes=0;
 const db={doc:path=>({path,get:async()=>({data:()=>({uid:'owner'})})}),runTransaction:async callback=>callback({get:async()=>({data:()=>({checkoutEnabled:true})}),update:()=>writes++})};
 const api=await handlers(db);
 await assert.rejects(api.setLaunchInventory({auth:{uid:'owner'},data:{confirmation:'SET ALL STOCK TO 100'}}),e=>e.code==='failed-precondition');assert.equal(writes,0);
});
test('bulk inventory sets stock and alerts without publishing incomplete listings',async()=>{
 const writes=[];
 const db={doc:path=>({path,get:async()=>({data:()=>({uid:'owner'})})}),collection:()=>({collection:true}),runTransaction:async callback=>callback({get:async ref=>ref.collection?{size:1,docs:[{ref:'product',data:()=>({revision:3,published:false})}]}:{data:()=>({checkoutEnabled:false})},update:(ref,value)=>writes.push(value)})};
 const api=await handlers(db);await api.setLaunchInventory({auth:{uid:'owner'},data:{confirmation:'SET ALL STOCK TO 100'}});
 assert.equal(writes[0].stockQuantity,100);assert.equal(writes[0].lowStockThreshold,10);assert.equal(writes[0].revision,4);assert(!('published' in writes[0]));
});
