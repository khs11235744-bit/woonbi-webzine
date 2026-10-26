'use strict';
// Pure/injected transport only: no credentials, network, or automatic production release.
const {createHash}=require('node:crypto');
const {gzipSync}=require('node:zlib');
const {isDeepStrictEqual}=require('node:util');
const SITE='woonbi-webzine-2026';
const PREFIX=`sites/${SITE}/versions/`;
const ALLOWED=new Set(['/js/app.js','/js/core.js','/js/firebase-store.js','/js/newsroom.js']);
const sha=b=>createHash('sha256').update(b).digest('hex');
function validVersion(v){if(typeof v!=='string'||!v.startsWith(PREFIX)||!/^[-\w]+$/.test(v.slice(PREFIX.length)))throw Error('Invalid version');return v;}
async function current(request){return validVersion((await request('GET',`sites/${SITE}/channels/live`)).release?.version?.name);}
async function files(request,version){
 validVersion(version);const out={};let page='';const seen=new Set();
 do {if(seen.has(page))throw Error('Repeated pagination token');seen.add(page);
 const q=new URLSearchParams({pageSize:'1000'});if(page)q.set('pageToken',page);
 const r=await request('GET',`${version}/files?${q}`);
 for(const f of r.files||[]){if(!f.path?.startsWith('/')||!/^([a-f0-9]{64})$/.test(f.hash||'')||Object.hasOwn(out,f.path))throw Error('Invalid/duplicate manifest entry');out[f.path]=f.hash;}
 page=r.nextPageToken||'';
 }while(page);return out;
}
function equal(a,b){return JSON.stringify(Object.entries(a).sort())===JSON.stringify(Object.entries(b).sort());}
async function stage({request,upload,readPublic,patches,expectedBase}){
 const base=await current(request);if(base!==validVersion(expectedBase))throw Error('Live version changed');
 if(!patches.length||new Set(patches.map(x=>x.path)).size!==patches.length)throw Error('Empty/duplicate patch');
 const prior=await request('GET',base), before=await files(request,base), after={...before}, blobs=new Map();
 if(!before['/index.html'])throw Error('Incomplete live manifest');
 for(const p of patches){
  if(!ALLOWED.has(p.path)||!before[p.path])throw Error('Unapproved/new path');
  if(!/^[a-f0-9]{64}$/.test(p.baselineSha256||''))throw Error('Missing baseline hash');
  const live=await readPublic(p.path);if(sha(live)!==p.baselineSha256)throw Error('Live source differs from reviewed baseline: '+p.path);
  if(!Buffer.isBuffer(p.bytes)||!p.bytes.length)throw Error('Missing patch bytes');
  const compressed=gzipSync(p.bytes,{level:9});const h=sha(compressed);after[p.path]=h;blobs.set(h,compressed);
 }
 if(await current(request)!==base)throw Error('Live version changed');
 const created=await request('POST',`sites/${SITE}/versions`,{config:prior.config||{}});validVersion(created.name);
 const entries=Object.entries(after),uploaded=new Set();
 for(let offset=0;offset<entries.length;offset+=1000){
  const populated=await request('POST',`${created.name}:populateFiles`,{files:Object.fromEntries(entries.slice(offset,offset+1000))});
  for(const h of populated.uploadRequiredHashes||[]){
   if(!blobs.has(h))throw Error('Unexpected upload of unrelated live bytes');
   if(populated.uploadUrl!==`https://upload-firebasehosting.googleapis.com/upload/${created.name}/files`)throw Error('Unexpected upload URL');
   if(!uploaded.has(h)){await upload(populated.uploadUrl+'/'+h,blobs.get(h));uploaded.add(h);}
  }
 }
 await request('PATCH',created.name+'?updateMask=status',{status:'FINALIZED'});
 if(!equal(await files(request,created.name),after))throw Error('Staged manifest mismatch');
 const finalized=await request('GET',created.name);
 if(finalized.status!=='FINALIZED'||!isDeepStrictEqual(finalized.config||{},prior.config||{}))throw Error('Staged status/config mismatch');
 if(await current(request)!==base)throw Error('Live version changed; staged version must not promote');
 return {site:SITE,baseVersion:base,candidateVersion:created.name,before,after,config:prior.config||{},changedPaths:patches.map(p=>p.path),rollbackVersion:base};
}
module.exports={SITE,sha,files,current,stage};
