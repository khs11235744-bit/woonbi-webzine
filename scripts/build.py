"""Build self-contained PRIVATE preview or a source-only live shell. No automatic deployment."""
from pathlib import Path
import argparse,json,re,shutil,base64,mimetypes
root=Path(__file__).resolve().parents[1];web=root/'web'
p=argparse.ArgumentParser();p.add_argument('--live-config');args=p.parse_args()
private_scripts={'js/plan2026.js','js/newsroom-data.js','js/archive-data.js','js/sample-media.js','js/sample-data.js'}
if args.live_config:
 cfg=json.loads(Path(args.live_config).read_text(encoding='utf-8-sig'));assert cfg.get('mode')=='firebase'
 fb=cfg.get('firebase',{});pid=fb.get('projectId','');assert re.fullmatch(r'woonbi-[a-z0-9-]{3,35}',pid) and 'indie' not in pid
 assert all(fb.get(k) for k in ['apiKey','authDomain','appId'])
 dest=root/'dist-live';dest.mkdir(exist_ok=True)
 # Only known source files; never copy student previews, archive scans or originals to public output.
 for path in list(dest.rglob('*'))[::-1]:
  if path.is_file():path.unlink()
 for src in web.rglob('*'):
  rel=src.relative_to(web).as_posix()
  if not src.is_file() or rel in private_scripts or rel.startswith(('assets/','archive/')):continue
  out=dest/rel;out.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,out)
 text=(dest/'index.html').read_text()
 for src in private_scripts:text=text.replace(f'<script src="{src}"></script>','')
 (dest/'index.html').write_text(text)
 (dest/'config.js').write_text('window.WOONBI_CONFIG='+json.dumps(cfg,ensure_ascii=False)+';')
 print('LIVE SHELL built; no seed articles/photos. OAuth and emulator checks are still required:',dest)
else:
 html=(web/'index.html').read_text();html=re.sub(r'<link rel="stylesheet" href="([^"]+)">',lambda m:'<style>'+(web/m.group(1)).read_text()+'</style>',html)
 assets={}
 for src in (web/'assets').rglob('*'):
  if src.is_file():assets[src.relative_to(web).as_posix()]='data:'+ (mimetypes.guess_type(str(src))[0] or 'application/octet-stream')+';base64,'+base64.b64encode(src.read_bytes()).decode()
 embedded='<script>window.Woonbi=window.Woonbi||{};window.Woonbi.STANDALONE=true;window.Woonbi.embeddedAssets='+json.dumps(assets,separators=(',',':'))+';</script>'
 def inline(m):return '<script>'+(web/m.group(1)).read_text().replace('</script','<\\/script')+'</script>'
 html=re.sub(r'<script src="([^"]+)"></script>',inline,html)
 html=html.replace('<body',embedded+'<body',1)
 out=root/'웅비_뉴스룸_원고포함.html';out.write_text(html)
 print('PRIVATE preview',out,out.stat().st_size,'bytes',len(assets),'assets')
