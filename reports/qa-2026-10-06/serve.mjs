import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import dotenv from 'dotenv';
const root=process.cwd(),out=path.join(root,'reports/qa-2026-10-06');const cfg=dotenv.parse(fs.readFileSync('apps/api/.env'));const info=JSON.parse(fs.readFileSync(path.join(out,'environment.json')));const u=new URL(cfg.DATABASE_URL);u.pathname='/'+info.database;
const env={...process.env,...cfg,DATABASE_URL:u.toString(),NODE_ENV:'test',CARD_ISSUER_PROVIDER:'mock',PAYMENT_RAIL_PROVIDER:'mock',TRAVEL_PROVIDER:'mock',STRIPE_SECRET_KEY:'',DUFFEL_ACCESS_TOKEN:'',JWT_SECRET:'qa-isolated-secret',STORAGE_PATH:path.join(out,'uploads'),NODE_OPTIONS:'--require='+path.join(root,'scripts/node-userinfo-shim.cjs')};
function child(label,script,args,cwd,extra={}){const fd=fs.openSync(path.join(out,label+'.log'),'w');return spawn(process.execPath,[path.join(root,script),...args],{cwd:path.join(root,cwd),env:{...env,...extra},stdio:['ignore',fd,fd]});}
const api=child('api-isolated-server','node_modules/tsx/dist/cli.mjs',['reports/qa-2026-10-06/api-isolated.mjs'],'.',{PORT:'3121',APP_URL:'http://localhost:3122'});
const web=child('web-isolated-server','apps/web/node_modules/next/dist/bin/next',['dev','-p','3122'],'apps/web',{NODE_ENV:'development',API_ORIGIN:'http://localhost:3121'});
fs.writeFileSync(path.join(out,'qa-pids.json'),JSON.stringify({api:api.pid,web:web.pid}));
await new Promise(r=>setTimeout(r,240000));api.kill();web.kill();
