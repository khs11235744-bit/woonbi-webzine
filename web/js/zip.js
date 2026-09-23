/* Minimal UTF-8 ZIP (STORE method), no dependency, for the teacher's print handoff. */
(function(){'use strict';
const enc=new TextEncoder(),table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;table[n]=c;}
function crc32(a){let c=0xffffffff;for(const b of a)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function buf(n){return new Uint8Array(n);}function w16(a,o,n){new DataView(a.buffer).setUint16(o,n,true);}function w32(a,o,n){new DataView(a.buffer).setUint32(o,n,true);}
async function makeZip(files){let offset=0,size=0;const chunks=[],central=[];for(const file of files){const name=enc.encode(file.name.replace(/[^\w가-힣./ -]/g,'_')),data=file.data instanceof Blob?new Uint8Array(await file.data.arrayBuffer()):enc.encode(String(file.data));const crc=crc32(data),head=buf(30+name.length);w32(head,0,0x04034b50);w16(head,4,20);w16(head,6,0x800);w32(head,14,crc);w32(head,18,data.length);w32(head,22,data.length);w16(head,26,name.length);head.set(name,30);chunks.push(head,data);
 const cd=buf(46+name.length);w32(cd,0,0x02014b50);w16(cd,4,20);w16(cd,6,20);w16(cd,8,0x800);w32(cd,16,crc);w32(cd,20,data.length);w32(cd,24,data.length);w16(cd,28,name.length);w32(cd,42,offset);cd.set(name,46);central.push(cd);offset+=head.length+data.length;size+=cd.length;}
 const end=buf(22);w32(end,0,0x06054b50);w16(end,8,files.length);w16(end,10,files.length);w32(end,12,size);w32(end,16,offset);return new Blob([...chunks,...central,end],{type:'application/zip'});}
window.Woonbi.makeZip=makeZip;
})();
