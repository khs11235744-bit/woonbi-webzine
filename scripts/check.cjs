const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
for(const f of fs.readdirSync('web/js').filter(f=>f.endsWith('.js')))cp.execFileSync(process.execPath,['--check',path.join('web/js',f)],{stdio:'inherit'});
for(const f of ['package.json','firebase.json','firebase/firestore.indexes.json','firebase/cors.example.json'])JSON.parse(fs.readFileSync(f,'utf8'));

const referencePath='web/js/reference-data.js';
if(fs.existsSync(referencePath)){
  const text=fs.readFileSync(referencePath,'utf8');
  const ids=[...new Set([...text.matchAll(/reference-EX\d{2}/g)].map(m=>m[0]))];
  if(ids.length!==12)throw new Error('Expected 12 public Woonbi reference articles, found '+ids.length);
  const index=fs.readFileSync('web/index.html','utf8');
  if(!index.includes('js/reference-data.js'))throw new Error('reference-data.js is not loaded by web/index.html');
}
console.log('JS syntax, JSON, and public reference library: PASS');
