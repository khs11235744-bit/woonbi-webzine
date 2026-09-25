const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('live config explicitly enables temporary open admin',()=>{
 const cfg=JSON.parse(fs.readFileSync('deploy/firebase-live-config.json','utf8').replace(/^﻿/,''));
 assert.equal(cfg.openAdmin,true);
});

test('client promotes signed-in profile to teacher while runtime openAdmin is active',()=>{
 const src=fs.readFileSync('web/js/firebase-store.js','utf8');
 assert.match(src,/this\.openAdmin=await this\.getAccessMode\(\)/);
 assert.match(src,/this\.user=this\.openAdmin\?\{\.\.\.profile,baseRole,role:'teacher',active:true,openAdmin:true\}/);
 assert.match(src,/login_hint:u\.email/);
});

test('temporary Firestore and Storage rules treat verified Google login as admin',()=>{
 const fire=fs.readFileSync('firebase/firestore.rules','utf8');
 const store=fs.readFileSync('firebase/storage.rules','utf8');
 assert.match(fire,/function openAdmin\(\)/);
 assert.match(fire,/function teacher\(\)\{return signed\(\) && \(openAdmin\(\) \|\| baseTeacher\(\)\);\}/);
 assert.match(fire,/function canRead\(a\)/);
 assert.match(store,/function openAdmin\(\)/);
 assert.match(store,/function teacher\(\)\{return signed\(\) && \(openAdmin\(\) \|\| baseTeacher\(\)\);\}/);
});

test('UI clearly labels temporary open admin mode',()=>{
 const app=fs.readFileSync('web/js/app.js','utf8');
 const css=fs.readFileSync('web/editorial-polish.css','utf8');
 assert.match(app,/임시 OPEN ADMIN/);
 assert.match(css,/\.mode-banner\.open-admin/);
});


test('runtime Firestore access switch exists and defaults open before first lock',()=>{
 const fire=fs.readFileSync('firebase/firestore.rules','utf8');
 assert.match(fire,/settings\/access/);
 assert.match(fire,/!exists\(\/databases\/\$\(database\)\/documents\/settings\/access\)/);
 const store=fs.readFileSync('web/js/firebase-store.js','utf8');
 assert.match(store,/async setOpenAdmin/);
 assert.match(store,/교사 계정만 관리자 모드를 다시 열 수 있습니다/);
});
