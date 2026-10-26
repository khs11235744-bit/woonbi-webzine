/* Shared contribution model: no generated quotations, no automatic publication. */
(function(root){
'use strict';
const templates={
 principal:{label:'교장선생님 인터뷰',title:'전통 위에서 미래를 그리다 — 포항고의 오늘과 내일',questions:["교장선생님께서 생각하시는 ‘좋은 학교’란 어떤 학교인가요? 오랜 교육 경험 속에서 가장 중요하게 생각해 오신 가치와 교육철학을 들려주세요.","포항고등학교에서 특별하게 느끼신 전통과 문화, 학생들의 강점은 무엇인가요? 학교를 처음 바라보셨을 때 인상 깊었던 모습도 궁금합니다.","앞으로 포항고등학교가 어떤 학교로 성장하기를 바라시나요? 지켜 나갈 전통과 새롭게 시도하고 싶은 변화, 학교의 미래 비전을 말씀해 주세요.","인공지능과 디지털 기술이 발전하는 시대에 학교가 학생들에게 길러 주어야 할 역량은 무엇인가요? 사고력·인문학적 소양·공동체 의식과의 균형도 궁금합니다.","입시와 성적 못지않게 고등학생들이 소중하게 여겨야 할 가치는 무엇일까요? 학생들이 학교생활에서 경험하고 성장하길 바라는 모습을 들려주세요.","탐구활동·동아리·봉사·문화예술·학생 언론 등 학생 주도 활동을 어떻게 바라보시나요? 학생들의 제안이 실제 학교의 변화로 이어지려면 무엇이 필요할까요?","학교생활을 지켜보시거나 학생들과 만나는 과정에서 특히 기억에 남는 순간이 있으신가요? 작지만 따뜻했던 장면도 좋습니다.","포항고등학교 학생들에게 꼭 전하고 싶은 말씀이 있다면 부탁드립니다. 졸업 뒤 학생들이 포항고를 어떤 학교로 기억하길 바라시는지도 궁금합니다.","【선택】 교장선생님의 학창 시절은 어떤 모습이었나요? 당시의 고민이나 추억 중 지금 학생들과 나누고 싶은 이야기가 있으신가요?","【선택】 즐겨 읽는 책, 감명 깊게 본 영화, 마음에 간직한 문장이 있다면 소개해 주실 수 있을까요? 그 작품이나 문장이 특별한 이유도 궁금합니다.","【선택】 교직 생활에서 가장 보람 있었던 순간이나 지금까지 마음에 남는 가르침은 무엇인가요? 올해 학생들과 꼭 함께 해 보고 싶은 일도 좋습니다."]},
 viceprincipal:{label:'교감선생님 인터뷰',title:'학생의 하루 가까이에서, 함께 만드는 포항고',questions:["교감선생님께서 생각하시는 ‘좋은 학교’란 어떤 학교인가요? 학생·교직원·학부모가 서로 신뢰하며 소통하는 학교의 모습을 들려주세요.","포항고에 오신 뒤 학생들과 학교생활에서 특별하게 느끼신 강점은 무엇인가요? 처음 만났을 때 기억에 남는 모습도 궁금합니다.","학교 운영에서 가장 중요하게 생각하는 원칙은 무엇인가요? 여러 학교와 교육 현장에서 쌓으신 경험을 포항고에 어떻게 연결하고 싶으신가요?","학생들이 즐겁고 안전하게 학교생활을 하면서 어려움을 편하게 이야기할 수 있으려면 학교가 무엇을 해야 할까요? 학생들의 의견을 듣는 방법도 궁금합니다.","인공지능과 디지털 기술의 발전 속에서 수업과 학교생활은 어떻게 달라져야 한다고 생각하시나요? 기술 활용과 사람 사이의 관계에서 중요한 가치는 무엇일까요?","학생회·동아리·탐구활동·봉사·학생 기자단 등 학생이 직접 기획하는 활동을 어떻게 지원하고 싶으신가요? 학생들의 제안이 학교 운영에 반영되는 방법도 궁금합니다.","학생과 교사, 또는 학생들 사이에 의견이 다를 때 가장 중요하게 생각하는 소통과 갈등 해결의 원칙은 무엇인가요? 모두가 소속감을 느끼는 학교를 위한 생각도 듣고 싶습니다.","포항고 학생들과 만나며 기억에 남는 순간이나 보람을 느끼셨던 일이 있으신가요? 일상에서 발견한 작은 장면도 좋습니다.","【선택】 교감선생님의 학창 시절은 어떤 모습이었나요? 기억에 남는 선생님이나 지금의 학생들에게 들려주고 싶은 경험이 있으신가요?","【선택】 학생들에게 추천하고 싶은 책·영화 또는 마음에 간직한 문장이 있으신가요? 그 이유도 말씀해 주세요.","【선택】 포항고등학교 학생들에게 꼭 전하고 싶은 응원의 말씀을 부탁드립니다. 학생들이 앞으로 어떤 사람으로 성장하길 바라시나요?"]},
 event:{label:'학교 행사 기사',title:'',questions:[]},
 free:{label:'자유 원고',title:'',questions:[]}
};
// Keep legacy question labels solely to recover older eleven-answer draft files.
const legacyQuestions=Object.fromEntries(['principal','viceprincipal'].map(k=>[k,[...templates[k].questions]]));
for(const kind of ['principal','viceprincipal'])templates[kind].questions=templates[kind].questions.slice(0,9);
const exampleStarts=[
 '제가 생각하는 좋은 학교는 서로의 질문을 귀 기울여 듣는 곳입니다. 예를 들어…',
 '학교에서 인상 깊었던 장면은 …입니다. 그때 학생들이 …하는 모습을 보았습니다.',
 '앞으로 가장 중요하게 생각하는 방향은 …입니다. 이를 위해 먼저 …해 보고 싶습니다.',
 '학생들의 하루에서 …이 달라졌으면 합니다. 학교에서는 …을 도울 수 있습니다.',
 '학생들에게 꼭 필요한 힘은 …이라고 생각합니다. 수업과 생활에서 …을 경험하면 좋겠습니다.',
 '학생이 직접 제안한 …활동이 좋은 출발점이 될 수 있습니다. 학교는 …을 지원하겠습니다.',
 '특히 기억에 남는 순간은 …입니다. 그 일을 통해 …을 느꼈습니다.',
 '학생들에게 …이라는 말을 전하고 싶습니다. 앞으로도 …을 응원하겠습니다.',
 '학창 시절 …을 경험한 적이 있습니다. 지금 돌아보면 …을 배운 시간이었습니다.'
];
for(const kind of ['principal','viceprincipal'])templates[kind].examples=[...exampleStarts];
function normalizeDraft(d){
 if(!legacyQuestions[d?.kind]||!Array.isArray(d.answers)||d.answers.length<=9)return {...d};
 const extra=d.answers.slice(9).map((v,i)=>String(v??'').trim()?`이전 질문 ${i+10}. ${legacyQuestions[d.kind][i+9]||'추가 답변'}\n\n${String(v).trim()}`:'').filter(Boolean);
 return {...d,answers:d.answers.slice(0,9),extra:[d.extra||'',...extra].filter(Boolean).join('\n\n')};
}
const guide={intro:'안녕하십니까. 2026학년도 포항고등학교 교지 『웅비』 편집부입니다. 학교의 교육철학과 미래 비전, 학생들의 성장을 위한 말씀을 듣고자 합니다. 질문은 모두 9개이며, 모든 문항을 채우지 않아도 됩니다. 답하기 편한 질문부터 자유롭게 적어 주세요. 짧은 경험이나 한 가지 생각으로 시작하셔도 좋습니다. 답변은 담당 교사의 검토를 거쳐 기사로 정리하며, 웹진·교지에 게재하기 전에 최종 원고를 확인받겠습니다.',done:'답변을 보내 주셔서 감사합니다. 담당 교사가 확인한 뒤 학생 기자단이 후속 인터뷰를 준비하겠습니다. 제출만으로 답변이 공개되지는 않습니다.',followups:['말씀하신 생각을 하게 된 구체적인 경험이 있으신가요?','학생 입장에서는 어떤 변화로 느낄 수 있을까요?','그 일을 시작할 때 가장 먼저 해야 할 일은 무엇인가요?','서로 다른 의견이 있다면 어떤 방식으로 함께 결정하면 좋을까요?','학생들이 직접 맡아 볼 수 있는 역할이 있을까요?'],steps:['방문 전: 답변을 읽고 더 듣고 싶은 대목 3개를 고릅니다. 정확한 직함·경력·부임 시기를 확인합니다.','시작 3분: 인사하고 취재 목적·예상 소요 시간·녹음 여부를 설명하여 동의를 받습니다.','대화 15분: 서면 질문을 전부 반복하지 않고 구체적인 경험과 학생에게 생길 변화를 묻습니다.','마무리 5분: 인용할 핵심 발언과 추가로 전할 말씀을 확인하고 사진 촬영 동의를 구합니다.','기사 작성: 사실과 기자의 해석을 구분하고 최종 원고의 발언·경력을 확인받습니다.']};
const str=v=>String(v??'').trim();
function compose(d){
 d=normalizeDraft(d);
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

// Whitelist storage fields to match deployed Firestore article schema.
// Original interview replies stay private in contributions.
function toStoredArticle(base,input){
 const accepted=new Set(['id','title','deck','body','byline','category','assigneeIds','assigneeNames','dueDate','minPhotos','photos','status','feedback','revision','updatedBy','createdAt','updatedAt','webConsent','printConsent','sourceTitle','categorySource','planKind','planOrder','sourceRange','contentOrigin','reportingQuestions','notes']);
 const article=Object.fromEntries(Object.entries(base).filter(([k,v])=>accepted.has(k)&&(k!=='planKind'||v)));
 article.title=input.title;
 article.deck=input.deck||'';
 article.body=input.body;
 article.byline=input.byline;
 article.contentOrigin=input.contentOrigin;
 article.status='draft';article.webConsent=false;article.printConsent=false;
 return article;
}
const api={templates,guide,normalizeDraft,compose,validate,printable,articleInput,toStoredArticle,escape};
if(typeof module==='object'&&module.exports)module.exports=api;else{root.Woonbi=root.Woonbi||{};root.Woonbi.contribute=api;}
})(typeof window!=='undefined'?window:globalThis);
