import assert from 'node:assert/strict';
const base='https://payshield-ai-police.netlify.app/api/cases';
const post=async(action,body)=>{const r=await fetch(base+'?action='+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
const id='PS-9655A711A6A2E0E7'; // Previously created synthetic workflow test fixture.
const result=await post('progress',{caseNumber:id});assert.equal(result.status,200);assert.equal(result.data.caseNumber,id);assert.ok(result.data.timeline.length>1);assert.deepEqual(Object.keys(result.data).sort(),['caseNumber','createdAt','demo','outcome','status','timeline','updatedAt']);assert.ok(!JSON.stringify(result.data).includes('192.0.2.42'));for(const event of result.data.timeline)assert.ok(Object.keys(event).every(k=>['at','label','outcome'].includes(k)));
assert.equal((await post('progress',{caseNumber:'invalid'})).status,400);assert.equal((await post('progress',{caseNumber:'PS-0000000000000000'})).status,404);assert.equal((await fetch(base+'?id='+id)).status,401);
console.log('PASS LIVE: existing case progress, public field allowlist, invalid/not-found handling, private lookup still authenticated.');
