"""Materialize a checksummed, PII-free UTF-8 source manifest, once only."""
from pathlib import Path
import os,base64,hashlib,json,lzma
root=Path(__file__).resolve().parents[1]
if os.environ.get('GITHUB_REF_NAME') != 'woonbi-webzine-v0.4':
    raise SystemExit('Ref guard: this bootstrap only operates on the dedicated Woonbi branch.')
if (root/'web/index.html').exists():
    print('Source already expanded; no existing edits are overwritten.')
    raise SystemExit(0)
parts=sorted((root/'bootstrap').glob('payload-*.txt'))
if len(parts)!=5:
    raise SystemExit('Expected exactly five reviewed payload chunks.')
raw=base64.b64decode(''.join(p.read_text().strip() for p in parts),validate=True)
expected='cb66c63215d6e77429cf2eae1b2c97a0b1339c9d649fd04a5ec2c2bc535519ea'
if hashlib.sha256(raw).hexdigest()!=expected:
    raise SystemExit('Source payload checksum mismatch.')
d=lzma.LZMADecompressor();text=d.decompress(raw,max_length=1000000)
if not d.eof: raise SystemExit('Oversized or incomplete manifest.')
files=json.loads(text)
if len(files)!=30: raise SystemExit('Unexpected source file count.')
allowed={'web','firebase','scripts','tests','docs','examples'}
rootfiles={'README.md','CHANGELOG.md','.gitignore','package.json','firebase.json'}
for name,content in files.items():
    p=Path(name)
    if p.is_absolute() or '..' in p.parts or not isinstance(content,str):
        raise SystemExit('Invalid source entry.')
    if len(p.parts)==1:
        if name not in rootfiles: raise SystemExit('Unexpected root file.')
    elif p.parts[0] not in allowed:
        raise SystemExit('Unexpected source directory.')
    if name.startswith(('private-data/','web/archive/','web/assets/archive/','web/assets/media/')):
        raise SystemExit('Private material is forbidden.')
for name,content in files.items():
    dest=root/name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(content,encoding='utf-8')
(root/'bootstrap/EXPANDED.txt').write_text(expected+'\n')
print('Expanded',len(files),'source files; no deployment was performed.')
