/* Live adapter. Not enabled by the demo; live OAuth/rules/storage must be verified before a school pilot. */
(function(){
'use strict';const W=window.Woonbi,C=W.core,SDK='https://www.gstatic.com/firebasejs/12.17.1/';
class FirebaseStore{
 constructor(config){C.projectGuard(config);this.config=config;this.mode='firebase';this.user=null;this.unsub=null;this.openAdmin=!!config.openAdmin;}
 async init(){
  [this.appSdk,this.A,this.F,this.S]=await Promise.all(['firebase-app.js','firebase-auth.js','firebase-firestore.js','firebase-storage.js'].map(f=>import(SDK+f)));
  const app=this.appSdk.initializeApp(this.config.firebase,'woonbi-webzine');this.auth=this.A.getAuth(app);this.auth.languageCode='ko';
  this.db=this.F.initializeFirestore(app,{localCache:this.F.memoryLocalCache()});
  if(this.config.enableStorage)this.storage=this.S.getStorage(app);
  await this.A.setPersistence(this.auth,this.A.browserSessionPersistence);
  await this.A.getRedirectResult(this.auth);
  await new Promise((resolve,reject)=>{let settled=false;this.unsub=this.A.onAuthStateChanged(this.auth,async u=>{
   try{this.user=null;if(u){if(!u.emailVerified)throw C.error('auth','Google 이메일 확인이 필요합니다.');const ref=this.F.doc(this.db,'members',u.uid);let m=await this.F.getDoc(ref);
    if(!m.exists()){await this.F.setDoc(ref,{displayName:(u.displayName||'사용자').slice(0,60),role:'student',active:true,createdAt:this.F.serverTimestamp()});m=await this.F.getDoc(ref);}
    const profile={uid:u.uid,email:u.email||'',...m.data()},schoolTeacher=/@phhs\.kr$/i.test(profile.email||''),baseRole=schoolTeacher?'teacher':profile.role,baseActive=schoolTeacher?true:profile.active;this.openAdmin=await this.getAccessMode();this.user=this.openAdmin?{...profile,baseRole,role:'teacher',active:true,openAdmin:true,schoolTeacher}:{...profile,baseRole,role:baseRole,active:baseActive,openAdmin:false,schoolTeacher};}
    if(!settled){settled=true;resolve();}else this.onAuthChange?.();
   }catch(e){if(!settled){settled=true;reject(e);}else this.onError?.(e);}
  },reject);});return this;
 }
 provider(){const p=new this.A.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});return p;}
 async login(){await this.A.signInWithPopup(this.auth,this.provider());}
 async loginRedirect(){return this.A.signInWithRedirect(this.auth,this.provider());}
 async logout(){await this.A.signOut(this.auth);this.user=null;}
 async getAccessMode(){
  try{const d=await this.F.getDoc(this.F.doc(this.db,'settings','access'));return d.exists()?d.data().openAdmin===true:!!this.config.openAdmin;}catch{return !!this.config.openAdmin;}
 }
 async setOpenAdmin(value){
  const next=!!value;
  if(next&&this.user?.baseRole!=='teacher')throw C.error('permission','교사 계정만 관리자 모드를 다시 열 수 있습니다.');
  if(!next&&!this.openAdmin&&this.user?.baseRole!=='teacher')throw C.error('permission','현재 계정으로 변경할 수 없습니다.');
  await this.F.setDoc(this.F.doc(this.db,'settings','access'),{openAdmin:next,updatedAt:this.F.serverTimestamp(),updatedBy:this.user.uid},{merge:false});
  this.openAdmin=next;return this.openAdmin;
 }
 async driveAccess(kind='picker'){
  const u=this.auth.currentUser;if(!u)throw C.error('auth','먼저 Google 계정으로 웅비에 로그인해 주세요.');
  const p=new this.A.GoogleAuthProvider();p.setCustomParameters({prompt:'consent',login_hint:u.email||''});
  const scope=kind==='folder'?'https://www.googleapis.com/auth/drive.readonly':'https://www.googleapis.com/auth/drive.file';
  p.addScope(scope);
  const result=await this.A.reauthenticateWithPopup(u,p),cred=this.A.GoogleAuthProvider.credentialFromResult(result);
  if(!cred?.accessToken)throw C.error('auth','Google Drive 접근 토큰을 받지 못했습니다.');
  return {accessToken:cred.accessToken,email:result.user.email||'',name:result.user.displayName||'',expiresAt:Date.now()+3500*1000,scope};
 }
 async drivePickerAccess(){return this.driveAccess('picker');}
 async driveFolderAccess(){return this.driveAccess('folder');}
 async driveBackupAccess(){return this.driveAccess('backup');}
 async listMembers(){const F=this.F;if(!C.teacher(this.user))return this.user?[this.user]:[];const s=await F.getDocs(F.query(F.collection(this.db,'members'),F.limit(250)));return s.docs.map(d=>({uid:d.id,...d.data()}));}
 async setMember(uid,role,active){if(!C.teacher(this.user)||!['student','editor','pending'].includes(role))throw C.error('permission','계정 권한을 확인해 주세요.');await this.F.updateDoc(this.F.doc(this.db,'members',uid),{role,active});}
 async updateAssignment(id,expected,patch){
  if(!C.teacher(this.user))throw C.error('permission','교사 권한이 필요합니다.');
  const ids=[...new Set((patch.assigneeIds||[]).map(String).filter(Boolean))];
  if(!ids.length||ids.length>8)throw C.error('invalid','담당 학생을 1명 이상 8명 이하로 선택해 주세요.');
  const members=await this.listMembers(),byId=new Map(members.map(m=>[m.uid,m.displayName||'학생']));
  const names=ids.map(uid=>byId.get(uid)||'승인 계정');
  return this.mutate(id,expected,a=>({...a,assigneeIds:ids,assigneeNames:names,dueDate:String(patch.dueDate||'').slice(0,10),revision:a.revision+1,updatedAt:new Date().toISOString(),updatedBy:this.user.uid,webConsent:false,printConsent:false}));
 }
 async updateDueDate(id,expected,dueDate){
  if(!C.teacher(this.user))throw C.error('permission','교사 권한이 필요합니다.');
  return this.mutate(id,expected,a=>{
   if(!['draft','changes'].includes(a.status))throw C.error('locked','검토·승인 중인 기사의 마감일은 먼저 상태를 확인해 주세요.');
   return {...a,dueDate:String(dueDate||'').slice(0,10),revision:a.revision+1,updatedAt:new Date().toISOString(),updatedBy:this.user.uid,webConsent:false,printConsent:false};
  });
 }
 async batchUpdateDueDates(ids,dueDate){
  const out={updated:[],skipped:[]};
  for(const id of [...new Set(ids||[])]){try{const a=await this.getArticle(id);await this.updateDueDate(id,a.revision,dueDate);out.updated.push(id);}catch(e){out.skipped.push({id,message:e?.message||String(e)});}}
  return out;
 }
 async sendReminders(articleIds,message,kind='reminder'){
  if(!C.teacher(this.user))throw C.error('permission','교사 권한이 필요합니다.');
  const F=this.F,members=await this.listMembers(),linked=new Map(members.filter(m=>m.active&&['student','editor'].includes(m.role)).map(m=>[m.uid,m]));
  const articles=[];for(const id of [...new Set(articleIds||[])])articles.push(await this.getArticle(id));
  const batch=F.writeBatch(this.db),sent=[],unlinked=[];
  for(const a of articles){
   const names=a.assigneeNames||[],ids=a.assigneeIds||[];
   ids.forEach((uid,i)=>{
    if(linked.has(uid)){
     const ref=F.doc(F.collection(this.db,'notifications'));
     batch.set(ref,{uid,articleId:a.id,title:a.title,body:String(message||'원고 진행 상황을 확인해 주세요.').slice(0,700),kind:['deadline','reminder','review'].includes(kind)?kind:'reminder',createdAt:F.serverTimestamp(),createdBy:this.user.uid,read:false});
     sent.push({uid,articleId:a.id});
    }else unlinked.push({articleId:a.id,name:names[i]||a.byline||'학생'});
   });
  }
  if(sent.length)await batch.commit();
  return {sent,unlinked,articles};
 }
 async listNotifications(){
  if(!this.user?.active)return[];const F=this.F,q=F.query(F.collection(this.db,'notifications'),F.where('uid','==',this.user.uid),F.limit(50)),s=await F.getDocs(q);
  return s.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));
 }
 async markNotificationRead(id){if(!this.user?.active)return;await this.F.updateDoc(this.F.doc(this.db,'notifications',id),{read:true,readAt:this.F.serverTimestamp()});}
 async linkMemberAssignments(uid){
  if(!C.teacher(this.user))throw C.error('permission','교사 권한이 필요합니다.');
  const members=await this.listMembers(),m=members.find(x=>x.uid===uid);if(!m)throw C.error('missing','계정을 찾지 못했습니다.');
  const name=String(m.displayName||'').trim();if(!name)throw C.error('invalid','계정 이름이 없습니다.');
  const articles=await this.listArticles(),matched=articles.filter(a=>['draft','changes'].includes(a.status)&&(a.assigneeNames||[]).some(n=>String(n).trim()===name));
  const updated=[];
  for(const a of matched){
   const ids=[...(a.assigneeIds||[])],names=[...(a.assigneeNames||[])];
   names.forEach((n,i)=>{if(String(n).trim()===name)ids[i]=uid;});
   const pairs=[];for(let i=0;i<Math.max(ids.length,names.length);i++){const key=ids[i]||'';if(!key||pairs.some(p=>p.id===key))continue;pairs.push({id:key,name:names[i]||name});}
   await this.mutate(a.id,a.revision,cur=>({...cur,assigneeIds:pairs.map(p=>p.id),assigneeNames:pairs.map(p=>p.name),revision:cur.revision+1,updatedAt:new Date().toISOString(),updatedBy:this.user.uid,webConsent:false,printConsent:false}));
   updated.push(a.id);
  }
  return updated;
 }
 async listArticles(){if(!this.user?.active)return[];const F=this.F,col=F.collection(this.db,'articles');const q=C.staff(this.user)?F.query(col,F.limit(100)):F.query(col,F.where('assigneeIds','array-contains',this.user.uid),F.limit(100));const s=await F.getDocs(q);return s.docs.map(d=>({...d.data(),id:d.id}));}
 async getArticle(id){const d=await this.F.getDoc(this.F.doc(this.db,'articles',id));if(!d.exists())throw C.error('missing','기사를 찾을 수 없습니다.');return {...d.data(),id:d.id};}
 async createArticle(input){const F=this.F,id=C.uuid(),a=C.newArticle(this.user,{...input,id},new Date().toISOString()),ref=F.doc(this.db,'articles',id);const n={...a,serverWrittenAt:F.serverTimestamp()},b=F.writeBatch(this.db);b.set(ref,n);b.set(F.doc(ref,'revisions','0'),{snapshot:n,actor:this.user.uid,at:F.serverTimestamp()});await b.commit();return a;}
 async mutate(id,expected,fn){const F=this.F,ref=F.doc(this.db,'articles',id);return F.runTransaction(this.db,async tx=>{const doc=await tx.get(ref);if(!doc.exists())throw C.error('missing','원고가 없습니다.');const a={...doc.data(),id};if(a.revision!==expected)throw C.error('conflict','다른 창에서 원고가 바뀌었습니다. 내 글을 보관하고 최신 원고를 다시 열어 주세요.');const next=fn(a),write={...next,serverWrittenAt:F.serverTimestamp()};
  tx.set(ref,write);tx.set(F.doc(ref,'revisions',String(next.revision)),{snapshot:write,actor:this.user.uid,at:F.serverTimestamp()});return next;});}
 saveArticle(id,expected,patch){return this.mutate(id,expected,a=>C.saveDraft(this.user,a,expected,patch,new Date().toISOString()));}
 transition(id,expected,target,options){return this.mutate(id,expected,a=>C.transition(this.user,a,expected,target,options,new Date().toISOString()));}
 async history(id){const F=this.F,s=await F.getDocs(F.query(F.collection(this.db,'articles',id,'revisions'),F.orderBy('at','desc'),F.limit(30)));return s.docs.map(d=>({id:d.id,...d.data()}));}
 async listReviewComments(id){await this.getArticle(id);const F=this.F,s=await F.getDocs(F.query(F.collection(this.db,'articles',id,'reviewComments'),F.orderBy('createdAt','asc'),F.limit(100)));return s.docs.map(d=>({id:d.id,...d.data()}));}
 async addReviewComment(id,text){await this.getArticle(id);if(!C.staff(this.user))throw C.error('permission','편집부만 수정 의견을 남길 수 있습니다.');const value=String(text||'').trim().slice(0,1200);if(!value)throw C.error('invalid','수정 의견을 적어 주세요.');const F=this.F,ref=F.doc(F.collection(this.db,'articles',id,'reviewComments')),row={articleId:id,text:value,author:this.user.displayName||'편집부',authorUid:this.user.uid,createdAt:new Date().toISOString(),resolved:false,resolvedAt:'',resolvedBy:''};await F.setDoc(ref,{...row,serverCreatedAt:F.serverTimestamp()});return {id:ref.id,...row};}
 async resolveReviewComment(id,commentId,resolved=true){const a=await this.getArticle(id);if(!C.staff(this.user)&&!C.canEdit(this.user,a))throw C.error('permission','수정 의견 상태를 바꿀 수 없습니다.');const F=this.F,ref=F.doc(this.db,'articles',id,'reviewComments',commentId),snap=await F.getDoc(ref);if(!snap.exists())throw C.error('missing','수정 의견을 찾을 수 없습니다.');const patch={resolved:!!resolved,resolvedAt:resolved?new Date().toISOString():'',resolvedBy:resolved?this.user.uid:'',serverResolvedAt:F.serverTimestamp()};await F.updateDoc(ref,patch);return {id:commentId,...snap.data(),...patch};}
 subscribe(cb){if(!this.user?.active)return()=>{};const F=this.F,col=F.collection(this.db,'articles'),q=C.staff(this.user)?F.query(col,F.limit(100)):F.query(col,F.where('assigneeIds','array-contains',this.user.uid),F.limit(100));let first=true;return F.onSnapshot(q,()=>{if(first){first=false;return;}cb();},e=>this.onError?.(e));}
 watchEditors(id,cb){
  if(!this.user?.active)return()=>{};
  const F=this.F,own=F.doc(this.db,'articles',id,'presence',this.user.uid),col=F.collection(this.db,'articles',id,'presence');
  const beat=()=>F.setDoc(own,{displayName:(this.user.displayName||'편집자').slice(0,60),updatedAt:F.serverTimestamp()},{merge:true}).catch(e=>this.onError?.(e));
  beat();const timer=setInterval(beat,30000);
  const unsub=F.onSnapshot(col,s=>{
   const now=Date.now(),rows=s.docs.map(d=>({uid:d.id,...d.data()})).filter(x=>x.uid!==this.user.uid&&x.updatedAt?.toMillis&&now-x.updatedAt.toMillis()<90000);
   cb(rows);
  },e=>this.onError?.(e));
  return()=>{clearInterval(timer);unsub();F.deleteDoc(own).catch(()=>{});};
 }
 async objectExists(path){
  const r=this.S.ref(this.storage,path);
  try{await this.S.getMetadata(r);return true;}catch(e){if(e?.code==='storage/object-not-found')return false;throw e;}
 }
 async upload(id,photo,original,web,progress){
  if(!this.storage)throw C.error('storage-disabled','클라우드 사진 저장을 아직 연결하지 않았습니다.');
  const a=await this.getArticle(id);if(!C.canEdit(this.user,a))throw C.error('permission','원고 수정 권한이 필요합니다.');
  let finished=0,total=original.size+web.size;
  for(const [path,blob] of [[photo.originalPath,original],[photo.webPath,web]]){
   const objectRef=this.S.ref(this.storage,path);
   if(await this.objectExists(path)){finished+=blob.size;progress?.(finished/total);continue;}
   const task=this.S.uploadBytesResumable(objectRef,blob,{contentType:blob.type,cacheControl:'private,no-store'});
   await new Promise((resolve,reject)=>task.on('state_changed',snap=>progress?.((finished+snap.bytesTransferred)/total),reject,resolve));
   finished+=blob.size;
  }
  return photo;
 }
 async mediaBlob(path){if(!this.storage)throw C.error('storage-disabled','사진 저장소가 연결되지 않았습니다.');return this.S.getBlob(this.S.ref(this.storage,path),25*1024*1024);}
 async listPublic(){const F=this.F,s=await F.getDocs(F.query(F.collection(this.db,'publications'),F.limit(100))),plan=new Map((W.plan2026?.articles||[]).map(a=>[a.id,a]));return s.docs.map(d=>{let row={...(plan.get(d.id)||{}),...d.data(),id:d.id};if(plan.has(d.id)&&(!row.photos||!row.photos.length)&&W.seedWithSamples)row=W.seedWithSamples([row])[0];return row;});}
 async publish(id,expected){
  const F=this.F,a=await this.getArticle(id);if(a.revision!==expected)throw C.error('conflict','원고가 바뀌었습니다.');const p=C.publication(this.user,a,new Date().toISOString());
  const existing=await F.getDoc(F.doc(this.db,'publications',id));if(existing.exists()&&existing.data().sourceRevision===expected)return existing.data();
  for(let i=0;i<a.photos.length;i++){
   const path=p.photos[i].webPath;
   if(await this.objectExists(path))continue;
   const blob=await this.mediaBlob(a.photos[i].webPath);
   await this.S.uploadBytes(this.S.ref(this.storage,path),blob,{contentType:'image/webp',cacheControl:'no-store'});
  }
  return F.runTransaction(this.db,async tx=>{const current=await tx.get(F.doc(this.db,'articles',id));if(!current.exists()||current.data().revision!==expected||current.data().status!=='approved'||!current.data().webConsent)throw C.error('conflict','발행 중 원고 또는 동의 상태가 바뀌었습니다.');tx.set(F.doc(this.db,'publications',id),{...p,serverWrittenAt:F.serverTimestamp()});return p;});
 }
 async unpublish(id){if(!C.teacher(this.user))throw C.error('permission','교사 권한이 필요합니다.');await this.F.deleteDoc(this.F.doc(this.db,'publications',id));}
 async makeIssue(ids,title){const F=this.F,aa=[];for(const id of ids)aa.push(await this.getArticle(id));const issue=C.printSnapshot(this.user,aa,title,new Date().toISOString());issue.id=C.uuid();const ref=F.doc(this.db,'issues',issue.id);await F.setDoc(ref,{title:issue.title,createdAt:issue.createdAt,order:ids,status:'building'});
  for(let i=0;i<issue.items.length;i+=10){const b=F.writeBatch(this.db);for(const item of issue.items.slice(i,i+10))b.set(F.doc(ref,'items',item.id),item);await b.commit();}
  await F.updateDoc(ref,{status:'ready'});return issue;}
 async listIssues(){if(!C.teacher(this.user))throw C.error('permission','교사 권한이 필요합니다.');const F=this.F,s=await F.getDocs(F.query(F.collection(this.db,'issues'),F.where('status','==','ready'),F.limit(30)));return s.docs.map(d=>({id:d.id,...d.data()}));}
 async getIssue(id){if(!C.teacher(this.user))throw C.error('permission','교사 권한이 필요합니다.');const F=this.F,ref=F.doc(this.db,'issues',id),s=await F.getDoc(ref),docs=await F.getDocs(F.collection(ref,'items')),index=new Map(docs.docs.map(d=>[d.id,d.data()]));if(!s.exists())throw C.error('missing','호가 없습니다.');return {id,...s.data(),items:s.data().order.map(k=>index.get(k)).filter(Boolean)};}
}
W.FirebaseStore=FirebaseStore;
})();
