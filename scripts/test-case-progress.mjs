import assert from 'node:assert/strict';
import {publicProgress} from '../netlify/shared/case-progress.mjs';
import {makeCase} from '../netlify/shared/cases.mjs';
import {transition} from '../netlify/shared/workflow.mjs';
const r=makeCase({score:10,amount:2000,mode:'manual',category:'other',basis:'number',reasonCodes:[]});
assert.equal(publicProgress(r).status,'Awaiting review');
const note=transition(r,'note',{version:0,text:'PRIVATE email IP address and KYC'},'PRIVATE investigator');assert.equal(publicProgress(note).status,'Under review');
for(const outcome of ['receiver-fraud','receiver-cleared','inconclusive']){const closed=transition(note,'close',{version:1,text:'PRIVATE supporting evidence and phone',outcome},'PRIVATE');const p=publicProgress(closed);assert.equal(p.status,'Closed');assert.ok(p.outcome);assert.ok(!JSON.stringify(p).includes('PRIVATE'));assert.deepEqual(Object.keys(p).sort(),['caseNumber','createdAt','demo','outcome','status','timeline','updatedAt']);const reopened=transition(closed,'reopen',{version:2,text:'PRIVATE further review requested'},'PRIVATE');assert.equal(publicProgress(reopened).outcome,null);assert.equal(publicProgress(reopened).timeline.at(-1).label,'Case reopened');}
assert.equal(publicProgress({summary:r.summary}).timeline.length,1);
console.log('PASS: legacy/open/review/closed/reopened, fixed public outcomes, no private free text or dossier.');
