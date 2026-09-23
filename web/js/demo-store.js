(function(){
'use strict';const W=window.Woonbi,C=W.core;
const PLAN=W.plan2026;
const USERS=PLAN?[{uid:'local-teacher',displayName:'담당교사',role:'teacher',active:true},...PLAN.people.map(p=>({...p,active:true}))]:[];
function seedArticles(){const rows=PLAN?C.clone(PLAN.articles):[];return W.seedWithSamples?W.seedWithSamples(rows):rows;}
const SESSION_KEY='woonbi-newsroom-v04-user';
const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
const done=t=>new Promise((resolve,reject)=>{t.oncomplete=resolve;t.onerror=()=>reject(t.error);t.onabort=()=>reject(t.error||new Error('저장이 중단됐습니다.'));});
class DemoStore{
 constructor(){this.mode='demo';this.persistence='indexeddb';this.db=null;this.user=null;this.listeners=[];this.channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('woonbi-newsroom-v04'):null;
 this.channel?.addEventListener('message',()=>this.notify());}
 async init(){
 const r=indexedDB.open('woonbi-newsroom-v04',1);
 r.onupgradeneeded=()=>{const db=r.result;for(const s of ['articles','history','media','publications','issues','members'])db.createObjectStore(s,{keyPath:'id'});};
 this.db=await request(r);
 const all=await this.rawList('members');
 if(!all.length){const t=this.db.transaction(['members','articles'],'readwrite'),ready=done(t);
 for(const u of USERS)t.objectStore('members').put({...u,id:u.uid});
 for(const a of seedArticles())t.objectStore('articles').put(a);
 await ready;}
 this.user=USERS.find(x=>x.uid===W.session.getItem(SESSION_KEY))||USERS[0];return this;
 }
 async rawList(s){const t=this.db.transaction(s);return request(t.objectStore(s).getAll());}
 async rawGet(s,id){const t=this.db.transaction(s);return request(t.objectStore(s).get(id));}
 async put(s,data){const t=this.db.transaction(s,'readwrite');t.objectStore(s).put(data);await done(t);this.changed();return data;}
 changed(){this.notify();this.channel?.postMessage({changed:true});}
 notify(){for(const cb of this.listeners)cb();}
 subscribe(cb){this.listeners.push(cb);return()=>{this.listeners=this.listeners.filter(x=>x!==cb);};}
 async login(uid){this.user=USERS.find(x=>x.uid===uid)||USERS[0];W.session.setItem(SESSION_KEY,this.user.uid);return this.user;}
 async logout(){this.user=null;W.session.removeItem(SESSION_KEY);}
 async listMembers(){if(!C.teacher(this.user))return this.user?[this.user]:[];return (await this.rawList('members')).map(x=>({...x,uid:x.id}));}
 async setMember(){throw new Error('지금은 원본 명단을 확인하는 로컬 미리보기입니다. 실제 Google 로그인 승인은 서버 연결 후 가능합니다.');}
 async listArticles(){return (await this.rawList('articles')).filter(a=>C.canRead(this.user,a));}
 async getArticle(id){const a=await this.rawGet('articles',id);if(!a||!C.canRead(this.user,a))throw C.error('permission','이 기사에 접근할 수 없습니다.');return a;}
 async createArticle(input){return this.put('articles',C.newArticle(this.user,{...input,id:C.uuid()},new Date().toISOString()));}
 async mutate(id,expected,fn){
 const t=this.db.transaction(['articles','history'],'readwrite'),ready=done(t);let result;
 try{const a=await request(t.objectStore('articles').get(id));if(!a)throw C.error('missing','원고가 없습니다.');result=fn(a);
 t.objectStore('history').put({id:id+':'+result.revision,articleId:id,snapshot:C.clone(result)});t.objectStore('articles').put(result);
 }catch(e){t.abort();await ready.catch(()=>{});throw e;}
 await ready;this.changed();return result;}
 async updateAssignment(id,expected,patch){
 if(!C.teacher(this.user))throw C.error('permission','담당교사만 배정 정보를 바꿀 수 있습니다.');
 const valid=new Set(USERS.filter(u=>u.role!=='teacher').map(u=>u.uid));
 if(!Array.isArray(patch.assigneeIds)||patch.assigneeIds.some(uid=>!valid.has(uid))||patch.assigneeIds.length>8)throw C.error('invalid','담당 학생을 확인해 주세요.');
 if(patch.dueDate&&!/^\d{4}-\d{2}-\d{2}$/.test(patch.dueDate))throw C.error('invalid','마감일을 확인해 주세요.');
 return this.mutate(id,expected,a=>{
  if(a.revision!==expected)throw C.error('conflict','다른 창에서 배정이 바뀌었습니다.');
  const names=patch.assigneeIds.map(uid=>USERS.find(u=>u.uid===uid).displayName);
  return {...a,assigneeIds:[...new Set(patch.assigneeIds)],assigneeNames:names,byline:a.byline||names.join(' · '),dueDate:patch.dueDate||'',assignmentStatus:names.length?'assigned':'needs-confirmation',revision:a.revision+1,updatedAt:new Date().toISOString(),updatedBy:this.user.uid};
 });
 }
 saveArticle(id,expected,patch){return this.mutate(id,expected,a=>C.saveDraft(this.user,a,expected,patch,new Date().toISOString()));}
 transition(id,expected,target,options){return this.mutate(id,expected,a=>C.transition(this.user,a,expected,target,options,new Date().toISOString()));}
 async history(id){await this.getArticle(id);return (await this.rawList('history')).filter(h=>h.articleId===id).sort((a,b)=>b.snapshot.revision-a.snapshot.revision);}
 async upload(id,photo,original,web,progress){const a=await this.getArticle(id);if(!C.canEdit(this.user,a))throw C.error('permission','원고를 수정할 수 없습니다.');
 const t=this.db.transaction('media','readwrite');t.objectStore('media').put({id:photo.originalPath,blob:original});t.objectStore('media').put({id:photo.webPath,blob:web});await done(t);progress?.(1);return photo;}
 async mediaBlob(path){if(path.startsWith('seed/')){
 const id=path.split('/')[1],a=await this.getArticle(id),p=a.photos.find(x=>x.webPath===path||x.originalPath===path);
 const permitted=Object.values(W.sampleMedia||{}).some(m=>m.path===p?.sourceAsset);
 if(!p||!permitted)throw C.error('permission','허용된 교체용 사진이 아닙니다.');
 const url=W.embeddedAssets?.[p.sourceAsset]||p.sourceAsset,r=await fetch(url);if(!r.ok)throw new Error('교체용 사진을 읽지 못했습니다.');return r.blob();
 }if(path.startsWith('public/')){const id=path.split('/')[1],p=await this.rawGet('publications',id);if(!p||!p.photos.some(x=>x.webPath===path))throw C.error('permission','공개가 해제된 사진입니다.');}
 else {const id=path.split('/')[1];await this.getArticle(id);}
 const m=await this.rawGet('media',path);if(!m)throw new Error('사진 파일이 없습니다.');return m.blob;}
 async listPublic(){return this.rawList('publications');}
 async publish(id,expected){const a=await this.getArticle(id);if(a.revision!==expected)throw C.error('conflict','원고가 바뀌었습니다.');const p=C.publication(this.user,a,new Date().toISOString());
 const blobs=[];for(let i=0;i<a.photos.length;i++)blobs.push({id:p.photos[i].webPath,blob:await this.mediaBlob(a.photos[i].webPath)});
 const t=this.db.transaction(['articles','publications','media'],'readwrite'),ready=done(t);try{const current=await request(t.objectStore('articles').get(id));if(current.revision!==expected)throw C.error('conflict','발행 중 원고가 바뀌었습니다.');t.objectStore('publications').put(p);for(const m of blobs)t.objectStore('media').put(m);}catch(e){t.abort();await ready.catch(()=>{});throw e;}await ready;this.changed();return p;}
 async unpublish(id){if(!C.teacher(this.user))throw C.error('permission','교사 권한이 필요합니다.');const t=this.db.transaction('publications','readwrite');t.objectStore('publications').delete(id);await done(t);this.changed();}
 async makeIssue(ids,title){const articles=[];for(const id of ids)articles.push(await this.getArticle(id));const issue=C.printSnapshot(this.user,articles,title,new Date().toISOString());issue.id=C.uuid();return this.put('issues',issue);}
 async listIssues(){if(!C.teacher(this.user))throw C.error('permission','교사 권한이 필요합니다.');return this.rawList('issues');}
 async getIssue(id){if(!C.teacher(this.user))throw C.error('permission','교사 권한이 필요합니다.');return this.rawGet('issues',id);}
}
class MemoryStore extends DemoStore {
 constructor(){super();this.persistence='memory';this.tables=W.memoryTables||(W.memoryTables=Object.fromEntries(['articles','history','media','publications','issues','members'].map(n=>[n,new Map()])));}
 async init(){
 if(!this.tables.members.size){for(const u of USERS)this.tables.members.set(u.uid,{...u,id:u.uid});for(const a of seedArticles())this.tables.articles.set(a.id,a);}
 this.user=USERS.find(x=>x.uid===W.session.getItem(SESSION_KEY))||USERS[0];return this;
 }
 async rawList(s){return C.clone([...this.tables[s].values()]);}
 async rawGet(s,id){const item=this.tables[s].get(id);return item?C.clone(item):undefined;}
 async put(s,data){this.tables[s].set(data.id,C.clone(data));this.changed();return data;}
 async mutate(id,expected,fn){const a=this.tables.articles.get(id);if(!a)throw C.error('missing','원고가 없습니다.');const next=fn(C.clone(a));this.tables.articles.set(id,C.clone(next));this.tables.history.set(id+':'+next.revision,{id:id+':'+next.revision,articleId:id,snapshot:C.clone(next)});this.changed();return next;}
 async upload(id,p,original,web,progress){const a=await this.getArticle(id);if(!C.canEdit(this.user,a))throw C.error('permission','수정 권한이 필요합니다.');this.tables.media.set(p.originalPath,{id:p.originalPath,blob:original});this.tables.media.set(p.webPath,{id:p.webPath,blob:web});progress?.(1);return p;}
 async publish(id,expected){const a=await this.getArticle(id);if(a.revision!==expected)throw C.error('conflict','원고가 바뀌었습니다.');const p=C.publication(this.user,a,new Date().toISOString());const blobs=[];for(let i=0;i<a.photos.length;i++)blobs.push({id:p.photos[i].webPath,blob:await this.mediaBlob(a.photos[i].webPath)});if(this.tables.articles.get(id).revision!==expected)throw C.error('conflict','발행 중 원고가 바뀌었습니다.');for(const b of blobs)this.tables.media.set(b.id,b);this.tables.publications.set(id,p);this.changed();return p;}
 async unpublish(id){if(!C.teacher(this.user))throw C.error('permission','교사 권한이 필요합니다.');this.tables.publications.delete(id);this.changed();}
}
W.DEMO_USERS=USERS;W.DemoStore=DemoStore;W.MemoryStore=MemoryStore;
})();
