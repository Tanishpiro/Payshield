import assert from 'node:assert/strict';
import {makeCase} from '../netlify/shared/cases.mjs';
import {transition,reputation,normalizeReceiver} from '../netlify/shared/workflow.mjs';
const base=makeCase({receiverId:'9876543210',score:10,amount:2000,mode:'manual',category:'suspicious-request',basis:'number',reasonCodes:[]});
assert.equal(normalizeReceiver('+919876543210'),'9876543210');
assert.throws(()=>normalizeReceiver('bad id'));
const noted=transition(base,'note',{version:0,text:'Evidence reviewed'},'demo');assert.equal(base.timeline.length,1);assert.equal(noted.timeline.length,2);
assert.throws(()=>transition(noted,'note',{version:0,text:'Stale'},'demo'),/CONFLICT/);
assert.throws(()=>transition(noted,'close',{version:1,text:'too short',outcome:'receiver-fraud'},'demo'));
const closed=transition(noted,'close',{version:1,text:'Synthetic evidence confirms receiver fraud.',outcome:'receiver-fraud'},'demo');
const store=records=>({list:async()=>({blobs:records.map((_,i)=>({key:String(i)}))}),get:async key=>records[Number(key)]});
assert.equal((await reputation(store([noted]),base.receiverId)).riskFloor,0);
assert.deepEqual(await reputation(store([closed]),base.receiverId),{linked:true,confirmedCases:1,riskFloor:95,trustCeiling:10});
const reopened=transition(closed,'reopen',{version:2,text:'Review new synthetic evidence.'},'demo');assert.equal(reopened.timeline[2].outcome,'receiver-fraud');assert.equal(reopened.decision,null);
assert.equal((await reputation(store([reopened]),base.receiverId)).riskFloor,0);
assert.equal((await reputation(store([reopened,closed]),base.receiverId)).riskFloor,95);
for(const outcome of ['receiver-cleared','inconclusive']){const r=transition(base,'close',{version:0,text:'Reviewed evidence for demo finding.',outcome},'demo');assert.equal((await reputation(store([r]),base.receiverId)).riskFloor,0);}
console.log('PASS: version conflicts, immutable history, validated decisions, pending/cleared/inconclusive no penalty, fraud penalty, reopening and multiple-case policy.');
