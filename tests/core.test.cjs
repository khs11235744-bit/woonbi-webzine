const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../web/js/core.js');
const teacher={uid:'t',role:'teacher',active:true},editor={uid:'e',role:'editor',active:true},a={uid:'a',role:'student',active:true},b={uid:'b',role:'student',active:true},pending={uid:'p',role:'pending',active:false},time='2026-09-23T00:00:00Z';
function draft(){return C.newArticle(teacher,{id:'test',title:'테스트 원고',category:'학생 글',assigneeIds:['a'],dueDate:'2026-10-10'},time);}
function filled(){return {...draft(),byline:'학생 A',body:'실제 학교의 기사가 아닌 테스트용 원고입니다. 작성한 학생의 글이 다른 학생의 글과 섞이지 않고 저장되는지 확인하며, 제출 후에는 내용을 바꿀 수 없어야 합니다.'};}
function submitted(){return C.transition(a,filled(),0,'submitted',{},time);}
function approved(){return C.transition(teacher,submitted(),1,'approved',{webConsent:true,printConsent:true},time);}
function photo(id){return {id,webPath:`private/test/${id}/web.webp`,originalPath:`private/test/${id}/original`,caption:'사진',alt:'테스트 사진',after:-1,width:800,height:600,originalBytes:100};}
for(const [name,u,result] of [['assigned',a,true],['other',b,false],['editor',editor,true],['teacher',teacher,true],['pending',pending,false],['anonymous',null,false]])test(`read ${name}`,()=>assert.equal(C.canRead(u,draft()),result));
test('only teacher assigns',()=>assert.throws(()=>C.newArticle(a,{id:'x'},time),/배정/));
test('draft has no publication flags',()=>{const d=draft();assert.equal(d.webConsent,false);assert.equal(d.printConsent,false);});
test('empty assignees rejected',()=>assert.throws(()=>C.newArticle(teacher,{id:'x',title:'x',category:'학생 글',assigneeIds:[],dueDate:'2026-10-10'},time)));
test('unknown category rejected',()=>assert.throws(()=>C.newArticle(teacher,{id:'x',title:'x',category:'unknown',assigneeIds:['a'],dueDate:'2026-10-10'},time)));
test('save increments revision',()=>assert.equal(C.saveDraft(a,draft(),0,{body:'hello'},time).revision,1));
test('other reporter save denied',()=>assert.throws(()=>C.saveDraft(b,draft(),0,{body:'hacked'},time),/권한/));
test('stale save conflicts',()=>assert.throws(()=>C.saveDraft(a,{...draft(),revision:2},1,{body:'stale'},time),/다른 창/));
test('protected fields ignored',()=>{const n=C.saveDraft(a,draft(),0,{status:'approved',assigneeIds:['b'],webConsent:true,role:'teacher',revision:55},time);assert.equal(n.status,'draft');assert.deepEqual(n.assigneeIds,['a']);assert.equal(n.webConsent,false);assert.equal(n.revision,1);});
test('saved data cloned',()=>{const d=draft(),n=C.saveDraft(a,d,0,{photos:[photo('1')]},time);n.photos[0].caption='other';assert.equal(d.photos.length,0);});
test('long title rejected',()=>assert.throws(()=>C.saveDraft(a,draft(),0,{title:'a'.repeat(151)},time)));
test('long body rejected',()=>assert.throws(()=>C.saveDraft(a,draft(),0,{body:'a'.repeat(45001)},time)));
test('duplicate photo rejected',()=>assert.throws(()=>C.saveDraft(a,draft(),0,{photos:[photo('1'),photo('1')]},time)));
test('more than 12 photos rejected',()=>assert.throws(()=>C.saveDraft(a,draft(),0,{photos:Array.from({length:13},(_,i)=>photo(String(i)))},time)));
test('bad photo position rejected',()=>assert.throws(()=>C.saveDraft(a,draft(),0,{photos:[{...photo('1'),after:-2}]},time)));
test('blank content not submitted',()=>assert.throws(()=>C.transition(a,draft(),0,'submitted',{},time),/제출 전/));
test('required photos checked',()=>assert.throws(()=>C.transition(a,{...filled(),minPhotos:1},0,'submitted',{},time),/사진/));
test('alt text required',()=>assert.throws(()=>C.transition(a,{...filled(),photos:[{...photo('1'),alt:''}]},0,'submitted',{},time),/설명/));
test('submission allowed',()=>assert.equal(submitted().status,'submitted'));
test('submitted freezes draft',()=>assert.throws(()=>C.saveDraft(a,submitted(),1,{body:'edit'},time)));
test('student cannot approve',()=>assert.throws(()=>C.transition(a,submitted(),1,'approved',{},time)));
test('editor cannot approve',()=>assert.throws(()=>C.transition(editor,submitted(),1,'approved',{},time)));
test('editor can request changes',()=>assert.equal(C.transition(editor,submitted(),1,'changes',{feedback:'사진 설명 보완'},time).status,'changes'));
test('change request requires feedback',()=>assert.throws(()=>C.transition(teacher,submitted(),1,'changes',{},time)));
test('approval does not imply consent',()=>{const x=C.transition(teacher,submitted(),1,'approved',{},time);assert.equal(x.webConsent,false);assert.equal(x.printConsent,false);});
test('web and print consents separate',()=>{const x=C.transition(teacher,submitted(),1,'approved',{printConsent:true},time);assert.equal(x.webConsent,false);assert.equal(x.printConsent,true);});
test('revision mismatch during review denied',()=>assert.throws(()=>C.transition(teacher,submitted(),0,'approved',{},time)));
test('reopen clears consent',()=>{const x=C.transition(teacher,approved(),2,'changes',{feedback:'정정'},time);assert.equal(x.webConsent,false);assert.equal(x.printConsent,false);});
test('public projection strips private data',()=>{const x={...approved(),secret:'hidden',assigneeEmails:['secret@example.com'],photos:[photo('1')]};const p=C.publication(teacher,x,time);assert.equal(p.secret,undefined);assert.equal(p.assigneeIds,undefined);assert.equal(p.feedback,undefined);assert.equal(p.photos[0].originalPath,undefined);assert.equal(p.photos[0].webPath,'public/test/2/1.webp');});
test('students cannot publish',()=>assert.throws(()=>C.publication(a,approved(),time)));
test('unapproved cannot publish',()=>assert.throws(()=>C.publication(teacher,filled(),time)));
test('unconsented cannot publish',()=>assert.throws(()=>C.publication(teacher,{...approved(),webConsent:false},time)));
test('public copy frozen',()=>{const a=approved(),p=C.publication(teacher,a,time);a.body='new';assert.notEqual(p.body,a.body);});
test('teacher book only',()=>assert.throws(()=>C.printSnapshot(a,[approved()],'책',time)));
test('book empty rejected',()=>assert.throws(()=>C.printSnapshot(teacher,[],'책',time)));
test('book only consented',()=>assert.throws(()=>C.printSnapshot(teacher,[{...approved(),printConsent:false}],'책',time)));
test('book frozen independent of edits',()=>{const a=approved(),x=C.printSnapshot(teacher,[a],'책',time);a.body='new';assert.notEqual(x.items[0].body,a.body);assert.equal(x.items[0].sourceRevision,2);});
test('markup only explicit headings',()=>{const b=C.blocks('보는 자리\n\n## 소제목\n\n왜 그럴까?');assert.equal(b[0].kind,'paragraph');assert.equal(b[1].kind,'heading');assert.equal(b[2].kind,'paragraph');});
test('normalize CRLF',()=>assert.equal(C.blocks('a\r\n\r\nb').length,2));
test('photo positions distributed',()=>{const a={...filled(),body:Array.from({length:20},(_,i)=>'문단'+i).join('\n\n'),photos:[photo('a'),photo('b'),photo('c'),photo('d')]};const positions=[...C.photoPositions(a).keys()];assert.equal(positions[0],-1);assert.equal(new Set(positions).size,4);assert.ok(positions[3]<19);});
test('reject INDI project',()=>assert.throws(()=>C.projectGuard({mode:'firebase',firebase:{projectId:'indieplus-pohang-khs'}})));
test('reject unnamed live project',()=>assert.throws(()=>C.projectGuard({mode:'firebase',firebase:{projectId:'foo'}})));
test('missing Firebase config rejected',()=>assert.throws(()=>C.projectGuard({mode:'firebase',firebase:{projectId:'woonbi-pilot'}})));
test('separate configured project allowed',()=>assert.doesNotThrow(()=>C.projectGuard({mode:'firebase',firebase:{projectId:'woonbi-pilot',apiKey:'config',authDomain:'domain',appId:'app'}})));
