(()=>{'use strict';
const W=window.WoonbiMagazine=window.WoonbiMagazine||{};
function editorialPlan(a){return window.Woonbi?.editorialLayout?.plan?.(a)||{type:'news',template:'news-1p',pages:1,label:'SCHOOL NEWS'};}
W.PRINT_PROFILES={
 b5jis:{id:'b5jis',label:'B5/JIS 182×257mm',trimWidthMm:182,trimHeightMm:257,bleedMm:3,safeMm:8,dpi:300},
 a4:{id:'a4',label:'A4 210×297mm',trimWidthMm:210,trimHeightMm:297,bleedMm:3,safeMm:8,dpi:300},
 a5:{id:'a5',label:'A5 148×210mm',trimWidthMm:148,trimHeightMm:210,bleedMm:3,safeMm:7,dpi:300}
};
W.printProfile=function(id='b5jis'){return {...(W.PRINT_PROFILES[id]||W.PRINT_PROFILES.b5jis)};};
W.mmToPx=function(mm,dpi=300){return Math.ceil(Number(mm||0)/25.4*Number(dpi||300));};
W.printRequirements=function(id='b5jis'){
 const p=W.printProfile(id),fullWidthMm=p.trimWidthMm+p.bleedMm*2,fullHeightMm=p.trimHeightMm+p.bleedMm*2;
 return {...p,fullWidthMm,fullHeightMm,trimWidthPx:W.mmToPx(p.trimWidthMm,p.dpi),trimHeightPx:W.mmToPx(p.trimHeightMm,p.dpi),fullWidthPx:W.mmToPx(fullWidthMm,p.dpi),fullHeightPx:W.mmToPx(fullHeightMm,p.dpi)};
};
W.effectiveDpi=function(photo={},widthMm,heightMm){
 const w=Number(photo.width||0),h=Number(photo.height||0);if(!w||!h||!widthMm||!heightMm)return 0;
 return Math.floor(Math.min(w/(widthMm/25.4),h/(heightMm/25.4)));
};
W.coverScore=function(a){
 const p=editorialPlan(a),photos=[...(a.photos||[])],photoRank=x=>Number(x.quality?.overall||0)*100000000+(Number(x.width||0)*Number(x.height||0)),bestPhoto=photos.sort((x,y)=>photoRank(y)-photoRank(x))[0]||null,reasons=[];let score=0;
 if(p.type==='photo'||p.type==='feature'){score+=30;reasons.push('표지형 기사');}
 else if(p.type==='portrait'){score+=18;reasons.push('인물 중심');}
 else if(p.type==='research'){score+=8;reasons.push('탐구 대표성');}
 if(bestPhoto){const mp=(Number(bestPhoto.width||0)*Number(bestPhoto.height||0))/1000000;score+=Math.min(28,mp*5);reasons.push(Math.round(mp*10)/10+'MP 사진');if(Number(bestPhoto.width||0)>=2000)score+=8;if(Number(bestPhoto.quality?.overall)>=70){score+=8;reasons.push('사진 품질 '+bestPhoto.quality.overall+'점');}}
 const title=String(a.title||'');if(title.length>=7&&title.length<=28){score+=12;reasons.push('표지 제목 길이 적합');}else if(title.length<=36)score+=5;
 if(String(a.deck||'').trim())score+=4;if(String(a.body||'').length>900)score+=3;
 return {article:a,plan:p,photo:bestPhoto,score:Math.round(score),reasons};
};
W.preflight=function(a,p=editorialPlan(a)){
 const warnings=[],photos=a.photos||[];
 if(p.type==='photo'&&photos.length<4)warnings.push('사진특집 권장 4장 이상');
 if(p.type==='portrait'&&photos.length<1)warnings.push('인물사진 필요');
 if(p.pages>=4&&photos.length<2)warnings.push('4p 지면 사진 부족');
 if(String(a.title||'').length>34)warnings.push('표제 길이 재검토');
 for(const ph of photos){if(!ph.alt)warnings.push('대체설명 누락');if(Number(ph.width)&&Number(ph.width)<1600)warnings.push('인쇄 해상도 확인');}
 return [...new Set(warnings)];
};
W.buildPlan=function(items,title='웅비 · 2026 편집본'){
 const rows=(items||[]).filter(Boolean),plans=rows.map((a,i)=>({a,i,p:editorialPlan(a)}));
 const contentPages=plans.reduce((n,x)=>n+(Number(x.p.pages)||1),0),printPages=contentPages+4,padded=Math.ceil(printPages/4)*4,counts={};let cursor=1;
 for(const x of plans){counts[x.p.type]=(counts[x.p.type]||0)+1;x.start=cursor;x.end=cursor+(Number(x.p.pages)||1)-1;cursor=x.end+1;x.warnings=W.preflight(x.a,x.p);}
 const warnCount=plans.reduce((n,x)=>n+x.warnings.length,0);
 return {title,rows,plans,contentPages,printPages,padded,counts,warnCount};
};
W.pageMap=function(items,title='웅비 · 2026 편집본'){
 const base=W.buildPlan(items,title),pages=[],seen=new Set();let folio=1,previousType='';
 pages.push({kind:'cover',label:'표지',title,folio:'COVER',type:'cover'});
 pages.push({kind:'contents',label:'목차',title:'이번 호의 차례',folio:'TOC',type:'contents'});
 for(const x of base.plans){
  const type=x.p.type||'news',label=x.p.label||type;
  if(type!==previousType&&!seen.has(type)){
   pages.push({kind:'opener',label,title:label+' SECTION',folio:String(folio++),type});
   seen.add(type);
  }
  for(let i=0;i<(Number(x.p.pages)||1);i++){
   pages.push({kind:'article',label,i,title:x.a.title,articleId:x.a.id,folio:String(folio++),type,template:x.p.template,photoCount:(x.a.photos||[]).length,warnings:x.warnings||[]});
  }
  previousType=type;
 }
 pages.push({kind:'colophon',label:'콜로폰',title:'편집 후기 · 제작진 · 사진 출처',folio:String(folio++),type:'colophon'});
 pages.push({kind:'backcover',label:'뒤표지',title:'우리의 학교, 우리의 기록',folio:'BACK',type:'backcover'});
 while(pages.length%4)pages.splice(pages.length-1,0,{kind:'blank',label:'여백',title:'인쇄 4배수 조정',folio:String(folio++),type:'blank'});
 return {...base,pages,totalSheets:Math.ceil(pages.length/4),mappedPages:pages.length};
};
W.spreadMap=function(items,title='웅비 · 2026 편집본'){
 const map=W.pageMap(items,title),spreads=[];
 if(!map.pages.length)return {...map,spreads};
 spreads.push({kind:'cover',no:0,left:null,right:map.pages[0],label:'앞표지'});
 let i=1,no=1;
 while(i<map.pages.length-1){
  spreads.push({kind:'spread',no,left:map.pages[i]||null,right:map.pages[i+1]||null,label:'펼침 '+no});
  no++;i+=2;
 }
 if(i<map.pages.length)spreads.push({kind:'backcover',no,left:map.pages[i],right:null,label:'뒤표지'});
 return {...map,spreads};
};
W.printPackage=function(items,title='웅비 · 2026 편집본',profileId='b5jis'){
 const profile=W.printRequirements(profileId),map=W.pageMap(items,title),pdfOrder=map.pages.map((p,i)=>({
  order:i+1,kind:p.kind,folio:p.folio,label:p.label,title:p.title||'',articleId:p.articleId||'',template:p.template||'',
  side:i===0?'front-cover':i===map.pages.length-1?'back-cover':i%2===1?'left/verso':'right/recto'
 }));
 const photos=(items||[]).flatMap(a=>(a.photos||[]).map(p=>({article:a,photo:p}))),blankCount=map.pages.filter(p=>p.kind==='blank').length,lowRes=photos.filter(x=>Number(x.photo.width||0)&&Number(x.photo.width||0)<1600),missingCaption=photos.filter(x=>!String(x.photo.caption||'').trim()),missingAlt=photos.filter(x=>!String(x.photo.alt||'').trim()),articleWarnings=map.plans.flatMap(x=>x.warnings.map(w=>({title:x.a.title,warning:w})));
 const covers=(items||[]).map(a=>W.coverScore(a)).sort((a,b)=>b.score-a.score),cover=covers[0]||null,coverDpi=cover?.photo?W.effectiveDpi(cover.photo,profile.fullWidthMm,profile.fullHeightMm):0,checks=[];
 const add=(id,label,severity,detail)=>checks.push({id,label,severity,detail});
 add('pages4','전체 쪽수 4배수',map.pages.length%4===0?'ok':'error',map.pages.length+'면');
 add('articles','수록 기사',map.rows.length?'ok':'error',map.rows.length+'편');
 add('cover','표지 후보',cover?.photo?'ok':'error',cover?.photo?(cover.article.title+' · '+cover.score+'점'):'대표사진 있는 기사 없음');
 add('profile','판형·도련','ok',profile.label+' · 도련 '+profile.bleedMm+'mm · 안전여백 '+profile.safeMm+'mm');
 add('cover300','표지 300dpi',cover?.photo?(coverDpi>=300?'ok':coverDpi>=240?'warn':'error'):'error',cover?.photo?(coverDpi+'dpi · 필요 '+profile.fullWidthPx+'×'+profile.fullHeightPx+'px'):'표지 사진 없음');
 add('lowres','본문 사진 해상도',lowRes.length?'warn':'ok',lowRes.length?lowRes.length+'장 확인 필요':'저해상도 경고 없음');
 add('captions','사진 설명',missingCaption.length?'warn':'ok',missingCaption.length?missingCaption.length+'장 설명 없음':'사진 설명 확인');
 add('alt','대체설명',missingAlt.length?'warn':'ok',missingAlt.length?missingAlt.length+'장 누락':'대체설명 확인');
 add('article-preflight','기사별 조판',articleWarnings.length?'warn':'ok',articleWarnings.length?articleWarnings.length+'건 확인 필요':'기사별 조판 경고 없음');
 add('blank','자동 여백면','ok',blankCount?blankCount+'면 자동 삽입':'추가 여백면 불필요');
 return {...map,profile,pdfOrder,checks,blankCount,cover,coverDpi,ready:checks.every(x=>x.severity!=='error'),warningCount:checks.filter(x=>x.severity==='warn').length};
};
})();
