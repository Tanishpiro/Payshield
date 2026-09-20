const {buildSync}=require('esbuild');const {chromium}=require('playwright-core');const assert=require('node:assert/strict');
(async()=>{
const files=buildSync({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import ScamReport from './components/ScamReport';import './components/payment.css';createRoot(document.getElementById('root')).render(<div className="ps-pay"><main className="ps-content"><ScamReport assessment={{score:10,amount:2000,scoreBasis:'prototype-number',reasons:[]}} mode="manual"/></main></div>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,outdir:'unused',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}}).outputFiles;
const js=files.find(f=>f.path.endsWith('.js')).text,css=files.find(f=>f.path.endsWith('.css')).text;
const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
try{const page=await browser.newPage({viewport:{width:390,height:844}});
await page.route('http://localhost:3000/__report_test',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><link rel="stylesheet" href="/__report.css"><div id="root"></div><script src="/__report.js"></script>'}));
await page.route('http://localhost:3000/__report.js',r=>r.fulfill({contentType:'application/javascript',body:js}));await page.route('http://localhost:3000/__report.css',r=>r.fulfill({contentType:'text/css',body:css}));
await page.goto('http://localhost:3000/__report_test');
for(const width of [320,390,600]){await page.setViewportSize({width,height:844});const select=await page.locator('select').boundingBox();const button=await page.getByRole('button',{name:'Create scam report'}).boundingBox();assert.ok(button.y>=select.y+select.height+8);assert.ok(Math.abs(select.width-button.width)<2);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'build-assets/report-layout-fixed.png',fullPage:true});
const responsePromise=page.waitForResponse(r=>r.url().includes('/api/cases?action=report')&&r.request().method()==='POST');await page.getByRole('button',{name:'Create scam report'}).click();const response=await responsePromise;assert.equal(response.status(),201);assert.equal(response.headers()['access-control-allow-origin'],'http://localhost:3000');await page.getByRole('button',{name:'Save / share sender PDF'}).waitFor();
console.log('PASS: live browser CORS from localhost:3000, saved report/PDF, full-width stacked controls at 320/390/600px.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
