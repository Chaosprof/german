'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto');
const {buildReferencePavingHeightV144}=require('./berlin_paving_relief_v144.js');
const out=path.resolve(__dirname,'../audit/berlin-parity-v144/generated');fs.mkdirSync(out,{recursive:true});
const h=buildReferencePavingHeightV144();
function crc32(b){let c=0xffffffff;for(const v of b){c^=v;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function png(w,h,data){
  function chunk(name,b){const type=Buffer.from(name),body=Buffer.concat([type,b]),out=Buffer.alloc(body.length+8);out.writeUInt32BE(b.length);body.copy(out,4);out.writeUInt32BE(crc32(body),body.length+4);return out;}
  const hdr=Buffer.alloc(13);hdr.writeUInt32BE(w,0);hdr.writeUInt32BE(h,4);hdr[8]=8;hdr[9]=6;
  const rows=Buffer.alloc(h*(w*4+1));for(let y=0;y<h;y++)Buffer.from(data.buffer,y*w*4,w*4).copy(rows,y*(w*4+1)+1);
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',hdr),chunk('IDAT',zlib.deflateSync(rows,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}
const normals=new Uint8ClampedArray(h.w*h.h*4),strength=h.depth*h.w/(2*h.worldWidth);
for(let y=0;y<h.h;y++)for(let x=0;x<h.w;x++){
  const dx=(h.L[y*h.w+Math.min(h.w-1,x+1)]-h.L[y*h.w+Math.max(0,x-1)])*strength;
  const dy=(h.L[Math.min(h.h-1,y+1)*h.w+x]-h.L[Math.max(0,y-1)*h.w+x])*strength;
  const len=Math.hypot(dx,dy,1),p=(y*h.w+x)*4;
  normals[p]=(-dx/len*.5+.5)*255;normals[p+1]=(dy/len*.5+.5)*255;normals[p+2]=(1/len*.5+.5)*255;normals[p+3]=255;
}
const mask=new Uint8ClampedArray(h.sourceSize*h.sourceSize*4);
for(let i=0;i<h.source.length;i++)mask[i*4+3]=(1-h.source[i])*.09*255;
const assets={'berlin-paving-joint-normal-v144.png':png(h.w,h.h,normals),'berlin-paving-joint-shade-v144.png':png(h.sourceSize,h.sourceSize,mask)};
const hashes={};for(const [name,data]of Object.entries(assets)){fs.writeFileSync(path.join(out,name),data);hashes[name]={bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex')};}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({depthMetres:h.depth,periodMetres:[h.worldWidth,h.worldLength],normalSize:[h.w,h.h],shadeSize:[h.sourceSize,h.sourceSize],assets:hashes},null,2));console.log(JSON.stringify(hashes));
