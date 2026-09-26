(()=>{'use strict';
const W=window.WoonbiMagazine=window.WoonbiMagazine||{};
function editorialPlan(a){return window.Woonbi?.editorialLayout?.plan?.(a)||{type:'news',template:'news-1p',pages:1,label:'SCHOOL NEWS'};}
W.coverScore=function(a){
 const p=editorialPlan(a),photos=[...(a.photos||[])],bestPhoto=photos.sort((x,y)=>(Number(y.width||0)*Number(y.height||0))-(Number(x.width||0)*Number(x.height||0)))[0]||null,reasons=[];let score=0;
 if(p.type==='photo'||p.type==='feature'){score+=30;reasons.push('표지형 기사');}
 else if(p.type==='portrait'){score+=18;reasons.push('인물 중심');}
 else if(p.type==='research'){score+=8;reasons.push('탐구 대표성');}
 if(bestPhoto){const mp=(Number(bestPhoto.width||0)*Number(bestPhoto.height||0))/1000000;score+=Math.min(28,mp*5);reasons.push(Math.round(mp*10)/10+'MP 사진');if(Number(bestPhoto.width||0)>=2000)score+=8;}
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
})();
