'use strict';
// Explicit CI invocation only. Stages a preserved version and short-lived preview; never releases live.
const fs=require('node:fs'),path=require('node:path');
const {SITE,current,stage,sha}=require('./preserved-hosting.cjs');
async function main(){
 const token=process.env.WOONBI_HOSTING_ACCESS_TOKEN;
 if(!token)throw Error('Existing CI OIDC access token required');
 const run=process.env.GITHUB_RUN_ID;if(!/^\d+$/.test(run||''))throw Error('Explicit GitHub run identity required');
 const root=path.resolve(process.argv[2]||'release-bundle');
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
 if(manifest.site!==SITE||!Array.isArray(manifest.files))throw Error('Invalid reviewed bundle manifest');
 const patches=manifest.files.map(f=>{
  if(!f.path.startsWith('/')||f.path.includes('..'))throw Error('Invalid bundle path');
  const bytes=fs.readFileSync(path.join(root,'web',f.path));
  if(sha(bytes)!==f.candidateSha256)throw Error('Candidate hash mismatch');
  return {...f,bytes};
 });
 const request=async(method,p,body)=>{
  if(p.includes('/releases')&&(!p.startsWith(`sites/${SITE}/channels/woonbi-review-`)||method!=='POST'))throw Error('Live release is prohibited in stage runner');
  const r=await fetch('https://firebasehosting.googleapis.com/v1beta1/'+p,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw Error(`Hosting ${method} failed HTTP ${r.status}`);return r.json();
 };
 const upload=async(url,body)=>{const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},body,signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Reviewed file upload failed HTTP '+r.status);};
 const readPublic=async(p)=>{const r=await fetch(`https://${SITE}.web.app${p}?woonbi_review=${Date.now()}`,{headers:{'Cache-Control':'no-cache'},redirect:'error',signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error('Baseline read failed HTTP '+r.status);return Buffer.from(await r.arrayBuffer());};
 const base=await current(request);
 const receipt=await stage({request,upload,readPublic,patches,expectedBase:base});
 fs.mkdirSync('release-receipt',{recursive:true});fs.writeFileSync('release-receipt/staged.json',JSON.stringify(receipt,null,2));
 const channel='woonbi-review-'+run;
 // No retry on ambiguous mutations: investigate existing objects instead of duplicating changes.
 const preview=await request('POST',`sites/${SITE}/channels?channelId=${channel}`,{ttl:'86400s'});
 if(await current(request)!==base)throw Error('Live advanced before preview; rebase stage');
 await request('POST',`sites/${SITE}/channels/${channel}/releases?versionName=${encodeURIComponent(receipt.candidateVersion)}`,{message:'Reviewed Woonbi code preview; preserve live articles/photos'});
 const verified=await request('GET',`sites/${SITE}/channels/${channel}`);
 if(verified.release?.version?.name!==receipt.candidateVersion)throw Error('Preview version verification failed');
 receipt.previewChannel=channel;receipt.previewUrl=preview.url;receipt.commit=process.env.GITHUB_SHA;receipt.bundleSha256=sha(fs.readFileSync(path.join(root,'manifest.json')));
 fs.mkdirSync('release-receipt',{recursive:true});fs.writeFileSync('release-receipt/receipt.json',JSON.stringify(receipt,null,2));
 if(await current(request)!==base)throw Error('Live advanced during preview; staged receipt is stale and must not promote');
 // Summary intentionally excludes token and full public manifest path names.
 console.log(JSON.stringify({baseVersion:base,candidateVersion:receipt.candidateVersion,previewUrl:preview.url,changedPaths:receipt.changedPaths,liveUnchanged:true},null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
