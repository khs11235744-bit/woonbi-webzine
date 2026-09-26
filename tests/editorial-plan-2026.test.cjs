const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const ctx={window:{Woonbi:{}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('web/js/editorial-plan-2026.js','utf8'),ctx);
const E=ctx.window.Woonbi.editorial2026;

test('2026 editorial plan contains a full issue worth of article slots',()=>{
 assert.ok(E.plans.length>=47);
 const slots=E.articleSlots();
 assert.equal(slots.length,E.plans.length);
 assert.ok(slots.every(x=>x.contentOrigin==='2026-editorial-plan'));
 assert.ok(slots.every(x=>Array.isArray(x.reportingQuestions)));
});

test('all source-library entries are dated 2026 only',()=>{
 assert.ok(E.sources.length>=32);
 assert.ok(E.sources.every(x=>String(x.date).startsWith('2026-')));
 assert.ok(E.sources.every(x=>x.year===2026));
});

test('plan covers annual school record interviews R&E Dokdo and student features',()=>{
 const text=E.plans.map(x=>x.title+' '+x.section+' '+x.angle).join('\n');
 for(const term of ['교장','교감','체육','수학여행','학생회','독도','R&E','수능','미탑','호르무즈']){
  assert.ok(text.includes(term),term+' missing');
 }
});

test('drafts separate verified sources from student reporting work',()=>{
 const p=E.plans.find(x=>x.sourceIds.length)||E.plans[0],draft=E.draft(p);
 assert.match(draft,/편집용 초안/);
 assert.match(draft,/취재로 채울 핵심/);
 assert.match(draft,/외부 기사는 사실관계를 확인하는 출발점/);
 assert.match(draft,/언론사 사진/);
});

test('verified source set includes web-confirmed 2026 international exchange and school events',()=>{
 for(const id of ['s02','s10','s15','s19','s21','s22','s25','s29','s31','s32'])assert.ok(E.verifiedSourceIds.has(id),id);
});


test('2026 plan connects robotics award and autonomous public high school sources',()=>{
 const robot=E.plans.find(x=>x.sourceIds.includes('s31'));
 const autonomous=E.plans.find(x=>x.id==='p28');
 assert.ok(robot);
 assert.match(robot.title,/로봇|R&E/);
 assert.ok(autonomous.sourceIds.includes('s32'));
 assert.equal(E.plans.length,47);
 assert.equal(E.sources.length,32);
});
