import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync('dist/service-worker.js','utf8');
function worker(fail=false){
  const events={},calls=[];
  const context={Request:class extends Request {constructor(url,options){super(new URL(url,'https://example.test/DailyCooking/'),options);}},Response,URL,
    self:{location:{origin:'https://example.test'},addEventListener:(name,fn)=>events[name]=fn,skipWaiting:async()=>calls.push('skip'),clients:{claim:async()=>calls.push('claim')}},
    caches:{open:async()=>({addAll:async requests=>{if(fail)throw Error('offline');requests.forEach(r=>assert.equal(r.cache,'reload'));calls.push('cached');}}),keys:async()=>['mainichi-dinner-v4','mainichi-dinner-v5','other-app'],delete:async name=>calls.push(name),match:async()=>new Response('offline copy')},
    fetch:async()=>{throw Error('offline');}};
  vm.runInNewContext(source,context);return {events,calls};
}
async function dispatch(events,name,extra={}){let pending;events[name]({...extra,waitUntil:p=>{pending=p;},respondWith:p=>{pending=p;}});return await pending;}
test('PWA activates only after cache is complete and removes only its obsolete cache',async()=>{const {events,calls}=worker();await dispatch(events,'install');assert.deepEqual(calls,['cached','skip']);await dispatch(events,'activate');assert.deepEqual(calls,['cached','skip','mainichi-dinner-v4','claim']);});
test('failed PWA download keeps installed version; versioned navigation works offline',async()=>{const {events,calls}=worker(true);await assert.rejects(dispatch(events,'install'));assert.deepEqual(calls,[]);const response=await dispatch(events,'fetch',{request:new Request('https://example.test/DailyCooking/?v=123')});assert.equal(await response.text(),'offline copy');});
