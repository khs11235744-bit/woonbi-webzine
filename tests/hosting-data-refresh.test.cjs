'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {refreshSchoolLife}=require('../scripts/refresh-hosting-school-life.cjs');
function hosting({race=false,unknownHash=false}={}){
 const files={'/index.html':'1'.repeat(64),'/js/newsroom.js':'2'.repeat(64),'/js/feature-pohang-20261017.js':'3'.repeat(64),'/js/feature-research-20261021.js':'4'.repeat(64),'/assets/new-article.webp':'5'.repeat(64),'/school-life.json':'6'.repeat(64)};
 const state={files:{...files},config:{headers:[{glob:'**/*.js',headers:{'Cache-Control':'no-store'}}]},created:0,published:null,reads:0};
 const request=async(method,path,body)=>{
  if(method==='GET'&&path.endsWith('/channels/live'))return {release:{version:{name:'sites/woonbi-webzine-2026/versions/'+(race&&state.reads++>0?'other':'base')}}};
  if(method==='GET'&&path.endsWith('/versions/base'))return {config:state.config};
  if(method==='GET'&&path.includes('/versions/base/files'))return {files:Object.entries(files).map(([path,hash])=>({path,hash}))};
  if(method==='POST'&&path.endsWith('/versions')){state.created++;return {name:'sites/woonbi-webzine-2026/versions/new'};}
  if(method==='POST'&&path.endsWith(':populateFiles')){state.next={...body.files};return {uploadRequiredHashes:[unknownHash?'f'.repeat(64):body.files['/school-life.json']],uploadUrl:'https://upload-firebasehosting.googleapis.com/upload/sites/woonbi-webzine-2026/versions/new/files'};}
  if(method==='PATCH')return {status:'FINALIZED'};
  if(method==='POST'&&path.includes('/releases?')){state.published=state.next;return {version:{name:'sites/woonbi-webzine-2026/versions/new'}};}
  if(method==='GET'&&path.includes('/versions/new/files'))return {files:Object.entries(state.published).map(([path,hash])=>({path,hash}))};
  throw Error('Unexpected request '+method+' '+path);
 };
 return {request,state,files};
}
test('refresh retains every currently published article and photo when the checkout is older',async()=>{
 const h=hosting(),data=Buffer.from(JSON.stringify({mode:'live',updatedAt:new Date().toISOString(),meal:{},schedule:{},notice:{}}));
 const result=await refreshSchoolLife({request:h.request,upload:async()=>{},data});
 assert.equal(result.preservedFiles,5);assert.equal(result.changedPath,'/school-life.json');
 for(const [path,hash]of Object.entries(h.files))if(path!=='/school-life.json')assert.equal(h.state.published[path],hash,path);
 assert.notEqual(h.state.published['/school-life.json'],h.files['/school-life.json']);
});
test('a concurrent new publication aborts refresh before it can replace that release',async()=>{
 const h=hosting({race:true});await assert.rejects(refreshSchoolLife({request:h.request,upload:async()=>{},data:Buffer.from('{"mode":"live"}')}),/changed/i);
 assert.equal(h.state.published,null);
});
test('refresh refuses requests to re-upload or replace unrelated site files',async()=>{
 const h=hosting({unknownHash:true});await assert.rejects(refreshSchoolLife({request:h.request,upload:async()=>{},data:Buffer.from('{"mode":"live"}')}),/unrelated|unexpected/i);
 assert.equal(h.state.published,null);
});