#!/usr/bin/env python3
from __future__ import annotations
import argparse, json, subprocess, urllib.parse, urllib.request, urllib.error
from datetime import datetime
from pathlib import Path

PROJECT='woonbi-webzine-2026'
ROOT=Path(__file__).resolve().parents[1]
BASE=f'https://firestore.googleapis.com/v1/projects/{PROJECT}/databases/(default)/documents/articles'
NUMERIC_FIELDS=('minPhotos','planOrder')
PHOTO_NUMERIC=('after','width','height','originalBytes')

def token():
    exe='gcloud.cmd' if __import__('os').name=='nt' else 'gcloud'
    return subprocess.run([exe,'auth','print-access-token'],check=True,capture_output=True,text=True,encoding='utf-8').stdout.strip()

def call(method,url,tok,body=None):
    data=None if body is None else json.dumps(body,ensure_ascii=False).encode('utf-8')
    r=urllib.request.Request(url,data=data,method=method,headers={'Authorization':'Bearer '+tok,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(r,timeout=45) as x:
            raw=x.read()
            return json.loads(raw.decode('utf-8')) if raw else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'HTTP {e.code}: '+e.read().decode('utf-8','replace')[:1600])

def as_int_field(v):
    if not isinstance(v,dict): return v,False
    if 'integerValue' in v: return v,False
    if 'stringValue' in v:
        s=v['stringValue'].strip()
        if s and (s.isdigit() or (s.startswith('-') and s[1:].isdigit())):
            return {'integerValue':str(int(s))},True
    return v,False

ap=argparse.ArgumentParser()
ap.add_argument('--confirm',default='')
args=ap.parse_args()
live=args.confirm=='NORMALIZE-LIVE-TYPES'
tok=token()
page=call('GET',BASE+'?pageSize=200',tok)
docs=page.get('documents',[])
changes=[]
backup=[]
for d in docs:
    f=d.get('fields',{})
    update={}
    notes=[]
    for name in NUMERIC_FIELDS:
        if name in f:
            nv,changed=as_int_field(f[name])
            if changed:
                update[name]=nv
                notes.append(name)
    if f.get('photos',{}).get('arrayValue',{}).get('values'):
        photos=json.loads(json.dumps(f['photos']))
        photo_changed=False
        for i,item in enumerate(photos['arrayValue'].get('values',[])):
            pf=item.get('mapValue',{}).get('fields',{})
            for name in PHOTO_NUMERIC:
                if name in pf:
                    nv,changed=as_int_field(pf[name])
                    if changed:
                        pf[name]=nv
                        photo_changed=True
                        notes.append(f'photos[{i}].{name}')
        if photo_changed:update['photos']=photos
    if update:
        aid=d['name'].split('/')[-1]
        changes.append((aid,d['name'],d.get('updateTime'),update,notes))
        backup.append(d)

print('docs=',len(docs),'normalize=',len(changes))
for aid,_,_,_,notes in changes:
    print(aid,'|',', '.join(notes))
if not live:
    print('DRY_RUN: use --confirm NORMALIZE-LIVE-TYPES')
    raise SystemExit(0)

rt=ROOT/'.runtime'
rt.mkdir(exist_ok=True)
stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
backup_path=rt/f'pre-type-normalize-{stamp}.json'
backup_path.write_text(json.dumps(backup,ensure_ascii=False,indent=2),encoding='utf-8')
print('backup=',backup_path)

for aid,name,update_time,update,notes in changes:
    q=[]
    for field in update:
        q.append(('updateMask.fieldPaths',field))
    if update_time:
        q.append(('currentDocument.updateTime',update_time))
    url='https://firestore.googleapis.com/v1/'+name+'?'+urllib.parse.urlencode(q)
    call('PATCH',url,tok,{'fields':update})
print('NORMALIZED=',len(changes))
