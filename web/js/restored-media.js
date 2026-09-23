/* Public web-safe media restored from the user's earlier Woonbi package. */
(function(){
'use strict';
const W=window.Woonbi=window.Woonbi||{};
const photo=(id,sourceAsset,caption,alt,width,height)=>({
  id,sourceAsset,webPath:'restored/'+id,originalPath:'restored/'+id,
  caption,alt,after:-1,width,height,originalBytes:1,originalType:'image/webp',
  restored:true,placeholder:false
});
W.restoredMedia={
  byArticle:{
    'A-2026-002':[
      photo('restored-a2026-002','assets/restored/article-a2026-002.webp','기존 웅비 패키지에서 복원한 인물 자료사진','기존 웅비 패키지의 인물 자료사진',1352,1600)
    ],
    'A-2026-023':[
      photo('restored-a2026-023-1','assets/restored/synergy-01.webp','8월 시너지 활동 보고서에 포함된 자료 화면','시너지 활동 보고서 자료 화면 1',1488,985),
      photo('restored-a2026-023-2','assets/restored/synergy-02.webp','8월 시너지 활동 보고서에 포함된 자료 화면','시너지 활동 보고서 자료 화면 2',1485,986)
    ]
  },
  showcase:[
    {id:'cover',src:'assets/restored/cover-art.webp',caption:'기존 웅비 패키지 표지 시안',note:'표지·레이아웃 실험 자료',width:1600,height:842},
    {id:'portrait',src:'assets/restored/article-a2026-002.webp',caption:'인물 자료사진',note:'이전 원고에 포함된 인물 자료사진',width:1352,height:1600},
    {id:'synergy-1',src:'assets/restored/synergy-01.webp',caption:'시너지 활동 보고서 자료 화면',note:'시너지 활동 보고서에 포함된 자료 화면',width:1488,height:985},
    {id:'synergy-2',src:'assets/restored/synergy-02.webp',caption:'시너지 활동 보고서 자료 화면',note:'시너지 활동 보고서에 포함된 자료 화면',width:1485,height:986}
  ]
};
})();