import { createHash, randomUUID } from 'node:crypto';

export const OUTCOMES = {
 'receiver-fraud': 'Sender report substantiated — receiver fraud confirmed (demo)',
 'receiver-cleared': 'Receiver cleared in this case (demo)',
 inconclusive: 'Insufficient evidence — no finding against either party',
};
export function normalizeReceiver(value) {
 if (value === undefined || value === null || value === '') return null;
 if (typeof value !== 'string' || value.length > 100) throw Error('Invalid receiver identifier.');
 const id = value.trim().toLowerCase();
 if (!/^(?:\+?\d{10,15}|[\w.-]+@[\w.-]+)$/.test(id)) throw Error('Enter a valid demo number or UPI ID.');
 return id.replace(/^\+91(?=\d{10}$)/,'');
}
export const receiverPrefix = id => 'receiver/' + createHash('sha256').update(id).digest('hex') + '/';
export function hydrate(record) {
 return {...record, version: record.version ?? 0, state: record.state ?? 'open', decision: record.decision ?? null,
   timeline: record.timeline ?? [{id:'report',kind:'reported',at:record.summary.createdAt,actor:'Sender (demo)',text:'Sender report created. No finding has been made.'}]};
}
export function transition(record, action, body, actor, now = new Date().toISOString()) {
 const next=hydrate(record);
 if (!Number.isInteger(body.version) || body.version !== next.version) throw Error('CONFLICT');
 if (typeof body.text !== 'string' || body.text.trim().length < (action==='note'?1:15) || body.text.length>2000) throw Error('Add a note, or at least 15 characters explaining your decision (maximum 2000).');
 if(next.timeline.length>=200)throw Error('This demo case has reached its 200-event history limit.');
 const event={id:randomUUID(),kind:action,at:now,actor,text:body.text.trim()};
 if(action==='note')event.senderVisible=body.senderVisible===true;
 if(action==='close'){
   if(next.state==='closed')throw Error('Case is already closed. Reopen it before changing the decision.');
   if(!Object.hasOwn(OUTCOMES,body.outcome))throw Error('Select a closure outcome.');
   next.state='closed';next.decision={outcome:body.outcome,label:OUTCOMES[body.outcome],reason:event.text,at:now,actor};
   event.outcome=body.outcome;event.label=OUTCOMES[body.outcome];
   event.scoreEffect=body.outcome==='receiver-fraud' && next.receiverId ? 'Trust capped at 10/100; payment risk at least 95/100 while this finding is active.' : 'No new receiver score penalty.';
 } else if(action==='reopen'){
   if(next.state!=='closed')throw Error('Only a closed case can be reopened.');
   event.previousOutcome=next.decision?.outcome;next.state='open';next.decision=null;
   event.scoreEffect='This case no longer applies a fraud penalty. Other confirmed cases remain effective.';
 } else if(action!=='note')throw Error('Unknown case action.');
 next.timeline=[...next.timeline,event];next.version++;
 next.summary={...next.summary,status:next.state==='closed'?'Closed — '+next.decision.label:'Open — under review'};
 return next;
}
export async function readCase(store,id) {
 const top=await store.getWithMetadata(id,{type:'json'});if(!top)return null;
 const key=top.data.recordKey || id;
 const found=key===id?top:await store.getWithMetadata(key,{type:'json'});
 return found?{key,etag:found.etag,record:hydrate(found.data)}:null;
}
export async function reputation(store,receiverId) {
 if(!receiverId)return {linked:false,confirmedCases:0,riskFloor:0,trustCeiling:100};
 const list=await store.list({prefix:receiverPrefix(receiverId)});
 // Bound this prototype's read workload. Never silently omit decisions.
 if(list.blobs.length>100)throw Error('Receiver case volume exceeds the prototype limit.');
 const records=await Promise.all(list.blobs.map(b=>store.get(b.key,{type:'json'})));
 const confirmedCases=records.filter(r=>r?.state==='closed' && r.decision?.outcome==='receiver-fraud').length;
 return {linked:true,confirmedCases,riskFloor:confirmedCases?95:0,trustCeiling:confirmedCases?10:100};
}
