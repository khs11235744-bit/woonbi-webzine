'use strict';
const fs=require('node:fs'),{createHash}=require('node:crypto'),{isDeepStrictEqual}=require('node:util');
const {SITE,current,files}=require('./preserved-hosting.cjs'),hash=s=>createHash('sha256').update(s).digest('hex');
async function promote({request,plan,persist=()=>{}}){
 const allowed=new Set(['/index.html','/js/home-lead-2026.js','/js/newsroom.js']);
 if(plan.site!==SITE||!plan.changedPaths?.length||plan.changedPaths.some(p=>!allowed.has(p))||plan.rules?.length!==2)throw Error('Invalid plan');
 const keys=new Set([...Object.keys(plan.before),...Object.keys(plan.after)]),diff=[...keys].filter(p=>plan.before[p]!==plan.after[p]).sort();
 if(!isDeepStrictEqual(diff,[...plan.changedPaths].sort())||[...keys].some(p=>!plan.before[p]||!plan.after[p]))throw Error('Unexpected manifest changes');
 const releases=[`projects/${SITE}/releases/cloud.firestore`,`projects/${SITE}/releases/firebase.storage/${SITE}.firebasestorage.app`];
 if(plan.rules.some((r,i)=>r.release!==releases[i]))throw Error('Invalid rules guard');
 const receipt={baseVersion:plan.baseVersion,candidateVersion:plan.candidateVersion,changedPaths:plan.changedPaths,steps:[],rules:plan.rules};persist(receipt);
 const hosting=(m,p,b)=>request('firebasehosting',m,p,b);
 async function rulesGuard(){for(const r of plan.rules){const live=await request('firebaserules','GET',r.release);if(live.rulesetName!==r.ruleset)throw Error('Rules changed');const s=await request('firebaserules','GET',r.ruleset);if(s.source?.files?.length!==1||hash(s.source.files[0].content)!==r.hash)throw Error('Rule source changed');}}
 async function guard(){if(await current(hosting)!==plan.baseVersion)throw Error('Hosting changed');for(const [v,expected] of [[plan.baseVersion,plan.before],[plan.candidateVersion,plan.after]]){if(!isDeepStrictEqual(await files(hosting,v),expected))throw Error('Manifest changed');const version=await hosting('GET',v);if(version.status!=='FINALIZED'||!isDeepStrictEqual(version.config||{},plan.config))throw Error('Version config changed');}await rulesGuard();}
 await guard();if(await current(hosting)!==plan.baseVersion)throw Error('Hosting changed before release');
 receipt.releaseAttempted=true;persist(receipt);
 await hosting('POST',`sites/${SITE}/releases?versionName=${encodeURIComponent(plan.candidateVersion)}`,{message:'Reviewed bounded article photo save correction; all other live assets preserved'});
 receipt.steps.push('hosting');persist(receipt);
 if(await current(hosting)!==plan.candidateVersion||!isDeepStrictEqual(await files(hosting,plan.candidateVersion),plan.after))throw Error('Live verification failed');await rulesGuard();receipt.verified=true;persist(receipt);return receipt;
}
async function main(){const token=process.env.WOONBI_HOSTING_ACCESS_TOKEN;if(!token)throw Error('Existing OIDC required');const plan=JSON.parse(fs.readFileSync('release-school-priority/plan.json','utf8'));
 const request=async(service,method,path,body)=>{if(!(method==='GET'&&['firebasehosting','firebaserules'].includes(service))&&!(service==='firebasehosting'&&method==='POST'&&path===`sites/${SITE}/releases?versionName=${encodeURIComponent(plan.candidateVersion)}`))throw Error('Write outside Hosting release prohibited');const r=await fetch(`https://${service}.googleapis.com/${service==='firebasehosting'?'v1beta1':'v1'}/${path}`,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`${service} ${method} HTTP ${r.status}`);return r.json();};
 const persist=x=>{fs.mkdirSync('school-priority-receipt',{recursive:true});fs.writeFileSync('school-priority-receipt/receipt.json',JSON.stringify(x,null,2));};console.log(JSON.stringify(await promote({request,plan,persist}),null,2));}
module.exports={promote,hash};if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
