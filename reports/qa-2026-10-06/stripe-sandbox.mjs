import fs from 'node:fs';
import dotenv from 'dotenv';
import Stripe from 'stripe';
const cfg=dotenv.parse(fs.readFileSync('apps/api/.env'));if(!cfg.STRIPE_SECRET_KEY.startsWith('sk_test_'))throw new Error('QA requires Stripe test mode');
const info=JSON.parse(fs.readFileSync('reports/qa-2026-10-06/environment.json'));const u=new URL(cfg.DATABASE_URL);u.pathname='/'+info.database;
Object.assign(process.env,cfg,{DATABASE_URL:u.toString(),CARD_ISSUER_PROVIDER:'stripe',PAYMENT_RAIL_PROVIDER:'stripe',TRAVEL_PROVIDER:'mock'});
const {StripePaymentRailAdapter}=await import('../../apps/api/src/integrations/payment-rail/stripe.payment-rail.adapter.ts');
const {StripeCardIssuerAdapter}=await import('../../apps/api/src/integrations/card-issuer/stripe.card-issuer.adapter.ts');
const {processStripeIssuingWebhook}=await import('../../apps/api/src/modules/cards/application/stripe-issuing-webhook.ts');
const {prisma}=await import('../../apps/api/src/database/client.ts');
const output=[];const stripe=new Stripe(cfg.STRIPE_SECRET_KEY,{timeout:20000,maxNetworkRetries:0});
async function probe(name,fn){try{const result=await fn();output.push({name,status:'PASS',result});return result;}catch(e){output.push({name,status:'FAIL',message:e.message});}}
const rail=new StripePaymentRailAdapter(cfg.STRIPE_SECRET_KEY);const paymentId='qa-sandbox-'+Date.now();
const release1=await probe('Stripe bill-pay release $1',()=>rail.release({paymentId,amount:'1.00',currency:'USD',rail:'ACH',description:paymentId}));
const release2=await probe('Stripe same paymentId replay $1',()=>rail.release({paymentId,amount:'1.00',currency:'USD',rail:'ACH',description:paymentId}));
if(release1?.providerRef)await probe('Stripe settlement lookup',()=>rail.settle({providerRef:release1.providerRef}));
output.push({name:'Payment release idempotency',status:release1?.providerRef&&release1.providerRef===release2?.providerRef?'PASS':'FAIL',result:{first:release1?.providerRef,second:release2?.providerRef}});
const issuer=new StripeCardIssuerAdapter(cfg.STRIPE_SECRET_KEY,cfg.STRIPE_FINANCIAL_ACCOUNT_ID);let remote;
const org=await prisma.organization.findUniqueOrThrow({where:{slug:'acme'}});const entity=await prisma.legalEntity.findFirstOrThrow({where:{organizationId:org.id,country:'US'}});const user=await prisma.user.findFirstOrThrow({where:{organizationId:org.id,email:'employee@acme.test'}});
const fund=await prisma.fund.create({data:{organizationId:org.id,legalEntityId:entity.id,ownerId:user.id,name:paymentId,availableAmount:'10',limitAmount:'10',currency:'USD'}});
const local=await prisma.card.create({data:{organizationId:org.id,legalEntityId:entity.id,fundId:fund.id,holderId:user.id,type:'VIRTUAL',last4:'0000',token:paymentId}});
const holder=await probe('Stripe cardholder create',()=>issuer.createCardholder({appUserId:local.id,email:paymentId+'@acme.test',firstName:'QA',lastName:'Sandbox',billing:{line1:'1 Market St',city:'San Francisco',state:'CA',postalCode:'94105',country:'US'},metadata:{purpose:'qa_2026_10_06'}}));
if(holder){remote=await probe('Stripe virtual card issue',()=>issuer.createCard({appCardId:local.id,appUserId:user.id,businessId:org.id,providerCardholderId:holder.providerCardholderId,type:'virtual',currency:'usd',status:'active',idempotencyKey:paymentId,metadata:{purpose:'qa_2026_10_06'}}));}
if(remote){await prisma.card.update({where:{id:local.id},data:{stripeCardId:remote.providerCardId,providerRef:remote.providerCardId,provider:'stripe',last4:remote.last4}});
await probe('Stripe freeze',()=>issuer.freezeCard(remote.providerCardId));await probe('Stripe unfreeze',()=>issuer.unfreezeCard(remote.providerCardId));
const txn=await probe('Stripe force capture $1',async()=>{const t=await stripe.testHelpers.issuing.transactions.createForceCapture({card:remote.providerCardId,amount:100,currency:'usd',merchant_data:{name:paymentId,category:'miscellaneous_specialty_retail'}});return {id:t.id};});
if(txn){const object=await stripe.issuing.transactions.retrieve(txn.id);const event={id:'evt_qa_'+Date.now(),object:'event',type:'issuing_transaction.created',livemode:false,created:Math.floor(Date.now()/1000),data:{object}};const payload=JSON.stringify(event);const signature=stripe.webhooks.generateTestHeaderString({payload,secret:cfg.STRIPE_WEBHOOK_SECRET});
await probe('Signed transaction webhook import',()=>processStripeIssuingWebhook(Buffer.from(payload),signature));await probe('Same signed event replay',()=>processStripeIssuingWebhook(Buffer.from(payload),signature));
await probe('Invalid webhook signature rejected',async()=>{try{await processStripeIssuingWebhook(Buffer.from(payload),'t=1,v1=invalid');return {rejected:false};}catch(e){return {rejected:true,code:e.code};}});
const localTxn=await prisma.txn.findFirst({where:{stripeTransactionId:txn.id}});output.push({name:'Capture to expense and accounting',status:localTxn?'PASS':'FAIL',result:{transaction:!!localTxn,expense:!!localTxn&&!!await prisma.expense.findFirst({where:{transactionId:localTxn.id}}),accounting:!!localTxn&&!!await prisma.accountingEntry.findFirst({where:{sourceId:localTxn.id}})}});}
await probe('Stripe test card cleanup cancel',()=>issuer.cancelCard(remote.providerCardId));}
fs.writeFileSync('reports/qa-2026-10-06/stripe-sandbox.json',JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));await prisma.$disconnect();
