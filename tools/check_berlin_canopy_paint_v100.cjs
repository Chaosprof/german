'use strict';
// Independent payload, luminance and reusable GLB checks for the staged paint.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),vm=require('vm'),assert=require('assert/strict');
const stage=path.resolve(__dirname,'../audit/berlin-canopy-paint-v100'),name='berlin-kiez-garden-v1';
const before=JSON.parse(fs.readFileSync(path.join(stage,'baseline',name+'.json')));
const after=JSON.parse(fs.readFileSync(path.join(stage,'models',name+'.json')));
const report=JSON.parse(fs.readFileSync(path.join(stage,'validation.json')));
for(const [file,digest]of Object.entries(report.baseline_sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(stage,'baseline',file))).digest('hex'),digest,'immutable baseline '+file);
for(const key of Object.keys(before))if(key!=='meshes')assert.deepEqual(after[key],before[key],key+' exact');
for(const [key,record]of Object.entries(before.meshes)){
  if(!['treeNear','treeStreetFar'].includes(key)){assert.deepEqual(after.meshes[key],record,key+' fully protected');continue;}
  for(const attr of Object.keys(record))if(attr!=='color')assert.deepEqual(after.meshes[key][attr],record[attr],key+' '+attr+' exact');
  const old=Buffer.from(record.color,'base64'),now=Buffer.from(after.meshes[key].color,'base64');
  assert.equal(now.length,old.length);assert.deepEqual(now.subarray(0,562*3),old.subarray(0,562*3),'all trunk color bytes exact');
}
assert.equal(after.meshes.treeNear.triangles,13992);assert.equal(after.meshes.treeStreetFar.triangles,3996);assert.equal(after.meshes.planter.triangles,6698);
const p=Buffer.from(after.meshes.treeNear.position,'base64'),index=Buffer.from(after.meshes.treeNear.index,'base64');
const old=Buffer.from(before.meshes.treeNear.color,'base64'),now=Buffer.from(after.meshes.treeNear.color,'base64');
const point=v=>[0,1,2].map(c=>p.readFloatLE(v*12+c*4));
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const keyAt=(buf,v)=>[0,1,2].map(c=>buf.readFloatLE(v*12+c*4).toFixed(5)).join(',');
const meanColor=(buf,ids)=>[0,1,2].map(c=>[...ids].reduce((sum,v)=>sum+buf[v*3+c]/255,0)/ids.size);
const luminance=rgb=>rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
let areaSum=0,oldSum=0,newSum=0;const paint=new Map();
for(let leaf=0;leaf<1680;leaf++){
  const vertices=new Set();let area=0;
  for(let face=552+leaf*8;face<552+(leaf+1)*8;face++){
    const ids=[0,1,2].map(c=>index.readUInt16LE((face*3+c)*2));ids.forEach(v=>vertices.add(v));
    const [a,b,c]=ids.map(point);area+=Math.hypot(...cross(sub(b,a),sub(c,a)))*.5;
  }
  assert.equal(vertices.size,12,'six leaf corners with two curved normal sets');
  for(const v of vertices)paint.set(keyAt(p,v),now.subarray(v*3,v*3+3).toString('hex'));
  areaSum+=area;oldSum+=luminance(meanColor(old,vertices))*area;newSum+=luminance(meanColor(now,vertices))*area;
}
const beforeMean=oldSum/areaSum,afterMean=newSum/areaSum,delta=afterMean/beforeMean-1;
assert.ok(Math.abs(delta)<.003,'area-weighted mean luminance preserved within 0.3%');
// Blender mathutils evaluates triangle areas in float32; the independent JS
// arithmetic uses doubles. Keep a tight tolerance for that measured rounding.
assert.ok(Math.abs(beforeMean-report.area_weighted_leaf_luminance.before)<1e-9);
assert.ok(Math.abs(afterMean-report.area_weighted_leaf_luminance.after)<1e-9);
assert.equal(report.leaf_color_clips,0);assert.equal(report.far_core_normalized_vertices,0,'no clipping or forced far-core color normalization');
const far=after.meshes.treeStreetFar,fp=Buffer.from(far.position,'base64'),fc=Buffer.from(far.color,'base64');let matched=0;
for(let v=562;v<far.vertices;v++){
  const key=keyAt(fp,v);if(!paint.has(key))continue;
  assert.equal(fc.subarray(v*3,v*3+3).toString('hex'),paint.get(key),'retained near/far RGB exact');matched++;
}
assert.equal(matched,418*12,'all retained far leaves compared');
const originalGlb=fs.readFileSync(path.join(stage,'baseline',name+'.glb')),glb=fs.readFileSync(path.join(stage,'models',name+'.glb'));
assert.equal(glb.length,originalGlb.length,'no added GLB buffers');
const size=glb.readUInt32LE(12),gltf=JSON.parse(glb.subarray(20,20+size));
assert.deepEqual(glb.subarray(0,28+size),originalGlb.subarray(0,28+size),'all GLB descriptors unchanged');
const attrs=gltf.meshes.find(m=>m.name==='Kiez_Tree_Leaves_Street').primitives[0].attributes;
const color=gltf.accessors[attrs.COLOR_0],position=gltf.accessors[attrs.POSITION],cv=gltf.bufferViews[color.bufferView],pv=gltf.bufferViews[position.bufferView];
const co=28+size+(cv.byteOffset||0)+(color.byteOffset||0),po=28+size+(pv.byteOffset||0)+(position.byteOffset||0);
assert.equal(color.componentType,5123);assert.equal(color.normalized,true);assert.equal(color.type,'VEC4');
for(let v=0;v<position.count;v++){
  const q=[0,1,2].map(c=>glb.readFloatLE(po+v*(pv.byteStride||12)+c*4).toFixed(5)).join(',');
  const expected=Buffer.from(paint.get(q),'hex');
  for(let c=0;c<3;c++)assert.equal(glb.readUInt16LE(co+v*(cv.byteStride||8)+c*2),expected[c]*257,'GLB/runtime leaf RGB parity');
}
for(let i=0;i<glb.length;i++)if(glb[i]!==originalGlb[i]){
  const offset=i-co;assert.ok(offset>=0&&offset<color.count*(cv.byteStride||8)&&offset%(cv.byteStride||8)<6,'only near-leaf RGB GLB bytes changed');
}
const scope={};vm.runInNewContext(fs.readFileSync(path.join(stage,'models',name+'.inline.js'),'utf8'),scope);
assert.equal(JSON.stringify(scope.BERLIN_KIEZ_GARDEN_DATA),JSON.stringify(after),'inline/runtime pack exact');
assert.deepEqual(fs.readFileSync(path.join(stage,'models',name+'-atlas.jpg')),fs.readFileSync(path.join(stage,'baseline',name+'-atlas.jpg')));
console.log(`PASS: v100 color-only canopy; 1680 near leaves, 418 exact far matches; mean luminance change ${(delta*100).toFixed(4)}%; all geometry/normals/UVs/trunks/V95 planter/atlas unchanged; GLB RGB parity.`);
