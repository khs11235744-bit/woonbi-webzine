(function(root){'use strict';
const known=new Set(['65452355-05b5-4c56-bea1-1d6294df40ad','c0da0b77-b1bc-423b-9c12-5ff6df91c4c3','ea8eb469-d471-4471-911f-9dfb7a313ab6','acce3d58-b987-4b67-a547-a4ca8f103c46','64f6c32d-392a-466d-8a80-638c8500e875','b9310dd1-4a75-473b-b910-370e6a7865bd','df14a8ac-7cc9-4576-9a0a-7e56761450f0'].map(x=>'contrib-'+x));
const copy=x=>JSON.parse(JSON.stringify(x));
async function load({listPublic,buildCatalogue,listArticles}){
 const result={items:[],excluded:[],errors:[],complete:false,counts:{articles:0,photos:0,characters:0}};let rows,cat;
 try{rows=await listPublic();if(!Array.isArray(rows))throw Error('공개 기사 응답 형식 오류');cat=buildCatalogue(rows);if(!Array.isArray(cat?.published))throw Error('공개 기사 목록 형식 오류');}catch(e){result.errors.push('기사 불러오기 실패: '+e.message);return result;}
 let privateRows=[];if(listArticles)try{privateRows=await listArticles();}catch(e){result.errors.push('인쇄 동의 확인 실패: '+e.message);}
 const raw=new Map(rows.map(a=>[a.id,a])),priv=new Map(privateRows.map(a=>[a.id,a])),seen=new Set();
 for(const candidate of cat.published){const original=raw.get(candidate.id),a=copy(original?{...candidate,...original}:candidate);let reason='';
 const explicit=original?(original.eventYear??original.year):(a.eventYear??a.year);const year=explicit==null?(known.has(a.id)?2026:null):Number(explicit);
 if(!a.id||/^(sample-|demo-|seed-|legacy-|prod-)/.test(a.id)||a.sample||a.placeholder||a.example||a.draftOnly||a._workingDraft||a._reference||a._planned2026)reason='예시·준비 자료';
 else if(year!==2026)reason=year?'2026년 기사가 아님':'행사 연도 확인 필요';
 else if(a.status&&!['approved','published'].includes(a.status))reason='미발행 원고';
 else if(typeof a.body!=='string'||!a.body.trim())reason='본문 없음';
 if(reason){result.excluded.push({id:a.id,title:a.title||a.id,reason});continue;}
 if(seen.has(a.id))continue;seen.add(a.id);
 const p=priv.get(a.id),confirmed=!!(p&&p.status==='approved'&&p.printConsent===true&&Number(p.revision)===Number(a.sourceRevision));
 a.bookMeta={year:2026,yearBasis:explicit==null?'확인된 2026 행사 기록':'원문 행사 연도',source:original?'published-cms':'published-static',printConsent:confirmed?'confirmed':'pending'};result.items.push(a);
 }
 const rank=a=>a.id==='woonbi-editor-greeting-shinjw-20261023'?0:known.has(a.id)||['narasarang-humanities-20261017','economic-financial-literacy-2026','narasarang-history-goldenbell-20260513','woonbi-cherry-marathon-2026','woonbi-warm-school-pork-2026'].includes(a.id)||['학교 이야기','학교 사람들'].includes(a.category)?1:2;result.items.sort((a,b)=>rank(a)-rank(b));
 if(rows.length>=100)result.errors.push('공개 기사 조회 한도에 도달했습니다. 전체 목록 확인이 필요합니다.');result.complete=rows.length<100;result.counts={articles:result.items.length,photos:result.items.reduce((s,a)=>s+(a.photos||[]).length,0),characters:result.items.reduce((s,a)=>s+a.body.length,0)};return result;
}
function snapshot(result,title){return copy({schemaVersion:1,previewOnly:true,year:2026,title:title||'웅비 · 2026 A4 편집 초안',createdAt:new Date().toISOString(),items:result.items,excluded:result.excluded,errors:result.errors,complete:result.complete,layout:{}});}
function safePhotoPath(path){if(typeof path!=='string'||path.includes('..')||path.includes('\\'))return false;if(/^(assets\/|public\/)/.test(path))return !path.includes('%')&&!path.includes('?')&&!path.includes('#');try{const u=new URL(path),prefix='/v0/b/woonbi-webzine-2026.firebasestorage.app/o/';return u.protocol==='https:'&&u.hostname==='firebasestorage.googleapis.com'&&!u.port&&!u.username&&!u.password&&u.pathname.startsWith(prefix)&&decodeURIComponent(u.pathname.slice(prefix.length)).startsWith('public/')&&!decodeURIComponent(u.pathname).includes('..');}catch{return false;}}
function parse(text){if(text.length>10000000)throw Error('초안 파일이 너무 큽니다.');const s=JSON.parse(text);if(s.schemaVersion!==1||s.previewOnly!==true||s.year!==2026||!Array.isArray(s.items)||s.items.length>100||typeof s.title!=='string')throw Error('2026 비공개 책 초안 형식이 아닙니다.');const ids=new Set();for(const a of s.items){if(!a.id||ids.has(a.id)||typeof a.body!=='string'||!Array.isArray(a.photos))throw Error('중복 기사 또는 잘못된 본문·사진 형식');if((a.year!=null&&Number(a.year)!==2026)||/^(sample-|demo-|seed-|legacy-|prod-)/.test(a.id)||a.sample||a.placeholder||a.example||a.draftOnly||a._workingDraft||a._reference||a._planned2026)throw Error('2026 공개 기사만 초안에 포함할 수 있습니다.');ids.add(a.id);for(const p of a.photos){for(const k of ['sourceAsset','webPath','originalPath','url','src'])if(p[k]&&!safePhotoPath(p[k]))throw Error('허용되지 않은 사진 경로');}a.bookMeta={...(a.bookMeta||{}),printConsent:'pending'};}s.layout=s.layout&&typeof s.layout==='object'?s.layout:{};return s;}
const api={load,snapshot,parse};if(typeof module!=='undefined')module.exports=api;else(root.Woonbi||(root.Woonbi={})).bookSource2026=api;
})(typeof window==='undefined'?globalThis:window);
