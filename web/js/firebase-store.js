/* Live adapter. Not enabled by the demo; live OAuth/rules/storage must be verified before a school pilot. */
(function(){
'use strict';const W=window.Woonbi,C=W.core,SDK='https://www.gstatic.com/firebasejs/12.17.1/';
class FirebaseStore{
 constructor(config){C.projectGuard(config);this.config=config;this.mode='firebase';this.user=null;this.unsub=null;}
 async init(){
  [this.appSdk,this.A,this.F,this.S]=await Promise.all(['firebase-app.js','firebase-auth.js','firebase-firestore.js','firebase-storage.js'].map(f=>import(SDK+f)));
  const app=this.appSdk.initializeApp(this.config.firebase,'woonbi-webzine');this.auth=this.A.getAuth(app);this.auth.languageCode='ko';
  this.db=this.F.initializeFirestore(app,{localCache:this.F.memoryLocalCache()});
  if(this.config.enableStorage)this.storage=this.S.getStorage(app);
  await this.A.setPersistence(this.auth,this.A.browserSessionPersistence);
  await this.A.getRedirectResult(this.auth);
  await new Promise((resolve,reject)=>{let settled=false;this.unsub=this.A.onAuthStateChanged(this.auth,async u=>{
   try{this.user=null;if(u){if(!u.emailVerified)throw C.error('auth','Google 이메일 확인이 필요합니다.');const ref=this.F.doc(this.db,'members',u.uid);let m=await this.F.getDoc(ref);
    if(!m.exists()){await this.F.setDoc(ref,{displayName:(u.displayName||'신청자').slice(0,60),role:'pending',active:false,createdAt:this.F.serverTimestamp()});m=await this.F.getDoc(ref);}
    this.user={uid:u.uid,...m.data()};}
    if(!settled){settled=true;resolve();}else this.onAuthChange?.();
   }catch(e){if(!settled){settled=true;reject(e);}else this.onError?.(e);}
  },reject);});return this;
 }
 async login(){await this.A.signInWithPopup(this.auth,new this.A.GoogleAuthProvider());}
 async loginRedirect(){return this.A.signInWithRedirect(this.auth,new this.A.GoogleAuthProvider());}
 async logout(){await this.A.signOut(this.auth);this.user=null;}
 async listMembers(){const F=this.F;if(!C.teacher(this.user))return this.user?[this.user]:[];const s=await F.getDocs(F.query(F.collection(this.db,'members'),F.limit(250)));return s.docs.map(d=>({uid:d.id,...d.data()}));}
 async setMember(uid,role,active){if(!C.teacher(this.user)||!['student','editor','pending'].includes(role))throw C.error('permission','계정 권한을 확인해 주세요.');await this.F.updateDoc(this.F.doc(this.db,'members',uid),{role,active});}
 async listArticles(){if(!this.user?.active)return[];const F=this.F,col=F.collection(this.db,'articles');const q=C.staff(this.user)?F.query(col,F.limit(100)):F.query(col,F.where('assigneeIds','array-contains',this.user.uid),F.limit(100));const s=await F.getDocs(q);return s.docs.map(d=>({...d.data(),id:d.id}));}
 async getArticle(id){const d=await this.F.getDoc(this.F.doc(this.db,'articles',id));if(!d.exists())throw C.error('missing','기사를 찾을 수 없습니다.');return {...d.data(),id:d.id};}
 async createArticle(input){const F=this.F,id=C.uuid(),a=C.newArticle(this.user,{...input,id},new Date().toISOString()),ref=F.doc(this.db,'articles',id);const n={...a,serverWrittenAt:F.serverTimestamp()},b=F.writeBatch(this.db);b.set(ref,n);b.set(F.doc(ref,'revisions','0'),{snapshot:n,actor:this.user.uid,at:F.serverTimestamp()});await b.commit();return a;}
 async mutate(id,expected,fn){const F=this.F,ref=F.doc(this.db,'articles',id);return F.runTransaction(this.db,async tx=>{const doc=await tx.get(ref);if(!doc.exists())throw C.error('missing','원고가 없습니다.');const a={...doc.data(),id};if(a.revision!==expected)throw C.error('conflict','다른 창에서 원고가 바뀌었습니다. 내 글을 보관하고 최신 원고를 다시 열어 주세요.');const next=fn(a),write={...next,serverWrittenAt:F.serverTimestamp()};
  tx.set(ref,write);tx.set(F.doc(ref,'revisions',String(next.revision)),{snapshot:write,actor:this.user.uid,at:F.serverTimestamp()});return next;});}
 saveArticle(id,expected,patch){return this.mutate(id,expected,a=>C.saveDraft(this.user,a,expected,patch,new Date().toISOString()));}
 transition(id,expected,target,options){return this.mutate(id,expected,a=>C.transition(this.user,a,expected,target,options,new Date().toISOString()));}
 async history(id){const F=this.F,s=await F.getDocs(F.query(F.collection(this.db,'articles',id,'revisions'),F.orderBy('at','desc'),F.limit(30)));return s.docs.map(d=>({id:d.id,...d.data()}));}
 subscribe(cb){if(!this.user?.active)return()=>{};const F=this.F,col=F.collection(this.db,'articles'),q=C.staff(this.user)?F.query(col,F.limit(100)):F.query(col,F.where('assigneeIds','array-contains',this.user.uid),F.limit(100));let first=true;return F.onSnapshot(q,()=>{if(first){first=false;return;}cb();},e=>this.onError?.(e));}
 async upload(id,photo,original,web,progress){
  if(!this.storage)throw C.error('storage-disabled','클라우드 사진 저장을 아직 연결하지 않았습니다. Blaze 결제 확인 후 별도로 설정해야 합니다.');
  const a=await this.getArticle(id);if(!C.canEdit(this.user,a))throw C.error('permission','원고 수정 권한이 필요합니다.');
  let finished=0,total=original.size+web.size;
  for(const [path,blob] of [[photo.originalPath,original],[photo.webPath,web]]){const task=this.S.uploadBytesResumable(this.S.ref(this.storage,path),blob,{contentType:blob.type,cacheControl:'private,no-store'});
   await new Promise((resolve,reject)=>task.on('state_changed',s=>progress?.((finished+s.bytesTransferred)/total),reject,resolve));finished+=blob.size;}
  return photo;
 }
 async mediaBlob(path){if(!this.storage)throw C.error('storage-disabled','사진 저장소가 연결되지 않았습니다.');return this.S.getBlob(this.S.ref(this.storage,path),25*1024*1024);}
 async listPublic(){const F=this.F,s=await F.getDocs(F.query(F.collection(this.db,'publications'),F.limit(100)));return s.docs.map(d=>({...d.data(),id:d.id}));}
 async publish(id,expected){
  const F=this.F,a=await this.getArticle(id);if(a.revision!==expected)throw C.error('conflict','원고가 바뀌었습니다.');const p=C.publication(this.user,a,new Date().toISOString());
  const existing=await F.getDoc(F.doc(this.db,'publications',id));if(existing.exists()&&existing.data().sourceRevision===expected)return existing.data();
  for(let i=0;i<a.photos.length;i++){const blob=await this.mediaBlob(a.photos[i].webPath);await this.S.uploadBytes(this.S.ref(this.storage,p.photos[i].webPath),blob,{contentType:'image/webp',cacheControl:'no-store'});}
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
