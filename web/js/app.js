(function(){
'use strict';
const W=window.Woonbi,C=W.core,$=s=>document.querySelector(s),main=$('#main'),dialog=$('#dialog');
let newsroom,store,user,view='public',edit=null,dirty=false,editSequence=0,saveTimer=null,aiTimer=null,saveJob=null,uploading=false,unsubscribe=null,presenceStop=null,filter='all',search='',planKind='all',categoryFilter='all',issueSelection=[],dashboardSelection=new Set(),photoDeskFilter='all',photoScanState={rows:[],duplicates:0,nearDuplicates:0,selected:new Set()};
const urls=new Map(),now=()=>new Date().toISOString();
const h=(tag,attrs={},...children)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(v==null||v===false)continue;if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);else if(k==='checked')e.checked=!!v;else if(k==='value')e.value=v;else if(k==='disabled'||k==='hidden')e[k]=!!v;else e.setAttribute(k,v===true?'':String(v));}for(const c of children.flat(Infinity)){if(c!=null&&c!==false)e.append(c instanceof Node?c:document.createTextNode(String(c)));}return e;};
const button=(text,fn,cls='')=>h('button',{class:cls,onclick:async e=>{e.preventDefault();try{await fn(e);}catch(err){showError(err);}}},text);
function toast(text){const e=$('#toast');e.textContent=text;e.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.hidden=true,4300);}
function showError(e){console.error(e);toast(e?.message||'처리하지 못했습니다. 다시 확인해 주세요.');}
function download(blob,name){const u=URL.createObjectURL(blob),a=h('a',{href:u,download:name});a.style.display='none';document.body.append(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(u);},60000);}
 async function chooseSaveHandle(name,type='application/octet-stream'){if(typeof window.showSaveFilePicker!=='function')return null;try{return await window.showSaveFilePicker({suggestedName:name,types:[{description:'웅비 내보내기 파일',accept:{[type]:['.'+(name.split('.').pop()||'bin')]}}]});}catch(e){if(e?.name==='AbortError')return false;throw e;}}
 async function writeDownload(blob,name,handle=null){if(handle&&handle!==false){const w=await handle.createWritable();await w.write(blob);await w.close();return true;}download(blob,name);return true;}
function textDownload(data,name){download(new Blob([data],{type:'text/plain;charset=utf-8'}),name);}
async function copyText(text){try{await navigator.clipboard.writeText(String(text));toast('클립보드에 복사했습니다.');}catch{const t=h('textarea',{hidden:false});t.value=String(text);document.body.append(t);t.select();document.execCommand('copy');t.remove();toast('클립보드에 복사했습니다.');}}
function dialogOpen(title,content,actions=[]){$('#dialogBody').replaceChildren(h('div',{class:'dialog-header'},h('h2',{},title),button('닫기',()=>dialog.close(),'text')),content,h('div',{class:'actions'},actions));if(!dialog.open)dialog.showModal();}
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
function setSave(text,isError=false){const e=$('#saveStatus');if(e){e.textContent=text;e.classList.toggle('error',isError);}}
function bufferKey(){return edit&&user?`woonbi-buffer:${store.mode}:${user.uid}:${edit.id}`:'';}
function buffer(){if(!edit)return;try{W.session.setItem(bufferKey(),JSON.stringify({revision:edit.revision,patch:readEditor(),at:now()}));}catch{} }
function readEditor(){if(!edit)return{};return {title:$('#articleTitle')?.value??edit.title,deck:$('#articleDeck')?.value??edit.deck,body:$('#articleBody')?.value??edit.body,byline:$('#articleByline')?.value??edit.byline,photos:C.clone(edit.photos)};}
function changed(){if(!edit)return;dirty=true;editSequence++;setSave('저장 대기 · 이 탭에 임시 보관');buffer();const count=$('#charCount');if(count)count.textContent=`${readEditor().body.length.toLocaleString()}자`;clearTimeout(saveTimer);saveTimer=setTimeout(()=>save().catch(()=>{}),900);renderPreflight();clearTimeout(aiTimer);aiTimer=setTimeout(renderAiGuard,420);}
async function save(){
 clearTimeout(saveTimer);if(saveJob){await saveJob;if(dirty)return save();return;}
 if(!edit||!dirty)return;const targetId=edit.id,seq=editSequence,patch=readEditor(),expected=edit.revision;setSave('저장 중…');
 const task=(async()=>{try{const updated=await store.saveArticle(targetId,expected,patch);if(edit?.id===targetId){edit={...updated,photos:seq===editSequence?updated.photos:edit.photos};if(seq===editSequence){dirty=false;W.session.removeItem(bufferKey());setSave(store.mode==='demo'?(store.persistence==='memory'?'이 탭에만 임시 저장됨':'이 기기에 저장됨'):'학교 서버에 저장됨');}else{buffer();setSave('이어서 저장 중…');}}}
 catch(e){setSave(e.code==='conflict'?'수정 충돌 · 내 글은 이 탭에 보관됨':'서버 저장 실패 · 이 탭에만 임시 보관됨',true);const box=$('#conflictBox');if(box){box.hidden=false;box.replaceChildren(h('p',{},e.message),button('내 원고 사본 받기',()=>textDownload(JSON.stringify({articleId:edit.id,...readEditor()},null,2),'woonbi-unsaved-draft.json')),button('최신 원고 다시 열기',async()=>{if(confirm('현재 입력 내용은 사본으로 먼저 보관해 주세요. 최신 원고로 다시 열까요?')){dirty=false;await openEditor(edit.id);}}));}buffer();throw e;}
 })();saveJob=task;try{await task;}finally{saveJob=null;}if(dirty&&seq!==editSequence)return save();
}
async function leaveEditor(){clearTimeout(saveTimer);if(uploading){toast('사진 저장이 끝난 뒤 이동해 주세요.');return false;}if(dirty){try{await save();}catch{toast('저장되지 않은 글이 있습니다. 먼저 사본을 보관해 주세요.');return false;}}presenceStop?.();presenceStop=null;edit=null;dirty=false;return true;}
function clearLocalBuffers(){for(const k of W.session.keys())if(k.startsWith('woonbi-buffer:'))W.session.removeItem(k);for(const v of urls.values())URL.revokeObjectURL(v);urls.clear();}
function refreshHeader(){
 const reading=['public','archive','examples','ideas','reader'].includes(view);document.body.classList.toggle('reading-view',reading);main.className=reading?'newsroom-main':'desk-main';document.querySelectorAll('.desk-only').forEach(e=>e.hidden=reading);document.querySelectorAll('.reader-only').forEach(e=>e.hidden=!reading);

 const account=$('#account');account.replaceChildren();$('#navArticles').textContent=C.staff(user)?'기사 계획':'내 기사';$('#navDashboard').hidden=!C.teacher(user);$('#navPhotos').hidden=!C.teacher(user);$('#navBook').hidden=!C.teacher(user);$('#navMembers').hidden=!C.teacher(user);
 if(store.mode==='demo'){
 const select=h('select',{'aria-label':'학생별 화면 미리보기',id:'demoUser'});for(const u of W.DEMO_USERS)select.append(h('option',{value:u.uid},u.displayName+(u.sourceRole&&u.sourceRole!=='기자'?' · '+u.sourceRole:'')));select.value=user?.uid||'';
 select.addEventListener('change',async()=>{if(!(await leaveEditor())){select.value=user.uid;return;}clearLocalBuffers();user=await store.login(select.value);filter='all';search='';planKind='all';categoryFilter='all';listen();refreshHeader();await navigate('articles');});account.append(select);
 }else if(user){account.append(h('span',{},user.displayName),button('로그아웃',async()=>{if(!(await leaveEditor()))return;clearLocalBuffers();await store.logout();user=null;refreshHeader();await navigate('public');},'text'));}
 else account.append(button('Google 로그인',async()=>{try{await store.login();}catch(e){if(e.code==='auth/popup-blocked'){dialogOpen('팝업이 차단됐습니다',h('p',{},'같은 창에서 Google 로그인을 진행할 수 있습니다.'),[button('같은 창에서 로그인',()=>store.loginRedirect(),'primary')]);}else throw e;}}));
 document.querySelectorAll('.top [data-nav]').forEach(e=>e.classList.toggle('current',e.dataset.nav===view));
}
function listen(){unsubscribe?.();unsubscribe=store.subscribe(()=>{if(!edit&&['articles','public','members','dashboard','photos'].includes(view))renderCurrent().catch(showError);else if(edit){const indicator=$('#remoteNotice');if(indicator)indicator.hidden=false;}});}
async function navigate(next){if(!(await leaveEditor()))return;view=next;refreshHeader();await renderCurrent();window.scrollTo({top:0,behavior:'instant'});}
async function renderCurrent(){if(view==='archive')return newsroom.archiveHome();if(view==='examples')return newsroom.examples();if(view==='ideas')return newsroom.ideas();if(view==='public')return renderPublic();if(!user)return renderLogin();if(!user.active)return renderPending();if(view==='dashboard')return renderDashboard();if(view==='photos')return renderPhotoDesk();if(view==='book')return renderBook();if(view==='members')return renderMembers();return renderArticles();}
function renderLogin(){main.replaceChildren(h('div',{class:'panel'},h('h1',{},'웅비 편집실'),h('p',{},'Google 계정으로 로그인하고 담당교사의 승인 후 배정된 기사를 작성합니다.'),button('Google로 로그인',()=>store.login(),'primary')));}
function renderPending(){main.replaceChildren(h('div',{class:'panel'},h('h1',{},'참여 승인을 기다리고 있습니다'),h('p',{},'담당교사가 계정을 승인하고 기사를 배정하면 이곳에 내 기사가 나타납니다.'),button('승인 상태 확인',async()=>{location.reload();})));}
function articleState(a){return a.status==='draft'&&!a.body.trim()?'작성 전':C.STATUS[a.status];}
function articleNames(a){return (a.assigneeNames||[]).join(' · ')||a.byline||'배정 확인 필요';}
function sourceDialog(){const p=W.plan2026;if(!p)return;dialogOpen('가져온 자료',h('div',{},h('p',{},p.source?.name||'원고 자료'),h('ul',{},(p.notes||[]).map(x=>h('li',{},x)))));}
async function assignmentDialog(id){
 if(!C.teacher(user)||typeof store.updateAssignment!=='function')return;
 if(dirty)await save();const a=await store.getArticle(id),members=(await store.listMembers()).filter(u=>u.role!=='teacher'),form=h('form');
 form.append(h('p',{},a.title),h('label',{},'마감일 · 미정이면 비워두기',h('input',{type:'date',name:'dueDate',value:a.dueDate||''})),h('p',{class:'small muted'},'여러 명을 선택하면 공동 기사로 배정됩니다. 원본 시트의 배정 기록은 보존합니다.'));
 members.forEach(m=>form.append(h('label',{class:'check'},h('input',{type:'checkbox',name:'assignee',value:m.uid,checked:a.assigneeIds.includes(m.uid)}),m.displayName)));
 dialogOpen('담당자와 마감일',form,[button('배정 저장',async()=>{const d=new FormData(form);await store.updateAssignment(a.id,a.revision,{dueDate:d.get('dueDate'),assigneeIds:d.getAll('assignee')});dialog.close();if(edit?.id===a.id){edit=null;await openEditor(a.id);}else await renderArticles();toast('이 기기의 배정을 저장했습니다. 구글 원본은 바꾸지 않았습니다.');},'primary')]);
}
function planBrief(a){
 if(!a.sourceRange)return null;
 const detail=h('details',{class:'plan-brief'},h('summary',{},h('span',{},a.planKind==='research'?'개인 탐구 기사':'학교 기사'),h('b',{},'배정 정보'),h('span',{class:'brief-names'},articleNames(a))));
 const briefBody=h('div',{class:'brief-body'},h('p',{},`담당 ${articleNames(a)} / ${a.dueDate?'마감 '+a.dueDate:'마감일 미정'}`),h('p',{},a.sourceRange?`원본 ${a.sourceRange}${a.assignmentSources?.length?' · 배정 '+a.assignmentSources.map(s=>s.range).join(' / '):''}`:'복원·편집 메타데이터'),h('p',{},'올해 기사 계획에 기존 원고와 새 초안을 연결했습니다. 배정 정보와 원고 출처는 별도로 보존합니다.'));
 if(a.reportingQuestions?.length)briefBody.append(h('div',{class:'reporting-guide'},h('b',{},'취재 질문'),h('ol',{},a.reportingQuestions.map(q=>h('li',{},q)))));
 for(const n of a.notes||[])briefBody.append(h('p',{class:'small'},n));
 briefBody.append(h('p',{class:'small muted'},a.categorySource||''));detail.append(briefBody);
 if(C.teacher(user)&&typeof store.updateAssignment==='function')detail.append(button('담당자·마감일 변경',()=>assignmentDialog(a.id),'text'));
 return detail;
}
async function renderPlanMembers(){
 const p=W.plan2026,all=await store.listArticles(),root=h('div',{class:'roster-grid'});
 main.replaceChildren(h('div',{class:'heading-row'},h('div',{},h('div',{class:'eyebrow'},'2026 · EDITORIAL TEAM'),h('h1',{},'웅비 편집부'),h('p',{class:'intro'},'참여자별 기사 배정입니다. 이 데모의 계정 선택은 실제 로그인과 다릅니다.'))),root);
 for(const person of p.people){const assigned=all.filter(a=>a.assigneeIds.includes(person.uid));root.append(h('article',{class:'roster-card'},h('div',{class:'roster-person'},h('span',{class:'initial'},person.name.slice(-2)),h('div',{},h('h3',{},person.name),h('small',{},`${person.grade}학년 · ${person.sourceRole}${person.roleNote?' / '+person.roleNote:''}`))),h('ul',{},assigned.map(a=>h('li',{},button(a.title,()=>openEditor(a.id),'text')))),h('p',{class:'small muted'},assigned.length?`배정 ${assigned.length}건 · Google 계정 미연결`:'기사 선택 확인 필요 · Google 계정 미연결')));}
}
async function renderArticles(){
 const p=W.plan2026,rows=(await store.listArticles()).sort((a,b)=>(a.planOrder||999)-(b.planOrder||999)||a.title.localeCompare(b.title)),isStaff=C.staff(user),notices=!isStaff&&typeof store.listNotifications==='function'?await store.listNotifications():[];
 const top=h('section',{class:'plan-masthead'},h('div',{},h('div',{class:'eyebrow'},'POHANG HIGH SCHOOL · WOONBI'),h('h1',{},isStaff?'2026 기사 편집실':user.displayName+'의\n기사 작업실'),h('p',{class:'intro'},isStaff?'초안을 읽고, 학생의 취재를 더하고, 검토를 요청하세요.':'배정된 제목을 열고 글과 사진을 더하세요.\n디자인은 따로 맞추지 않아도 됩니다.')));
 const aside=h('div',{class:'plan-masthead-aside'},h('span',{class:'issue-label'},'2026 / 편집 준비'),h('p',{class:'source-short'},'웅비 기사 편집부'),h('p',{class:'small muted'},'초안 작성 · 사진 · 검토 · 발행'),button('원본과 가져온 내용',sourceDialog,'text'));
 if(C.teacher(user))aside.append(button('새 기사 배정',assignDialog,'primary'));if(isStaff)top.append(aside);else top.classList.add('student-masthead');
 const counts=[['기사 계획',rows.length],['학교 기사',rows.filter(a=>a.planKind==='school').length],['개인 탐구',rows.filter(a=>a.planKind==='research').length],['사진 교체 필요',W.editorial.replaceCount(rows)],['제출한 원고',rows.filter(a=>['submitted','approved'].includes(a.status)).length]];
 const stats=h('div',{class:'plan-totals'},counts.map(([label,n])=>h('div',{},h('strong',{},n),h('span',{},label))));
 const kindTabs=h('div',{class:'kind-tabs'});for(const [key,label] of [['all','모든 기사'],['school','학교 기사'],['research','개인 탐구'],['recovered','추가 복원']])kindTabs.append(button(label,()=>{planKind=key;renderArticles();},key===planKind?'active':''));
 const cats=h('select',{'aria-label':'기사 코너',id:'categoryFilter'},h('option',{value:'all'},'모든 코너'),C.CATEGORIES.map(c=>h('option',{value:c},c)));cats.value=categoryFilter;cats.addEventListener('change',()=>{categoryFilter=cats.value;updateList();});
 const input=h('input',{class:'search',type:'search',placeholder:'기사 제목이나 담당자 검색','aria-label':'기사 검색',value:search});input.addEventListener('input',()=>{search=input.value;updateList();});
 const filters=h('div',{class:'status-tabs'});for(const [key,label] of [['all','전체 상태'],['photos','사진 확인'],['draft','작성 전·작성 중'],['submitted','검토 요청'],['changes','수정 요청'],['approved','승인 완료']])filters.append(button(label,()=>{filter=key;renderArticles();},key===filter?'active':''));
 const list=h('div',{class:'article-list',id:'articleList'}),shown=h('span',{class:'small muted',id:'shownCount'});
 function updateList(){const q=W.editorial.normalize(search);const matching=rows.filter(a=>(planKind==='all'||a.planKind===planKind)&&(categoryFilter==='all'||a.category===categoryFilter)&&(filter==='all'||(filter==='photos'?a.photos.some(W.editorial.sample)||a.photos.length<a.minPhotos:a.status===filter))&&W.editorial.normalize(a.title+' '+articleNames(a)+' '+(a.notes||[]).join(' ')).includes(q));list.replaceChildren();shown.textContent=`${matching.length}개의 기사`;
 if(!matching.length)list.append(h('div',{class:'empty'},'이 조건에 맞는 기사가 없습니다.'));
 for(const a of matching){const title=button(a.title,()=>openEditor(a.id),'row-title');const t=h('div',{class:'row-content'},h('span',{class:'row-category'},a.category+(a.planKind==='research'?' / 개인 탐구':'')),h('h3',{},title),h('div',{class:'row-meta'},articleNames(a),a.assignmentStatus==='needs-confirmation'?h('span',{class:'needs-check'},'배정 확인'):null));
 const detail=h('div',{class:'row-detail'},h('span',{class:'badge '+a.status},articleState(a)),h('span',{class:'row-due'},a.dueDate?a.dueDate+' 마감':'마감 미정'),a.body||a.photos.length?h('span',{class:'small'},`${a.body.length.toLocaleString()}자 · 사진 ${a.photos.length}장${a.photos.some(W.editorial.sample)?' · 예시 교체 필요':''}`):null);
 list.append(h('article',{class:'article-row','data-article':a.id},h('span',{class:'row-no'},String(a.planOrder||rows.indexOf(a)+1).padStart(2,'0')),t,detail,button(C.canEdit(user,a)?a.body?'이어 쓰기':'원고 쓰기':'원고 보기',()=>openEditor(a.id),'row-action')));}}
 const toolbar=h('div',{class:'plan-toolbar'},kindTabs,h('div',{class:'plan-search'},cats,input));
 let noticeBox=null;const unread=notices.filter(n=>!n.read);if(unread.length){noticeBox=h('section',{class:'student-notices'},h('div',{class:'dashboard-section-head'},h('div',{},h('h2',{},'편집부 알림'),h('p',{class:'small muted'},'담당교사가 보낸 마감·원고 안내입니다.')),h('b',{},unread.length)));for(const n of unread.slice(0,12))noticeBox.append(h('article',{},h('div',{},h('b',{},n.title),h('p',{},n.body),h('small',{class:'muted'},n.createdAt?.toDate?n.createdAt.toDate().toLocaleString('ko-KR'):'')),button('확인',async()=>{await store.markNotificationRead(n.id);await renderArticles();},'text')));}

function csvCell(v){const x=String(v??'').replace(/"/g,'""');return '"'+x+'"';}
function downloadCsv(headers,rows,name){const text='\uFEFF'+[headers,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n');download(new Blob([text],{type:'text/csv;charset=utf-8'}),name);}
function statusLabel(a){return C.STATUS?.[a.status]||a.status||'';}
function dashboardPrintNode(articles,people,stamp){
 const root=h('article',{class:'dashboard-print'},h('header',{},h('p',{},'포항고등학교 학생 웹진 · 雄飛'),h('h1',{},'웅비 편집 진행 현황'),h('small',{},stamp)));
 const summary=h('div',{class:'dashboard-print-summary'});
 const incomplete=articles.filter(a=>a.status!=='approved'),photoShort=articles.filter(a=>a.photos.length<Number(a.minPhotos||0)||a.photos.some(W.editorial.sample)),review=articles.filter(a=>a.status==='submitted');
 for(const [k,v] of [['전체 기사',articles.length],['승인 전',incomplete.length],['사진 부족',photoShort.length],['검토 대기',review.length]])summary.append(h('div',{},h('b',{},v),h('span',{},k)));
 const studentTable=h('table',{},h('thead',{},h('tr',{},...['학생','배정','완료','검토대기','승인','사진부족'].map(x=>h('th',{},x)))),h('tbody',{},people.map(p=>h('tr',{},h('td',{},p.name),h('td',{},p.assigned),h('td',{},p.ready),h('td',{},p.submitted),h('td',{},p.approved),h('td',{},p.photoShort)))));
 const articleTable=h('table',{},h('thead',{},h('tr',{},...['번호','기사','담당','상태','마감','글자','사진'].map(x=>h('th',{},x)))),h('tbody',{},[...articles].sort((a,b)=>(a.planOrder||999)-(b.planOrder||999)).map(a=>h('tr',{},h('td',{},a.planOrder||''),h('td',{},a.title),h('td',{},articleNames(a)),h('td',{},statusLabel(a)),h('td',{},a.dueDate||'-'),h('td',{},String(a.body||'').length),h('td',{},a.photos.length+'/'+Number(a.minPhotos||0))))));
 root.append(summary,h('h2',{},'학생별 진행률'),studentTable,h('h2',{},'기사별 현황'),articleTable);return root;
}
 main.replaceChildren(...(noticeBox?[noticeBox]:[]),top,stats,toolbar,h('div',{class:'plan-list-head'},filters,shown),list);updateList();
 if(p){const unanswered=p.pendingTopics.filter(x=>isStaff||x.uid===user.uid),questions=p.assignmentQuestions.filter(x=>isStaff||x.uid===user.uid);const notes=h('section',{class:'planning-notes'});
 if(unanswered.length){const d=h('details',{class:'pending-topics',id:'pendingTopics'},h('summary',{},h('b',{},`탐구 주제 미정 ${unanswered.length}명`),h('span',{},'빈 자동생성 기사는 넣지 않았습니다.')));d.append(h('div',{class:'pending-names'},unanswered.map(x=>h('span',{},x.name))),h('p',{class:'small muted'},'원본의 개인 탐구 제목 칸이 비어 있습니다. 주제를 정한 뒤 새 기사로 배정하세요.'));notes.append(d);}
 if(questions.length)notes.append(h('div',{class:'assignment-question'},h('b',{},'배정 확인이 필요한 항목'),questions.map(x=>h('p',{},`${x.name} — “${x.raw}”`)),h('small',{},'원본에 두 선택지가 함께 적혀 있어 담당자를 임의로 확정하지 않았습니다.')));
 if(notes.children.length)main.append(notes);
 main.append(h('p',{class:'source-bottom'},'원래 배정과 기사 계획은 보존했습니다. 본문은 복원 원고 또는 편집용 초안이며, 실제 취재·필자 확인 후 제출하세요.'));
 }
}
async function assignDialog(){const members=(await store.listMembers()).filter(m=>m.active&&['student','editor'].includes(m.role));const form=h('form');
 form.append(h('label',{},'기사 제목',h('input',{name:'title',required:true,maxlength:150})),h('label',{},'코너',h('select',{name:'category'},C.CATEGORIES.map(c=>h('option',{value:c},c)))),h('label',{},'마감일 · 미정이면 비워두기',h('input',{name:'dueDate',type:'date',value:''})),h('label',{},'필수 사진 수',h('input',{name:'minPhotos',type:'number',value:'0',min:0,max:12})),h('p',{class:'small muted'},'함께 맡을 학생을 선택합니다. 같은 기사 동시 수정에는 충돌 보호가 적용되며 실시간 문장 병합은 하지 않습니다.'));
 for(const m of members)form.append(h('label',{class:'check'},h('input',{type:'checkbox',name:'assignee',value:m.uid}),m.displayName));
 if(!members.length)form.append(h('p',{class:'warning'},'참여자 화면에서 학생 계정을 먼저 승인해 주세요.'));
 const submit=button('기사 만들기',async()=>{if(!form.reportValidity())return;const data=new FormData(form),a=await store.createArticle({title:String(data.get('title')),category:String(data.get('category')),dueDate:String(data.get('dueDate')),minPhotos:Number(data.get('minPhotos')),assigneeIds:data.getAll('assignee')});dialog.close();toast('기사 배정을 저장했습니다.');await openEditor(a.id);},'primary');dialogOpen('새 기사 배정',form,[submit]);}
function renderPreflight(){const host=$('#v4Preflight');if(!host||!edit)return;const a={...edit,...readEditor()},items=W.editorial.preflight(a);host.replaceChildren(h('h3',{},'편집 체크'),h('p',{class:'small'},'자동 검사는 사실 검증을 대신하지 않습니다.'),...items.map(x=>h('p',{class:'check-'+x.severity},x.text)));if(!items.length)host.append(h('p',{},'형식 확인 완료 · 사실·출처는 사람이 확인하세요.'));}
function renderAiGuard(){
 const host=$('#aiEditorPanel');if(!host||!edit||!W.aiEditor)return;
 const a={...edit,...readEditor()},report=W.aiEditor.score(a),band=report.score>=82?'good':report.score>=65?'mid':'warn';
 const head=h('div',{class:'ai-panel-head'},h('div',{},h('span',{class:'eyebrow'},'AI EDITORIAL GUARD'),h('h3',{},'AI 편집 도우미')),h('strong',{class:'ai-score '+band},report.score));
 const note=h('p',{class:'small muted'},'원고를 외부 서비스로 보내지 않고 이 브라우저에서만 점검합니다. 문장을 대신 써주지 않습니다.');
 const stats=h('div',{class:'ai-stats'},h('span',{},'문단 '+report.stats.paragraphs),h('span',{},'문장 '+report.stats.sentences),h('span',{},'수치 '+report.stats.numbers),h('span',{},'출처 '+report.stats.refs),h('span',{},'인용 '+report.stats.quotes));
 const strengths=h('div',{class:'ai-strengths'},h('b',{},'살릴 점'),...(report.strengths.length?report.strengths:['아직 구체적인 강점 신호가 적습니다.']).map(x=>h('span',{},x)));
 const flags=h('div',{class:'ai-flags'});
 for(const x of report.flags.slice(0,7))flags.append(h('article',{class:'ai-flag '+x.level},h('b',{},x.title),h('p',{},x.detail)));
 const qBtn=button('취재 질문 6개',()=>dialogOpen('AI 편집 도우미 · 취재 질문',h('ol',{class:'ai-dialog-list'},W.aiEditor.questions(a).map(x=>h('li',{},x)))),'text');
 const hBtn=button('제목 프레임 4개',()=>dialogOpen('AI 편집 도우미 · 제목 설계',h('div',{},h('p',{class:'small muted'},'완성 제목을 대신 쓰지 않고, 기자가 사실과 장면을 넣어 완성할 프레임만 보여줍니다.'),h('ul',{class:'ai-dialog-list'},W.aiEditor.headlinePrompts(a).map(x=>h('li',{},x))))),'text');
 const ideaBtn=button('외부 취재 사례 보기',()=>navigate('ideas'),'text');
 host.replaceChildren(head,note,stats,strengths,flags,h('div',{class:'ai-actions'},qBtn,hBtn,ideaBtn));
}

function photoPlanPanel(a,writable){
 const plan=W.legacyPlanFor?.(a.id);if(!plan?.photos?.length)return null;
 const wrap=h('section',{class:'photo-plan'},h('div',{class:'photo-plan-head'},h('div',{},h('span',{class:'eyebrow'},'ORIGINAL PHOTO PLAN'),h('h3',{},'원래 사진 계획')),h('span',{class:'small muted'},plan.photos.length+'개 슬롯')));
 wrap.append(h('p',{class:'small muted'},'원래 index/웅비 패키지의 사진 배치를 보존했습니다. 이 이미지는 자리표시자이며 실제 사진을 올리면 순서대로 채워집니다.'));
 const grid=h('div',{class:'photo-plan-grid'});
 plan.photos.forEach((slot,i)=>{const card=h('article',{class:'photo-plan-slot'}),filled=a.photos[i];
  card.append(h('img',{src:slot.sourceAsset,alt:slot.alt||'교체용 사진 슬롯',loading:'lazy'}),h('div',{class:'photo-plan-copy'},h('b',{},(i+1)+'번 · '+(slot.caption||'사진 슬롯').replace(/ · 실제 현장 사진으로 교체 필요$/,'')),h('span',{class:filled?'slot-state filled':'slot-state'},filled?'실제 사진 연결됨':'사진 필요')));
  if(writable&&!filled){const input=h('input',{type:'file',accept:'image/jpeg,image/png,image/webp',hidden:true,'aria-label':(i+1)+'번 슬롯 사진 선택'});input.addEventListener('change',()=>uploadPlannedPhoto(slot,i,input.files[0]).catch(showError));card.append(input,button('이 슬롯에 사진 넣기',()=>input.click(),'text'));}
  grid.append(card);
 });
 wrap.append(grid);return wrap;
}
async function uploadPlannedPhoto(slot,index,file){
 if(!file||!edit||!C.canEdit(user,edit)||uploading)return;
 if(edit.photos.length>=12)throw new Error('사진은 기사당 최대 12장입니다.');
 uploading=true;const root=$('#uploadProgress');
 try{root.textContent='사진 슬롯 준비 중…';const d=await preparePhoto(file,edit.id);
  d.photo.caption=(slot.caption||'').replace(/ · 실제 현장 사진으로 교체 필요$/,'').slice(0,300);
  const slotAlt=String(slot.alt||'');d.photo.alt=(/교체|예시|placeholder/i.test(slotAlt)?file.name.replace(/\.[^.]+$/,''):slotAlt||file.name.replace(/\.[^.]+$/,'')).slice(0,200);
  await store.upload(edit.id,d.photo,d.original,d.web,v=>{root.textContent='사진 저장 '+Math.round(v*100)+'%';});
  const at=Math.min(index,edit.photos.length);edit.photos.splice(at,0,d.photo);changed();await save();await renderPhotoGrid();renderPreflight();toast((index+1)+'번 사진 슬롯을 채웠습니다.');
 }finally{uploading=false;root.textContent='';}
}
function movePhoto(sourceId,targetIndex){
 if(!edit)return;const from=edit.photos.findIndex(x=>x.id===sourceId);if(from<0||targetIndex<0||targetIndex>=edit.photos.length||from===targetIndex)return;
 const [p]=edit.photos.splice(from,1);edit.photos.splice(targetIndex,0,p);changed();renderPhotoGrid();renderPreflight();
}
async function openEditor(id){
 if(edit&&!(await leaveEditor()))return;edit=await store.getArticle(id);dirty=false;editSequence=0;view='editor';refreshHeader();const writable=C.canEdit(user,edit);
 const title=h('input',{id:'articleTitle',value:edit.title,placeholder:'기사 제목',maxlength:150,'aria-label':'기사 제목',disabled:!writable});
 const body=h('textarea',{id:'articleBody',value:edit.body,placeholder:'이 기사의 원고를 작성하세요.\n\n문단 사이에는 빈 줄을 넣고, 소제목은 위 버튼으로 나눌 수 있습니다.',maxlength:45000,'aria-label':'기사 본문',disabled:!writable});
 const deck=h('input',{id:'articleDeck',value:edit.deck,maxlength:350,disabled:!writable});const byline=h('input',{id:'articleByline',value:edit.byline||'',maxlength:80,disabled:!writable});
 const format=button('소제목 넣기',()=>{const start=body.selectionStart,end=body.selectionEnd,selected=body.value.slice(start,end)||'소제목';body.setRangeText(`\n\n## ${selected.replace(/\n/g,' ')}\n\n`,start,end,'end');body.focus();changed();});format.disabled=!writable;
 const writing=h('div',{class:'writing'},title,h('div',{class:'meta-grid'},h('label',{},'부제 · 선택',deck),h('label',{},'기사에 표시할 필자명',byline)),h('div',{class:'formatbar'},format,h('span',{class:'small muted',id:'charCount'},`${edit.body.length.toLocaleString()}자`)),body);
 for(const e of [title,body,deck,byline])e.addEventListener('input',changed);
 const side=h('aside',{class:'editor-side'},h('div',{class:'panel'},h('h3',{},'제출 전에'),h('ul',{class:'steps'},h('li',{},'제목과 필자명을 확인합니다.'),h('li',{},'본문은 60자 이상 작성합니다.'),h('li',{},edit.minPhotos?`사진은 ${edit.minPhotos}장 이상 · 최대 12장`:'사진을 추가할 수 있습니다. 원본에 필수 장수는 미정입니다.'),h('li',{},'제출 후에는 검토가 끝날 때까지 잠깁니다.'))));
 if(writable){side.firstChild.append(button('저장하고 제출',async()=>{if(uploading)throw new Error('사진 저장이 끝난 뒤 제출해 주세요.');changed();await save();edit=await store.transition(edit.id,edit.revision,'submitted');toast('검토 요청을 보냈습니다.');const key=edit.id;edit=null;await openEditor(key);},'primary'));}
 if(C.staff(user)&&['submitted','approved'].includes(edit.status))side.firstChild.append(button('수정 요청',()=>reviewDialog('changes')));
 if(C.teacher(user)&&edit.status==='submitted')side.firstChild.append(button('승인하기',()=>reviewDialog('approved'),'primary'));
 if(C.teacher(user)&&edit.status==='approved'){
 const pub=button('웹진에 발행',async()=>{if(!edit.webConsent)throw new Error('웹 공개 동의가 확인되지 않았습니다. 수정 요청 후 다시 승인해 주세요.');if(!confirm('승인된 이 원고와 사진을 외부에서 읽을 수 있게 공개할까요?'))return;await store.publish(edit.id,edit.revision);toast('웹진 공개본을 저장했습니다.');});pub.disabled=!edit.webConsent;side.firstChild.append(pub);
 side.firstChild.append(button('웹 공개 회수',async()=>{if(confirm('공개 웹진에서 이 기사를 내릴까요? 원고와 인쇄 확정본은 유지됩니다.')){await store.unpublish(edit.id);toast('공개를 회수했습니다.');}},'danger'));
 side.firstChild.append(h('p',{class:'small muted'},`웹 공개 동의 ${edit.webConsent?'확인':'미확인'} · 책 수록 ${edit.printConsent?'확인':'미확인'}`));}
 side.append(h('div',{class:'panel',id:'v4Preflight','aria-live':'polite'}));side.append(h('div',{class:'panel ai-editor-panel',id:'aiEditorPanel','aria-live':'polite'}));
 side.append(h('div',{class:'panel'},h('h3',{},'기록과 미리보기'),button('기사 미리보기',async()=>{const a={...edit,...readEditor()};const content=await renderArticle(a);dialogOpen('발행 전 미리보기',content);}),button('수정 이력 보기',historyDialog),button('내 원고 사본 받기',()=>textDownload(JSON.stringify({...edit,...readEditor()},null,2),'woonbi-article-backup.json'))));
 const file=h('input',{type:'file',multiple:true,accept:'image/jpeg,image/png,image/webp',hidden:true,id:'photoInput'});file.addEventListener('change',()=>uploadFiles(file.files).catch(showError));
 const drop=h('div',{class:'photo-dropzone',role:'button',tabindex:writable?0:-1,'aria-disabled':String(!writable)},h('strong',{},'사진을 여기로 끌어오거나 눌러 선택'),h('span',{},'JPG · PNG · WebP / 장당 25MB / 웹용 WebP 자동 생성'));
 if(writable){drop.addEventListener('click',()=>file.click());drop.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();file.click();}});for(const ev of ['dragenter','dragover'])drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('is-drag');});for(const ev of ['dragleave','drop'])drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('is-drag');});drop.addEventListener('drop',e=>uploadFiles(e.dataTransfer.files).catch(showError));}
 const planPanel=photoPlanPanel(edit,writable);
 const photos=h('section',{class:'editor-photos'},h('div',{class:'photo-section-head'},h('div',{},h('h2',{},'사진'),h('p',{class:'muted small'},'첫 번째 사진이 대표사진입니다. 원본은 비공개 보관하고 1600px 이하 WebP 공개용 파생본을 자동 생성합니다.')),h('span',{class:'photo-count'},edit.photos.length+'/12')),file,drop,h('div',{class:'photo-tools'},button('사진 여러 장 올리기',()=>{if(writable)file.click();})),planPanel,h('div',{id:'uploadProgress','aria-live':'polite'}),h('div',{class:'photo-grid',id:'photoGrid'}));
 if(!writable){drop.classList.add('disabled');photos.querySelector('.photo-tools').hidden=true;}
 const top=h('div',{class:'editor-top'},button('← 기사 목록',()=>navigate('articles'),'text'),h('span',{class:'badge '+edit.status},articleState(edit)),h('span',{id:'saveStatus',class:'save-status'},store.mode==='demo'?(store.persistence==='memory'?'이 탭에만 임시 저장됨':'이 기기에 저장됨'):'학교 서버에서 불러옴'));
 main.replaceChildren(top,h('div',{class:'notice',id:'remoteNotice',hidden:true},'기사가 변경되었습니다. 같은 원고를 다른 탭에서 편집했다면 저장할 때 버전을 다시 확인합니다.'),h('div',{class:'notice error',id:'conflictBox',hidden:true}),h('div',{class:'editor-grid'},h('div',{},edit.feedback?h('div',{class:'notice warn'},h('b',{},'수정 의견'),h('p',{},edit.feedback)):null,planBrief(edit),edit.contentOrigin?newsroom.editorialNotes(edit):null,writing,h('div',{style:'height:28px'}),photos),side));
 const presence=h('div',{class:'presence-line',id:'presenceLine',hidden:true});main.insertBefore(presence,main.children[1]);
 if(writable&&typeof store.watchEditors==='function'){presence.hidden=false;presence.textContent='공동 편집 상태 확인 중…';presenceStop=store.watchEditors(edit.id,rows=>{presence.replaceChildren();if(!rows.length){presence.textContent='현재 이 원고를 다른 편집자가 열어두고 있지 않습니다.';return;}presence.append(h('strong',{},'함께 열어둔 사람 '),document.createTextNode(rows.map(x=>x.displayName).join(' · ')+' · 저장 시 버전 충돌을 확인합니다.'));});}
 const buf=W.session.getItem(bufferKey());if(buf&&writable){const saved=JSON.parse(buf);main.prepend(h('div',{class:'notice recovery'},h('p',{},'이 탭에 서버 저장을 마치지 못한 원고가 있습니다.'),button('임시 원고 복구',()=>{title.value=saved.patch.title;body.value=saved.patch.body;deck.value=saved.patch.deck;byline.value=saved.patch.byline;edit.photos=saved.patch.photos;edit.revision=saved.revision;changed();renderPhotoGrid();}),button('임시 사본 받기',()=>textDownload(JSON.stringify(saved,null,2),'woonbi-recovery.json'))));}
 await renderPhotoGrid();renderPreflight();renderAiGuard();window.scrollTo(0,0);
}
async function reviewDialog(target){const a=edit,form=h('div');if(target==='changes')form.append(h('label',{},'수정할 내용',h('textarea',{id:'feedbackInput',rows:5,maxlength:2500,placeholder:'어떤 부분을 보완하면 좋을지 적어 주세요.'})));
 else form.append(h('p',{},'내용 승인은 공개 발행과 다릅니다. 동의를 확인한 매체만 선택합니다.'),h('label',{class:'check'},h('input',{type:'checkbox',id:'factConsent'}),'초안의 사실·인용·실제 필자와 사진 출처를 확인했습니다.'),h('label',{class:'check'},h('input',{type:'checkbox',id:'webConsent'}),'학생·사진 등 웹 공개 동의 범위를 확인했습니다.'),h('label',{class:'check'},h('input',{type:'checkbox',id:'printConsent'}),'종이 교지 수록 동의 범위를 확인했습니다.'));
 dialogOpen(target==='changes'?'수정 요청':'기사 승인',form,[button(target==='changes'?'요청 보내기':'승인 저장',async()=>{if(target==='approved'&&!$('#factConsent').checked)throw new Error('발행 전 원고 확인 항목을 먼저 확인해 주세요.');const options=target==='changes'?{feedback:$('#feedbackInput').value}:{webConsent:$('#webConsent').checked,printConsent:$('#printConsent').checked};const next=await store.transition(a.id,a.revision,target,options);dialog.close();edit=null;await openEditor(next.id);toast('검토 결과를 저장했습니다.');},'primary')]);}
async function historyDialog(){
 const rows=await store.history(edit.id),list=h('div');
 if(!rows.length)list.append(h('p',{},'첫 수정 이후 이력이 남습니다.'));
 for(const r of rows){
  const open=button('이 원고 확인',()=>{
   const content=h('div',{},h('h3',{},r.snapshot.title),h('pre',{style:'white-space:pre-wrap;overflow-wrap:anywhere;font:inherit'},r.snapshot.body));
   dialogOpen(`버전 ${r.snapshot.revision}`,content,[button('사본 받기',()=>textDownload(JSON.stringify(r.snapshot,null,2),'woonbi-revision.json'))]);
  });
  list.append(h('div',{class:'archive-row'},h('span',{},`버전 ${r.snapshot.revision} · ${C.STATUS[r.snapshot.status]} · ${r.snapshot.updatedAt.slice(0,16).replace('T',' ')}`),open));
 }
 dialogOpen('수정 이력 · 최근 기록',list);
}
async function mediaUrl(path){if(urls.has(path))return urls.get(path);const blob=await store.mediaBlob(path),u=URL.createObjectURL(blob);urls.set(path,u);return u;}
async function imageNode(p){const img=h('img',{alt:p.alt||p.caption||'기사 사진',width:p.width||1200,height:p.height||800,loading:'lazy'});if(p.sourceAsset){img.src=p.sourceAsset;return img;}try{img.src=await mediaUrl(p.webPath);}catch{img.replaceWith?.();return h('div',{class:'notice warn'},'사진을 불러오지 못했습니다. 원고는 그대로 보존됩니다.');}return img;}
async function replacePhoto(id,file){
 if(!file||!edit||!C.canEdit(user,edit)||uploading)return;
 const index=edit.photos.findIndex(p=>p.id===id);if(index<0)return;
 uploading=true;const previous=C.clone(edit.photos[index]);const root=$('#uploadProgress');
 try{root.textContent='교체할 사진 준비 중…';const d=await preparePhoto(file,edit.id);await store.upload(edit.id,d.photo,d.original,d.web,v=>{root.textContent='사진 교체 '+Math.round(v*100)+'%';});
 edit.photos[index]=W.editorial.replace(previous,d.photo);changed();await save();await renderPhotoGrid();renderPreflight();toast('사진을 교체했습니다. 본문 위치는 유지했습니다.');
 }catch(e){if(edit.photos[index]?.id!==previous.id){edit.photos[index]=previous;buffer();}throw e;}
 finally{uploading=false;root.textContent='';}
}
async function renderPhotoGrid(){const grid=$('#photoGrid');if(!grid||!edit)return;const a=edit;grid.replaceChildren();const counter=document.querySelector('.photo-count');if(counter)counter.textContent=a.photos.length+'/12';for(let i=0;i<a.photos.length;i++){const p=a.photos[i],writable=C.canEdit(user,a),box=h('div',{class:'photo-box'});box.dataset.photoId=p.id;box.draggable=writable;if(writable){box.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',p.id);e.dataTransfer.effectAllowed='move';box.classList.add('is-dragging');});box.addEventListener('dragend',()=>box.classList.remove('is-dragging'));box.addEventListener('dragover',e=>{e.preventDefault();box.classList.add('drag-over');});box.addEventListener('dragleave',()=>box.classList.remove('drag-over'));box.addEventListener('drop',e=>{e.preventDefault();box.classList.remove('drag-over');const source=e.dataTransfer.getData('text/plain');movePhoto(source,i);});}box.append(await imageNode(p));if(W.editorial.sample(p))box.append(h('span',{class:'sample-badge'},'교체용 예시 · 올해 현장 아님'));const caption=h('input',{value:p.caption,maxlength:300,disabled:!writable}),alt=h('input',{value:p.alt,maxlength:200,disabled:!writable}),pos=h('select',{disabled:!writable},h('option',{value:-1},i===0?'자동 · 대표사진':'자동 · 본문 사이'));
 for(let k=0;k<C.blocks(readEditor().body).length;k++)pos.append(h('option',{value:k},`${k+1}번째 문단 뒤`));pos.value=p.after;
 const livePhoto=()=>edit?.photos.find(x=>x.id===p.id);caption.addEventListener('input',()=>{const x=livePhoto();if(x){x.caption=caption.value;changed();}});alt.addEventListener('input',()=>{const x=livePhoto();if(x){x.alt=alt.value;changed();}});pos.addEventListener('change',()=>{const x=livePhoto();if(x){x.after=Number(pos.value);changed();}});
 box.append(h('label',{},'사진 설명 · 선택',caption),h('label',{},'사진 대체 설명',alt),h('label',{},'배치 위치',pos),h('span',{class:'small muted'},`${p.width}×${p.height} · 원본 ${(p.originalBytes/1024/1024).toFixed(1)}MB`));
 if(writable){const replacement=h('input',{type:'file',accept:'image/jpeg,image/png,image/webp',class:'replace-input',hidden:true,'aria-label':'이 사진 교체'});replacement.addEventListener('change',()=>replacePhoto(p.id,replacement.files[0]).catch(showError));box.append(replacement,button('사진 교체',()=>replacement.click(),'replace-photo'));}
 if(writable)box.append(h('div',{class:'actions photo-order'},i>0?button('대표사진',()=>movePhoto(p.id,0),'text'):h('span',{class:'cover-mark'},'대표사진'),i>0?button('← 앞으로',()=>movePhoto(p.id,i-1),'text'):null,i<a.photos.length-1?button('뒤로 →',()=>movePhoto(p.id,i+1),'text'):null,button('기사에서 빼기',()=>{if(!confirm('이 사진을 기사에서 뺄까요? 저장된 원본과 이전 버전은 삭제하지 않습니다.'))return;edit.photos=edit.photos.filter(x=>x.id!==p.id);changed();renderPreflight();return renderPhotoGrid();},'remove danger')));grid.append(box);}
 if(!a.photos.length)grid.append(h('div',{class:'empty',style:'grid-column:1/-1'},'사진을 선택하면 이곳에서 설명과 배치를 확인합니다.'));}
async function preparePhoto(file,aid){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('JPG, PNG, WebP 사진을 선택해 주세요. HEIC는 JPG로 저장한 뒤 올려 주세요.');
 if(file.size>25*1024*1024||file.size===0)throw new Error('사진은 1장당 25MB까지 올릴 수 있습니다.');
 const sig=W.editorial.signature(await file.slice(0,16).arrayBuffer());if(sig!==file.type)throw new Error('확장자와 실제 사진 형식이 다릅니다. JPG·PNG·WebP 원본을 확인하세요.');
 const bitmap=await createImageBitmap(file);if(bitmap.width*bitmap.height>45000000){bitmap.close();throw new Error('사진 해상도가 너무 큽니다. 4,500만 화소 이하로 줄여 주세요.');}
 const ratio=Math.min(1,1600/Math.max(bitmap.width,bitmap.height)),c=document.createElement('canvas');c.width=Math.round(bitmap.width*ratio);c.height=Math.round(bitmap.height*ratio);c.getContext('2d').drawImage(bitmap,0,0,c.width,c.height);
 const width=bitmap.width,height=bitmap.height;bitmap.close();const web=await new Promise(r=>c.toBlob(r,'image/webp',.84));if(!web||web.type!=='image/webp')throw new Error('이 브라우저에서 웹용 사진 변환을 지원하지 않습니다.');
 const id=C.uuid(),base=`private/${aid}/${id}`;return {photo:{id,caption:'',alt:file.name.replace(/\.[^.]+$/,'').slice(0,200),after:-1,width,height,originalBytes:file.size,originalType:file.type,originalPath:base+'/original',webPath:base+'/web.webp'},original:file,web};
}
async function uploadFiles(files){if(!edit||!C.canEdit(user,edit)||uploading)return;const list=Array.from(files);if(edit.photos.length+list.length>12)throw new Error('사진은 기사당 최대 12장입니다.');uploading=true;const root=$('#uploadProgress');try{for(let i=0;i<list.length;i++){root.replaceChildren(h('span',{class:'small'},`${i+1}/${list.length} · 웹용 사진 준비 중`));const data=await preparePhoto(list[i],edit.id),progress=h('progress',{max:1,value:0}),label=h('span',{class:'small'},`${i+1}/${list.length} 저장 중`);root.replaceChildren(h('div',{class:'progress'},progress,label));await store.upload(edit.id,data.photo,data.original,data.web,v=>{progress.value=v;label.textContent=`${i+1}/${list.length} · ${Math.round(v*100)}%`;});edit.photos.push(data.photo);changed();await save();await renderPhotoGrid();renderPreflight();}toast('사진과 원고를 저장했습니다.');}finally{uploading=false;root.replaceChildren();$('#photoInput').value='';}}
async function renderArticle(a){const article=h('article',{class:'read-article'},h('div',{class:'eyebrow'},a.category),h('h1',{},a.title),a.deck?h('p',{class:'deck'},a.deck):null,h('p',{class:'read-meta'},a.byline||'필자명 미입력'));const copy=h('div',{class:'read-copy'}),pos=C.photoPositions(a);async function addPhotos(key){for(const p of pos.get(key)||[]){const fig=h('figure',{class:p.lastYearSample?'lastyear-detail':p.restored?'restored-detail':''},await imageNode(p));const cap=h('figcaption',{});if(p.lastYearSample)cap.append(h('strong',{class:'lastyear-badge'},'지난 호 자료사진'));else if(p.restored)cap.append(h('strong',{class:'restored-badge'},'복원 자료'));else if(W.editorial.sample(p))cap.append(h('strong',{class:'sample-badge'},'교체용 예시 · 실제 현장 아님'));if(p.caption)cap.append(document.createTextNode(p.caption));if(p.credit)cap.append(h('span',{class:'photo-credit'},'사진 · '+p.credit));fig.append(cap);copy.append(fig);}}
 await addPhotos(-1);for(const b of C.blocks(a.body)){copy.append(h(b.kind==='heading'?'h3':'p',{},b.text));await addPhotos(b.i);}article.append(copy);return article;}
async function legacyRenderPublic(){const pub=(await store.listPublic()).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));const head=h('div',{class:'public-heading'},h('div',{class:'eyebrow'},'WOONBI · POHANG HIGH SCHOOL'),h('h1',{},'우리의 학교,\n우리의 이야기.'),h('p',{class:'intro'},'학교의 하루를 학생의 글과 사진으로 기록합니다.'));const grid=h('div',{class:'public-grid'});main.replaceChildren(head,grid);
 if(!pub.length)grid.append(h('div',{class:'empty'},'아직 발행된 기사가 없습니다. 승인 후 발행한 기사만 이곳에 올라옵니다.'));
 for(const a of pub){const card=h('article',{class:'public-card'});if(a.photos[0])card.append(await imageNode(a.photos[0]));else card.append(h('div',{class:'cover-placeholder'},a.category));card.append(h('div',{class:'eyebrow',style:'margin-top:17px'},a.category),h('h2',{},a.title),h('p',{},a.deck||C.paragraphs(a.body)[0]?.slice(0,120)||''),h('p',{class:'small'},a.byline),button('기사 읽기 →',async()=>dialogOpen('웅비 웹진',await renderArticle(a)),'text'));grid.append(card);}
}
async function renderPublic(){return newsroom.home();}
async function renderDashboard(){
 if(!C.teacher(user))return renderPending();
 const [articles,members,published]=await Promise.all([store.listArticles(),store.listMembers(),store.listPublic()]);
 dashboardSelection=new Set([...dashboardSelection].filter(id=>articles.some(a=>a.id===id)));
 const pubIds=new Set(published.map(a=>a.id)),today=new Date().toISOString().slice(0,10);
 const bodyReady=a=>String(a.body||'').trim().length>=60;
 const photoReady=a=>a.photos.length>=Number(a.minPhotos||0)&&!a.photos.some(W.editorial.sample);
 const unstarted=articles.filter(a=>a.status==='draft'&&!bodyReady(a));
 const photoShort=articles.filter(a=>a.photos.length<Number(a.minPhotos||0)||a.photos.some(W.editorial.sample));
 const review=articles.filter(a=>a.status==='submitted');
 const changes=articles.filter(a=>a.status==='changes');
 const publishReady=articles.filter(a=>a.status==='approved'&&a.webConsent&&!pubIds.has(a.id));
 const overdue=articles.filter(a=>a.dueDate&&a.dueDate<today&&a.status!=='approved');
 const complete=articles.filter(a=>bodyReady(a)&&photoReady(a));
 const metrics=[
  ['전체 기사',articles.length,'기사 계획'],['원고 진행',complete.length,articles.length?Math.round(complete.length/articles.length*100)+'%':'0%'],
  ['미작성',unstarted.length,'60자 미만'],['사진 부족',photoShort.length,'필수 장수·예시'],['검토 대기',review.length,'제출 원고'],['발행 대기',publishReady.length,'승인·웹동의']
 ];
 const head=h('div',{class:'dashboard-head'},h('div',{},h('div',{class:'eyebrow'},'EDITORIAL CONTROL DESK'),h('h1',{},'웅비 편집장 대시보드'),h('p',{class:'intro'},'학생별 진행률과 미제출·사진 부족·검토·발행 대기를 한 화면에서 확인합니다.')),h('div',{class:'dashboard-stamp'},'기준 '+new Date().toLocaleString('ko-KR')));
 const cards=h('section',{class:'dashboard-metrics'},metrics.map(([label,value,note])=>h('article',{},h('span',{},label),h('strong',{},value),h('small',{},note))));
 const due=h('input',{type:'date','aria-label':'선택 기사 마감일'}),message=h('input',{type:'text',maxlength:300,value:'원고와 사진 진행 상황을 확인해 주세요.','aria-label':'학생 알림 문구'}),selected=h('b',{},dashboardSelection.size+'개 선택');
 function refreshSelected(){selected.textContent=dashboardSelection.size+'개 선택';}
 function selectedArticles(){return articles.filter(a=>dashboardSelection.has(a.id));}
 function reminderCopy(rows,msg){
  const groups=new Map();for(const a of rows){for(const name of a.assigneeNames||[a.byline||'학생']){if(!groups.has(name))groups.set(name,[]);groups.get(name).push(a);}}
  return [...groups.entries()].map(([name,aa])=>name+'\n'+aa.map(a=>'• '+a.title+(a.dueDate?' · 마감 '+a.dueDate:'')).join('\n')+'\n'+msg).join('\n\n');
 }
 const actions=h('section',{class:'dashboard-actions'},h('div',{class:'dashboard-action-title'},h('div',{},h('span',{class:'eyebrow'},'BATCH DESK'),h('h2',{},'선택 기사 일괄 작업')),selected),h('div',{class:'dashboard-action-controls'},h('label',{},'마감일',due),h('label',{class:'grow'},'알림 문구',message),button('마감일 변경',async()=>{const ids=[...dashboardSelection];if(!ids.length)return toast('먼저 기사를 선택해 주세요.');if(!due.value)return toast('마감일을 선택해 주세요.');const r=await store.batchUpdateDueDates(ids,due.value);toast('마감일 '+r.updated.length+'건 변경 · 건너뜀 '+r.skipped.length+'건');dashboardSelection.clear();await renderDashboard();},'primary'),button('인앱 알림',async()=>{const rows=selectedArticles();if(!rows.length)return toast('먼저 기사를 선택해 주세요.');const r=await store.sendReminders(rows.map(a=>a.id),message.value||'진행 상황을 확인해 주세요.','reminder');if(r.unlinked.length)await copyText(reminderCopy(rows,message.value));toast('인앱 알림 '+r.sent.length+'건'+(r.unlinked.length?' · 미연결 학생 안내문 복사':'') );},'primary'),button('안내문 복사',async()=>{const rows=selectedArticles();if(!rows.length)return toast('먼저 기사를 선택해 주세요.');await copyText(reminderCopy(rows,message.value));},'text'),button('선택 초기화',()=>{dashboardSelection.clear();renderDashboard();},'text')));
 function queue(title,rows,note,cls=''){
  const chooseAll=button('목록 선택',()=>{for(const a of rows)dashboardSelection.add(a.id);refreshSelected();box.querySelectorAll('input[type=checkbox]').forEach(x=>x.checked=true);},'text');
  const box=h('section',{class:'dashboard-queue '+cls},h('div',{class:'dashboard-section-head'},h('div',{},h('h2',{},title),h('p',{class:'small muted'},note)),h('div',{class:'dashboard-head-actions'},h('b',{},rows.length),chooseAll)));
  const list=h('div',{class:'dashboard-list'});if(!rows.length)list.append(h('p',{class:'empty'},'현재 해당 기사가 없습니다.'));
  for(const a of [...rows].sort((x,y)=>(x.dueDate||'9999').localeCompare(y.dueDate||'9999')||(x.planOrder||999)-(y.planOrder||999))){
   const check=h('input',{type:'checkbox',checked:dashboardSelection.has(a.id),'aria-label':a.title+' 선택'});check.addEventListener('change',()=>{check.checked?dashboardSelection.add(a.id):dashboardSelection.delete(a.id);refreshSelected();});
   list.append(h('article',{},check,h('div',{},h('span',{class:'row-category'},a.category),h('h3',{},a.title),h('p',{class:'small muted'},articleNames(a)+' · '+(a.dueDate?'마감 '+a.dueDate:'마감 미정')+' · '+String(a.body||'').length.toLocaleString()+'자 · 사진 '+a.photos.length+'/'+Number(a.minPhotos||0))),button('열기',()=>openEditor(a.id),'text')));
  }box.append(list);return box;
 }
 const queues=h('div',{class:'dashboard-queues'},queue('미작성',unstarted,'본문 60자 미만'),queue('사진 부족',photoShort,'필수 사진 미달 또는 교체용 예시'),queue('검토 대기',review,'학생이 제출한 원고','review'),queue('수정 요청',changes,'보완 후 재제출 필요'),queue('발행 대기',publishReady,'승인 완료·웹 공개 동의 확인'),queue('마감 지남',overdue,'승인 전 마감일 경과','danger'));
 const people=new Map(),memberNames=new Map(members.map(m=>[m.uid,m.displayName||'승인 계정']));
 for(const a of articles){const ids=a.assigneeIds||[],names=a.assigneeNames||[];ids.forEach((uid,i)=>{const name=(names[i]||memberNames.get(uid)||'원본 배정 미연결').trim(),key='name:'+name;if(!people.has(key))people.set(key,{name,assigned:0,ready:0,submitted:0,approved:0,photoShort:0});const p=people.get(key);p.assigned++;if(bodyReady(a)&&photoReady(a))p.ready++;if(a.status==='submitted')p.submitted++;if(a.status==='approved')p.approved++;if(!photoReady(a))p.photoShort++;});}
 for(const m of members){if(m.role==='teacher')continue;const name=(m.displayName||'승인 계정').trim(),key='name:'+name;if(!people.has(key))people.set(key,{name,assigned:0,ready:0,submitted:0,approved:0,photoShort:0});}
 const peopleRows=[...people.values()].sort((a,b)=>b.assigned-a.assigned||a.name.localeCompare(b.name));
 const table=h('div',{class:'dashboard-people'},h('div',{class:'dashboard-section-head'},h('div',{},h('h2',{},'학생별 진행률'),h('p',{class:'small muted'},'배정 기사 기준 · Google 계정 연결 여부와 무관하게 원래 배정명도 표시합니다.'))));
 const progressRows=h('div',{class:'progress-table'});progressRows.append(h('div',{class:'progress-row head'},...['이름','배정','원고+사진','검토대기','승인','사진부족'].map(x=>h('span',{},x))));
 for(const p of peopleRows){const pct=p.assigned?Math.round(p.ready/p.assigned*100):0,prog=h('div',{class:'student-progress'},h('span',{},p.ready+'/'+p.assigned),h('progress',{max:100,value:pct}),h('small',{},pct+'%'));progressRows.append(h('div',{class:'progress-row'},h('b',{},p.name),h('span',{},p.assigned),prog,h('span',{},p.submitted),h('span',{},p.approved),h('span',{},p.photoShort)));}
 table.append(progressRows);
 const notSubmitted=articles.filter(a=>!['submitted','approved'].includes(a.status));
 const exportBar=h('section',{class:'dashboard-export'},h('div',{},h('span',{class:'eyebrow'},'REPORTS'),h('h2',{},'출력·엑셀·미제출 명단'),h('p',{class:'small muted'},'교감 보고나 편집회의용 A4 출력과 CSV 파일을 바로 만들 수 있습니다.')),h('div',{class:'dashboard-export-actions'},
  button('A4 현황 인쇄',async()=>{$('#printArea').replaceChildren(dashboardPrintNode(articles,peopleRows,'기준 '+new Date().toLocaleString('ko-KR')));await document.fonts.ready;window.print();},'primary'),
  button('전체 기사 CSV',()=>downloadCsv(['번호','코너','기사','담당','상태','마감','본문자수','사진','필수사진'],articles.map(a=>[a.planOrder||'',a.category,a.title,articleNames(a),statusLabel(a),a.dueDate||'',String(a.body||'').length,a.photos.length,a.minPhotos]),'woonbi-articles.csv')),
  button('학생별 CSV',()=>downloadCsv(['학생','배정','원고+사진 완료','검토대기','승인','사진부족'],peopleRows.map(p=>[p.name,p.assigned,p.ready,p.submitted,p.approved,p.photoShort]),'woonbi-student-progress.csv')),
  button('미제출자 CSV',()=>downloadCsv(['학생','기사','상태','마감','본문자수','사진'],notSubmitted.flatMap(a=>(a.assigneeNames?.length?a.assigneeNames:[a.byline||'학생']).map(n=>[n,a.title,statusLabel(a),a.dueDate||'',String(a.body||'').length,a.photos.length+'/'+Number(a.minPhotos||0)])),'woonbi-not-submitted.csv')),
  button('미제출 명단 복사',()=>copyText(notSubmitted.map(a=>(a.assigneeNames?.join(' · ')||a.byline||'학생')+' — '+a.title+(a.dueDate?' · '+a.dueDate:'')).join('\n')),'text')
 ));
 main.replaceChildren(head,cards,actions,exportBar,queues,table);
}
function photoTokens(value){
 return [...new Set((String(value||'').normalize('NFC').toLocaleLowerCase('ko').match(/[가-힣a-z0-9]{2,}/g)||[]).filter(x=>!/^(img|image|photo|사진|촬영|kakao|screen|screenshot|dcim|camera|jpeg|jpg|png|webp|dsc|pxl|mvimg|download)$/.test(x)))];
}
function scorePhotoArticle(row,a){
 const fileTokens=new Set(photoTokens(row.path+' '+row.name)),articleTokens=photoTokens([a.title,a.sourceTitle,a.category,a.byline,...(a.assigneeNames||[])].join(' '));
 let score=0,hits=[];for(const t of articleTokens){if(fileTokens.has(t)){const w=(a.assigneeNames||[]).some(n=>photoTokens(n).includes(t))?6:t.length>=4?4:2;score+=w;hits.push(t);}}
 const norm=s=>String(s||'').normalize('NFC').toLocaleLowerCase('ko'),compact=s=>norm(s).replace(/[^가-힣a-z0-9]+/g,'');
 const normPath=norm(row.path);for(const n of a.assigneeNames||[]){const x=norm(n).trim();if(x&&normPath.includes(x)){score+=8;hits.push(n);}}
 const titleNorm=compact(a.title);if(titleNorm.length>=4&&compact(row.path).includes(titleNorm.slice(0,Math.min(8,titleNorm.length))))score+=10;
 // Korean filenames often remove spaces: "전선없이전기" should still match "전선 없이 전기는 어떻게 이동할까".
 const articleCompacts=[a.title,a.sourceTitle,a.category,a.byline,...(a.assigneeNames||[])].map(compact).filter(Boolean);
 for(const ft of fileTokens){if(ft.length<4)continue;const fc=compact(ft);if(fc.length<4)continue;for(const ac of articleCompacts){if(ac.length>=4&&(ac.includes(fc)||fc.includes(ac))){score+=Math.min(10,4+Math.floor(Math.min(fc.length,ac.length)/2));hits.push(ft);break;}}}
 return {score,hits:[...new Set(hits)]};
}
async function photoDimensions(file){
 try{const bmp=await createImageBitmap(file);const out={width:bmp.width,height:bmp.height};bmp.close();return out;}catch{return {width:0,height:0};}
}
async function photoExactHash(file){
 const buf=await file.arrayBuffer(),hash=await crypto.subtle.digest('SHA-256',buf);return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function photoAverageColor(file){
 try{const bmp=await createImageBitmap(file),c=document.createElement('canvas');c.width=1;c.height=1;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bmp,0,0,1,1);bmp.close();const d=ctx.getImageData(0,0,1,1).data;return [d[0],d[1],d[2]];}catch{return [0,0,0];}
}
function photoColorDistance(a,b){if(!a||!b)return 999;return Math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2);}
async function photoDHash(file){
 try{const bmp=await createImageBitmap(file),c=document.createElement('canvas');c.width=9;c.height=8;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bmp,0,0,9,8);bmp.close();const d=ctx.getImageData(0,0,9,8).data;let bits='';for(let y=0;y<8;y++)for(let x=0;x<8;x++){const i=(y*9+x)*4,j=i+4,g=d[i]*.299+d[i+1]*.587+d[i+2]*.114,h=d[j]*.299+d[j+1]*.587+d[j+2]*.114;bits+=g>h?'1':'0';}let hex='';for(let i=0;i<bits.length;i+=4)hex+=parseInt(bits.slice(i,i+4),2).toString(16);return hex;}catch{return '';}
}
function photoHashDistance(a,b){if(!a||!b||a.length!==b.length)return 99;let n=0;for(let i=0;i<a.length;i++){let x=parseInt(a[i],16)^parseInt(b[i],16);while(x){n+=x&1;x>>=1;}}return n;}
function scanPreview(row){const key='scan:'+row.key;if(urls.has(key))return urls.get(key);const u=URL.createObjectURL(row.file);urls.set(key,u);return u;}
async function scanPhotoFolder(files,articles,onProgress){
 const list=[...files].filter(f=>/^image\/(jpeg|png|webp)$/i.test(f.type)||/\.(jpe?g|png|webp)$/i.test(f.name)).slice(0,500),rows=[],exact=new Map();
 for(let i=0;i<list.length;i++){const file=list[i],path=file.webkitRelativePath||file.name,dims=await photoDimensions(file),hash=await photoExactHash(file),dhash=await photoDHash(file),avgColor=await photoAverageColor(file),row={key:'f'+i,file,name:file.name,path,size:file.size,lastModified:file.lastModified,width:dims.width,height:dims.height,hash,dhash,avgColor,duplicateOf:'',nearDuplicateOf:'',articleId:'',score:0,hits:[],selected:false};
  if(exact.has(hash))row.duplicateOf=exact.get(hash).name;else exact.set(hash,row);
  const ranked=articles.map(a=>({a,...scorePhotoArticle(row,a)})).sort((x,y)=>y.score-x.score||(x.a.planOrder||999)-(y.a.planOrder||999));if(ranked[0]?.score>0){row.articleId=ranked[0].a.id;row.score=ranked[0].score;row.hits=ranked[0].hits;}const existing=articles.flatMap(a=>(a.photos||[]).map(p=>({a,p}))).find(x=>Number(x.p.originalBytes)===file.size&&Number(x.p.width)===dims.width&&Number(x.p.height)===dims.height);row.existingCandidate=existing?existing.a.title:'';
  rows.push(row);onProgress?.(i+1,list.length);
 }
 for(let i=0;i<rows.length;i++){if(rows[i].duplicateOf||!rows[i].dhash)continue;for(let j=0;j<i;j++){if(rows[j].duplicateOf||!rows[j].dhash)continue;const dist=photoHashDistance(rows[i].dhash,rows[j].dhash),color=photoColorDistance(rows[i].avgColor,rows[j].avgColor);if(dist<=3&&color<=12){rows[i].nearDuplicateOf=rows[j].name;break;}}}
 photoScanState={rows,duplicates:rows.filter(x=>x.duplicateOf).length,nearDuplicates:rows.filter(x=>x.nearDuplicateOf&&!x.duplicateOf).length,selected:new Set()};
 return photoScanState;
}
async function connectScannedRows(rows){
 const selected=rows.filter(r=>r.selected&&r.articleId&&!r.duplicateOf&&!r.nearDuplicateOf),result={done:0,skipped:[]};
 for(const row of selected){try{let current=await store.getArticle(row.articleId);if(!['draft','changes'].includes(current.status))throw new Error('검토 중/승인 기사는 사진을 추가할 수 없습니다.');if(current.photos.length>=12)throw new Error('기사 사진 12장 한도입니다.');const plan=W.legacyPlanFor?.(current.id),slot=plan?.photos?.[current.photos.length],d=await preparePhoto(row.file,current.id);if(slot){d.photo.caption=(slot.caption||'').replace(/ · 실제 현장 사진으로 교체 필요$/,'').slice(0,300);}d.photo.alt=row.file.name.replace(/\.[^.]+$/,'').slice(0,200);await store.upload(current.id,d.photo,d.original,d.web);current=await store.saveArticle(current.id,current.revision,{photos:[...current.photos,d.photo]});result.done++;}catch(e){result.skipped.push({name:row.name,message:e?.message||String(e)});}}
 return result;
}
function photoScanPanel(articles){
 const wrap=h('section',{class:'photo-folder-panel'}),input=h('input',{type:'file',multiple:true,accept:'image/jpeg,image/png,image/webp',webkitdirectory:true,hidden:true}),progress=h('span',{class:'small muted'},''),summary=h('div',{class:'photo-scan-summary'});
 const head=h('div',{class:'dashboard-section-head'},h('div',{},h('span',{class:'eyebrow'},'LOCAL FOLDER SCAN'),h('h2',{},'사진 폴더 자동 정리'),h('p',{class:'small muted'},'사진은 선택 단계에서는 업로드하지 않습니다. 파일명·폴더명·해시만 브라우저에서 분석합니다.')),h('div',{class:'actions'},button('사진 폴더 선택',()=>input.click(),'primary'),progress));
 wrap.append(head,input,summary);
 async function draw(){
  summary.replaceChildren();const st=photoScanState;if(!st.rows.length){summary.append(h('p',{class:'empty'},'폴더를 선택하면 중복 사진과 기사 추천 결과가 여기에 표시됩니다.'));return;}
  const usable=st.rows.filter(r=>!r.duplicateOf&&!r.nearDuplicateOf&&r.articleId),chosen=st.rows.filter(r=>r.selected);
  const stats=h('div',{class:'photo-scan-stats'},h('span',{},'사진 '+st.rows.length),h('span',{},'완전 중복 '+st.duplicates),h('span',{},'유사 중복 '+st.nearDuplicates),h('span',{},'기사 추천 '+usable.length),h('span',{},'선택 '+chosen.length));
  const controls=h('div',{class:'photo-scan-controls'},button('추천 사진 자동선택',()=>{for(const r of st.rows)r.selected=!!r.articleId&&!r.duplicateOf&&!r.nearDuplicateOf;draw();},'text'),button('선택 해제',()=>{for(const r of st.rows)r.selected=false;draw();},'text'),button('선택 사진 연결',async()=>{const rows=st.rows.filter(r=>r.selected);if(!rows.length)return toast('연결할 사진을 선택해 주세요.');if(!confirm(rows.length+'장을 추천 기사에 순서대로 연결할까요?'))return;progress.textContent='사진 연결 중…';const out=await connectScannedRows(st.rows);progress.textContent='';toast('사진 '+out.done+'장 연결'+(out.skipped.length?' · 건너뜀 '+out.skipped.length:'') );photoScanState.rows=[];await renderPhotoDesk();},'primary'));
  const table=h('div',{class:'photo-scan-list'});
  const articleOptions=articles.filter(a=>['draft','changes'].includes(a.status)&&a.photos.length<12).sort((a,b)=>(a.planOrder||999)-(b.planOrder||999)||a.title.localeCompare(b.title));
  for(const r of st.rows){const disabled=!!r.duplicateOf||!!r.nearDuplicateOf,check=h('input',{type:'checkbox',checked:r.selected,disabled,'aria-label':r.name+' 선택'});check.addEventListener('change',()=>{r.selected=check.checked;draw();});
   const select=h('select',{'aria-label':r.name+' 추천 기사'},h('option',{value:''},'기사 선택'));for(const a of articleOptions)select.append(h('option',{value:a.id},String(a.planOrder||'')+' · '+a.title));select.value=r.articleId||'';select.addEventListener('change',()=>{r.articleId=select.value;r.selected=!!select.value&&!disabled;draw();});
   const badge=r.duplicateOf?'완전 중복 · '+r.duplicateOf:r.nearDuplicateOf?'유사 중복 · '+r.nearDuplicateOf:r.existingCandidate?'기존 업로드 유사 · '+r.existingCandidate:r.articleId?'추천 점수 '+r.score:'추천 없음';
   const row=h('article',{class:'photo-scan-row'+(disabled?' duplicate':'')},check,h('img',{src:scanPreview(r),alt:r.name,loading:'lazy'}),h('div',{class:'photo-scan-meta'},h('b',{},r.name),h('span',{},r.path),h('small',{},Math.round(r.size/1024).toLocaleString()+'KB · '+r.width+'×'+r.height)),h('div',{class:'photo-scan-match'},h('span',{class:disabled?'slot-state':'slot-state filled'},badge),r.hits?.length?h('small',{class:'muted'},'일치: '+r.hits.join(', ')):null,select));
   table.append(row);
  }
  summary.append(stats,controls,table);
 }
 input.addEventListener('change',async()=>{const files=input.files;if(!files?.length)return;progress.textContent='0/'+files.length+' 분석';try{await scanPhotoFolder(files,articles,(n,total)=>progress.textContent=n+'/'+total+' 분석');progress.textContent='분석 완료';await draw();}catch(e){progress.textContent='분석 실패';showError(e);}});
 draw();return wrap;
}
async function renderPhotoDesk(){
 if(!C.teacher(user))return renderPending();
 const articles=await store.listArticles(),byId=new Map(articles.map(a=>[a.id,a])),links=W.legacyArticleLinks||{},liveByLegacy=new Map(Object.entries(links).map(([aid,lid])=>[lid,byId.get(aid)]).filter(x=>x[1]));
 const refs=(W.newsroomData?.examples||[]).filter(x=>x.photos?.length),total=refs.reduce((n,x)=>n+x.photos.length,0),linkedSlots=refs.reduce((n,x)=>n+(liveByLegacy.has(x.id)?x.photos.length:0),0);
 const head=h('div',{class:'dashboard-head'},h('div',{},h('div',{class:'eyebrow'},'PHOTO ASSIGNMENT DESK'),h('h1',{},'웅비 사진 정리'),h('p',{class:'intro'},'원래 index·패키지의 120개 사진 슬롯을 기사별로 확인하고 실제 승인 사진을 연결합니다.')),h('div',{class:'dashboard-stamp'},'전체 '+total+' 슬롯 · 운영 연결 '+linkedSlots));
 const tabs=h('div',{class:'kind-tabs'});for(const [k,label] of [['all','전체'],['linked','운영 기사'],['missing','사진 필요'],['archive','복원 자료']])tabs.append(button(label,()=>{photoDeskFilter=k;renderPhotoDesk();},photoDeskFilter===k?'active':''));
 const root=h('div',{class:'photo-desk-grid'});
 const rows=refs.filter(r=>{const live=liveByLegacy.get(r.id);if(photoDeskFilter==='linked')return !!live;if(photoDeskFilter==='archive')return !live;if(photoDeskFilter==='missing')return !!live&&live.photos.length<r.photos.length;return true;});
 for(const ref of rows){let live=liveByLegacy.get(ref.id)||null;const card=h('section',{class:'photo-desk-card'},h('div',{class:'photo-desk-card-head'},h('div',{},h('span',{class:'row-category'},ref.category||'복원 자료'),h('h2',{},live?live.title:(ref.headline||ref.title))),h('span',{class:live?'slot-state filled':'slot-state'},live?'운영 기사 연결':'복원 자료')));
  if(live)card.append(h('p',{class:'small muted'},articleNames(live)+' · 실제 사진 '+live.photos.length+'/'+ref.photos.length),button('기사 열기',()=>openEditor(live.id),'text'));else card.append(h('p',{class:'small muted'},'운영 기사와 직접 연결되지 않은 참고·복원용 사진 계획입니다.'));
  const slots=h('div',{class:'photo-desk-slots'});
  for(let i=0;i<ref.photos.length;i++){const slot=ref.photos[i],filled=live?.photos?.[i],box=h('article',{class:'photo-desk-slot'});box.append(h('img',{src:slot.sourceAsset,alt:slot.alt||'사진 슬롯',loading:'lazy'}),h('div',{},h('b',{},(i+1)+'번'),h('span',{class:filled?'slot-state filled':'slot-state'},filled?'실제 사진 연결됨':live?'사진 필요':'보관 슬롯')));
   if(live&&['draft','changes'].includes(live.status)&&!filled&&i===live.photos.length){const input=h('input',{type:'file',accept:'image/jpeg,image/png,image/webp',hidden:true});const status=h('small',{class:'muted'},'');input.addEventListener('change',async()=>{const file=input.files[0];if(!file)return;try{status.textContent='업로드 중…';const current=await store.getArticle(live.id),d=await preparePhoto(file,current.id);d.photo.caption=(slot.caption||'').replace(/ · 실제 현장 사진으로 교체 필요$/,'').slice(0,300);const slotAlt=String(slot.alt||'');d.photo.alt=(/교체|예시|placeholder/i.test(slotAlt)?file.name.replace(/\.[^.]+$/,''):slotAlt||file.name.replace(/\.[^.]+$/,'')).slice(0,200);await store.upload(current.id,d.photo,d.original,d.web,v=>status.textContent='업로드 '+Math.round(v*100)+'%');const photos=[...current.photos,d.photo];live=await store.saveArticle(current.id,current.revision,{photos});status.textContent='연결 완료';toast('사진 슬롯을 채웠습니다.');await renderPhotoDesk();}catch(e){status.textContent='실패';showError(e);}});box.append(input,button('사진 연결',()=>input.click(),'text'),status);}
   else if(live&&!filled&&i>live.photos.length)box.append(h('small',{class:'muted'},'앞 슬롯부터 채워 주세요.'));
   slots.append(box);
  }card.append(slots);root.append(card);
 }
 const scanner=photoScanPanel(articles);main.replaceChildren(head,scanner,tabs,root,h('p',{class:'small muted source-bottom'},'실제 사진은 원본 비공개 + WebP 공개용 파생본 구조로 저장됩니다. 폴더 분석은 로컬에서만 수행되고, 체크 후 연결한 사진만 업로드됩니다.'));
}
async function renderMembers(){
 if(store.mode==='demo'&&W.plan2026)return renderPlanMembers();
 if(!C.teacher(user))return renderPending();
 const members=await store.listMembers(),articles=await store.listArticles(),rows=h('div',{class:'panel'}),pending=members.filter(m=>!m.active),activeStudents=members.filter(m=>m.active&&['student','editor'].includes(m.role));
 const loginUrl=location.origin+'/?student=login',studentGuide='[웅비 웹진 기사 작성 안내]\n1. 아래 주소를 열어 Google 계정으로 로그인하세요.\n'+loginUrl+'\n2. 첫 로그인 뒤에는 “승인 대기”로 표시됩니다.\n3. 담당교사가 승인하면 기존에 배정된 자기 기사만 열어 작성할 수 있습니다.\n4. 기사 원고와 사진은 승인 전까지 공개되지 않습니다.';
 const onboarding=h('section',{class:'member-onboarding'},h('div',{},h('span',{class:'eyebrow'},'GOOGLE ACCOUNT ONBOARDING'),h('h2',{},'학생 계정 연결'),h('p',{class:'small muted'},'학생이 아래 주소에서 Google 로그인하면 승인 대기로 나타납니다. 승인 뒤 이름이 같은 기존 기사 배정을 실제 계정과 연결할 수 있습니다.')),h('div',{class:'member-onboarding-actions'},h('code',{},loginUrl),button('로그인 주소 복사',()=>copyText(loginUrl),'text'),button('학생 안내문 복사',()=>copyText(studentGuide),'text')));
 const summary=h('div',{class:'member-summary'},h('span',{},'승인 대기 '+pending.length),h('span',{},'학생·편집장 '+activeStudents.length),h('span',{},'교사 '+members.filter(m=>m.role==='teacher').length));
 main.replaceChildren(h('div',{class:'heading-row'},h('div',{},h('div',{class:'eyebrow'},'MEMBERS'),h('h1',{},'참여자 승인'),h('p',{class:'intro'},'Google 로그인은 본인 확인입니다. 기사 접근 권한은 별도로 승인합니다.'))),onboarding,summary,rows);
 for(const m of members){
  const matches=articles.filter(a=>['draft','changes'].includes(a.status)&&(a.assigneeNames||[]).some(n=>String(n).trim()===String(m.displayName||'').trim()));
  const row=h('div',{class:'member-row'},h('div',{class:'info'},h('b',{},m.displayName),h('span',{},m.role==='teacher'?'담당교사':m.active?m.role==='editor'?'편집장':'학생 기자':'승인 대기'),matches.length?h('small',{class:'muted'},'이름 일치 배정 '+matches.length+'건'):null),h('span',{class:'badge'},m.active?'활성':'대기'));
  if(m.role!=='teacher')row.append(button('기자 승인',async()=>{await store.setMember(m.uid,'student',true);const changed=typeof store.linkMemberAssignments==='function'?await store.linkMemberAssignments(m.uid):[];toast('기자 승인'+(changed.length?' · 기존 기사 '+changed.length+'건 자동 연결':''));await renderMembers();}),button('편집장',async()=>{await store.setMember(m.uid,'editor',true);const changed=typeof store.linkMemberAssignments==='function'?await store.linkMemberAssignments(m.uid):[];toast('편집장 승인'+(changed.length?' · 기존 기사 '+changed.length+'건 자동 연결':''));await renderMembers();}),matches.length&&m.active&&typeof store.linkMemberAssignments==='function'?button('배정 다시 연결',async()=>{const changed=await store.linkMemberAssignments(m.uid);toast('기사 배정 '+changed.length+'건을 실제 계정에 연결했습니다.');await renderMembers();},'text'):null,button('권한 중지',async()=>{if(confirm('이 계정의 편집 접근을 중지할까요?')){await store.setMember(m.uid,'pending',false);await renderMembers();}},'danger'));
  rows.append(row);
 }
}
async function renderBook(){if(!C.teacher(user))return renderPending();const articles=(await store.listArticles()).filter(a=>a.status==='approved'&&a.printConsent),all=new Map(articles.map(a=>[a.id,a]));issueSelection=issueSelection.filter(id=>all.has(id));const title=h('input',{id:'issueTitle',value:'웅비 · 2026 편집본',maxlength:150}),pick=h('div'),order=h('ol',{class:'book-order'}),archives=h('div');
 const head=h('div',{class:'heading-row'},h('div',{},h('div',{class:'eyebrow'},'PRINT EDITION'),h('h1',{},'한 번 쓴 원고, 한 권의 교지'),h('p',{class:'intro'},'책 수록 동의를 확인한 승인 기사만 묶습니다. 확정본은 이후 웹 원고 수정과 분리해 보관합니다.')));
 function renderOrder(){order.replaceChildren();if(!issueSelection.length)order.append(h('li',{class:'muted'},'왼쪽에서 기사를 골라 주세요.'));for(const [i,id] of issueSelection.entries()){const up=button('↑',()=>{if(i>0){[issueSelection[i-1],issueSelection[i]]=[issueSelection[i],issueSelection[i-1]];renderOrder();}}),down=button('↓',()=>{if(i<issueSelection.length-1){[issueSelection[i+1],issueSelection[i]]=[issueSelection[i],issueSelection[i+1]];renderOrder();}});up.setAttribute('aria-label','기사 순서 올리기');down.setAttribute('aria-label','기사 순서 내리기');order.append(h('li',{},h('span',{},`${i+1}. ${all.get(id).title}`),up,down));}}
 for(const a of articles){const check=h('input',{type:'checkbox',value:a.id,checked:issueSelection.includes(a.id)});check.addEventListener('change',()=>{issueSelection=check.checked?[...issueSelection,a.id]:issueSelection.filter(id=>id!==a.id);renderOrder();});pick.append(h('label',{class:'check'},check,h('span',{},a.title)));}
 if(!articles.length)pick.append(h('p',{class:'muted'},'책 수록이 승인된 기사가 아직 없습니다.'));
 main.replaceChildren(head,h('div',{class:'split'},h('section',{class:'panel'},h('h2',{},'수록 기사 선택'),pick),h('section',{class:'panel'},h('label',{},'책 제목',title),h('h3',{},'목차 순서'),order,button('확정본 만들고 미리보기',async()=>{const issue=await store.makeIssue(issueSelection,title.value);toast('원고 확정본을 저장했습니다.');await openIssue(issue);},'primary'))),h('section',{class:'panel'},h('h2',{},'보관한 확정본'),archives),h('p',{class:'small muted'},'기본 A4 검토용 출력입니다. 인쇄소용 PDF/X, 재단선·도련, 정밀 쪽번호와 자동 조판 검수는 후속 단계입니다.'));renderOrder();
 for(const issue of await store.listIssues())archives.append(h('div',{class:'archive-row'},h('span',{},issue.title),button('확정본 열기',async()=>openIssue(await store.getIssue(issue.id)))));}
async function bookNode(issue){const root=h('div',{class:'book-preview'});root.append(h('div',{class:'book-cover'},h('p',{},'포항고등학교 교지 · 雄飛'),h('h1',{},issue.title),h('p',{},`${issue.items.length}편 · 원고 확정본`),h('p',{class:'small'},`확정 ${issue.createdAt.slice(0,10)}${store.mode==='demo'?' · 로컬 저장 원고의 검토용 출력':''}`)),h('section',{class:'book-toc'},h('h2',{},'목차'),h('ol',{},issue.items.map(a=>h('li',{},a.title+' · '+a.byline)))));
 for(const a of issue.items)root.append(await renderArticle(a));return root;}
async function openIssue(issue){const node=await bookNode(issue);dialogOpen('책 미리보기 · 승인 원고 확정본',node,[button('A4 인쇄 / PDF 저장',async()=>{$('#printArea').replaceChildren(await bookNode(issue));await Promise.all([...$('#printArea img')].map(i=>i.decode().catch(()=>{})));await document.fonts.ready;window.print();},'primary'),button('인쇄소 전달 묶음 받기',()=>exportIssue(issue)),button('확정 원고 JSON 받기',()=>textDownload(JSON.stringify(issue,null,2),'woonbi-issue.json'))]);}
async function exportIssue(issue){
 const filename='woonbi-print-handoff.zip',handle=await chooseSaveHandle(filename,'application/zip');if(handle===false)return;
 toast('인쇄소 전달 묶음을 만드는 중입니다…');
 const entries=[{name:'00_목차.txt',data:issue.items.map((a,i)=>`${i+1}. ${a.title} / ${a.byline}`).join('\n')},{name:'manifest.json',data:JSON.stringify(issue,null,2)}];
 for(const [i,a] of issue.items.entries()){const folder=String(i+1).padStart(2,'0');entries.push({name:folder+'/원고.txt',data:`${a.title}\n${a.deck}\n글 ${a.byline}\n\n${a.body}`});entries.push({name:folder+'/사진설명.txt',data:a.photos.map((p,j)=>`${j+1}. ${p.caption}\n대체설명: ${p.alt}`).join('\n\n')});for(const [j,p] of a.photos.entries()){let blob;try{blob=await store.mediaBlob(p.originalPath);}catch{if(p.sourceAsset){const r=await fetch(p.sourceAsset);if(r.ok)blob=await r.blob();}if(!blob)throw new Error(`${a.title}의 ${j+1}번 원본 사진을 읽지 못했습니다.`);}const ext=blob.type==='image/png'?'png':blob.type==='image/webp'?'webp':'jpg';entries.push({name:folder+`/사진${j+1}.${ext}`,data:blob});}}
 const zip=await W.makeZip(entries);await writeDownload(zip,filename,handle);toast('확정 원고와 원본 사진 ZIP을 저장했습니다.');
}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&edit){e.preventDefault();save().then(()=>toast('원고 저장 상태를 확인했습니다.')).catch(showError);}});
 window.addEventListener('beforeunload',e=>{if(dirty||uploading){e.preventDefault();e.returnValue='';}});
document.querySelectorAll('[data-nav]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();navigate(el.dataset.nav).catch(showError);}));
window.addEventListener('online',()=>{if(dirty)save().catch(()=>{});});window.addEventListener('offline',()=>{if(edit)setSave('연결 끊김 · 이 탭에서 임시 보관',true);});
(async()=>{try{const cfg=window.WOONBI_CONFIG||{};if(!['demo','firebase'].includes(cfg.mode))throw new Error('운영 모드를 명시해야 합니다.');store=cfg.mode==='demo'?new W.DemoStore():new W.FirebaseStore(cfg);try{await store.init();}catch(e){if(cfg.mode==='demo'&&['SecurityError','InvalidStateError','UnknownError'].includes(e.name)){store.channel?.close();store=new W.MemoryStore();await store.init();}else throw e;}user=store.user;
 newsroom=W.createNewsroom({h,button,main,store:()=>store,user:()=>user,openEditor,navigate,renderArticle,imageNode,dialogOpen,toast,leaveEditor,setView:v=>{view=v;refreshHeader();}});
 $('#modeBanner').textContent=store.mode==='demo'?(store.persistence==='memory'?'편집 미리보기 · 원고는 미발행 | 이 탭 임시 저장 · 실제 로그인·서버 연결 전':'편집 미리보기 · 원고는 미발행 | 이 기기에 저장 · 실제 Google 로그인 연결 전'):'웅비 편집실 · 승인된 계정만 원고를 작성할 수 있습니다.';$('#modeBanner').classList.toggle('live',store.mode==='firebase');
 store.onAuthChange=async()=>{user=store.user;clearLocalBuffers();listen();refreshHeader();await navigate(user?'articles':'public');};store.onError=showError;listen();const params=new URLSearchParams(location.search),requestedView=params.get('view');if(['public','archive','examples','ideas'].includes(requestedView))view=requestedView;if(params.get('student')==='login'&&!user)view='articles';refreshHeader();await renderCurrent();if(params.get('student')==='login'){view='articles';refreshHeader();await renderCurrent();}
 // Dev inspection helpers expose no additional live authorization. Firebase rules remain the boundary.
 if(store.mode==='demo')W.demo={store,getCurrent:()=>edit,newsroom};
 if(location.hash.startsWith('#read/')){const id=decodeURIComponent(location.hash.slice(6));await newsroom.read(id,id.startsWith('reference-'));}
 }catch(e){$('#modeBanner').textContent='연결하지 못했습니다 · 체험 모드로 자동 전환하지 않습니다.';main.replaceChildren(h('div',{class:'notice error'},h('h1',{},'설정을 확인해 주세요'),h('p',{},e.message),h('p',{class:'small'},'현재 파일은 변경하지 않습니다. 연결 설정을 수정한 뒤 다시 열어 주세요.')));console.error(e);}})();
})();
