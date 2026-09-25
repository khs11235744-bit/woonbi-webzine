/* Woonbi Google Drive media bridge.
 * Source/school Drive is read-only. Backup/personal Drive uses drive.file.
 * OAuth access tokens live in memory only and are never written to localStorage.
 */
(function(){
'use strict';
const W=window.Woonbi=window.Woonbi||{};
const DRIVE='https://www.googleapis.com/drive/v3';
const UPLOAD='https://www.googleapis.com/upload/drive/v3';
const FOLDER='application/vnd.google-apps.folder';
const SUPPORTED=new Set(['image/jpeg','image/png','image/webp']);
const FIREBASE_SDK='https://www.gstatic.com/firebasejs/12.17.1/';
const driveAuths={};
const state={
 source:null,target:null,sourceFolderId:'',sourceFolderName:'',pinnedSourceFolderId:'',pinnedSourceFolderName:'',targetFolderId:'',targetFolderName:'',
 rows:[],selected:new Set(),busy:false,lastScanAt:''
};

function cfg(){
 const raw=window.WOONBI_CONFIG?.googleDrive||{};
 return {
  clientId:String(raw.clientId||'').trim(),
  apiKey:String(raw.apiKey||window.WOONBI_CONFIG?.firebase?.apiKey||'').trim(),
  appId:String(raw.appId||window.WOONBI_CONFIG?.firebase?.messagingSenderId||'').trim(),
  backupFolderName:String(raw.backupFolderName||'웅비 사진 원본 백업').trim()||'웅비 사진 원본 백업',
  sourceListLimit:Math.max(100,Math.min(20000,Number(raw.sourceListLimit)||5000))
 };
}
function configured(){const c=cfg();return !!(c.apiKey&&c.appId);}
function escapeQuery(v){return String(v||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'");}
function sanitizeFolderName(v){return String(v||'자료').replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,' ').trim().slice(0,120)||'자료';}
function extractFolderId(v){
 const s=String(v||'').trim();
 if(/^[A-Za-z0-9_-]{10,}$/.test(s))return s;
 const m=s.match(/\/folders\/([A-Za-z0-9_-]{10,})/i)||s.match(/[?&]id=([A-Za-z0-9_-]{10,})/i);
 return m?.[1]||'';
}
function sameRevision(source,target){
 const p=target?.appProperties||{};
 if(source?.md5Checksum&&p.woonbiSourceMd5)return source.md5Checksum===p.woonbiSourceMd5;
 return !!source?.modifiedTime&&source.modifiedTime===p.woonbiSourceModified&&String(source.size||'')===String(p.woonbiSourceSize||'');
}
function storageGet(k){try{return localStorage.getItem(k)||'';}catch{return '';}}
function storageSet(k,v){try{v?localStorage.setItem(k,v):localStorage.removeItem(k);}catch{}}
function rememberFolders(){
 storageSet('woonbi.drive.sourceFolderId',state.sourceFolderId);
 storageSet('woonbi.drive.sourceFolderName',state.sourceFolderName);
 storageSet('woonbi.drive.pinnedSourceFolderId',state.pinnedSourceFolderId);
 storageSet('woonbi.drive.pinnedSourceFolderName',state.pinnedSourceFolderName);
 storageSet('woonbi.drive.targetFolderId',state.targetFolderId);
 storageSet('woonbi.drive.targetFolderName',state.targetFolderName);
}
function restoreFolders(){
 state.sourceFolderId=state.sourceFolderId||storageGet('woonbi.drive.sourceFolderId');
 state.sourceFolderName=state.sourceFolderName||storageGet('woonbi.drive.sourceFolderName');
 state.pinnedSourceFolderId=state.pinnedSourceFolderId||storageGet('woonbi.drive.pinnedSourceFolderId');
 state.pinnedSourceFolderName=state.pinnedSourceFolderName||storageGet('woonbi.drive.pinnedSourceFolderName');
 state.targetFolderId=state.targetFolderId||storageGet('woonbi.drive.targetFolderId');
 state.targetFolderName=state.targetFolderName||storageGet('woonbi.drive.targetFolderName');
}
function accountLabel(a){return a?.email||'연결 안 됨';}
function tokenValid(a){return !!a?.accessToken&&Date.now()<(a.expiresAt||0)-60000;}

function loadScript(src,ready){
 if(ready())return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const old=[...document.scripts].find(x=>x.src===src);
  if(old){const wait=()=>ready()?resolve():setTimeout(wait,50);wait();return;}
  const s=document.createElement('script');s.src=src;s.async=true;s.defer=true;
  s.onload=()=>ready()?resolve():reject(new Error('Google 스크립트를 불러왔지만 초기화되지 않았습니다.'));
  s.onerror=()=>reject(new Error('Google 연결 스크립트를 불러오지 못했습니다.'));
  document.head.append(s);
 });
}
async function ensureGIS(){
 await loadScript('https://accounts.google.com/gsi/client',()=>!!window.google?.accounts?.oauth2);
}
async function ensurePicker(){
 await loadScript('https://apis.google.com/js/api.js',()=>!!window.gapi);
 await new Promise((resolve,reject)=>{
  try{window.gapi.load('picker',{callback:resolve,onerror:()=>reject(new Error('Google Picker를 불러오지 못했습니다.'))});}
  catch(e){reject(e);}
 });
 if(!window.google?.picker)throw new Error('Google Picker가 준비되지 않았습니다.');
}
async function userInfo(token){
 const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:'Bearer '+token}});
 if(!r.ok)return {};
 return r.json();
}
async function connectViaFirebase(kind,loginHint=''){
 const fb=window.WOONBI_CONFIG?.firebase||{};
 if(!fb.apiKey||!fb.authDomain||!fb.appId)throw new Error('Firebase Google 로그인 설정이 필요합니다.');
 const [appSdk,A]=await Promise.all([import(FIREBASE_SDK+'firebase-app.js'),import(FIREBASE_SDK+'firebase-auth.js')]);
 const appName='woonbi-drive-'+kind;
 let app;try{app=appSdk.getApp(appName);}catch{app=appSdk.initializeApp(fb,appName);}
 const auth=A.getAuth(app);auth.languageCode='ko';await A.setPersistence(auth,A.inMemoryPersistence);
 const provider=new A.GoogleAuthProvider();provider.setCustomParameters({prompt:'consent',...(loginHint?{login_hint:loginHint}:{})});
 provider.addScope(kind==='source'?'https://www.googleapis.com/auth/drive.readonly':'https://www.googleapis.com/auth/drive.file');
 const result=await A.signInWithPopup(auth,provider),cred=A.GoogleAuthProvider.credentialFromResult(result);
 const token=cred?.accessToken;if(!token)throw new Error('Google Drive 권한 토큰을 받지 못했습니다.');
 const info=await userInfo(token),row={accessToken:token,email:info.email||result.user?.email||'',name:info.name||result.user?.displayName||'',expiresAt:Date.now()+3500*1000};
 driveAuths[kind]=auth;state[kind]=row;return row;
}
async function connectViaGIS(kind,loginHint=''){
 const c=cfg();if(!c.clientId)throw new Error('Firebase Google 로그인 또는 별도 OAuth Client ID 설정이 필요합니다.');
 await ensureGIS();
 const scope=kind==='source'
  ?'openid email profile https://www.googleapis.com/auth/drive.readonly'
  :'openid email profile https://www.googleapis.com/auth/drive.file';
 const response=await new Promise((resolve,reject)=>{
  const client=window.google.accounts.oauth2.initTokenClient({
   client_id:c.clientId,scope,hint:loginHint||undefined,
   callback:r=>r?.error?reject(new Error('Google 계정 연결 실패: '+r.error)):resolve(r),
   error_callback:e=>reject(new Error('Google 계정 연결 창을 완료하지 못했습니다: '+(e?.type||'unknown')))
  });
  client.requestAccessToken({prompt:'select_account'});
 });
 const info=await userInfo(response.access_token),row={accessToken:response.access_token,email:info.email||'',name:info.name||'',expiresAt:Date.now()+Number(response.expires_in||3600)*1000};
 state[kind]=row;return row;
}
async function connect(kind,loginHint=''){
 const c=cfg(),fb=window.WOONBI_CONFIG?.firebase||{};
 // Picker follows Google's official GIS token-client flow when a Web OAuth client is configured.
 // The main Woonbi Firebase login remains untouched.
 if(kind==='picker'&&c.clientId)return connectViaGIS(kind,loginHint);
 if(fb.apiKey&&fb.authDomain&&fb.appId)return connectViaFirebase(kind,loginHint);
 return connectViaGIS(kind,loginHint);
}
function requireAccount(kind){
 const a=state[kind];
 if(!tokenValid(a))throw new Error((kind==='source'?'학교 Drive':'개인 5TB Drive')+' 계정을 다시 연결해 주세요.');
 return a;
}
async function apiFetch(token,url,options={}){
 const headers=new Headers(options.headers||{});headers.set('Authorization','Bearer '+token);
 const r=await fetch(url,{...options,headers});
 if(!r.ok){
  let detail='';try{const j=await r.json();detail=j?.error?.message||JSON.stringify(j);}catch{detail=await r.text();}
  throw new Error('Google Drive 요청 실패 ('+r.status+'): '+String(detail||r.statusText).slice(0,400));
 }
 return r;
}
async function getMeta(token,id){
 const fields='id,name,mimeType,size,modifiedTime,md5Checksum,thumbnailLink,parents,driveId,appProperties,capabilities(canDownload)';
 const u=DRIVE+'/files/'+encodeURIComponent(id)+'?supportsAllDrives=true&fields='+encodeURIComponent(fields);
 return (await apiFetch(token,u)).json();
}
async function listChildren(token,parentId){
 const out=[];let page='';
 do{
  const q="'"+escapeQuery(parentId)+"' in parents and trashed = false";
  const fields='nextPageToken,files(id,name,mimeType,size,modifiedTime,md5Checksum,thumbnailLink,parents,driveId,appProperties,capabilities(canDownload))';
  const params=new URLSearchParams({q,pageSize:'1000',fields,spaces:'drive',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});
  if(page)params.set('pageToken',page);
  const data=await (await apiFetch(token,DRIVE+'/files?'+params)).json();
  out.push(...(data.files||[]));page=data.nextPageToken||'';
 }while(page);
 return out;
}
async function scanSourceFolder(folderId,onProgress){
 const a=requireAccount('source'),root=await getMeta(a.accessToken,folderId);
 if(root.mimeType!==FOLDER)throw new Error('선택한 항목이 Drive 폴더가 아닙니다.');
 state.sourceFolderId=root.id;state.sourceFolderName=root.name;rememberFolders();
 const limit=cfg().sourceListLimit,queue=[{id:root.id,parts:[]}],rows=[];let folders=0,truncated=false;
 while(queue.length){
  const node=queue.shift(),children=await listChildren(a.accessToken,node.id);folders++;
  for(const f of children){
   if(f.mimeType===FOLDER){queue.push({id:f.id,parts:[...node.parts,f.name]});continue;}
   if(!String(f.mimeType||'').startsWith('image/'))continue;
   if(rows.length>=limit){truncated=true;break;}
   rows.push({
    id:f.id,name:f.name,mimeType:f.mimeType,size:Number(f.size||0),modifiedTime:f.modifiedTime||'',
    md5Checksum:f.md5Checksum||'',thumbnailLink:f.thumbnailLink||'',canDownload:f.capabilities?.canDownload!==false,
    driveId:f.driveId||'',folderParts:node.parts,path:[...node.parts,f.name].join('/'),
    supported:SUPPORTED.has(f.mimeType)
   });
  }
  onProgress?.({folders,files:rows.length,queued:queue.length,limit,truncated});
  if(truncated)break;
 }
 state.rows=rows;state.selected=new Set();state.lastScanAt=new Date().toISOString();
 return {root,rows,truncated,folders};
}
async function downloadSource(row){
 const a=requireAccount('source');if(row.canDownload===false)throw new Error(row.name+'은(는) 다운로드가 제한된 파일입니다.');
 const u=DRIVE+'/files/'+encodeURIComponent(row.id)+'?alt=media&supportsAllDrives=true';
 const r=await apiFetch(a.accessToken,u),blob=await r.blob(),type=blob.type||row.mimeType||'application/octet-stream';
 const file=new File([blob],row.name,{type,lastModified:row.modifiedTime?Date.parse(row.modifiedTime):Date.now()});
 try{Object.defineProperty(file,'webkitRelativePath',{value:row.path||row.name,configurable:true});}catch{}
 return file;
}
async function downloadForWoonbi(rows,onProgress){
 const usable=rows.filter(r=>r.supported&&r.canDownload!==false),files=[],skipped=rows.length-usable.length;
 for(let i=0;i<usable.length;i++){files.push(await downloadSource(usable[i]));onProgress?.(i+1,usable.length);}
 return {files,skipped};
}

async function pickImages(){
 const c=cfg();if(!configured())throw new Error('Google Picker 설정(API Key·Project Number)이 필요합니다.');
 const a=requireAccount('source');await ensurePicker();
 return new Promise((resolve,reject)=>{
  const g=window.google.picker,view=new g.DocsView(g.ViewId.DOCS).setMimeTypes('image/jpeg,image/png,image/webp').setMode(g.DocsViewMode.LIST);
  const picker=new g.PickerBuilder().setOAuthToken(a.accessToken).setDeveloperKey(c.apiKey).setAppId(c.appId).setOrigin(location.origin)
   .addView(view).enableFeature(g.Feature.MULTISELECT_ENABLED).enableFeature(g.Feature.NAV_HIDDEN).setTitle('웅비에 가져올 사진 선택')
   .setCallback(async data=>{
    if(data.action===g.Action.PICKED){
     try{
      const rows=[];for(const d of (data.docs||[])){const m=await getMeta(a.accessToken,d.id);rows.push({id:m.id,name:m.name,mimeType:m.mimeType,size:Number(m.size||0),modifiedTime:m.modifiedTime||'',md5Checksum:m.md5Checksum||'',thumbnailLink:m.thumbnailLink||'',canDownload:m.capabilities?.canDownload!==false,driveId:m.driveId||'',folderParts:[],path:m.name,supported:SUPPORTED.has(m.mimeType)});}
      state.rows=rows;state.selected=new Set(rows.map(r=>r.id));state.lastScanAt=new Date().toISOString();resolve(rows);
     }catch(e){reject(e);}
    }else if(data.action===g.Action.CANCEL)resolve([]);
    else if(data.action===g.Action.ERROR)reject(new Error(data.error?.message||data.error||'Google Picker 오류'));
   }).build();
  picker.setVisible(true);
 });
}
async function pickFolder(kind){
 const c=cfg();if(!configured())throw new Error('Google Drive Picker 설정(API Key·Project Number)이 필요합니다.');
 const a=requireAccount(kind);await ensurePicker();
 return new Promise((resolve,reject)=>{
  const g=window.google.picker;
  const normal=new g.DocsView(g.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true);
  const shared=new g.DocsView(g.ViewId.FOLDERS).setIncludeFolders(true).setSelectFolderEnabled(true).setEnableDrives(true);
  const picker=new g.PickerBuilder().setOAuthToken(a.accessToken).setDeveloperKey(c.apiKey).setAppId(c.appId)
   .addView(normal).addView(shared).setTitle(kind==='source'?'학교 사진 폴더 선택':'개인 Drive 백업 폴더 선택')
   .setCallback(data=>{
    if(data.action===g.Action.PICKED){
     const d=data.docs?.[0];if(!d?.id)return reject(new Error('선택한 폴더 ID를 확인하지 못했습니다.'));
     if(kind==='source'){state.sourceFolderId=d.id;state.sourceFolderName=d.name||'학교 사진';}
     else{state.targetFolderId=d.id;state.targetFolderName=d.name||'개인 백업 폴더';}
     rememberFolders();resolve({id:d.id,name:d.name||''});
    }else if(data.action===g.Action.CANCEL)resolve(null);
   }).build();
  picker.setVisible(true);
 });
}
async function createFolder(token,name,parentId){
 const body={name:sanitizeFolderName(name),mimeType:FOLDER,parents:[parentId],appProperties:{woonbiManaged:'1'}};
 const r=await apiFetch(token,DRIVE+'/files?supportsAllDrives=true&fields='+encodeURIComponent('id,name,mimeType,parents,appProperties'),{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
 });
 return r.json();
}
async function ensureTargetRoot(){
 const a=requireAccount('target');
 if(state.targetFolderId){
  try{const m=await getMeta(a.accessToken,state.targetFolderId);if(m.mimeType===FOLDER){state.targetFolderName=m.name;rememberFolders();return m;}}
  catch{}
  state.targetFolderId='';state.targetFolderName='';rememberFolders();
 }
 const root=await createFolder(a.accessToken,cfg().backupFolderName,'root');
 state.targetFolderId=root.id;state.targetFolderName=root.name;rememberFolders();return root;
}
async function buildTargetIndex(rootId){
 const a=requireAccount('target'),queue=[rootId],folders=new Map(),files=new Map();folders.set(rootId+'\u0000','');
 while(queue.length){
  const parent=queue.shift(),children=await listChildren(a.accessToken,parent);
  for(const f of children){
   if(f.mimeType===FOLDER){folders.set(parent+'\u0000'+f.name,f);queue.push(f.id);}
   else if(f.appProperties?.woonbiSourceId)files.set(f.appProperties.woonbiSourceId,f);
  }
 }
 return {folders,files};
}
async function ensurePath(rootId,parts,index){
 const a=requireAccount('target');let parent=rootId,path='';
 for(const raw of parts.filter(Boolean)){
  const name=sanitizeFolderName(raw),key=parent+'\u0000'+name;let folder=index.folders.get(key);
  if(!folder){folder=await createFolder(a.accessToken,name,parent);index.folders.set(key,folder);}
  parent=folder.id;path+=(path?'/':'')+name;
 }
 return parent;
}
async function multipartUpload(token,blob,meta,id){
 const boundary='woonbi_'+Math.random().toString(36).slice(2),head='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(meta)+'\r\n--'+boundary+'\r\nContent-Type: '+(blob.type||'application/octet-stream')+'\r\n\r\n',tail='\r\n--'+boundary+'--';
 const body=new Blob([head,blob,tail],{type:'multipart/related; boundary='+boundary});
 const url=UPLOAD+'/files'+(id?'/'+encodeURIComponent(id):'')+'?uploadType=multipart&supportsAllDrives=true&fields='+encodeURIComponent('id,name,size,modifiedTime,md5Checksum,parents,appProperties');
 return (await apiFetch(token,url,{method:id?'PATCH':'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body})).json();
}
async function uploadOriginal(token,blob,meta,id){
 const url=UPLOAD+'/files'+(id?'/'+encodeURIComponent(id):'')+'?uploadType=resumable&supportsAllDrives=true&fields='+encodeURIComponent('id,name,size,modifiedTime,md5Checksum,parents,appProperties');
 const start=await apiFetch(token,url,{method:id?'PATCH':'POST',headers:{'Content-Type':'application/json; charset=UTF-8','X-Upload-Content-Type':blob.type||'application/octet-stream','X-Upload-Content-Length':String(blob.size)},body:JSON.stringify(meta)});
 const location=start.headers.get('Location');
 if(!location)return multipartUpload(token,blob,meta,id);
 const finish=await fetch(location,{method:'PUT',headers:{'Content-Type':blob.type||'application/octet-stream'},body:blob});
 if(!finish.ok)throw new Error('개인 Drive 원본 업로드 실패 ('+finish.status+')');
 return finish.json();
}
async function backupRows(rows,onProgress){
 const source=requireAccount('source'),target=requireAccount('target'),root=await ensureTargetRoot(),index=await buildTargetIndex(root.id);
 const out={uploaded:0,updated:0,skipped:0,failed:[]},sourceRoot=sanitizeFolderName(state.sourceFolderName||'학교 Drive');
 for(let i=0;i<rows.length;i++){
  const row=rows[i];
  try{
   const existing=index.files.get(row.id);
   if(existing&&sameRevision(row,existing)){out.skipped++;onProgress?.(i+1,rows.length,out);continue;}
   const file=await downloadSource(row),parent=await ensurePath(root.id,[sourceRoot,...(row.folderParts||[])],index);
   const meta={
    name:row.name,
    appProperties:{
     woonbiManaged:'1',woonbiSourceId:row.id,woonbiSourceModified:row.modifiedTime||'',
     woonbiSourceMd5:row.md5Checksum||'',woonbiSourceSize:String(row.size||file.size||0)
    }
   };
   if(!existing)meta.parents=[parent];
   const saved=await uploadOriginal(target.accessToken,file,meta,existing?.id||'');
   index.files.set(row.id,saved);existing?out.updated++:out.uploaded++;
  }catch(e){out.failed.push({id:row.id,name:row.name,message:e?.message||String(e)});}
  onProgress?.(i+1,rows.length,out);
 }
 return out;
}
function resetTokens(){state.source=null;state.target=null;}

function panel(ui){
 restoreFolders();
 const {h,button,toast,onFiles,onRefresh,signedInEmail,getDrivePickerToken,getDriveFolderToken,getDriveBackupToken}=ui,c=cfg();
 const wrap=h('section',{class:'photo-folder-panel drive-photo-panel'});
 const sourceStatus=h('span',{class:'drive-account-state'},state.source?accountLabel(state.source):(signedInEmail||'로그인 필요'));
 const targetStatus=h('span',{class:'drive-account-state'},accountLabel(state.target));
 const sourceUrl=h('input',{type:'url',placeholder:'학교 Google Drive 폴더 링크 또는 폴더 ID','aria-label':'학교 Drive 폴더 링크',value:state.sourceFolderId?('https://drive.google.com/drive/folders/'+state.sourceFolderId):''});
 const progress=h('p',{class:'small muted drive-progress','aria-live':'polite'},'');
 const summary=h('div',{class:'drive-library'});
 const mode=h('select',{'aria-label':'Drive 처리 방식'},
  h('option',{value:'selective'},'선택 사진만 웅비로'),
  h('option',{value:'backup'},'선택 원본 백업 + 웅비로'),
  h('option',{value:'archive'},'폴더 전체 증분 백업')
 );
 mode.value=storageGet('woonbi.drive.mode')||'selective';
 mode.addEventListener('change',()=>storageSet('woonbi.drive.mode',mode.value));

 function busy(v,msg=''){state.busy=v;progress.textContent=msg;}
 function selectedRows(){return state.rows.filter(r=>state.selected.has(r.id));}
 function pickerErrorMessage(e){
  const msg=String(e?.message||e||'');
  if(/developer key|api key|invalid key/i.test(msg))return 'Google Picker API Key 설정을 확인해 주세요. 웹사이트 제한에 현재 웅비 주소와 https://docs.google.com/* 가 모두 필요합니다.';
  if(/popup|blocked/i.test(msg))return 'Google 로그인 팝업이 차단됐습니다. 브라우저 주소창의 팝업 허용을 켠 뒤 다시 시도해 주세요.';
  if(/access_denied|denied|admin|policy/i.test(msg))return '학교 Google Workspace 정책에서 Drive Picker 권한이 차단됐을 수 있습니다. 화면의 Google 오류 문구를 확인해 주세요.';
  return msg||'Google Picker를 열지 못했습니다.';
 }
 async function sendRowsToWoonbi(chosen){
  if(!chosen?.length)return;
  busy(true,'선택한 Drive 사진 내려받는 중…');
  const out=await downloadForWoonbi(chosen,(n,total)=>busy(true,'웅비용 원본 '+n+'/'+total+' 내려받는 중'));
  if(!out.files.length)throw new Error('JPG·PNG·WebP 형식의 다운로드 가능한 사진이 없습니다.');
  if(mode.value==='backup'){
   requireAccount('target');const b=await backupRows(chosen,(n,total)=>busy(true,'원본 백업 '+n+'/'+total));
   toast('원본 백업 '+(b.uploaded+b.updated)+'장 · 건너뜀 '+b.skipped+'장');
  }
  busy(true,'중복·기사 추천 분석 중…');await onFiles?.(out.files,chosen);
  toast('Drive 사진 '+out.files.length+'장 분석 완료'+(out.skipped?' · 미지원/제한 '+out.skipped+'장':''));
 }
 function pinCurrentSource(){
  const id=extractFolderId(sourceUrl.value)||state.sourceFolderId;if(!id)return toast('먼저 학교 공유폴더를 선택하거나 링크를 붙여넣어 주세요.');
  state.pinnedSourceFolderId=id;state.pinnedSourceFolderName=state.sourceFolderName||'학교 기본 사진함';rememberFolders();toast('이 폴더를 기본 학교 사진함으로 저장했습니다.');draw();
 }
 function unpinSource(){state.pinnedSourceFolderId='';state.pinnedSourceFolderName='';rememberFolders();toast('기본 학교 사진함 지정을 해제했습니다.');draw();}
 async function scanPinnedSource(){
  const id=state.pinnedSourceFolderId;if(!id)return openCurrentPicker();
  busy(true,'기본 학교 사진함 불러오는 중…');
  try{
   if(!tokenValid(state.source)||!String(state.source.scope||'').includes('drive.readonly'))state.source=typeof getDriveFolderToken==='function'?await getDriveFolderToken():await connect('source');
   const out=await scanSourceFolder(id,s=>busy(true,'학교 사진함 · 폴더 '+s.folders+'개 · 사진 '+s.files+'장'));
   sourceUrl.value='https://drive.google.com/drive/folders/'+out.root.id;state.pinnedSourceFolderName=out.root.name;rememberFolders();
   toast('기본 학교 사진함에서 '+out.rows.length+'장을 불러왔습니다.');draw();onRefresh?.();
  }finally{busy(false,'');}
 }
 async function openCurrentPicker(){
  busy(true,'현재 Google 계정으로 Picker 권한 확인 중…');
  try{
   // Use an isolated Firebase Auth session for Drive consent. This avoids reauth popup stalls
   // on Workspace accounts while keeping the main Woonbi login session untouched.
   state.source=await connect('picker',signedInEmail||'');
   draw();
   const rows=await pickImages();
   if(rows.length){draw();await sendRowsToWoonbi(rows);}
  }catch(e){throw new Error(pickerErrorMessage(e));}
  finally{busy(false,'');}
 }
 function draw(){
  sourceStatus.textContent=state.source?accountLabel(state.source):(signedInEmail||'로그인 필요');targetStatus.textContent=accountLabel(state.target);summary.replaceChildren();
  const rows=state.rows,selected=selectedRows();
  if(!rows.length){summary.append(h('p',{class:'empty'},state.sourceFolderName?'“'+state.sourceFolderName+'” 폴더를 읽으면 사진 목록이 나타납니다.':'학교 Drive 계정을 연결하고 사진 폴더를 선택해 주세요.'));return;}
  const supported=rows.filter(r=>r.supported).length,downloadable=rows.filter(r=>r.canDownload!==false).length;
  const stats=h('div',{class:'drive-stats'},h('span',{},'사진 '+rows.length),h('span',{},'웅비 변환 가능 '+supported),h('span',{},'다운로드 가능 '+downloadable),h('span',{},'선택 '+selected.length),h('span',{},'원본 '+Math.round(rows.reduce((n,r)=>n+r.size,0)/1024/1024).toLocaleString()+'MB'));
  const controls=h('div',{class:'drive-library-actions'},
   button('전체 선택',()=>{for(const r of rows)if(r.canDownload!==false)state.selected.add(r.id);draw();},'text'),
   button('선택 해제',()=>{state.selected.clear();draw();},'text'),
   button('선택 사진 다시 분석',async()=>{
    const chosen=selectedRows();if(!chosen.length)return toast('분석할 사진을 선택해 주세요.');
    try{await sendRowsToWoonbi(chosen);}catch(e){toast(e.message||String(e));}finally{busy(false,'');draw();}
   },'primary'),
   button('선택 원본 5TB 백업',async()=>{
    const chosen=selectedRows();if(!chosen.length)return toast('백업할 사진을 선택해 주세요.');
    busy(true,'개인 Drive 증분 백업 준비 중…');
    try{const out=await backupRows(chosen,(n,total,o)=>busy(true,'백업 '+n+'/'+total+' · 새 파일 '+o.uploaded+' · 갱신 '+o.updated+' · 건너뜀 '+o.skipped));toast('백업 완료 · 새 파일 '+out.uploaded+' · 갱신 '+out.updated+' · 이미 있음 '+out.skipped+(out.failed.length?' · 실패 '+out.failed.length:''));}
    catch(e){toast(e.message||String(e));}finally{busy(false,'');draw();}
   },'text'),
   button('폴더 전체 증분백업',async()=>{
    if(!state.rows.length)return toast('먼저 학교 폴더를 읽어 주세요.');
    if(!confirm('현재 읽은 사진 '+state.rows.length+'장의 원본을 개인 Drive에 증분 백업할까요? 이미 같은 원본은 건너뜁니다.'))return;
    busy(true,'전체 증분백업 준비 중…');
    try{const out=await backupRows(state.rows,(n,total,o)=>busy(true,'전체 백업 '+n+'/'+total+' · 새 '+o.uploaded+' · 갱신 '+o.updated+' · 건너뜀 '+o.skipped));toast('전체 증분백업 완료 · 새 파일 '+out.uploaded+' · 갱신 '+out.updated+' · 이미 있음 '+out.skipped+(out.failed.length?' · 실패 '+out.failed.length:''));}
    catch(e){toast(e.message||String(e));}finally{busy(false,'');draw();}
   },'text')
  );
  const list=h('div',{class:'drive-photo-list'});
  const display=rows.slice(0,800);
  for(const r of display){
   const check=h('input',{type:'checkbox',checked:state.selected.has(r.id),disabled:r.canDownload===false,'aria-label':r.name+' 선택'});
   check.addEventListener('change',()=>{check.checked?state.selected.add(r.id):state.selected.delete(r.id);draw();});
   const media=r.thumbnailLink?h('img',{src:r.thumbnailLink,alt:r.name,loading:'lazy',referrerpolicy:'no-referrer'}):h('div',{class:'drive-photo-placeholder'},'IMG');
   list.append(h('article',{class:'drive-photo-row'+(r.canDownload===false?' disabled':'')},check,media,h('div',{class:'drive-photo-meta'},h('b',{},r.name),h('span',{},r.path||r.name),h('small',{},Math.round(r.size/1024).toLocaleString()+'KB · '+(r.supported?'웅비 변환 가능':'원본 백업만')+(r.canDownload===false?' · 다운로드 제한':'')))));
  }
  summary.append(stats,controls,list);
  if(rows.length>display.length)summary.append(h('p',{class:'small muted'},'화면에는 앞 '+display.length+'장만 표시합니다. 전체 '+rows.length+'장은 백업·선택 통계에 포함됩니다.'));
 }
 const configNotice=!configured()?h('div',{class:'notice warn drive-config-notice'},h('b',{},'Google Drive 연결 설정 필요'),h('span',{},' Firebase Google 로그인과 제한된 Picker API Key·Project Number를 사용해 학교 계정과 개인 계정을 각각 선택합니다. 별도 Client Secret은 사용하지 않습니다.')):null;
 const sourceActions=h('div',{class:'drive-account-card'},
  h('div',{},h('span',{class:'eyebrow'},'SOURCE · PICKER FIRST'),h('h3',{},'학교 Drive'),h('p',{class:'small muted'},'기본은 Google Picker로 필요한 사진만 선택합니다. 폴더 전체 재귀 스캔은 별도 읽기 권한이 필요합니다.'),sourceStatus),
  h('div',{class:'actions'},
   button('현재 계정으로 Picker 열기',async()=>{try{await openCurrentPicker();}catch(e){toast(e.message||String(e));}},'primary'),
   button('폴더 전체 읽기 권한',async()=>{try{busy(true,'학교 Drive 전체 읽기 권한 연결 중…');state.source=typeof getDriveFolderToken==='function'?await getDriveFolderToken():await connect('source');toast('폴더 전체 읽기 권한을 연결했습니다.');draw();}catch(e){toast(e.message||String(e));}finally{busy(false,'');}},'text'),
   button('Drive에서 폴더 선택',async()=>{try{const d=await pickFolder('source');if(d){sourceUrl.value='https://drive.google.com/drive/folders/'+d.id;state.sourceFolderId=d.id;state.sourceFolderName=d.name||'학교 사진';state.pinnedSourceFolderId=d.id;state.pinnedSourceFolderName=d.name||'학교 사진';rememberFolders();toast('학교 사진 폴더를 선택하고 기본 사진함으로 저장했습니다.');draw();}}catch(e){toast(e.message||String(e));}},'text'))
 );
 const targetActions=h('div',{class:'drive-account-card'},
  h('div',{},h('span',{class:'eyebrow'},'BACKUP · APP FILES ONLY'),h('h3',{},'개인 5TB Drive'),h('p',{class:'small muted'},'웅비가 만든 백업 폴더·파일만 관리합니다.'),targetStatus),
  h('div',{class:'actions'},button('개인 계정 연결',async()=>{try{busy(true,'개인 Google 계정 연결 중…');state.target=typeof getDriveBackupToken==='function'?await getDriveBackupToken():await connect('target');toast('개인 백업 Drive 계정을 연결했습니다.');draw();}catch(e){toast(e.message||String(e));}finally{busy(false,'');}},'primary'),
   button('백업 폴더 선택',async()=>{try{const d=await pickFolder('target');if(d){toast('개인 Drive 백업 폴더를 선택했습니다: '+d.name);draw();}}catch(e){toast(e.message||String(e));}},'text'))
 );
 const sourceControls=h('div',{class:'drive-photo-controls'},sourceUrl,mode,
  button(state.pinnedSourceFolderId?'기본 사진함 변경':'이 폴더 기본으로 저장',pinCurrentSource,'text'),
  button('공유폴더 새 탭으로 열기',()=>{const id=extractFolderId(sourceUrl.value);if(!id)return toast('공유폴더 링크를 먼저 붙여넣어 주세요.');window.open('https://drive.google.com/drive/folders/'+id,'_blank','noopener');},'text'),
  button('학교 폴더 읽기',async()=>{
   const id=extractFolderId(sourceUrl.value);if(!id)return toast('Google Drive 폴더 링크 또는 폴더 ID를 확인해 주세요.');
   state.sourceFolderId=id;rememberFolders();busy(true,'학교 Drive 폴더 읽는 중…');
   try{if(!tokenValid(state.source)||!String(state.source.scope||'').includes('drive.readonly'))state.source=typeof getDriveFolderToken==='function'?await getDriveFolderToken():await connect('source');const out=await scanSourceFolder(id,s=>busy(true,'폴더 '+s.folders+'개 · 사진 '+s.files+'장 확인 중'+(s.queued?' · 대기 폴더 '+s.queued:'')));sourceUrl.value='https://drive.google.com/drive/folders/'+out.root.id;toast('학교 Drive 사진 '+out.rows.length+'장을 불러왔습니다.'+(out.truncated?' · 설정 한도에서 목록을 멈췄습니다.':''));}
   catch(e){toast(e.message||String(e));}finally{busy(false,'');draw();onRefresh?.();}
  },'primary')
 );
 const quick=h('section',{class:'drive-quickstart'},
  h('div',{},h('span',{class:'eyebrow'},'가장 쉬운 방법'),h('h3',{},state.pinnedSourceFolderId?'기본 학교 사진함 한 번에 불러오기':'공유된 학교 사진을 3단계로 가져오기'),state.pinnedSourceFolderId?h('p',{class:'small muted'},'기본 사진함 · '+(state.pinnedSourceFolderName||'저장된 공유폴더')):null),
  h('ol',{},h('li',{},'현재 웅비 로그인 계정: ',h('b',{},signedInEmail||'Google 로그인 필요')),h('li',{},state.pinnedSourceFolderId?'“학교 사진 불러오기”를 누르면 저장된 공유폴더를 바로 읽습니다.':'처음 한 번만 Picker 또는 Drive 폴더 선택으로 학교 사진함을 지정합니다.'),h('li',{},state.pinnedSourceFolderId?'사진 목록에서 필요한 사진을 골라 분석합니다.':'Picker에서 사진을 고르면 곧바로 중복검사·기사추천까지 진행됩니다.')),
  h('div',{class:'actions'},state.pinnedSourceFolderId?button('학교 사진 불러오기',async()=>{try{await scanPinnedSource();}catch(e){toast(e.message||String(e));}},'primary'):button('현재 계정으로 Picker 열기',async()=>{try{await openCurrentPicker();}catch(e){toast(e.message||String(e));}},'primary'),state.pinnedSourceFolderId?button('기본 사진함 해제',unpinSource,'text'):null));
 wrap.append(h('div',{class:'dashboard-section-head'},h('div',{},h('span',{class:'eyebrow'},'WOONBI MEDIA BRIDGE'),h('h2',{},'학교 Drive → 개인 원본 백업 → 웅비'),h('p',{class:'small muted'},'원본 저장과 웹 공개를 분리합니다. 기본 경로는 현재 로그인 계정의 Google Picker입니다. 폴더 전체 읽기는 필요할 때만 별도 권한을 요청합니다.'))),quick);
 if(configNotice)wrap.append(configNotice);
 wrap.append(h('div',{class:'drive-account-grid'},sourceActions,targetActions),sourceControls,progress,summary);
 draw();return wrap;
}

restoreFolders();
W.driveBridge={panel,connect,pickFolder,pickImages,scanSourceFolder,downloadForWoonbi,backupRows,resetTokens,state,_test:{extractFolderId,sanitizeFolderName,sameRevision,escapeQuery,cfg,configured}};
})();