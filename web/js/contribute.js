(function(){
'use strict';
const W=window.Woonbi,C=W.contribute,main=document.querySelector('main'),status=document.querySelector('#status'),params=new URLSearchParams(location.search);
const kind=C.templates[params.get('kind')]?params.get('kind'):'',key='woonbi.contribution.'+(kind||'free');
let store,loading,pending=false,revision=0,draftId='',lastSubmittedRevision=-1;
function el(tag,text,attrs={}){const n=document.createElement(tag);if(text)n.textContent=text;for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n;}
function say(s){status.textContent=s;}
function action(label,fn,secondary=false){const b=el('button',label,{type:'button'});if(secondary)b.className='secondary';b.addEventListener('click',async()=>{b.disabled=true;try{await fn();}catch(e){say(e.message||'처리하지 못했습니다. 작성한 내용은 화면에 남아 있습니다.');}finally{b.disabled=false;}});return b;}
function tools(...children){const n=el('div','',{class:'tools'});n.append(...children);return n;}
function heading(eyebrow,title,intro){main.append(el('div',eyebrow,{class:'eyebrow'}),el('h1',title));if(intro)main.append(el('p',intro,{class:'intro'}));}
async function connect(){
 if(store)return store;if(loading)return loading;
 loading=(async()=>{if(window.WOONBI_CONFIG?.mode!=='firebase')throw Error('현재는 미리보기입니다. 내려받기·인쇄를 사용할 수 있으며 서버 제출은 운영 사이트에서 가능합니다.');const s=new W.FirebaseStore(window.WOONBI_CONFIG);await s.init();store=s;return s;})();
 try{return await loading;}finally{loading=null;}
}
async function signed(){const s=await connect();if(!s.user){await s.login();if(!s.user)await new Promise((resolve,reject)=>{const start=Date.now(),timer=setInterval(()=>{if(s.user){clearInterval(timer);resolve();}else if(Date.now()-start>12000){clearInterval(timer);reject(Error('로그인 확인을 마치지 못했습니다. 잠시 후 제출을 다시 눌러 주세요.'));}},100);});}return s;}
function isReviewer(s){return !!s.user?.active&&(s.user.baseRole==='teacher'||s.user.schoolTeacher===true);}
function download(content,name,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type})),a=el('a','',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function showHome(){
 heading('WOONBI · WRITE & INTERVIEW','당신의 이야기가 웅비가 됩니다.','인터뷰 답변부터 학교 소식까지. 편한 방식으로 작성하고 담당 교사에게 보내 주세요. 작성은 로그인 없이 시작할 수 있습니다.');
 const choices=el('div','',{class:'choices'});for(const [id,t] of Object.entries(C.templates)){const a=el('a','',{class:'choice',href:'contribute.html?kind='+id});a.append(el('strong',t.label),el('span',id==='event'?'확인한 사실을 입력해 기사 초안 정리':id==='free'?'제목과 본문을 직접 작성':'서면 답변 · 질문지 인쇄 · 후속 인터뷰'));choices.append(a);}main.append(choices,el('p','제출은 Google 로그인 후 가능합니다. 답변은 본인과 담당 교사만 볼 수 있으며 제출 즉시 웹진에 공개되지 않습니다.',{class:'notice'}));
}
function showGuide(){
 heading('REPORTER’S NOTE','답변에서 한 걸음 더 묻기','서면 인터뷰는 대화의 출발점입니다. 구체적인 장면과 경험이 기사에 담기도록 준비하세요.');const section=el('section','',{class:'guide'});section.append(el('h2','현장 인터뷰 진행 순서'));const ol=el('ol');C.guide.steps.forEach(s=>ol.append(el('li',s)));section.append(ol,el('h2','답변을 넓히는 추가 질문'));const ul=el('ul');C.guide.followups.forEach(s=>ul.append(el('li',s)));section.append(ul,el('p','경력·직함·부임 시기는 본인에게 확인합니다. “최초의 여성 교감” 여부는 확인 전 기사에 쓰지 않습니다. 녹음·사진·최종 공개는 각각 확인받습니다.',{class:'notice'}));main.append(section,tools(action('기자 안내 인쇄',()=>window.print()),action('안내문 내려받기',()=>download(['웅비 학생 기자 안내','',...C.guide.steps,'','추가 질문',...C.guide.followups].join('\n\n'),'웅비_학생기자_인터뷰안내.txt'),true)));
}
function showSheet(){
 const t=C.templates[kind];if(!t?.questions.length)return showHome();
 for(let page=0;page<2;page++){const section=el('section','',{class:'question-page'});section.append(el('div','2026 포항고등학교 교지 『웅비』 · '+(page+1)+'/2',{class:'eyebrow'}),el('h2',t.label+' 서면 질문지'));if(page===0)section.append(el('p',C.guide.intro),el('p','성함: ____________________     답변일: ____________________'));const list=el('ol','',{start:page?'7':'1'});t.questions.slice(page?6:0,page?11:6).forEach(q=>{const li=el('li',q);li.append(el('div','',{class:'answer-line'}));list.append(li);});section.append(list);if(page)section.append(el('p','※ 공간이 부족하면 별지에 이어서 적어 주세요. 게재 전 최종 원고를 확인받겠습니다.'));main.append(section);}
 main.prepend(tools(action('A4 2쪽 질문지 인쇄 / PDF 저장',()=>window.print()),action('답변 화면으로',()=>{location.href='contribute.html?kind='+kind;},true)));
}
function showForm(){
 const t=C.templates[kind];let saved={};try{saved=JSON.parse(sessionStorage.getItem(key)||'{}');}catch{}
 draftId=typeof saved._id==='string'?saved._id:crypto.randomUUID();
 heading('WOONBI · '+t.label,t.title||t.label,t.questions.length?C.guide.intro:'사실을 확인한 내용으로 작성해 주세요. 입력한 내용만 초안에 반영하며, 비어 있는 사실이나 인용은 만들지 않습니다.');
 const form=el('form');form.noValidate=true;const fields=new Map();
 function field(name,label,multiline=false,value='',max=45000){const id='write-'+name,n=el(multiline?'textarea':'input','',{id,name,...(!multiline?{type:'text'}:{}),maxlength:max});n.value=value;fields.set(name,n);form.append(el('label',label,{for:id}),n);return n;}
 field('byline',t.questions.length?'성함':'필자명',false,saved.byline||'',80);field('title','제목',false,saved.title||t.title,150);field('deck','부제 (선택)',false,saved.deck||'',350);
 if(t.questions.length){t.questions.forEach((q,i)=>field('answer'+i,(i+1)+'. '+q,true,saved.answers?.[i]||''));field('extra','그 밖에 학생들에게 전하고 싶은 말씀 (선택)',true,saved.extra||'');}
 else if(kind==='event'){
  for(const [k,label] of Object.entries({what:'어떤 행사·활동이었나요?',when:'언제 열렸나요?',where:'어디에서 열렸나요?',scene:'직접 본 장면은 무엇인가요?',detail:'주요 활동과 확인한 내용을 적어 주세요.',speaker:'인용할 발언자의 이름 또는 역할 (선택)',quote:'직접 확인한 발언 (선택)',meaning:'활동의 의미 또는 후속 계획 (선택)',source:'확인 자료·출처 (선택)'}))field(k,label,['scene','detail','meaning','quote'].includes(k),saved.facts?.[k]||'');
 }else field('body','본문',true,saved.body||'');
 const note=el('p','이 탭에 임시 보관합니다. 창을 닫기 전 파일로 내려받으면 다른 기기에서도 원고를 보관할 수 있습니다.',{class:'help'});form.append(note);
 function read(){const get=k=>fields.get(k)?.value||'';return {kind,title:get('title'),deck:get('deck'),byline:get('byline'),body:get('body'),answers:t.questions.map((_,i)=>get('answer'+i)),extra:get('extra'),facts:Object.fromEntries(['what','when','where','scene','detail','speaker','quote','meaning','source'].map(k=>[k,get(k)])),_id:draftId};}
 function stash(){try{sessionStorage.setItem(key,JSON.stringify(read()));note.textContent='이 탭에 임시 보관됨 · '+new Date().toLocaleTimeString('ko-KR');}catch{note.textContent='임시 저장 공간을 사용할 수 없습니다. 파일로 내려받아 보관해 주세요.';}}
 form.addEventListener('input',()=>{revision++;stash();});form.addEventListener('submit',e=>e.preventDefault());
 const preview=el('section','',{class:'preview',tabindex:'-1'});preview.hidden=true;
 function refresh(){const a=C.compose(read());preview.replaceChildren(el('div','검토용 초안 · 발행 전',{class:'eyebrow'}),el('h2',a.title||'제목 미입력'),el('p',a.byline),el('p',a.deck),el('p',a.body||'작성한 내용이 여기에 표시됩니다.'));preview.hidden=false;return a;}
 const confirm=el('input','',{id:'confirm',type:'checkbox'}),label=el('label','',{class:'confirmation',for:'confirm'});label.append(confirm,document.createTextNode('이 원고를 담당 교사에게 검토용으로 전달하는 데 동의합니다. 웹진·교지 공개는 최종 원고 확인 후 별도로 진행합니다.'));
 const submit=action('검토용으로 제출',async()=>{
  if(pending)return;if(revision===lastSubmittedRevision){say('이미 제출한 내용입니다. 수정 후 새 원고로 제출할 수 있습니다.');return;}
  const a=C.validate(C.compose(read()),confirm.checked),sentRevision=revision,sentId=draftId;pending=true;stash();say('로그인을 확인하고 원고를 전송합니다…');
  try{const s=await signed(),F=s.F;let acceptedId=sentId,ref=F.doc(s.db,'contributions',acceptedId);const row={...a,ownerUid:s.user.uid,status:'submitted',createdAt:F.serverTimestamp(),webConsent:false,printConsent:false};
   // A known id makes retry after a lost response idempotent.
   const previous=await F.getDoc(ref);if(previous.exists()&&['title','deck','byline','body','kind'].some(k=>previous.data()[k]!==row[k])){acceptedId=crypto.randomUUID();draftId=acceptedId;ref=F.doc(s.db,'contributions',acceptedId);stash();await F.setDoc(ref,row);}else if(!previous.exists())await F.setDoc(ref,row);
   const check=await F.getDocFromServer(ref);if(!check.exists())throw Error('서버 접수를 확인하지 못했습니다. 다시 제출해 주세요.');
   lastSubmittedRevision=sentRevision;draftId=crypto.randomUUID();stash();say(C.guide.done+' 접수번호: '+acceptedId+(revision!==sentRevision?' 전송 중 수정한 내용은 아직 제출되지 않았습니다. 다시 제출해 주세요.':''));
  }finally{pending=false;}
 });
 const controls=tools(action('초안 미리보기',()=>{refresh();preview.focus();}),action('원고 TXT 받기',()=>{const a=refresh();download([a.title,a.deck,a.byline,'',a.body].join('\n'),'웅비_'+kind+'_원고.txt');},true),action('이어서 쓸 파일 받기',()=>download(JSON.stringify(read(),null,2),'웅비_'+kind+'_임시원고.json','application/json'),true),action('원고 인쇄',()=>{const a=refresh();const w=window.open('','_blank');if(!w)throw Error('인쇄 창이 차단되었습니다. 팝업을 허용한 뒤 다시 눌러 주세요.');w.document.write(C.printable(a));w.document.close();w.focus();w.print();},true));
 const restore=el('input','',{type:'file',accept:'.json,application/json',id:'restore'}),restoreLabel=el('label','이어서 쓸 파일 불러오기',{for:'restore'});restore.addEventListener('change',async()=>{try{const file=restore.files[0];if(!file)return;if(file.size>400000)throw Error('원고 파일 크기가 너무 큽니다.');const data=JSON.parse(await file.text());if(data.kind!==kind)throw Error('같은 종류의 작성 화면에서 불러와 주세요.');for(const [k,n] of fields){let value=data[k];if(k.startsWith('answer'))value=data.answers?.[Number(k.slice(6))];if(['what','when','where','scene','detail','speaker','quote','meaning','source'].includes(k))value=data.facts?.[k];n.value=typeof value==='string'?value:'';}revision++;stash();say('원고를 불러왔습니다.');}catch(e){say(e.message);}});
 main.append(form,controls,restoreLabel,restore,preview,label,tools(submit));
 if(t.questions.length){const a=el('a','A4 2쪽 질문지 열기',{href:'contribute.html?kind='+kind+'&view=sheet'});main.append(a);}
 window.addEventListener('beforeunload',e=>{if(pending){e.preventDefault();e.returnValue='';}});
 stash();
}
async function showInbox(){
 heading('EDITORIAL DESK','교사 수합함','제출된 원고를 확인하고 기존 웅비 편집실의 초안으로 가져옵니다. 가져온 사본은 기존 편집실의 계정 권한을 따르며, 웹진에는 발행 전까지 공개되지 않습니다.');
 const content=el('section');main.append(content);let cursor=null;
 const loadButton=action('교사 로그인 · 수합함 열기',async()=>{const s=await signed();if(!isReviewer(s))throw Error('학교 교사 계정 또는 등록된 교사 권한이 필요합니다. 임시 관리자 모드로는 답변을 열 수 없습니다.');say('접수 원고를 불러옵니다…');const F=s.F,snap=await F.getDocs(F.query(F.collection(s.db,'contributions'),F.orderBy('createdAt','desc'),...(cursor?[F.startAfter(cursor)]:[]),F.limit(100)));content.replaceChildren();const rows=snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.createdAt?.toMillis?.()||0)-(a.createdAt?.toMillis?.()||0));
 for(const row of rows){const card=el('article','',{class:'submission'});card.append(el('div',(C.templates[row.kind]?.label||'원고')+' · '+(row.status==='imported'?'편집실로 가져옴':'검토 대기'),{class:'eyebrow'}),el('h2',row.title),el('p',row.byline));const details=el('details');details.append(el('summary','원고 펼치기'),el('pre',row.body));card.append(details);const importBtn=action('편집실 초안으로 가져오기',async()=>{
  // Deterministic article id + transaction prevent duplicate imports across tabs.
  const articleId='contrib-'+row.id,ref=F.doc(s.db,'articles',articleId),entry=F.doc(s.db,'contributions',row.id);
  await F.runTransaction(s.db,async tx=>{const entrySnap=await tx.get(entry),existing=await tx.get(ref);if(!entrySnap.exists())throw Error('접수 원고를 찾지 못했습니다.');if(entrySnap.data().status==='imported')return;
   if(!existing.exists()){const input=C.articleInput(row,s.user.uid),base=W.core.newArticle(s.user,{...input,id:articleId},new Date().toISOString()),a={...base,body:input.body,deck:input.deck,byline:input.byline,contentOrigin:input.contentOrigin},write={...a,serverWrittenAt:F.serverTimestamp()};tx.set(ref,write);tx.set(F.doc(ref,'revisions','0'),{snapshot:write,actor:s.user.uid,at:F.serverTimestamp()});}
   tx.update(entry,{status:'imported',articleId});});importBtn.disabled=true;importBtn.textContent='편집실에 가져왔습니다';say('초안으로 가져왔습니다. 편집실에서 내용 확인·수정·승인 후 발행하세요.');
 });if(row.status==='imported'){importBtn.disabled=true;importBtn.textContent='이미 가져온 원고';}card.append(tools(importBtn,action('TXT 내려받기',()=>download([row.title,row.byline,'',row.body].join('\n'),'웅비_접수원고.txt'),true)));content.append(card);}
 if(!rows.length)content.append(el('p','아직 접수된 원고가 없습니다.'));say('접수 원고 '+rows.length+'건 표시');if(snap.docs.length===100)content.append(action('다음 접수 원고 보기',async()=>{cursor=snap.docs[snap.docs.length-1];loadButton.click();},true));if(cursor)content.append(action('최신 원고부터 다시 보기',async()=>{cursor=null;loadButton.click();},true));
 },false);main.append(tools(loadButton,el('a','기존 편집실 열기',{href:'/?view=articles',class:'button'})));
}
const view=params.get('view');if(view==='guide')showGuide();else if(view==='sheet')showSheet();else if(view==='inbox')showInbox();else if(kind)showForm();else showHome();
})();
