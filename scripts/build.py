"""Build self-contained PRIVATE preview or a source-only live shell. No automatic deployment."""
from pathlib import Path
import argparse,json,re,shutil,base64,mimetypes

root=Path(__file__).resolve().parents[1]
web=root/'web'
p=argparse.ArgumentParser()
p.add_argument('--live-config')
args=p.parse_args()

# These may contain school-specific/private editorial material and never ship in live output.
private_scripts={'js/plan2026.js','js/newsroom-data.js','js/archive-data.js','js/sample-media.js'}
private_preview_scripts=('js/plan2026.js','js/newsroom-data.js','js/archive-data.js','js/sample-media.js')

if args.live_config:
 cfg=json.loads(Path(args.live_config).read_text(encoding='utf-8-sig'))
 assert cfg.get('mode')=='firebase'
 fb=cfg.get('firebase',{})
 pid=fb.get('projectId','')
 assert re.fullmatch(r'woonbi-[a-z0-9-]{3,35}',pid) and 'indie' not in pid
 assert all(fb.get(k) for k in ['apiKey','authDomain','appId'])

 dest=root/'dist-live'
 dest.mkdir(exist_ok=True)
 for path in list(dest.rglob('*'))[::-1]:
  if path.is_file():
   path.unlink()

 # Safe source files and the fictional sample asset are public.
 # Private originals/media/archive material remain excluded.
 for src in web.rglob('*'):
  rel=src.relative_to(web).as_posix()
  if not src.is_file() or rel in private_scripts:
   continue
  if rel.startswith(('assets/media/','assets/archive/','archive/')):
   continue
  out=dest/rel
  out.parent.mkdir(parents=True,exist_ok=True)
  shutil.copy2(src,out)

 text=(dest/'index.html').read_text(encoding='utf-8')
 for src in private_scripts:
  text=text.replace(f'<script src="{src}"></script>','')
 # Keep only the PII-free fictional examples in the public live shell.
 if '<script src="js/sample-data.js"></script>' not in text:
  text=text.replace(
   '<script src="js/demo-store.js"></script>',
   '<script src="js/sample-data.js"></script><script src="js/demo-store.js"></script>'
  )
 (dest/'index.html').write_text(text,encoding='utf-8')
 (dest/'config.js').write_text(
  'window.WOONBI_CONFIG='+json.dumps(cfg,ensure_ascii=False)+';',
  encoding='utf-8'
 )
 print('LIVE SHELL built; safe sample metadata included, no private articles/original photos:',dest)
else:
 html=(web/'index.html').read_text(encoding='utf-8')
 missing=[src for src in private_preview_scripts if not (web/src).is_file()]
 sample_fallback=bool(missing)
 if sample_fallback:
  sample='js/sample-data.js'
  if not (web/sample).is_file():
   raise SystemExit('Private preview data is absent and the safe sample fallback is missing.')
  first=private_preview_scripts[0]
  html=html.replace(f'<script src="{first}"></script>',f'<script src="{sample}"></script>')
  for src in private_preview_scripts[1:]:
   html=html.replace(f'<script src="{src}"></script>','')

 html=re.sub(
  r'<link rel="stylesheet" href="([^"]+)">',
  lambda m:'<style>'+(web/m.group(1)).read_text(encoding='utf-8')+'</style>',
  html
 )

 assets={}
 asset_root=web/'assets'
 if asset_root.exists():
  for src in asset_root.rglob('*'):
   if src.is_file():
    assets[src.relative_to(web).as_posix()]='data:'+(mimetypes.guess_type(str(src))[0] or 'application/octet-stream')+';base64,'+base64.b64encode(src.read_bytes()).decode()

 embedded='<script>window.Woonbi=window.Woonbi||{};window.Woonbi.STANDALONE=true;window.Woonbi.embeddedAssets='+json.dumps(assets,separators=(',',':'))+';</script>'

 def inline(m):
  src=web/m.group(1)
  if not src.is_file():
   raise FileNotFoundError(src)
  return '<script>'+src.read_text(encoding='utf-8').replace('</script','<\\/script')+'</script>'

 html=re.sub(r'<script src="([^"]+)"></script>',inline,html)
 html=html.replace('<body',embedded+'<body',1)
 out=root/'웅비_뉴스룸_원고포함.html'
 out.write_text(html,encoding='utf-8')
 mode='safe-sample-fallback' if sample_fallback else 'private-data'
 print('PRIVATE preview',out,out.stat().st_size,'bytes',len(assets),'assets',mode)
