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
