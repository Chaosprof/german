'use strict';
// Check the v87 candidate independently of the Blender bake's own assertions.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),assert=require('assert/strict');
const stage=path.resolve(__dirname,'../audit/berlin-canopy-depth-v87');
const before=JSON.parse(fs.readFileSync(path.join(stage,'baseline/berlin-kiez-garden-v1.json')));
const after=JSON.parse(fs.readFileSync(path.join(stage,'models/berlin-kiez-garden-v1.json')));
const report=JSON.parse(fs.readFileSync(path.join(stage,'validation.json')));
const factors=JSON.parse(fs.readFileSync(path.join(stage,'leaf-factors.json')));
for(const [name,expected]of Object.entries(report.baseline_sha256)){
  const actual=crypto.createHash('sha256').update(fs.readFileSync(path.join(stage,'baseline',name))).digest('hex');
  assert.equal(actual,expected,'immutable baseline: '+name);
}
for(const key of Object.keys(before))if(key!=='meshes')assert.deepEqual(after[key],before[key],key+' unchanged');
for(const [key,record]of Object.entries(before.meshes)){
  if(!['treeNear','treeStreetFar'].includes(key)){assert.deepEqual(after.meshes[key],record,'protected record: '+key);continue;}
  for(const attr of Object.keys(record))if(attr!=='color')assert.deepEqual(after.meshes[key][attr],record[attr],key+' '+attr+' exact');
  const old=Buffer.from(record.color,'base64'),now=Buffer.from(after.meshes[key].color,'base64');
  assert.equal(old.length,now.length);assert.deepEqual(now.subarray(0,562*3),old.subarray(0,562*3),'all trunk RGB bytes exact');
  for(let i=0;i<now.length;i++)assert.ok(now[i]<=old[i]&&now[i]>=Math.floor(old[i]*.62),'restrained nonbrightening linear factor');
}
const pos=Buffer.from(before.meshes.treeNear.position,'base64'),ids=Buffer.from(before.meshes.treeNear.index,'base64');
const old=Buffer.from(before.meshes.treeNear.color,'base64'),now=Buffer.from(after.meshes.treeNear.color,'base64');
const round=x=>{const lo=Math.floor(x),f=x-lo;return f===.5?lo+(lo%2):Math.round(x);};
assert.equal(factors.length,1680);
const colorAtPoint=new Map();
for(let leaf=0;leaf<1680;leaf++){
  const vertices=new Set();for(let i=(552+leaf*8)*3;i<(552+(leaf+1)*8)*3;i++)vertices.add(ids.readUInt16LE(i*2));
  assert.equal(vertices.size,12,'six corners with distinct curved front/back normals');
  for(const v of vertices){
    for(let ch=0;ch<3;ch++)assert.equal(now[v*3+ch],round(old[v*3+ch]*factors[leaf].factor),'one factor per complete closed leaf');
    const p=[0,1,2].map(ch=>pos.readFloatLE(v*12+ch*4).toFixed(5)).join(',');
    colorAtPoint.set(p,now.subarray(v*3,v*3+3).toString('hex'));
  }
}
const far=after.meshes.treeStreetFar,fp=Buffer.from(far.position,'base64'),fi=Buffer.from(far.index,'base64'),fc=Buffer.from(far.color,'base64');
let matchedFarVertices=0;
for(let v=562;v<far.vertices;v++){
  const p=[0,1,2].map(ch=>fp.readFloatLE(v*12+ch*4).toFixed(5)).join(',');
  if(!colorAtPoint.has(p))continue; // Five recessed cores are interleaved between leaf clusters.
  assert.equal(fc.subarray(v*3,v*3+3).toString('hex'),colorAtPoint.get(p),'near/far shared leaf paint exact');
  matchedFarVertices++;
}
assert.equal(matchedFarVertices,418*12,'all retained leaf vertices were compared');
const originalGlb=fs.readFileSync(path.join(stage,'baseline/berlin-kiez-garden-v1.glb'));
const candidateGlb=fs.readFileSync(path.join(stage,'models/berlin-kiez-garden-v1.glb'));
assert.equal(candidateGlb.length,originalGlb.length,'GLB byte allocation unchanged');
const length=originalGlb.readUInt32LE(12),gltf=JSON.parse(originalGlb.subarray(20,20+length));
assert.deepEqual(candidateGlb.subarray(0,28+length),originalGlb.subarray(0,28+length),'GLB descriptors exact');
const mesh=gltf.meshes.find(m=>m.name==='Kiez_Tree_Leaves_Street');
const attr=gltf.accessors[mesh.primitives[0].attributes.COLOR_0],view=gltf.bufferViews[attr.bufferView];
const start=28+length+(view.byteOffset||0)+(attr.byteOffset||0),stride=view.byteStride||8;
for(let i=0;i<candidateGlb.length;i++)if(candidateGlb[i]!==originalGlb[i]){
  const offset=i-start;assert.ok(offset>=0&&offset<attr.count*stride&&offset%stride<6,'only near-leaf GLB RGB changes');
}
const scope={};vm.runInNewContext(fs.readFileSync(path.join(stage,'models/berlin-kiez-garden-v1.inline.js'),'utf8'),scope);
assert.equal(JSON.stringify(scope.BERLIN_KIEZ_GARDEN_DATA),JSON.stringify(after),'inline/runtime pack agreement');
assert.deepEqual(fs.readFileSync(path.join(stage,'models/berlin-kiez-garden-v1-atlas.jpg')),fs.readFileSync(path.join(stage,'baseline/berlin-kiez-garden-v1-atlas.jpg')));
console.log('PASS: 1680 whole-leaf factors; 418 exact near/far leaf matches; geometry, curved normals, UVs, indices, trunks, grove, stone planter and atlas unchanged; GLB only changes near-leaf RGB.');
