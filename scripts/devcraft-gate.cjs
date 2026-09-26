const {spawnSync}=require('node:child_process');

function npmArgs(args){
  if(process.platform==='win32')return ['cmd.exe',['/d','/c','npm',...args]];
  return ['npm',args];
}
const full=process.argv.includes('--full');
const unit=npmArgs(['test']),rules=npmArgs(['run','test:rules']);
const steps=[
 ['STATIC','node',['scripts/check.cjs']],
 ['UNIT',unit[0],unit[1]],
 ...(full?[['RULES',rules[0],rules[1]]]:[]),
 ['DIFF','git',['diff','--check']]
];
for(const [label,cmd,args] of steps){
 process.stdout.write('\n[DEVCRAFT '+label+']\n');
 const r=spawnSync(cmd,args,{stdio:'inherit',shell:false});
 if(r.error){console.error('[DEVCRAFT '+label+'] ERROR',r.error.message);process.exit(1);}
 if(r.status!==0){console.error('[DEVCRAFT '+label+'] FAIL');process.exit(r.status||1);}
 console.log('[DEVCRAFT '+label+'] PASS');
}
console.log('\nDEVCRAFT QUALITY GATE: PASS'+(full?' · FULL':' · FAST'));
