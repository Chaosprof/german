'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v138'),name='berlin-reference-architecture-v1';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const decode=r=>Object.fromEntries([['position',Float32Array],['normal',Int16Array],['color',Uint8Array],['uv',Float32Array],['index',Uint16Array]].map(([k,T])=>{const b=Buffer.from(r[k],'base64');return[k,new T(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))];}));
function validate(data,before){
  const plan=read(path.join(stage,'flowers.json')),key='13.5:0:1',a=before.meshes[key],b=data.meshes[key],old=decode(a),now=decode(b);
  assert.equal(b.plantingRevision,'rounded-floret-clusters-v138');
  for(const k of Object.keys(before.meshes))if(k!==key)assert.deepEqual(data.meshes[k],before.meshes[k],k+' remains exact');
  for(const k of Object.keys(a))if(!['position','normal','color','uv','index','vertices','triangles','plantingRevision'].includes(k))assert.deepEqual(b[k],a[k],k+' preserved');
  assert.deepEqual(data.atlas,before.atlas);assert.equal(b.triangles,a.triangles-728);assert.ok(b.vertices<a.vertices);
  const removed=new Set(plan.removedFaces);assert.equal(removed.size,3140);
  let retained=0;
  for(let f=0;f<a.triangles;f++){
    if(removed.has(f)){
      const ids=Array.from(old.index.slice(f*3,f*3+3));
      for(const v of ids){
        assert.ok(old.position[v*3+1]>6.2,'only elevated planting may be removed');
        assert.equal(Math.floor(old.uv[v*2]*4)+4*Math.floor((1-old.uv[v*2+1])*4),0,'only neutral plant atlas cell');
        assert.ok(old.color[v*3]>old.color[v*3+1]*1.20&&old.color[v*3+2]>old.color[v*3]*.25,'only pink/cream floral paint');
      }
      continue;
    }
    for(let j=0;j<3;j++)for(const [attr,s] of [['position',3],['normal',3],['color',3],['uv',2]]){
      const x=old.index[f*3+j],y=now.index[retained*3+j];
      for(let k=0;k<s;k++)assert.equal(now[attr][y*s+k],old[attr][x*s+k],'protected '+attr+' corner');
    }
    retained++;
  }
  assert.equal(retained,22884);assert.equal(b.triangles-retained,201*12);
  const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
  let minFacing=1;
  for(let floret=0;floret<201;floret++){
    const edges=new Map(),points=new Set();
    for(let f=retained+floret*12;f<retained+(floret+1)*12;f++){
      const ids=Array.from(now.index.slice(f*3,f*3+3)),p=ids.map(v=>Array.from(now.position.slice(v*3,v*3+3))),n=ids.map(v=>Array.from(now.normal.slice(v*3,v*3+3),x=>x/32767));
      const face=cross(sub(p[1],p[0]),sub(p[2],p[0])),shade=[0,1,2].map(k=>n.reduce((s,v)=>s+v[k],0));
      const facing=dot(face,shade)/(Math.hypot(...face)*Math.hypot(...shade));minFacing=Math.min(minFacing,facing);
      assert.ok(Math.hypot(...face)>1e-9&&facing>.5,'outward closed floret surface');
      for(let k=0;k<3;k++){
        assert.ok(Math.abs(Math.hypot(...n[k])-1)<.0001);
        const pa=p[k].join(','),pb=p[(k+1)%3].join(',');points.add(pa);
        const edge=[pa,pb].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);
      }
    }
    assert.equal(points.size,8);assert.ok([...edges.values()].every(n=>n===2),'closed six-corner petal cup');
  }
  return {protectedTriangles:retained,newFlorets:201,trianglesSaved:a.triangles-b.triangles,verticesSaved:a.vertices-b.vertices,minFacing};
}
module.exports={validate};
if(require.main===module){
  const before=read(path.join(stage,'baseline',name+'.json')),after=read(path.join(stage,'models',name+'.json'));
  const native=validate(after,before),html=fs.readFileSync(path.join(stage,'candidate.html'),'utf8'),baseHTML=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
  const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();
  const oldKit=fs.readFileSync(path.join(stage,'baseline/berlin_kiez_kit.js'),'utf8'),newKit=fs.readFileSync(path.join(stage,'sources/berlin_kiez_kit.js'),'utf8');
  const arch=/var BERLIN_REFERENCE_ARCHITECTURE = (\{[^\r\n]*\});/;
  assert.equal(html.replace(trim(newKit),()=>trim(oldKit)).replace(arch,()=>baseHTML.match(arch)[0]).replace("'kiez-reference-v138'","'kiez-reference-v137'"),baseHTML,'all code outside the facade factory stays exact');
  let restored=newKit;
  for(const [a,b] of read(path.join(stage,'edits.json')).slice().reverse()){assert.equal(restored.split(b).length,2);restored=restored.replace(b,()=>a);}
  assert.equal(restored,oldKit,'factory differs only in bounded flower authoring');
  const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
  const context=vm.createContext({console,atob:s=>Buffer.from(s,'base64').toString('binary')});
  vm.runInContext(scripts.find(s=>s.includes('three.js r156 (MIT)')),context);
  vm.runInContext(fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8'),context);
  const T=context.THREE,noop=()=>{},canvas=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
  function make(code,data){
    vm.runInContext(code,context);context.BERLIN_REFERENCE_ARCHITECTURE=data;
    const kit=context.createBerlinKiezKit(T,(c,o)=>new T.MeshStandardMaterial({color:c,...o}),()=>({getContext:()=>canvas}));
    for(const w of [11,13.5,16])for(let v=0;v<6;v++)for(const s of [-1,1])kit.geometry(w,v,s);
    return kit;
  }
  const a=make(oldKit,before),b=make(newKit,after);let layouts=0,maxTriangles=0,totalVertexSavings=0;
  for(const width of [11,13.5,16])for(let variant=0;variant<6;variant++)for(const side of [-1,1]){
    const old=a.geometry(width,variant,side),now=b.geometry(width,variant,side);
    assert.equal(now.index.count,old.index.count-(variant===0?728*3:0),'same or smaller triangle budget');
    assert.ok(now.attributes.position.count<old.attributes.position.count,'fewer uploaded vertices');
    assert.deepEqual(now.groups.map(g=>g.materialIndex),old.groups.map(g=>g.materialIndex),'same draw count/material');
    assert.equal(now.userData.flowerBoxes,old.userData.flowerBoxes);assert.equal(now.userData.flowerHeads,now.userData.flowerBoxes*15);
    assert.equal(now.userData.displayBookCount,old.userData.displayBookCount);assert.equal(now.userData.parkedBicycles,old.userData.parkedBicycles);
    for(const axis of ['x','y','z']){
      assert.ok(now.boundingBox.min[axis]>=old.boundingBox.min[axis]-1e-6&&now.boundingBox.max[axis]<=old.boundingBox.max[axis]+1e-6,'flowers stay within the old cull envelope');
      assert.ok(Math.abs(now.boundingBox.min[axis]-old.boundingBox.min[axis])<.01&&Math.abs(now.boundingBox.max[axis]-old.boundingBox.max[axis])<.01,'only millimetres of petal relief can change the bounds');
    }
    for(const range of ['displayBookFaces','bicycleFaces']){
      const ra=old.userData[range],rb=now.userData[range];assert.equal(rb[1]-rb[0],ra[1]-ra[0]);
      for(let f=0;f<(ra[1]-ra[0])*3;f++)for(const attr of Object.keys(old.attributes)){
        const aa=old.attributes[attr],bb=now.attributes[attr],ia=old.index.getX(ra[0]*3+f),ib=now.index.getX(rb[0]*3+f);
        for(let k=0;k<aa.itemSize;k++)assert.equal(bb.getComponent(ib,k),aa.getComponent(ia,k),range+' exact '+attr);
      }
    }
    totalVertexSavings+=old.attributes.position.count-now.attributes.position.count;maxTriangles=Math.max(maxTriangles,now.index.count/3);layouts++;
  }
  assert.ok(maxTriangles<27000);
  const result={passed:true,shipping:process.argv.includes('--shipping'),native,layouts,maxTriangles,totalVertexSavings,addedDraws:0,addedTextures:0,unchangedShaderSource:true};
  if(result.shipping){
    assert.equal(html,fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8'));
    for(const suffix of ['.json','.inline.js','.blend','.glb','-atlas.png'])assert.deepEqual(fs.readFileSync(path.join(root,'assets/models',name+suffix)),fs.readFileSync(path.join(stage,'models',name+suffix)));
    for(const file of ['berlin_kiez_kit.js','berlin_facade_finish_v119.js'])assert.equal(fs.readFileSync(path.join(root,'tools',file),'utf8'),fs.readFileSync(path.join(stage,'sources',file),'utf8'));
  }
  fs.writeFileSync(path.join(stage,'geometry-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
