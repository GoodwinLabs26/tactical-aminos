import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveUpdates} from '../admin-live.js';
function setup({refresh=async()=>{},canApply=()=>true}={}){
 let tasks=new Map(),next=0;const states=[];
 const controller=createLiveUpdates({refresh,canApply,status:value=>states.push(value),schedule:fn=>{tasks.set(++next,fn);return next;},cancel:id=>tasks.delete(id)});
 return {controller,states,async flush(){const callbacks=[...tasks.values()];tasks.clear();for(const fn of callbacks)await fn();},count:()=>tasks.size};
}
test('live updates coalesce signals and wait for unsaved form edits',async()=>{
 let allowed=false,reads=0;const live=setup({canApply:()=>allowed,refresh:async()=>reads++});
 live.controller.notify();live.controller.notify();assert.equal(live.count(),1);
 await live.flush();assert.equal(reads,0);assert.match(live.states.at(-1),/finish or save/);
 allowed=true;live.controller.wake();await live.flush();assert.equal(reads,1);assert.equal(live.states.at(-1),'Live updates on');
});
test('changes arriving during a reload cause another reload without overlapping calls',async()=>{
 let resolve,reads=0;const live=setup({refresh:()=>{reads++;return reads===1?new Promise(done=>{resolve=done;}):Promise.resolve();}});
 live.controller.notify();const running=live.flush();await Promise.resolve();live.controller.notify();assert.equal(reads,1);
 resolve();await running;await live.flush();assert.equal(reads,2);
});
test('sign-out stops queued and in-flight live updates',async()=>{
 let resolve;const live=setup({refresh:()=>new Promise(done=>{resolve=done;})});
 live.controller.notify();const running=live.flush();await Promise.resolve();live.controller.stop();const previous=live.states.length;resolve();await running;
 live.controller.notify();assert.equal(live.count(),0);assert.equal(live.states.length,previous);
});
test('a failed reload preserves pending updates for reconnect or retry',async()=>{
 let fail=true;const live=setup({refresh:async()=>{if(fail)throw Error('offline');}});
 live.controller.notify();await live.flush();assert.match(live.states.at(-1),/failed/);
 fail=false;live.controller.wake();await live.flush();assert.equal(live.states.at(-1),'Live updates on');
});
