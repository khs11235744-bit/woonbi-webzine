const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('live config explicitly enables temporary open admin',()=>{
 const cfg=JSON.parse(fs.readFileSync('deploy/firebase-live-config.json','utf8').replace(/^﻿/,''));
 assert.equal(cfg.openAdmin,true);
});

test('client promotes signed-in profile to teacher only when openAdmin is configured',()=>{
 const src=fs.readFileSync('web/js/firebase-store.js','utf8');
 assert.match(src,/this\.config\.openAdmin\?\{\.\.\.profile,role:'teacher',active:true,openAdmin:true\}/);
 assert.match(src,/login_hint:u\.email/);
});

test('temporary Firestore and Storage rules treat verified Google login as admin',()=>{
 const fire=fs.readFileSync('firebase/firestore.rules','utf8');
 const store=fs.readFileSync('firebase/storage.rules','utf8');
 assert.match(fire,/TEMP OPEN ADMIN/);
 assert.match(fire,/function teacher\(\)\{return signed\(\);\}/);
 assert.match(fire,/function canRead\(a\)\{return signed\(\) && a is map;\}/);
 assert.match(store,/TEMP OPEN ADMIN/);
 assert.match(store,/function teacher\(\)\{return signed\(\);\}/);
});

test('UI clearly labels temporary open admin mode',()=>{
 const app=fs.readFileSync('web/js/app.js','utf8');
 const css=fs.readFileSync('web/editorial-polish.css','utf8');
 assert.match(app,/임시 OPEN ADMIN/);
 assert.match(css,/\.mode-banner\.open-admin/);
});
