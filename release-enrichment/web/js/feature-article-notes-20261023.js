/* Student manuscripts remain intact; contextual paragraphs are explicitly labelled editorial supplements. */
(function(){'use strict';const W=window.Woonbi,rows=W?.userManuscripts20261023?.features;if(!rows||W.manuscriptPolish20261023)return;
const get=id=>rows.find(x=>x.id===id);
const happy=get('woonbi-warm-school-pork-2026');
if(happy){
happy.body+='\n\n## 편집부 보강 | 일상의 말과 행동에서 시작하는 예방\n\n학교폭력 예방은 특별한 행사를 진행하는 하루에만 필요한 일이 아니다. 친구가 불편해하는 농담을 멈추는 일, 도움이 필요한 친구에게 관심을 기울이는 일처럼 반복되는 작은 행동이 학교의 분위기를 만든다. 급식과 등교라는 익숙한 학교생활의 장면에 예방 메시지를 연결했다는 점은 이번 캠페인을 생각해 볼 만한 부분이다.\n\n다만 캠페인의 실제 효과나 학생들의 반응을 확인하려면 참여자와 담당자의 추가 취재가 필요하다. 따뜻한 학교의 출발점은 거창한 구호에 머무르지 않고 서로를 존중하는 일상에 있을 것이다.';
happy.editorialUpdateNote='기자 원문은 보존하고 근거가 확인되지 않은 효과 주장은 편집부 해설과 구분함.';
}
const ai=get('woonbi-ai-business-kimdy-20261023');
if(ai){ai.body+='\n\n## 편집부 보강 | 기술의 속도보다 중요한 경영 판단\n\n생성형 AI가 소비자 반응을 빠르게 정리하거나 홍보 문구를 제안할 수 있다고 해도, 어떤 결과를 실제 경영에 사용할지는 사람이 결정해야 한다. 이용자의 개인정보를 적절히 보호하는지, 특정 집단을 부당하게 배제하는지, 사실과 다른 내용을 생성하지는 않았는지 점검할 책임이 있다.\n\n예를 들어 고객별 맞춤 광고를 자동으로 제작하는 일은 기술이 도울 수 있지만, 그 광고가 소비자에게 충분한 정보를 제공하고 있는지는 별개의 문제다. 미래 경영자는 기술을 적용할 상황과 적용하지 말아야 할 상황을 구분할 수 있어야 한다. 따라서 학생 원고의 핵심 주장인 전략적 통찰과 윤리적 리더십은 AI 시대에도 중요한 판단 기준이 된다.';
ai.sourceReferences=[...(ai.sourceReferences||[]),{label:'미국 NIST 생성형 AI 위험관리 자료',url:'https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence'}];}
const pc=get('woonbi-pc-opinion-20261023');
if(pc){pc.body+='\n\n## 편집부 해설 | 가치에 대한 논의와 작품의 완성도는 구별할 수 있다\n\n이 글의 ‘PC는 죽었다’는 표현은 필자가 정치적 올바름의 대중적 이미지를 비평하기 위해 사용한 주장이다. 사회에서 차별을 줄이고 존중을 실천해야 한다는 가치가 객관적으로 소멸했다는 뜻은 아니다. 작품에 사회적 메시지가 담겼다는 이유만으로 서사적 완성도가 낮아지는 것도 아니며, 이야기의 구조를 비판한다고 해서 그 가치 전체를 부정하는 것도 아니다.\n\n어떤 작품의 인물과 갈등이 설득력 있게 그려졌는지, 주제가 사건과 선택 속에서 자연스럽게 드러나는지 개별 사례를 통해 검토할 필요가 있다. 이처럼 가치와 표현 방식을 나누어 읽을 때 논설의 문제 제기도 더 생산적인 토론으로 이어질 수 있다.';
pc.editorialUpdateNote='원래 논지와 편집부의 해설을 구분하여 덧붙임.';}
const seat=get('woonbi-pregnancy-seat-opinion-20261023');
if(seat){seat.body+='\n\n## 편집부 보강 | 제재와 지원, 두 관점을 함께 살피기\n\n이 글은 임산부 배려석의 이용을 의도적으로 방해하는 행위에 대해 보다 실질적인 대응이 필요한지 묻는다. 한편으로는 제재 기준을 정할 때 현실적으로 확인 가능한 행위가 무엇인지, 다른 교통약자의 이용 권리를 어떻게 존중할지에 대한 검토가 요구된다.\n\n임신 초기에는 겉으로 임신 여부를 확인하기 어렵고, 교통약자에게 자신의 상태를 설명하도록 요구하는 것만으로도 부담이 될 수 있다. 따라서 안내 표지 개선과 현장 지원, 갈등을 줄이는 이용 수칙, 고의적인 방해에 대한 대응을 함께 고려해야 한다. 좌석이 있다는 사실뿐 아니라 필요한 사람이 실제로 이용할 수 있는 환경을 만드는 것이 정책의 과제가 될 것이다.';
seat.editorialUpdateNote='원문의 문제의식을 유지하면서 제도의 적용 범위와 교통약자 권리에 관한 설명 보완.';}
const refs=W.researchFeatures2026?.features||[];
const photosFor=(slot)=>refs.find(r=>r.replacesProductionPlanId===slot)?.photos||[];
function attach(target,assets,title,deck,inline=3){
 if(!target)return;
 target.photos=assets.map((x,i)=>({...x,id:'user-'+target.id+'-'+i,caption:'자료사진 · '+x.caption,alt:'자료사진 · '+x.alt,
 after:i<inline?(i===0?-1:i*3):-1,placeholder:false,sample:false}));
 target.photoEssay=true;target.photoEssayInlineCount=Math.min(inline,target.photos.length);
 target.photoEssayTitle=title;target.photoEssayDeck=deck;
}
attach(ai,photosFor('R05').slice(0,6),'AI 시대의 기술과 책임','AI 칩·신경망·서버를 살펴보는 자료사진이며 기사 속 특정 기업과 무관합니다.',3);
attach(pc,photosFor('R08').slice(0,6),'표현과 서사에 관한 자료사진','영상 편집·제작의 자료사진으로 특정 정치적 논쟁이나 작품을 묘사하지 않습니다.',3);
const relevant=[...photosFor('R04').filter(x=>/law-1|law-3|law-5/.test(x.id||x.sourceAsset)),...photosFor('R01').filter(x=>/leadership-4/.test(x.id||x.sourceAsset))].slice(0,4);
attach(seat,relevant,'배려와 권리를 둘러싼 질문','법·사회적 지원과 의사결정을 상징하는 자료사진. 본문의 대중교통 사건과 무관합니다.',2);
/* 2026-10-26: verified event-photo enrichment; original manuscripts and legacy galleries preserved. */
if(happy){
 happy.body+="\n\n## 편집부 현장사진 보강 | 등굣길에 전한 예방 메시지\n\n5월 8일 캠페인의 기록에는 학교 입구에서 현수막과 피켓을 든 학생들의 모습이 담겼다. 피켓에는 ‘관심과 예방으로 학교폭력 제로로!’라는 문구가 적혀 있었다. 등교하는 학생들이 오가는 길목에서 전한 짧은 메시지는 학교폭력 예방을 일상의 말과 행동으로 이어 가자는 뜻을 눈에 보이게 했다.";
 happy.photos=[{"id":"pork-campaign-20260508-3","sourceAsset":"https://firebasestorage.googleapis.com/v0/b/woonbi-webzine-2026.firebasestorage.app/o/public%2Flegacy-enrichment-20261026%2Fpork-3-174700dad1d2.jpg?alt=media&token=6aa0e90a-deac-4b42-a3b3-dd16eec46bde","webPath":"https://firebasestorage.googleapis.com/v0/b/woonbi-webzine-2026.firebasestorage.app/o/public%2Flegacy-enrichment-20261026%2Fpork-3-174700dad1d2.jpg?alt=media&token=6aa0e90a-deac-4b42-a3b3-dd16eec46bde","originalPath":"https://firebasestorage.googleapis.com/v0/b/woonbi-webzine-2026.firebasestorage.app/o/public%2Flegacy-enrichment-20261026%2Fpork-3-174700dad1d2.jpg?alt=media&token=6aa0e90a-deac-4b42-a3b3-dd16eec46bde","caption":"학교 입구에서 ‘멱살 대신 목살’ 현수막을 들고 등교하는 학생들을 맞는 캠페인 참가자들.","alt":"학교 입구에서 ‘멱살 대신 목살’ 현수막을 들고 등교하는 학생들을 맞는 캠페인 참가자들.","after":-1,"credit":"포항고등학교 제공","placeholder":false,"sample":false},{"id":"pork-campaign-20260508-1","sourceAsset":"https://firebasestorage.googleapis.com/v0/b/woonbi-webzine-2026.firebasestorage.app/o/public%2Flegacy-enrichment-20261026%2Fpork-1-f52680e79d09.jpg?alt=media&token=a86efdb3-ccd8-4280-8ee5-bf5521e5991a","webPath":"https://firebasestorage.googleapis.com/v0/b/woonbi-webzine-2026.firebasestorage.app/o/public%2Flegacy-enrichment-20261026%2Fpork-1-f52680e79d09.jpg?alt=media&token=a86efdb3-ccd8-4280-8ee5-bf5521e5991a","originalPath":"https://firebasestorage.googleapis.com/v0/b/woonbi-webzine-2026.firebasestorage.app/o/public%2Flegacy-enrichment-20261026%2Fpork-1-f52680e79d09.jpg?alt=media&token=a86efdb3-ccd8-4280-8ee5-bf5521e5991a","caption":"‘관심과 예방으로 학교폭력 제로로!’ 문구가 적힌 피켓을 든 학생들.","alt":"‘관심과 예방으로 학교폭력 제로로!’ 문구가 적힌 피켓을 든 학생들.","after":3,"credit":"포항고등학교 제공","placeholder":false,"sample":false},{"id":"pork-campaign-20260508-2","sourceAsset":"https://firebasestorage.googleapis.com/v0/b/woonbi-webzine-2026.firebasestorage.app/o/public%2Flegacy-enrichment-20261026%2Fpork-2-891962292292.jpg?alt=media&token=6220d0b1-9d99-4957-990b-9b1183f5e77c","webPath":"https://firebasestorage.googleapis.com/v0/b/woonbi-webzine-2026.firebasestorage.app/o/public%2Flegacy-enrichment-20261026%2Fpork-2-891962292292.jpg?alt=media&token=6220d0b1-9d99-4957-990b-9b1183f5e77c","originalPath":"https://firebasestorage.googleapis.com/v0/b/woonbi-webzine-2026.firebasestorage.app/o/public%2Flegacy-enrichment-20261026%2Fpork-2-891962292292.jpg?alt=media&token=6220d0b1-9d99-4957-990b-9b1183f5e77c","caption":"등굣길에 피켓으로 학교폭력 예방 메시지를 전하는 학생들.","alt":"등굣길에 피켓으로 학교폭력 예방 메시지를 전하는 학생들.","after":-1,"credit":"포항고등학교 제공","placeholder":false,"sample":false}];
 happy.photosPending=false;happy.photoEssay=true;happy.photoEssayInlineCount=2;
 happy.photoEssayTitle='등굣길에 전한 학교폭력 예방 메시지';happy.photoEssayDeck='현수막과 피켓으로 기록한 5월 8일 캠페인';
}
const marathon=get('woonbi-cherry-marathon-2026');
if(marathon)marathon.body+="\n\n배부대에는 물과 음료, 간식이 놓였고, 주변 관람석에는 달리기를 마친 학생들이 앉아 쉬었다. 결승선을 지난 뒤의 풍경까지 사진에 담기며, 달리는 순간뿐 아니라 함께 쉬어 가는 시간도 이날의 기록으로 남았다.";
W.manuscriptPolish20261023={version:'2026-10-23',articles:rows.map(a=>({id:a.id,textLength:a.body.length,photos:a.photos?.length||0}))};
})();
