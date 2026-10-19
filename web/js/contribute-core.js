/* Shared contribution model: no generated quotations, no automatic publication. */
(function(root){
'use strict';
const templates={
 principal:{label:'교장선생님 인터뷰',title:'선생님이 그리는 포항고, 우리가 만들어 갈 학교',questions:[
 '포항고에서 처음 만난 학생들과 학교의 모습 중 가장 기억에 남는 장면은 무엇인가요?',
 '과학교육원과 교육청에서의 경험을 돌아보실 때, 포항고에 부임하신 뒤 새롭게 발견하거나 다시 생각하게 된 점은 무엇인가요?',
 '선생님께서 생각하시는 좋은 학교는 어떤 학교인가요? 학생들이 학교에서 보내는 하루의 모습으로 설명해 주세요.',
 '포항고가 이미 잘하고 있어 지켜 나가고 싶은 점과, 앞으로 가장 먼저 바꾸고 싶은 점을 하나씩 말씀해 주세요.',
 '과학교육 분야의 경험을 포항고의 배움에 어떻게 연결하고 싶으신가요? 과학 분야 진로를 희망하지 않는 학생들에게도 필요한 경험은 무엇일까요?',
 '성적이나 입시 결과로 드러나지 않더라도 학교가 학생에게 길러 주어야 할 중요한 힘은 무엇인가요?',
 '학생이 새로운 일에 도전하다 기대에 못 미치는 결과를 얻었을 때, 학교는 어떻게 도와야 할까요?',
 '학생의 제안이 실제 학교의 변화로 이어지려면 어떤 과정이 필요할까요? 학생들과 함께 논의하고 싶은 주제도 궁금합니다.',
 '졸업생들이 포항고를 어떤 학교로 기억하기를 바라시나요?',
 '선생님도 학창 시절 진로나 성적, 친구 관계 때문에 고민하신 적이 있나요? 그 경험을 바탕으로 지금 학생들에게 한 말씀 부탁드립니다.',
 '올해 포항고 학생들과 꼭 함께 해 보고 싶은 일 한 가지는 무엇인가요?'
 ]},
 viceprincipal:{label:'교감선생님 인터뷰',title:'학생의 하루 가까이에서, 함께 만드는 포항고',questions:[
 '이번 학기 포항고에 오신 뒤 가장 먼저 눈에 들어온 모습과 학생들과 만나며 기억에 남은 순간은 무엇인가요?',
 '학생들의 학교생활과 연결해 교감선생님이 하시는 일을 소개해 주실 수 있을까요?',
 '장학사로 여러 학교와 선생님들을 만나 오신 경험 중 포항고에서도 꼭 실현해 보고 싶은 교육의 모습이 있나요?',
 '포항고 학생들의 일상을 보며 참 좋다고 느낀 점과 더 살펴봐야겠다고 느낀 점은 무엇인가요?',
 '학생들이 고민을 부담 없이 이야기할 수 있는 학교가 되려면 무엇이 필요할까요? 선생님께 직접 이야기하고 싶은 학생은 어떻게 찾아뵈면 좋을까요?',
 '학교 규칙을 정하고 고치는 과정에서 학생의 의견은 어떻게 반영되어야 한다고 생각하시나요?',
 '학생과 선생님, 또는 학생들 사이에 의견이 부딪힐 때 가장 중요하게 생각하시는 해결의 원칙은 무엇인가요?',
 '학생회·동아리·학생 기자단처럼 학생이 직접 기획하고 이끄는 활동을 학교는 어떻게 뒷받침하면 좋을까요?',
 '적극적으로 자신을 드러내는 학생과 조용히 자기 자리를 지키는 학생 모두 존중받고 소속감을 느끼려면 어떤 노력이 필요할까요?',
 '학창 시절 기억에 남는 선생님이나 한마디가 있나요? 그 기억은 지금 학생들을 대하는 방식에 어떤 영향을 주었나요?',
 '이번 학기가 끝날 무렵 어떤 교감선생님으로 기억되고 싶으신가요? 학생들과 함께 해 보고 싶은 일도 말씀해 주세요.'
 ]},
 event:{label:'학교 행사 기사',title:'',questions:[]},
 free:{label:'자유 원고',title:'',questions:[]}
};
const guide={intro:'안녕하세요. 포항고등학교 교지 『웅비』 학생 기자단입니다. 선생님의 교육 철학과 포항고의 미래에 관한 생각을 듣고자 합니다. 편하신 분량으로 답변해 주시고, 직접 겪으신 일이나 구체적인 장면을 함께 들려주시면 감사하겠습니다. 답변 뒤 학생 기자들이 찾아뵙고 이야기를 더 나눌 예정입니다. 교지와 웹진 게재 전에는 편집한 원고를 확인받겠습니다.',done:'답변을 보내 주셔서 감사합니다. 담당 교사가 확인한 뒤 학생 기자단이 후속 인터뷰를 준비하겠습니다. 제출만으로 답변이 공개되지는 않습니다.',followups:['말씀하신 생각을 하게 된 구체적인 경험이 있으신가요?','학생 입장에서는 어떤 변화로 느낄 수 있을까요?','그 일을 시작할 때 가장 먼저 해야 할 일은 무엇인가요?','서로 다른 의견이 있다면 어떤 방식으로 함께 결정하면 좋을까요?','학생들이 직접 맡아 볼 수 있는 역할이 있을까요?'],steps:['방문 전: 답변을 읽고 더 듣고 싶은 대목 3개를 고릅니다. 정확한 직함·경력·부임 시기를 확인합니다.','시작 3분: 인사하고 취재 목적·예상 소요 시간·녹음 여부를 설명하여 동의를 받습니다.','대화 15분: 서면 질문을 전부 반복하지 않고 구체적인 경험과 학생에게 생길 변화를 묻습니다.','마무리 5분: 인용할 핵심 발언과 추가로 전할 말씀을 확인하고 사진 촬영 동의를 구합니다.','기사 작성: 사실과 기자의 해석을 구분하고 최종 원고의 발언·경력을 확인받습니다.']};
const str=v=>String(v??'').trim();
function compose(d){
 const t=templates[d.kind]||templates.free;let body=str(d.body),title=str(d.title)||t.title;
 if(d.kind==='principal'||d.kind==='viceprincipal'){
 body=t.questions.map((q,i)=>str(d.answers?.[i])?`질문 ${i+1}. ${q}\n\n${str(d.answers[i])}`:'').filter(Boolean).join('\n\n');
 if(str(d.extra))body+='\n\n덧붙이는 말씀\n\n'+str(d.extra);
 }else if(d.kind==='event'){
 const f=d.facts||{};body=[str(f.what)?[str(f.when),str(f.where),str(f.what)].filter(Boolean).join(' · '):'',str(f.scene),str(f.detail),str(f.quote)&&str(f.speaker)?`${str(f.speaker)}의 말\n“${str(f.quote)}”`:'',str(f.meaning),str(f.source)?'확인 자료: '+str(f.source):''].filter(Boolean).join('\n\n');title=title||str(f.what);
 }
 return {title,deck:str(d.deck),byline:str(d.byline),body,kind:templates[d.kind]?d.kind:'free'};
}
function validate(a,confirmed){
 if(!a.title||a.title.length>150)throw Error('제목을 1~150자로 적어 주세요.');
 if(!a.byline||a.byline.length>80)throw Error('성함 또는 필자명을 1~80자로 적어 주세요.');
 if(!a.body||a.body.length<60||a.body.length>45000)throw Error('답변 또는 본문을 60~45,000자로 적어 주세요.');
 if((a.deck||'').length>350)throw Error('부제를 350자 안으로 적어 주세요.');
 if(!confirmed)throw Error('담당 교사에게 검토용으로 전달하는 데 동의해 주세요.');
 return a;
}
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function printable(a){return '<!doctype html><html lang="ko"><meta charset="utf-8"><title>'+escape(a.title)+'</title><style>body{font:12pt/1.8 sans-serif;max-width:170mm;margin:20mm auto}p{white-space:pre-wrap}h1{font-size:20pt}@page{size:A4;margin:20mm}</style><h1>'+escape(a.title)+'</h1><p>'+escape(a.byline)+'</p><p>'+escape(a.body)+'</p></html>';}
function articleInput(a,uid){return {title:a.title,deck:a.deck||'',body:a.body,byline:a.byline,category:['principal','viceprincipal'].includes(a.kind)?'학교 사람들':'학교 이야기',assigneeIds:[uid],dueDate:'',minPhotos:0,contentOrigin:'contribution:'+a.id,webConsent:false,printConsent:false};}
const api={templates,guide,compose,validate,printable,articleInput,escape};
if(typeof module==='object'&&module.exports)module.exports=api;else{root.Woonbi=root.Woonbi||{};root.Woonbi.contribute=api;}
})(typeof window!=='undefined'?window:globalThis);
