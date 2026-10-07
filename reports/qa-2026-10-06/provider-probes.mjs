import fs from 'node:fs';
import dotenv from 'dotenv';
import Stripe from 'stripe';
const config=dotenv.parse(fs.readFileSync('apps/api/.env'));
const output=[];
const stripe=new Stripe(config.STRIPE_SECRET_KEY,{timeout:15000,maxNetworkRetries:0});
for(const [label,fn] of [['Stripe balance',()=>stripe.balance.retrieve()],['Stripe configured financial account',()=>stripe.rawRequest('GET','/v2/money_management/financial_accounts/'+config.STRIPE_FINANCIAL_ACCOUNT_ID,undefined,{additionalHeaders:{'Stripe-Version':'2025-12-15.preview'}})],['Stripe configured bill-pay card',()=>stripe.issuing.cards.retrieve(config.STRIPE_BILL_PAY_CARD_ID)]]){
try{const r=await fn();output.push({label,status:'PASS',livemode:r.livemode,providerStatus:r.status,currency:r.currency});}catch(e){output.push({label,status:'BLOCKED',type:e.type,code:e.code,message:String(e.message).replace(/(?:sk|rk)_(?:live|test)_\S+/g,'[REDACTED]')});}}
try{const r=await fetch('https://api.duffel.com/air/airports?limit=1',{headers:{Authorization:'Bearer '+config.DUFFEL_ACCESS_TOKEN,'Duffel-Version':config.DUFFEL_API_VERSION||'v2',Accept:'application/json'},signal:AbortSignal.timeout(15000)});const body=await r.json();output.push({label:'Duffel read-only authentication',status:r.ok?'PASS':'BLOCKED',http:r.status,errors:body.errors?.map(e=>({code:e.code,message:e.message}))});}catch(e){output.push({label:'Duffel read-only authentication',status:'BLOCKED',message:e.message});}
fs.writeFileSync('reports/qa-2026-10-06/provider-probes.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
