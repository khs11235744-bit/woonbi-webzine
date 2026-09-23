#!/usr/bin/env python3
"""Import a local .woongbi archive into the isolated Woonbi Firebase project.

Safety properties:
- existing Firestore article documents are never overwritten;
- reporter email/student-number fields are never uploaded;
- imported articles start as private draft with no publication consent;
- source photos are sanitized locally; BMP becomes lossless PNG, JPEG/PNG are re-encoded;
- unassigned legacy images are quarantined under a client-inaccessible Storage prefix.
"""
from __future__ import annotations
import argparse, base64, html, io, json, os, re, subprocess, sys, tempfile, urllib.error, urllib.parse, urllib.request, zipfile
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

PROJECT_DEFAULT="woonbi-webzine-2026"
BUCKET_DEFAULT="woonbi-webzine-2026.firebasestorage.app"
ALLOWED_PROJECT=re.compile(r"^woonbi-[a-z0-9-]{3,35}$")
CATEGORY_MAP={
    "학교 이야기":"학교 이야기","동아리":"학교 이야기",
    "교내 행사 & 특집":"특집","동아리 & 학교 이야기":"학교 이야기",
    "학생 참여":"학생 글","인터뷰 & 스토리":"학교 사람들",
    "역사 & 칼럼":"학생 글",
    "특집기사":"특집","기행과 교류":"특집",
    "사람들":"학교 사람들","사람과 공동체":"학교 사람들",
    "현장과 학교":"학교 이야기","지역과 기억":"특집","질문과 쟁점":"학생 글",
    "기자들의 시선":"학생 글","진로와 탐구":"학생 글",
    "화보":"사진과 기록","인사말":"편집실","미분류":"편집실",
}
class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.out=[]; self.skip=0
    def handle_starttag(self, tag, attrs):
        tag=tag.lower()
        if tag in ("script","style"): self.skip+=1; return
        if self.skip: return
        if tag in ("h1","h2","h3"): self.out.append("\n\n## ")
        elif tag in ("p","div","section","article","blockquote"): self.out.append("\n\n")
        elif tag=="br": self.out.append("\n")
        elif tag=="li": self.out.append("\n• ")
    def handle_endtag(self, tag):
        tag=tag.lower()
        if tag in ("script","style") and self.skip: self.skip-=1; return
        if self.skip: return
        if tag in ("p","div","section","article","blockquote","li","h1","h2","h3"): self.out.append("\n")
    def handle_data(self, data):
        if not self.skip: self.out.append(data)
def plain_html(s):
    p=TextExtractor()
    try: p.feed(str(s or ""))
    except Exception: return re.sub(r"<[^>]+>"," ",str(s or ""))
    t=html.unescape("".join(p.out)).replace("\r","")
    t=re.sub(r"[ \t]+"," ",t)
    t=re.sub(r" *\n *","\n",t)
    t=re.sub(r"\n{3,}","\n\n",t).strip()
    return t
def clip(s,n): return str(s or "")[:n]
def run(args, *, capture=False):
    exe=args[0]
    if os.name=="nt" and exe=="gcloud": args[0]="gcloud.cmd"
    return subprocess.run(args,check=True,text=True,capture_output=capture,encoding="utf-8",errors="replace")
def access_token():
    return run(["gcloud","auth","print-access-token"],capture=True).stdout.strip()
def request_json(method,url,token,body=None):
    data=None if body is None else json.dumps(body,ensure_ascii=False).encode("utf-8")
    req=urllib.request.Request(url,data=data,method=method,headers={"Authorization":"Bearer "+token,"Content-Type":"application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req,timeout=40) as r:
            raw=r.read()
            return json.loads(raw.decode("utf-8")) if raw else {}
    except urllib.error.HTTPError as e:
        raw=e.read().decode("utf-8","replace")
        raise RuntimeError(f"HTTP {e.code} {url}: {raw[:900]}")
def fsv(v):
    if v is None: return {"nullValue":None}
    if isinstance(v,bool): return {"booleanValue":v}
    if isinstance(v,int): return {"integerValue":str(v)}
    if isinstance(v,float): return {"doubleValue":v}
    if isinstance(v,str): return {"stringValue":v}
    if isinstance(v,list): return {"arrayValue":{"values":[fsv(x) for x in v]}}
    if isinstance(v,dict): return {"mapValue":{"fields":{k:fsv(x) for k,x in v.items()}}}
    raise TypeError(type(v))
def fields(d): return {k:fsv(v) for k,v in d.items()}
def doc_id(name): return str(name).rsplit("/",1)[-1]
def firestore_base(project):
    return f"https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents"
def list_docs(project,collection,token):
    u=firestore_base(project)+"/"+collection+"?pageSize=500"
    j=request_json("GET",u,token)
    return j.get("documents",[]) or []
def decode_scalar(v):
    if not isinstance(v,dict): return None
    for k in ("stringValue","booleanValue","integerValue","doubleValue","timestampValue"):
        if k in v: return v[k]
    return None
def teacher_uid(project,token):
    teachers=[]
    for d in list_docs(project,"members",token):
        fs=d.get("fields",{})
        if decode_scalar(fs.get("role"))=="teacher" and decode_scalar(fs.get("active")) is True:
            teachers.append(doc_id(d["name"]))
    if len(teachers)!=1:
        raise RuntimeError(f"Expected exactly one active teacher, found {len(teachers)}")
    return teachers[0]
def category(a):
    return CATEGORY_MAP.get(str(a.get("section") or ""),"편집실")
def plan_kind(a):
    if "개인 탐구" in str(a.get("type") or "") or "기자들의 시선"==str(a.get("section") or ""): return "research"
    if str(a.get("section") or "")=="미분류": return "recovered"
    return "school"
def source_range(a):
    s=a.get("startPage"); e=a.get("endPage")
    if isinstance(s,int) and isinstance(e,int): return f"원본 {s}-{e}쪽"
    if isinstance(s,int): return f"원본 {s}쪽"
    return "웅비 스튜디오 원본"
def article_record(a,teacher,order,photos,now):
    source_title=clip(a.get("title") or "제목 미정",150)
    shown=clip(a.get("displayHeadline") or source_title,150)
    subtitle=clip(a.get("subtitle") or "",350)
    body=plain_html(a.get("content") or "")
    truncated=len(body)>45000
    body=body[:45000]
    names=[clip(x,60) for x in (a.get("authorNames") or []) if str(x).strip()][:8]
    byline=clip(" · ".join(names) if names else "웅비 편집실",80)
    notes=[
        "웅비 스튜디오 .woongbi 원본에서 복원",
        "원본 상태: "+clip(a.get("status") or "미상",50),
        "원본 섹션: "+clip(a.get("section") or "미분류",50),
    ]
    if truncated: notes.append("본문 45,000자 제한에 맞춰 복원본 일부를 잘라냄")
    return {
        "id":clip(a.get("id") or f"legacy-{order}",120),
        "title":shown,"sourceTitle":source_title,"deck":subtitle,"body":body,"byline":byline,
        "category":category(a),"categorySource":clip(f"{a.get('section') or ''} / {a.get('type') or ''}",350),
        "planKind":plan_kind(a),"planOrder":order,"sourceRange":clip(source_range(a),120),
        "assigneeIds":[teacher],"assigneeNames":names,"dueDate":"",
        "minPhotos":max(0,min(12,int(a.get("minimumPhotos") or 0))),"photos":photos,
        "status":"draft","feedback":"","revision":0,"updatedBy":teacher,
        "createdAt":clip(a.get("updatedAt") or now,80),"updatedAt":clip(a.get("updatedAt") or now,80),
        "webConsent":False,"printConsent":False,"contentOrigin":"woongbi-studio-import",
        "reportingQuestions":[],"notes":notes,
    }
def sanitize_asset(z,entry,asset,work):
    from PIL import Image, ImageOps, UnidentifiedImageError
    raw=z.read(entry)
    mime=str(asset.get("mimeType") or "").lower()
    name=str(asset.get("fileName") or "").lower()
    if mime=="image/svg+xml" or name.endswith(".svg") or raw.lstrip().startswith(b"<svg") or raw.lstrip().startswith(b"<?xml"):
        return None
    try:
        im=Image.open(io.BytesIO(raw))
    except UnidentifiedImageError:
        return None
    im=ImageOps.exif_transpose(im)
    w,h=im.size
    if mime=="image/jpeg" or str(asset.get("fileName") or "").lower().endswith((".jpg",".jpeg")):
        original_type="image/jpeg"; orig=work/"original.jpg"
        if im.mode not in ("RGB","L"): im=im.convert("RGB")
        im.save(orig,"JPEG",quality=95,optimize=True,exif=b"")
    else:
        original_type="image/png"; orig=work/"original.png"
        if im.mode=="P": im=im.convert("RGBA")
        im.save(orig,"PNG",optimize=True)
    web=work/"web.webp"
    wi=im.copy()
    wi.thumbnail((1600,1600),Image.Resampling.LANCZOS)
    if wi.mode not in ("RGB","RGBA"): wi=wi.convert("RGB")
    wi.save(web,"WEBP",quality=82,method=6,exif=b"")
    return orig,web,original_type,w,h
def find_asset_entry(z,asset_id):
    prefix="assets/files/"+asset_id+"-"
    for i in z.infolist():
        if i.filename.startswith(prefix): return i.filename
    raise KeyError(asset_id)
def upload(path,dest,ctype,cache="private,no-store"):
    run(["gcloud","storage","cp",str(path),dest,"--content-type="+ctype,"--cache-control="+cache])
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--source",required=True)
    ap.add_argument("--project",default=PROJECT_DEFAULT)
    ap.add_argument("--bucket",default=BUCKET_DEFAULT)
    ap.add_argument("--confirm",default="")
    ap.add_argument("--dry-run",action="store_true")
    args=ap.parse_args()
    if not ALLOWED_PROJECT.fullmatch(args.project) or "indie" in args.project:
        raise SystemExit("Refusing non-Woonbi Firebase project")
    source=Path(args.source)
    if not source.is_file() or not zipfile.is_zipfile(source): raise SystemExit("Invalid .woongbi archive")
    live=(args.confirm=="IMPORT-WOONBI" and not args.dry_run)
    token=access_token(); teacher=teacher_uid(args.project,token)
    existing={doc_id(d["name"]) for d in list_docs(args.project,"articles",token)}
    now=datetime.now(timezone.utc).isoformat().replace("+00:00","Z")
    with zipfile.ZipFile(source) as z:
        project=json.loads(z.read("project.json"))
        assets=project.get("assets",[]) or []
        by_article={}
        quarantined=[]
        with tempfile.TemporaryDirectory(prefix="woonbi-import-") as td:
            td=Path(td)
            for asset in assets:
                aid=str(asset.get("id") or "")
                if not re.fullmatch(r"[A-Za-z0-9-]{1,80}",aid): continue
                entry=find_asset_entry(z,aid)
                adir=td/aid; adir.mkdir()
                sanitized=sanitize_asset(z,entry,asset,adir)
                if sanitized is None:
                    quarantined.append(aid)
                    continue
                orig,web,otype,w,h=sanitized
                article_id=str(asset.get("articleId") or "").strip()
                if article_id:
                    op=f"private/{article_id}/{aid}/original"; wp=f"private/{article_id}/{aid}/web.webp"
                    photo={"id":aid,"caption":clip(asset.get("caption") or asset.get("fileName") or "복원 사진",300),
                           "alt":clip((asset.get("caption") or "원본 교지에서 복원한 사진"),200),"after":-1,
                           "width":w,"height":h,"originalBytes":orig.stat().st_size,"originalType":otype,
                           "originalPath":op,"webPath":wp,"placeholder":False}
                    by_article.setdefault(article_id,[]).append(photo)
                    if live:
                        upload(orig,f"gs://{args.bucket}/{op}",otype)
                        upload(web,f"gs://{args.bucket}/{wp}","image/webp")
                else:
                    qp=f"legacy-private/unassigned/{aid}/original"; qw=f"legacy-private/unassigned/{aid}/preview.webp"
                    quarantined.append(aid)
                    if live:
                        upload(orig,f"gs://{args.bucket}/{qp}",otype)
                        upload(web,f"gs://{args.bucket}/{qw}","image/webp")
            new=[]
            for n,a in enumerate(project.get("articles",[]) or [],1):
                aid=str(a.get("id") or f"legacy-{n}")
                if aid in existing: continue
                rec=article_record(a,teacher,n,by_article.get(aid,[])[:12],now)
                new.append(rec)
            print(f"source_articles={len(project.get('articles',[]) or [])} new_articles={len(new)} existing_skipped={len(existing)}")
            print(f"linked_photos={sum(len(v) for v in by_article.values())} quarantined_assets={len(quarantined)}")
            if not live:
                print("DRY_RUN: pass --confirm IMPORT-WOONBI to write")
                return
            base=firestore_base(args.project)
            resource_base=f"projects/{args.project}/databases/(default)/documents"
            batch=[]
            for rec in new:
                name=resource_base+"/articles/"+urllib.parse.quote(rec["id"],safe="")
                snapshot={**rec,"serverWrittenAt":now}
                revname=name+"/revisions/0"
                batch.extend([
                    {"update":{"name":name,"fields":{**fields(rec),"serverWrittenAt":{"timestampValue":now}}},"currentDocument":{"exists":False}},
                    {"update":{"name":revname,"fields":{"snapshot":fsv(snapshot),"actor":{"stringValue":teacher},"at":{"timestampValue":now}}},"currentDocument":{"exists":False}},
                ])
            for i in range(0,len(batch),80):
                resp=request_json("POST",base+":batchWrite",token,{"writes":batch[i:i+80]})
                statuses=resp.get("status",[]) or []
                bad=[x for x in statuses if x and x.get("code",0)]
                if bad: raise RuntimeError("Firestore batchWrite failure: "+json.dumps(bad,ensure_ascii=False))
            print(f"IMPORTED articles={len(new)}")
if __name__=="__main__":
    main()


