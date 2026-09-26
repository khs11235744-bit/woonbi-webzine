(()=>{'use strict';
const W=window.WoonbiPhotoEditor=window.WoonbiPhotoEditor||{};
W.health=function(photos=[]){
 const missingCaption=photos.filter(p=>!String(p.caption||'').trim()).length;
 const missingAlt=photos.filter(p=>!String(p.alt||'').trim()).length;
 const lowRes=photos.filter(p=>Number(p.width||0)&&Number(p.width||0)<1600).length;
 return {missingCaption,missingAlt,lowRes,ok:photos.length>0&&!missingAlt&&!lowRes};
};
W.quality=function(p={}){
 const width=Number(p.width||0);
 if(width>=2400)return {label:'인쇄용 충분',level:'ok'};
 if(width>=1600)return {label:'웹 충분 · 인쇄 확인',level:'check'};
 if(width>0)return {label:'저해상도 · 교체 권장',level:'warn'};
 return {label:'해상도 미확인',level:'check'};
};
W.bestLeadId=function(article={}){
 const photos=article.photos||[];if(!photos.length)return '';
 const scored=window.WoonbiMagazine?.coverScore?.(article)?.photo;
 if(scored?.id)return scored.id;
 return [...photos].sort((a,b)=>(Number(b.width||0)*Number(b.height||0))-(Number(a.width||0)*Number(a.height||0)))[0]?.id||'';
};
W.role=function(index){return index===0?'대표사진':'본문 '+index;};
})();
