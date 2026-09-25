const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('Drive bridge parses folder links and raw IDs',()=>{
  const context={window:{Woonbi:{},WOONBI_CONFIG:{}},console};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('web/js/drive-bridge.js','utf8'),context,{filename:'drive-bridge.js'});
  const t=context.window.Woonbi.driveBridge._test;
  assert.equal(t.extractFolderId('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp'),'1AbCdEfGhIjKlMnOp');
  assert.equal(t.extractFolderId('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp'),'1AbCdEfGhIjKlMnOp');
  assert.equal(t.extractFolderId('1AbCdEfGhIjKlMnOp'),'1AbCdEfGhIjKlMnOp');
  assert.equal(t.extractFolderId('https://example.com/no-folder'),'');
  assert.equal(t.extractResourceKey('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp?resourcekey=0-AbC_123'),'0-AbC_123');
  assert.equal(t.extractResourceKey('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp'),'');
});

test('Drive bridge sanitizes backup folder names',()=>{
  const context={window:{Woonbi:{},WOONBI_CONFIG:{}},console};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('web/js/drive-bridge.js','utf8'),context);
  const t=context.window.Woonbi.driveBridge._test;
  assert.equal(t.sanitizeFolderName(' 2026/웅비:체육대회* '),'2026_웅비_체육대회_');
});

test('Incremental backup skips unchanged originals and detects changed originals',()=>{
  const context={window:{Woonbi:{},WOONBI_CONFIG:{}},console};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('web/js/drive-bridge.js','utf8'),context);
  const t=context.window.Woonbi.driveBridge._test;
  const source={md5Checksum:'abc',modifiedTime:'2026-09-25T10:00:00Z',size:123};
  assert.equal(t.sameRevision(source,{appProperties:{woonbiSourceMd5:'abc'}}),true);
  assert.equal(t.sameRevision(source,{appProperties:{woonbiSourceMd5:'def'}}),false);
  const noMd5={modifiedTime:'2026-09-25T10:00:00Z',size:123};
  assert.equal(t.sameRevision(noMd5,{appProperties:{woonbiSourceModified:noMd5.modifiedTime,woonbiSourceSize:'123'}}),true);
  assert.equal(t.sameRevision({...noMd5,size:124},{appProperties:{woonbiSourceModified:noMd5.modifiedTime,woonbiSourceSize:'123'}}),false);
});


test('Drive bridge reuses Firebase web key and project number for Picker',()=>{
  const context={window:{Woonbi:{},WOONBI_CONFIG:{firebase:{apiKey:'firebase-key',messagingSenderId:'285370921993'},googleDrive:{}}},console};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('web/js/drive-bridge.js','utf8'),context);
  const t=context.window.Woonbi.driveBridge._test,c=t.cfg();
  assert.equal(c.apiKey,'firebase-key');
  assert.equal(c.appId,'285370921993');
  assert.equal(t.configured(),true);
});

test('Drive bridge contains direct multi-select image Picker path',()=>{
  const src=fs.readFileSync('web/js/drive-bridge.js','utf8');
  assert.match(src,/MULTISELECT_ENABLED/);
  assert.match(src,/image\/jpeg,image\/png,image\/webp/);
  assert.match(src,/사진 Picker · 큰 썸네일/);
});


test('Drive bridge uses isolated Firebase Auth sessions for school and personal Drive',()=>{
  const src=fs.readFileSync('web/js/drive-bridge.js','utf8');
  assert.match(src,/inMemoryPersistence/);
  assert.match(src,/woonbi-drive-/);
  assert.match(src,/GoogleAuthProvider\.credentialFromResult/);
  assert.match(src,/drive\.readonly/);
  assert.match(src,/drive\.file/);
  assert.match(src,/connectViaFirebase/);
});


test('Drive bridge keeps a pinned school photo folder for one-button import',()=>{
  const src=fs.readFileSync('web/js/drive-bridge.js','utf8');
  assert.match(src,/pinnedSourceFolderId/);
  assert.match(src,/학교 사진 불러오기/);
  assert.match(src,/woonbi\.drive\.pinnedSourceFolderId/);
});


test('Picker explicitly binds current origin and auto-analyzes picked photos',()=>{
  const src=fs.readFileSync('web/js/drive-bridge.js','utf8');
  assert.match(src,/\.setOrigin\(location\.origin\)/);
  assert.match(src,/DocsViewMode\.GRID/);
  assert.match(src,/DOCS_IMAGES/);
  assert.match(src,/setEnableDrives\(true\)/);
  assert.doesNotMatch(src,/enableFeature\(g\.Feature\.NAV_HIDDEN\)/);
  assert.match(src,/await sendRowsToWoonbi\(rows\)/);
  assert.match(src,/docs\.google\.com\/\*/);
});

test('Picker surfaces actionable errors instead of silent blank states',()=>{
  const src=fs.readFileSync('web/js/drive-bridge.js','utf8');
  assert.match(src,/pickerErrorMessage/);
  assert.match(src,/API Key 설정을 확인/);
  assert.match(src,/Workspace 정책/);
  assert.match(src,/Action\.ERROR/);
});


test('Picker prefers official GIS token client when Web OAuth client exists',()=>{
  const src=fs.readFileSync('web/js/drive-bridge.js','utf8');
  assert.match(src,/kind==='picker'&&c\.clientId/);
  assert.match(src,/return connectViaGIS\(kind,loginHint\)/);
  assert.match(src,/initTokenClient/);
});


test('local folder fallback stays available when Google login is skipped',()=>{
  const app=fs.readFileSync('web/js/app.js','utf8');
  assert.match(app,/로그인 없이 사진 폴더 가져오기/);
  assert.match(app,/woonbi-local-photo-input/);
});


test('Drive bridge discovers shared school folders outside My Drive',()=>{
  const src=fs.readFileSync('web/js/drive-bridge.js','utf8');
  assert.match(src,/sharedWithMe = true/);
  assert.match(src,/includeItemsFromAllDrives:'true'/);
  assert.match(src,/supportsAllDrives:'true'/);
  assert.match(src,/listSharedDrives/);
  assert.match(src,/공유폴더 찾아보기/);
  assert.match(src,/내 소유 폴더가 아니어도/);
});


test('shared drive root scan uses drive corpus and all-drives flags',()=>{
  const src=fs.readFileSync('web/js/drive-bridge.js','utf8');
  assert.match(src,/async function scanSharedDrive/);
  assert.match(src,/corpora:'drive'/);
  assert.match(src,/driveId:drive\.id/);
  assert.match(src,/includeItemsFromAllDrives:'true'/);
  assert.match(src,/supportsAllDrives:'true'/);
});


test('link-shared folder resource keys are preserved for metadata listing and download',()=>{
  const src=fs.readFileSync('web/js/drive-bridge.js','utf8');
  assert.match(src,/X-Goog-Drive-Resource-Keys/);
  assert.match(src,/pinnedSourceResourceKey/);
  assert.match(src,/extractResourceKey/);
});


test('Drive photo browser has search and sort for large school folders',()=>{
  const src=fs.readFileSync('web/js/drive-bridge.js','utf8');
  assert.match(src,/사진 이름·폴더 검색/);
  assert.match(src,/최근 사진순/);
  assert.match(src,/큰 파일순/);
});
