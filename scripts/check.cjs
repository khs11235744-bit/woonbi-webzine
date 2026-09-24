const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto'),vm=require('node:vm');
const readJson=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
for(const f of fs.readdirSync('web/js').filter(f=>f.endsWith('.js')))cp.execFileSync(process.execPath,['--check',path.join('web/js',f)],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','scripts/fetch-school-life.mjs'],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','scripts/validate-school-life.cjs'],{stdio:'inherit'});
for(const f of ['package.json','firebase.json','firebase/firestore.indexes.json','firebase/cors.example.json'])readJson(f);
const liveCfg=readJson('deploy/firebase-live-config.json');
if(liveCfg.schoolLifeEndpoint!=='/school-life.json')throw new Error('schoolLifeEndpoint must remain /school-life.json');
const schoolLifeUi=fs.readFileSync('web/js/school-life.js','utf8');
for(const required of ['LIVE SCHOOL DATA','NEIS','포항고 공식 홈페이지','school-life-list'])if(!schoolLifeUi.includes(required))throw new Error('school-life UI regression: '+required);

const referencePath='web/js/reference-data.js';
if(fs.existsSync(referencePath)){
  const text=fs.readFileSync(referencePath,'utf8');
  const ids=[...new Set([...text.matchAll(/reference-EX\d{2}/g)].map(m=>m[0]))];
  if(ids.length!==12)throw new Error('Expected 12 public Woonbi reference articles, found '+ids.length);
  const index=fs.readFileSync('web/index.html','utf8');
  if(!index.includes('js/reference-data.js'))throw new Error('reference-data.js is not loaded by web/index.html');

  const legacyRef='web/js/legacy-reference-data.js';
  if(!fs.existsSync(legacyRef))throw new Error('Missing legacy-reference-data.js');
  const legacyText=fs.readFileSync(legacyRef,'utf8');
  const legacyIds=[...new Set([...legacyText.matchAll(/legacy-A\d{2}/g)].map(m=>m[0]))];
  if(legacyIds.length!==28)throw new Error('Expected 28 legacy reference articles, found '+legacyIds.length);
  if(!index.includes('js/legacy-reference-data.js'))throw new Error('legacy-reference-data.js is not loaded by web/index.html');

  const linkPath='web/js/article-legacy-map.js';
  if(!fs.existsSync(linkPath))throw new Error('Missing article-legacy-map.js');
  if(!index.includes('js/article-legacy-map.js'))throw new Error('article-legacy-map.js is not loaded by web/index.html');
  const linkText=fs.readFileSync(linkPath,'utf8');
  const links=[...linkText.matchAll(/'([^']+)'\s*:\s*'legacy-A\d{2}'/g)].map(m=>m[1]);
  const productionLinks=links.filter(id=>!id.startsWith('sample-'));
  if(productionLinks.length!==18)throw new Error('Expected 18 production legacy article mappings, found '+productionLinks.length);

  const referenceAssets=fs.readdirSync('web/assets/reference').filter(f=>/^EX\d{2}-\d+\.svg$/.test(f));
  if(referenceAssets.length!==24)throw new Error('Expected 24 reference SVG assets, found '+referenceAssets.length);
  const legacy=readJson('web/assets/legacy-plan/index.json');
  if(legacy.count!==96||legacy.items?.length!==96)throw new Error('Expected 96 legacy plan placeholder assets.');
  const restored='web/js/restored-media.js';
  if(!fs.existsSync(restored)||!index.includes('js/restored-media.js'))throw new Error('Restored public media must be loaded.');
  const restoredAssets=fs.readdirSync('web/assets/restored').filter(f=>/\.webp$/i.test(f));
  if(restoredAssets.length!==4)throw new Error('Expected 4 restored WebP assets, found '+restoredAssets.length);
  if(!index.includes('editorial-polish.css'))throw new Error('Editorial polish stylesheet is not loaded.');
  const review='docs/woonbi-v06r-300-role-review-20260924.md';
  if(!fs.existsSync(review))throw new Error('300-role review document missing.');
  const reviewText=fs.readFileSync(review,'utf8');
  const editorCount=(reviewText.match(/^\d+\. \*\*교지편집자/gm)||[]).length;
  const devCount=(reviewText.match(/^\d+\. \*\*개발자/gm)||[]).length;
  if(editorCount!==100||devCount!==200)throw new Error('300-role review count mismatch: '+editorCount+'/'+devCount);
  if(!index.includes('js/last-year-media.js'))throw new Error('Last-year sample media mapping is not loaded.');
  const lastYearHashes={
    'school.webp':'63819f3b0ce0e75ca8884ead2db062f0788eaa18526ff5013f49d1e464d78e6a',
    'sports.webp':'83acaa354fc2dfaed8ba62151a0cd248fa82e8d95db355f7b9d948f0c45b916e',
    'marathon.webp':'e03f311d57c9c7befb8e3c223e605fbb5f847afa2e13d7777ee22da3ea5c5fd8',
    'busking.webp':'807210e8c74b18bc7e82bddd011b792facf3e2679618a7cfa17635243149d268',
    'trip.webp':'84a1f2db6f2af38eb9de7cdb4654a75d1e5d9ee1ebee3612a8ce8fda10f3305a',
    'camp.webp':'7a0dae7e88428e3b44fac37e9f7edac38d9b71a0bdc3a0431e354175dedfc763',
    'exchange.webp':'7bb8744ba737fbdd9711b1357e7d1ff220279df6b165b4dad92a4da0e2b70c9c',
    'library.webp':'8548178cb42db9437f4a6d781ac2bb9b8e7babe1f6c7e960ff56940d300dbc3f',
    'science.webp':'bfdcfcb3f6b8aefb0a9e296e04c9c3a84ca9d0c3cf7d7a53a3f5e381fdc2b58d',
    'memories.webp':'098d190d010aa0f107826af99228a5cd07fee21df184324759995cc14cf40026'
  };
  for(const [name,expected] of Object.entries(lastYearHashes)){
    const f='web/assets/media/'+name;
    if(!fs.existsSync(f))throw new Error('Missing restored v0.5 sample photo '+name);
    const actual=crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
    if(actual!==expected)throw new Error('v0.5 sample photo checksum mismatch: '+name);
  }

  const runtime={window:{Woonbi:{}}};runtime.window.window=runtime.window;vm.createContext(runtime);
  for(const f of ['web/js/reference-data.js','web/js/legacy-reference-data.js','web/js/last-year-media.js','web/js/restored-media.js']){
    vm.runInContext(fs.readFileSync(f,'utf8'),runtime,{filename:f});
  }
  const runtimeExamples=runtime.window.Woonbi.newsroomData?.examples||[];
  const runtimeSlots=runtimeExamples.reduce((n,a)=>n+(a.photos?.length||0),0);
  const runtimeRefSlots=runtimeExamples.filter(a=>String(a.id).startsWith('reference-EX')).reduce((n,a)=>n+(a.photos?.length||0),0);
  const runtimeLegacySlots=runtimeExamples.filter(a=>String(a.id).startsWith('legacy-A')).reduce((n,a)=>n+(a.photos?.length||0),0);
  if(runtimeExamples.length!==40)throw new Error('Expected 40 runtime reference articles, found '+runtimeExamples.length);
  if(runtimeSlots!==120||runtimeRefSlots!==24||runtimeLegacySlots!==96)throw new Error('Runtime photo plan mismatch: total='+runtimeSlots+', reference='+runtimeRefSlots+', legacy='+runtimeLegacySlots);
  const ly=runtime.window.Woonbi.lastYearMedia;
  const ex1=runtimeExamples.find(a=>a.id==='reference-EX01');
  const lyPhotos=ly?.photosFor?.(ex1,0)||[];
  if(lyPhotos.length!==2||!lyPhotos[0].sourceAsset?.endsWith('sports.webp')||lyPhotos.some(p=>p.lastYearSample!==true))throw new Error('EX01 must resolve to exact last-year sports media.');
  const samplePhotos=ly?.photosFor?.({id:'sample-article-1',title:'학교 기록',category:'학교 이야기',planOrder:1},0)||[];
  if(samplePhotos.length!==2||!samplePhotos[0].sourceAsset?.endsWith('school.webp'))throw new Error('Safe sample lead must resolve to last-year school media.');
  const newsroomText=fs.readFileSync('web/js/newsroom.js','utf8');
  if(!newsroomText.includes("filter(a=>!String(a?.id||'').startsWith('sample-article-'))"))throw new Error('Live newsroom must exclude generic sample-article documents.');
  if(!newsroomText.includes("a.id==='reference-EX01'"))throw new Error('Reference EX01 must remain the visual fallback lead.');
}
console.log('JS syntax, JSON, school API wiring, 40 reference articles, runtime 120 photo slots, exact 10 v0.5 photos, 4 restored WebP assets, and editorial polish: PASS');
