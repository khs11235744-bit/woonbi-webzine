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
