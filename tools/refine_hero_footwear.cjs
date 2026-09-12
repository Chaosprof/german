'use strict';
// Produce the real v14 skinned mesh from v13 without re-exporting its rig,
// atlas, UVs or fifteen authored clips. Only footwear POSITION/NORMAL bytes
// change. The existing topology has enough rings for a softly bevelled sole.
const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const sourcePath = path.join(root, 'assets/models/berlin-runner-hero-v13.glb');
const outputPath = path.join(root, 'assets/models/berlin-runner-hero-v14.glb');
const input = fs.readFileSync(sourcePath);
assert.equal(input.readUInt32LE(0), 0x46546c67);
assert.equal(input.readUInt32LE(4), 2);
assert.equal(input.readUInt32LE(8), input.length);
const jsonLength = input.readUInt32LE(12);
assert.equal(input.readUInt32LE(16), 0x4e4f534a);
assert.equal(input.readUInt32LE(24 + jsonLength), 0x004e4942);
const doc = JSON.parse(input.subarray(20, 20 + jsonLength));
const originalDoc = structuredClone(doc);
const binary = Buffer.from(input.subarray(28 + jsonLength));
const originalBinary = Buffer.from(binary);
assert.equal(doc.meshes.length, 1);
assert.equal(doc.meshes[0].primitives.length, 1);
assert.equal(doc.animations.length, 15);
const primitive = doc.meshes[0].primitives[0];
function attribute(index) {
  const accessor = doc.accessors[index], view = doc.bufferViews[accessor.bufferView];
  const sizes = {SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT4:16};
  const types = {5121:Uint8Array, 5123:Uint16Array, 5125:Uint32Array, 5126:Float32Array};
  assert.equal(view.byteStride, undefined);
  assert.equal(accessor.sparse, undefined);
  const Type = types[accessor.componentType], size = sizes[accessor.type];
  const start = (view.byteOffset || 0) + (accessor.byteOffset || 0);
  const length = accessor.count * size * Type.BYTES_PER_ELEMENT;
  return {accessor, start, length, size, values:new Type(Uint8Array.from(binary.subarray(start, start + length)).buffer)};
}
const position = attribute(primitive.attributes.POSITION);
const normal = attribute(primitive.attributes.NORMAL);
const joints = attribute(primitive.attributes.JOINTS_0);
const weights = attribute(primitive.attributes.WEIGHTS_0);
const indices = attribute(primitive.indices);
assert.equal(position.accessor.componentType, 5126);
assert.equal(normal.accessor.componentType, 5126);
const names = doc.skins[0].joints.map(i => doc.nodes[i].name);
const p0 = position.values.slice(), n0 = normal.values.slice();
const smooth = (a, b, x) => {const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t*t*(3-2*t);};
const bounds = {Left:{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]},
  Right:{min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}};
const shoeWeights = Array.from({length:position.accessor.count}, () => ({Left:0,Right:0}));
for (let i = 0; i < position.accessor.count; i++) {
  for (let c = 0; c < 4; c++) {
    const match = /^(Left|Right)(Foot|ToeBase)$/.exec(names[joints.values[i*4+c]]);
    if (match) shoeWeights[i][match[1]] += weights.values[i*4+c];
  }
  for (const side of ['Left','Right']) if (shoeWeights[i][side] > 0.5 && p0[i*3+1] < 0.06) {
    for (let c = 0; c < 3; c++) {
      bounds[side].min[c] = Math.min(bounds[side].min[c],p0[i*3+c]);
      bounds[side].max[c] = Math.max(bounds[side].max[c],p0[i*3+c]);
    }
  }
}
function deform(p, influences) {
  const result = p.slice();
  for (const side of ['Left','Right']) {
    const b = bounds[side], weight = influences[side];
    if (weight <= 0) continue;
    // Fade the modelling into the existing ankle rather than moving its cuff.
    const blend = weight * (1 - smooth(0.105, 0.165, p[1]));
    if (blend <= 0) continue;
    const cx = (b.min[0]+b.max[0])/2, cz = (b.min[2]+b.max[2])/2;
    const z = (p[2]-cz) / ((b.max[2]-b.min[2])/2);
    // A sneaker has a narrower heel and rounded toe, not a constant-width
    // plank. The low edge is inset, leaving a soft bevel under the midsole.
    const heel = smooth(0.20,1,-z), toe = smooth(0.28,1,z);
    const bevel = 1-smooth(b.min[1],b.min[1]+0.016,p[1]);
    const width = (0.98 - 0.22*heel - 0.16*toe) * (1-0.065*bevel);
    const length = 0.92 * (1-0.025*bevel);
    result[0] += blend * ((p[0]-cx)*(width-1));
    result[2] += blend * ((p[2]-cz)*(length-1));
  }
  // All vertical coordinates are exact, including the entire contact patch.
  return result;
}
function transformNormal(p, n, influences) {
  // Inverse transpose of the deformation Jacobian. Sampling this smooth map
  // retains artist normals across duplicate UV vertices (no normal rebuild).
  const columns = [];
  for (let c=0;c<3;c++) {
    const lo=p.slice(),hi=p.slice(),epsilon=1e-5;
    lo[c]-=epsilon;hi[c]+=epsilon;
    const a=deform(lo,influences),b=deform(hi,influences);
    columns.push(a.map((v,k)=>(b[k]-v)/(2*epsilon)));
  }
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const c0=cross(columns[1],columns[2]),c1=cross(columns[2],columns[0]),c2=cross(columns[0],columns[1]);
  const det=columns[0].reduce((sum,v,k)=>sum+v*c0[k],0);
  assert.ok(det>0.35, 'deformation remains orientation-preserving');
  const value=[0,1,2].map(k=>(c0[k]*n[0]+c1[k]*n[1]+c2[k]*n[2])/det);
  const length=Math.hypot(...value);
  assert.ok(length>0.01 && Number.isFinite(length));
  return value.map(v=>v/length);
}
const changed=[];
let maximumDisplacement=0;
for (let i=0;i<position.accessor.count;i++) {
  const p=Array.from(p0.subarray(i*3,i*3+3)), influences=shoeWeights[i];
  const next=deform(p,influences);
  if (next.every((v,c)=>v===p[c])) continue;
  const n=transformNormal(p,Array.from(n0.subarray(i*3,i*3+3)),influences);
  position.values.set(next,i*3);normal.values.set(n,i*3);changed.push(i);
  maximumDisplacement=Math.max(maximumDisplacement,Math.hypot(...next.map((v,c)=>v-p[c])));
  assert.equal(position.values[i*3+1],p0[i*3+1], 'ground height is exact');
}
for(const data of [position,normal]) {
  Buffer.from(data.values.buffer).copy(binary,data.start);
  if(data.accessor.min) data.accessor.min=[0,1,2].map(c=>{
    let min=Infinity;for(let i=c;i<data.values.length;i+=3)min=Math.min(min,data.values[i]);return min;
  });
  if(data.accessor.max) data.accessor.max=[0,1,2].map(c=>{
    let max=-Infinity;for(let i=c;i<data.values.length;i+=3)max=Math.max(max,data.values[i]);return max;
  });
}
// Verify all topology, UVs, skin weights, atlas bytes and animation payloads
// exactly, and all body vertices/normals outside the footwear exactly.
const allowedRanges=[position,normal].map(a=>[a.start,a.start+a.length]);
for(let i=0;i<binary.length;i++)if(!allowedRanges.some(([a,b])=>i>=a&&i<b))assert.equal(binary[i],originalBinary[i]);
const changedSet=new Set(changed);
for(let i=0;i<position.accessor.count;i++)if(!changedSet.has(i))for(let c=0;c<3;c++){
  assert.equal(position.values[i*3+c],p0[i*3+c]);assert.equal(normal.values[i*3+c],n0[i*3+c]);
}
const comparison=structuredClone(doc);
for(const index of [primitive.attributes.POSITION,primitive.attributes.NORMAL])comparison.accessors[index]=originalDoc.accessors[index];
assert.deepEqual(comparison,originalDoc);
const area=(values,a,b,c)=>{
  const u=[0,1,2].map(k=>values[b*3+k]-values[a*3+k]),v=[0,1,2].map(k=>values[c*3+k]-values[a*3+k]);
  return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
};
let minAreaRatio=Infinity,maxAreaRatio=0;
for(let i=0;i<indices.values.length;i+=3){
  const tri=Array.from(indices.values.subarray(i,i+3));
  if(!tri.some(v=>changedSet.has(v)))continue;
  const before=area(p0,...tri),after=area(position.values,...tri);
  if(before>1e-10){const ratio=after/before;assert.ok(ratio>0.25 && ratio<2,'no collapsed or stretched shoe triangles');minAreaRatio=Math.min(minAreaRatio,ratio);maxAreaRatio=Math.max(maxAreaRatio,ratio);}
}
let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,0x20)]);
const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+binary.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(binary.length,0);binHeader.writeUInt32LE(0x004e4942,4);
fs.writeFileSync(outputPath,Buffer.concat([header,json,binHeader,binary]));
function shoeBounds(values,side){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<position.accessor.count;i++)if(shoeWeights[i][side]>.5 && p0[i*3+1]<.06)for(let c=0;c<3;c++){
    min[c]=Math.min(min[c],values[i*3+c]);max[c]=Math.max(max[c],values[i*3+c]);
  }
  return {min,max,width:max[0]-min[0],length:max[2]-min[2]};
}
console.log(JSON.stringify({output:outputPath,vertices:position.accessor.count,triangles:indices.values.length/3,changedFootwearVertices:changed.length,
  maximumDisplacement,minAreaRatio,maxAreaRatio,animations:doc.animations.map(a=>a.name),
  left:{before:shoeBounds(p0,'Left'),after:shoeBounds(position.values,'Left')},
  right:{before:shoeBounds(p0,'Right'),after:shoeBounds(position.values,'Right')},
  preserved:'All non-footwear vertex bytes, sole heights, topology, UVs, weights, joints, atlas, nodes and all 15 animation payloads'},null,2));
