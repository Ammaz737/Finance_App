const {assertRuntimeConfiguration}=await import('../../apps/api/src/config/env.ts');
const {bootstrap}=await import('../../apps/api/src/app/bootstrap.ts');
const {createApp}=await import('../../apps/api/src/app/app.ts');
assertRuntimeConfiguration();await bootstrap();createApp().listen(Number(process.env.PORT),()=>console.log('QA isolated API on '+process.env.PORT));
