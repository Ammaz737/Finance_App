import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import dotenv from 'dotenv';
import {PrismaClient} from '@prisma/client';
const root=process.cwd(), out=path.join(root,'reports/qa-fixes-2026-10-06');
const config=dotenv.parse(fs.readFileSync(path.join(root,'apps/api/.env')));
const envFile=path.join(out,'environment.json');
let dbName;
if(fs.existsSync(envFile)) dbName=JSON.parse(fs.readFileSync(envFile)).database;
else {dbName='finance_fixes_'+Date.now();const prisma=new PrismaClient({datasources:{db:{url:config.DATABASE_URL}}});await prisma.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);await prisma.$disconnect();fs.writeFileSync(envFile,JSON.stringify({database:dbName,providers:'mock',api:3131,web:3132},null,2));}
const url=new URL(config.DATABASE_URL);url.pathname='/'+dbName;
const env={...process.env,...config,DATABASE_URL:url.toString(),NODE_ENV:'test',CARD_ISSUER_PROVIDER:'mock',PAYMENT_RAIL_PROVIDER:'mock',TRAVEL_PROVIDER:'mock',STRIPE_SECRET_KEY:'',DUFFEL_ACCESS_TOKEN:'',JWT_SECRET:'qa-isolated-secret',STORAGE_PATH:path.join(out,'uploads'),NODE_OPTIONS:'--require='+path.join(root,'scripts/node-userinfo-shim.cjs')};
function run(label,script,args,cwd,extra={}){return new Promise(resolve=>{const log=fs.openSync(path.join(out,label+'.log'),'w');const child=spawn(process.execPath,[path.join(root,script),...args],{cwd:path.join(root,cwd),env:{...env,...extra},stdio:['ignore',log,log]});child.on('exit',code=>{fs.closeSync(log);console.log(label+': '+code);resolve(code)});child.on('error',error=>{console.log(label+': '+error.message);resolve(99)});});}
if(process.argv.includes('--setup')) {await run('migrate','node_modules/prisma/build/index.js',['migrate','deploy','--schema','prisma/schema.prisma'],'apps/api');await run('seed','node_modules/tsx/dist/cli.mjs',['prisma/seed.ts'],'apps/api');await run('seed-beta','node_modules/tsx/dist/cli.mjs',['prisma/seed-e2e-tenant.ts'],'apps/api');}
if(!process.argv.includes('--browser')) {
 const results=await Promise.all([run('api-typecheck','node_modules/typescript/bin/tsc',['-p','tsconfig.json','--noEmit'],'apps/api'),run('web-typecheck','node_modules/typescript/bin/tsc',['-p','tsconfig.json','--noEmit'],'apps/web'),run('worker-tests','node_modules/tsx/dist/cli.mjs',['--test','src/event-catalog.test.ts'],'apps/worker')]);
 const focus=process.argv.includes('--focus');
 results.push(await run(focus?'api-regression-tests':'api-tests','node_modules/vitest/vitest.mjs',['run',...(focus?['src/tests/stripe-webhook-regression.db.test.ts']:[]),'--reporter=default','--reporter=json','--outputFile='+path.join(out,focus?'regression-results.json':'api-results.json')],'apps/api'));
 fs.writeFileSync(path.join(out,'check-status.json'),JSON.stringify(results));
 process.exitCode=results.some(x=>x!==0)?1:0;
} else {
 function server(label,script,args,cwd,extra){const log=fs.openSync(path.join(out,label+'.log'),'w');return spawn(process.execPath,[path.join(root,script),...args],{cwd:path.join(root,cwd),env:{...env,...extra},stdio:['ignore',log,log]});}
 const api=server('api-server','node_modules/tsx/dist/cli.mjs',['src/app/server.ts'],'apps/api',{PORT:'3131',APP_URL:'http://localhost:3132'});
 const web=server('web-server','apps/web/node_modules/next/dist/bin/next',['dev','-p','3132'],'apps/web',{NODE_ENV:'development',API_ORIGIN:'http://localhost:3131'});
 try{for(let i=0;i<90;i++){try{const r=await fetch('http://localhost:3132/login');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));}
 const retry=process.argv.includes('--last-failed');
 process.exitCode=await run(retry?'e2e-retry':'e2e','node_modules/playwright/cli.js',['test',...(retry?['--last-failed']:[])],'apps/web',{E2E_BASE_URL:'http://localhost:3132'});
 fs.copyFileSync(path.join(root,'apps/web/test-results/golden-report.json'),path.join(out,retry?'e2e-retry-results.json':'e2e-results.json'));
 }finally{api.kill();web.kill();}
}
