const {buildSync}=require('esbuild');
const {chromium}=require('playwright-core');
const http=require('node:http');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const bundle=await require('esbuild').build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import PayApp from './components/PayApp';window.test={answers:[],verified:0,ok:true,score:10};createRoot(document.getElementById('root')).render(<PayApp handles={[]} analyse={async(h,a)=>({receiver:{handle:h,display_name:'Suresh'},assessment:{amount:a,score:window.test.score,level:window.test.score>90?'critical':'low',action:window.test.score>90?'block':'allow',synthetic:true,scoreBasis:'prototype-number',reasons:[],positives:[],headline:'Demo check'}})}/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'test-out',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'mock-hardware',setup(b){b.onLoad({filter:/[\\/]lib[\\/]native\.ts$/},()=>({contents:`export const isNativeAndroid=()=>false;export async function listenForPayment(){return window.test.answers.shift()||'cancel'};export async function verifyOwner(){window.test.verified++;return window.test.ok};export async function stopNativeAudio(){};export async function cancelListening(){};export async function playNativeAudio(){};export async function shareNativeReport(){};`,loader:'js'}));}}]});
 const js=bundle.outputFiles.find(x=>x.path.endsWith('.js')).text,css=bundle.outputFiles.find(x=>x.path.endsWith('.css')).text;
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/app.js'?'application/javascript':req.url==='/app.css'?'text/css':'text/html');res.end(req.url==='/app.js'?js:req.url==='/app.css'?css:'<!doctype html><link rel="stylesheet" href="/app.css"><div id="root"></div><script src="/app.js"></script>');}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{sessionStorage.setItem('ps-voice-code','test-access-code-1234567890');HTMLMediaElement.prototype.play=function(){return Promise.resolve()};});
 await page.route('**/api/voice',r=>r.fulfill({status:200,contentType:'audio/mpeg',body:fs.readFileSync('build-assets/elevenlabs-preview.mp3')}));
 await page.goto('http://127.0.0.1:'+server.address().port);
 async function start(score,answer){await page.evaluate(([s,a])=>{window.test.score=s;window.test.answers=['send 2000 rupees from HDFC to Suresh',a]},[score,answer]);await page.getByRole('button',{name:'Voice pay',exact:true}).click();await page.locator('audio[src]').waitFor();await page.waitForTimeout(150);}
 await start(10,'do not approve');assert.equal(await page.getByRole('heading',{name:'Paying Suresh'}).count(),0);await page.locator('audio').dispatchEvent('ended');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.test.verified),0);assert.ok(await page.getByRole('button',{name:'Voice pay',exact:true}).isVisible());
 await start(10,'approve');await page.locator('audio').dispatchEvent('ended');await page.getByRole('heading',{name:'Demo successful'}).waitFor();assert.equal(await page.evaluate(()=>window.test.verified),1);assert.equal(await page.getByText('No compatible UPI app is available.',{exact:true}).count(),0);
 await page.screenshot({path:'build-assets/voice-demo-success.png',fullPage:true});await page.getByRole('button',{name:'Back to payments',exact:true}).click();
 await start(95,'approve');await page.locator('audio').dispatchEvent('ended');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.test.verified),1);assert.equal(await page.getByRole('heading',{name:'Demo successful'}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS (mock hardware): in-place voice, negative approval cancels, biometric-before-success, no UPI handoff, >90 never authenticates.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
