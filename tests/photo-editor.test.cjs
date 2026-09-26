const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const ctx={window:{WoonbiMagazine:{coverScore:a=>({photo:[...(a.photos||[])].sort((x,y)=>(y.width*y.height)-(x.width*x.height))[0]||null})}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('web/js/photo-editor.js','utf8'),ctx);
const P=ctx.window.WoonbiPhotoEditor;

test('photo editor health catches missing descriptions and low resolution',()=>{
 const h=P.health([{caption:'',alt:'',width:1200},{caption:'ok',alt:'ok',width:2400}]);
 assert.equal(h.missingCaption,1);
 assert.equal(h.missingAlt,1);
 assert.equal(h.lowRes,1);
 assert.equal(h.ok,false);
});

test('photo quality labels print readiness',()=>{
 const q=P.quality({width:2500}); assert.equal(q.label,'인쇄용 충분'); assert.equal(q.level,'ok');
 assert.equal(P.quality({width:1700}).level,'check');
 assert.equal(P.quality({width:1200}).level,'warn');
});

test('best lead photo reuses magazine cover scoring',()=>{
 const id=P.bestLeadId({photos:[{id:'a',width:1000,height:1000},{id:'b',width:3000,height:2000}]});
 assert.equal(id,'b');
});

test('photo roles distinguish cover and body images',()=>{
 assert.equal(P.role(0),'대표사진');
 assert.equal(P.role(2),'본문 2');
});


test('visual metric scoring stays in 0-100 range',()=>{
 const q=P.scoreMetrics({sharpness:120,exposure:80,composition:70,resolution:90});
 assert.equal(q.sharpness,100);
 assert.ok(q.overall>=0&&q.overall<=100);
 assert.equal(q.exposure,80);
});

test('image-data analysis scores neutral exposure and high resolution without face detection',()=>{
 const w=16,h=16,data=new Uint8ClampedArray(w*h*4);
 for(let i=0;i<data.length;i+=4){data[i]=128;data[i+1]=128;data[i+2]=128;data[i+3]=255;}
 const q=P.analyzeImageData(data,w,h,3200,2400);
 assert.equal(q.resolution,96);
 assert.ok(q.exposure>80);
 assert.ok(q.composition>=0&&q.composition<=100);
 assert.ok(q.sharpness>=0&&q.sharpness<=100);
});
