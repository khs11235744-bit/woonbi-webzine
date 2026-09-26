const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const ctx={window:{WoonbiMagazine:{
 preflight:a=>a._warnings||[],
 printPackage:rows=>({ready:rows.length>0&&rows.every(a=>(a._warnings||[]).length===0),warningCount:rows.reduce((n,a)=>n+(a._warnings||[]).length,0)})
}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('web/js/workflow-engine.js','utf8'),ctx);
const W=ctx.window.WoonbiWorkflow;

const article=(o={})=>({
 id:'a',title:'기사',body:'충분한 본문 '.repeat(20),photos:[{alt:'설명'}],minPhotos:1,status:'draft',
 assigneeIds:['u1'],assigneeNames:['학생'],webConsent:true,printConsent:true,...o
});

test('workflow prioritizes overdue and requested changes before ordinary drafting',()=>{
 const overdue=W.articleAction(article({dueDate:'2026-01-01'}),{today:'2026-09-26'});
 const changes=W.articleAction(article({status:'changes'}),{today:'2026-09-26'});
 const draft=W.articleAction(article(),{today:'2026-09-26'});
 assert.equal(overdue.key,'overdue');
 assert.ok(overdue.priority>changes.priority);
 assert.ok(changes.priority>draft.priority);
});

test('workflow converts state into plain next actions',()=>{
 assert.equal(W.articleAction(article({body:''})).action,'본문 이어 쓰기');
 assert.equal(W.articleAction(article({photos:[]})).action,'실제 사진 추가·교체');
 assert.equal(W.articleAction(article({photos:[{alt:''}]})).action,'대체설명 채우기');
 assert.equal(W.articleAction(article()).action,'원고 제출');
 assert.equal(W.articleAction(article({status:'submitted'})).action,'교사 검토 기다리기');
});

test('forUser prefers assigned articles when assignments exist',()=>{
 const rows=[article({id:'mine'}),article({id:'other',assigneeIds:['u2'],assigneeNames:['다른 학생']})];
 const out=W.forUser(rows,{uid:'u1',displayName:'학생'});
 assert.equal(out.length,1);
 assert.equal(out[0].id,'mine');
});

test('issue production always exposes five stages',()=>{
 const rows=[
  article({id:'ok',status:'approved',_warnings:[]}),
  article({id:'bad',status:'draft',body:'',photos:[],_warnings:['사진 필요']})
 ];
 const stages=W.issueStages(rows,new Set());
 assert.equal(stages.length,5);
 assert.equal(stages.map(x=>x.label).join('>'),'원고>사진>검토>조판>인쇄 PASS');
 assert.equal(stages[0].complete,1);
 assert.equal(stages[2].complete,1);
});

test('blocker list sorts highest priority first',()=>{
 const rows=[
  article({id:'body',body:''}),
  article({id:'late',dueDate:'2026-01-01'}),
  article({id:'change',status:'changes'})
 ];
 const out=W.blockers(rows,new Set(),3);
 assert.equal(out[0].article.id,'late');
 assert.equal(out[1].article.id,'change');
});

test('glossary explains student-facing print terms',()=>{
 for(const key of ['preflight','spread','bleed','trim','dpi','runningHead','folio','colophon']){
  assert.ok(String(W.GLOSSARY[key]||'').length>5);
 }
});


test('UI source keeps action-first student mode and five-stage dashboard',()=>{
 const app=fs.readFileSync('web/js/app.js','utf8');
 const index=fs.readFileSync('web/index.html','utf8');
 assert.match(index,/js\/workflow-engine\.js/);
 assert.match(app,/학생용 간단보기/);
 assert.match(app,/오늘 내가 할 일/);
 assert.match(app,/workflowPipelineNode/);
 assert.match(app,/workflowBlockerNode/);
 assert.match(app,/가장 먼저 해결할 것/);
 assert.match(app,/baseRole==='student'/);
 assert.match(app,/어려운 편집·인쇄 용어 쉽게 보기/);
});

test('shared helpers remain outside renderArticles boundary',()=>{
 const app=fs.readFileSync('web/js/app.js','utf8');
 const renderStart=app.indexOf('async function renderArticles(){');
 const csv=app.indexOf('function csvCell');
 const renderMain=app.indexOf('main.replaceChildren(...(noticeBox',renderStart);
 assert.ok(renderStart>=0&&renderMain>renderStart&&csv>renderMain);
 const closeSlice=app.slice(renderMain,csv);
 assert.ok(closeSlice.trimEnd().endsWith('}'));
});
