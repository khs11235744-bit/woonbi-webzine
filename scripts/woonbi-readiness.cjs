'use strict';
const fs=require('node:fs'),{createHash}=require('node:crypto');
const project='woonbi-webzine-2026',token=process.env.WOONBI_HOSTING_ACCESS_TOKEN;
const sha=x=>createHash('sha256').update(x).digest('hex');
async function get(service,p){const r=await fetch(`https://${service}.googleapis.com/${service==='firebasehosting'?'v1beta1':'v1'}/${p}`,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`${service} GET ${p} HTTP ${r.status}`);return r.json();}
async function main(){if(!token)throw Error('Existing OIDC token required');const live=await get('firebasehosting',`sites/${project}/channels/live`);let page='',releases=[];do{const q=new URLSearchParams({pageSize:'100'});if(page)q.set('pageToken',page);const r=await get('firebaserules',`projects/${project}/releases?${q}`);releases.push(...r.releases||[]);page=r.nextPageToken||'';}while(page);
const rules=[];for(const release of releases){const ruleset=await get('firebaserules',release.rulesetName);rules.push({release,ruleset,hashes:(ruleset.source?.files||[]).map(f=>({name:f.name,sha256:sha(f.content)}))});}
const receipt={project,liveVersion:live.release?.version?.name,rules,checkedAt:new Date().toISOString()};fs.mkdirSync('readiness',{recursive:true});fs.writeFileSync('readiness/readiness.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify({liveVersion:receipt.liveVersion,rules:rules.map(x=>({release:x.release.name,ruleset:x.release.rulesetName,hashes:x.hashes}))},null,2));}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
