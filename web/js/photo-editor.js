(()=>{'use strict';
const W=window.WoonbiPhotoEditor=window.WoonbiPhotoEditor||{};
W.health=function(photos=[]){
 const missingCaption=photos.filter(p=>!String(p.caption||'').trim()).length;
 const missingAlt=photos.filter(p=>!String(p.alt||'').trim()).length;
 const lowRes=photos.filter(p=>Number(p.width||0)&&Number(p.width||0)<1600).length;
 return {missingCaption,missingAlt,lowRes,ok:photos.length>0&&!missingAlt&&!lowRes};
};
W.quality=function(p={}){
 const width=Number(p.width||0);
 if(width>=2400)return {label:'인쇄용 충분',level:'ok'};
 if(width>=1600)return {label:'웹 충분 · 인쇄 확인',level:'check'};
 if(width>0)return {label:'저해상도 · 교체 권장',level:'warn'};
 return {label:'해상도 미확인',level:'check'};
};
W.scoreMetrics=function(m={}){
 const clamp=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
 const sharp=clamp(m.sharpness),exposure=clamp(m.exposure),composition=clamp(m.composition),resolution=clamp(m.resolution);
 const overall=clamp(sharp*.35+exposure*.25+composition*.25+resolution*.15);
 return {overall,sharpness:sharp,exposure,composition,resolution};
};
W.analyzeImageData=function(data,width,height,originalWidth=width,originalHeight=height){
 if(!data||!width||!height)return W.scoreMetrics({});
 const gray=new Float32Array(width*height);let sum=0,dark=0,bright=0;
 for(let i=0,p=0;i<data.length;i+=4,p++){const g=data[i]*.299+data[i+1]*.587+data[i+2]*.114;gray[p]=g;sum+=g;if(g<16)dark++;if(g>239)bright++;}
 const mean=sum/gray.length/255,clip=(dark+bright)/gray.length;
 let lapSum=0,lapSq=0,lapN=0,weight=0,cx=0,cy=0;
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
  const i=y*width+x,v=gray[i],lap=4*v-gray[i-1]-gray[i+1]-gray[i-width]-gray[i+width];
  lapSum+=lap;lapSq+=lap*lap;lapN++;
  const gx=gray[i+1]-gray[i-1],gy=gray[i+width]-gray[i-width],w=Math.sqrt(gx*gx+gy*gy);
  if(w>8){weight+=w;cx+=x*w;cy+=y*w;}
 }
 const variance=lapN?Math.max(0,lapSq/lapN-(lapSum/lapN)**2):0;
 const sharpness=Math.min(100,Math.sqrt(variance)*5.4);
 const exposure=Math.max(0,100-Math.abs(mean-.52)*155-clip*180);
 let composition=55;
 if(weight>0){
  const nx=(cx/weight)/Math.max(1,width-1),ny=(cy/weight)/Math.max(1,height-1),pts=[[1/3,1/3],[2/3,1/3],[1/3,2/3],[2/3,2/3]];
  const dist=Math.min(...pts.map(([x,y])=>Math.hypot(nx-x,ny-y)));
  composition=Math.max(0,100-dist/0.48*100);
 }
 const mp=(Number(originalWidth||0)*Number(originalHeight||0))/1000000,resolution=Math.min(100,mp/8*100);
 return W.scoreMetrics({sharpness,exposure,composition,resolution});
};
W.analyzeFile=async function(file){
 if(typeof createImageBitmap!=='function'||typeof document==='undefined')return W.scoreMetrics({});
 const bmp=await createImageBitmap(file),max=128,scale=Math.min(1,max/Math.max(bmp.width,bmp.height)),w=Math.max(16,Math.round(bmp.width*scale)),h=Math.max(16,Math.round(bmp.height*scale)),c=document.createElement('canvas');c.width=w;c.height=h;
 const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(bmp,0,0,w,h);const ow=bmp.width,oh=bmp.height;bmp.close();
 return W.analyzeImageData(ctx.getImageData(0,0,w,h).data,w,h,ow,oh);
};
W.bestLeadId=function(article={}){
 const photos=article.photos||[];if(!photos.length)return '';
 const scored=window.WoonbiMagazine?.coverScore?.(article)?.photo;
 if(scored?.id)return scored.id;
 return [...photos].sort((a,b)=>(Number(b.width||0)*Number(b.height||0))-(Number(a.width||0)*Number(a.height||0)))[0]?.id||'';
};
W.role=function(index){return index===0?'대표사진':'본문 '+index;};
})();
