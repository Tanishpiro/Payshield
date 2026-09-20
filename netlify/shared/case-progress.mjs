// Only deliberately shared note text may be returned; private evidence stays private.
const findings = {
 'receiver-fraud':'Sender report substantiated (demo)',
 'receiver-cleared':'Receiver cleared in this case (demo)',
 inconclusive:'Inconclusive — insufficient evidence',
};
export function publicProgress(record) {
 const events=(record.timeline||[]).flatMap(event=>{
  const label={reported:'Report received',note:'Investigation activity recorded',close:'Case closed',reopen:'Case reopened'}[event.kind];
  if(!label)return [];
  return [{at:event.at,label: event.kind==='note'&&event.senderVisible===true?'Investigator update':label,...(event.kind==='note'&&event.senderVisible===true?{note:event.text}:{}),...(event.kind==='close'&&findings[event.outcome]?{outcome:findings[event.outcome]}:{})}];
 });
 if(!events.length)events.push({at:record.summary.createdAt,label:'Report received'});
 return {caseNumber:record.summary.caseNumber,status:record.state==='closed'?'Closed':events.length>1?'Under review':'Awaiting review',createdAt:record.summary.createdAt,updatedAt:events.at(-1).at,outcome:record.state==='closed'?(findings[record.decision?.outcome]||'Review completed'):null,timeline:events,demo:true};
}
