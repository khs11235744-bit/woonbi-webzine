const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
for(const f of fs.readdirSync('web/js').filter(f=>f.endsWith('.js')))cp.execFileSync(process.execPath,['--check',path.join('web/js',f)],{stdio:'inherit'});
cp.execFileSync(process.execPath,['--check','scripts/fetch-school-life.mjs'],{stdio:'inherit'});
for(const f of ['package.json','firebase.json','firebase/firestore.indexes.json','firebase/cors.example.json'])JSON.parse(fs.readFileSync(f,'utf8'));

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
  const legacy=JSON.parse(fs.readFileSync('web/assets/legacy-plan/index.json','utf8'));
  if(legacy.count!==96||legacy.items?.length!==96)throw new Error('Expected 96 legacy plan placeholder assets.');
}
console.log('JS syntax, JSON, public reference libraries, and 18 production legacy links: PASS');
