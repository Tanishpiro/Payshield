import { getStore } from '@netlify/blobs';
import { makeCase, reportPdf, issueSession, validSession, safeEqual } from '../shared/cases.mjs';
import { readCase, receiverPrefix, normalizeReceiver, reputation, transition } from '../shared/workflow.mjs';
import { publicProgress } from '../shared/case-progress.mjs';
const cookie = 'ps_investigator';
let minute=0, writes=0;
export default async (req) => {
 const origin=req.headers.get('origin'); const own='https://payshield-ai-police.netlify.app';
 const h=new Headers({'Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','X-Content-Type-Options':'nosniff'});
 if(origin && ![own,'https://localhost','http://localhost:3000','http://127.0.0.1:3000','http://localhost:3010','http://127.0.0.1:3010'].includes(origin)) return new Response(null,{status:403});
 if(origin)h.set('Access-Control-Allow-Origin',origin);
 const reply=(data,status=200)=>Response.json(data,{status,headers:h});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:h});
 const url=new URL(req.url), action=url.searchParams.get('action');
 const sessionToken=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookie+'='))?.slice(cookie.length+1)||'';
 try {
  if(req.method==='GET') {
   const token=(req.headers.get('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookie+'='))?.slice(cookie.length+1)||'';
   if(!validSession(token))return reply({error:'Sign in to view case details.'},401);
   if(action==='session')return reply({authenticated:true});
   const id=url.searchParams.get('id');if(!/^PS-[A-F0-9]{16}$/.test(id||''))return reply({error:'Enter the case number printed on your PDF.'},400);
   const store=getStore({name:'payshield-demo-cases',consistency:'strong'});
   const found=await readCase(store,id);if(!found)return reply({error:'Case not found. Check the case number.'},404);
   return reply({...found.record,reputation:await reputation(store,found.record.receiverId)});
  }
  if(req.method!=='POST')return reply({error:'Method not allowed.'},405);
  if(Date.now()-minute>60000){minute=Date.now();writes=0;}
  if(action!=='logout' && ++writes>30){h.set('Retry-After','60');return reply({error:'Demo request limit reached. Retry in a minute.'},429);}
  if(!req.headers.get('content-type')?.includes('application/json'))return reply({error:'JSON required.'},415);
  // Bounded read, including chunked requests.
  const reader=req.body?.getReader();let size=0;const chunks=[];
  if(!reader)return reply({error:'Missing request.'},400);
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096){await reader.cancel();return reply({error:'Request too large.'},413);}chunks.push(Buffer.from(value));}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return reply({error:'Invalid JSON.'},400);}
  if(!body || typeof body!=='object' || Array.isArray(body))return reply({error:'JSON object required.'},400);
  if(action==='logout'){h.set('Set-Cookie',`${cookie}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`);return reply({ok:true});}
  if(action==='login'){
   if(!process.env.PAYSHIELD_INVESTIGATOR_PASSWORD || !process.env.PAYSHIELD_CASE_SESSION_SECRET)return reply({error:'Demo login is not configured.'},503);
   if(!safeEqual(body.username,process.env.PAYSHIELD_INVESTIGATOR_USER)||!safeEqual(body.password,process.env.PAYSHIELD_INVESTIGATOR_PASSWORD))return reply({error:'Incorrect demo credentials.'},401);
   h.set('Set-Cookie',`${cookie}=${issueSession()}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=3600`);return reply({ok:true});
  }
  if(action==='reputation'){
   let id;try{id=normalizeReceiver(body.receiverId);if(!id)throw Error();}catch{return reply({error:'Valid receiver identifier required.'},400);}
   return reply(await reputation(getStore({name:'payshield-demo-cases',consistency:'strong'}),id));
  }
  if(action==='progress'){
   const id=typeof body.caseNumber==='string'?body.caseNumber.trim().toUpperCase():'';
   if(!/^PS-[A-F0-9]{16}$/.test(id))return reply({error:'Enter the full case number from your PDF (PS- followed by 16 characters).'},400);
   const found=await readCase(getStore({name:'payshield-demo-cases',consistency:'strong'}),id);
   if(!found)return reply({error:'Case not found. Check the number printed on your PDF.'},404);
   return reply(publicProgress(found.record));
  }
  if(['note','close','reopen'].includes(action)){
   if(!validSession(sessionToken))return reply({error:'Sign in to update cases.'},401);
   if(!/^PS-[A-F0-9]{16}$/.test(body.caseNumber||''))return reply({error:'Invalid case number.'},400);
   const store=getStore({name:'payshield-demo-cases',consistency:'strong'});
   const found=await readCase(store,body.caseNumber);if(!found)return reply({error:'Case not found.'},404);
   let next;try{next=transition(found.record,action,body,process.env.PAYSHIELD_INVESTIGATOR_USER+' (shared demo account)');}catch(e){return reply({error:e.message==='CONFLICT'?'Case changed in another session. Refresh it and retry.':e.message},e.message==='CONFLICT'?409:400);}
   const saved=await store.setJSON(found.key,next,{onlyIfMatch:found.etag});
   if(!saved.modified)return reply({error:'Case changed in another session. Refresh it and retry.'},409);
   return reply({...next,reputation:await reputation(store,next.receiverId)});
  }
  if(action!=='report')return reply({error:'Unknown action.'},400);
  let record;try{record=makeCase(body);}catch{return reply({error:'Invalid report fields.'},400);}
  const store=getStore({name:'payshield-demo-cases',consistency:'strong'});
  if(record.receiverId){
   const key=receiverPrefix(record.receiverId)+record.summary.caseNumber;
   await store.setJSON(key,record,{onlyIfNew:true});
   await store.setJSON(record.summary.caseNumber,{recordKey:key},{onlyIfNew:true});
  }else await store.setJSON(record.summary.caseNumber,record,{onlyIfNew:true});
  const pdf=await reportPdf(record.summary);
  // Explicit allowlist: the sender NEVER receives the investigation object.
  return reply({summary:record.summary,pdfBase64:Buffer.from(pdf).toString('base64')},201);
 }catch {return reply({error:'Case service unavailable. Please retry.'},503);}
};
