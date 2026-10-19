const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const path='../web/js/contribute-core.js';
test('contribution module exists',()=>assert.ok(fs.existsSync(require('node:path').join(__dirname,path)),'원고 작성·인터뷰 모듈이 필요합니다'));
if(fs.existsSync(require('node:path').join(__dirname,path))){
 const C=require(path);
 test('two interviews each have eleven distinct questions',()=>{for(const kind of ['principal','viceprincipal']){assert.equal(C.templates[kind].questions.length,11);assert.equal(new Set(C.templates[kind].questions).size,11);}assert.ok(!C.templates.viceprincipal.questions.join('').includes('최초'));});
 test('Q&A retains actual answers and does not invent empty answers',()=>{const a=C.compose({kind:'principal',byline:'답변자',answers:['학교에서 만난 첫 장면입니다.','','제 생각입니다.']});assert.match(a.body,/학교에서 만난 첫 장면입니다/);assert.match(a.body,/제 생각입니다/);assert.ok(!a.body.includes('undefined'));assert.equal((a.body.match(/^질문 /gm)||[]).length,2);});
 test('article generator preserves evidence and omits missing facts',()=>{const a=C.compose({kind:'event',byline:'기자',facts:{what:'역사신문 전시',when:'10월',where:'도서관',scene:'학생들이 기사를 읽었다.',quote:'직접 확인한 말',speaker:'참여 학생'}});assert.match(a.body,/역사신문 전시/);assert.match(a.body,/직접 확인한 말/);assert.ok(!a.body.includes('성공적'));});
 test('submission requires writer, meaningful body and confirmation',()=>{assert.throws(()=>C.validate({title:'제목',byline:'',body:'가'.repeat(80)},true));assert.throws(()=>C.validate({title:'제목',byline:'이름',body:'짧음'},true));assert.throws(()=>C.validate({title:'제목',byline:'이름',body:'가'.repeat(80)},false));assert.doesNotThrow(()=>C.validate({title:'제목',byline:'이름',body:'가'.repeat(80)},true));});
 test('oversize data is rejected rather than silently truncating answers',()=>{assert.throws(()=>C.validate({title:'제목',byline:'이름',body:'가'.repeat(45001)},true));});
 test('HTML export escapes submitted markup',()=>{const html=C.printable({title:'<script>x</script>',byline:'<b>이름</b>',body:'<img src=x onerror=alert(1)>'});assert.ok(!html.includes('<script>x'));assert.match(html,/&lt;script&gt;/);assert.match(html,/&lt;img/);});
 test('inbox preview carries no automatic publication consent',()=>{const a=C.articleInput({id:'entry-id',title:'제목',byline:'이름',body:'가'.repeat(80),kind:'principal'},'teacher');assert.equal(a.webConsent,false);assert.equal(a.printConsent,false);assert.equal(a.minPhotos,0);assert.match(a.contentOrigin,/contribution/);assert.equal(a.assigneeIds[0],'teacher');});
}
