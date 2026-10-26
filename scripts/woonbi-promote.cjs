'use strict';
const {createHash}=require('node:crypto'),fs=require('node:fs');
const PROJECT='woonbi-webzine-2026';
function canonical(x){if(Array.isArray(x))return x.map(canonical);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));return x;}
const digest=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(canonical(x))).digest('hex');
async function promote({request,plan,persist=()=>{}}){
 if(plan.project!==PROJECT||plan.rules.length!==2)throw Error('Invalid reviewed project/plan');
 const allowed=[`projects/${PROJECT}/releases/cloud.firestore`,`projects/${PROJECT}/releases/firebase.storage/${PROJECT}.firebasestorage.app`];
 if(plan.rules.some((r,i)=>r.release!==allowed[i]||digest(r.content)!==r.candidateHash))throw Error('Rules plan/hash mismatch');
 const receipt={baseVersion:plan.baseVersion,candidateVersion:plan.candidateVersion,rules:plan.rules.map(r=>({release:r.release,oldRuleset:r.oldRuleset,oldHash:r.oldHash,candidateHash:r.candidateHash})),steps:[]};persist(receipt);
 const current=async()=> (await request('firebasehosting','GET',`sites/${PROJECT}/channels/live`)).release?.version?.name;
 async function manifest(version){const out={};let page='';do{const q=new URLSearchParams({pageSize:'1000'});if(page)q.set('pageToken',page);const r=await request('firebasehosting','GET',version+'/files?'+q);for(const f of r.files||[]){if(Object.hasOwn(out,f.path))throw Error('Duplicate Hosting path');out[f.path]=f.hash;}page=r.nextPageToken||'';}while(page);return out;}
 async function hostingGuard(){if(await current()!==plan.baseVersion)throw Error('Hosting changed');if(digest(await manifest(plan.baseVersion))!==plan.beforeHash)throw Error('Live manifest changed');const c=await request('firebasehosting','GET',plan.candidateVersion);if(c.status!=='FINALIZED'||digest(c.config||{})!==plan.configHash||digest(await manifest(plan.candidateVersion))!==plan.afterHash)throw Error('Candidate changed');}
 async function rulesGuard(r,expectedName=r.oldRuleset,expectedHash=r.oldHash){const live=await request('firebaserules','GET',r.release);if(live.rulesetName!==expectedName)throw Error('Rules changed: '+r.release);const set=await request('firebaserules','GET',live.rulesetName),files=set.source?.files;if(files?.length!==1||digest(files[0].content)!==expectedHash)throw Error('Rule source changed: '+r.release);}
 await hostingGuard();for(const r of plan.rules)await rulesGuard(r);
 // Compile/create BOTH immutable rule candidates before touching active pointers.
 for(let i=0;i<plan.rules.length;i++){const r=plan.rules[i],created=await request('firebaserules','POST',`projects/${PROJECT}/rulesets`,{source:{files:[{name:r.filename,content:r.content}]}});if(!created.name?.startsWith(`projects/${PROJECT}/rulesets/`))throw Error('Invalid candidate ruleset');receipt.rules[i].newRuleset=created.name;persist(receipt);const set=await request('firebaserules','GET',created.name);if(set.source?.files?.length!==1||digest(set.source.files[0].content)!==r.candidateHash)throw Error('Created rule source mismatch');}
 await hostingGuard();for(const r of plan.rules)await rulesGuard(r);
 for(let i=0;i<plan.rules.length;i++){const r=plan.rules[i];if(await current()!==plan.baseVersion)throw Error('Hosting changed during rules rollout');await rulesGuard(r);await request('firebaserules','PATCH',r.release,{release:{name:r.release,rulesetName:receipt.rules[i].newRuleset},updateMask:'rulesetName'});receipt.steps.push(r.release);persist(receipt);await rulesGuard(r,receipt.rules[i].newRuleset,r.candidateHash);}
 await hostingGuard();for(let i=0;i<plan.rules.length;i++)await rulesGuard(plan.rules[i],receipt.rules[i].newRuleset,plan.rules[i].candidateHash);
 await request('firebasehosting','POST',`sites/${PROJECT}/releases?versionName=${encodeURIComponent(plan.candidateVersion)}`,{message:'Verified Woonbi author/editor policy and twelve-photo validation; preserve all other files'});
 receipt.steps.push('hosting');persist(receipt);
 if(await current()!==plan.candidateVersion||digest(await manifest(plan.candidateVersion))!==plan.afterHash)throw Error('Production Hosting verification failed');
 for(let i=0;i<plan.rules.length;i++)await rulesGuard(plan.rules[i],receipt.rules[i].newRuleset,plan.rules[i].candidateHash);
 receipt.verified=true;persist(receipt);return receipt;
}
async function main(){const token=process.env.WOONBI_HOSTING_ACCESS_TOKEN;if(!token)throw Error('Existing OIDC required');const plan=JSON.parse(fs.readFileSync('release-production/plan.json','utf8'));for(const r of plan.rules)r.content=fs.readFileSync('release-production/'+r.file,'utf8');
 const request=async(service,method,p,body)=>{if(!['firebasehosting','firebaserules'].includes(service))throw Error('Service denied');const res=await fetch(`https://${service}.googleapis.com/${service==='firebasehosting'?'v1beta1':'v1'}/${p}`,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});if(!res.ok)throw Error(`${service} ${method} ${p} HTTP ${res.status}`);return res.json();};
 const persist=r=>{fs.mkdirSync('production-receipt',{recursive:true});fs.writeFileSync('production-receipt/receipt.json',JSON.stringify(r,null,2));};
 const r=await promote({request,plan,persist});console.log(JSON.stringify(r,null,2));
}
module.exports={promote,digest};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
