'use strict';
const fs=require('node:fs'),{createHash}=require('node:crypto'),{isDeepStrictEqual}=require('node:util');
const {SITE,current,files}=require('./preserved-hosting.cjs'),hash=s=>createHash('sha256').update(s).digest('hex');
async function promote({request,plan,persist=()=>{}}){
 const allowed=new Set(['/contribute.css','/js/contribute-core.js','/js/contribute.js']);
 if(plan.site!==SITE||!plan.changedPaths?.length||plan.changedPaths.some(p=>!allowed.has(p))||plan.rules?.length!==2)throw Error('Invalid plan');
 const keys=new Set([...Object.keys(plan.before),...Object.keys(plan.after)]),diff=[...keys].filter(p=>plan.before[p]!==plan.after[p]).sort();
 if(!isDeepStrictEqual(diff,[...plan.changedPaths].sort())||[...keys].some(p=>!plan.before[p]||!plan.after[p]))throw Error('Unexpected manifest changes');
 const releases=[`projects/${SITE}/releases/cloud.firestore`,`projects/${SITE}/releases/firebase.storage/${SITE}.firebasestorage.app`];
 if(plan.rules.some((r,i)=>r.release!==releases[i]))throw Error('Invalid rules guard');
 const receipt={baseVersion:plan.baseVersion,candidateVersion:plan.candidateVersion,changedPaths:plan.changedPaths,steps:[],rules:plan.rules.map(r=>({...r,...(r.candidate?{candidate:{hash:r.candidate.hash}}:{})}))};persist(receipt);
 const candidate=plan.rules[0].candidate;
 if(!candidate||hash(candidate.content)!==candidate.hash)throw Error('Firestore candidate hash mismatch');
 const hosting=(m,p,b)=>request('firebasehosting',m,p,b);
 async function rulesGuard(updated=false){for(const [i,r] of plan.rules.entries()){const expected=updated&&i===0?{ruleset:receipt.newFirestoreRuleset,hash:candidate.hash}:r;const live=await request('firebaserules','GET',r.release);if(live.rulesetName!==expected.ruleset)throw Error('Rules changed');const s=await request('firebaserules','GET',expected.ruleset);if(s.source?.files?.length!==1||hash(s.source.files[0].content)!==expected.hash)throw Error('Rule source changed');}}
 async function guard(updated=false){if(await current(hosting)!==plan.baseVersion)throw Error('Hosting changed');for(const [v,expected] of [[plan.baseVersion,plan.before],[plan.candidateVersion,plan.after]]){if(!isDeepStrictEqual(await files(hosting,v),expected))throw Error('Manifest changed');const version=await hosting('GET',v);if(version.status!=='FINALIZED'||!isDeepStrictEqual(version.config||{},plan.config))throw Error('Version config changed');}await rulesGuard(updated);}
 await guard();
 const created=await request('firebaserules','POST',`projects/${SITE}/rulesets`,{source:{files:[{name:'firestore.rules',content:candidate.content}]}});
 if(!created.name?.startsWith(`projects/${SITE}/rulesets/`))throw Error('Invalid candidate ruleset');receipt.newFirestoreRuleset=created.name;persist(receipt);
 const compiled=await request('firebaserules','GET',created.name);if(compiled.source?.files?.length!==1||hash(compiled.source.files[0].content)!==candidate.hash)throw Error('Compiled source mismatch');
 await guard();receipt.firestorePatchAttempted=true;persist(receipt);
 await request('firebaserules','PATCH',plan.rules[0].release,{release:{name:plan.rules[0].release,rulesetName:created.name},updateMask:'rulesetName'});
 receipt.steps.push('firestore');persist(receipt);await guard(true);
 if(await current(hosting)!==plan.baseVersion)throw Error('Hosting changed before release');
 receipt.releaseAttempted=true;persist(receipt);
 await hosting('POST',`sites/${SITE}/releases?versionName=${encodeURIComponent(plan.candidateVersion)}`,{message:'Reviewed anonymous private submission form; all public articles and other live assets preserved'});
 receipt.steps.push('hosting');persist(receipt);
 if(await current(hosting)!==plan.candidateVersion||!isDeepStrictEqual(await files(hosting,plan.candidateVersion),plan.after))throw Error('Live verification failed');await rulesGuard(true);receipt.verified=true;persist(receipt);return receipt;
}
async function main(){const token=process.env.WOONBI_HOSTING_ACCESS_TOKEN;if(!token)throw Error('Existing OIDC required');const plan=JSON.parse(fs.readFileSync('release-anonymous/plan.json','utf8'));plan.rules[0].candidate.content=fs.readFileSync('release-anonymous/firestore.rules','utf8');
 const request=async(service,method,path,body)=>{if(!(method==='GET'&&['firebasehosting','firebaserules'].includes(service))&&!(service==='firebasehosting'&&method==='POST'&&path===`sites/${SITE}/releases?versionName=${encodeURIComponent(plan.candidateVersion)}`)&&!(service==='firebaserules'&&((method==='POST'&&path===`projects/${SITE}/rulesets`)||(method==='PATCH'&&path===`projects/${SITE}/releases/cloud.firestore`))))throw Error('Write outside reviewed private intake release prohibited');const r=await fetch(`https://${service}.googleapis.com/${service==='firebasehosting'?'v1beta1':'v1'}/${path}`,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`${service} ${method} HTTP ${r.status}`);return r.json();};
 const persist=x=>{fs.mkdirSync('anonymous-receipt',{recursive:true});fs.writeFileSync('anonymous-receipt/receipt.json',JSON.stringify(x,null,2));};console.log(JSON.stringify(await promote({request,plan,persist}),null,2));}
module.exports={promote,hash};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
