(()=>{'use strict';
const W=window.WoonbiWorkflow=window.WoonbiWorkflow||{};
const bodyLen=a=>String(a?.body||'').trim().length;
W.bodyReady=a=>bodyLen(a)>=60;
W.photoReady=a=>{
 const photos=a?.photos||[],min=Number(a?.minPhotos||0);
 return photos.length>=min&&!photos.some(p=>p?.sample===true||String(p?.source||'').includes('/sample/'));
};
W.altReady=a=>(a?.photos||[]).every(p=>String(p?.alt||'').trim().length>0);
W.articleAction=function(a,{published=false,today=new Date().toISOString().slice(0,10)}={}){
 const overdue=!!a?.dueDate&&a.dueDate<today&&a.status!=='approved';
 if(overdue)return {key:'overdue',stage:1,priority:100,label:'마감 지남',action:'지금 원고 상태 확인',detail:'마감 '+a.dueDate+' · 승인 전',tone:'danger',actionable:true};
 if(a?.status==='changes')return {key:'changes',stage:3,priority:95,label:'수정 요청',action:'수정 요청부터 반영',detail:'보완 후 다시 제출해야 합니다.',tone:'danger',actionable:true};
 if(!W.bodyReady(a))return {key:'body',stage:1,priority:90,label:'원고 작성',action:'본문 이어 쓰기',detail:'현재 '+bodyLen(a)+'자 · 최소 작성 기준 미달',tone:'warn',actionable:true};
 if(!W.photoReady(a))return {key:'photos',stage:2,priority:82,label:'사진 정리',action:'실제 사진 추가·교체',detail:'사진 '+(a?.photos?.length||0)+'/'+Number(a?.minPhotos||0)+'장',tone:'warn',actionable:true};
 if(!W.altReady(a))return {key:'alt',stage:2,priority:76,label:'사진 설명',action:'대체설명 채우기',detail:'사진을 보지 못해도 이해할 설명이 필요합니다.',tone:'warn',actionable:true};
 if(a?.status==='draft')return {key:'submit',stage:3,priority:68,label:'검토 요청',action:'원고 제출',detail:'원고와 사진이 준비됐습니다.',tone:'next',actionable:true};
 if(a?.status==='submitted')return {key:'waiting',stage:3,priority:35,label:'검토 대기',action:'교사 검토 기다리기',detail:'수정 요청이 오면 다시 열어 고치면 됩니다.',tone:'waiting',actionable:false};
 if(a?.status==='approved'&&!a?.webConsent)return {key:'web-consent',stage:4,priority:50,label:'공개 확인',action:'웹 공개 동의 확인',detail:'승인됐지만 웹 공개 동의가 확인되지 않았습니다.',tone:'next',actionable:true};
 if(a?.status==='approved'&&a?.printConsent){
  const warnings=window.WoonbiMagazine?.preflight?.(a)||[];
  if(warnings.length)return {key:'layout',stage:4,priority:45,label:'조판 확인',action:'잡지 조판 경고 확인',detail:warnings.slice(0,2).join(' · '),tone:'warn',actionable:true};
 }
 if(a?.status==='approved'&&!published)return {key:'publish',stage:4,priority:40,label:'발행 준비',action:'발행 대기',detail:'승인 완료 · 공개 설정 확인',tone:'waiting',actionable:false};
 if(published)return {key:'done',stage:5,priority:0,label:'완료',action:'발행 완료',detail:'웹 발행까지 끝났습니다.',tone:'done',actionable:false};
 return {key:'ready',stage:4,priority:20,label:'편집 완료',action:'조판 확인',detail:'원고와 사진 검토가 끝났습니다.',tone:'done',actionable:false};
};
W.blockers=function(articles=[],publishedIds=new Set(),limit=12){
 return articles.map(a=>({article:a,...W.articleAction(a,{published:publishedIds.has(a.id)})}))
  .filter(x=>x.key!=='done').sort((a,b)=>b.priority-a.priority||(a.article.dueDate||'9999').localeCompare(b.article.dueDate||'9999')).slice(0,limit);
};
W.forUser=function(articles=[],user={}){
 const uid=String(user?.uid||''),name=String(user?.displayName||'').trim();
 const matched=articles.filter(a=>(a.assigneeIds||[]).includes(uid)||(name&&(a.assigneeNames||[]).some(n=>String(n).trim()===name)));
 return matched.length?matched:articles;
};
W.issueStages=function(articles=[],publishedIds=new Set()){
 const total=articles.length||1,writing=articles.filter(W.bodyReady),photos=articles.filter(a=>W.bodyReady(a)&&W.photoReady(a)&&W.altReady(a)),reviewed=articles.filter(a=>a.status==='approved'),printRows=articles.filter(a=>a.status==='approved'&&a.printConsent),layoutReady=printRows.filter(a=>(window.WoonbiMagazine?.preflight?.(a)||[]).length===0),pack=window.WoonbiMagazine?.printPackage?.(printRows,'웅비')||{ready:false,warningCount:0};
 const pct=n=>articles.length?Math.round(n/articles.length*100):0;
 return [
  {id:'writing',no:1,label:'원고',complete:writing.length,total:articles.length,pct:pct(writing.length),note:'본문 60자 이상'},
  {id:'photos',no:2,label:'사진',complete:photos.length,total:articles.length,pct:pct(photos.length),note:'필수 장수·실제 사진·대체설명'},
  {id:'review',no:3,label:'검토',complete:reviewed.length,total:articles.length,pct:pct(reviewed.length),note:'승인 완료'},
  {id:'layout',no:4,label:'조판',complete:layoutReady.length,total:printRows.length,pct:printRows.length?Math.round(layoutReady.length/printRows.length*100):0,note:'인쇄 동의 기사 조판 경고 해소'},
  {id:'print',no:5,label:'인쇄 PASS',complete:pack.ready?1:0,total:1,pct:pack.ready?100:0,note:pack.ready?'인쇄 필수항목 PASS':'인쇄 preflight 확인 필요'}
 ];
};
W.GLOSSARY={
 preflight:'인쇄 전에 빠진 사진·해상도·쪽수 등을 확인하는 최종 점검',
 spread:'책을 펼쳤을 때 마주 보는 왼쪽·오른쪽 두 페이지',
 bleed:'재단할 때 흰 틈이 생기지 않도록 페이지 바깥으로 더 채우는 여유 영역',
 trim:'인쇄 후 실제로 잘라내는 최종 페이지 크기',
 dpi:'인쇄 해상도. 300dpi가 일반적인 인쇄 기준',
 runningHead:'본문 페이지 위쪽에 반복해서 들어가는 호수·섹션 이름',
 folio:'책의 페이지 번호',
 colophon:'발행정보·제작진·저작권을 적는 판권면'
};
})();
