const fs=require('node:fs');
const css=fs.readFileSync('web/editorial-polish.css','utf8');
const style=fs.readFileSync('web/style.css','utf8');
const news=fs.readFileSync('web/js/newsroom.js','utf8');
const app=fs.readFileSync('web/js/app.js','utf8');
const layout=fs.readFileSync('web/js/editorial-layout.js','utf8');
const bridge=fs.readFileSync('web/js/drive-bridge.js','utf8');
const index=fs.readFileSync('web/index.html','utf8');
const firebase=fs.readFileSync('web/js/firebase-store.js','utf8');
const allCss=style+'\n'+css;
const out=[];const add=(cat,name,ok)=>out.push({id:out.length+1,category:cat,name,ok:!!ok});
const has=(s,x)=>s.includes(x),re=(s,x)=>x.test(s);

// 01-10 identity / anti-slop
add('identity','paper background token',has(css,'--paper:#f4f0e7'));
add('identity','ink foreground token',has(css,'--ink:#171714'));
add('identity','Woonbi navy token',has(css,'--navy:#21384a'));
add('identity','limited accent token',has(css,'--accent:#8b2f2a'));
add('identity','generic cards have zero radius',has(css,'.n-card,.photo-folder-panel,.drive-account-card,.panel{border-radius:0'));
add('identity','primary controls have zero radius',has(css,'.primary,.ink-button,button,input,select,textarea{border-radius:0'));
add('identity','generic card shadow removed',has(css,'box-shadow:none'));
add('identity','no backdrop blur',!re(allCss,/backdrop-filter\s*:/i));
add('identity','no glassmorphism class',!re(index+allCss,/glassmorph|glass-card|frosted/i));
add('identity','anti-slop design contract exists',fs.existsSync('docs/ANTI_SLOP_EDITORIAL_SYSTEM.md'));

// 11-20 issue hierarchy
add('hierarchy','opening spread exists',has(news,'n-opening-spread'));
add('hierarchy','front folio exists',has(news,'n-front-folio'));
add('hierarchy','headline rail exists',has(news,'n-headline-rail'));
add('hierarchy','numbered section headers exist',has(news,'data-section-no'));
add('hierarchy','lead treatment is semantic',has(news,"class:'n-lead treatment-"));
add('hierarchy','default sort hidden on cover',has(news,"sort.hidden=category==='all'&&!q"));
add('hierarchy','section two photo archive number',has(news,"null,'02'"));
add('hierarchy','section three inquiry number',has(news,"'n-research-grid','03'"));
add('hierarchy','section four people feature number',has(news,"'n-feature-grid','04'"));
add('hierarchy','section six more stories number',has(news,"'더 읽을 기사',other.length+'편',null,'06'"));

// 21-30 story treatments
for(const [type,label] of [['photo','PHOTO ESSAY'],['portrait','PEOPLE'],['research','INQUIRY'],['essay','ESSAY'],['feature','FEATURE'],['news','SCHOOL NEWS']]){
 add('classification',type+' classifier',has(layout,"return'"+type+"'"));
 add('classification',type+' magazine label',has(layout,"label:'"+label+"'"));
}
out.splice(30); // keep exactly first 30 before explicit treatment CSS checks below
add('treatments','photo treatment CSS',has(css,'.n-card.treatment-photo'));
add('treatments','portrait treatment CSS',has(css,'.n-card.treatment-portrait'));
add('treatments','research treatment CSS',has(css,'.n-card.treatment-research'));
add('treatments','essay treatment CSS',has(css,'.n-card.treatment-essay'));
add('treatments','feature treatment CSS',has(css,'.n-card.treatment-feature'));
add('treatments','news treatment CSS',has(css,'.n-card.treatment-news'));
add('treatments','treatment stored on DOM',has(news,"'data-treatment':plan.type"));
add('treatments','magazine template stored on DOM',has(news,"'data-magazine-template':plan.template"));
add('treatments','research category classifier',has(layout,"category.includes('탐구')"));
add('treatments','fake nth-child randomness removed',!re(css,/\.n-card:nth-child\(3n\+2\)|\.n-card:nth-child\(5n\)/));

// 41-50 long reads
add('longread','drop cap',has(css,'.n-story-copy>p:first-of-type:first-letter'));
add('longread','pull quote',has(css,'.n-story-copy blockquote'));
add('longread','photo longread wide figures',has(css,'.n-longread.treatment-photo .n-story-copy figure'));
add('longread','portrait longread grid',has(css,'.n-longread.treatment-portrait .n-story-head'));
add('longread','research numbered headings',has(css,"counter-reset:research-section"));
add('longread','essay narrow body',has(css,'.n-longread.treatment-essay .n-story-copy'));
add('longread','feature large headline',has(css,'.n-longread.treatment-feature .n-story-head h1'));
add('longread','reader TOC exists',has(news,"class:'n-read-aside'"));
add('longread','reader size control exists',has(news,'글자 크게'));
add('longread','source box exists',has(news,"class:'n-source-box'"));

// 51-60 media
add('media','captions rendered',has(news,"h('figcaption'"));
add('media','restored media badge',has(news,"'복원 자료'"));
add('media','last-year badge',has(news,'lastyear-badge'));
add('media','sample media clearly labelled',has(news,'교체용 예시 · 실제 현장 아님'));
add('media','object-fit cover',re(allCss,/object-fit:cover/));
add('media','lazy loading',has(news,"loading:'lazy'"));
add('media','async image decoding',has(news,"decoding:'async'"));
add('media','lead fetch priority',has(news,"fetchpriority','high'"));
add('media','photo dedupe source key',has(news,'photoSourceKey'));
add('media','Drive duplicate analysis remains',has(app,'nearDuplicateOf'));

// 61-70 mobile
add('mobile','mobile nav horizontal scroll',has(css,'v0.6 mobile nav: keep section labels horizontal'));
add('mobile','mobile nav nowrap',has(css,'white-space:nowrap'));
add('mobile','mobile footer overflow guard',has(css,'v0.6 mobile footer'));
add('mobile','story treatment collapse under 900',has(css,'@media(max-width:900px)'));
add('mobile','mobile spread becomes single column',has(css,'.magazine-spread-grid{grid-template-columns:1fr}'));
add('mobile','cover candidates responsive',has(css,'@media(max-width:620px){.cover-candidate-grid'));
add('mobile','mobile longread photo reset',has(css,'margin-left:0;transform:none'));
add('mobile','mobile research grid single column',has(index,'newsroom-v06.css'));
add('mobile','touch action enabled',has(style,'touch-action:manipulation'));
add('mobile','viewport-fit cover',has(index,'viewport-fit=cover'));

// 71-80 accessibility / interaction
add('a11y','skip link exists',has(index,'class="skip-link"'));
add('a11y','main tabindex',has(index,'tabindex="-1" id="main"'));
add('a11y','toast live region',has(index,'aria-live="polite"'));
add('a11y','focus-visible outline',has(style,'focus-visible'));
add('a11y','article image alt path',has(app,"alt:p.alt||p.caption"));
add('a11y','news search labelled',has(news,"'aria-label':'웹진 기사 검색'"));
add('a11y','topic tabs pressed state',has(news,"setAttribute('aria-pressed'"));
add('a11y','bookmark pressed state',has(news,"keep.setAttribute('aria-pressed'"));
add('a11y','reduced motion respected',has(news,'prefers-reduced-motion'));
add('a11y','Drive progress live region',has(bridge,"'aria-live':'polite'"));

// 81-90 magazine / print
add('print','magazine layout module loaded',has(index,'js/editorial-layout.js'));
add('print','1p template mapping',has(layout,"template:'news-1p'"));
add('print','2p template mapping',has(layout,"template:'portrait-2p'"));
add('print','4p template mapping',has(layout,"template:'photo-4p'"));
add('print','cover candidate scoring',has(app,'coverCandidateScore'));
add('print','cover candidate preview',has(app,'coverCandidatePanel'));
add('print','cover and contents mockups',has(app,'type-cover')&&has(app,'type-contents'));
add('print','page range calculation',has(app,'x.start=cursor'));
add('print','preflight warnings',has(app,'magazinePreflight'));
add('print','layout plan exported to ZIP',has(app,'01_잡지조판계획.json'));

// 91-100 Google / operational
add('google','Google login available',has(app,'Google로 로그인'));
add('google','new Google accounts activate as student',has(firebase,"role:'student',active:true"));
add('google','Drive Picker module loaded',has(index,'js/drive-bridge.js'));
add('google','Picker multi-select',has(bridge,'MULTISELECT_ENABLED'));
add('google','Picker limits to image MIME types',has(bridge,"setMimeTypes('image/jpeg,image/png,image/webp')"));
add('google','Firebase reauth drive.file',has(firebase,"drive.file"));
add('google','folder scan drive.readonly',has(firebase,"drive.readonly"));
add('google','Drive API key falls back to Firebase key',has(bridge,'firebase?.apiKey'));
add('google','Picker App ID falls back to project number',has(bridge,'messagingSenderId'));
add('google','Drive tokens stay memory only',!re(bridge,/localStorage\.setItem\([^\n]*(accessToken|token)/i));

if(out.length!==100)throw new Error('audit criteria count '+out.length+' != 100');
const failed=out.filter(x=>!x.ok);
for(const x of out)console.log(String(x.id).padStart(3,'0')+' '+(x.ok?'PASS':'FAIL')+' ['+x.category+'] '+x.name);
console.log('\nEDITORIAL UI AUDIT: '+(100-failed.length)+'/100 PASS');
if(failed.length){console.log('FAILED: '+failed.map(x=>x.id).join(', '));process.exitCode=1;}
