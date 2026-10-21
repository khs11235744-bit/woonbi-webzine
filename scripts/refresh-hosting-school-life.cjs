'use strict';
/* Preserve the LIVE release, replacing only school-life.json. Never build from checkout. */
const fs=require('node:fs');
const {gzipSync}=require('node:zlib');
const {createHash}=require('node:crypto');
const SITE='woonbi-webzine-2026';
const PATH='/school-life.json';
const REQUIRED=['/index.html','/js/newsroom.js','/js/feature-pohang-20261017.js','/js/feature-research-20261021.js'];
const hash=data=>createHash('sha256').update(data).digest('hex');
async function currentVersion(request){
 const c=await request('GET',`sites/${SITE}/channels/live`);
 const name=c.release?.version?.name;
 if(!name?.startsWith(`sites/${SITE}/versions/`))throw Error('No valid live Woonbi version');
 return name;
}
async function listFiles(request,version){
 const files={};let pageToken='';
 do{
  const q=new URLSearchParams({pageSize:'1000'});if(pageToken)q.set('pageToken',pageToken);
  const result=await request('GET',`${version}/files?${q}`);
  for(const file of result.files||[]){
   if(!file.path?.startsWith('/')||!/^[a-f0-9]{64}$/.test(file.hash||''))throw Error('Invalid live file manifest');
   files[file.path]=file.hash;
  }
  pageToken=result.nextPageToken||'';
 }while(pageToken);
 return files;
}
async function refreshSchoolLife({request,upload,data}){
 const parsed=JSON.parse(data.toString('utf8'));
 if(parsed.mode!=='live')throw Error('Only validated live school data may be refreshed');
 const base=await currentVersion(request);
 const previous=await request('GET',base);
 const files=await listFiles(request,base);
 for(const path of REQUIRED)if(!files[path])throw Error('Refusing to refresh an incomplete release: '+path);
 const compressed=gzipSync(data,{level:9}),newHash=hash(compressed);
 if(files[PATH]===newHash)return {changed:false,baseVersion:base,preservedFiles:Object.keys(files).length-1};
 const nextFiles={...files,[PATH]:newHash};
 if(await currentVersion(request)!==base)throw Error('Live release changed; refresh aborted');
 const version=await request('POST',`sites/${SITE}/versions`,{config:previous.config||{}});
 if(!version.name?.startsWith(`sites/${SITE}/versions/`))throw Error('Invalid target version');
 const populated=await request('POST',`${version.name}:populateFiles`,{files:nextFiles});
 for(const required of populated.uploadRequiredHashes||[]){
  if(required!==newHash)throw Error('Unexpected upload of an unrelated file; refresh aborted');
  if(!populated.uploadUrl?.startsWith(`https://upload-firebasehosting.googleapis.com/upload/sites/${SITE}/versions/`))throw Error('Unexpected upload destination');
  await upload(populated.uploadUrl+'/'+required,compressed);
 }
 await request('PATCH',version.name+'?updateMask=status',{status:'FINALIZED'});
 if(await currentVersion(request)!==base)throw Error('Live release changed; refresh aborted');
 await request('POST',`sites/${SITE}/releases?versionName=${encodeURIComponent(version.name)}`,{message:'Refresh school-life.json; preserve all articles, photos and serving config'});
 const released=await listFiles(request,version.name);
 for(const [path,expected]of Object.entries(nextFiles))if(released[path]!==expected)throw Error('Released file verification failed: '+path);
 if(Object.keys(released).length!==Object.keys(nextFiles).length)throw Error('Released manifest count changed');
 return {changed:true,changedPath:PATH,baseVersion:base,version:version.name,preservedFiles:Object.keys(files).filter(p=>p!==PATH).length};
}
async function main(){
 const token=process.env.WOONBI_HOSTING_ACCESS_TOKEN;
 if(!token)throw Error('WOONBI_HOSTING_ACCESS_TOKEN is required');
 const request=async(method,path,body)=>{
  const response=await fetch('https://firebasehosting.googleapis.com/v1beta1/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error('Hosting API '+method+' failed: '+response.status);
  return response.json();
 };
 const upload=async(url,body)=>{
  const response=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/octet-stream'},body,signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw Error('School data upload failed: '+response.status);
 };
 const result=await refreshSchoolLife({request,upload,data:fs.readFileSync(process.argv[2]||'dist-live/school-life.json')});
 console.log(JSON.stringify(result,null,2));return result;
}
module.exports={refreshSchoolLife,listFiles,currentVersion,main};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
