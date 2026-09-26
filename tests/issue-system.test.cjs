const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('web/js/app.js','utf8');
const css=fs.readFileSync('web/editorial-polish.css','utf8');

test('cover editor offers three concrete cover directions',()=>{
 assert.match(app,/A · 정통 교지형/);
 assert.match(app,/B · 사진 전면형/);
 assert.match(app,/C · 타이포그래피형/);
 assert.match(app,/issueCoverStyle/);
});

test('photo library indexes by date event article and people',()=>{
 assert.match(app,/photoLibraryMeta/);
 assert.match(app,/PHOTO LIBRARY \+ LOCAL SCAN/);
 assert.match(app,/\['date','날짜'/);
 assert.match(app,/\['event','행사'/);
 assert.match(app,/\['article','기사'/);
 assert.match(app,/\['people','인물·담당'/);
 assert.match(app,/woonbi-photo-library\.csv/);
});

test('issue preview covers full book sequence',()=>{
 assert.match(app,/COVER · 雄飛 VOL\.42/);
 assert.match(app,/CONTENTS · EDITORIAL NOTE/);
 assert.match(app,/COLOPHON · INSIDE BACK/);
 assert.match(app,/BACK COVER · 雄飛/);
 assert.match(app,/book-back-cover/);
 assert.match(css,/\.book-back-cover/);
});

test('print handoff persists cover choice and layout style',()=>{
 assert.match(app,/cover:\{articleId:issueCoverArticleId/);
 assert.match(app,/01_잡지조판계획\.json/);
 assert.match(app,/layout\.json/);
});


test('footer keeps Korean navigation labels intact at tablet and desktop widths',()=>{
 assert.match(css,/\.site-footer nav \.text,/);
 assert.match(css,/white-space:nowrap/);
 assert.match(css,/min-width:max-content/);
 assert.match(css,/min-width:621px\) and \(max-width:1000px/);
});


test('article photo desk exposes lead recommendation and print readiness',()=>{
 const app=fs.readFileSync('web/js/app.js','utf8');
 const css=fs.readFileSync('web/editorial-polish.css','utf8');
 assert.match(app,/대표사진 자동추천/);
 assert.match(app,/photoHealthSummary/);
 assert.match(app,/인쇄용 충분/);
 assert.match(app,/저해상도 · 교체 권장/);
 assert.match(app,/사진 크게 보기/);
 assert.match(css,/\.photo-box\.is-cover/);
 assert.match(css,/\.editor-photo-preview/);
});


test('article editor exposes magazine layout hint linked to print engine',()=>{
 const app=fs.readFileSync('web/js/app.js','utf8');
 const css=fs.readFileSync('web/editorial-polish.css','utf8');
 assert.match(app,/renderMagazineEditorHint/);
 assert.match(app,/magazineEditorHint/);
 assert.match(app,/표지점수/);
 assert.match(app,/WoonbiMagazine\.buildPlan/);
 assert.match(css,/\.magazine-editor-panel/);
});
