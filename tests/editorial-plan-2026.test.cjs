const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const ctx={window:{}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('web/js/editorial-plan-2026.js','utf8'),ctx);
const P=ctx.window.Woonbi.editorial2026;

test('2026 editorial plan has a full issue-scale article slate',()=>{
 assert.ok(P.plans.length>=40&&P.plans.length<=60);
 assert.ok(P.plans.some(x=>x.title.includes('교장 선생님 인사말')));
 assert.ok(P.plans.some(x=>x.title.includes('벚꽃')));
 assert.ok(P.plans.some(x=>x.title.includes('체육대회')));
 assert.ok(P.plans.some(x=>x.title.includes('R&E')));
 assert.ok(P.plans.some(x=>x.title.includes('수능')));
});

test('student special section includes career-linked research topics',()=>{
 const specials=P.plans.filter(x=>x.section.includes('학생 특집'));
 assert.ok(specials.length>=10);
 assert.ok(specials.some(x=>x.title.includes('호르무즈')));
 assert.ok(specials.some(x=>x.title.includes('질서')));
 assert.ok(specials.some(x=>x.title.includes('미탑')));
 assert.ok(specials.every(x=>String(x.studentRecord||'').length>0));
});

test('media database exposes only sources labeled 2026',()=>{
 assert.ok(P.sources.length>=20);
 assert.ok(P.sources.every(x=>String(x.date).startsWith('2026-')));
 assert.ok(P.sources.every(x=>x.year===2026&&x.yearVerified===true));
 assert.ok(P.sources.some(x=>x.webVerified===true));
});

test('drafts keep unverified facts as reporting tasks rather than fabricated prose',()=>{
 const internal=P.plans.find(x=>x.title.includes('체육대회'));
 const d=P.draft(internal);
 assert.match(d,/교내 취재와 학교 자료로 사실 확인 필요/);
 assert.match(d,/학생 기자가 실제 현장에서 본 장면/);
 assert.match(d,/확인하지 않은 사실/);
});

test('press-backed drafts list sources but tell students to rewrite from reporting',()=>{
 const p=P.plans.find(x=>x.title.includes('급식실의 강철 요리사'));
 const d=P.draft(p);
 assert.match(d,/2026 자료함에서 먼저 확인할 것/);
 assert.match(d,/경북매일/);
 assert.match(d,/문장을 베끼지 않고/);
});

test('app keeps non-destructive bulk creation for missing plans only',()=>{
 const app=fs.readFileSync('web/js/app.js','utf8');
 assert.match(app,/createAll2026Drafts/);
 assert.match(app,/없는 기획초안 모두 만들기/);
 assert.match(app,/targets=data\.plans\.filter/);
 assert.match(app,/기존 원고는 그대로 두고/);
 assert.match(app,/editorialPlanId/);
});
