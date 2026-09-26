const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const ctx={window:{}};vm.createContext(ctx);vm.runInContext(fs.readFileSync('web/js/photo-library.js','utf8'),ctx);const P=ctx.window.WoonbiPhotoLibrary;
test('photo library module exposes pure classification helpers',()=>{for(const k of ['tokens','scoreArticle','hashDistance','colorDistance','libraryMeta'])assert.equal(typeof P[k],'function');});
test('library metadata detects date event and assigned person',()=>{const a={id:'a1',title:'체육대회 현장',sourceTitle:'',category:'학교',byline:'',assigneeNames:['홍길동']};const m=P.libraryMeta({path:'2026-05-10 체육대회 홍길동/IMG.jpg',name:'IMG.jpg',lastModified:0,articleId:'a1'},[a]);assert.equal(m.date,'2026-05-10');assert.ok(m.events.includes('체육대회'));assert.equal(m.article,'체육대회 현장');assert.ok(m.people.includes('홍길동'));});
test('article scorer favors filename and assignee matches',()=>{const a={title:'과학 탐구 발표',sourceTitle:'',category:'과학',byline:'',assigneeNames:['김학생']};const x=P.scoreArticle({path:'과학탐구 김학생/발표.jpg',name:'발표.jpg'},a);assert.ok(x.score>0);assert.ok(x.hits.length>0);});
test('hash and color distances preserve duplicate heuristics',()=>{assert.equal(P.hashDistance('ffff','ffff'),0);assert.ok(P.hashDistance('ffff','0000')>0);assert.equal(P.colorDistance([1,2,3],[1,2,3]),0);});


test('similarity clusters group duplicates and choose one best row',()=>{
 const rows=[
  {key:'a',name:'a.jpg',width:1800,height:1200,size:1000,score:2,duplicateOf:'',nearDuplicateOf:''},
  {key:'b',name:'b.jpg',width:3200,height:2200,size:2000,score:5,duplicateOf:'',nearDuplicateOf:'a.jpg'},
  {key:'c',name:'c.jpg',width:1000,height:700,size:800,score:1,duplicateOf:'a.jpg',nearDuplicateOf:''},
  {key:'d',name:'d.jpg',width:2500,height:1600,size:1200,score:4,duplicateOf:'',nearDuplicateOf:''}
 ];
 const groups=P.similarityClusters(rows);
 assert.equal(groups.length,1);
 assert.equal(groups[0].length,3);
 assert.equal(P.bestRow(groups[0]).key,'b');
});


test('best row uses visual quality as part of burst selection',()=>{
 const group=[
  {key:'big',width:3200,height:2200,size:2000,score:1,quality:{overall:35}},
  {key:'clean',width:2600,height:1800,size:1800,score:1,quality:{overall:95}}
 ];
 assert.equal(P.bestRow(group).key,'clean');
});


test('curation removes duplicate bursts and returns requested diverse set',()=>{
 const rows=[];
 for(let i=0;i<30;i++)rows.push({key:'k'+i,name:'p'+i+'.jpg',width:2400+i*10,height:1600,size:2000000,score:i%7,quality:{overall:60+(i%30)},duplicateOf:'',nearDuplicateOf:'',supported:true,library:{date:'2026-09-'+String((i%4)+1).padStart(2,'0'),events:[i%2?'축제·공연':'체육대회'],article:i%3?'기사 A':'기사 B'}});
 rows[1].nearDuplicateOf='p0.jpg';
 rows[2].duplicateOf='p0.jpg';
 const picks=P.curate(rows,12);
 assert.equal(picks.length,12);
 assert.ok(!picks.some(x=>x.duplicateOf));
 assert.equal(new Set(picks.map(x=>x.key)).size,12);
 assert.ok(picks.every(x=>Number.isFinite(x.curationScore)));
});

test('curation caps selection at twenty',()=>{
 const rows=Array.from({length:40},(_,i)=>({key:'k'+i,name:'p'+i,width:2000,height:1500,size:1000000,score:1,quality:{overall:80},duplicateOf:'',nearDuplicateOf:'',supported:true,library:{date:'2026-09-26',events:[],article:''}}));
 assert.equal(P.curate(rows,50).length,20);
});
