#!/usr/bin/env python3
from pathlib import Path
import json, zipfile, html, re

ROOT=Path(__file__).resolve().parents[1]
SOURCE=Path.home()/'Documents'/'2026-Woongbi-Demo-Edition.woongbi'
ASSET_INDEX=ROOT/'web'/'assets'/'legacy-plan'/'index.json'
OUT=ROOT/'web'/'js'/'legacy-reference-data.js'

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

with zipfile.ZipFile(SOURCE) as z:
    p=json.loads(z.read('project.json'))
assets=json.loads(ASSET_INDEX.read_text(encoding='utf-8'))
by_slot={}
for item in assets['items']:
    by_slot.setdefault(item['slot'],[]).append(item)

rows=[]
for i,a in enumerate(p.get('articles',[]),1):
    slot=f'A{i:02d}'
    photos=[]
    for n,item in enumerate(by_slot.get(slot,[]),1):
        path='assets/legacy-plan/'+item['file']
        photos.append({
            'id':f'legacy-{slot.lower()}-{n}',
            'sourceAsset':path,
            'webPath':f'seed/legacy/{slot.lower()}/{n}',
            'originalPath':f'seed/legacy/{slot.lower()}/{n}',
            'placeholder':True,
            'caption':item.get('label','교체용 예시')+' · 실제 현장 사진으로 교체 필요',
            'alt':'교체용 예시 이미지',
            'after':-1,
            'width':1200,'height':800,'originalBytes':800,'originalType':'image/svg+xml'
        })
    rows.append({
        'id':f'legacy-{slot}',
        'title':str(a.get('title') or '제목 미정')[:150],
        'headline':str(a.get('displayHeadline') or a.get('title') or '제목 미정')[:150],
        'deck':str(a.get('subtitle') or '')[:350],
        'body':clean_html(a.get('content'))[:45000],
        'byline':'웅비 편집실',
        'category':CATEGORY.get(str(a.get('section') or ''),'학교 이야기'),
        'planKind':'research' if str(a.get('section') or '') in ['학생 참여','역사 & 칼럼'] else 'school',
        'planOrder':100+i,
        'photos':photos,
        'sample':True,
        'draftOnly':True,
        'archiveLabel':'2026 Demo Edition · 복원 편집본',
        'contentOrigin':'legacy-demo-reference',
        'year':2026,
        'notes':['2026-Woongbi-Demo-Edition.woongbi에서 공개용으로 복원','개인 식별정보와 비공개 식별자는 제외']
    })

js="/* Public, PII-stripped Woonbi Demo Edition references. */\n(function(){'use strict';\nconst W=window.Woonbi=window.Woonbi||{},base=W.newsroomData||{};\nconst rows="+json.dumps(rows,ensure_ascii=False,separators=(',',':'))+";\nW.newsroomData={...base,examples:[...(base.examples||[]),...rows]};\n})();\n"
OUT.write_text(js,encoding='utf-8')
print('wrote',OUT,'articles',len(rows),'photos',sum(len(x['photos']) for x in rows))
