(function(){'use strict';
const W=window.Woonbi=window.Woonbi||{};
const DEMO={
  mode:'demo',updatedAt:'',updatedAtIso:'',stale:false,sourceMode:'연결 준비 중',
  providers:{neis:'offline',schoolHomepage:'offline'},
  meal:{title:'오늘의 급식',status:'연결 준비 중',body:'공식 급식 정보 연결 후 오늘 중식이 표시됩니다.',source:'나이스·포항고 공식정보',items:[]},
  schedule:{title:'이번 주 일정',status:'연결 준비 중',body:'포항고 학사일정과 주요 행사를 이곳에 표시합니다.',source:'나이스·포항고 공식정보',items:[]},
  notice:{title:'주요 공지',status:'연결 준비 중',body:'학교 공지 중 최신 공개 소식을 연결합니다.',source:'포항고 공식 홈페이지',items:[]}
};
function text(v){return String(v??'').replace(/[<>]/g,'');}
function safeUrl(v){try{const u=new URL(String(v||''),location.href);return u.protocol==='https:'?u.href:'';}catch{return '';}}
function el(tag,cls,value){const n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=value;return n;}
function appendText(parent,tag,cls,value){const n=el(tag,cls,value);parent.append(n);return n;}
function freshness(d){
  if(d.stale)return {label:'이전 정상값 사용',cls:'stale'};
  if(!d.updatedAtIso)return {label:'연결 준비 중',cls:'offline'};
  const age=(Date.now()-Date.parse(d.updatedAtIso))/60000;
  if(!Number.isFinite(age))return {label:'업데이트 시각 확인',cls:'offline'};
  if(age<=90)return {label:'실시간 연결',cls:'live'};
  if(age<=360)return {label:'최근 확인',cls:'recent'};
  return {label:'갱신 지연',cls:'stale'};
}
async function load(){
  const cfg=window.WOONBI_CONFIG||{},url=cfg.schoolLifeEndpoint||'';
  if(!url)return DEMO;
  try{
    const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();return {mode:'live',...d};
  }catch(e){return {...DEMO,error:'학교정보 연결 실패 · 기사 읽기에는 영향 없음'};}
}
function sourceNode(x){
  const url=safeUrl(x.url),label=text(x.source)||'공식 출처';
  if(!url)return el('small','school-life-source',label);
  const small=el('small','school-life-source'),a=el('a','',label+' ↗');
  a.href=url;a.target='_blank';a.rel='noopener noreferrer';small.append(a);return small;
}
function mealItems(x){
  if(!Array.isArray(x.items)||!x.items.length)return null;
  const list=el('ul','school-life-menu');
  x.items.slice(0,8).forEach(item=>list.append(el('li','',text(item))));
  return list;
}
function groupSchedule(items){
  const rows=(items||[]).map(x=>({...x})),out=[];
  const day=n=>new Date(String(n)+'T12:00:00+09:00').getTime();
  for(const item of rows){
    const last=out[out.length-1],date=String(item.date||'');
    if(last&&last.title===item.title&&date&&last.endDate&&day(date)-day(last.endDate)===86400000){last.endDate=date;continue;}
    out.push({...item,startDate:date,endDate:date});
  }
  return out;
}
function shortDate(v){return String(v||'').replace(/^\d{4}-/,'').replace('-','/');}
function scheduleItems(x){
  if(!Array.isArray(x.items)||!x.items.length)return null;
  const list=el('ol','school-life-list');
  groupSchedule(x.items).slice(0,5).forEach(item=>{
    const li=el('li',''),range=item.startDate===item.endDate?shortDate(item.startDate):shortDate(item.startDate)+'–'+shortDate(item.endDate);
    li.append(el('time','',range),el('span','',text(item.title)));
    list.append(li);
  });
  return list;
}
function noticeItems(x){
  if(!Array.isArray(x.items)||!x.items.length)return null;
  const list=el('ol','school-life-list notice-list');
  x.items.slice(0,3).forEach(item=>{
    const li=el('li',''),url=safeUrl(item.url),label=text(item.title);
    li.append(el('time','',text(item.date||'')));
    if(url){const a=el('a','',label);a.href=url;a.target='_blank';a.rel='noopener noreferrer';li.append(a);}
    else li.append(el('span','',label));
    list.append(li);
  });
  return list;
}
function card(key,x){
  const a=el('article','school-life-item school-life-'+key);
  if(x.stale)a.classList.add('is-stale');
  const top=el('div','school-life-card-head');
  top.append(el('span','school-life-status',text(x.status)),el('span','school-life-provider',text(x.provider||'')));
  a.append(top,el('h3','',text(x.title)));
  const details=key==='meal'?mealItems(x):key==='schedule'?scheduleItems(x):noticeItems(x);
  if(details)a.append(details);else a.append(el('p','school-life-summary',text(x.body)));
  a.append(sourceNode(x));
  return a;
}
async function build(){
  const d=await load(),wrap=el('section','school-life');
  wrap.id='schoolLive';wrap.setAttribute('aria-label','오늘의 포항고 공식 학교정보');wrap.dataset.woonbiSchoolLife='1';
  const state=freshness(d),head=el('div','school-life-head'),left=el('div','school-life-title');
  left.append(el('span','school-life-kicker','LIVE SCHOOL DATA'),el('h2','', '오늘의 포항고'));
  const live=el('div','school-life-live '+state.cls),elDot=el('span','live-dot');
  live.append(elDot,el('b','',state.label));
  const providers=el('div','school-life-providers');
  providers.append(el('span','provider-chip','NEIS'),el('span','provider-chip','포항고 공식 홈페이지'));
  const meta=el('div','school-life-meta');
  meta.append(live,providers,el('p','',d.mode==='live'?(d.updatedAt?'마지막 정상 확인 '+d.updatedAt:'공식 정보 연결'):'연결 준비 중'));
  head.append(left,meta);wrap.append(head);
  const grid=el('div','school-life-grid');
  for(const key of ['meal','schedule','notice'])grid.append(card(key,d[key]||{}));
  wrap.append(grid);
  const foot=el('div','school-life-foot');
  foot.append(el('span','',text(d.sourceMode||'')));
  const refresh=el('button','text school-life-refresh','새로 확인');
  refresh.type='button';refresh.addEventListener('click',async()=>{refresh.disabled=true;refresh.textContent='확인 중…';const fresh=await build();wrap.replaceWith(fresh);});
  foot.append(refresh);wrap.append(foot);
  if(d.error)wrap.append(el('p','school-life-error',d.error));
  return wrap;
}
let seq=0;
async function mount(){
  const main=document.getElementById('main');if(!main)return;
  const front=main.querySelector('.n-front');
  if(!front){main.querySelector('[data-woonbi-school-life]')?.remove();return;}
  if(main.querySelector('[data-woonbi-school-life]'))return;
  const token=++seq,box=await build();if(token!==seq||!document.body.contains(front))return;front.before(box);
}
function watch(){
  const main=document.getElementById('main');if(!main)return;
  new MutationObserver(()=>queueMicrotask(mount)).observe(main,{childList:true,subtree:false});mount();
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',watch,{once:true}):watch();
W.schoolLife={load,build,mount};
})();