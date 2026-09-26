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
 const photo=fs.readFileSync('web/js/photo-editor.js','utf8');
 const css=fs.readFileSync('web/editorial-polish.css','utf8');
 assert.match(app,/대표사진 자동추천/);
 assert.match(app,/photoHealthSummary/);
 assert.match(photo,/인쇄용 충분/);
 assert.match(photo,/저해상도 · 교체 권장/);
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


test('article editor visualizes photo placement between paragraphs',()=>{
 const app=fs.readFileSync('web/js/app.js','utf8');
 const css=fs.readFileSync('web/editorial-polish.css','utf8');
 assert.match(app,/placementPreviewNode/);
 assert.match(app,/본문\+사진 배치 보기/);
 assert.match(app,/C\.photoPositions/);
 assert.match(css,/\.placement-preview/);
 assert.match(css,/\.placement-photo-strip/);
});

test('print editor exposes full issue page map',()=>{
 const app=fs.readFileSync('web/js/app.js','utf8');
 const css=fs.readFileSync('web/editorial-polish.css','utf8');
 assert.match(app,/magazinePageMapNode/);
 assert.match(app,/FULL ISSUE MAP/);
 assert.match(css,/\.magazine-page-map/);
 assert.match(css,/\.magazine-page-cell\.kind-opener/);
});


test('spread and print preflight are visible and exported with handoff',()=>{
 const app=fs.readFileSync('web/js/app.js','utf8');
 const css=fs.readFileSync('web/editorial-polish.css','utf8');
 assert.match(app,/magazineSpreadNode/);
 assert.match(app,/printPreflightNode/);
 assert.match(app,/02_PDF페이지순서\.txt/);
 assert.match(app,/03_인쇄체크리스트\.json/);
 assert.match(app,/04_펼침면계획\.json/);
 assert.match(css,/\.magazine-spread-view/);
 assert.match(css,/\.print-preflight-panel/);
});

test('review book includes section openers and automatic blank pages',()=>{
 const app=fs.readFileSync('web/js/app.js','utf8');
 const css=fs.readFileSync('web/editorial-polish.css','utf8');
 assert.match(app,/book-section-opener/);
 assert.match(app,/book-blank-page/);
 assert.match(css,/\.book-section-opener/);
 assert.match(css,/\.book-blank-page/);
});


test('spread editor persists manual title and photo positions',()=>{
 const app=fs.readFileSync('web/js/app.js','utf8');
 const css=fs.readFileSync('web/editorial-polish.css','utf8');
 assert.match(app,/issueSpreadOverrides/);
 assert.match(app,/bindSpreadDrag/);
 assert.match(app,/spread-edit-title/);
 assert.match(app,/spread-edit-photo/);
 assert.match(app,/06_지면수동조정\.json/);
 assert.match(css,/\.spread-draggable/);
});

test('print editor exposes B5 A4 A5 profiles and proof crop marks',()=>{
 const app=fs.readFileSync('web/js/app.js','utf8');
 const mag=fs.readFileSync('web/js/magazine-engine.js','utf8');
 assert.match(mag,/B5\/JIS 182×257mm/);
 assert.match(mag,/A4 210×297mm/);
 assert.match(mag,/A5 148×210mm/);
 assert.match(app,/교지 인쇄 판형/);
 assert.match(app,/print-crop-marks/);
 assert.match(app,/05_인쇄사양\.json/);
 assert.match(app,/판형 PDF 검토 저장/);
});

test('photo desk exposes 10 12 16 20 shot curation controls',()=>{
 const app=fs.readFileSync('web/js/app.js','utf8');
 assert.match(app,/화보 10장/);
 assert.match(app,/화보 12장/);
 assert.match(app,/화보 16장/);
 assert.match(app,/화보 20장/);
 assert.match(app,/화보용 자동선정/);
 assert.match(app,/curationScore/);
});
