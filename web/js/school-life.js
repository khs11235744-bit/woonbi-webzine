(function(){'use strict';
const W=window.Woonbi=window.Woonbi||{};
const DEMO={
  mode:'demo',updatedAt:'',
  meal:{title:'오늘의 급식',status:'연결 준비 중',body:'공식 급식 정보 연결 후 오늘 중식이 표시됩니다.',source:'포항고 공식 홈페이지'},
  schedule:{title:'이번 주 일정',status:'연결 준비 중',body:'포항고 학사일정과 주요 행사를 이곳에 표시합니다.',source:'포항고 공식 홈페이지'},
  notice:{title:'주요 공지',status:'연결 준비 중',body:'학교 공지 중 최신 공개 소식을 연결합니다.',source:'포항고 공식 홈페이지'}
};
function text(v){return String(v??'').replace(/[<>]/g,'');}
function safeUrl(v){try{const u=new URL(String(v||''),location.href);return u.protocol==='https:'?u.href:'';}catch{return '';}}
async function load(){
  const cfg=window.WOONBI_CONFIG||{},url=cfg.schoolLifeEndpoint||'';
  if(!url)return DEMO;
  try{
    const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error('HTTP '+r.status);
    const d=await r.json();return {mode:'live',...d};
  }catch(e){return {...DEMO,error:'생활정보 연결 실패 · 기사 읽기에는 영향 없음'};}
}
function el(tag,cls,value){const n=document.createElement(tag);if(cls)n.className=cls;if(value!=null)n.textContent=value;return n;}
function sourceNode(x){
  const url=safeUrl(x.url),label=text(x.source)||'공식 출처';
  if(!url)return el('small','school-life-source',label);
  const small=el('small','school-life-source'),a=el('a','',label+' ↗');
  a.href=url;a.target='_blank';a.rel='noopener noreferrer';small.append(a);return small;
}
async function build(){
  const d=await load(),wrap=el('section','school-life');wrap.setAttribute('aria-label','오늘의 포항고');wrap.dataset.woonbiSchoolLife='1';
  const head=el('div','school-life-head'),left=el('div');left.append(el('span','school-life-kicker','TODAY AT POHANG HIGH'),el('h2','', '오늘의 포항고'));
  const stamp=d.mode==='live'?(d.updatedAt?'마지막 정상 확인 '+d.updatedAt:'공식 정보 연결'):'연결 준비 중 · 기사와 별도';
  head.append(left,el('p','',stamp));
  wrap.append(head);const grid=el('div','school-life-grid');
  for(const key of ['meal','schedule','notice']){
    const x=d[key]||{},a=el('article','school-life-item');
    a.append(el('span','school-life-status',text(x.status)),el('h3','',text(x.title)),el('p','',text(x.body)),sourceNode(x));
    grid.append(a);
  }
  wrap.append(grid);
  if(d.error)wrap.append(el('p','school-life-error',d.error));
  return wrap;
}
let seq=0;
async function mount(){
  const main=document.getElementById('main');if(!main)return;
  const front=main.querySelector('.n-front');if(!front){main.querySelector('[data-woonbi-school-life]')?.remove();return;}
  if(main.querySelector('[data-woonbi-school-life]'))return;
  const token=++seq,box=await build();if(token!==seq||!document.body.contains(front))return;front.before(box);
}
function watch(){const main=document.getElementById('main');if(!main)return;new MutationObserver(()=>queueMicrotask(mount)).observe(main,{childList:true,subtree:false});mount();}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',watch,{once:true}):watch();
W.schoolLife={load,build,mount};
})();
