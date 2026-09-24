import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const SCHOOL_ORIGIN='https://school.gyo6.net';
const SCHOOL_HOME=SCHOOL_ORIGIN+'/pohanghs';
const NOTICE_LIST=SCHOOL_HOME+'/na/ntt/selectNttList.do?mi=166505&bbsId=28490';
const SCHEDULE_PAGE=SCHOOL_HOME+'/schl/sv/schdulView/schdulCalendarView.do?mi=10203736';
const MEAL_PAGE=SCHOOL_HOME+'/ad/fm/foodmenu/selectFoodMenuView.do?mi=166511';
const NEIS_ORIGIN='https://open.neis.go.kr/hub';
const OFFICE='R10';
const SCHOOL='8750133';
const LIVE_PREVIOUS='https://woonbi-webzine-2026.web.app/school-life.json';

const outArg=process.argv.find(a=>a.startsWith('--out='))?.slice(6);
const outPath=path.resolve(outArg||'dist-live/school-life.json');
const dateArg=process.argv.find(a=>a.startsWith('--date='))?.slice(7);

function seoulYmd(date=new Date()){
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
}
function asDate(ymd){return new Date(ymd+'T12:00:00+09:00');}
function addDays(ymd,n){const d=asDate(ymd);d.setUTCDate(d.getUTCDate()+n);return seoulYmd(d);}
function compactYmd(ymd){return ymd.replaceAll('-','');}
function fmtDate(ymd){const [,m,d]=ymd.split('-');return `${Number(m)}/${Number(d)}`;}
function cleanHtml(s=''){
  return String(s)
    .replace(/<br\s*\/?>/gi,' · ')
    .replace(/<[^>]+>/g,' ')
    .replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&')
    .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
    .replace(/&quot;/gi,'"').replace(/&#39;/gi,"'")
    .replace(/\s+/g,' ').trim();
}
function cap(s,n=230){s=cleanHtml(s);return s.length>n?s.slice(0,n-1).trim()+'…':s;}
function stripAllergen(s){return s.replace(/\s*\((?:\d+\.?)+\)/g,'').replace(/\s+/g,' ').trim();}
function absolute(href=''){try{return new URL(href,SCHOOL_ORIGIN).href;}catch{return ''}}
function checkedAt(){
  return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false})
    .format(new Date()).replace(/\. /g,'.').replace(/\.$/,'');
}
function checkedIso(){return new Date().toISOString();}
function weekBounds(ymd){
  const d=asDate(ymd),day=d.getDay(),delta=day===0?-6:1-day;
  const monday=addDays(ymd,delta),sunday=addDays(monday,6);
  return [monday,sunday];
}
function overlaps(item,start,end){
  const b=(item.bgnde||'').replaceAll('/','-').slice(0,10),e=(item.endde||item.bgnde||'').replaceAll('/','-').slice(0,10);
  return b&&e&&b<=end&&e>=start;
}
async function get(url,options={}){
  const headers={'user-agent':'WoonbiWebzine/0.6 (+public-school-information)',...(options.headers||{})};
  try{
    const r=await fetch(url,{redirect:'follow',...options,headers});
    if(!r.ok)throw new Error(`HTTP ${r.status} ${url}`);
    return r;
  }catch(fetchError){
    const exe=process.platform==='win32'?'curl.exe':'curl';
    const args=['-L','-sS','--fail-with-body','--max-time','25'];
    if(options.method)args.push('-X',options.method);
    for(const [k,v] of Object.entries(headers))args.push('-H',`${k}: ${v}`);
    if(options.body!=null)args.push('--data',typeof options.body==='string'?options.body:options.body.toString());
    args.push(url);
    try{
      const body=execFileSync(exe,args,{encoding:'utf8',maxBuffer:4*1024*1024});
      return {ok:true,status:200,text:async()=>body,json:async()=>JSON.parse(body)};
    }catch(curlError){
      throw new Error(`fetch/curl failed: ${fetchError.message}; ${curlError.message}`);
    }
  }
}
async function previousLive(){
  try{
    const j=await (await get(LIVE_PREVIOUS)).json();
    return j?.mode==='live'?j:null;
  }catch{return null}
}
function staleFrom(previous,key,fallback){
  const old=previous?.[key];
  if(!old)return {...fallback,status:'확인 실패',body:'공식 정보 연결을 잠시 확인하지 못했습니다.',error:true};
  return {...old,stale:true,status:'이전 정상값',source:(old.source||fallback.source)+' · 임시 보존'};
}
async function guarded(name,key,fn,fallback,previous){
  try{
    const value=await fn();
    return {...value,stale:false,error:false};
  }catch(e){
    console.warn(`[school-life] ${name} failed: ${e.message}`);
    return staleFrom(previous,key,fallback);
  }
}

async function neisMeal(apiKey,ymd){
  const params={Type:'json',pIndex:'1',pSize:'10',ATPT_OFCDC_SC_CODE:OFFICE,SD_SCHUL_CODE:SCHOOL,MLSV_YMD:compactYmd(ymd)};
  if(apiKey)params.KEY=apiKey;
  const q=new URLSearchParams(params);
  const j=await (await get(NEIS_ORIGIN+'/mealServiceDietInfo?'+q)).json();
  const rows=j.mealServiceDietInfo?.[1]?.row||[];
  const lunch=rows.find(x=>x.MMEAL_SC_NM==='중식')||rows[0];
  if(!lunch)return {
    title:'오늘의 급식',status:'등록 없음',body:'오늘은 나이스에 등록된 급식 정보가 없습니다.',
    items:[],provider:'NEIS',source:'나이스 급식식단정보',url:MEAL_PAGE
  };
  const items=String(lunch.DDISH_NM||'').split(/<br\s*\/?>/i).map(stripAllergen).map(cleanHtml).filter(Boolean);
  return {
    title:'오늘의 급식',
    status:`${lunch.MMEAL_SC_NM||'급식'}${lunch.CAL_INFO?' · '+lunch.CAL_INFO:''}`,
    body:cap(items.join(' · '),280),items:items.slice(0,12),provider:'NEIS',
    source:'나이스 급식식단정보',url:MEAL_PAGE
  };
}
async function officialMeal(homeHtml){
  const box=homeHtml.match(/<div class="meal_menu0036">([\s\S]*?)<\/div>\s*<!--\s*\/\/식단/i)?.[1]||homeHtml;
  const dt=box.match(/<dt[^>]*class="[^"]*kcal[^"]*"[^>]*>([\s\S]*?)<\/dt>/i)?.[1]||'';
  const dd=box.match(/<dd[^>]*class="[^"]*meal_list[^"]*"[^>]*>([\s\S]*?)<\/dd>/i)?.[1]||'';
  if(!dd)throw new Error('공식 홈페이지 급식 파싱 실패');
  const items=cleanHtml(dd).split(' · ').map(stripAllergen).filter(Boolean);
  return {
    title:'오늘의 급식',status:cleanHtml(dt)||'중식',body:cap(items.join(' · '),280),items:items.slice(0,12),
    provider:'포항고 공식 홈페이지',source:'포항고 공식 홈페이지 · 오늘의 식단',url:MEAL_PAGE
  };
}
async function neisSchedule(apiKey,ymd){
  const [from,to]=weekBounds(ymd);
  const params={Type:'json',pIndex:'1',pSize:'50',ATPT_OFCDC_SC_CODE:OFFICE,SD_SCHUL_CODE:SCHOOL,AA_FROM_YMD:compactYmd(from),AA_TO_YMD:compactYmd(to)};
  if(apiKey)params.KEY=apiKey;
  const q=new URLSearchParams(params);
  const j=await (await get(NEIS_ORIGIN+'/SchoolSchedule?'+q)).json();
  const rows=j.SchoolSchedule?.[1]?.row||[];
  const items=rows.map(x=>({date:`${x.AA_YMD?.slice(0,4)}-${x.AA_YMD?.slice(4,6)}-${x.AA_YMD?.slice(6,8)}`,title:x.EVENT_NM||''})).filter(x=>x.date&&x.title);
  return scheduleCard(items,'나이스 학사일정','NEIS');
}
async function officialSchedule(ymd){
  const [from,to]=weekBounds(ymd);
  const month=ymd.slice(0,7).replace('-','/');
  const body=new URLSearchParams({srchDate:month,sysId:'pohanghs',mi:'10203736'});
  const r=await get(SCHOOL_HOME+'/wm/widg/selectSchdulList.do',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded;charset=UTF-8','referer':SCHOOL_HOME},body});
  const rows=await r.json();
  const items=rows.filter(x=>overlaps(x,from,to)).map(x=>({date:(x.bgnde||'').replaceAll('/','-').slice(0,10),title:x.schdulTitle||x.title||''})).filter(x=>x.date&&x.title);
  return scheduleCard(items,'포항고 공식 홈페이지 · 학교일정','포항고 공식 홈페이지');
}
function scheduleCard(items,source,provider){
  const seen=new Set();
  items=items.filter(x=>{
    const k=x.date+'|'+String(x.title).replace(/\s+/g,'').toLowerCase();
    if(seen.has(k))return false;seen.add(k);return true;
  }).sort((a,b)=>a.date.localeCompare(b.date));
  const clipped=items.slice(0,8);
  return {
    title:'이번 주 일정',
    status:clipped.length?`${clipped.length}건 확인`:'등록 일정 없음',
    body:clipped.length?cap(clipped.map(x=>`${fmtDate(x.date)} ${x.title}`).join(' · '),280):'이번 주 등록된 주요 일정이 없습니다.',
    items:clipped,provider,source,url:SCHEDULE_PAGE
  };
}
async function officialNotice(homeHtml){
  const section=homeHtml.match(/<div class="list_box[^"]*" id="notice1">([\s\S]*?)<\/div>\s*<div class="list_box[^"]*" id="notice2"/i)?.[1]
    || homeHtml.match(/id="notice1"([\s\S]*?)id="notice2"/i)?.[1] || homeHtml;
  const rows=[];
  const top=section.match(/<a\s+href="([^"]*selectNttInfo\.do\?[^"]+)"[^>]*class="[^"]*topList[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
  if(top){
    const inner=top[2],title=cleanHtml(inner.match(/<dt[^>]*>([\s\S]*?)<\/dt>/i)?.[1]||'');
    const y=inner.match(/<span[^>]*class="[^"]*date[^"]*"[^>]*>\s*(20\d{2})\s*<em>\s*(\d{2}\.\d{2})\s*<\/em>/i);
    if(title)rows.push({title,date:y?y[1]+'.'+y[2]:'',url:absolute(top[1])});
  }
  const re=/<li>\s*<a\s+href="([^"]*selectNttInfo\.do\?[^"]+)"[^>]*>([\s\S]*?)<span[^>]*>[\s\S]*?(20\d{2}\.\d{2}\.\d{2})[\s\S]*?<\/span>[\s\S]*?<\/a>\s*<\/li>/gi;
  let m;
  while((m=re.exec(section))&&rows.length<5){
    const title=cleanHtml(m[2].replace(/<span[\s\S]*$/i,''));
    if(title)rows.push({title,date:m[3],url:absolute(m[1])});
  }
  if(!rows.length){
    const listHtml=await (await get(NOTICE_LIST)).text();
    const re2=/<a[^>]+href="([^"]*selectNttInfo\.do\?[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;let x;
    while((x=re2.exec(listHtml))&&rows.length<5){
      const all=cleanHtml(x[2]),date=all.match(/(20\d{2}[.\/-]\d{2}[.\/-]\d{2})/)?.[1]||'';
      const title=all.replace(/20\d{2}[.\/-]\d{2}[.\/-]\d{2}.*/,'').trim();
      if(title)rows.push({title,date,url:absolute(x[1])});
    }
  }
  const unique=[];const seen=new Set();
  for(const row of rows){
    const key=row.title.replace(/\s+/g,'');
    if(!key||seen.has(key))continue;seen.add(key);unique.push(row);
  }
  if(!unique.length)throw new Error('공식 공지사항 파싱 실패');
  const items=unique.slice(0,4),first=items[0];
  return {
    title:'주요 공지',status:first.date||'최근 공지',body:cap(first.title,220),items,
    provider:'포항고 공식 홈페이지',source:'포항고 공식 홈페이지 · 공지사항',url:first.url||NOTICE_LIST
  };
}

const ymd=dateArg||seoulYmd();
const apiKey=process.env.NEIS_API_KEY?.trim()||'';
const previous=await previousLive();
let homeHtml='';
try{homeHtml=await (await get(SCHOOL_HOME)).text();}catch(e){console.warn('[school-life] homepage failed:',e.message)}

let meal=await guarded('meal','meal',
  async()=>{try{return await neisMeal(apiKey,ymd)}catch(e){console.warn('[school-life] NEIS meal fallback:',e.message);return officialMeal(homeHtml)}},
  {title:'오늘의 급식',source:'포항고 공식 홈페이지 · 오늘의 식단',url:MEAL_PAGE,items:[]},previous
);
const schedule=await guarded('schedule','schedule',
  async()=>{try{return await neisSchedule(apiKey,ymd)}catch(e){console.warn('[school-life] NEIS schedule fallback:',e.message);return officialSchedule(ymd)}},
  {title:'이번 주 일정',source:'포항고 공식 홈페이지 · 학교일정',url:SCHEDULE_PAGE,items:[]},previous
);
const notice=await guarded('notice','notice',
  ()=>officialNotice(homeHtml),
  {title:'주요 공지',source:'포항고 공식 홈페이지 · 공지사항',url:NOTICE_LIST,items:[]},previous
);

if(meal.status==='등록 없음'){
  const today=(schedule.items||[]).filter(x=>x.date===ymd).map(x=>x.title).filter(Boolean);
  if(today.length)meal={...meal,body:`오늘은 ${today.join(' · ')} 일정으로 급식 정보가 등록되지 않았습니다.`};
}
const stale=!!(meal.stale||schedule.stale||notice.stale);
const result={
  mode:'live',date:ymd,updatedAt:checkedAt(),updatedAtIso:checkedIso(),stale,
  sourceMode:apiKey?'NEIS Open API(인증키) + 포항고 공식 홈페이지':'NEIS Open API + 포항고 공식 홈페이지',
  providers:{neis:apiKey?'configured':'public-no-key',schoolHomepage:homeHtml?'ok':'fallback'},
  meal,schedule,notice
};
await fs.mkdir(path.dirname(outPath),{recursive:true});
await fs.writeFile(outPath,JSON.stringify(result,null,2)+'\n','utf8');
console.log(`Wrote school-life data: ${outPath}`);
console.log(`meal=${meal.status}; schedule=${schedule.status}; notice=${notice.status}; stale=${stale}`);
