import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=['apps/api/src/modules/cards/application/stripe-issuing-webhook.ts','apps/api/src/tests/stripe-webhook-regression.db.test.ts','apps/web/e2e/golden-flows.spec.ts','apps/web/e2e/p0-5-ux.spec.ts','apps/web/src/app/app/travel/trips/[id]/page.tsx'];
for(const file of files)fs.writeFileSync(file,fs.readFileSync(file,'utf8').split(/\r?\n/).map(line=>line.trimEnd()).join('\n').trimEnd()+'\n');
for(const file of ['apps/web/tsconfig.tsbuildinfo','apps/web/test-results/.last-run.json','apps/web/test-results/golden-report.json']) {
 const original=spawnSync('git',['show','HEAD:'+file],{encoding:null,maxBuffer:20*1024*1024});
 if(original.status===0)fs.writeFileSync(file,original.stdout);
}
