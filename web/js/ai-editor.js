/* Woonbi editorial AI guard: deterministic, privacy-preserving assistance. It does not send drafts off-device. */
(function(){'use strict';
const W=window.Woonbi=window.Woonbi||{};
const generic=[
 '중요한 역할을 한다','중요한 역할을 하고','의미 있는','의미있는','다양한','앞으로도','기대된다',
 '도움이 될 것이다','도움이 됩니다','단순히','넘어서','현대 사회에서','오늘날','이러한','이를 통해',
 '우리에게 시사','긍정적인 영향','부정적인 영향','새로운 가능성','더 나은','기여할 수','필요가 있다',
 '주목할 필요','알 수 있다','확인할 수 있다','생각해 볼 수 있다','의미를 지닌다'
];
const sensational=['충격','경악','역대급','레전드','대박','완벽한','최악의','무조건','100%','반드시','절대'];
const sentenceSplit=s=>String(s||'').split(/(?<=[.!?。！？]|다\.)\s+|\n+/).map(x=>x.trim()).filter(Boolean);
const paras=s=>String(s||'').split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);
function occurrences(text,needle){let n=0,i=0;while((i=text.indexOf(needle,i))>=0){n++;i+=needle.length;}return n;}
function score(article){
 const body=String(article.body||''),title=String(article.title||''),deck=String(article.deck||''),sentences=sentenceSplit(body),paragraphs=paras(body);
 const flags=[],strengths=[];
 let slop=0;
 const found=generic.map(x=>[x,occurrences(body,x)]).filter(x=>x[1]>0);
 const overused=found.filter(x=>x[1]>=2);
 slop+=found.reduce((a,[,n])=>a+n,0);
 if(found.length)flags.push({kind:'slop',level:overused.length?'warn':'note',title:'AI 냄새가 날 수 있는 추상 표현',detail:found.slice(0,8).map(([x,n])=>`${x}${n>1?' ×'+n:''}`).join(' · ')});
 const long=sentences.filter(x=>x.length>105);
 if(long.length)flags.push({kind:'sentence',level:'warn',title:'너무 긴 문장',detail:`${long.length}개 문장이 105자를 넘습니다. 가장 긴 문장 ${Math.max(...long.map(x=>x.length))}자`});
 const huge=paragraphs.filter(x=>x.length>650);
 if(huge.length)flags.push({kind:'paragraph',level:'warn',title:'문단이 너무 깁니다',detail:`${huge.length}개 문단이 650자를 넘습니다. 장면·근거가 바뀌는 지점에서 나누세요.`});
 const nums=(body.match(/\d+(?:[.,]\d+)?%?|\d{4}년|\d+명|\d+회|\d+건/g)||[]);
 if(nums.length)strengths.push(`구체적 수치·날짜 ${Math.min(nums.length,9)}개+`);else flags.push({kind:'evidence',level:'note',title:'숫자·날짜가 거의 없습니다',detail:'행사 기사라면 날짜·참가자 수·횟수, 탐구 기사라면 표본·결과 수치를 확인해 보세요.'});
 const quoteCount=(body.match(/[“”"「」『』]/g)||[]).length;
 if(quoteCount>=2)strengths.push('직접 인용 또는 인용 표시 있음');else flags.push({kind:'quote',level:'note',title:'사람의 목소리가 약합니다',detail:'인터뷰 기사라면 사실 설명 대신 당사자의 경험·감정을 담은 직접 인용 1~2개를 확보하세요.'});
 const refs=article.sourceReferences?.length||0;
 if(refs)strengths.push(`참고 출처 ${refs}개 연결`);else flags.push({kind:'source',level:'warn',title:'출처 링크가 없습니다',detail:'통계·법률·연구·외부 사실이 있다면 원출처를 최소 1개 연결하세요.'});
 const first=paragraphs[0]||'';
 if(first.length>260)flags.push({kind:'lead',level:'note',title:'첫 문단이 깁니다',detail:'첫 화면에서는 가장 중요한 장면·사실을 2~4문장으로 먼저 보여주세요.'});
 if(/^(현대 사회|오늘날|최근 들어|이번 기사에서는|우리는 흔히|우리 사회는)/.test(first))flags.push({kind:'lead',level:'warn',title:'AI식 서론으로 시작할 위험',detail:'추상적인 시대 설명 대신 현장 장면·구체적 숫자·사람의 한마디 중 하나로 시작해 보세요.'});
 const sentEnd=new Map();for(const s of sentences){const m=s.match(/([가-힣]{1,8}(?:다|했다|한다|있다|된다))\.?$/);if(m)sentEnd.set(m[1],(sentEnd.get(m[1])||0)+1);}
 const repeats=[...sentEnd.entries()].filter(([,n])=>n>=4).sort((a,b)=>b[1]-a[1]);
 if(repeats.length)flags.push({kind:'rhythm',level:'note',title:'문장 끝맺음이 반복됩니다',detail:repeats.slice(0,4).map(([x,n])=>`${x} ×${n}`).join(' · ')});
 const hype=sensational.filter(x=>title.includes(x)||deck.includes(x));
 if(hype.length)flags.push({kind:'headline',level:'warn',title:'제목이 과장돼 보일 수 있습니다',detail:hype.join(' · ')});
 if(title.length>42)flags.push({kind:'headline',level:'note',title:'제목이 깁니다',detail:`${title.length}자입니다. 모바일 2줄 안에 들어오도록 핵심 명사와 동사를 남겨보세요.`});
 if(body.length>=700)strengths.push('본문 분량 확보');else flags.push({kind:'depth',level:'note',title:'본문이 짧습니다',detail:'현장 기사라면 장면·인터뷰·배경·다음 단계 중 빠진 축이 없는지 확인하세요.'});
 const specific=(body.match(/[가-힣]{2,}(?:고등학교|중학교|대학교|교사|학생|위원회|동아리|연구원|센터|부장|회장|대표)/g)||[]);
 if(specific.length)strengths.push('구체적인 인물·기관 표현 있음');
 const raw=100-(flags.filter(x=>x.level==='warn').length*10)-(flags.filter(x=>x.level==='note').length*4)-Math.min(16,slop*2);
 return {score:Math.max(20,Math.min(100,raw)),flags,strengths,stats:{characters:body.length,sentences:sentences.length,paragraphs:paragraphs.length,numbers:nums.length,refs,quotes:Math.floor(quoteCount/2)}};
}
function questions(article){
 const cat=String(article.category||''),kind=String(article.planKind||'');
 if(cat==='학교 사람들')return ['이 사람이 학교에서 가장 자주 마주하는 장면은 무엇인가?','일을 하며 가장 어려웠던 순간과 실제로 한 선택은?','학생들이 이 사람의 역할을 오해하는 부분은?','하루 중 가장 바쁜 30분을 구체적으로 설명해 달라.','실패하거나 예상과 달랐던 경험은?','앞으로 바꾸고 싶은 한 가지는?'];
 if(kind==='research'||cat==='학생 글')return ['이 글이 답하려는 질문을 한 문장으로 줄이면?','가장 강한 근거와 그 원출처는?','반대되는 자료나 반례가 있는가?','자료를 어떻게 모았고 표본은 충분한가?','결론의 한계는 무엇인가?','포항고 학생에게 실제로 어떤 의미가 있는가?'];
 return ['현장에서 가장 먼저 눈에 들어온 장면은?','누가 이 일로 가장 영향을 받았는가?','행사 전과 후 무엇이 실제로 달라졌는가?','담당자 설명과 참가 학생 경험이 일치했는가?','확인 가능한 숫자·문서·사진은 무엇인가?','다음에는 무엇이 달라져야 하는가?'];
}
function headlinePrompts(article){
 const t=String(article.title||'기사 주제').replace(/^\[.*?\]\s*/,'').trim();
 return [
  `장면형: “${t}”를 가장 잘 보여주는 한 장면을 제목으로 바꾸기`,
  `질문형: ${t} — 학생들이 실제로 궁금해할 질문 하나로 바꾸기`,
  `검증형: ${t}, 무엇이 실제로 달라졌나`,
  `사람형: ${t}를 겪은 학생·교사의 한마디에서 제목 찾기`
 ];
}
W.aiEditor={score,questions,headlinePrompts,generic};
})();