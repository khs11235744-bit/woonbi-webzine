const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{Woonbi:{}}};ctx.window.window=ctx.window;vm.createContext(ctx);
vm.runInContext(fs.readFileSync('web/js/editorial-layout.js','utf8'),ctx,{filename:'editorial-layout.js'});
const L=ctx.window.Woonbi.editorialLayout;

test('classifies photo story',()=>assert.equal(L.treatment({title:'운동장 위, 우리가 가장 뜨거웠던 하루',category:'특집'}),'photo'));
test('classifies people story',()=>assert.equal(L.treatment({title:'교사와 나눈 대화',category:'학교 사람들'}),'portrait'));
test('classifies research story',()=>assert.equal(L.treatment({title:'교실의 빛과 공기는 성적표에 닿을까',planKind:'research'}),'research'));
test('classifies essay story',()=>assert.equal(L.treatment({title:'졸업을 앞둔 기억',category:'학생 글'}),'essay'));
test('classifies feature story',()=>assert.equal(L.treatment({title:'우리 학교를 다시 만드는 이유',category:'특집'}),'feature'));
test('defaults ordinary school item to news',()=>assert.equal(L.treatment({title:'이번 주 학교 소식',category:'학교 이야기'}),'news'));
test('magazine plan expands long essays and photo-heavy research',()=>{
 assert.equal(L.plan({category:'학생 글',body:'가'.repeat(3300)}).template,'essay-2p');
 assert.equal(L.plan({planKind:'research',photos:Array(5).fill({})}).template,'research-4p');
});
