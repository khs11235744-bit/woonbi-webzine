/* Pure editorial domain: usable in a browser and in node --test. */
(function(root){
'use strict';
const CATEGORIES=['학교 이야기','특집','학교 사람들','학생 글','사진과 기록','편집실'];
const STATUS={draft:'작성 중',submitted:'검토 요청',changes:'수정 요청',approved:'승인 완료'};
const EDIT_FIELDS=['title','deck','body','photos','byline'];
const MAX_PHOTOS=12, MAX_BODY=45000;
function error(code,message){const e=new Error(message);e.code=code;return e;}
function staff(u){return !!u?.active&&['teacher','editor'].includes(u.role);}
function teacher(u){return !!u?.active&&u.role==='teacher';}
function canRead(u,a){return !!u?.active&&(staff(u)||a.assigneeIds.includes(u.uid));}
function canEdit(u,a){return canRead(u,a)&&['draft','changes'].includes(a.status);}
function clone(v){return structuredClone(v);}
function paragraphs(s){return String(s||'').replace(/\r\n?/g,'\n').split(/\n\s*\n/).map(x=>x.trim()).filter(Boolean);}
function blocks(s){return paragraphs(s).map((text,i)=>({i,kind:/^##\s+[^\n]+$/.test(text)?'heading':'paragraph',text:text.replace(/^##\s+/,'')}));}
function fields(raw){
 const o={};for(const k of EDIT_FIELDS)if(Object.hasOwn(raw,k))o[k]=clone(raw[k]);return o;
}
function validContent(a){
 if(typeof a.title!=='string'||a.title.length>150)throw error('invalid','제목은 150자 안으로 적어 주세요.');
 if(typeof a.deck!=='string'||a.deck.length>350)throw error('invalid','부제는 350자 안으로 적어 주세요.');
 if(typeof a.body!=='string'||a.body.length>MAX_BODY)throw error('invalid','본문은 45,000자 안으로 적어 주세요.');
 if(typeof a.byline!=='string'||a.byline.length>80)throw error('invalid','공개 필자명은 80자 안으로 적어 주세요.');
 if(!Array.isArray(a.photos)||a.photos.length>MAX_PHOTOS)throw error('invalid','사진은 기사당 최대 12장입니다.');
 const used=new Set();for(const p of a.photos){
   if(!p||typeof p.id!=='string'||used.has(p.id))throw error('invalid','중복되거나 잘못된 사진입니다.');used.add(p.id);
   if(typeof p.webPath!=='string'||typeof p.originalPath!=='string'||typeof p.caption!=='string'||p.caption.length>300||typeof p.alt!=='string'||p.alt.length>200||!Number.isInteger(p.after)||p.after< -1||p.after>10000)throw error('invalid','사진 설명 또는 위치를 확인해 주세요.');
 }
 return a;
}
function requirements(a){
 const e=[];if(!a.title.trim())e.push('제목');if(a.body.trim().length<60)e.push('본문 60자 이상');if(!a.byline.trim())e.push('필자명');
 if(a.photos.length<a.minPhotos)e.push(`사진 ${a.minPhotos}장 이상`);
 if(a.photos.some(p=>!p.alt.trim()))e.push('사진 대체 설명');if(a.photos.some(p=>p.placeholder||p.webPath.startsWith('seed/')))e.push('교체용 예시 사진 교체 또는 제거');return e;
}
function newArticle(u,{id,title,category,assigneeIds,dueDate,minPhotos=0},now){
 if(!teacher(u))throw error('permission','기사 배정은 담당교사가 할 수 있습니다.');
 if(!id||!Array.isArray(assigneeIds)||assigneeIds.length<1||assigneeIds.length>8||!CATEGORIES.includes(category))throw error('invalid','담당 학생과 코너를 확인해 주세요.');
 if((dueDate!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(dueDate))||!Number.isInteger(minPhotos)||minPhotos<0||minPhotos>MAX_PHOTOS)throw error('invalid','마감일과 사진 수를 확인해 주세요.');
 return validContent({id,title,deck:'',body:'',byline:'',category,assigneeIds:[...new Set(assigneeIds)],dueDate,minPhotos,photos:[],status:'draft',feedback:'',revision:0,updatedBy:u.uid,createdAt:now,updatedAt:now,webConsent:false,printConsent:false});
}
function saveDraft(u,a,expected,patch,now){
 if(!canEdit(u,a))throw error('permission','이 기사의 원고를 수정할 권한이 없거나 검토 중입니다.');
 if(a.revision!==expected)throw error('conflict','다른 창에서 원고가 바뀌었습니다. 내 글을 복사해 두고 최신 원고를 다시 열어 주세요.');
 return validContent({...clone(a),...fields(patch),revision:a.revision+1,updatedBy:u.uid,updatedAt:now,webConsent:false,printConsent:false});
}
function transition(u,a,expected,target,options={},now){
 if(!canRead(u,a))throw error('permission','이 기사를 볼 수 없습니다.');
 if(a.revision!==expected)throw error('conflict','검토 중 원고가 바뀌었습니다. 다시 확인해 주세요.');
 const allowed=(target==='submitted'&&canEdit(u,a)) ||
  (target==='changes'&&staff(u)&&['submitted','approved'].includes(a.status)) ||
  (target==='approved'&&teacher(u)&&a.status==='submitted');
 if(!allowed)throw error('permission','허용되지 않은 상태 변경입니다.');
 if(target==='submitted'){const e=requirements(a);if(e.length)throw error('incomplete',`제출 전 확인: ${e.join(', ')}`);}
 if(target==='approved'&&requirements(a).length)throw error('incomplete','승인 전 원고와 실제 사진을 확인해 주세요.');
 if(target==='changes'&&!String(options.feedback||'').trim())throw error('invalid','수정할 내용을 적어 주세요.');
 return {...clone(a),status:target,feedback:target==='changes'?String(options.feedback).slice(0,2500):a.feedback,
   revision:a.revision+1,updatedAt:now,updatedBy:u.uid,
   webConsent:target==='approved'&&options.webConsent===true,
   printConsent:target==='approved'&&options.printConsent===true};
}
function publication(u,a,now){
 if(!teacher(u)||a.status!=='approved'||!a.webConsent)throw error('permission','교사 승인과 웹 공개 동의 확인이 필요합니다.');
 if(a.photos.some(p=>p.placeholder||p.webPath.startsWith('seed/')))throw error('incomplete','교체용 사진은 공개할 수 없습니다.');
 // Explicit whitelist: no emails, assignee IDs, comments, private photo paths.
 return {id:a.id,title:a.title,deck:a.deck,body:a.body,byline:a.byline,category:a.category,sourceRevision:a.revision,publishedAt:now,
   photos:a.photos.map(p=>({id:p.id,caption:p.caption,alt:p.alt,width:p.width,height:p.height,after:p.after,webPath:`public/${a.id}/${a.revision}/${p.id}.webp`}))};
}
function printSnapshot(u,articles,title,now){
 if(!teacher(u))throw error('permission','책 묶기는 담당교사만 사용할 수 있습니다.');
 if(!title.trim()||!articles.length||articles.length>60)throw error('invalid','책 제목과 1~60편의 기사를 선택해 주세요.');
 if(articles.some(a=>a.status!=='approved'||!a.printConsent))throw error('permission','책 수록 동의를 확인한 승인 기사만 묶을 수 있습니다.');
 if(articles.some(a=>a.photos.some(p=>p.placeholder||p.webPath.startsWith('seed/'))))throw error('incomplete','교체용 사진은 책 확정본에 넣을 수 없습니다.');
 return {title:title.slice(0,150),createdAt:now,items:articles.map(a=>({id:a.id,title:a.title,deck:a.deck,body:a.body,byline:a.byline,category:a.category,sourceRevision:a.revision,photos:clone(a.photos)}))};
}
function photoPositions(a){
 const b=blocks(a.body),out=new Map(),used=new Set(),sum=b.reduce((v,x)=>v+x.text.length,0);let acc=0;
 const anchors=b.map(x=>{acc+=x.text.length;return {i:x.i,ratio:acc/Math.max(1,sum),kind:x.kind};}).filter(x=>x.kind!=='heading'&&x.i<b.length-1);
 a.photos.forEach((p,i)=>{let pos=p.after;
  if(pos===-1&&i>0){const target=i/a.photos.length;const choices=anchors.filter(x=>!used.has(x.i));pos=(choices.length?choices:anchors).sort((a,b)=>Math.abs(a.ratio-target)-Math.abs(b.ratio-target))[0]?.i??Math.max(0,b.length-1);}
  if(pos>=0){pos=Math.min(pos,Math.max(0,b.length-1));if(b[pos]?.kind==='heading')pos=Math.min(pos+1,b.length-1);}
  used.add(pos);if(!out.has(pos))out.set(pos,[]);out.get(pos).push(p);
 });return out;
}
function projectGuard(config){if(config.mode!=='firebase')return;const id=config.firebase?.projectId||'';
 if(!/^woonbi-[a-z0-9-]{3,35}$/.test(id)||id.includes('indie'))throw error('project','별도 woonbi- Firebase 프로젝트만 연결할 수 있습니다.');
 if(!config.firebase.apiKey||!config.firebase.authDomain||!config.firebase.appId)throw error('config','Firebase 웹 설정이 비어 있습니다.');
}
function uuid(){const b=new Uint8Array(16);globalThis.crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const x=Array.from(b,v=>v.toString(16).padStart(2,'0')).join('');return x.slice(0,8)+'-'+x.slice(8,12)+'-'+x.slice(12,16)+'-'+x.slice(16,20)+'-'+x.slice(20);}
const api={uuid,CATEGORIES,STATUS,MAX_PHOTOS,MAX_BODY,staff,teacher,canRead,canEdit,clone,blocks,paragraphs,fields,validContent,requirements,newArticle,saveDraft,transition,publication,printSnapshot,photoPositions,projectGuard,error};
root.Woonbi=root.Woonbi||{};root.Woonbi.core=api;
const volatile=new Map();root.Woonbi.session={persistent:true,getItem(k){try{return root.sessionStorage.getItem(k);}catch{this.persistent=false;return volatile.get(k)||null;}},setItem(k,v){try{root.sessionStorage.setItem(k,v);}catch{this.persistent=false;volatile.set(k,v);}},removeItem(k){try{root.sessionStorage.removeItem(k);}catch{volatile.delete(k);}},keys(){try{return Object.keys(root.sessionStorage);}catch{return [...volatile.keys()];}}};if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
