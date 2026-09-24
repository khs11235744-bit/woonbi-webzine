const fs=require('node:fs');
const p=process.argv[2]||'dist-live/school-life.json';
const d=JSON.parse(fs.readFileSync(p,'utf8'));
function assert(x,msg){if(!x)throw new Error(msg);}
assert(d.mode==='live','school-life mode must be live');
assert(/^\d{4}-\d{2}-\d{2}$/.test(d.date||''),'date missing');
assert(typeof d.updatedAtIso==='string'&&d.updatedAtIso.includes('T'),'updatedAtIso missing');
assert(d.providers&&typeof d.providers==='object','providers missing');
for(const key of ['meal','schedule','notice']){
  const x=d[key];
  assert(x&&typeof x==='object',key+' missing');
  assert(typeof x.title==='string'&&x.title.length>0,key+' title missing');
  assert(typeof x.status==='string'&&x.status.length>0,key+' status missing');
  assert(typeof x.body==='string',key+' body missing');
  assert(typeof x.source==='string'&&x.source.length>0,key+' source missing');
  assert(/^https:\/\//.test(x.url||''),key+' url invalid');
  assert(Array.isArray(x.items),key+' items missing');
  if(x.stale)assert(x.status==='이전 정상값',key+' stale status mismatch');
}
assert(d.schedule.items.length<=8,'too many schedule items');
assert(d.notice.items.length<=4,'too many notice items');
console.log('school-life schema/freshness contract: PASS');
