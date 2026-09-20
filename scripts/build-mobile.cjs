require('esbuild').buildSync({entryPoints:['mobile/main.tsx'],bundle:true,minify:true,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},outfile:'android-www/app.js'});
