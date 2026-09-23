#!/usr/bin/env python3
from __future__ import annotations
import argparse, html, json, re, subprocess, urllib.request, urllib.error, zipfile
from datetime import datetime, timezone
from pathlib import Path

PROJECT='woonbi-webzine-2026'
SOURCE=Path.home()/'Documents'/'2026-Woongbi-Demo-Edition.woongbi'
MAPPING={
  1:'A-2026-001',2:'A-2026-002',4:'A-2026-003',5:'A-2026-004',
  6:'A-2026-005',7:'A-2026-006',8:'A-2026-007',9:'A-2026-008',
  12:'A-2026-010',13:'A-2026-013',16:'A-2026-014',17:'A-2026-015',
  20:'A-2026-017',22:'A-2026-018',24:'A-CURRENT-RB17C87AA6B02-EVENT',
  25:'A-2026-020',27:'A-2026-021',28:'A-2026-024'
}
CATEGORY={
 '인사말':'편집실','학교 이야기':'학교 이야기','교내 행사 & 특집':'특집',
 '학생 참여':'학생 글','인터뷰 & 스토리':'학교 사람들',
 '동아리 & 학교 이야기':'학교 이야기','역사 & 칼럼':'학생 글'
}
def clean_html(s):
    s=str(s or '')
    s=re.sub(r'<br\s*/?>','\n',s,flags=re.I)
    s=re.sub(r'</(p|div|section|article|h[1-6]|li)>','\n\n',s,flags=re.I)
    s=re.sub(r'<[^>]+>',' ',s)
    s=html.unescape(s).replace('\r','')
    s=re.sub(r'[ \t]+',' ',s)
    s=re.sub(r' *\n *','\n',s)
    return re.sub(r'\n{3,}','\n\n',s).strip()
def token():
    exe='gcloud.cmd' if __import__('os').name=='nt' else 'gcloud'
    return subprocess.run([exe,'auth','print-access-token'],check=True,capture_output=True,text=True,encoding='utf-8').stdout.strip()
def req(method,url,tok,body=None):
    data=None if body is None else json.dumps(body,ensure_ascii=False).encode()
    r=urllib.request.Request(url,data=data,method=method,headers={'Authorization':'Bearer '+tok,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(r,timeout=40) as x:
            raw=x.read()
            return json.loads(raw.decode()) if raw else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'HTTP {e.code}: '+e.read().decode('utf-8','replace')[:1200])
def scalar(v):
    if not isinstance(v,dict): return None
    for k in ('stringValue','integerValue','booleanValue','doubleValue','timestampValue'):
        if k in v:return v[k]
    if 'arrayValue' in v:return [scalar(x) for x in v['arrayValue'].get('values',[])]
    if 'mapValue' in v:return {k:scalar(x) for k,x in v['mapValue'].get('fields',{}).items()}
    return None
def decode(fields): return {k:scalar(v) for k,v in fields.items()}
def fsv(v):
    if v is None:return {'nullValue':None}
    if isinstance(v,bool):return {'booleanValue':v}
    if isinstance(v,int):return {'integerValue':str(v)}
    if isinstance(v,float):return {'doubleValue':v}
    if isinstance(v,str):return {'stringValue':v}
    if isinstance(v,list):return {'arrayValue':{'values':[fsv(x) for x in v]}}
    if isinstance(v,dict):return {'mapValue':{'fields':{k:fsv(x) for k,x in v.items()}}}
    raise TypeError(type(v))
def fields(d): return {k:fsv(v) for k,v in d.items()}

ap=argparse.ArgumentParser()
ap.add_argument('--confirm',default='')
args=ap.parse_args()
live=args.confirm=='MERGE-LEGACY-DRAFTS'
tok=token()
base=f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents'
members=req('GET',base+'/members?pageSize=100',tok).get('documents',[])
teachers=[d['name'].split('/')[-1] for d in members if decode(d.get('fields',{})).get('role')=='teacher' and decode(d.get('fields',{})).get('active') is True]
if len(teachers)!=1: raise SystemExit(f'Expected one active teacher, found {len(teachers)}')
teacher=teachers[0]
with zipfile.ZipFile(SOURCE) as z:
    src=json.loads(z.read('project.json')).get('articles',[])
now=datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
summary=[]
writes=[]
for n,aid in MAPPING.items():
    url=base+'/articles/'+urllib.parse.quote(aid,safe='') if False else base+'/articles/'+aid
    d=req('GET',url,tok)
    cur=decode(d.get('fields',{}))
    source=src[n-1]
    src_body=clean_html(source.get('content'))[:45000]
    if cur.get('status')!='draft':
        summary.append((aid,'SKIP_STATUS',cur.get('title'),len(cur.get('body') or ''))); continue
    if len(cur.get('body') or '')>=60:
        summary.append((aid,'KEEP_WRITTEN',cur.get('title'),len(cur.get('body') or ''))); continue
    nextdoc=dict(cur)
    old_title=str(cur.get('title') or '')
    polished=str(source.get('displayHeadline') or source.get('title') or old_title)[:150]
    nextdoc['sourceTitle']=str(cur.get('sourceTitle') or old_title)[:150]
    nextdoc['title']=polished
    if not str(cur.get('deck') or '').strip(): nextdoc['deck']=str(source.get('subtitle') or '')[:350]
    if src_body: nextdoc['body']=src_body
    nextdoc['categorySource']=str(cur.get('categorySource') or f"Demo Edition: {source.get('section') or ''}")[:350]
    notes=list(cur.get('notes') or [])
    note=f"2026 Demo Edition 복원 초안 연결 · {source.get('title') or ''}"
    if note not in notes: notes.append(note)
    nextdoc['notes']=notes[-16:]
    nextdoc['revision']=int(cur.get('revision') or 0)+1
    nextdoc['updatedBy']=teacher
    nextdoc['updatedAt']=now
    nextdoc['serverWrittenAt']=now
    nextdoc['webConsent']=False; nextdoc['printConsent']=False
    revision=nextdoc['revision']
    name=d['name']; revname=name+f'/revisions/{revision}'
    writes += [
      {'update':{'name':name,'fields':fields(nextdoc)},'currentDocument':{'updateTime':d['updateTime']}},
      {'update':{'name':revname,'fields':fields({'snapshot':nextdoc,'actor':teacher,'at':now})},'currentDocument':{'exists':False}}
    ]
    summary.append((aid,'MERGE',old_title,len(src_body)))
print('teacher=',teacher[:8]+'…')
for x in summary: print(*x,sep=' | ')
print('merge_candidates=',sum(x[1]=='MERGE' for x in summary),'writes=',len(writes))
if not live:
    print('DRY_RUN: use --confirm MERGE-LEGACY-DRAFTS')
else:
    for i in range(0,len(writes),80):
        result=req('POST',f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents:batchWrite',tok,{'writes':writes[i:i+80]})
        bad=[x for x in result.get('status',[]) if x and x.get('code',0)]
        if bad: raise RuntimeError('batchWrite failed '+json.dumps(bad,ensure_ascii=False))
    print('MERGED=',sum(x[1]=='MERGE' for x in summary))
