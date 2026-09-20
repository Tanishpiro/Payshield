const fs=require('node:fs');const path=require('node:path');
const target='netlify-static/dashboard-assets';fs.mkdirSync(target,{recursive:true});
require('esbuild').buildSync({entryPoints:['mobile/main.tsx'],bundle:true,minify:true,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},outfile:path.join(target,'app.js')});
// The bundled component stylesheet is supplemented by the shared app shell.
fs.copyFileSync('android-www/app.css',path.join(target,'app.css'));
fs.copyFileSync('components/payment.css',path.join(target,'payment.css'));
