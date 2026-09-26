const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const ctx={window:{Woonbi:{editorialLayout:{plan:a=>a._plan||{type:'news',template:'news-1p',pages:1,label:'SCHOOL NEWS'}}}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('web/js/magazine-engine.js','utf8'),ctx);
const M=ctx.window.WoonbiMagazine;

test('cover scoring favors feature/photo stories with printable lead image',()=>{
 const a={title:'우리 학교를 다시 만드는 이유',deck:'특집 기사',body:'x'.repeat(1200),photos:[{width:3200,height:2200}],_plan:{type:'feature',template:'feature-4p',pages:4,label:'FEATURE'}};
 const x=M.coverScore(a);
 assert.ok(x.score>=50);
 assert.equal(x.photo.width,3200);
 assert.ok(x.reasons.includes('표지형 기사'));
});

test('preflight catches missing photos, alt text, and low print resolution',()=>{
 const a={title:'아주 긴 제목을 가진 인물 인터뷰 기사 제목이 계속 이어지는 경우',photos:[{width:1200,height:800,alt:''}]};
 const p={type:'portrait',pages:2};
 const w=M.preflight(a,p);
 assert.ok(w.includes('대체설명 누락'));
 assert.ok(w.includes('인쇄 해상도 확인'));
 assert.ok(w.includes('표제 길이 재검토'));
});

test('issue plan assigns page ranges and rounds recommendation to multiples of four',()=>{
 const items=[
  {id:'a',photos:[],_plan:{type:'news',template:'news-1p',pages:1,label:'SCHOOL NEWS'}},
  {id:'b',photos:[{},{}],_plan:{type:'feature',template:'feature-4p',pages:4,label:'FEATURE'}}
 ];
 const p=M.buildPlan(items,'웅비');
 assert.equal(p.contentPages,5);
 assert.equal(p.printPages,9);
 assert.equal(p.padded,12);
 assert.equal(p.plans[0].start,1);
 assert.equal(p.plans[1].start,2);
 assert.equal(p.plans[1].end,5);
});


test('full issue page map includes cover contents section openers colophon back cover and 4-page padding',()=>{
 const items=[
  {id:'a',title:'첫 기사',photos:[],_plan:{type:'news',template:'news-1p',pages:1,label:'SCHOOL NEWS'}},
  {id:'b',title:'사진 특집',photos:[{alt:'x'},{alt:'y'},{alt:'z'},{alt:'w'}],_plan:{type:'photo',template:'photo-4p',pages:4,label:'PHOTO ESSAY'}}
 ];
 const map=M.pageMap(items,'웅비');
 assert.equal(map.pages[0].kind,'cover');
 assert.equal(map.pages[1].kind,'contents');
 assert.ok(map.pages.some(x=>x.kind==='opener'&&x.type==='news'));
 assert.ok(map.pages.some(x=>x.kind==='opener'&&x.type==='photo'));
 assert.ok(map.pages.some(x=>x.kind==='colophon'));
 assert.equal(map.pages.at(-1).kind,'backcover');
 assert.equal(map.pages.length%4,0);
});


test('spread map pairs inside pages as left and right while keeping covers single',()=>{
 const items=[{id:'a',title:'기사',photos:[{width:2400,height:1600,alt:'사진',caption:'설명'}],_plan:{type:'news',template:'news-1p',pages:1,label:'SCHOOL NEWS'}}];
 const m=M.spreadMap(items,'웅비');
 assert.equal(m.spreads[0].kind,'cover');
 assert.equal(m.spreads.at(-1).kind,'backcover');
 const inside=m.spreads.find(x=>x.kind==='spread');
 assert.ok(inside.left);
 assert.ok(inside.right);
});

test('print package emits sequential PDF order, checklist, and automatic blank pages',()=>{
 const items=[{id:'a',title:'기사',deck:'부제',body:'본문',photos:[{width:2400,height:1600,alt:'사진',caption:'설명'}],_plan:{type:'news',template:'news-1p',pages:1,label:'SCHOOL NEWS'}}];
 const p=M.printPackage(items,'웅비');
 assert.equal(p.pdfOrder.length%4,0);
 assert.ok(p.blankCount>0);
 assert.equal(p.pdfOrder[0].side,'front-cover');
 assert.equal(p.pdfOrder.at(-1).side,'back-cover');
 assert.ok(p.checks.some(x=>x.id==='pages4'&&x.severity==='ok'));
 assert.equal(p.ready,true);
});
