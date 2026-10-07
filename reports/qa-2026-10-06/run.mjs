import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import dotenv from 'dotenv';
import {PrismaClient} from '@prisma/client';
const root=process.cwd(), out=path.join(root,'reports/qa-2026-10-06');
const config=dotenv.parse(fs.readFileSync(path.join(root,'apps/api/.env')));
const dbName='finance_qa_'+Date.now();
const prisma=new PrismaClient({datasources:{db:{url:config.DATABASE_URL}}});
await prisma.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
await prisma.$disconnect();
const url=new URL(config.DATABASE_URL);url.pathname='/'+dbName;
const env={...process.env,...config,DATABASE_URL:url.toString(),NODE_ENV:'test',CARD_ISSUER_PROVIDER:'mock',PAYMENT_RAIL_PROVIDER:'mock',TRAVEL_PROVIDER:'mock',STRIPE_SECRET_KEY:'',DUFFEL_ACCESS_TOKEN:'',JWT_SECRET:'qa-isolated-secret',NODE_OPTIONS:'--require='+path.join(root,'scripts/node-userinfo-shim.cjs')};
fs.writeFileSync(path.join(out,'environment.json'),JSON.stringify({database:dbName,providers:'mock',api:3111,web:3112},null,2));
function run(label,script,args,cwd,extra={}){return new Promise(resolve=>{const log=fs.openSync(path.join(out,label+'.log'),'w');const child=spawn(process.execPath,[path.join(root,script),...args],{cwd:path.join(root,cwd),env:{...env,...extra},stdio:['ignore',log,log]});child.on('exit',code=>{fs.closeSync(log);console.log(label+': '+code);resolve(code)});child.on('error',error=>{console.log(label+': '+error.message);resolve(99)});});}
await run('migrate','node_modules/prisma/build/index.js',['migrate','deploy','--schema','prisma/schema.prisma'],'apps/api');
await run('seed','node_modules/tsx/dist/cli.mjs',['prisma/seed.ts'],'apps/api');
await run('seed-beta','node_modules/tsx/dist/cli.mjs',['prisma/seed-e2e-tenant.ts'],'apps/api');
await run('api-tests','node_modules/vitest/vitest.mjs',['run','--reporter=default','--reporter=json','--outputFile='+path.join(out,'api-results.json')],'apps/api');
function server(label,script,args,cwd,extra){const log=fs.openSync(path.join(out,label+'.log'),'w');return spawn(process.execPath,[path.join(root,script),...args],{cwd:path.join(root,cwd),env:{...env,...extra},stdio:['ignore',log,log]});}
const api=server('api-server','node_modules/tsx/dist/cli.mjs',['src/app/server.ts'],'apps/api',{PORT:'3111',APP_URL:'http://localhost:3112'});
const web=server('web-server','apps/web/node_modules/next/dist/bin/next',['dev','-p','3112'],'apps/web',{NODE_ENV:'development',API_ORIGIN:'http://localhost:3111'});
try{for(let i=0;i<60;i++){try{const r=await fetch('http://localhost:3112/login');if(r.ok)break;}catch{}await new Promise(r=>setTimeout(r,1000));}
await run('e2e','node_modules/playwright/cli.js',['test'],'apps/web',{E2E_BASE_URL:'http://localhost:3112'});
if(fs.existsSync(path.join(root,'apps/web/test-results/golden-report.json')))fs.copyFileSync(path.join(root,'apps/web/test-results/golden-report.json'),path.join(out,'e2e-results.json'));
}finally{api.kill();web.kill();}
