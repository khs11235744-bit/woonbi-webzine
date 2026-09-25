'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');

const root=path.resolve(__dirname,'..');
const liveConfig=path.join(root,'deploy','firebase-live-config.json');
const config=JSON.parse(fs.readFileSync(liveConfig,'utf8').replace(/^\uFEFF/,''));
const projectId=config?.firebase?.projectId;
if(!/^woonbi-[a-z0-9-]+$/.test(projectId||''))throw new Error('Invalid Woonbi Firebase project id');

function run(exe,args,label){
  console.log('\n[woonbi deploy] '+label);
  const r=spawnSync(exe,args,{cwd:root,stdio:'inherit',shell:false,env:process.env});
  if(r.error)throw r.error;
  if(r.status!==0)throw new Error(label+' failed with exit code '+r.status);
}
const python=process.platform==='win32'?'python':'python3';
const firebaseCli=require.resolve('firebase-tools/lib/bin/firebase.js');

run(python,['scripts/build.py','--live-config','deploy/firebase-live-config.json'],'build safe live shell');
run(process.execPath,['scripts/fetch-school-life.mjs'],'refresh school-life.json');
run(process.execPath,['scripts/validate-school-life.cjs'],'validate school-life.json');
if(process.platform==='win32'){
  run('cmd.exe',['/d','/c','npx','firebase','deploy','--only','hosting','--project',projectId],'deploy hosting');
}else{
  run(process.execPath,[firebaseCli,'deploy','--only','hosting','--project',projectId],'deploy hosting');
}
console.log('\n[woonbi deploy] complete: https://'+projectId+'.web.app');
