const {test}=require('node:test'),a=require('node:assert/strict');
const C=require('../web/js/core.js'),E=require('../web/js/editorial.js');
const u={uid:'a',role:'teacher',active:true};
const draft={id:'x',title:'우리의 질문',deck:'',byline:'작성자',body:'실제 사실로 내보내는 기사가 아닌 검증용 원고입니다. '.repeat(6),photos:[],minPhotos:0,status:'draft',revision:0,assigneeIds:['a']};
const photo={id:'p',caption:'자료',alt:'사진',after:-1,width:1600,height:1000,originalBytes:1000,originalType:'image/jpeg',webPath:'private/x/p/web.webp',originalPath:'private/x/p/original'};
const cases=[
 ['Korean whitespace normalization',()=>a.equal(E.normalize('역사 골 든벨'),'역사골든벨')],
 ['NFC normalization',()=>a.equal(E.normalize('학교'.normalize('NFD')),E.normalize('학교'))],
 ['Latin case normalization',()=>a.equal(E.normalize('STEM'),'stem')],
 ['reading time floor',()=>a.equal(E.readingMinutes(''),1)],
 ['reading time length',()=>a.equal(E.readingMinutes('가'.repeat(1001)),3)],
 ['sample flag detection',()=>a.ok(E.sample({...photo,placeholder:true}))],
 ['seed path detection even without flag',()=>a.ok(E.sample({...photo,webPath:'seed/x/p'}))],
 ['upload not sample',()=>a.equal(E.sample(photo),false)],
 ['sample blocks preflight',()=>a.equal(E.preflight({...draft,photos:[{...photo,placeholder:true}]}).find(x=>x.code==='sample').severity,'block')],
 ['sample blocks submission',()=>a.throws(()=>C.transition(u,{...draft,photos:[{...photo,placeholder:true}]},0,'submitted',{},'now'))],
 ['seed path blocks submission',()=>a.throws(()=>C.transition(u,{...draft,photos:[{...photo,webPath:'seed/x/p'}]},0,'submitted',{},'now'))],
 ['sample blocks teacher approval',()=>a.throws(()=>C.transition(u,{...draft,status:'submitted',photos:[{...photo,placeholder:true}]},0,'approved',{},'now'))],
 ['sample blocks publishing even forged approval',()=>a.throws(()=>C.publication(u,{...draft,status:'approved',webConsent:true,photos:[{...photo,placeholder:true}]},'now'))],
 ['sample blocks print snapshot',()=>a.throws(()=>C.printSnapshot(u,[{...draft,status:'approved',printConsent:true,photos:[{...photo,placeholder:true}]}],'호','now'))],
 ['replacement preserves paragraph',()=>a.equal(E.replace({...photo,after:3,placeholder:true},{...photo,id:'q'}).after,3)],
 ['replacement clears sample caption',()=>a.equal(E.replace({...photo,placeholder:true},photo).caption,'')],
 ['replacement preserves meaningful real caption',()=>a.equal(E.replace(photo,{...photo,id:'q'}).caption,'자료')],
 ['replacement clears flag',()=>a.equal(E.replace({...photo,placeholder:true},photo).placeholder,false)],
 ['bad file signature rejected',()=>a.equal(E.signature(new TextEncoder().encode('<svg>hello</svg>')),'')],
 ['JPEG signature',()=>a.equal(E.signature(Uint8Array.from([255,216,255,0,0,0,0,0,0,0,0,0])),'image/jpeg')],
 ['PNG signature',()=>a.equal(E.signature(Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0])),'image/png')],
 ['WebP signature',()=>a.equal(E.signature(new TextEncoder().encode('RIFF0000WEBP')),'image/webp')],
 ['empty upload rejected',()=>a.equal(E.signature(new Uint8Array()),'')],
 ['alt empty blocker',()=>a.equal(E.preflight({...draft,photos:[{...photo,alt:''}]}).find(x=>x.code==='alt').severity,'block')],
 ['caption advisory only',()=>a.equal(E.preflight({...draft,photos:[{...photo,caption:''}]}).find(x=>x.code==='caption').severity,'warn')],
 ['print resolution advisory',()=>a.ok(E.preflight({...draft,photos:[{...photo,width:640}]}).find(x=>x.code==='print-resolution'))],
 ['long headline advisory',()=>a.ok(E.preflight({...draft,title:'가'.repeat(80)}).find(x=>x.code==='headline'))],
 ['unresolved note advisory',()=>a.ok(E.preflight({...draft,body:'[확인 필요]'}).find(x=>x.code==='unresolved'))],
 ['long paragraph advisory',()=>a.ok(E.preflight({...draft,body:'가'.repeat(1001)}).find(x=>x.code==='paragraph'))],
 ['sort never mutates original',()=>{const ar=[{title:'나',planOrder:2},{title:'가',planOrder:1}];E.sort(ar,'plan');a.equal(ar[0].title,'나');}],
 ['sort title',()=>a.equal(E.sort([{title:'나'},{title:'가'}],'title')[0].title,'가')],
 ['sort recent',()=>a.equal(E.sort([{updatedAt:'2026-01'},{updatedAt:'2026-09'}],'updated')[0].updatedAt,'2026-09')],
 ['sample article count',()=>a.equal(E.replaceCount([{photos:[{...photo,placeholder:true}]},{photos:[photo]}]),1)],
 ['photo placement by word length avoids ending',()=>{const b=['첫 부분'.repeat(60),'## 새 소제목','중간'.repeat(150),'후반'.repeat(100),'결론'];const p=C.photoPositions({...draft,body:b.join('\n\n'),photos:[photo,{...photo,id:'2'},{...photo,id:'3'}]});a.ok(p.has(-1));a.ok(!p.has(1));a.ok(!p.has(4));}],
 ['explicit photo position retained',()=>a.ok(C.photoPositions({...draft,body:'첫 문단\n\n둘째\n\n셋째',photos:[{...photo,after:1}]}).has(1))],
 ['real photo submit works',()=>a.equal(C.transition(u,{...draft,photos:[photo]},0,'submitted',{},'now').status,'submitted')]
];for(const [n,f] of cases)test(n,f);
