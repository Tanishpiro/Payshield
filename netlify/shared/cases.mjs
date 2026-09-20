import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { normalizeReceiver, hydrate } from './workflow.mjs';

export const FACTORS = {
 AGE_VERY_NEW: 'New receiver account', AGE_NEW: 'Recently opened account', KYC_NONE: 'Identity verification incomplete', KYC_PARTIAL: 'Identity partially verified',
 VEL_EXTREME: 'Unusually high payment activity', VEL_HIGH: 'High payment activity', VEL_SPIKE: 'Sudden payment activity increase', VEL_SENDERS: 'Many senders paying a new account',
 BEH_AMOUNT: 'Unusual payment amount', BEH_HIGH_NEW: 'Large payment to a new account', SIG_CONFIRMED: 'Confirmed fraud signal in demo intelligence', SIG_REPORTS: 'Unconfirmed complaints',
 DEV_RISK: 'Device or network risk indicator', DEV_SHARED: 'Device shared across accounts', NET_CLUSTER: 'Suspected fraud network link', NET_LINK: 'Link to flagged account', UNKNOWN: 'Insufficient receiver intelligence', NO_HISTORY: 'No payment history',
};
export function makeCase(body) {
 if (!body || !Number.isInteger(body.score) || body.score < 0 || body.score > 100 || !Number.isFinite(body.amount) || body.amount <= 0 || body.amount > 200000 || !['manual','qr','voice'].includes(body.mode) || !['suspicious-request','impersonation','goods-not-received','other'].includes(body.category) || !Array.isArray(body.reasonCodes) || body.reasonCodes.length > 8 || body.reasonCodes.some(x => typeof x !== 'string' || x.length > 50)) throw Error('Invalid report fields.');
 const factors = [...new Set(body.reasonCodes)].filter(x => Object.hasOwn(FACTORS, x)).map(x => FACTORS[x]);
 const basis = body.basis === 'number' || body.basis === 'qr' ? body.basis : 'risk-engine';
 const summary = { caseNumber: 'PS-' + randomBytes(8).toString('hex').toUpperCase(), createdAt: new Date().toISOString(), status: 'Reported - not adjudicated', demo: true, amount: body.amount, score: body.score, mode: body.mode, category: body.category, basis,
   factors: factors.length ? factors : ['Prototype score supplied by the demo app'], vpn: body.vpn === 'detected' ? 'Detected in demo device data (not independently verified)' : body.vpn === 'not-detected' ? 'Not detected in demo device data (not independently verified)' : 'Unknown - receiver VPN telemetry not collected',
   scoreNote: basis === 'number' || basis === 'qr' ? 'Fixed prototype score, not a measured fraud probability.' : 'Demo app assessment snapshot; not independently verified by investigators.' };
 // Synthetic dossier, deliberately unrelated to any real phone, IP, identity or receiver handle.
 const investigation = { provenance: 'Synthetic training fixture. These are not the reported receiver\'s actual records.',
   ipAddress: '192.0.2.42 (documentation-only IP)', macAddress: '02:00:00:00:00:42 (dummy device identifier)',
   vpnDetection: 'Simulated VPN flag: yes. Actual receiver status: unknown.', location: 'Demo location: New Delhi, India (not geolocated)',
   phoneNumber: '+91 XXXXX XX042 (dummy, non-dialable)', kycStatus: 'Demo KYC: partially verified', kycName: 'Example Receiver 042 (fictional)',
   kycDocument: 'DEMO-KYC-0042 (not a government identifier)', kycAddress: '42 Example Lane, Demo District, New Delhi (fictional)',
   limitations: 'Payment identifiers do not expose remote MAC addresses or KYC records. Real records require authorized partner evidence.' };
 return hydrate({ summary, investigation, receiverId: normalizeReceiver(body.receiverId) });
}
const secret = () => process.env.PAYSHIELD_CASE_SESSION_SECRET;
export function issueSession() {
 if (!secret() || secret().length < 32) throw Error('Session configuration missing');
 const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 3600000, role: 'demo-investigator', nonce: randomBytes(16).toString('hex') })).toString('base64url');
 return payload + '.' + createHmac('sha256', secret()).update(payload).digest('base64url');
}
export function validSession(token) {
 try { if (!secret()) return false; const [p,s] = token.split('.'); const sig = createHmac('sha256', secret()).update(p).digest('base64url');
   if (!safeEqual(s,sig)) return false; const data = JSON.parse(Buffer.from(p,'base64url')); return data.role === 'demo-investigator' && data.exp > Date.now();
 } catch { return false; }
}
export function safeEqual(a,b) { if (typeof a !== 'string' || typeof b !== 'string') return false; const x=Buffer.from(a),y=Buffer.from(b); return x.length === y.length && timingSafeEqual(x,y); }
export async function reportPdf(summary) {
 const doc = await PDFDocument.create(); const page = doc.addPage([595,842]); const regular=await doc.embedFont(StandardFonts.Helvetica), bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const navy=rgb(.07,.16,.29), blue=rgb(.08,.32,.7),muted=rgb(.32,.4,.5); let y=578;
 page.drawRectangle({x:0,y:738,width:595,height:104,color:navy});page.drawRectangle({x:0,y:738,width:595,height:5,color:blue});
 page.drawText('PayShield',{x:38,y:799,size:26,font:bold,color:rgb(1,1,1)});
 page.drawText('Sender incident report',{x:38,y:774,size:12,font:regular,color:rgb(.78,.85,.95)});
 page.drawText('DEMO / PRIVATE COPY',{x:405,y:800,size:9,font:bold,color:rgb(.78,.85,.95)});
 page.drawText('Case reference',{x:38,y:708,size:10,font:regular,color:muted});
 page.drawText(summary.caseNumber,{x:38,y:685,size:18,font:bold,color:navy});
 page.drawText('Created '+summary.createdAt.slice(0,16).replace('T',' ')+' UTC',{x:38,y:665,size:10,font:regular,color:muted});
 page.drawRectangle({x:38,y:597,width:519,height:50,color:rgb(.94,.96,.99)});
 page.drawText('Amount (simulated)',{x:52,y:629,size:9,font:regular,color:muted});page.drawText('INR '+summary.amount.toFixed(2),{x:52,y:610,size:14,font:bold,color:navy});
 page.drawText('Risk assessment',{x:247,y:629,size:9,font:regular,color:muted});
 const riskColor=summary.score>90?rgb(.7,.14,.18):summary.score>70?rgb(.67,.33,.04):summary.score>30?rgb(.55,.41,.02):rgb(.05,.42,.31);
 page.drawText(summary.score+'/100',{x:247,y:610,size:16,font:bold,color:riskColor});
 page.drawText('Case status',{x:402,y:629,size:9,font:regular,color:muted});page.drawText('Awaiting review',{x:402,y:610,size:12,font:bold,color:navy});
 const line=(text,size=11,font=regular,color=navy)=>{ const words=String(text).split(' '); let row=''; for(const word of words){ if(font.widthOfTextAtSize(row+' '+word,size)>505){page.drawText(row,{x:42,y,size,font,color});y-=17;row=word;}else row+=(row?' ':'')+word;}if(row){page.drawText(row,{x:42,y,size,font,color});y-=20;} };
 line('Report reason: '+summary.category.replaceAll('-',' '),11,bold);line(summary.scoreNote,10,regular,muted);y-=7;
 line('Assessment factors',13,bold,blue);summary.factors.forEach(x=>line('- '+x,10));y-=7;
 line('Network indicator',13,bold,blue);line('VPN: '+summary.vpn,10);y-=7;
 line('Your privacy',13,bold,blue);line('This copy excludes IP addresses, device identifiers, phone numbers, location and KYC records. A report is an allegation, not proof of fraud.',10);
 page.drawRectangle({x:38,y:79,width:519,height:78,color:rgb(.94,.96,.99)});
 page.drawText('Keep this case number for follow-up',{x:52,y:134,size:11,font:bold,color:navy});
 page.drawText('Investigator portal: payshield-ai-police.netlify.app/investigator',{x:52,y:116,size:9,font:regular,color:muted});
 page.drawText('All investigator identity and network records are fictional training data.',{x:52,y:98,size:9,font:regular,color:muted});
 page.drawText('Prototype only. No official police complaint has been filed.',{x:38,y:42,size:9,font:regular,color:muted});
 page.drawText('1 / 1',{x:530,y:42,size:9,font:regular,color:muted});
 return doc.save();
}
