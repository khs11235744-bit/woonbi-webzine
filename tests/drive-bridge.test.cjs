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
  assert.match(src,/현재 계정으로 Picker 열기/);
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
