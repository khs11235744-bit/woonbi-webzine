const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const runtime={window:{Woonbi:{}}};runtime.window.window=runtime.window;vm.createContext(runtime);
vm.runInContext(fs.readFileSync('web/js/ai-editor.js','utf8'),runtime,{filename:'ai-editor.js'});
const A=runtime.window.Woonbi.aiEditor;
test('AI slop detector flags abstract boilerplate',()=>{
 const r=A.score({title:'현대 사회에서 중요한 AI',body:'현대 사회에서 AI는 중요한 역할을 한다. 이러한 기술은 다양한 가능성을 제공한다. 이를 통해 더 나은 미래에 기여할 수 있다. 의미 있는 변화가 기대된다.',sourceReferences:[]});
 assert.ok(r.flags.some(x=>x.kind==='slop'));
 assert.ok(r.flags.some(x=>x.kind==='source'));
 assert.ok(r.score<90);
});
test('specific reporting gets positive signals',()=>{
 const r=A.score({title:'점심시간 동아리 운영 규정이 바뀌었다',body:'9월 3일 학생회실에서 동아리 대표 18명이 새 운영 규정을 논의했다. “회의 시간이 줄어 준비가 어려워졌다”고 한 학생은 말했다. 담당 교사는 2026년 2학기부터 30분 단위로 운영한다고 설명했다.',sourceReferences:[{url:'https://example.com'}]});
 assert.ok(r.strengths.some(x=>x.includes('출처')));
 assert.ok(r.stats.numbers>=1);
 assert.ok(r.stats.quotes>=1);
});
test('reporting questions and headline frames are bounded',()=>{
 assert.equal(A.questions({category:'학교 사람들'}).length,6);
 assert.equal(A.questions({planKind:'research'}).length,6);
 assert.equal(A.headlinePrompts({title:'학교 축제'}).length,4);
});
