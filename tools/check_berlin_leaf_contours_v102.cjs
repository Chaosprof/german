'use strict';
// Reuse the historical leaf check's read-only decoding/component helpers.
// Its 16-face/all-leaf hypothesis assertions are intentionally not executed.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-leaf-contours-v102');
const legacy=fs.readFileSync(path.join(__dirname,'check_berlin_oval_foliage_v92.cjs'),'utf8');
const prefix=legacy.slice(0,legacy.indexOf('const reports =')).replace("'audit/berlin-oval-foliage-v92'","'audit/berlin-leaf-contours-v102'");
const {before,after,decode,components,triangleCounter,point,sub,dot,cross}=new Function('require','__dirname',prefix+'\nreturn {before,after,decode,components,triangleCounter,point,sub,dot,cross};')(require,__dirname);
require('./check_berlin_canopy_paint_v100.cjs');
assert.deepEqual(before,JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-canopy-paint-v100/models/berlin-kiez-garden-v1.json'))),'contour source is exactly the independently verified accepted V100 pack');
const selection=JSON.parse(fs.readFileSync(path.join(stage,'selection.json'))),report=JSON.parse(fs.readFileSync(path.join(stage,'validation.json')));
for(const key of Object.keys(before.meshes))if(key!=='treeNear')assert.deepEqual(after.meshes[key],before.meshes[key],key+' is fully unchanged');
assert.equal(after.meshes.treeNear.triangles,13992);assert.equal(after.meshes.treeStreetFar.triangles,3996);
const old=decode(before.meshes.treeNear),now=decode(after.meshes.treeNear);
const oldGroups=components(old),newGroups=components(now);
const oldLeaves=oldGroups.filter(g=>g.faces.length===8&&g.unique.length===6&&g.center[1]>4.4);
const unchanged=newGroups.filter(g=>g.faces.length===8&&g.unique.length===6&&g.center[1]>4.4);
const converted=newGroups.filter(g=>g.faces.length===12&&g.unique.length===8&&g.center[1]>4.4);
assert.equal(oldLeaves.length,1680);assert.equal(unchanged.length,1080);assert.equal(converted.length,400);
const removed=new Set(selection.removed),changed=new Set(selection.converted),retained=new Set(selection.unchanged);
assert.equal(removed.size,200);assert.equal(changed.size,400);assert.equal(retained.size,1080);
for(let i=0;i<1680;i++)assert.equal([removed,changed,retained].filter(s=>s.has(i)).length,1,'each original leaf has one explicit fate');
for(const i of selection.far_retained)assert.ok(retained.has(i),'every far-retained near leaf stays exact');
assert.equal(selection.far_retained.length,418);
const oldProtected=oldGroups.filter(g=>!oldLeaves.includes(g)).flatMap(g=>g.faces).concat([...retained].flatMap(i=>oldLeaves[i].faces));
const newProtected=newGroups.filter(g=>!converted.includes(g)).flatMap(g=>g.faces);
assert.deepEqual(triangleCounter(now,newProtected),triangleCounter(old,oldProtected),'trunk and all 1080 retained leaves preserve every runtime corner attribute');
let maxMeanColorError=0,minVolume=Infinity,minNormalDot=Infinity;
const matched=new Set();
for(const i of changed){
  const prior=oldLeaves[i],matches=converted.filter(g=>Math.max(...g.center.map((v,k)=>Math.abs(v-prior.center[k])))<.00001);
  assert.equal(matches.length,1,'one smooth blade preserves the source leaf center');const g=matches[0];assert.ok(!matched.has(g));matched.add(g);
  const rgb=(data,group)=>{const byPoint=new Map();for(const v of group.vertices)byPoint.set(point(data,v).join(','),[...data.color.slice(v*3,v*3+3)]);return [...byPoint.values()];};
  const a=rgb(old,prior),b=rgb(now,g);
  for(let c=0;c<3;c++){
    assert.ok(Math.min(...b.map(x=>x[c]))>=Math.min(...a.map(x=>x[c]))&&Math.max(...b.map(x=>x[c]))<=Math.max(...a.map(x=>x[c])),'new corner colors stay in the accepted per-leaf V100 range');
    const error=Math.abs(b.reduce((sum,x)=>sum+x[c],0)/8-a.reduce((sum,x)=>sum+x[c],0)/6);maxMeanColorError=Math.max(maxMeanColorError,error);assert.ok(error<=1/24+.000001);
    assert.ok(Math.min(...g.unique.map(p=>p[c]))>=Math.min(...prior.unique.map(p=>p[c]))-.01501,'rounded shoulder extension stays within 1.5 cm');
    assert.ok(Math.max(...g.unique.map(p=>p[c]))<=Math.max(...prior.unique.map(p=>p[c]))+.01501,'rounded shoulder extension stays within 1.5 cm');
  }
  const edges=new Map();let volume=0;
  for(const fi of g.faces){
    const ids=[...now.index.slice(fi*3,fi*3+3)],ps=ids.map(v=>point(now,v));
    const normal=cross(sub(ps[1],ps[0]),sub(ps[2],ps[0])),area=Math.hypot(...normal);assert.ok(area>1e-9);
    volume+=dot(sub(ps[0],g.center),cross(sub(ps[1],g.center),sub(ps[2],g.center)))/6;
    for(const v of ids){const n=[...now.normal.slice(v*3,v*3+3)].map(v=>v/32767);assert.ok(Math.abs(Math.hypot(...n)-1)<.0001);const facing=dot(normal,n)/area;minNormalDot=Math.min(minNormalDot,facing);assert.ok(facing>.004);assert.deepEqual([...now.uv.slice(v*2,v*2+2)],[.015625,.015625]);}
    for(const [a,b]of [[0,1],[1,2],[2,0]]){const key=[ps[a].join(','),ps[b].join(',')].sort().join('|');edges.set(key,(edges.get(key)||0)+1);}
  }
  assert.ok([...edges.values()].every(count=>count===2));assert.ok(volume>0);minVolume=Math.min(minVolume,volume);
}
for(const side of ['min','max'])assert.deepEqual(after.meshes.treeNear[side],before.meshes.treeNear[side]);
for(let k=0;k<3;k++){
  const a=[],b=[];for(let i=k;i<old.position.length;i+=3)a.push(old.position[i]);for(let i=k;i<now.position.length;i+=3)b.push(now.position[i]);
  assert.equal(Math.min(...a),Math.min(...b));assert.equal(Math.max(...a),Math.max(...b));
}
const readGlb=(folder)=>{const bytes=fs.readFileSync(path.join(stage,folder,'berlin-kiez-garden-v1.glb')),length=bytes.readUInt32LE(12);return {bytes,gltf:JSON.parse(bytes.subarray(20,20+length)),start:28+length};};
const beforeGlb=readGlb('baseline'),afterGlb=readGlb('models');
const primitive=afterGlb.gltf.meshes.find(m=>m.name==='Kiez_Tree_Leaves_Street').primitives[0];
const replaced=new Set([...Object.values(primitive.attributes),primitive.indices].map(i=>afterGlb.gltf.accessors[i].bufferView));
const payload=(g,i)=>{const v=g.gltf.bufferViews[i],start=g.start+(v.byteOffset||0);return g.bytes.subarray(start,start+v.byteLength);};
for(const key of ['nodes','meshes','materials','images','textures','samplers','scenes'])assert.deepEqual(afterGlb.gltf[key],beforeGlb.gltf[key],key+' remains exact');
for(let i=0;i<afterGlb.gltf.bufferViews.length;i++)if(!replaced.has(i))assert.deepEqual(payload(afterGlb,i),payload(beforeGlb,i),'all GLB non-near payloads exact');
const attr=name=>{const a=afterGlb.gltf.accessors[primitive.attributes[name]];return {a,raw:payload(afterGlb,a.bufferView)};};
const gp=attr('POSITION'),gn=attr('NORMAL'),gc=attr('COLOR_0'),gu=attr('TEXCOORD_0');
const indices=payload(afterGlb,afterGlb.gltf.accessors[primitive.indices].bufferView);
assert.equal(indices.length,(13992-552)*3*2);
for(let i=0;i<indices.length/2;i++){
  const vi=indices.readUInt16LE(i*2),runtime=now.index[552*3+i];
  for(let k=0;k<3;k++){
    assert.equal(gp.raw.readFloatLE(vi*12+k*4),now.position[runtime*3+k]);
    assert.ok(Math.abs(gn.raw.readFloatLE(vi*12+k*4)-now.normal[runtime*3+k]/32767)<1e-7);
    assert.equal(gc.raw.readUInt16LE(vi*8+k*2),now.color[runtime*3+k]*257);
  }
  for(let k=0;k<2;k++)assert.equal(gu.raw.readFloatLE(vi*8+k*4),now.uv[runtime*2+k]);
}
assert.ok(report.native_corner_normal_quantization_max<=3);
console.log(JSON.stringify({ok:true,triangles:13992,unchangedLeaves:1080,smootherLeaves:400,removedHiddenLeaves:200,farRetainedExact:418,maxMeanColorErrorByte:maxMeanColorError,minClosedLeafVolume:minVolume,minOutwardNormalDot:minNormalDot,allProtectedRuntimeAndNonNearGLBPayloadsExact:true},null,2));
