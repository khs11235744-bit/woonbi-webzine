/* Private edition preview. Source articles and legacy issue snapshots are never changed. */
(function(){'use strict';
const W=window.Woonbi=window.Woonbi||{};
const GEOMETRY={width:794,height:1123,trimWidthMm:210,trimHeightMm:297};
function plan(items=[],{albumSize=2}={}){albumSize=[1,2,4].includes(Number(albumSize))?Number(albumSize):2;return items.flatMap(a=>{const photos=Array.isArray(a.photos)?a.photos:[],out=[{kind:'article',article:a,body:String(a.body||''),photos:photos.slice(0,1)}];for(let i=1;i<photos.length;i+=albumSize)out.push({kind:'album',article:a,body:'',photos:photos.slice(i,i+albumSize)});return out;});}
function flowSplit(text,fit){const chars=Array.from(text),min=70;if(chars.length-fit<min){if(chars.length<min*2)return 0;fit=Math.min(fit,chars.length-min);}const prefix=chars.slice(0,fit).join(''),boundary=Math.max(prefix.lastIndexOf(' '),prefix.lastIndexOf('\n'));return boundary>prefix.length*.7?Array.from(prefix.slice(0,boundary+1)).length:fit;}
function measuredFlowSplit(text,fit,measureLines){const chars=Array.from(text);let cut=flowSplit(text,fit);const step=Math.max(20,Math.ceil(cut/32));for(let attempt=0;attempt<32&&cut>=70;attempt++){if(measureLines(chars.slice(cut).join(''))>=1.95)return cut;const next=flowSplit(text,Math.max(0,cut-step));if(next>=cut)return 0;cut=next;}return 0;}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
async function preview(issue,options={}){
 const {imageNode,onChange,renderText}=options;const paint=(node,raw,heading=false)=>{const text=(heading?raw.replace(/^#{1,3}\s+/,''):raw).replace(/\n+$/,'');if(renderText)node.replaceChildren(...renderText(text));else node.textContent=text;};issue.layout=issue.layout||{};const settings=issue.layout;
 const changed=()=>{if(onChange)onChange(settings);};
 const root=el('section','book26-preview'),toolbar=el('div','book26-toolbar'),status=el('p','book26-status');
 root.append(toolbar,status);root.append(el('p','book26-navigation-hint','100%는 A4 실제 편집 크기입니다. 작은 화면에서는 좌우로 밀어 보거나 ‘폭 맞춤’을 선택하세요. 목차의 제목을 누르면 해당 지면으로 이동합니다.'));
 const viewport=el('div','book26-viewport'),stack=el('div','book26-stack');viewport.append(stack);root.append(viewport);
 const mount=el('div','book26-measure');document.body.append(mount);
 let pages=[],number=0,imageFailures=0;const imageStatus=el('p','book26-image-status');imageStatus.setAttribute('role','status');root.insertBefore(imageStatus,viewport);const reportImages=()=>{imageStatus.textContent=imageFailures?'불러오지 못한 사진 '+imageFailures+'장 · 연결을 확인하세요. 원본 목록에서는 빠지지 않았습니다.':'';root.dataset.imageFailures=String(imageFailures);};
 const makePage=(a,kind,continuation=false)=>{const page=el('article','book26-page book26-'+kind);page.dataset.articleId=a.id||'';page.dataset.kind=kind;const running=el('div','book26-running','雄飛 · 2026 / '+(kind==='album'?'사진첩':kind==='cover'?'표지':kind==='contents'?'목차':a.category||'학교 이야기'));const content=el('div','book26-content');page.append(running,content,el('div','book26-folio',String(++number)));mount.append(page);pages.push(page);if(continuation)content.append(el('h3','book26-continued',String(a.title||'').slice(0,100)+' · 이어서'));return {page,content};};
 const figure=async p=>{const fig=el('figure','book26-figure');fig.dataset.photoId=p.id||p.webPath||p.sourceAsset||'';try{if(imageNode)fig.append(await imageNode(p));else{const img=el('img');img.src=p.url||p.sourceAsset||'';img.alt=p.alt||p.caption||'';fig.append(img);}}catch{fig.append(el('p','book26-image-error','사진을 불러오지 못했습니다. 원본 연결을 확인하세요.'));imageFailures++;reportImages();}if(!fig.querySelector('img')&&!fig.querySelector('.book26-image-error')){imageFailures++;fig.classList.add('book26-photo-failed');reportImages();}for(const img of fig.querySelectorAll('img')){let failed=false;const failure=()=>{if(failed)return;failed=true;imageFailures++;fig.classList.add('book26-photo-failed');reportImages();};img.addEventListener('error',failure);img.addEventListener('load',()=>{if(failed){failed=false;imageFailures--;fig.classList.remove('book26-photo-failed');reportImages();}});if(img.complete&&!img.naturalWidth)failure();}const caption=el('figcaption',null,p.caption||p.alt||'');if(p.credit)caption.append(el('span','book26-credit','사진 · '+p.credit));fig.append(caption);return fig;};
 const overflow=c=>c.scrollHeight>c.clientHeight+1;
 try{
 await Promise.race([document.fonts?.ready||Promise.resolve(),new Promise(resolve=>setTimeout(resolve,4000))]);
 for(const item of plan(issue.items||[],settings)){
  const a=item.article;let current=makePage(a,item.kind);
  if(item.kind==='album'){
   current.content.append(el('h2','book26-album-title',a.title+' · 사진첩'));
   const grid=el('div','book26-album-grid');grid.dataset.count=item.photos.length;current.content.append(grid);
   for(const p of item.photos)grid.append(await figure(p));
   if(overflow(current.content)&&item.photos.length>1){
    const figures=[...grid.children];grid.replaceChildren(figures.shift());grid.dataset.count='1';
    for(const fig of figures){const next=makePage(a,'album');next.content.append(el('h2','book26-album-title',a.title+' · 사진첩'));const nextGrid=el('div','book26-album-grid');nextGrid.dataset.count='1';nextGrid.append(fig);next.content.append(nextGrid);}
   }
   continue;
  }
  current.content.append(el('h2','book26-title',a.title||'제목 없음'));
  if(a.deck)current.content.append(el('p','book26-deck',a.deck));
  if(a.byline)current.content.append(el('p','book26-byline',a.byline));
  if(item.photos.length){const fig=await figure(item.photos[0]);fig.classList.add('book26-hero');current.content.append(fig);}
  // Keep whitespace and every source character. Long paragraphs flow over real sheets.
  const segments=item.body.match(/[^\n]+(?:\n+|$)|\n+/g)||[];
  for(const segment of segments){
   let remaining=segment;
   while(remaining){
    const heading=/^#{1,3}\s/.test(remaining)&&remaining.length<300,node=el(heading?'h3':'p',heading?'book26-heading':'book26-copy',remaining);node.dataset.sourceText=remaining;paint(node,remaining,heading);current.content.append(node);
    if(!overflow(current.content))break;
    node.remove();
    // A heading stays with its following paragraph whenever it can fit on the next page.
    if(heading){current=makePage(a,'article',true);current.content.append(node);break;}
    const chars=Array.from(remaining);let lo=0,hi=chars.length;
    current.content.append(node);
    while(lo<hi){const mid=Math.ceil((lo+hi)/2);paint(node,chars.slice(0,mid).join(''));if(overflow(current.content))hi=mid-1;else lo=mid;}
    lo=measuredFlowSplit(remaining,lo,tail=>{const probe=el('p','book26-copy');paint(probe,tail);current.content.append(probe);const lineHeight=parseFloat(getComputedStyle(probe).lineHeight)||32;const lines=probe.getBoundingClientRect().height/lineHeight;probe.remove();return lines;});if(lo<70){node.remove();if(current.content.children.length===1&&current.content.firstElementChild?.classList.contains('book26-continued')){throw new Error('A4 본문 영역에 글을 배치할 수 없습니다. 화면 글꼴과 지면 설정을 확인하세요.');}const last=current.content.lastElementChild;const orphan=last?.classList.contains('book26-heading')?last:null;if(orphan)orphan.remove();current=makePage(a,'article',true);if(orphan)current.content.append(orphan);continue;}
    const take=lo;
    node.dataset.sourceText=chars.slice(0,take).join('');paint(node,node.dataset.sourceText);
    remaining=chars.slice(take).join('');if(remaining)current=makePage(a,'article',true);
   }
  }
 }
 // A short final continuation should not leave nearly an entire sheet empty.
 // Move complete trailing paragraphs forward; never invent text or shrink typography.
 for(const a of issue.items||[]){const articlePages=pages.filter(p=>p.dataset.articleId===a.id&&p.dataset.kind==='article');if(articlePages.length<2)continue;const previous=articlePages.at(-2).querySelector('.book26-content'),last=articlePages.at(-1).querySelector('.book26-content');const count=c=>[...c.querySelectorAll('[data-source-text]')].reduce((n,p)=>n+p.dataset.sourceText.length,0);let rounds=0;
  while(count(last)<350&&rounds++<8){const node=previous.lastElementChild;if(!node?.classList.contains('book26-copy'))break;const size=node.dataset.sourceText.length;if(count(previous)-size<350)break;const anchor=last.querySelector('[data-source-text]');last.insertBefore(node,anchor);let movedHeading=null;if(previous.lastElementChild?.classList.contains('book26-heading')){movedHeading=previous.lastElementChild;last.insertBefore(movedHeading,node);}if(overflow(last)){if(movedHeading)previous.append(movedHeading);previous.append(node);break;}}
 }
 const contentPages=[...pages],cover=makePage({id:'',title:issue.title},'cover');
 cover.content.append(el('p','book26-cover-kicker','포항고등학교 학생 교지'),el('h1','book26-cover-brand','雄飛'),el('p','book26-cover-name','웅비 · WOONBI'),el('p','book26-cover-tagline','학생이 보고, 학생이 묻고, 학생이 기록합니다.'),el('h2','book26-cover-title',issue.title||'웅비 2026'),el('p','book26-cover-year','2026'),el('p','book26-cover-note','포항고등학교 · Pohang High School'),el('p','book26-cover-proof','본문 · 사진첩 / 비공개 편집 교정본'));
 const coverImage=el('img','book26-cover-image');coverImage.src='assets/media/school.webp';coverImage.alt='포항고등학교 건물 전경';coverImage.dataset.decorative='school-cover';coverImage.addEventListener('error',()=>{coverImage.classList.add('book26-cover-image-failed');imageFailures++;reportImages();});cover.content.insertBefore(coverImage,cover.content.querySelector('.book26-cover-title'));
 const tocPages=[],tocRows=[];let toc=null,previousCategory='';
 const nextToc=()=>{toc=makePage({id:'',title:'목차'},'contents');toc.content.append(el('p','book26-cover-kicker','CONTENTS'),el('h2','book26-title','이번 호의 차례'));tocPages.push(toc.page);};
 if((issue.items||[]).length)nextToc();
 for(const a of issue.items||[]){const category=a.category||'학교의 기록';if(category!==previousCategory){const section=el('h3','book26-toc-section',category);toc.content.append(section);previousCategory=category;}const row=el('div','book26-toc-row'),name=el('span',null,a.title),range=el('b',null,'000–000');if(String(a.byline||'').trim())name.append(el('small','book26-toc-byline',a.byline));row.append(name,range);toc.content.append(row);if(overflow(toc.content)){row.remove();const last=toc.content.lastElementChild;if(last?.classList.contains('book26-toc-section'))last.remove();nextToc();toc.content.append(el('h3','book26-toc-section',category),row);}tocRows.push({a,row,range});}
 pages=[cover.page,...tocPages,...contentPages];pages.forEach((page,i)=>{page.querySelector('.book26-folio').textContent=String(i+1);page.dataset.folio=String(i+1);});
 for(const {a,row,range} of tocRows){const own=pages.filter(p=>p.dataset.articleId===a.id);range.textContent=own.length?own[0].dataset.folio+(own.length>1?'–'+own.at(-1).dataset.folio:''):'';row.tabIndex=0;row.setAttribute('role','link');row.setAttribute('aria-label',a.title+' '+range.textContent+'쪽');const go=()=>own[0]?.scrollIntoView({block:'start',behavior:'smooth'});row.addEventListener('click',go);row.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();go();}});}
 for(const page of pages){
  const content=page.querySelector('.book26-content');
  if(page.dataset.kind==='album'&&overflow(content)){
   const images=[...content.querySelectorAll('img')];
   for(let pass=0;pass<3&&images.length&&overflow(content);pass++){const excess=content.scrollHeight-content.clientHeight+8;for(const img of images){const height=img.getBoundingClientRect().height;img.style.setProperty('height',Math.max(160,height-excess/images.length)+'px','important');}}
  }
  if(overflow(content))throw new Error('A4 '+page.querySelector('.book26-folio').textContent+'쪽의 내용이 지면을 넘습니다. 사진 수 또는 긴 제목·설명을 확인하세요.');
  stack.append(page);
 }
 }finally{mount.remove();}
 root.dataset.pageCount=String(pages.length);root.dataset.decorativePhotoCount='1';root.dataset.articleCount=String((issue.items||[]).length);
 const heading=el('strong',null,'2026 · A4 본문 + 사진첩'),zoom=el('select');zoom.setAttribute('aria-label','책 편집 확대');
 for(const [value,label] of [['fit','폭 맞춤'],['1','100%'],['1.25','125%'],['1.5','150%']]){const option=el('option',null,label);option.value=value;zoom.append(option);}
 zoom.value=['fit','1','1.25','1.5'].includes(settings.zoom)?settings.zoom:'1';
 const density=el('select');density.setAttribute('aria-label','사진첩 한 쪽 사진 수');for(const n of [1,2,4]){const o=el('option',null,'사진첩 '+n+'장 / 쪽');o.value=String(n);density.append(o);}density.value=String(settings.albumSize||2);density.addEventListener('change',async()=>{settings.albumSize=Number(density.value);changed();density.disabled=true;try{const replacement=await preview(issue,options);root.book26Dispose?.();root.replaceWith(replacement);}catch(e){density.disabled=false;status.textContent='배치를 바꾸지 못했습니다. 다시 시도하세요.';}});
 const mode=el('button',null,'두 쪽 보기');mode.type='button';mode.setAttribute('aria-pressed','false');mode.addEventListener('click',()=>{const on=stack.classList.toggle('book26-spread');mode.setAttribute('aria-pressed',String(on));mode.textContent=on?'한 쪽 보기':'두 쪽 보기';settings.spread=on;changed();applyZoom();});
 function applyZoom(){const available=viewport.clientWidth||794,columns=stack.classList.contains('book26-spread')?2:1;const scale=zoom.value==='fit'?Math.min(1,Math.max(.25,(available-32)/(columns*794+(columns-1)*24))):Number(zoom.value);stack.style.setProperty('--book26-scale',String(scale));for(const p of pages){p.style.zoom=String(scale);} }
 zoom.addEventListener('change',()=>{settings.zoom=zoom.value;changed();applyZoom();});if(settings.spread){stack.classList.add('book26-spread');mode.setAttribute('aria-pressed','true');mode.textContent='한 쪽 보기';}toolbar.append(heading,zoom,mode,density);
 status.textContent=`${(issue.items||[]).length}편 · 표지·목차·본문·사진첩 ${pages.length}쪽 · 전체 사진 ${(issue.items||[]).reduce((n,a)=>n+(a.photos||[]).length,0)}장 + 표지 학교 사진 1장. 비공개 편집 미리보기이며 인쇄 확정본이 아닙니다.`;
 if(!pages.length)stack.append(el('p','book26-empty','2026 수록 기사를 선택하면 본문과 사진첩이 표시됩니다.'));
 requestAnimationFrame(applyZoom);if(typeof ResizeObserver!=='undefined'){const observer=new ResizeObserver(applyZoom);observer.observe(viewport);root.book26Dispose=()=>observer.disconnect();}
 return root;
}
async function printProof(root){
 if(!root?.querySelector('.book26-page'))throw new Error('교정할 지면이 없습니다. 먼저 기사를 선택하세요.');
 let area=document.getElementById('printArea'),created=false;if(!area){area=el('div');area.id='printArea';area.hidden=true;document.body.append(area);created=true;}
 const previous=[...area.childNodes],wasHidden=area.hidden,style=el('style');style.textContent='@media print{@page{size:A4 portrait;margin:0}body>*{display:none!important}body>#printArea{display:block!important}#printArea .book26-page{zoom:1!important;box-shadow:none!important;width:210mm!important;height:297mm!important;break-after:page!important;break-inside:avoid!important;page-break-after:always!important;margin:0!important}#printArea .book26-page:last-child{break-after:auto!important;page-break-after:auto!important}#printArea .book26-proof-mark{display:block!important;position:absolute;bottom:20px;left:58px;color:#8b2f2a!important;font:11px sans-serif!important}}';
 const pages=[...root.querySelectorAll('.book26-page')].map(p=>{const copy=p.cloneNode(true);copy.style.zoom='1';copy.append(el('div','book26-proof-mark','교정용 · 인쇄 동의 확인 전 · 비공개 편집본'));return copy;});
 area.hidden=false;area.replaceChildren(...pages);document.head.append(style);
 let restored=false;const restore=()=>{if(restored)return;restored=true;style.remove();if(created)area.remove();else{area.replaceChildren(...previous);area.hidden=wasHidden;}window.removeEventListener('afterprint',restore);};window.addEventListener('afterprint',restore,{once:true});
 try{await Promise.race([document.fonts?.ready||Promise.resolve(),new Promise(resolve=>setTimeout(resolve,4000))]);await Promise.race([Promise.all([...area.querySelectorAll('img')].map(img=>img.decode?.().catch(()=>{}))),new Promise(resolve=>setTimeout(resolve,12000))]);for(const img of area.querySelectorAll('img'))if(!img.complete||!img.naturalWidth){img.closest('figure')?.classList.add('book26-photo-failed');}window.print();}catch(e){restore();throw e;}
}
W.bookLayout2026={plan,preview,printProof,GEOMETRY,flowSplit,measuredFlowSplit};
})();
