import test, {before, after, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, writeBatch, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import {
  ref, uploadBytes, getBytes, deleteObject,
} from 'firebase/storage';

const projectId='woonbi-rules-test';
let env;

function auth(uid,role='student'){
  return env.authenticatedContext(uid,{
    email_verified:true,
    email:uid+'@example.test',
    role,
  });
}
function article(id,assignees=['student-a'],overrides={}){
  const now='2026-09-23T00:00:00Z';
  return {
    id,title:'테스트 기사',sourceTitle:'테스트 기사',deck:'테스트 부제',
    body:'테스트 본문입니다. 보안 규칙을 검증하기 위해 충분한 길이의 문장을 작성합니다. 학생과 교사의 권한을 구분합니다.',
    byline:'학생 A',category:'학교 이야기',categorySource:'규칙 테스트',
    planKind:'school',planOrder:1,sourceRange:'규칙 테스트',
    assigneeIds:assignees,assigneeNames:['학생 A'],dueDate:'',minPhotos:0,photos:[],
    status:'draft',feedback:'',revision:0,updatedBy:'teacher',
    createdAt:now,updatedAt:now,webConsent:false,printConsent:false,
    serverWrittenAt:Timestamp.now(),contentOrigin:'rules-test',reportingQuestions:[],notes:[],
    ...overrides,
  };
}
async function seed(){
  await env.withSecurityRulesDisabled(async ctx=>{
    const db=ctx.firestore();
    for(const [uid,role,active] of [
      ['teacher','teacher',true],
      ['editor','editor',true],
      ['student-a','student',true],
      ['student-b','student',true],
      ['pending','pending',false],
    ]){
      await setDoc(doc(db,'members',uid),{displayName:uid,role,active,createdAt:Timestamp.now()});
    }
    await setDoc(doc(db,'articles','article-a'),article('article-a'));
    await setDoc(doc(db,'articles','article-submitted'),article('article-submitted',['student-a'],{
      status:'submitted',revision:2,updatedBy:'student-a'
    }));
    await setDoc(doc(db,'articles','article-approved'),article('article-approved',['student-a'],{
      status:'approved',revision:3,updatedBy:'teacher',webConsent:true,printConsent:true
    }));
  });
}
async function saveWithRevision(db,id,uid,mutate){
  const refArticle=doc(db,'articles',id);
  const snap=await getDoc(refArticle);
  const current=snap.data();
  const stamp=serverTimestamp();
  const next={
    ...current,
    ...mutate(current),
    revision:current.revision+1,
    updatedAt:'2026-09-23T01:00:00Z',
    updatedBy:uid,
    serverWrittenAt:stamp,
  };
  const batch=writeBatch(db);
  batch.set(refArticle,next);
  batch.set(doc(db,'articles',id,'revisions',String(next.revision)),{
    snapshot:next,actor:uid,at:stamp,
  });
  return batch.commit();
}

before(async()=>{
  env=await initializeTestEnvironment({
    projectId,
    firestore:{rules:fs.readFileSync('firebase/firestore.rules','utf8')},
    storage:{rules:fs.readFileSync('firebase/storage.rules','utf8')},
  });
});
beforeEach(async()=>{
  await env.clearFirestore();
  if(typeof env.clearStorage==='function')await env.clearStorage();
  await seed();
});
after(async()=>{await env.cleanup();});

test('assigned student can read and save own draft with revision history',async()=>{
  const db=auth('student-a').firestore();
  await assertSucceeds(getDoc(doc(db,'articles','article-a')));
  await assertSucceeds(saveWithRevision(db,'article-a','student-a',()=>({title:'학생 수정 제목'})));
});


test('draft can attach uploaded photo metadata with revision history',async()=>{
  const db=auth('teacher','teacher').firestore();
  const photo={
    id:'photo-e2e',caption:'',alt:'e2e-photo',after:-1,width:1200,height:800,
    originalBytes:36374,originalType:'image/jpeg',
    originalPath:'private/article-a/photo-e2e/original',webPath:'private/article-a/photo-e2e/web.webp',
  };
  await assertSucceeds(saveWithRevision(db,'article-a','teacher',()=>({photos:[photo]})));
  const saved=(await getDoc(doc(db,'articles','article-a'))).data();
  assert.equal(saved.photos.length,1);
  assert.equal(saved.photos[0].id,'photo-e2e');
});
test('other student and pending account cannot read assigned draft',async()=>{
  await assertFails(getDoc(doc(auth('student-b').firestore(),'articles','article-a')));
  await assertFails(getDoc(doc(auth('pending').firestore(),'articles','article-a')));
});

test('editor can read all and request changes, but cannot approve',async()=>{
  const db=auth('editor','editor').firestore();
  await assertSucceeds(getDoc(doc(db,'articles','article-a')));
  await assertSucceeds(saveWithRevision(db,'article-submitted','editor',()=>({
    status:'changes',feedback:'출처를 한 번 더 확인해 주세요.',webConsent:false,printConsent:false,
  })));
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'articles','article-submitted-2'),article('article-submitted-2',['student-a'],{
      status:'submitted',revision:1,updatedBy:'student-a'
    }));
  });
  await assertFails(saveWithRevision(db,'article-submitted-2','editor',()=>({
    status:'approved',webConsent:true,printConsent:true
  })));
});

test('teacher can approve and publish approved consented article',async()=>{
  const db=auth('teacher','teacher').firestore();
  await assertSucceeds(saveWithRevision(db,'article-submitted','teacher',()=>({
    status:'approved',webConsent:true,printConsent:true
  })));
  const approved=(await getDoc(doc(db,'articles','article-approved'))).data();
  const stamp=serverTimestamp();
  const publication={
    id:'article-approved',title:approved.title,deck:approved.deck,body:approved.body,
    byline:approved.byline,category:approved.category,sourceRevision:approved.revision,
    publishedAt:'2026-09-23T02:00:00Z',photos:[],serverWrittenAt:stamp,
  };
  await assertSucceeds(setDoc(doc(db,'publications','article-approved'),publication));
});

test('student cannot publish',async()=>{
  const db=auth('student-a').firestore();
  const publication={
    id:'article-approved',title:'테스트 기사',deck:'테스트 부제',
    body:'테스트 본문입니다. 보안 규칙을 검증하기 위해 충분한 길이의 문장을 작성합니다. 학생과 교사의 권한을 구분합니다.',
    byline:'학생 A',category:'학교 이야기',sourceRevision:3,
    publishedAt:'2026-09-23T02:00:00Z',photos:[],serverWrittenAt:serverTimestamp(),
  };
  await assertFails(setDoc(doc(db,'publications','article-approved'),publication));
});



test('teacher can update only due date with revision history',async()=>{
  const teacher=auth('teacher','teacher').firestore();
  await assertSucceeds(saveWithRevision(teacher,'article-a','teacher',()=>({dueDate:'2026-10-05'})));
  const a=(await getDoc(doc(teacher,'articles','article-a'))).data();
  assert.equal(a.dueDate,'2026-10-05');
});

test('first Google login can self-register only as pending inactive member',async()=>{
  const newcomer=auth('new-student').firestore();
  await assertSucceeds(setDoc(doc(newcomer,'members','new-student'),{displayName:'신규 학생',role:'pending',active:false,createdAt:serverTimestamp()}));
  await assertFails(setDoc(doc(newcomer,'members','forged'),{displayName:'위조',role:'student',active:true,createdAt:serverTimestamp()}));
});
test('full editorial flow: student submit -> editor changes -> student resubmit -> teacher approve',async()=>{
  const student=auth('student-a').firestore();
  const editor=auth('editor','editor').firestore();
  const teacher=auth('teacher','teacher').firestore();
  await assertSucceeds(saveWithRevision(student,'article-a','student-a',()=>({status:'submitted'})));
  let a=(await getDoc(doc(editor,'articles','article-a'))).data();
  assert.equal(a.status,'submitted');
  await assertSucceeds(saveWithRevision(editor,'article-a','editor',()=>({status:'changes',feedback:'사진 설명을 보강하세요.',webConsent:false,printConsent:false})));
  a=(await getDoc(doc(student,'articles','article-a'))).data();
  assert.equal(a.status,'changes');
  await assertSucceeds(saveWithRevision(student,'article-a','student-a',()=>({status:'submitted',webConsent:false,printConsent:false})));
  a=(await getDoc(doc(teacher,'articles','article-a'))).data();
  assert.equal(a.status,'submitted');
  await assertSucceeds(saveWithRevision(teacher,'article-a','teacher',()=>({status:'approved',webConsent:true,printConsent:true})));
  a=(await getDoc(doc(teacher,'articles','article-a'))).data();
  assert.equal(a.status,'approved');
  assert.equal(a.webConsent,true);
});

test('teacher reminder is readable only by recipient and recipient can mark read',async()=>{
  const teacher=auth('teacher','teacher').firestore();
  const studentA=auth('student-a').firestore();
  const studentB=auth('student-b').firestore();
  const refNotice=doc(teacher,'notifications','notice-a');
  await assertSucceeds(setDoc(refNotice,{
    uid:'student-a',articleId:'article-a',title:'테스트 기사',body:'마감일을 확인해 주세요.',kind:'deadline',createdAt:serverTimestamp(),createdBy:'teacher',read:false,
  }));
  await assertSucceeds(getDoc(doc(studentA,'notifications','notice-a')));
  await assertFails(getDoc(doc(studentB,'notifications','notice-a')));
  await assertSucceeds(updateDoc(doc(studentA,'notifications','notice-a'),{read:true,readAt:serverTimestamp()}));
});
test('teacher can create article only with matching revision zero in same batch',async()=>{
  const db=auth('teacher','teacher').firestore();
  const stamp=serverTimestamp();
  const a=article('new-article',['student-a'],{
    updatedBy:'teacher',createdAt:'2026-09-23T03:00:00Z',updatedAt:'2026-09-23T03:00:00Z',serverWrittenAt:stamp
  });
  const b=writeBatch(db);
  b.set(doc(db,'articles','new-article'),a);
  b.set(doc(db,'articles','new-article','revisions','0'),{snapshot:a,actor:'teacher',at:stamp});
  await assertSucceeds(b.commit());
});

test('private storage: assigned student create/read succeeds, other student overwrite/delete denied',async()=>{
  const storageA=auth('student-a').storage();
  const storageB=auth('student-b').storage();
  const p='private/article-a/photo-one/original';
  const body=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
  await assertSucceeds(uploadBytes(ref(storageA,p),body,{contentType:'image/png'}));
  await assertSucceeds(getBytes(ref(storageA,p),1024));
  await assertFails(getBytes(ref(storageB,p),1024));
  await assertFails(uploadBytes(ref(storageA,p),body,{contentType:'image/png'}));
  await assertFails(deleteObject(ref(storageA,p)));
});

test('private storage: unassigned student denied, editor allowed',async()=>{
  const body=new Uint8Array([255,216,255,224,0,1,2,3]);
  await assertFails(uploadBytes(ref(auth('student-b').storage(),'private/article-a/photo-two/original'),body,{contentType:'image/jpeg'}));
  await assertSucceeds(uploadBytes(ref(auth('editor','editor').storage(),'private/article-a/photo-three/original'),body,{contentType:'image/jpeg'}));
});

test('public storage is teacher-write and becomes anonymous-readable only after publication',async()=>{
  const teacherStorage=auth('teacher','teacher').storage();
  const anonStorage=env.unauthenticatedContext().storage();
  const p='public/article-approved/3/photo.webp';
  const body=new Uint8Array([82,73,70,70,1,2,3,4,87,69,66,80]);
  await assertSucceeds(uploadBytes(ref(teacherStorage,p),body,{contentType:'image/webp'}));
  await assertFails(getBytes(ref(anonStorage,p),1024));
  await env.withSecurityRulesDisabled(async ctx=>{
    await setDoc(doc(ctx.firestore(),'publications','article-approved'),{
      id:'article-approved',sourceRevision:3,title:'테스트 기사'
    });
  });
  await assertSucceeds(getBytes(ref(anonStorage,p),1024));
  await assertFails(deleteObject(ref(teacherStorage,p)));
});
