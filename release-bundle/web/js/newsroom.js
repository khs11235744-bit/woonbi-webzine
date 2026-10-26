/* WOONBI newsroom. Original code; publishing patterns studied in Ghost Source and Superdesk. */
(function(){'use strict';const W=window.Woonbi=window.Woonbi||{};
W.createNewsroom=function(api){
 const {h,button,main,store:storeFn,user:userFn,openEditor,navigate,renderArticle,imageNode,dialogOpen,toast}=api;
 const C=W.core,E=W.editorial,L=W.editorialLayout||{};let category='all',query='',sortMode='latest',generation=0;
  // Real publication time, never a manuscript's plan order or last edit, decides the cover.
  const publicationMillis=a=>{
    const v=a?.publishedAt;
    if(!v)return 0;
    if(typeof v==='number')return Number.isFinite(v)?(v<100000000000?v*1000:v):0;
    if(typeof v==='string'){const n=Date.parse(v);return Number.isFinite(n)?n:0;}
    if(typeof v.toMillis==='function'){const n=v.toMillis();return Number.isFinite(n)?n:0;}
    if(typeof v.seconds==='number')return v.seconds*1000;
    return 0;
  };
  const latestFirst=items=>[...items].sort((a,b)=>publicationMillis(b)-publicationMillis(a)||(a.planOrder||999)-(b.planOrder||999)||String(a.id||'').localeCompare(String(b.id||'')));

 const data=()=>W.newsroomData||{},archive=()=>W.archiveData||{},restored=()=>W.restoredMedia||{},lastYear=()=>W.lastYearMedia||{};
 const asset=k=>{const p=archive().media?.[k]||'';return W.embeddedAssets?.[p]||p;};
 const file=p=>W.embeddedAssets?.[p]||p;
 const safeUrl=s=>{try{const u=new URL(s);return u.protocol==='https:'?u.href:'';}catch{return '';}};
 const isReference=a=>a?._reference===true||String(a?.id||'').startsWith('reference-');
 const label=a=>a?._workingDraft?'편집 중 원고':a?._planned2026?'2026 작성용 예시':isReference(a)?'기존 예시 · '+(a.year||'출처 확인'):a.contentOrigin==='restored'?'복원 초안':a.contentOrigin==='new-editorial-draft'?'취재 초안':a.publishedAt?'발행 기사':'편집 초안';
 const smallLabel=a=>a.planKind==='research'?'학생 탐구':a.category||'학교 이야기';
 const excerpt=a=>(a.deck||C.paragraphs(a.body)[0]||'').slice(0,145);
 const visualTone=a=>{const seed=String(a.id||a.title||'웅비');let n=0;for(let i=0;i<seed.length;i++)n=(n*31+seed.charCodeAt(i))>>>0;return 'tone-'+(n%8);};
 const visualKind=a=>a.planKind==='research'?'kind-research':a.category==='학교 사람들'?'kind-people':a.category==='특집'?'kind-feature':a.category==='학생 글'?'kind-essay':'kind-school';
 const storyType=a=>L.treatment?.(a)||'news';
 const storyPlan=a=>L.plan?.(a)||{type:storyType(a),template:'news-1p',label:'SCHOOL NEWS'};
 const categories=[['all','전체'],['school','학교 소식'],['feature','특집·인터뷰'],['research','학생 탐구'],['saved','내 보관함']];
 const bookmarkKey=()=>`woonbi-bookmarks:${userFn()?.uid||'reader'}`;
 function bookmarks(){try{return new Set(JSON.parse(W.session.getItem(bookmarkKey())||'[]'));}catch{return new Set();}}
 function match(a){return ['all','all-list'].includes(category)||(category==='saved'?bookmarks().has(a.id):category==='research'?a.planKind==='research':category==='feature'?['특집','학교 사람들'].includes(a.category):a.planKind!=='research'&&['학교 이야기','학생 글','편집실'].includes(a.category));}
 function staticPhoto(k,alt){const src=asset(k);return src?h('figure',{class:'n-photo'},h('img',{src,alt,loading:'lazy',decoding:'async'}),h('figcaption',{},'지난 호 자료사진')):null;}
 function restoredPhotos(a){return restored().byArticle?.[a.id]||[];}
 function effectivePhotos(a){const existing=a?.photos||[];if(a?._workingDraft)return existing;if(String(a?.id||'').startsWith('legacy-'))return existing;if(existing.length&&!existing.every(E.sample))return existing;if(existing.some(p=>p.lastYearSample===true))return existing;const recovered=restoredPhotos(a);if(recovered.length&&!existing.length)return recovered;const canUseLastYear=isReference(a)||String(a?.id||'').startsWith('sample-article-')||a?.sample===true;const seeded=canUseLastYear?lastYear().photosFor?.(a,Math.max(0,Number(a?.planOrder||1)-1)):null;if(seeded?.length)return seeded;if(recovered.length)return recovered;return existing;}
  function frontFolio(rows,lead){
  const research=rows.filter(a=>a.planKind==='research').length,people=rows.filter(a=>a.category==='학교 사람들').length,feature=rows.filter(a=>a.category==='특집').length,photos=lastYear().showcase?.length||0;
  const box=h('section',{class:'n-front-folio','aria-label':'이번 호 구성'},h('div',{class:'n-folio-main'},h('span',{class:'n-folio-kicker'},'WOONBI · VOL.42 / 2026'),h('b',{},'읽을 수 있는 원고 '+rows.length+'편')));
  for(const [label,value] of [['학생 탐구',research],['학교 사람들',people],['특집',feature],['지난 호 사진',photos]])box.append(h('div',{class:'n-folio-stat'},h('span',{},label),h('strong',{},value)));
  box.append(h('div',{class:'n-folio-lead'},h('span',{},'TOP STORY'),h('b',{},(lead.headline||lead.title).replace(/^\[.*?\]\s*/,'').slice(0,36))));
  return box;
 }
 function headlineRail(items){if(!items?.length)return null;const rail=h('section',{class:'n-headline-rail','aria-label':'오늘의 주요 기사'});rail.append(h('div',{class:'n-rail-label'},'함께 읽을 원고'));for(const [i,a] of items.slice(0,4).entries())rail.append(h('article',{},h('span',{class:'n-rail-no'},String(i+1).padStart(2,'0')),h('div',{},h('span',{class:'n-section-label'},smallLabel(a)),h('h3',{},headlink(a)))));return rail;}
 function mediaShowcase(){const items=lastYear().showcase||[];if(!items.length)return null;const grid=h('div',{class:'n-lastyear-grid'});for(const x of items)grid.append(h('figure',{class:'n-lastyear-item'},h('img',{src:x.src,alt:x.caption,loading:'lazy',decoding:'async',width:x.width,height:x.height}),h('figcaption',{},h('b',{},x.caption),h('span',{},'예시사진 · 포항고 웅비 지난 호 · 현재 기사 현장 아님'))));return h('section',{class:'n-lastyear-section','aria-label':'지난 호 예시 자료사진'},sectionHead('사진으로 보는 지난 호','포항고의 지난 장면을 현재 기사와 구분해 다시 봅니다.',null,'02'),grid);}
 function packageShowcase(){const items=restored().showcase||[];if(!items.length)return null;const grid=h('div',{class:'n-restored-grid'});for(const x of items)grid.append(h('figure',{class:'n-restored-item'},h('img',{src:x.src,alt:x.caption,loading:'lazy',decoding:'async',width:x.width,height:x.height}),h('figcaption',{},h('b',{},x.caption),h('span',{},x.note||'복원 자료'))));return h('details',{class:'n-package-restore'},h('summary',{},'편집부 복원 자료 4장 보기'),h('section',{class:'n-restored-section'},grid));}
 function reportingTeaser(){
  const source=W.referenceHub||[],preferred=['dis-club-policy','nspa-ai','yonsei-infographic'],items=preferred.map(id=>source.find(x=>x.id===id)).filter(Boolean);
  if(!items.length)return null;
  const list=h('div',{class:'n-reporting-teaser-list'});
  for(const x of items)list.append(h('article',{},h('span',{class:'n-section-label'},x.publisher),h('h3',{},x.title),h('p',{},x.why),h('small',{},'우리 취재: '+(x.try?.[0]||''))));
  return h('section',{class:'n-reporting-teaser'},sectionHead('다른 학생언론에서 가져온 취재 힌트','원문을 베끼지 않고 취재 방식만 참고합니다.',button('취재 아이디어 더 보기 →',()=>navigate('ideas'),'text'),'05'),list);
 }

 function headlink(a){return h('a',{href:'#read/'+encodeURIComponent(a.id),onclick:e=>{e.preventDefault();read(a.id,isReference(a)).catch(toastError);}},a.headline||a.title);}
 function toastError(e){toast(e.message||'기사를 열지 못했습니다.');}
 function meta(a){return h('div',{class:'n-meta'},a._workingDraft?h('span',{},a.assigneeNames?.length?'담당 '+a.assigneeNames.join(' · '):a.byline||'편집실'):(a.byline?.trim()?h('span',{},a.byline):null),h('span',{},E.readingMinutes(a.body)+'분 읽기'),h('span',{class:'n-status'},label(a)));}
 let publicCache=null,publicCacheAt=0;
 const PUBLIC_CACHE_MS=15000,PUBLIC_READ_TIMEOUT_MS=1800;
 async function catalogue({fresh=false,publicOnly=false}={}){
  let published=publicCache||[];
  const needsRead=storeFn().mode!=='demo'&&(fresh||!publicCache||(Date.now()-publicCacheAt)>PUBLIC_CACHE_MS);
  if(needsRead){
   try{
    const next=await Promise.race([
     storeFn().listPublic(),
     new Promise((_,reject)=>setTimeout(()=>reject(new Error('public read timeout')),PUBLIC_READ_TIMEOUT_MS))
    ]);
    publicCache=Array.isArray(next)?next:[];publicCacheAt=Date.now();published=publicCache;
   }catch(e){
    if(!publicCache){publicCache=[];publicCacheAt=Date.now();}
    published=publicCache;
    console.warn('발행 기사 조회 보류:',e?.code||e?.message);
   }
  }
  const publicCatalogue=W.editionContent.build(published),account=userFn();W.yearChecklist2026?.setPublicationLinks?.(publicCatalogue);if(publicOnly)return publicCatalogue;
  if(!account?.active||!account.uid||!W.workingDrafts)return publicCatalogue;
  try{
   const drafts=await Promise.race([storeFn().listArticles(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('draft read timeout')),5000))]);
   if(userFn()?.uid!==account.uid||!userFn()?.active)return publicCatalogue;
   return W.workingDrafts.merge(publicCatalogue,drafts,account);
  }catch(e){console.warn('편집 원고 조회 보류:',e?.code||e?.message);return publicCatalogue;}
 }
 async function articles(){return (await catalogue()).all;}
 function checkedAccount(){return userFn()?.uid||'reader';}
 function yearCardCheckbox(a){
  if(String(a?.year)!=='2026'||isReference(a)||!W.yearChecklist2026)return null;
  const input=h('input',{type:'checkbox',checked:W.yearChecklist2026.list(checkedAccount()).has(a.id),'aria-label':a.title+' 확인 체크'});
  input.addEventListener('change',()=>{W.yearChecklist2026.toggle(checkedAccount(),a.id,input.checked);});
  return h('label',{class:'n-year-card-check'},input,h('span',{},'확인 체크'));
 }
 function yearStatus(a){return W.yearChecklist2026?.statusFor(a)||{key:'planned',label:'제작계획 · 예시'};}
 function outlineNode(items,compact=false,source=null){
  const c=source||W.editionContent.build([]),plans=c.sections||[],published2026=(c.published||[]).filter(a=>String(a?.year)==='2026'&&!isReference(a));
   W.yearChecklist2026?.setPublicationLinks?.(c);
  const sourceSlots=new Map((c.plans||[]).filter(p=>p.sourceArticleId).map(p=>[p.sourceArticleId,p.productionPlanId]));const articleSlot=a=>a.replacesProductionPlanId||a.productionPlanId||sourceSlots.get(a.id)||null;const bySlot=new Map(published2026.filter(a=>articleSlot(a)).map(a=>[articleSlot(a),a])),handled=new Set();
  const groups=plans.map(g=>({label:g.label,items:g.items.map(p=>{const matched=bySlot.get(p.productionPlanId);if(matched){handled.add(matched.id);return {...matched,planOrder:p.planOrder||matched.planOrder};}return p;})}));
  const specials=published2026.filter(a=>!handled.has(a.id));
  if(specials.length)groups.unshift({label:'2026 발행 특집',items:specials});
  const root=h('section',{class:'n-year-outline',id:compact?'yearOutline':'yearManuscripts'});
  const header=h('div',{class:'n-outline-heading'},h('div',{},h('h2',{},'2026 기사 목록'),h('p',{},'제작 원고와 발행 특집 · 확인 체크는 이 브라우저에 저장되며 승인·발행 상태를 변경하지 않습니다.')),button('기존 예시 원고 보기',()=>navigate('examples'),'text'));
  root.append(header);
  const contents=h('div',{class:'n-outline-groups'}),rows=[];
  for(const group of groups){
    const list=h('ol',{});
    for(const a of group.items){
      const title=String(a.title||a.headline||'제목 미입력').replace(/ — .*$/,'');
       const status=yearStatus(a);
       const semesterLabel=a.replacesProductionPlanId==='P24'?'인문학 기행(2학기)':null;
      const firstSemesterUnfilled=a.productionPlanId==='P08'&&!a.publishedAt&&!a._workingDraft;
       const node=firstSemesterUnfilled
         ?h('span',{class:'n-outline-pending','data-empty-semester':'P08'},title)
         :a._pendingProduction?h('span',{class:'n-outline-pending'},title)
         :h('a',{href:'#read/'+encodeURIComponent(a.id),'data-plan-link':a.id,onclick:e=>{e.preventDefault();read(a.id).catch(toastError);}},title);
      const chk=h('input',{type:'checkbox',checked:W.yearChecklist2026?.list(checkedAccount()).has(a.id)||false,'aria-label':title+' 확인 체크'});
      const wrapper=h('label',{class:'n-year-check-label'},chk,h('span',{},'확인'));
      const li=h('li',{class:'n-checkable-item','data-year-article-id':a.id,'data-year-status':status.key,'data-year-slot':a.replacesProductionPlanId||a.productionPlanId||''},h('span',{class:'n-outline-number'},String(a.planOrder||rows.length+1).padStart(2,'0')),h('span',{class:'n-year-article-title'},semesterLabel?h('span',{class:'n-year-slot-label'},semesterLabel+' · '):null,node,h('span',{class:'n-year-reporter'},a._workingDraft&&a.assigneeNames?.length?a.assigneeNames.join(' · ')+' 기자':String(a.byline||'').replace(/ · 작성용 예시$/,'')),h('span',{class:'n-year-published-tag n-year-state-'+status.key},status.label)),wrapper);
      chk.addEventListener('change',()=>{W.yearChecklist2026?.toggle(checkedAccount(),a.id,chk.checked);refreshChecks();});
      rows.push({id:a.id,li,chk,status:status.key});
      list.append(li);
    }
    contents.append(h('section',{},h('h3',{},group.label),list));
  }
  const count=h('strong',{class:'n-year-check-count'},'확인한 기사 0편');
  const filter=h('input',{type:'checkbox','aria-label':'체크한 기사만 보기'});
  const filterLabel=h('label',{class:'n-year-check-filter'},filter,h('span',{},'체크한 기사만'));
  const statusFilter=h('select',{'aria-label':'원고 진행 상태 필터','data-year-status-filter':'true'},
    ...[['all','모든 진행 상태'],['published','발행 완료'],['draft','작성 중'],['review','검토 중'],['changes','수정 요청'],['approved','승인 완료'],['planned','제작계획 · 예시'],['unregistered','원고 미등록'],['unsubmitted','주제 미제출'],['link-review','연결 검토']].map(([value,text])=>h('option',{value},text)));
  const statusLabel=h('label',{class:'n-year-status-filter'},h('span',{},'진행 상태'),statusFilter);
  const bar=h('div',{class:'n-year-checkbar'},count,statusLabel,filterLabel,
    button('목록 전체 체크',()=>{const all=W.yearChecklist2026?.list(checkedAccount())||new Set();for(const row of rows)all.add(row.id);W.yearChecklist2026?.replace(checkedAccount(),all);refreshChecks();},'text'),
    button('체크 해제',()=>{const all=W.yearChecklist2026?.list(checkedAccount())||new Set();for(const row of rows)all.delete(row.id);W.yearChecklist2026?.replace(checkedAccount(),all);refreshChecks();},'text')
  );
  function refreshChecks(){
    const saved=W.yearChecklist2026?.list(checkedAccount())||new Set();
    count.textContent='확인한 기사 '+rows.filter(x=>saved.has(x.id)).length+'/'+rows.length+'편';
    for(const row of rows){
      const marked=saved.has(row.id);
      row.chk.checked=marked;
      row.li.classList.toggle('n-year-reviewed',marked);
      row.li.hidden=(!!filter.checked&&!marked)||(statusFilter.value!=='all'&&row.status!==statusFilter.value);
    }
  }
  filter.addEventListener('change',refreshChecks);
  statusFilter.addEventListener('change',refreshChecks);
  root.append(bar);
  if(compact){
    const summary=h('details',{class:'n-outline-details'},h('summary',{},'2026 기사 '+rows.length+'편 · 전체 목차 펼치기'),contents);
    root.append(summary);
  }else root.append(contents);
  refreshChecks();
  return root;
 }
 function researchComparisonNode(){
  const rows=W.researchFeatures2026?.comparison||[];if(!rows.length)return null;
  const head=h('tr',{},...['기자','기존 목록','이번 공개 원고','반영 확인'].map(t=>h('th',{scope:'col'},t)));
  const body=rows.map(a=>h('tr',{'data-research-comparison':a.slot},
   h('th',{scope:'row'},a.reporter,h('small',{},a.slot)),
   h('td',{},a.previousTitle),
   h('td',{},h('a',{href:'#read/'+a.id,onclick:e=>{e.preventDefault();read(a.id).catch(toastError);}},a.title),h('small',{},a.action)),
   h('td',{},h('span',{},'✓ 원고 · 기자 · 목록'),h('span',{},'✓ 자료사진 '+a.photoCount+'장'),h('span',{},'✓ 공개 발행'))));
  return h('details',{class:'n-year-audit n-research-comparison',open:true},
   h('summary',{},'1학년 제출 원고 8편 · 기존 목록과 비교'),
   h('p',{},'같은 기자의 유사 주제는 제출 원고로 대체했습니다. 공지환·진도혁 기자는 새 제출 주제로 교체하고, 신승연·장형준 기자는 주제 미제출 상태를 해제했습니다. 기존 예시 원고와 편집 중인 학생 원고는 보존합니다.'),
   h('div',{class:'n-research-table-wrap'},h('table',{},h('thead',{},head),h('tbody',{},body))));
 }
 async function planned(){
  const token=cleanPage(),c=await catalogue();if(token!==generation)return;
  const outline=outlineNode(c.plans,false,c),counts=new Map();
  for(const li of outline.querySelectorAll('.n-checkable-item')){
    const key=li.dataset.yearStatus;counts.set(key,(counts.get(key)||0)+1);
  }
  const statusParts=[['published','발행 완료'],['review','검토 중'],['draft','작성 중'],['changes','수정 요청'],['approved','승인 완료'],['planned','제작계획·예시'],['unregistered','원고 미등록'],['unsubmitted','주제 미제출'],['link-review','연결 검토']]
    .filter(([key])=>counts.has(key)).map(([key,label])=>label+' '+counts.get(key)+'편');
  const total=[...counts.values()].reduce((a,b)=>a+b,0);
  const audit=W.publicationLinker2026?.audit?.(c);
  const issueNote=audit?.duplicates?.length||audit?.issues?.some(x=>x.reason==='duplicate-publication-slot')
    ?'중복 발행 연결 후보는 자동 삭제하지 않고 별도로 확인합니다.':'';
  const auditDetails=h('details',{class:'n-year-audit'},
    h('summary',{},'중복·발행 연결 점검 · 연결 '+(audit?.linked?.length||0)+'편 · 중복 '+(audit?.duplicates?.length||0)+'건'),
    h('p',{},'확인된 발행기사만 연결합니다. 제목이 비슷하다는 이유만으로 학생 원고를 합치지 않습니다.'),
    h('ul',{},...(audit?.linked||[]).map(x=>h('li',{},x.slot+' · '+x.title+' → 발행기사 연결'))),
    ...(audit?.duplicates?.length?[h('p',{class:'n-year-audit-warning'},'동일 제작계획에 여러 발행기사가 연결되어 있습니다. 원고를 자동 삭제하지 않고 확인 대상으로 남깁니다.')]:[]),
    ...(audit?.extras?.length?[h('p',{},'제작계획에 연결되지 않은 별도 발행기사 '+audit.extras.length+'편은 보존합니다.')]:[]),
    h('p',{},'인문학 기행(1학기) P08과 인문학 기행(2학기) P24는 별도 항목입니다.'));
  main.append(h('header',{class:'n-page-heading'},
    h('span',{class:'n-section-label'},'2026 실제 제작목록'),
    h('h1',{},'2026 기사 '+total+'편'),
    h('p',{},statusParts.join(' · ')+'입니다. 실제 편집 원고의 작성·검토 상태는 해당 원고에 접근 권한이 있는 계정에서만 표시합니다. '+issueNote)),
    outline,researchComparisonNode(),auditDetails);
 }
 function clearPage(){document.body.classList.add('reading-view');main.className='newsroom-main';main.replaceChildren();document.getElementById('readProgress')?.remove();}
 function invalidate(){generation++;document.getElementById('readProgress')?.remove();return generation;}
 function cleanPage(){const token=invalidate();clearPage();return token;}
 function sectionHead(title,sub,action,no=''){const attrs={class:'n-section-head'};if(no)attrs['data-section-no']=no;return h('div',attrs,h('div',{},h('h2',{},title),sub?h('p',{},sub):null),action);}
 function photoSourceKey(p){return p?.sourceAsset||p?.webPath||p?.id||'';}
 function displayPhoto(a,usedSources){
  const photos=effectivePhotos(a);if(!photos.length)return null;
  const primary=photos[0];
  if(a?._production2026){const key=photoSourceKey(primary);if(usedSources&&key)usedSources.add(key);return primary;}
  if(!usedSources||!photos.every(p=>p?.lastYearSample===true))return primary;
  const pool=[],seen=new Set(),add=p=>{const k=photoSourceKey(p);if(p&&k&&!seen.has(k)){seen.add(k);pool.push(p);}};
  photos.forEach(add);
  const ly=lastYear();
  if(typeof ly.photoForKey==='function')for(const [i,key] of (ly.order||[]).entries())add(ly.photoForKey(a,key,i));
  if(pool.length&&pool.every(p=>usedSources.has(photoSourceKey(p))))usedSources.clear();
  const picked=pool.find(p=>!usedSources.has(photoSourceKey(p)))||primary,key=photoSourceKey(picked);if(key)usedSources.add(key);
  return picked;
 }
 async function articlePhoto(a,priority=false,usedSources=null){
   const p=displayPhoto(a,usedSources);if(p){const img=await imageNode(p);if(img.tagName==='IMG'){img.loading=priority?'eager':'lazy';if(priority)img.setAttribute('fetchpriority','high');img.decoding='async';if(p.focus)img.style.objectPosition=p.focus;}return h('figure',{class:'n-photo'+(p.restored?' restored-photo':p.lastYearSample?' lastyear-photo':'' )},img,h('figcaption',{},p.restored?h('span',{class:'restored-badge'},'예시사진 · 복원 자료'):p.lastYearSample?h('span',{class:'lastyear-badge'},'예시사진'):E.sample(p)?h('span',{class:'sample-badge'},'예시사진 · 실제 현장 아님'):null,p.caption||'기사 사진'));}
   const title=(a.headline||a.title||'웅비').replace(/^\[.*?\]\s*/,'');return h('div',{class:'v4-empty-image editorial-placeholder '+visualTone(a)+' '+visualKind(a)},h('span',{class:'cover-kicker'},smallLabel(a)),h('strong',{},title.slice(0,34)),h('small',{},'사진 취재 준비 중'),h('i',{class:'cover-folio'},'雄飛 / '+String(a.planOrder||'—').padStart(2,'0')));
  }
 async function card(a,withPhoto=true,usedSources=null,checkable=false){const plan=storyPlan(a),art=h('article',{class:'n-card treatment-'+plan.type,'data-treatment':plan.type,'data-magazine-template':plan.template,'data-read-card':a.id});
  if(withPhoto)art.append(h('a',{class:'n-card-image',href:'#read/'+a.id,'aria-label':a.title+' 기사 읽기',onclick:e=>{e.preventDefault();read(a.id,isReference(a)).catch(toastError);}},await articlePhoto(a,false,usedSources)));
  art.append(h('div',{class:'n-card-kicker'},h('span',{class:'n-section-label'},smallLabel(a)),h('span',{class:'n-format-label'},plan.label||'')),h('h3',{},headlink(a)),h('p',{class:'n-excerpt'},excerpt(a)),meta(a));if(checkable){const yCheck=yearCardCheckbox(a);if(yCheck)art.append(yCheck);}return art;
 }
 async function home(){
  const token=cleanPage(),collection=await catalogue({publicOnly:true}),eligible=collection.all.filter(a=>!isReference(a)&&!a._pendingProduction&&!a._unregisteredSemester),rows=sortMode==='latest'?latestFirst(eligible):E.sort(eligible,sortMode),q=E.normalize(query);
  if(token!==generation)return;
  const filtered=rows.filter(a=>match(a)&&(!q||E.normalize([a.title,a.sourceTitle,a.body,a.byline,(a.assigneeNames||[]).join(' ')].join(' ')).includes(q)));
  const tabs=h('div',{class:'n-topic-tabs',role:'group','aria-label':'기사 분야'},categories.map(([k,t])=>{const b=button(t,()=>{category=k;home();},category===k?'selected':'');b.setAttribute('aria-pressed',category===k);return b;}));
  const search=h('input',{id:'newsSearch',type:'search',placeholder:'기사·주제·기자 검색',value:query,'aria-label':'웹진 기사 검색'});let wait;
  search.addEventListener('input',()=>{query=search.value;clearTimeout(wait);wait=setTimeout(()=>{home().then(()=>document.getElementById('newsSearch')?.focus());},250);});
  const sort=h('select',{'aria-label':'기사 정렬',id:'newsSort'},h('option',{value:'latest'},'최신 발행순'),h('option',{value:'plan'},'편집 순서'),h('option',{value:'updated'},'최근 수정'),h('option',{value:'title'},'제목순'));sort.value=sortMode;sort.hidden=category==='all'&&!q;
  sort.addEventListener('change',()=>{sortMode=sort.value;category=category==='all'?'all-list':category;home();});
  main.append(h('div',{class:'n-toolbar'},tabs,h('label',{class:'n-search'},search),sort));
  const yearRows=rows.filter(a=>a._planned2026),referenceRows=collection.examples;
  main.append(h('div',{class:'n-edition-note'},h('b',{},'로그인 없이 기사 읽기'),h('span',{},'공개 기사 '+collection.published.filter(a=>a.publishedAt&&!a.sample&&!a.draftOnly).length+'편 · 올해 작성용 예시 '+collection.all.filter(a=>a._planned2026&&!a._pendingProduction).length+'편 · 비공개 편집 원고는 포함하지 않습니다.'),h('div',{class:'n-edition-actions'},button('전체 기사 보기',()=>navigate('allarticles'),'text'),button('올해 원고 목록',()=>navigate('yearplan'),'text'))));
  const yearOutline=(category==='all'&&!q)?outlineNode(collection.plans,true,collection):null;
  if(category!=='all'||q){
    if(category==='all-list'&&!q){
      const published=filtered.filter(a=>publicationMillis(a)>0&&!a.sample&&!a.draftOnly&&!a._workingDraft);
      const examples=filtered.filter(a=>!published.includes(a));
      main.append(sectionHead('발행된 기사',published.length+'편 · 누구나 로그인 없이 읽을 수 있습니다.',null,'01'));
      const liveGrid=h('section',{class:'n-list-grid','aria-label':'발행된 기사 목록'}),livePhotos=new Set();
      main.append(liveGrid);
      for(const a of published){const c=await card(a,true,livePhotos);if(token!==generation)return;liveGrid.append(c);}
      if(!published.length)liveGrid.append(h('p',{class:'empty'},'발행된 기사를 준비하고 있습니다.'));
      if(examples.length){
        main.append(sectionHead('2026 작성용 예시',examples.length+'편 · 실제 발행 기사와 구분하여 제공합니다.',null,'02'));
        const exampleGrid=h('section',{class:'n-list-grid','aria-label':'작성용 예시 목록'}),examplePhotos=new Set();
        main.append(exampleGrid);
        for(const a of examples){const c=await card(a,true,examplePhotos);if(token!==generation)return;exampleGrid.append(c);}
      }
      return;
    }
    main.append(sectionHead(q?'“'+query+'” 검색 결과':categories.find(x=>x[0]===category)?.[1]||'모든 기사',filtered.length+'편',button('조건 초기화',()=>{reset();home();},'text')));
   const grid=h('section',{class:'n-list-grid','aria-live':'polite'}),filteredPhotos=new Set();main.append(grid);
   if(!filtered.length)grid.append(h('p',{class:'empty'},category==='saved'?'기사에서 ‘보관하기’를 누르면 이 탭의 보관함에 모입니다.':'일치하는 기사가 없습니다. 다른 검색어로 찾아보세요.'));
   for(const a of filtered){const c=await card(a,true,filteredPhotos,true);if(token!==generation)return;grid.append(c);}return;
  }
  if(!rows.length){main.append(h('section',{class:'empty'},h('h1',{},'웅비의 다음 이야기를 준비합니다.'),h('p',{},'승인 후 발행한 기사만 이곳에 표시합니다.'),button('편집실',()=>navigate('articles'),'ink-button')));return;}
  const ids=data().leadIds||[],publishedRows=latestFirst(rows.filter(a=>publicationMillis(a)>0&&!a.sample&&!a.draftOnly&&!a._workingDraft)),coverChoice=W.homeLead2026.select(publishedRows),configured=rows.find(a=>a.id===ids[0]),fallback=yearRows[0]||rows[0],lead=coverChoice.lead||(configured&&!String(configured.id).startsWith('sample-article-')?configured:fallback),rest=rows.filter(a=>a.id!==lead.id);
  const preferredSideIds=publishedRows.length?publishedRows.filter(a=>a.id!==lead.id).slice(0,2).map(a=>a.id):yearRows.filter(a=>a.id!==lead.id).slice(0,2).map(a=>a.id),sides=[...preferredSideIds.map(id=>rest.find(a=>a.id===id)).filter(Boolean),...rest].filter((a,j,ar)=>ar.findIndex(b=>b.id===a.id)===j).slice(0,2);
  const usedCoverPhotos=new Set(),leadPlan=storyPlan(lead),leadArt=h('article',{class:'n-lead treatment-'+leadPlan.type,'data-treatment':leadPlan.type,'data-magazine-template':leadPlan.template,'data-lead':lead.id},h('div',{class:'n-lead-copy'},h('div',{class:'n-section-label'},(coverChoice.featured?'대표 특집 · 호미곶 해양 플로깅 · ':publishedRows.length?'최신 발행 기사 · ':'이번 호의 시선 · ')+smallLabel(lead)),h('h1',{},headlink(lead)),h('p',{class:'n-lead-deck'},excerpt(lead)),meta(lead)));
  leadArt.append(h('a',{class:'n-lead-image',href:'#read/'+lead.id,onclick:e=>{e.preventDefault();read(lead.id,isReference(lead));}},await articlePhoto(lead,true,usedCoverPhotos)));
  const side=h('aside',{class:'n-side'},h('div',{class:'n-side-title'},'함께 읽는 학교 소식'));
  for(const [i,a] of sides.entries()){const c=await card(a,true,usedCoverPhotos);if(i===1)c.classList.add('n-side-text');side.append(c);}
  side.append(h('div',{class:'n-desk-link'},h('b',{},'포항고의 이야기를 더 읽어보세요.'),button('로그인 없이 전체 기사 보기 ↗',()=>navigate('allarticles'),'text')));
  if(token!==generation)return;const rail=headlineRail(rest.filter(a=>!sides.some(s=>s.id===a.id)).slice(0,4)),opening=h('section',{class:'n-opening-spread','aria-label':'이번 호 첫 지면'},frontFolio(rows,lead),h('section',{class:'n-front'},leadArt,side));if(rail)opening.append(rail);main.append(opening);const restoredBlock=mediaShowcase();if(restoredBlock)main.append(restoredBlock);
  const research=rows.filter(a=>a.planKind==='research'),feature=rows.filter(a=>['학교 사람들','특집'].includes(a.category)&&!sides.some(s=>s.id===a.id)&&a.id!==lead.id);
  const featureTop=feature.slice(0,3),featurePeopleOnly=featureTop.length&&featureTop.every(a=>a.category==='학교 사람들');
  const featureHeading=featurePeopleOnly?['학교 안의 사람들','인터뷰와 교류, 이어 쓰는 이야기']:['학교의 사람과 장면','인터뷰와 특집으로 기록한 학교의 표정'];
  for(const [title,sub,items,cls,no] of [['학생이 묻습니다','일상의 의문에서 시작한 탐구',research.slice(0,5),'n-research-grid','03'],[featureHeading[0],featureHeading[1],featureTop,'n-feature-grid','04']]){
   if(!items.length)continue;const grid=h('section',{class:cls});main.append(sectionHead(title,sub,null,no),grid);for(const a of items){const c=await card(a,true,usedCoverPhotos);if(token!==generation)return;grid.append(c);}
  }
  const packageBlock=packageShowcase();if(packageBlock)main.append(packageBlock);
   const reportingBlock=reportingTeaser();if(reportingBlock)main.append(reportingBlock);
   if(archive().pages?.length){main.append(h('section',{class:'n-archive-promo'},h('div',{},h('span',{class:'n-section-label'},'ARCHIVE / 지난 호'),h('h2',{},'지난해의 학교를\n다시 펼치다.'),h('p',{},'2025년 학교 기록 · 표지 발간 표기는 2026년. 원본 지면을 별도로 보관합니다.'),button('지난 호 읽기 →',()=>navigate('archive'),'ink-button')),h('button',{class:'n-archive-cover',onclick:()=>navigate('archive'),'aria-label':'지난 호 표지 열기'},h('img',{src:asset('archive-cover'),alt:'웅비 VOL.41 원본 표지',loading:'lazy'}))));}
  const shown=new Set([lead.id,...sides.map(a=>a.id),...research.slice(0,5).map(a=>a.id),...feature.slice(0,3).map(a=>a.id)]),other=rows.filter(a=>!shown.has(a.id));
  const moreGrid=h('section',{class:'n-more-grid'});for(const a of other.slice(0,8)){const c=await card(a,true,usedCoverPhotos);if(token!==generation)return;moreGrid.append(c);}main.append(sectionHead('더 읽을 기사',other.length+'편',null,'06'),moreGrid);
  main.append(button('모든 기사 '+rows.length+'편 보기 →',()=>navigate('allarticles'),'n-all-button'));
   if(yearOutline)main.append(h('div',{class:'n-home-index'},yearOutline));
 }
 async function read(id,reference=false,{historyMode='push',skipLeave=false}={}){
  const token=invalidate();
  if(!skipLeave&&!(await api.leaveEditor()))return;
  if(token!==generation)return;const collection=await catalogue();if(token!==generation)return;const rows=collection.all,a=W.editionContent.resolve(id,collection);reference=!!a?._reference;
  if(!a){if(token!==generation)return;await planned();toast('요청한 주소를 찾지 못해 올해 원고 목록을 열었습니다.');return;}
  if(token!==generation)return;const curatedPublished=!!(a.publishedAt&&a.status==='approved'&&a.webConsent===true&&!a.sample&&!a.draftOnly&&!a._workingDraft);const isDraft=reference||!a.publishedAt||(storeFn().mode==='demo'&&!curatedPublished);
  const back=()=>{document.title='웅비 · 포항고 웹진';const fallback=a._planned2026?'yearplan':reference?'examples':'public';if(history.state?.woonbi&&history.state?.view==='reader'&&history.state?.pushed)history.back();else navigate(fallback);};
  const keep=button(bookmarks().has(id)?'보관됨':'보관하기',()=>{const ids=bookmarks();ids.has(id)?ids.delete(id):ids.add(id);W.session.setItem(bookmarkKey(),JSON.stringify([...ids]));keep.textContent=ids.has(id)?'보관됨':'보관하기';keep.setAttribute('aria-pressed',ids.has(id));toast('이 탭의 보관함을 변경했습니다.');},'text');keep.setAttribute('aria-pressed',bookmarks().has(id));
  const controls=h('div',{class:'n-reader-controls'},button('← 목록으로',back,'text'),h('div',{class:'n-reading-tools'},keep,button('글자 작게',()=>{document.body.classList.remove('large-reading');W.session.setItem('woonbi-reader-size','normal');},'text'),button('글자 크게',()=>{document.body.classList.add('large-reading');W.session.setItem('woonbi-reader-size','large');},'text')));
  const articlePlan=storyPlan(a),article=h('article',{class:'n-longread treatment-'+articlePlan.type,'data-treatment':articlePlan.type,'data-magazine-template':articlePlan.template,id:'newsArticle'},h('header',{class:'n-story-head'},h('div',{class:'n-section-label'},a._workingDraft?'2026 편집 초안':a._planned2026?'2026 작성용 예시':reference?(a.archiveLabel||'기존 예시 원고'):smallLabel(a)),h('h1',{},a.headline||a.title),h('p',{class:'n-story-deck'},a.deck||''),meta(a)));
  if(isDraft)article.append(h('aside',{class:'n-draft-notice'},a.sampleNotice||(reference?'보존된 기존 예시 원고입니다. 본문의 연도·인물·출처는 원래 자료 기준이며 2026 현장 보도가 아닙니다.':'미발행 '+label(a)+'입니다. 취재·필자·사진을 확인한 뒤 발행합니다.')));
  const completePhotoSet=effectivePhotos(a),inlineCount=a.photoEssay?Math.max(1,Math.min(12,Number(a.photoEssayInlineCount)||6)):completePhotoSet.length,inlinePhotoSet=a.photoEssay?completePhotoSet.slice(0,inlineCount):completePhotoSet;const rendered=await renderArticle({...a,photos:inlinePhotoSet,category:a.category||'예시 원고'});if(token!==generation)return;const copy=rendered.querySelector('.read-copy');copy.classList.add('n-story-copy');for(const fig of copy.querySelectorAll('figure')){const photos=effectivePhotos(a);if(photos.some(p=>E.sample(p)||p.sample||p.lastYearSample)){let cap=fig.querySelector('figcaption');if(!cap){cap=h('figcaption',{});fig.append(cap);}const badge=cap.querySelector('.lastyear-badge,.restored-badge,.sample-badge');if(badge)badge.textContent='예시사진';else if(!cap.textContent.includes('예시사진'))cap.prepend(h('span',{class:'sample-badge'},'예시사진')); }}article.append(copy);
  if(a.photoEssay&&completePhotoSet.length>inlineCount){
    const extra=completePhotoSet.slice(inlineCount),gallery=h('section',{class:'n-feature-gallery','aria-label':'기행 및 특강 포토스토리'});
    gallery.append(h('div',{class:'n-feature-gallery-head'},h('span',{class:'n-section-label'},'PHOTO STORY · '+completePhotoSet.length+' CUTS'),h('h2',{},a.photoEssayTitle||'사진으로 남긴 하루'),h('p',{},a.photoEssayDeck||'')));
    const galleryGrid=h('div',{class:'n-feature-gallery-grid'});
    let currentGalleryPhase='';
    for(const [i,p] of extra.entries()){
      if(p.galleryPhase&&p.galleryPhase!==currentGalleryPhase){
        currentGalleryPhase=p.galleryPhase;
        galleryGrid.append(h('h3',{class:'n-feature-gallery-subhead'},currentGalleryPhase));
      }
      const photo=await imageNode(p);if(token!==generation)return;
      const figure=h('figure',{class:'n-feature-gallery-item','data-photo':String(i+inlineCount+1).padStart(2,'0')},photo,h('figcaption',{},p.caption||'현장 기록'));
      galleryGrid.append(figure);
    }
    gallery.append(galleryGrid);
    article.append(gallery);
  }
  const toc=h('aside',{class:'n-read-aside'},h('h3',{},'이 글에서'));
  [...copy.querySelectorAll('h3')].forEach((el,i)=>{el.id='sub-'+i;toc.append(h('a',{href:'#sub-'+i,onclick:e=>{e.preventDefault();el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}},el.textContent));});
  if(!reference&&(!a._planned2026||a._workingDraft)&&C.canEdit(userFn(),a))toc.append(button('이 기사 수정하기 ↗',()=>openEditor(a._workingDraft?a.sourceArticleId:a.id),'ink-button'));
  if(a._workingDraft&&a.editorialProposal?.body)article.append(h('details',{class:'n-reporting'},h('summary',{},'별도 제안 원고 · 기존 본문은 보존했습니다'),h('p',{},a.editorialProposal.body)));
  if(a.reportingQuestions?.length)article.append(h('details',{class:'n-reporting'},h('summary',{},'취재·확인 메모'),h('ul',{},a.reportingQuestions.map(t=>h('li',{},t)))));
  if(a.sourceReferences?.length)article.append(h('section',{class:'n-source-box'},h('h3',{},'원고의 참고 자료'),h('ul',{},a.sourceReferences.map(r=>h('li',{},safeUrl(r.url)?h('a',{href:safeUrl(r.url),target:'_blank',rel:'noopener noreferrer'},r.label||r.publisher||r.url):r.label||'',r.publishedAt?' · '+r.publishedAt:''))),h('p',{},a.sourceReferenceNote||'원본에서 복원한 참고 자료이며 사실 검증 완료 표시는 아닙니다.')));
  if(a.sourceBackup||a.sourceFile)article.append(h('details',{class:'n-source-box'},h('summary',{},'복원 출처'),h('p',{},a.sourceBackup||a.sourceFile),h('p',{},'원본 기사 ID: '+(a.sourceArticleId||a.id))));
  if(token!==generation)return;clearPage();api.setView('reader');try{if(historyMode!=='none'){const u=new URL(location.href);u.hash='#read/'+encodeURIComponent(id);const from=a._planned2026?'yearplan':reference?'examples':'public';const state={woonbi:true,view:'reader',from,pushed:historyMode==='push'};if(historyMode==='replace')history.replaceState(state,'',u);else history.pushState(state,'',u);}}catch{}
  document.title=(a.headline||a.title)+' | 웅비';document.body.classList.toggle('large-reading',W.session.getItem('woonbi-reader-size')==='large');
  main.append(controls,h('div',{class:'n-reading-layout'},article,toc));
  if(!reference){const related=rows.filter(b=>b.id!==id&&b.category===a.category).slice(0,3);if(related.length){const grid=h('section',{class:'n-feature-grid'});main.append(sectionHead('같은 코너에서 더 읽기'),grid);for(const x of related){const relatedCard=await card(x);if(token!==generation)return;grid.append(relatedCard);}}}
  const progress=h('progress',{id:'readProgress',max:100,value:0,'aria-label':'기사 읽기 진행'});document.body.append(progress);window.scrollTo(0,0);
 }
 function reset(){category='all';query='';sortMode='latest';}
 window.addEventListener('scroll',()=>{const p=document.getElementById('readProgress'),a=document.getElementById('newsArticle');if(p&&a){const r=a.getBoundingClientRect();p.value=Math.max(0,Math.min(100,(-r.top/(r.height-innerHeight))*100||0));}},{passive:true});
 async function examples(){const token=cleanPage(),c=await catalogue();if(token!==generation)return;const examples=c.examples;main.append(h('header',{class:'n-page-heading'},h('span',{class:'n-section-label'},'기존 자료 보존'),h('h1',{},'기존 예시 원고 '+examples.length+'편'),h('p',{},'기존 본문과 사진을 그대로 보존했습니다. 각 원고의 연도와 출처는 원래 자료 기준입니다.'),button('2026 작성용 원고 '+c.plans.length+'편 보기',()=>navigate('yearplan'),'text')));const list=h('div',{class:'n-example-list'});for(const a of examples)list.append(h('article',{},h('div',{},h('span',{class:'n-section-label'},a.archiveLabel||'기존 예시 원고'),h('h2',{},headlink(a)),h('p',{},C.paragraphs(a.body)[0]?.slice(0,160)||'')),button('원고 읽기 →',()=>read(a.id,true).catch(toastError),'text')));main.append(list);}
 async function ideas(){
  cleanPage();const all=W.referenceHub||[],tags=[...new Set(all.flatMap(x=>x.tags||[]))].sort((a,b)=>a.localeCompare(b,'ko'));let q='',tag='all';
  const head=h('header',{class:'n-page-heading idea-heading'},h('span',{class:'n-section-label'},'REPORTING LAB'),h('h1',{},'취재 아이디어'),h('p',{},'다른 학교 학생언론·대학언론·지역 자료에서 “어떻게 취재했는지”만 참고합니다. 원문을 복사하지 말고, 포항고의 사람·장소·숫자로 다시 취재하세요.'));
  const search=h('input',{type:'search',placeholder:'예: 인터뷰 · AI · 포항 · 동아리','aria-label':'취재 아이디어 검색'}),select=h('select',{'aria-label':'취재 아이디어 주제'},h('option',{value:'all'},'모든 주제'),tags.map(t=>h('option',{value:t},t))),count=h('span',{class:'small muted'}),grid=h('section',{class:'idea-grid','aria-live':'polite'});
  const toolbar=h('div',{class:'idea-toolbar'},search,select,count);
  function paint(){
   const nq=E.normalize(q),rows=all.filter(x=>(tag==='all'||(x.tags||[]).includes(tag))&&(!nq||E.normalize([x.title,x.publisher,x.kind,x.why,(x.tags||[]).join(' '),(x.try||[]).join(' ')].join(' ')).includes(nq)));
   count.textContent=rows.length+'개 사례';grid.replaceChildren();
   for(const [i,x] of rows.entries()){
    const url=safeUrl(x.source),tagsNode=h('div',{class:'idea-tags'},(x.tags||[]).map(t=>h('span',{},t))),tryList=h('ul',{class:'idea-try'},(x.try||[]).map(t=>h('li',{},t)));
    const art=h('article',{class:'idea-card'},h('div',{class:'idea-no'},String(i+1).padStart(2,'0')),h('div',{class:'idea-kind'},x.kind),h('h2',{},x.title),h('p',{class:'idea-publisher'},x.publisher),h('p',{class:'idea-why'},x.why),tryList,tagsNode);
    if(url)art.append(h('a',{class:'idea-source',href:url,target:'_blank',rel:'noopener noreferrer'},'출처 원문 보기 ↗'));
    grid.append(art);
   }
   if(!rows.length)grid.append(h('p',{class:'empty'},'조건에 맞는 사례가 없습니다.'));
  }
  search.addEventListener('input',()=>{q=search.value;paint();});select.addEventListener('change',()=>{tag=select.value;paint();});
  const ethics=h('aside',{class:'idea-ethics'},h('b',{},'웅비 참고 원칙'),h('p',{},'제목·취재 방식·공개 링크를 참고하되 문장을 베끼지 않습니다. 외부 사실은 원출처로 다시 확인하고, 사진·SNS 임베드는 권리와 공개 동의를 확인합니다.'));
  main.replaceChildren(head,toolbar,ethics,grid);paint();
 }
 async function archiveHome(){cleanPage();const ar=archive(),e=data().edition;if(!e||!ar.pages?.length){main.append(h('div',{class:'empty'},'공개 승인을 받은 지난 호를 연결하면 표시됩니다.'));return;}
  main.append(h('section',{class:'n-issue-head'},h('img',{src:asset('archive-cover'),alt:'지난 호 원본 표지'}),h('div',{},h('span',{class:'n-section-label'},'WOONBI ARCHIVE · '+e.issue),h('h1',{},'지난 호\n2025 학교 기록'),h('p',{},'원본은 그대로, 올해 기사와는 별도로.'),h('p',{class:'small muted'},'표지: VOL.41 | 2026 · 원본 '+ar.pages.length+'쪽'),button('원본 지면 펼치기 →',()=>openPage(1),'ink-button'),!W.STANDALONE&&e.pdf?h('a',{class:'text',href:e.pdf,download:'웅비-VOL41-원본.pdf'},'원본 PDF'):null)));
  main.append(h('div',{class:'n-provenance-note'},e.note||''),sectionHead('지난 호 목차','기사 제목을 누르면 원본 지면으로 이동합니다.'));
  const q=h('input',{type:'search',placeholder:'지난 호 제목·코너 검색','aria-label':'지난 호 기사 검색'}),list=h('div',{class:'n-archive-index'});
  function show(){list.replaceChildren();for(const [i,t] of (ar.toc||[]).entries()){if(!E.normalize(t.title+' '+t.category).includes(E.normalize(q.value)))continue;list.append(h('article',{},h('span',{class:'n-count'},String(i+1).padStart(2,'0')),h('div',{},h('span',{class:'n-section-label'},t.category),h('h3',{},h('a',{href:'#archive-page/'+t.page,onclick:ev=>{ev.preventDefault();openPage(t.page);}},t.title))),button('지면 '+t.page+' →',()=>openPage(t.page),'text')));}if(!list.children.length)list.append(h('p',{class:'empty'},'일치하는 지난 호 기사가 없습니다.'));}q.addEventListener('input',show);main.append(h('label',{class:'n-archive-search'},q),list);show();
 }
 function openPage(start=1){const pages=archive().pages||[];if(!pages.length)return;let ix=Math.max(0,Math.min(pages.length-1,start-1));const pic=h('img',{alt:'지난 호 원본 지면',class:'n-page-scan'}),num=h('select',{'aria-label':'원본 지면 선택'});for(const p of pages)num.append(h('option',{value:p.page},p.page+' / '+pages.length));const prev=button('← 이전',()=>{ix--;paint();}),next=button('다음 →',()=>{ix++;paint();}),label=h('span',{class:'small','aria-live':'polite'});num.addEventListener('change',()=>{ix=Number(num.value)-1;paint();});
  const box=h('section',{class:'n-page-viewer'},h('div',{class:'n-page-toolbar'},prev,num,next),h('p',{class:'small muted'},'2025 학교 기록 · 표지 발간 표기는 2026. 좌우 방향키로 넘길 수 있습니다.'),pic,label);
  function paint(){ix=Math.max(0,Math.min(pages.length-1,ix));pic.src=file(pages[ix].src);pic.alt='웅비 지난 호 원본 '+(ix+1)+'쪽';num.value=ix+1;label.textContent='PDF 순서 '+(ix+1)+' / '+pages.length+'쪽';prev.disabled=ix===0;next.disabled=ix===pages.length-1;}paint();dialogOpen('지난 호 · 원본 지면',box);const d=document.getElementById('dialog');d.classList.add('archive-dialog');const key=e=>{if(e.target.tagName==='SELECT')return;if(e.key==='ArrowRight'){e.preventDefault();ix++;paint();}if(e.key==='ArrowLeft'){e.preventDefault();ix--;paint();}};d.addEventListener('keydown',key);d.addEventListener('close',()=>{d.classList.remove('archive-dialog');d.removeEventListener('keydown',key);},{once:true});
 }
 function editorialNotes(a){const x=h('details',{class:'n-editor-source'},h('summary',{},a.contentOrigin==='restored'?'복원 원고 · 취재 메모':'작성 초안 · 취재 메모'),h('p',{},'원래 배정 제목: '+(a.sourceTitle||a.title)),h('p',{},'현재 초안의 필자명은 학생의 서명이 아닙니다. 취재 후 최종 필자명을 확인하세요.'),h('ul',{},(a.reportingQuestions||[]).map(t=>h('li',{},t))));if(a.sourceBackup)x.append(h('small',{},'복원: '+a.sourceBackup));return x;}
 function allArticles(){category='all-list';query='';sortMode='latest';return home();}
  return {home,allArticles,read,planned,examples,ideas,archiveHome,openPage,editorialNotes,asset,reset,invalidate};
};})();

