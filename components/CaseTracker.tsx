"use client";
import { useEffect, useRef, useState } from 'react';
import { CapacitorHttp } from '@capacitor/core';
import { isNativeAndroid } from '@/lib/native';
import './case-tracker.css';

type Progress={caseNumber:string;status:string;createdAt:string;updatedAt:string;outcome:string|null;timeline:{at:string;label:string;outcome?:string;note?:string}[]};
const date=(value:string)=>new Date(value).toLocaleString();
export default function CaseTracker(){
 const [open,setOpen]=useState(false),[number,setNumber]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Progress|null>(null);
 const generation=useRef(0);
 useEffect(()=>()=>{generation.current++;},[]);
 function close(){generation.current++;setOpen(false);setBusy(false);setError('');setResult(null);}
 async function lookup(){
  const caseNumber=number.trim().toUpperCase();setError('');setResult(null);
  if(!/^PS-[A-F0-9]{16}$/.test(caseNumber)){setError('Enter the full case number from your PDF, for example PS- followed by 16 characters.');return;}
  const id=++generation.current;setBusy(true);
  try{
   const url='https://payshield-ai-police.netlify.app/api/cases?action=progress';let data;
   if(isNativeAndroid()){const r=await CapacitorHttp.post({url,headers:{'Content-Type':'application/json'},data:{caseNumber},connectTimeout:10000,readTimeout:10000});if(r.status!==200)throw Error(r.data?.error||'Case lookup unavailable. Please retry.');data=r.data;}
   else{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({caseNumber}),signal:AbortSignal.timeout(10000)});data=await r.json();if(!r.ok)throw Error(data.error||'Case lookup unavailable. Please retry.');}
   if(id===generation.current)setResult(data);
  }catch(e){if(id===generation.current)setError(e instanceof TypeError || (e instanceof DOMException && e.name==='TimeoutError')?'Could not connect. Check your internet connection and retry.':e instanceof Error?e.message:'Case lookup unavailable. Please retry.');}
  finally{if(id===generation.current)setBusy(false);}
 }
 return <section className="ps-card ps-case-tracker"><button type="button" className="ps-case-toggle" aria-expanded={open} aria-controls="ps-case-panel" onClick={()=>open?close():setOpen(true)}><span><strong>Track case</strong><small>Check progress using your report case number</small></span><span aria-hidden="true">{open?'−':'+'}</span></button>
 {open&&<div id="ps-case-panel"><form onSubmit={e=>{e.preventDefault();void lookup();}}><label className="ps-label" htmlFor="ps-case-number">Case number</label><input id="ps-case-number" value={number} onChange={e=>{generation.current++;setBusy(false);setNumber(e.target.value.toUpperCase());setResult(null);setError('');}} placeholder="PS-…" maxLength={19} autoComplete="off" autoCapitalize="characters" spellCheck={false} required/><button className="ps-primary" disabled={busy} type="submit">{busy?'Checking progress…':result?'Refresh progress':'Check progress'}</button></form><p className="ps-muted">Keep your case number private. Anyone with it can view this limited demo status. Private notes and identity details are not shown.</p>
 {error&&<p className="ps-error" role="alert">{error}</p>}
 {result&&<div className="ps-case-result" aria-live="polite"><span className="ps-tag">{result.status}</span><h3>{result.caseNumber}</h3>{result.outcome&&<p>{result.outcome}</p>}<p className="ps-muted">Last update: {date(result.updatedAt)}</p><ol>{result.timeline.map((event,i)=><li key={i}><strong>{event.label}</strong><time dateTime={event.at}>{date(event.at)}</time>{event.note&&<p className="ps-shared-note">{event.note}</p>}{event.outcome&&<p>{event.outcome}</p>}</li>)}</ol><p className="ps-muted">Synthetic case progress, not an official police investigation. Refresh to check for new updates.</p></div>}
 </div>}</section>;
}
