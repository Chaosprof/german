'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto'),zlib=require('zlib');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v144');
const {buildReferencePavingHeightV144}=require('./berlin_paving_relief_v144.js');
const h=buildReferencePavingHeightV144(),joints=JSON.parse(fs.readFileSync(path.join(stage,'paving-joints.json')));
let seamProbes=0,faceProbes=0,uvProbes=0;
for(let row=0;row<joints.columns.length;row++){
  const ys=joints.rows,xs=joints.columns[row],y=Math.floor((ys[row]+ys[row+1])/2);
  for(let c=1;c<xs.length-1;c++){assert.equal(h.source[y*1024+xs[c]],0);seamProbes++;}
  for(let c=1;c<xs.length-2;c++){
    const x=Math.floor((xs[c]+xs[c+1])/2);assert.equal(h.source[y*1024+x],1);faceProbes++;
    if(row>0){assert.equal(h.source[ys[row]*1024+x],0);seamProbes++;}
  }
}
for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const v=h.L[y*512+x];assert.ok(Number.isFinite(v)&&v>=0&&v<=1);
  assert.equal(v,h.L[y*512+511-x]);assert.equal(v,h.L[(511-y)*512+x]);
  // Independent UV expectation, including texture upload's Y flip. The colour
  // repeats twice while normal repeats once over a complete mirrored period.
  const u=(x+.5)/512,vTex=1-(y+.5)/512;
  const mirror=t=>{t=((t%2)+2)%2;return t<=1?t:2-t;};
  const sourceX=mirror(2*u)*1024,sourceY=(1-mirror(2*vTex))*1024;
  const bx=Math.min(1020,Math.floor(sourceX/4)*4),by=Math.min(1020,Math.floor(sourceY/4)*4);
  let sum=0;for(let iy=0;iy<4;iy++)for(let ix=0;ix<4;ix++)sum+=h.source[(by+iy)*1024+bx+ix];
  assert.ok(Math.abs(v-sum/16)<6e-8);uvProbes++;
}
function decode(file){
  const b=fs.readFileSync(file);assert.equal(b.subarray(0,8).toString('hex'),'89504e470d0a1a0a');let at=8,idats=[],w,height;
  while(at<b.length){const len=b.readUInt32BE(at),type=b.toString('ascii',at+4,at+8),data=b.subarray(at+8,at+8+len);if(type==='IHDR'){w=data.readUInt32BE(0);height=data.readUInt32BE(4);assert.equal(data[8],8);assert.equal(data[9],6);}if(type==='IDAT')idats.push(data);at+=len+12;}
  const raw=zlib.inflateSync(Buffer.concat(idats)),pixels=Buffer.alloc(w*height*4);
  for(let y=0;y<height;y++){assert.equal(raw[y*(w*4+1)],0);raw.copy(pixels,y*w*4,y*(w*4+1)+1,(y+1)*(w*4+1));}return{w,h:height,pixels};
}
const n=decode(path.join(stage,'generated/berlin-paving-joint-normal-v144.png')),m=decode(path.join(stage,'generated/berlin-paving-joint-shade-v144.png'));
assert.deepEqual([n.w,n.h,m.w,m.h],[512,512,1024,1024]);
let changedNormalPixels=0,shadedPixels=0,maxNormalError=0;
for(let y=0;y<512;y++)for(let x=0;x<512;x++){
  const p=(y*512+x)*4,dx=(h.L[y*512+Math.min(511,x+1)]-h.L[y*512+Math.max(0,x-1)])*h.depth*512/(2*14.4),dy=(h.L[Math.min(511,y+1)*512+x]-h.L[Math.max(0,y-1)*512+x])*h.depth*512/(2*14.4),len=Math.hypot(dx,dy,1);
  const expected=[-dx/len,dy/len,1/len];for(let k=0;k<3;k++){const error=Math.abs((n.pixels[p+k]/255*2-1)-expected[k]);maxNormalError=Math.max(maxNormalError,error);assert.ok(error<=1/255+1e-8);}
  assert.equal(n.pixels[p+3],255);if(n.pixels[p]!==128||n.pixels[p+1]!==128)changedNormalPixels++;
}
for(let i=0;i<h.source.length;i++){assert.equal(m.pixels[i*4],0);assert.equal(m.pixels[i*4+1],0);assert.equal(m.pixels[i*4+2],0);assert.ok(Math.abs(m.pixels[i*4+3]-(1-h.source[i])*.09*255)<=.5+1e-6);if(m.pixels[i*4+3])shadedPixels++;if(h.source[i]===1)assert.equal(m.pixels[i*4+3],0);}
const html=fs.readFileSync(path.join(stage,'candidate.html'),'utf8'),scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)],ctx=vm.createContext({console});
vm.runInContext(scripts.find(m=>m[1].includes('three.js r156 (MIT)'))[1],ctx);const T=ctx.THREE;
let asyncCases=0;
for(const early of [false,true])for(const events of [['normal','shade'],['shade','normal'],['normalError','shade'],['shadeError','normal'],['normal','shadeError'],['shade','normalError']]){
  const pending={},data={},draws=[],paving={kind:'paving'},oldN=new T.Texture(),oldR=new T.Texture();let disposedOld=0,disposedNew=0,fallbacks=0;
  oldN.addEventListener('dispose',()=>disposedOld++);oldR.addEventListener('dispose',()=>disposedOld++);
  const material={normalMap:oldN,roughnessMap:oldR},road={repeat:new T.Vector2(2,.8),image:paving};
  const env={THREE:T,MAX_ANISO:16,performance:{now:()=>0},canvas:{dataset:data},BERLIN_PAVING_NORMAL_V144:'normal',BERLIN_PAVING_SHADE_V144:'shade',
    document:{createElement:()=>({getContext:()=>({drawImage:(...a)=>draws.push(a)})})},lumaField:img=>({img}),
    roughMapFrom:f=>{assert.equal(f.img,paving);return new T.Texture();},texLoader:{load:(name,ok,unused,error)=>pending[name]={ok,error}},
    relief:mat=>{fallbacks++;mat.normalMap=new T.Texture();mat.roughnessMap=new T.Texture();}};
  const runContext=vm.createContext({...env,material,paving,road});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'berlin_paving_runtime_v144.js'),'utf8')+'\nvar resources=beginReferencePavingReliefV144();',runContext);
  if(!early)vm.runInContext('applyReferencePavingReliefV144(material,paving,road,resources);',runContext);
  assert.equal(disposedOld,0,'retain valid maps while decoding');
  for(const event of events){const name=event.replace('Error','');if(event.endsWith('Error'))pending[name].error();else{const tex=new T.Texture({kind:name});tex.addEventListener('dispose',()=>disposedNew++);pending[name].ok(tex);}}
  if(early)vm.runInContext('applyReferencePavingReliefV144(material,paving,road,resources);',runContext);
  assert.equal(disposedOld,2);
  if(events.some(e=>e.endsWith('Error'))){assert.equal(data.pavingRelief,'fallback');assert.equal(fallbacks,1);assert.equal(disposedNew,1);}
  else{assert.equal(data.pavingRelief,'joint-height-v144');assert.equal(fallbacks,0);assert.equal(disposedNew,1);assert.deepEqual(Array.from(material.normalMap.repeat.toArray()),[1,.4]);assert.deepEqual(Array.from(material.normalScale.toArray()),[1,.72]);assert.equal(material.normalMap.wrapS,T.RepeatWrapping);assert.equal(material.roughnessMap.wrapS,T.MirroredRepeatWrapping);assert.deepEqual(Array.from(material.roughnessMap.repeat.toArray()),[2,.8]);assert.equal(draws.length,2);}
  asyncCases++;
}
const result={passed:true,candidateSha256:crypto.createHash('sha256').update(html).digest('hex'),seamProbes,faceProbes,uvProbes,asyncCases,changedNormalPixels,shadedPixels,maxNormalError,unchangedTextureBudget:true};
fs.writeFileSync(path.join(stage,'paving-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
