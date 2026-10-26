/* WOONBI 2026: real school reporting and its photographs lead the public cover. */
(function(){
 'use strict';
 const W=window.Woonbi=window.Woonbi||{};
 // These published event reports use the broad 특집 category, not generic features.
 const schoolReportIds=new Set(['narasarang-humanities-20261017','narasarang-history-goldenbell-20260513','economic-financial-literacy-2026','contrib-65452355-05b5-4c56-bea1-1d6294df40ad','contrib-ea8eb469-d471-4471-911f-9dfb7a313ab6','contrib-c0da0b77-b1bc-423b-9c12-5ff6df91c4c3','contrib-acce3d58-b987-4b67-a547-a4ca8f103c46','contrib-df14a8ac-7cc9-4576-9a0a-7e56761450f0','contrib-64f6c32d-392a-466d-8a80-638c8500e875','contrib-b9310dd1-4a75-473b-b910-370e6a7865bd']);
 function time(value){
   if(typeof value==='number'&&Number.isFinite(value))return value<1e11?value*1000:value;
   if(value&&typeof value.toMillis==='function')return value.toMillis();
   if(value&&typeof value.seconds==='number')return value.seconds*1000;
   const n=Date.parse(String(value||''));return Number.isFinite(n)?n:0;
 }
 function isHidden(a){
   if(!a)return false;
   if(String(a.year)==='2025'||String(a.archiveYear)==='2025')return true;
   if(/(?:^|\D)2025(?:\D|$)/.test(String(a.archiveLabel||'')))return true;
   // An explicit edition year takes precedence over a re-publication timestamp.
   return !a.year&&time(a.publishedAt)>0&&new Date(time(a.publishedAt)).getUTCFullYear()===2025;
 }
 const isPublished=a=>!!(a&&a.id&&time(a.publishedAt)>0&&!a.sample&&!a.draftOnly&&!a._workingDraft&&!a._reference&&!isHidden(a));
 const isSchoolReport=a=>!!a&&a.planKind!=='research'&&(schoolReportIds.has(a.id)||['학교 이야기','학교 사람들'].includes(a.category));
 function hasCoverPhoto(a){
   const p=a?.photos?.[0],src=p&&(p.sourceAsset||p.webPath||p.originalPath||'');
   return !!(src&&!p.placeholder&&!p.sample&&!p.lastYearSample&&!p.restored&&!String(src).startsWith('seed/'));
 }
 function rank(a){return !isPublished(a)?3:isSchoolReport(a)?(hasCoverPhoto(a)?0:1):2;}
 function order(rows){return (rows||[]).filter(a=>a&&!isHidden(a)).slice().sort((a,b)=>rank(a)-rank(b)||time(b.publishedAt)-time(a.publishedAt)||String(a.id||'').localeCompare(String(b.id||'')));}
 function select(rows){const published=order(rows).filter(isPublished);return {lead:published[0]||null,featured:false,published};}
 W.homeLead2026={select,order,isHidden,isPublished,isSchoolReport,hasCoverPhoto};
})();
