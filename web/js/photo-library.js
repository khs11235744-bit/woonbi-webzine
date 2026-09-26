(()=>{'use strict';
const W=window.WoonbiPhotoLibrary=window.WoonbiPhotoLibrary||{};
W.tokens=function(value){return [...new Set((String(value||'').normalize('NFC').toLocaleLowerCase('ko').match(/[가-힣a-z0-9]{2,}/g)||[]).filter(x=>!/^(img|image|photo|사진|촬영|kakao|screen|screenshot|dcim|camera|jpeg|jpg|png|webp|dsc|pxl|mvimg|download)$/.test(x)))];};
W.scoreArticle=function(row,a){const photoTokens=W.tokens,fileTokens=new Set(photoTokens(row.path+' '+row.name)),articleTokens=photoTokens([a.title,a.sourceTitle,a.category,a.byline,...(a.assigneeNames||[])].join(' '));let score=0,hits=[];for(const t of articleTokens){if(fileTokens.has(t)){const w=(a.assigneeNames||[]).some(n=>photoTokens(n).includes(t))?6:t.length>=4?4:2;score+=w;hits.push(t);}}const norm=s=>String(s||'').normalize('NFC').toLocaleLowerCase('ko'),compact=s=>norm(s).replace(/[^가-힣a-z0-9]+/g,'');const normPath=norm(row.path);for(const n of a.assigneeNames||[]){const x=norm(n).trim();if(x&&normPath.includes(x)){score+=8;hits.push(n);}}const titleNorm=compact(a.title);if(titleNorm.length>=4&&compact(row.path).includes(titleNorm.slice(0,Math.min(8,titleNorm.length))))score+=10;const articleCompacts=[a.title,a.sourceTitle,a.category,a.byline,...(a.assigneeNames||[])].map(compact).filter(Boolean);for(const ft of fileTokens){if(ft.length<4)continue;const fc=compact(ft);if(fc.length<4)continue;for(const ac of articleCompacts){if(ac.length>=4&&(ac.includes(fc)||fc.includes(ac))){score+=Math.min(10,4+Math.floor(Math.min(fc.length,ac.length)/2));hits.push(ft);break;}}}return {score,hits:[...new Set(hits)]};};
W.hashDistance=function(a,b){if(!a||!b||a.length!==b.length)return 99;let n=0;for(let i=0;i<a.length;i++){let x=parseInt(a[i],16)^parseInt(b[i],16);while(x){n+=x&1;x>>=1;}}return n;};
W.colorDistance=function(a,b){if(!a||!b)return 999;return Math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2);};
W.libraryMeta=function(row,articles){const raw=String(row.path+' '+row.name).normalize('NFC'),compact=raw.toLocaleLowerCase('ko').replace(/\s+/g,'');const dm=raw.match(/(20\d{2})[._-]?(\d{1,2})[._-]?(\d{1,2})/),fallback=row.lastModified?new Date(row.lastModified):null;const date=dm?dm[1]+'-'+String(dm[2]).padStart(2,'0')+'-'+String(dm[3]).padStart(2,'0'):(fallback&&!Number.isNaN(fallback.getTime())?fallback.toISOString().slice(0,10):'날짜 미상');const defs=[['체육대회',['체육대회','체육','운동회']],['축제·공연',['축제','공연','버스킹','무대']],['수학여행·기행',['수학여행','기행','답사','여행']],['마라톤',['마라톤']],['교류',['교류','exchange']],['과학·탐구',['과학','탐구','실험','r&e','rne']],['도서관·독서',['도서관','독서','책']],['벚꽃·학교풍경',['벚꽃','풍경','교정']],['동아리',['동아리','club']],['수업·행사',['공개수업','수업','특강','골든벨']]];const events=defs.filter(([,keys])=>keys.some(k=>compact.includes(k.replace(/\s+/g,'')))).map(([label])=>label);const article=articles.find(a=>a.id===row.articleId)||null,people=[];for(const a of articles)for(const n of (a.assigneeNames||[])){const x=String(n||'').trim();if(x&&compact.includes(x.replace(/\s+/g,'').toLocaleLowerCase('ko'))&&!people.includes(x))people.push(x);}if(article)for(const n of (article.assigneeNames||[])){const x=String(n||'').trim();if(x&&!people.includes(x))people.push(x);}return {date,events:events.slice(0,3),article:article?.title||'',people:people.slice(0,5)};};
W.similarityClusters=function(rows=[]){
 const byName=new Map(rows.map(r=>[r.name,r])),parent=new Map(rows.map(r=>[r.key,r.key]));
 const root=k=>{let p=parent.get(k)||k;while(parent.get(p)&&parent.get(p)!==p)p=parent.get(p);let q=k;while(parent.get(q)&&parent.get(q)!==p){const n=parent.get(q);parent.set(q,p);q=n;}return p;};
 const join=(a,b)=>{const ra=root(a),rb=root(b);if(ra!==rb)parent.set(rb,ra);};
 for(const r of rows){for(const name of [r.duplicateOf,r.nearDuplicateOf]){const other=name&&byName.get(name);if(other)join(r.key,other.key);}}
 const groups=new Map();for(const r of rows){const k=root(r.key);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
 return [...groups.values()].filter(g=>g.length>1).sort((a,b)=>b.length-a.length);
};
W.bestRow=function(group=[]){
 const score=r=>{
  const area=Number(r.width||0)*Number(r.height||0),mp=area/1000000,match=Number(r.score||0),bytes=Math.min(8,Number(r.size||0)/1024/1024),quality=Number(r.quality?.overall||0);
  const dupPenalty=r.duplicateOf?18:r.nearDuplicateOf?6:0;
  return mp*6+match*1.25+bytes+quality*.65-dupPenalty;
 };
 return [...group].sort((a,b)=>score(b)-score(a)||Number(b.lastModified||0)-Number(a.lastModified||0))[0]||null;
};
})();
