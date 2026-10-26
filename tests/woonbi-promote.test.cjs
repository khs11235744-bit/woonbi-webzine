const test=require('node:test'),assert=require('node:assert/strict');
const {promote,digest}=require('../scripts/woonbi-promote.cjs');
function fake({race=false,compileFail=false,publishFail=false}={}){
 const project='woonbi-webzine-2026',prefix=`sites/${project}/versions/`,releases=[`projects/${project}/releases/cloud.firestore`,`projects/${project}/releases/firebase.storage/${project}.firebasestorage.app`];
 const before={'/index.html':'a'.repeat(64),'/js/core.js':'b'.repeat(64)},after={...before,'/js/core.js':'c'.repeat(64)},config={cleanUrls:true};
 const rules=releases.map((name,i)=>({release:name,oldRuleset:`projects/${project}/rulesets/old${i}`,oldHash:digest('old'+i),filename:i?'firebase/storage.rules':'firestore.rules',content:'new'+i,candidateHash:digest('new'+i)}));
 const plan={project,baseVersion:prefix+'base',candidateVersion:prefix+'candidate',beforeHash:digest(before),afterHash:digest(after),configHash:digest(config),rules};
 const state={writes:[],active:rules.map(x=>x.oldRuleset),live:plan.baseVersion,created:0,reads:0};
 const request=async(service,method,p,body)=>{
 if(method!=='GET')state.writes.push([service,method,p]);
 if(service==='firebasehosting'){
  if(p.endsWith('/channels/live'))return{release:{version:{name:state.live}}};
  if(p.includes('/files?'))return{files:Object.entries(p.startsWith(plan.baseVersion)?before:after).map(([path,hash])=>({path,hash}))};
  if(method==='GET')return{status:'FINALIZED',config};
  if(p.includes('/releases?')){if(publishFail)throw Error('publish denied');state.live=plan.candidateVersion;return{};}
 }
 if(service==='firebaserules'){
  const i=releases.indexOf(p);
  if(method==='GET'&&i>=0){if(race&&state.active[0].includes('new')&&i===1)return{rulesetName:'foreign'};return{rulesetName:state.active[i]};}
  if(method==='GET'){const j=Number(p.slice(-1)),isnew=p.includes('/new');return{source:{files:[{name:rules[j].filename,content:(isnew?'new':'old')+j}]}};}
  if(method==='POST'){if(compileFail)throw Error('compile rejected');return{name:`projects/${project}/rulesets/new${state.created++}`};}
  if(method==='PATCH'){state.active[i]=body.release.rulesetName;return body.release;}
 }
 throw Error('Unexpected '+method+' '+p);
 };return{plan,state,request};
}
test('guards exact baseline then updates two rules and Hosting, verifies all',async()=>{const f=fake();await promote(f);assert.equal(f.state.live,f.plan.candidateVersion);assert.equal(f.state.writes.filter(x=>x[1]==='PATCH').length,2);assert.equal(f.state.writes.at(-1)[0],'firebasehosting');});
test('foreign live version aborts before any mutation',async()=>{const f=fake();f.state.live='other';await assert.rejects(promote(f),/Hosting changed/);assert.equal(f.state.writes.length,0);});
test('ruleset compile failure never updates active releases',async()=>{const f=fake({compileFail:true});await assert.rejects(promote(f),/compile/);assert.equal(f.state.writes.filter(x=>x[1]==='PATCH').length,0);});
test('foreign rules after first update aborts, never overrides foreign rule',async()=>{const f=fake({race:true});await assert.rejects(promote(f),/Rules changed/);assert.equal(f.state.writes.filter(x=>x[1]==='PATCH').length,1);assert.equal(f.state.live,f.plan.baseVersion);});
test('Hosting failure never blindly rolls back or deletes',async()=>{const f=fake({publishFail:true});await assert.rejects(promote(f),/publish denied/);assert.equal(f.state.writes.filter(x=>x[1]==='PATCH').length,2);assert.equal(f.state.live,f.plan.baseVersion);});
