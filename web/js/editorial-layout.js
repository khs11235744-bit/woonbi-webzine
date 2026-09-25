/* Woonbi editorial treatment. One content model drives web rhythm and future print layouts. */
(function(){'use strict';
const W=window.Woonbi=window.Woonbi||{};
const textOf=a=>[(a?.title||''),(a?.headline||''),(a?.deck||''),(a?.category||''),(a?.planKind||'')].join(' ');
function treatment(a={}){
 const t=textOf(a),category=String(a.category||''),kind=String(a.planKind||'');
 if(category==='사진과 기록'||/사진|장면|풍경|벚꽃|운동장|축제|공연|마라톤|체육/.test(t))return'photo';
 if(category==='학교 사람들'||/인터뷰|선생|교사|졸업생|사람|한마디|대화/.test(t))return'portrait';
 if(kind==='research'||category.includes('탐구')||/탐구|실험|설문|데이터|분석|왜 |어떻게|성적표|인공지능|과학|리더|처벌|교화|전선|전기|교실의 빛/.test(t))return'research';
 if(category==='학생 글'||/에세이|수필|기억|편지|(^|\s)시(\s|$)|소설|감상|비평/.test(t))return'essay';
 if(category==='특집'||/특집|기획|다시 만드는|뜨거웠던 하루|명절|교류/.test(t))return'feature';
 return'news';
}
const magazineMap={
 photo:{template:'photo-4p',pages:4,leadImage:'full-bleed',columns:1,label:'PHOTO ESSAY'},
 portrait:{template:'portrait-2p',pages:2,leadImage:'portrait',columns:2,label:'PEOPLE'},
 research:{template:'research-2p',pages:2,leadImage:'evidence',columns:2,label:'INQUIRY'},
 essay:{template:'essay-1p',pages:1,leadImage:'optional',columns:1,label:'ESSAY'},
 feature:{template:'feature-4p',pages:4,leadImage:'spread',columns:3,label:'FEATURE'},
 news:{template:'news-1p',pages:1,leadImage:'landscape',columns:2,label:'SCHOOL NEWS'}
};
function plan(a={}){
 const type=treatment(a),base=magazineMap[type];
 const photos=Array.isArray(a.photos)?a.photos.length:0,body=String(a.body||'');
 const long=body.length>3200,photoHeavy=photos>=5;
 let pages=base.pages,template=base.template;
 if(type==='news'&&long){pages=2;template='news-2p';}
 if(type==='research'&&photoHeavy){pages=4;template='research-4p';}
 if(type==='essay'&&long){pages=2;template='essay-2p';}
 return {...base,type,pages,template,photoHeavy,long};
}
function cardLabel(a){const p=plan(a);return p.label;}
W.editorialLayout={treatment,plan,cardLabel,magazineMap};
})();