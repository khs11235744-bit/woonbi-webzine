#!/usr/bin/env python3
import json, subprocess, urllib.request, urllib.parse
from pathlib import Path
from datetime import datetime

PROJECT='woonbi-webzine-2026'
ROOT=Path(__file__).resolve().parents[1]
MAPPED={
'A-2026-001','A-2026-002','A-2026-003','A-2026-004','A-2026-005','A-2026-006','A-2026-007','A-2026-008',
'A-2026-010','A-2026-013','A-2026-014','A-2026-015','A-2026-017','A-2026-018','A-CURRENT-RB17C87AA6B02-EVENT',
'A-2026-020','A-2026-021','A-2026-024'}

def token():
    exe='gcloud.cmd' if __import__('os').name=='nt' else 'gcloud'
    return subprocess.run([exe,'auth','print-access-token'],check=True,capture_output=True,text=True,encoding='utf-8').stdout.strip()
def call(method,url,tok,body=None):
    data=None if body is None else json.dumps(body,ensure_ascii=False).encode()
    r=urllib.request.Request(url,data=data,method=method,headers={'Authorization':'Bearer '+tok,'Content-Type':'application/json'})
    with urllib.request.urlopen(r,timeout=45) as x:
        raw=x.read(); return json.loads(raw.decode()) if raw else {}
def sval(f,n): return f.get(n,{}).get('stringValue','')
def arr(f,n):
    vals=f.get(n,{}).get('arrayValue',{}).get('values',[])
    return [x.get('stringValue','') for x in vals]
def fsarr(xs): return {'arrayValue':{'values':[{'stringValue':str(x)[:500]} for x in xs]}}

def guide(title,cat,kind):
    t=title.strip()
    if '주제 미제출' in t or '탐구 주제 1' in t:
        qs=['내가 끝까지 파고들 핵심 질문은 무엇인가?','이 질문에 답하려면 어떤 통계·논문·인터뷰 자료가 필요한가?','서로 다른 관점이나 반례를 어떻게 함께 다룰 것인가?']
        photo='사진 계획: 주제 확정 후 핵심 개념 도해 1장, 실제 자료·현장 2장 이상, 결론을 보여주는 시각자료 1장 이상.'
        draft='초안 가이드: 문제 제기 → 자료로 확인한 사실 → 서로 다른 관점 → 내가 내린 잠정 결론 순서로 작성.'
    elif cat=='학교 사람들' or '인터뷰' in t:
        qs=['이 인물의 역할이나 변화가 학교생활과 어떻게 연결되는가?','인터뷰에서 꼭 직접 인용할 한 문장은 무엇인가?','개인 소개를 넘어 독자가 얻을 수 있는 정보는 무엇인가?']
        photo='사진 계획: 인물 정면 1장, 활동 장면 1장, 인터뷰 장소·맥락 사진 1장 이상.'
        draft='초안 가이드: 인물 소개 → 핵심 질문과 답변 → 구체적 사례 → 학생 독자에게 남기는 의미.'
    elif cat in ('학교 이야기','특집','사진과 기록'):
        qs=['이 행사의 목적과 실제 현장 모습은 어떻게 달랐는가?','참가자·운영자의 목소리에서 공통으로 나온 장면은 무엇인가?','결과나 의미를 보여줄 수 있는 구체적 수치·사실은 무엇인가?']
        photo='사진 계획: 전체 현장 1장, 인물 행동 1장, 세부 장면 1장, 결과·기록 사진 1장 이상.'
        draft='초안 가이드: 가장 강한 현장 장면으로 시작 → 배경과 진행 → 참가자 목소리 → 의미와 다음 과제.'
    elif kind=='research' or cat=='학생 글':
        qs=['이 글이 답하려는 한 문장짜리 질문은 무엇인가?','주장을 뒷받침하는 신뢰할 만한 자료 2개 이상은 무엇인가?','반대 관점이나 한계는 무엇이며 어떻게 답할 것인가?']
        photo='사진 계획: 핵심 개념 도해·자료 1장, 관련 현장 또는 사례 1장, 비교·결론 시각자료 1장 이상.'
        draft='초안 가이드: 질문 → 근거 1·2 → 반대 관점 → 해석 → 결론. 사실과 의견을 문단에서 구분.'
    else:
        qs=['독자가 이 글을 읽고 새롭게 알게 될 사실은 무엇인가?','확인이 필요한 출처와 당사자는 누구인가?','사진 한 장으로 이 글을 설명한다면 무엇을 찍을 것인가?']
        photo='사진 계획: 대표 장면 1장과 내용을 설명하는 보조 사진 2장 이상.'
        draft='초안 가이드: 핵심 장면 → 확인된 사실 → 사람의 목소리 → 의미 순서로 정리.'
    return qs,photo,draft

tok=token()
base=f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/articles'
page=call('GET',base+'?pageSize=200',tok)
targets=[]
for d in page.get('documents',[]):
    aid=d['name'].split('/')[-1]
    if aid in MAPPED: continue
    f=d.get('fields',{})
    title=sval(f,'title'); cat=sval(f,'category'); kind=sval(f,'planKind')
    oldq=arr(f,'reportingQuestions'); notes=arr(f,'notes')
    qs,photo,draft=guide(title,cat,kind)
    if oldq: qs=oldq
    for x in (photo,draft):
        if x not in notes: notes.append(x)
    notes=notes[-16:]
    targets.append((d,qs,notes))
print('targets=',len(targets))
for d,qs,notes in targets: print(d['name'].split('/')[-1],'|',sval(d['fields'],'title'),'| q=',len(qs),'notes=',len(notes))
rt=ROOT/'.runtime'; rt.mkdir(exist_ok=True)
backup=rt/('pre-guide-enrich-'+datetime.now().strftime('%Y%m%d-%H%M%S')+'.json')
backup.write_text(json.dumps([d for d,_,_ in targets],ensure_ascii=False,indent=2),encoding='utf-8')
print('backup=',backup)
for d,qs,notes in targets:
    q=urllib.parse.urlencode([('updateMask.fieldPaths','reportingQuestions'),('updateMask.fieldPaths','notes'),('currentDocument.updateTime',d['updateTime'])])
    body={'fields':{'reportingQuestions':fsarr(qs),'notes':fsarr(notes)}}
    call('PATCH','https://firestore.googleapis.com/v1/'+d['name']+'?'+q,tok,body)
print('ENRICHED=',len(targets))
