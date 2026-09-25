const {spawnSync}=require('node:child_process');
const steps=[
 ['STATIC','node',['scripts/check.cjs']],
 ['UNIT','cmd.exe',['/d','/c','npm test']],
 ['RULES','cmd.exe',['/d','/c','npm run test:rules']],
 ['DIFF','git',['diff','--check']]
];
let failed=false;
for(const [label,cmd,args] of steps){
 process.stdout.write('\n[DEVCRAFT '+label+']\n');
 const r=spawnSync(cmd,args,{stdio:'inherit',shell:false});
 if(r.status!==0){failed=true;process.stderr.write('[DEVCRAFT '+label+'] FAIL\n');break;}
 process.stdout.write('[DEVCRAFT '+label+'] PASS\n');
}
if(failed)process.exit(1);
console.log('\nDEVCRAFT QUALITY GATE: PASS');
