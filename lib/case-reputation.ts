import { CapacitorHttp } from '@capacitor/core';
import { isNativeAndroid } from './native';

// Server-owned investigator findings override fixed prototype profiles.
export async function applyCaseReputation(receiverId: string, assessment: any) {
 const url='https://payshield-ai-police.netlify.app/api/cases?action=reputation';
 let data;
 try {
  if(isNativeAndroid()){
   const r=await CapacitorHttp.post({url,headers:{'Content-Type':'application/json'},data:{receiverId},connectTimeout:10000,readTimeout:10000});
   if(r.status!==200)throw Error();data=r.data;
  }else{
   const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiverId}),signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error();data=await r.json();
  }
  if(!Number.isInteger(data.confirmedCases)||data.confirmedCases<0||data.riskFloor!==(data.confirmedCases?95:0)||data.trustCeiling!==(data.confirmedCases?10:100))throw Error();
 }catch{throw Error('Receiver case checks are unavailable. Check your connection and retry; payment has not been approved.');}
 if(!data.confirmedCases)return assessment;
 return {...assessment,score:Math.max(95,assessment.score),trustScore:Math.min(10,assessment.trustScore),level:'critical',action:'block',headline:'Confirmed demo fraud finding — payment blocked',reasons:[{code:'CASE_CONFIRMED',label:'Confirmed investigator finding',detail:'Receiver trust capped at 10; payment risk raised to at least 95 after case review.',points:95},...(assessment.reasons||[])]};
}
