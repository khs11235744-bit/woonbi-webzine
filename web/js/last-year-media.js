/* Public-safe last-year sample media restored byte-for-byte from Woonbi v0.5. */
(function(){
'use strict';
const W=window.Woonbi=window.Woonbi||{};
const media={
 school:{path:'assets/media/school.webp',width:1200,height:477,bytes:84218,label:'지난 호 학교 자료사진',focus:'50% 48%'},
 sports:{path:'assets/media/sports.webp',width:1200,height:325,bytes:82854,label:'지난 호 체육·활동 자료사진',focus:'50% 46%'},
 marathon:{path:'assets/media/marathon.webp',width:1200,height:470,bytes:58128,label:'지난 호 마라톤 자료사진',focus:'50% 44%'},
 busking:{path:'assets/media/busking.webp',width:666,height:502,bytes:42174,label:'지난 호 공연·문화 자료사진',focus:'50% 42%'},
 trip:{path:'assets/media/trip.webp',width:643,height:387,bytes:25794,label:'지난 호 기행 자료사진',focus:'50% 46%'},
 camp:{path:'assets/media/camp.webp',width:668,height:379,bytes:13126,label:'지난 호 캠프·활동 자료사진',focus:'50% 45%'},
 exchange:{path:'assets/media/exchange.webp',width:1200,height:470,bytes:81254,label:'지난 호 국제교류 자료사진',focus:'50% 45%'},
 library:{path:'assets/media/library.webp',width:633,height:850,bytes:115868,label:'지난 호 도서·인터뷰 자료사진',focus:'50% 38%'},
 science:{path:'assets/media/science.webp',width:1200,height:616,bytes:48864,label:'지난 호 과학·탐구 자료사진',focus:'50% 46%'},
 memories:{path:'assets/media/memories.webp',width:669,height:552,bytes:83564,label:'지난 호 학교생활 자료사진',focus:'50% 45%'}
};
const order=['school','sports','marathon','busking','trip','camp','exchange','library','science','memories'];
const explicit={
 'reference-EX01':'sports','reference-EX02':'exchange','reference-EX03':'school','reference-EX04':'marathon',
 'reference-EX05':'library','reference-EX06':'trip','reference-EX07':'camp','reference-EX08':'memories',
 'reference-EX09':'school','reference-EX10':'science','reference-EX11':'busking','reference-EX12':'trip',
 'sample-article-1':'school','sample-article-2':'science','sample-article-3':'library'
};
const hints=[
 [/체육|스포츠|농구|운동회|축구|야구|배구/,'sports'],
 [/마라톤|달리기|걷기/,'marathon'],
 [/골든벨|독립운동|기념비|독도|역사|기행|답사|수학여행/,'trip'],
 [/급식|로봇|전력|과학|실험|공학|물리|화학|생명|탐구/,'science'],
 [/국제|교류|문화|명절|일본|중국|영어/,'exchange'],
 [/인터뷰|도서|독서|도서관|인공지능|진로|상담|교사/,'library'],
 [/힐링|세계|무대|게임|공연|버스킹|음악|축제/,'busking'],
 [/캠프|수련|야영|리더십/,'camp'],
 [/공간|건물|건축|집중|교실|학교/,'school']
];
function pick(a,index){
 const text=(a.title||'')+' '+(a.headline||'')+' '+(a.sourceTitle||'')+' '+(a.category||'');
 return explicit[a.id]||hints.find(([r])=>r.test(text))?.[1]||order[index%order.length];
}
function photo(a,key,i){
 const m=media[key],id='last-year-'+String(a.id||'example').replace(/[^a-zA-Z0-9_-]/g,'-')+'-'+i,path='seed/last-year/'+String(a.id||'example')+'/'+id;
 return {id,webPath:path,originalPath:path,sourceAsset:m.path,placeholder:true,lastYearSample:true,credit:'포항고 웅비 지난 호',caption:m.label+' · 현재 기사 현장 아님',alt:'교체용 지난 호 '+key+' 자료사진. 현재 기사 현장이 아닙니다.',after:i===0?-1:0,width:m.width,height:m.height,focus:m.focus||'50% 50%',originalBytes:m.bytes,originalType:'image/webp'};
}
function photosFor(a,index=0){
 const key=pick(a,index),second=order[(order.indexOf(key)+3+(index%3))%order.length];
 return [photo(a,key,0),photo(a,second,1)];
}
function apply(rows){
 return (rows||[]).map((a,index)=>{
  // Only the 12 finished reference examples receive last-year media.
  // Legacy A01-A28 must keep their original 96-slot photo plan exactly, including zero-slot articles.
  if(!String(a.id||'').startsWith('reference-EX'))return a;
  if(Array.isArray(a.photos)&&a.photos.length)return a;
  return {...a,photos:photosFor(a,index)};
 });
}
W.lastYearMedia={
 media,order,apply,photosFor,photoForKey:(a,key,i=0)=>photo(a,key,i),
 showcase:order.map(key=>({key,src:media[key].path,caption:media[key].label,width:media[key].width,height:media[key].height}))
};
if(W.newsroomData?.examples)W.newsroomData={...W.newsroomData,examples:apply(W.newsroomData.examples)};
})();
