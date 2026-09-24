/* WOONBI newsroom. Original code; publishing patterns studied in Ghost Source and Superdesk. */
(function(){'use strict';const W=window.Woonbi=window.Woonbi||{};
W.createNewsroom=function(api){
 const {h,button,main,store:storeFn,user:userFn,openEditor,navigate,renderArticle,imageNode,dialogOpen,toast}=api;
 const C=W.core,E=W.editorial;let category='all',query='',sortMode='plan',generation=0;
 const data=()=>W.newsroomData||{},archive=()=>W.archiveData||{},restored=()=>W.restoredMedia||{},lastYear=()=>W.lastYearMedia||{};
 const asset=k=>{const p=archive().media?.[k]||'';return W.embeddedAssets?.[p]||p;};
 const file=p=>W.embeddedAssets?.[p]||p;
 const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:'';}catch{return '';}};
 const isReference=a=>a?._reference===true||String(a?.id||'').startsWith('reference-');
 const label=a=>isReference(a)?'예시 기사':a.contentOrigin==='restored'?'복원 초안':a.contentOrigin==='new-editorial-draft'?'취재 초안':a.publishedAt?'발행 기사':'편집 초안';
 const smallLabel=a=>a.planKind==='research'?'학생 탐구':a.category||'학교 이야기';
 const excerpt=a=>(a.deck||C.paragraphs(a.body)[0]||'').slice(0,145);
 const visualTone=a=>{const seed=String(a.id||a.title||'웅비');let n=0;for(let i=0;i<seed.length;i++)n=(n*31+seed.charCodeAt(i))>>>0;return 'tone-'+(n%8);};
 const categories=[['all','전체'],['school','학교 소식'],['feature','특집·인터뷰'],['research','학생 탐구'],['saved','내 보관함']];
 const bookmarkKey=()=>`woonbi-bookmarks:${userFn()?.uid||'reader'}`;
 function bookmarks(){try{return new Set(JSON.parse(W.session.getItem(bookmarkKey())||'[]'));}catch{return new Set();}}
 function match(a){return ['all','all-list'].includes(category)||(category==='saved'?bookmarks().has(a.id):category==='research'?a.planKind==='research':category==='feature'?['특집','학교 사람들'].includes(a.category):a.planKind!=='research'&&['학교 이야기','학생 글','편집실'].includes(a.category));}
 function staticPhoto(k,alt){const src=asset(k);return src?h('figure',{class:'n-photo'},h('img',{src,alt,loading:'lazy',decoding:'async'}),h('figcaption',{},'지난 호 자료사진')):null;}
 function restoredPhotos(a){return restored().byArticle?.[a.id]||[];}
 function effectivePhotos(a){const existing=a?.photos||[];if(existing.length&&!existing.every(E.sample))return existing;if(existing.some(p=>p.lastYearSample===true))return existing;const recovered=restoredPhotos(a);if(recovered.length&&!existing.length)return recovered;const canUseLastYear=isReference(a)||String(a?.id||'').startsWith('sample-article-')||a?.sample===true;const seeded=canUseLastYear?lastYear().photosFor?.(a,Math.max(0,Number(a?.planOrder||1)-1)):null;if(seeded?.length)return seeded;if(recovered.length)return recovered;return existing;}
  function headlineRail(items){if(!items?.length)return null;const rail=h('section',{class:'n-headline-rail','aria-label':'오늘의 주요 기사'});rail.append(h('div',{class:'n-rail-label'},'TODAY’S HEADLINES · 오늘의 주요 기사'));for(const [i,a] of items.slice(0,4).entries())rail.append(h('article',{},h('span',{class:'n-rail-no'},String(i+1).padStart(2,'0')),h('div',{},h('span',{class:'n-section-label'},smallLabel(a)),h('h3',{},headlink(a)))));return rail;}
 function mediaShowcase(){const items=lastYear().showcase||[];if(!items.length)return null;const grid=h('div',{class:'n-lastyear-grid'});for(const x of items)grid.append(h('figure',{class:'n-lastyear-item'},h('img',{src:x.src,alt:x.caption,loading:'lazy',decoding:'async',width:x.width,height:x.height}),h('figcaption',{},h('b',{},x.caption),h('span',{},'포항고 웅비 지난 호 · 현재 기사 현장 아님'))));return h('section',{class:'n-lastyear-section','aria-label':'지난 호 예시 자료사진'},sectionHead('사진으로 보는 지난 호','포항고의 지난 장면을 현재 기사와 구분해 다시 봅니다.'),grid);}
 function packageShowcase(){const items=restored().showcase||[];if(!items.length)return null;const grid=h('div',{class:'n-restored-grid'});for(const x of items)grid.append(h('figure',{class:'n-restored-item'},h('img',{src:x.src,alt:x.caption,loading:'lazy',decoding:'async',width:x.width,height:x.height}),h('figcaption',{},h('b',{},x.caption),h('span',{},x.note||'복원 자료'))));return h('details',{class:'n-package-restore'},h('summary',{},'편집부 복원 자료 4장 보기'),h('section',{class:'n-restored-section'},grid));}
 function headlink(a){return h('a',{href:'#read/'+encodeURIComponent(a.id),onclick:e=>{e.preventDefault();read(a.id,isReference(a)).catch(toastError);}},a.headline||a.title);}
 function toastError(e){toast(e.message||'기사를 열지 못했습니다.');}
 function meta(a){return h('div',{class:'n-meta'},h('span',{},a.assigneeNames?.length?'취재·수정 '+a.assigneeNames.join(' · '):a.byline||'편집실'),h('span',{},E.readingMinutes(a.body)+'분 읽기'),h('span',{class:'n-status'},label(a)));}
 async function articles(){if(storeFn().mode==='demo')return storeFn().listArticles();const published=(await storeFn().listPublic()).filter(a=>!String(a?.id||'').startsWith('sample-article-')),refs=(data().examples||[]).map(a=>({...a,_reference:true,category:a.category||'학교 이야기',planKind:a.planKind||(a.archiveLabel?.includes('탐구')?'research':'school'),byline:a.byline||'웅비 편집실'}));return [...published,...refs.filter(r=>!published.some(p=>p.id===r.id))];}
 function cleanPage(){generation++;document.body.classList.add('reading-view');main.className='newsroom-main';main.replaceChildren();document.getElementById('readProgress')?.remove();}
 function sectionHead(title,sub,action){return h('div',{class:'n-section-head'},h('div',{},h('h2',{},title),sub?h('p',{},sub):null),action);}
 async function articlePhoto(a,priority=false){
   const p=effectivePhotos(a)[0];if(p){const img=await imageNode(p);if(img.tagName==='IMG'){img.loading=priority?'eager':'lazy';if(priority)img.setAttribute('fetchpriority','high');img.decoding='async';}return h('figure',{class:'n-photo'+(p.restored?' restored-photo':p.lastYearSample?' lastyear-photo':'' )},img,h('figcaption',{},p.restored?h('span',{class:'restored-badge'},'복원 자료'):p.lastYearSample?h('span',{class:'lastyear-badge'},'지난 호 자료사진'):E.sample(p)?h('span',{class:'sample-badge'},'교체용 예시 · 실제 현장 아님'):null,p.caption||'기사 사진'));}
   const title=(a.headline||a.title||'웅비').replace(/^\[.*?\]\s*/,'');return h('div',{class:'v4-empty-image editorial-placeholder '+visualTone(a)},h('span',{},smallLabel(a)),h('strong',{},title.slice(0,34)),h('small',{},'사진 취재 준비 중'));
  }
 async function card(a,withPhoto=true){const art=h('article',{class:'n-card','data-read-card':a.id});
  if(withPhoto)art.append(h('a',{class:'n-card-image',href:'#read/'+a.id,'aria-label':a.title+' 기사 읽기',onclick:e=>{e.preventDefault();read(a.id,isReference(a)).catch(toastError);}},await articlePhoto(a)));
  art.append(h('span',{class:'n-section-label'},smallLabel(a)),h('h3',{},headlink(a)),h('p',{class:'n-excerpt'},excerpt(a)),meta(a));return art;
 }
 async function home(){
  cleanPage();const token=generation,rows=E.sort(await articles(),sortMode),q=E.normalize(query);
  if(token!==generation)return;
  const filtered=rows.filter(a=>match(a)&&(!q||E.normalize([a.title,a.sourceTitle,a.body,a.byline,(a.assigneeNames||[]).join(' ')].join(' ')).includes(q)));
  const tabs=h('div',{class:'n-topic-tabs',role:'group','aria-label':'기사 분야'},categories.map(([k,t])=>{const b=button(t,()=>{category=k;home();},category===k?'selected':'');b.setAttribute('aria-pressed',category===k);return b;}));
  const search=h('input',{id:'newsSearch',type:'search',placeholder:'기사·주제·기자 검색',value:query,'aria-label':'웹진 기사 검색'});let wait;
  search.addEventListener('input',()=>{query=search.value;clearTimeout(wait);wait=setTimeout(()=>{home().then(()=>document.getElementById('newsSearch')?.focus());},250);});
  const sort=h('select',{'aria-label':'기사 정렬',id:'newsSort'},h('option',{value:'plan'},'편집 순서'),h('option',{value:'updated'},'최근 수정'),h('option',{value:'title'},'제목순'));sort.value=sortMode;
  sort.addEventListener('change',()=>{sortMode=sort.value;category=category==='all'?'all-list':category;home();});
  main.append(h('div',{class:'n-toolbar'},tabs,h('label',{class:'n-search'},search),sort));
  if(storeFn().mode==='demo')main.append(h('div',{class:'n-edition-note'},h('b',{},'2026 편집 미리보기'),h('span',{},'미발행 원고 · 예시 사진은 교체 후 사용합니다.')));else if(rows.some(isReference)){const refCount=rows.filter(isReference).length;main.append(h('div',{class:'n-edition-note'},h('b',{},'2026 준비호'),h('span',{},'실제 발행 전 예시·복원 원고 '+refCount+'편과 지난 호 자료사진을 편집 참고용으로 보여드립니다.')));}
  if(category!=='all'||q){
   main.append(sectionHead(q?'“'+query+'” 검색 결과':categories.find(x=>x[0]===category)?.[1]||'모든 기사',filtered.length+'편',button('조건 초기화',()=>{reset();home();},'text')));
   const grid=h('section',{class:'n-list-grid','aria-live':'polite'});main.append(grid);
   if(!filtered.length)grid.append(h('p',{class:'empty'},category==='saved'?'기사에서 ‘보관하기’를 누르면 이 탭의 보관함에 모입니다.':'일치하는 기사가 없습니다. 다른 검색어로 찾아보세요.'));
   for(const a of filtered){const c=await card(a);if(token!==generation)return;grid.append(c);}return;
  }
  if(!rows.length){main.append(h('section',{class:'empty'},h('h1',{},'웅비의 다음 이야기를 준비합니다.'),h('p',{},'승인 후 발행한 기사만 이곳에 표시합니다.'),button('편집실',()=>navigate('articles'),'ink-button')));return;}
  const ids=data().leadIds||[],publishedRows=rows.filter(a=>a.publishedAt&&!isReference(a)),configured=rows.find(a=>a.id===ids[0]),fallback=rows.find(a=>a.id==='reference-EX01')||rows.find(isReference)||rows[0],lead=publishedRows[0]||(configured&&!String(configured.id).startsWith('sample-article-')?configured:fallback),rest=rows.filter(a=>a.id!==lead.id);
  const preferredSideIds=publishedRows.length?publishedRows.slice(1,3).map(a=>a.id):['reference-EX02','reference-EX05'],sides=[...preferredSideIds.map(id=>rest.find(a=>a.id===id)).filter(Boolean),...ids.slice(1).map(id=>rest.find(a=>a.id===id)).filter(Boolean),...rest].filter((a,i,ar)=>ar.findIndex(b=>b.id===a.id)===i).slice(0,2);
  const leadArt=h('article',{class:'n-lead','data-lead':lead.id},h('div',{class:'n-section-label'},'이번 호의 시선 · '+smallLabel(lead)),h('h1',{},headlink(lead)),h('p',{class:'n-lead-deck'},excerpt(lead)),meta(lead));
  leadArt.append(h('a',{class:'n-lead-image',href:'#read/'+lead.id,onclick:e=>{e.preventDefault();read(lead.id,isReference(lead));}},await articlePhoto(lead,true)));
  const side=h('aside',{class:'n-side'},h('div',{class:'n-side-title'},'함께 읽는 학교 소식'));
  for(const a of sides)side.append(await card(a,true));
  side.append(h('div',{class:'n-desk-link'},h('b',{},'취재한 이야기를 더해주세요.'),button('내 기사 이어 쓰기 ↗',()=>navigate('articles'),'text')));
  if(token!==generation)return;main.append(h('section',{class:'n-front'},leadArt,side));const rail=headlineRail(rest.filter(a=>!sides.some(s=>s.id===a.id)).slice(0,4));if(rail)main.append(rail);const restoredBlock=mediaShowcase();if(restoredBlock)main.append(restoredBlock);
  const research=rows.filter(a=>a.planKind==='research'),feature=rows.filter(a=>['학교 사람들','특집'].includes(a.category)&&!sides.some(s=>s.id===a.id)&&a.id!==lead.id);
  for(const [title,sub,items,cls] of [['학생이 묻습니다','일상의 의문에서 시작한 탐구',research.slice(0,4),'n-research-grid'],['학교 안의 사람들','인터뷰와 교류, 이어 쓰는 이야기',feature.slice(0,3),'n-feature-grid']]){
   if(!items.length)continue;const grid=h('section',{class:cls});main.append(sectionHead(title,sub),grid);for(const a of items){const c=await card(a,true);if(token!==generation)return;grid.append(c);}
  }
  const packageBlock=packageShowcase();if(packageBlock)main.append(packageBlock);
   if(archive().pages?.length){main.append(h('section',{class:'n-archive-promo'},h('div',{},h('span',{class:'n-section-label'},'ARCHIVE / 지난 호'),h('h2',{},'지난해의 학교를\n다시 펼치다.'),h('p',{},'2025년 학교 기록 · 표지 발간 표기는 2026년. 원본 지면을 별도로 보관합니다.'),button('지난 호 읽기 →',()=>navigate('archive'),'ink-button')),h('button',{class:'n-archive-cover',onclick:()=>navigate('archive'),'aria-label':'지난 호 표지 열기'},h('img',{src:asset('archive-cover'),alt:'웅비 VOL.41 원본 표지',loading:'lazy'}))));}
  const shown=new Set([lead.id,...sides.map(a=>a.id),...research.slice(0,4).map(a=>a.id),...feature.slice(0,3).map(a=>a.id)]),other=rows.filter(a=>!shown.has(a.id));
  const moreGrid=h('section',{class:'n-more-grid'});for(const a of other.slice(0,8)){const c=await card(a,true);if(token!==generation)return;moreGrid.append(c);}main.append(sectionHead('더 읽을 기사',other.length+'편'),moreGrid);
  main.append(button('모든 기사 '+rows.length+'편 보기 →',()=>{category='all-list';home();window.scrollTo(0,0);},'n-all-button'));
 }
 async function read(id,reference=false){
  if(!(await api.leaveEditor()))return;
  const rows=await articles(),a=reference?data().examples?.find(a=>a.id===id):rows.find(a=>a.id===id);
  if(!a){toast('읽을 수 있는 원고가 없습니다.');return;}
  cleanPage();api.setView('reader');try{history.replaceState(null,'','#read/'+encodeURIComponent(id));}catch{}
  document.title=(a.headline||a.title)+' | 웅비';document.body.classList.toggle('large-reading',W.session.getItem('woonbi-reader-size')==='large');
  const isDraft=reference||storeFn().mode==='demo'||!a.publishedAt;
  const back=()=>{document.title='웅비 · 포항고 웹진';navigate(reference?'examples':'public');};
  const keep=button(bookmarks().has(id)?'보관됨':'보관하기',()=>{const ids=bookmarks();ids.has(id)?ids.delete(id):ids.add(id);W.session.setItem(bookmarkKey(),JSON.stringify([...ids]));keep.textContent=ids.has(id)?'보관됨':'보관하기';keep.setAttribute('aria-pressed',ids.has(id));toast('이 탭의 보관함을 변경했습니다.');},'text');keep.setAttribute('aria-pressed',bookmarks().has(id));
  const controls=h('div',{class:'n-reader-controls'},button('← 목록으로',back,'text'),h('div',{class:'n-reading-tools'},keep,button('글자 작게',()=>{document.body.classList.remove('large-reading');W.session.setItem('woonbi-reader-size','normal');},'text'),button('글자 크게',()=>{document.body.classList.add('large-reading');W.session.setItem('woonbi-reader-size','large');},'text')));
  const article=h('article',{class:'n-longread',id:'newsArticle'},h('header',{class:'n-story-head'},h('div',{class:'n-section-label'},reference?a.archiveLabel:smallLabel(a)),h('h1',{},a.headline||a.title),h('p',{class:'n-story-deck'},a.deck||''),meta(a)));
  if(isDraft)article.append(h('aside',{class:'n-draft-notice'},reference?'복원한 예시 원고입니다. 연도와 인용을 확인한 뒤 참고하세요.':'미발행 '+label(a)+'입니다. 취재·필자·사진을 확인한 뒤 발행합니다.'));
  const rendered=await renderArticle({...a,photos:effectivePhotos(a),category:a.category||'예시 원고'}),copy=rendered.querySelector('.read-copy');copy.classList.add('n-story-copy');article.append(copy);
  const toc=h('aside',{class:'n-read-aside'},h('h3',{},'이 글에서'));
  [...copy.querySelectorAll('h3')].forEach((el,i)=>{el.id='sub-'+i;toc.append(h('a',{href:'#sub-'+i,onclick:e=>{e.preventDefault();el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}},el.textContent));});
  if(!reference&&C.canEdit(userFn(),a))toc.append(button('이 기사 수정하기 ↗',()=>openEditor(a.id),'ink-button'));
  if(a.reportingQuestions?.length)article.append(h('details',{class:'n-reporting'},h('summary',{},'취재·확인 메모'),h('ul',{},a.reportingQuestions.map(t=>h('li',{},t)))));
  if(a.sourceReferences?.length)article.append(h('section',{class:'n-source-box'},h('h3',{},'원고의 참고 자료'),h('ul',{},a.sourceReferences.map(r=>h('li',{},safeUrl(r.url)?h('a',{href:safeUrl(r.url),target:'_blank',rel:'noopener noreferrer'},r.label||r.publisher||r.url):r.label||'',r.publishedAt?' · '+r.publishedAt:''))),h('p',{},'원본에서 복원한 참고 자료이며 사실 검증 완료 표시는 아닙니다.')));
  if(a.sourceBackup||a.sourceFile)article.append(h('details',{class:'n-source-box'},h('summary',{},'복원 출처'),h('p',{},a.sourceBackup||a.sourceFile),h('p',{},'원본 기사 ID: '+(a.sourceArticleId||a.id))));
  main.append(controls,h('div',{class:'n-reading-layout'},article,toc));
  if(!reference){const related=rows.filter(b=>b.id!==id&&b.category===a.category).slice(0,3);if(related.length){const grid=h('section',{class:'n-feature-grid'});main.append(sectionHead('같은 코너에서 더 읽기'),grid);for(const x of related)grid.append(await card(x));}}
  const progress=h('progress',{id:'readProgress',max:100,value:0,'aria-label':'기사 읽기 진행'});document.body.append(progress);window.scrollTo(0,0);
 }
 function reset(){category='all';query='';sortMode='plan';}
 window.addEventListener('scroll',()=>{const p=document.getElementById('readProgress'),a=document.getElementById('newsArticle');if(p&&a){const r=a.getBoundingClientRect();p.value=Math.max(0,Math.min(100,(-r.top/(r.height-innerHeight))*100||0));}},{passive:true});
 async function examples(){cleanPage();const examples=data().examples||[];main.append(h('header',{class:'n-page-heading'},h('span',{class:'n-section-label'},'REFERENCE DESK'),h('h1',{},'예시 원고 서가'),h('p',{},'복원·예시 원고 '+examples.length+'편. 과거 사례와 올해 편집본을 구분해 보관합니다.')));const list=h('div',{class:'n-example-list'});for(const a of examples)list.append(h('article',{},h('div',{},h('span',{class:'n-section-label'},a.archiveLabel||'참고 원고'),h('h2',{},h('a',{href:'#read/'+a.id,onclick:e=>{e.preventDefault();read(a.id,true);}},a.headline||a.title)),h('p',{},C.paragraphs(a.body)[0]?.slice(0,160)||'')),button('원고 읽기 →',()=>read(a.id,true),'text')));if(!list.children.length)list.append(h('p',{class:'empty'},'승인된 참고 원고를 연결하면 표시됩니다.'));main.append(list);}
 async function archiveHome(){cleanPage();const ar=archive(),e=data().edition;if(!e||!ar.pages?.length){main.append(h('div',{class:'empty'},'공개 승인을 받은 지난 호를 연결하면 표시됩니다.'));return;}
  main.append(h('section',{class:'n-issue-head'},h('img',{src:asset('archive-cover'),alt:'지난 호 원본 표지'}),h('div',{},h('span',{class:'n-section-label'},'WOONBI ARCHIVE · '+e.issue),h('h1',{},'지난 호\n2025 학교 기록'),h('p',{},'원본은 그대로, 올해 기사와는 별도로.'),h('p',{class:'small muted'},'표지: VOL.41 | 2026 · 원본 '+ar.pages.length+'쪽'),button('원본 지면 펼치기 →',()=>openPage(1),'ink-button'),!W.STANDALONE?h('a',{class:'text',href:e.pdf,download:'웅비-VOL41-원본.pdf'},'원본 PDF'):null)));
  main.append(h('div',{class:'n-provenance-note'},e.note||''),sectionHead('지난 호 목차','기사 제목을 누르면 원본 지면으로 이동합니다.'));
  const q=h('input',{type:'search',placeholder:'지난 호 제목·코너 검색','aria-label':'지난 호 기사 검색'}),list=h('div',{class:'n-archive-index'});
  function show(){list.replaceChildren();for(const [i,t] of (ar.toc||[]).entries()){if(!E.normalize(t.title+' '+t.category).includes(E.normalize(q.value)))continue;list.append(h('article',{},h('span',{class:'n-count'},String(i+1).padStart(2,'0')),h('div',{},h('span',{class:'n-section-label'},t.category),h('h3',{},h('a',{href:'#archive-page/'+t.page,onclick:ev=>{ev.preventDefault();openPage(t.page);}},t.title))),button('지면 '+t.page+' →',()=>openPage(t.page),'text')));}if(!list.children.length)list.append(h('p',{class:'empty'},'일치하는 지난 호 기사가 없습니다.'));}q.addEventListener('input',show);main.append(h('label',{class:'n-archive-search'},q),list);show();
 }
 function openPage(start=1){const pages=archive().pages||[];if(!pages.length)return;let ix=Math.max(0,Math.min(pages.length-1,start-1));const pic=h('img',{alt:'지난 호 원본 지면',class:'n-page-scan'}),num=h('select',{'aria-label':'원본 지면 선택'});for(const p of pages)num.append(h('option',{value:p.page},p.page+' / '+pages.length));const prev=button('← 이전',()=>{ix--;paint();}),next=button('다음 →',()=>{ix++;paint();}),label=h('span',{class:'small','aria-live':'polite'});num.addEventListener('change',()=>{ix=Number(num.value)-1;paint();});
  const box=h('section',{class:'n-page-viewer'},h('div',{class:'n-page-toolbar'},prev,num,next),h('p',{class:'small muted'},'2025 학교 기록 · 표지 발간 표기는 2026. 좌우 방향키로 넘길 수 있습니다.'),pic,label);
  function paint(){ix=Math.max(0,Math.min(pages.length-1,ix));pic.src=file(pages[ix].src);pic.alt='웅비 지난 호 원본 '+(ix+1)+'쪽';num.value=ix+1;label.textContent='PDF 순서 '+(ix+1)+' / '+pages.length+'쪽';prev.disabled=ix===0;next.disabled=ix===pages.length-1;}paint();dialogOpen('지난 호 · 원본 지면',box);const d=document.getElementById('dialog');d.classList.add('archive-dialog');const key=e=>{if(e.target.tagName==='SELECT')return;if(e.key==='ArrowRight'){e.preventDefault();ix++;paint();}if(e.key==='ArrowLeft'){e.preventDefault();ix--;paint();}};d.addEventListener('keydown',key);d.addEventListener('close',()=>{d.classList.remove('archive-dialog');d.removeEventListener('keydown',key);},{once:true});
 }
 function editorialNotes(a){const x=h('details',{class:'n-editor-source'},h('summary',{},a.contentOrigin==='restored'?'복원 원고 · 취재 메모':'작성 초안 · 취재 메모'),h('p',{},'원래 배정 제목: '+(a.sourceTitle||a.title)),h('p',{},'현재 초안의 필자명은 학생의 서명이 아닙니다. 취재 후 최종 필자명을 확인하세요.'),h('ul',{},(a.reportingQuestions||[]).map(t=>h('li',{},t))));if(a.sourceBackup)x.append(h('small',{},'복원: '+a.sourceBackup));return x;}
 return {home,read,examples,archiveHome,openPage,editorialNotes,asset,reset};
};})();

