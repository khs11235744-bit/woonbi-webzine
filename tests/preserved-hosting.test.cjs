const test=require('node:test'),assert=require('node:assert/strict');
const {stage,sha}=require('../scripts/preserved-hosting.cjs');
function fake({race=false,unknown=false,corrupt=false}={}){
 const prefix='sites/woonbi-webzine-2026/versions/',base=prefix+'base',next=prefix+'next';
 const original={'/index.html':'1'.repeat(64),'/js/app.js':'2'.repeat(64),'/private-owner-article.webp':'3'.repeat(64),'/school-life.json':'4'.repeat(64)};
 const config={headers:[{glob:'**',headers:{'Cache-Control':'no-cache'}}]},state={writes:[],reads:0};
 return {state,original,args:{expectedBase:base,readPublic:async()=>Buffer.from('old'),upload:async()=>{},patches:[{path:'/js/app.js',baselineSha256:sha('old'),bytes:Buffer.from('new')}],request:async(method,path,body)=>{
 if(method!=='GET')state.writes.push({method,path,body});
 if(path.endsWith('/channels/live'))return {release:{version:{name:race&&state.reads++>0?prefix+'other':base}}};
 if(method==='GET'&&path.includes('/files?')){const m=path.startsWith(base)?original:{...state.after,...(corrupt?{'/school-life.json':'f'.repeat(64)}:{})};return {files:Object.entries(m).map(([path,hash])=>({path,hash}))};}
 if(method==='GET')return {config,status:'FINALIZED'};
 if(method==='POST'&&path.endsWith('/versions'))return {name:next};
 if(path.endsWith(':populateFiles')){state.after={...state.after,...body.files};return {uploadRequiredHashes:unknown?['e'.repeat(64)]:(body.files['/js/app.js']?[body.files['/js/app.js']]:[]),uploadUrl:'https://upload-firebasehosting.googleapis.com/upload/'+next+'/files'};}
 if(method==='PATCH')return {};
 throw Error('Unexpected '+path);
 }}};
}
test('inherits all unreviewed files/config and never creates a release',async()=>{const f=fake(),r=await stage(f.args);for(const p of Object.keys(f.original))if(p!=='/js/app.js')assert.equal(r.after[p],f.original[p]);assert.equal(r.rollbackVersion,r.baseVersion);assert.ok(f.state.writes.every(x=>!x.path.includes('releases')));});
test('baseline mismatch aborts before mutation',async()=>{const f=fake();f.args.readPublic=async()=>Buffer.from('owner-new');await assert.rejects(stage(f.args),/baseline/);assert.equal(f.state.writes.length,0);});
test('version race aborts before mutation',async()=>{const f=fake({race:true});await assert.rejects(stage(f.args),/changed/);assert.equal(f.state.writes.length,0);});
test('unknown upload is rejected',async()=>{const f=fake({unknown:true});await assert.rejects(stage(f.args),/unrelated/);});
test('manifest corruption is rejected',async()=>{const f=fake({corrupt:true});await assert.rejects(stage(f.args),/manifest mismatch/);});
test('school/interview/data/new paths cannot be patched',async()=>{for(const path of ['/school-life.json','/js/interview.js','/new.js']){const f=fake();f.args.patches[0].path=path;await assert.rejects(stage(f.args),/Unapproved/);assert.equal(f.state.writes.length,0);}});
test('final version race refuses promotion metadata',async()=>{const f=fake(),original=f.args.request;let reads=0;f.args.request=async(m,p,b)=>{if(p.endsWith('/channels/live')&&++reads===3)return {release:{version:{name:'sites/woonbi-webzine-2026/versions/owner-new'}}};return original(m,p,b)};await assert.rejects(stage(f.args),/must not promote/);assert.ok(f.state.writes.every(x=>!x.path.includes('releases')));});
test('pagination retains all pages and rejects repeated token',async()=>{const {files}=require('../scripts/preserved-hosting.cjs');let n=0;const r=await files(async()=>++n===1?{files:[{path:'/first',hash:'1'.repeat(64)}],nextPageToken:'p2'}:{files:[{path:'/second',hash:'2'.repeat(64)}]},'sites/woonbi-webzine-2026/versions/base');assert.equal(Object.keys(r).length,2);await assert.rejects(files(async()=>({nextPageToken:'repeat'}),'sites/woonbi-webzine-2026/versions/base'),/Repeated/);});

test('populate manifest batches at1000 and preserves1001+ live files',async()=>{const f=fake();for(let i=0;i<1100;i++)f.original['/owner-photo-'+i+'.webp']='a'.repeat(64);const r=await stage(f.args),calls=f.state.writes.filter(x=>x.path.endsWith(':populateFiles'));assert.equal(calls.length,2);assert.ok(calls.every(x=>Object.keys(x.body.files).length<=1000));assert.equal(Object.keys(r.after).length,1104);});

test('performance stage only allows existing app.js and no additional file',async()=>{for(const path of ['/index.html','/js/core.js','/js/book-source-2026.js']){const f=fake();f.original[path]='a'.repeat(64);f.args.patches[0].path=path;await assert.rejects(stage(f.args));assert.equal(f.state.writes.length,0);}});
