"use client";
import { useState } from 'react';
import './scam-report.css';
import { CapacitorHttp } from '@capacitor/core';
import { isNativeAndroid, shareNativeReport } from '@/lib/native';

export default function ScamReport({ assessment, mode, receiverId }: { assessment: any; mode: string; receiverId: string }) {
 const [category,setCategory]=useState('suspicious-request'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [receipt,setReceipt]=useState<any>(null);
 const [review,setReview]=useState(false),[consent,setConsent]=useState(false);
 async function submit(){setBusy(true);setError('');try{
   const body={receiverId,amount:assessment.amount,score:assessment.score,mode,category,vpn:assessment.reportVpn??'unknown',basis:assessment.scoreBasis?.includes('number')?'number':assessment.scoreBasis?.includes('qr')?'qr':'risk-engine',reasonCodes:(assessment.reasons??[]).slice(0,8).map((r:any)=>r.code)};
   const url='https://payshield-ai-police.netlify.app/api/cases?action=report';let data;
   if(isNativeAndroid()){const r=await CapacitorHttp.post({url,headers:{'Content-Type':'application/json'},data:body});if(r.status!==201)throw Error(r.data?.error||'Could not file the report.');data=r.data;}
   else{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});data=await r.json();if(!r.ok)throw Error(data.error);}
   setReceipt(data);
 }catch(e){setError(e instanceof TypeError ? 'Could not connect to the report service. Check your internet connection and reload the page before retrying.' : e instanceof Error?e.message:'Report could not be saved.');}finally{setBusy(false);}}
 async function download(){try{if(isNativeAndroid())await shareNativeReport(receipt.pdfBase64,receipt.summary.caseNumber);else{const bytes=Uint8Array.from(atob(receipt.pdfBase64),(c)=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=receipt.summary.caseNumber+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}}catch(e){setError(e instanceof Error?e.message:'Could not open PDF.');}}
 return <section className="ps-card ps-report"><h2>Report a suspected scam</h2><p className="ps-muted">Create a demo case with a private sender PDF. A report does not automatically mark someone as a scammer.</p>
 {!receipt ? <><label className="ps-label" htmlFor="report-category">What happened?</label><select id="report-category" value={category} onChange={e=>setCategory(e.target.value)}><option value="suspicious-request">Suspicious payment request</option><option value="impersonation">Impersonation</option><option value="goods-not-received">Goods not received</option><option value="other">Other concern</option></select><button className="ps-secondary" onClick={()=>setReview(true)} hidden={review}>Create scam report</button>{review&&<div className="ps-submit-case"><h3>Submit a case for review</h3><p className="ps-muted">This creates a demo case in the investigator’s New cases inbox and a sender PDF. It is not an official police complaint.</p><label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} /> Send this case for investigator review</label><button className="ps-primary" disabled={busy||!consent} onClick={submit}>{busy?'Submitting case…':'Submit case'}</button><button className="ps-secondary" disabled={busy} onClick={()=>{setReview(false);setConsent(false);}}>Cancel</button></div>}</> : <><p role="status">Case submitted to investigators. Track progress with <strong>{receipt.summary.caseNumber}</strong></p><p className="ps-muted">Risk: {receipt.summary.score}/100 · VPN: {receipt.summary.vpn}</p><ul>{receipt.summary.factors.map((x:string)=><li key={x}>{x}</li>)}</ul><button className="ps-secondary" onClick={download}>Save / share sender PDF</button><p className="ps-muted">IP, MAC, phone, location and KYC details are excluded from this copy.</p></>}
 {error&&<p role="alert" className="ps-error">{error}</p>}</section>;
}
