/* Source-independent newsroom checks. A warning is NOT factual verification. */
(function(root){'use strict';
const E={
 normalize:s=>String(s||'').normalize('NFC').replace(/\s+/g,'').toLocaleLowerCase('ko'),
 readingMinutes:s=>Math.max(1,Math.ceil(String(s||'').replace(/\s/g,'').length/500)),
 sample:p=>p?.placeholder===true||String(p?.webPath||'').startsWith('seed/'),
 preflight(a){const out=[];const photos=a.photos||[];
  if(photos.some(E.sample))out.push({code:'sample',severity:'block',text:'교체용 예시 사진을 실제 사진으로 바꾸거나 빼 주세요.'});
  if(photos.some(p=>!String(p.alt||'').trim()))out.push({code:'alt',severity:'block',text:'사진 대체 설명이 비어 있습니다.'});
  if(photos.some(p=>!String(p.caption||'').trim()))out.push({code:'caption',severity:'warn',text:'사진 설명에 언제·어디서·무엇인지 적어 주세요.'});
  if(photos.some(p=>p.width&&p.width/ (150/25.4)<240))out.push({code:'print-resolution',severity:'warn',text:'일부 사진은 폭 150mm·240ppi 기준에 못 미칩니다. 실제 인쇄 크기에 맞춰 확인하세요.'});
  if(String(a.title||'').length>65)out.push({code:'headline',severity:'warn',text:'제목이 깁니다. 핵심을 제목에 두고 설명은 부제로 옮겨 보세요.'});
  if(/\[(?:확인|입력|추후|미정)[^\]]*\]|TBD|TODO/i.test(a.body||''))out.push({code:'unresolved',severity:'warn',text:'본문에 확인·입력 메모가 남아 있습니다.'});
  if(String(a.body||'').split(/\n\s*\n/).some(p=>p.length>1000))out.push({code:'paragraph',severity:'warn',text:'긴 문단을 확인하세요. 내용이 바뀌는 지점에서 나눌 수 있습니다.'});
  return out;
 },
 replace(old,next){return {...next,after:old.after,caption:E.sample(old)?'':old.caption,placeholder:false};},
 signature(bytes){const b=new Uint8Array(bytes);if(b.length<12)return '';if(b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if([137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v))return 'image/png';
 if(String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'image/webp';return '';},
 sort(rows,mode){return [...rows].sort((a,b)=>mode==='title'?a.title.localeCompare(b.title,'ko'):mode==='updated'?String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')):(a.planOrder||999)-(b.planOrder||999));},
 replaceCount:rows=>rows.filter(a=>(a.photos||[]).some(E.sample)).length
};root.Woonbi=root.Woonbi||{};root.Woonbi.editorial=E;if(typeof module!=='undefined')module.exports=E;
})(typeof globalThis!=='undefined'?globalThis:this);
