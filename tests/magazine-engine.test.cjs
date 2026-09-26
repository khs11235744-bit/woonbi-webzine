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
