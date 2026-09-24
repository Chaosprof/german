'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v137'),prefix='berlin-kiez-garden-v1';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const before=read(path.join(stage,'baseline',prefix+'.json')),after=read(path.join(stage,'models',prefix+'.json'));
const shipping=process.argv.includes('--shipping');
const unpack=r=>Object.fromEntries([['position',4,'readFloatLE'],['normal',2,'readInt16LE'],['color',1,'readUInt8'],['uv',4,'readFloatLE'],['index',2,'readUInt16LE']].map(([k,s,f])=>{const b=Buffer.from(r[k],'base64');return[k,Array.from({length:b.length/s},(_,i)=>b[f](i*s))];}));
const dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0),sub=(a,b)=>a.map((x,k)=>x-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
assert.equal(after.canopyRevision,'thin-sheet-linden-v137');
for(const key of Object.keys(before))if(!['meshes','source','canopyRevision'].includes(key))assert.deepEqual(after[key],before[key],key);
const report={};
for(const role of Object.keys(before.meshes)){
  const a=before.meshes[role],b=after.meshes[role];
  if(!['treeNear','treeStreetFar'].includes(role)){assert.deepEqual(b,a,role);continue;}
  for(const key of Object.keys(a))if(key!=='normal')assert.deepEqual(b[key],a[key],role+' '+key+' remains byte-exact');
  const old=unpack(a),m=unpack(b);let changed=0,oldSpread=0,newSpread=0,leafFaces=0,minFacing=1;
  for(let i=0;i<b.vertices;i++){
    const n=m.normal.slice(i*3,i*3+3),prior=old.normal.slice(i*3,i*3+3);
    assert.ok(Math.abs(Math.hypot(...n)/32767-1)<.0001,'unit normal');
    if(n.some((v,k)=>v!==prior[k])){
      changed++;
      assert.ok(m.color[i*3+1]>m.color[i*3]*1.1,'only green leaves change');
    }
  }
  for(let i=0;i<552*3;i++){
    const v=m.index[i];assert.deepEqual(m.normal.slice(v*3,v*3+3),old.normal.slice(v*3,v*3+3),'trunk normals exact');
  }
  for(let f=552;f<b.triangles;f++){
    const ids=m.index.slice(f*3,f*3+3),p=ids.map(i=>m.position.slice(i*3,i*3+3));
    const face=cross(sub(p[1],p[0]),sub(p[2],p[0]));
    const n=ids.map(i=>m.normal.slice(i*3,i*3+3)),on=ids.map(i=>old.normal.slice(i*3,i*3+3));
    const sum=[0,1,2].map(k=>n.reduce((s,x)=>s+x[k],0));
    const facing=dot(face,sum)/(Math.hypot(...face)*Math.hypot(...sum));
    assert.ok(facing>-.001,'normal field follows outward geometry');minFacing=Math.min(minFacing,facing);
    if(ids.every(i=>m.color[i*3+1]>m.color[i*3]*1.1)){
      const spread=ns=>[0,1,2].reduce((s,k)=>s+Math.acos(Math.max(-1,Math.min(1,dot(ns[k],ns[(k+1)%3])/(Math.hypot(...ns[k])*Math.hypot(...ns[(k+1)%3]))))),0)/3;
      oldSpread+=spread(on);newSpread+=spread(n);leafFaces++;
    }
  }
  assert.ok(changed>1000);assert.ok(newSpread<oldSpread*.50,'normal curvature is materially flatter');
  report[role]={triangles:b.triangles,vertices:b.vertices,changedNormals:changed,minFacing,meanLeafNormalAngleBefore:oldSpread/leafFaces*180/Math.PI,meanLeafNormalAngleAfter:newSpread/leafFaces*180/Math.PI};
}
// The entire page must differ only in the embedded garden data and revision.
const baseHTML=fs.readFileSync(path.join(stage,'baseline.html'),'utf8'),html=fs.readFileSync(path.join(stage,'candidate.html'),'utf8');
const pattern=/var BERLIN_KIEZ_GARDEN_DATA = (\{[^\r\n]*\});/;
assert.deepEqual(JSON.parse(html.match(pattern)[1]),after);
assert.equal(html.replace(pattern,()=>baseHTML.match(pattern)[0]).replace("'kiez-reference-v137'","'kiez-reference-v136'"),baseHTML,'render/shader/gameplay source exact');
// Native GLB differs only in the near-leaf NORMAL buffer view.
const glb=p=>{const b=fs.readFileSync(p),n=b.readUInt32LE(12);return{doc:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)};};
const ga=glb(path.join(stage,'baseline',prefix+'.glb')),gb=glb(path.join(stage,'models',prefix+'.glb'));
assert.deepEqual(gb.doc,ga.doc,'GLB scene, materials, topology and all accessor metadata stay exact');
const prim=gb.doc.meshes.find(m=>m.name==='Kiez_Tree_Leaves_Street').primitives[0];
const normalView=gb.doc.accessors[prim.attributes.NORMAL].bufferView;
for(let i=0;i<gb.doc.bufferViews.length;i++)if(i!==normalView){const v=gb.doc.bufferViews[i];assert.deepEqual(gb.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength),ga.bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength),'native buffer '+i);}
const accessor=id=>{const a=gb.doc.accessors[id],v=gb.doc.bufferViews[a.bufferView],size=a.componentType===5126?4:2,n=a.type==='VEC3'?3:1,fn=size===4?'readFloatLE':'readUInt16LE';return Array.from({length:a.count*n},(_,i)=>gb.bin[fn]((v.byteOffset||0)+(a.byteOffset||0)+i*size));};
const normal=accessor(prim.attributes.NORMAL),ids=accessor(prim.indices),near=unpack(after.meshes.treeNear);
for(let i=0;i<ids.length;i++)for(let k=0;k<3;k++)assert.ok(Math.abs(normal[ids[i]*3+k]-near.normal[near.index[552*3+i]*3+k]/32767)<.000001,'native normals match runtime');
if(shipping){
  assert.equal(html,fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8'));
  for(const suffix of ['.json','.inline.js','.blend','.glb','-atlas.jpg'])assert.deepEqual(fs.readFileSync(path.join(root,'assets/models',prefix+suffix)),fs.readFileSync(path.join(stage,'models',prefix+suffix)));
}
const result={passed:true,shipping,unchangedGeometryAndCoverage:true,unchangedShaderAndRenderWork:true,unchangedBufferSizes:true,nativeNormalsMatch:true,...report};
fs.writeFileSync(path.join(stage,'geometry-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
