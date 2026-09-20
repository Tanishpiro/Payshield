const assert=require('node:assert/strict');const fs=require('node:fs');const {chromium}=require('playwright-core');
(async()=>{
 const base='https://payshield-ai-police.netlify.app';
 const r=await fetch(base+'/api/cases?action=report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({score:80,amount:2000,mode:'qr',category:'suspicious-request',basis:'qr',vpn:'detected',reasonCodes:['DEV_RISK','UNKNOWN']})});const data=await r.json();assert.equal(r.status,201,JSON.stringify(data));
 assert.deepEqual(Object.keys(data).sort(),['pdfBase64','summary']);assert.ok(!JSON.stringify(data.summary).includes('192.0.2.42'));
 fs.writeFileSync('build-assets/live-sender-report.pdf',Buffer.from(data.pdfBase64,'base64'));fs.writeFileSync('build-assets/live-case.json',JSON.stringify({caseNumber:data.summary.caseNumber}));
 const unauth=await fetch(base+'/api/cases?id='+data.summary.caseNumber);assert.equal(unauth.status,401);
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{const page=await browser.newPage({viewport:{width:1280,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/investigator');
 await page.getByLabel('Username',{exact:true}).fill('cyber.demo');await page.getByLabel('Password',{exact:true}).fill('wrong');await page.getByRole('button',{name:'Sign in to case desk'}).click();await page.getByText('Incorrect demo credentials.',{exact:true}).waitFor();
 await page.getByLabel('Password',{exact:true}).fill('PayShieldDemo!24');await page.getByRole('button',{name:'Sign in to case desk'}).click();await page.getByLabel('Case number',{exact:true}).fill(data.summary.caseNumber);await page.getByRole('button',{name:'Open case',exact:true}).click();await page.getByText('192.0.2.42 (documentation-only IP)',{exact:true}).waitFor();
 const cookies=await page.context().cookies();const c=cookies.find(c=>c.name==='ps_investigator');assert.ok(c?.httpOnly&&c.secure);await page.screenshot({path:'build-assets/investigator-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'build-assets/investigator-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Sign in to case desk'}).waitFor();const denied=await page.request.get(base+'/api/cases?id='+data.summary.caseNumber);assert.equal(denied.status(),401);assert.deepEqual(errors,[]);
 console.log('PASS LIVE: persistent report '+data.summary.caseNumber+', sender PDF, redacted response, rejected wrong password, authenticated case lookup, HttpOnly cookie, mobile layout and logout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
