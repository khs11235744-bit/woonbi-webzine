const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
for(const f of fs.readdirSync('web/js').filter(f=>f.endsWith('.js')))cp.execFileSync(process.execPath,['--check',path.join('web/js',f)],{stdio:'inherit'});
for(const f of ['package.json','firebase.json','firebase/firestore.indexes.json','firebase/cors.example.json'])JSON.parse(fs.readFileSync(f,'utf8'));
console.log('JS syntax and JSON: PASS');
