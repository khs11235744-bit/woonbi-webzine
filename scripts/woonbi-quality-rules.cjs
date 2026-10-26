'use strict';
const fs=require('node:fs'),{createHash}=require('node:crypto');
const project='woonbi-webzine-2026',release=`projects/${project}/releases/cloud.firestore`,storage=`projects/${project}/releases/firebase.storage/${project}.firebasestorage.app`;
const hash=s=>createHash('sha256').update(s).digest('hex');
async function deploy({request,plan,content,persist=()=>{}}){
 if(plan.project!==project||plan.release!==release||hash(content)!==plan.candidateHash||!plan.oldRuleset?.startsWith(`projects/${project}/rulesets/`))throw Error('Plan/hash mismatch');
 const receipt={...plan,steps:[]};persist(receipt);
 async function rulesGuard(name,digest){const r=await request('firebaserules','GET',release);if(r.rulesetName!==name)throw Error('Firestore pointer changed');const s=await request('firebaserules','GET',name);if(s.source?.files?.length!==1||hash(s.source.files[0].content)!==digest)throw Error('Firestore source changed');}
 async function otherGuard(){const h=await request('firebasehosting','GET',`sites/${project}/channels/live`);if(h.release?.version?.name!==plan.hostingVersion)throw Error('Hosting changed');const s=await request('firebaserules','GET',storage);if(s.rulesetName!==plan.storageRuleset)throw Error('Storage changed');}
 await otherGuard();await rulesGuard(plan.oldRuleset,plan.oldHash);
 const created=await request('firebaserules','POST',`projects/${project}/rulesets`,{source:{files:[{name:'firestore.rules',content}]}});
 if(!created.name?.startsWith(`projects/${project}/rulesets/`))throw Error('Invalid ruleset');receipt.newRuleset=created.name;persist(receipt);
 const check=await request('firebaserules','GET',created.name);if(check.source?.files?.length!==1||hash(check.source.files[0].content)!==plan.candidateHash)throw Error('Candidate mismatch');
 await otherGuard();await rulesGuard(plan.oldRuleset,plan.oldHash);
 // No atomic CAS available: exclusive CI lock + immediate guards; never blind retry/rollback.
 receipt.patchAttempted=true;persist(receipt);
 await request('firebaserules','PATCH',release,{release:{name:release,rulesetName:created.name},updateMask:'rulesetName'});
 receipt.steps.push('firestore');persist(receipt);
 await rulesGuard(created.name,plan.candidateHash);await otherGuard();receipt.verified=true;persist(receipt);return receipt;
}
async function main(){const token=process.env.WOONBI_HOSTING_ACCESS_TOKEN;if(!token)throw Error('Existing OIDC required');const plan=JSON.parse(fs.readFileSync('release-quality/plan.json','utf8')),content=fs.readFileSync('release-quality/firestore.rules','utf8');
 const request=async(service,method,path,body)=>{const read=method==='GET'&&['firebaserules','firebasehosting'].includes(service),write=service==='firebaserules'&&((method==='POST'&&path===`projects/${project}/rulesets`)||(method==='PATCH'&&path===release));if(!read&&!write)throw Error('Operation denied');const r=await fetch(`https://${service}.googleapis.com/${service==='firebaserules'?'v1':'v1beta1'}/${path}`,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`${service} ${method} HTTP ${r.status}`);return r.json();};
 const persist=x=>{fs.mkdirSync('quality-receipt',{recursive:true});fs.writeFileSync('quality-receipt/receipt.json',JSON.stringify(x,null,2));};const r=await deploy({request,plan,content,persist});console.log(JSON.stringify(r,null,2));}
module.exports={deploy,hash};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
