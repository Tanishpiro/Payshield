const $=id=>document.getElementById(id);
const showDesk=on=>{$('login').hidden=on;$('desk').hidden=!on;$('logout').hidden=!on;if(!on){$('case').hidden=true;$('case').replaceChildren();}};
async function api(action,body){const r=await fetch('/api/cases?'+action,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});const data=await r.json();if(!r.ok){if(r.status===401)showDesk(false);throw Error(data.error||'Request failed.');}return data;}
function node(tag,text){const e=document.createElement(tag);e.textContent=text;return e;}
function render(record){const out=$('case');out.replaceChildren();out.hidden=false;const s=record.summary,i=record.investigation;
 const tag=node('span','Synthetic training case');tag.className='tag';out.append(tag);const id=node('p',s.caseNumber);id.className='case-id';out.append(id,node('h3','Sender assessment'));
 const dl=node('dl','');for(const [k,v] of Object.entries({'Reported at':s.createdAt,'Status':s.status,'Amount (demo)':'INR '+s.amount,'Risk snapshot':s.score+'/100','Category':s.category,'Score basis':s.scoreNote,'Actual VPN evidence':s.vpn,'Risk factors':s.factors.join('; ')})){dl.append(node('dt',k),node('dd',String(v)));}out.append(dl,node('h3','Training dossier'),node('p',i.provenance));
 const details=node('dl','');const labels={ipAddress:'IP address',macAddress:'MAC address',vpnDetection:'VPN detection',location:'Location',phoneNumber:'Phone number',kycStatus:'KYC status',kycName:'KYC name',kycDocument:'KYC document',kycAddress:'KYC address',limitations:'Evidence limitations'};for(const [k,label]of Object.entries(labels))details.append(node('dt',label),node('dd',i[k]));out.append(details);
}
async function run(form,fn){const button=form.querySelector('button');button.disabled=true;$('status').textContent='';try{await fn();}catch(e){$('status').textContent=e.message;}finally{button.disabled=false;}}
$('login').onsubmit=e=>{e.preventDefault();run(e.currentTarget,async()=>{await api('action=login',{username:$('username').value.trim(),password:$('password').value});$('password').value='';showDesk(true);$('case-number').focus();});};
$('lookup').onsubmit=e=>{e.preventDefault();$('case').hidden=true;run(e.currentTarget,async()=>render(await api('id='+encodeURIComponent($('case-number').value.trim().toUpperCase()))));};
$('logout').onclick=async()=>{try{await api('action=logout',{});showDesk(false);}catch(e){$('status').textContent=e.message;}};
api('action=session').then(()=>showDesk(true)).catch(()=>showDesk(false));
