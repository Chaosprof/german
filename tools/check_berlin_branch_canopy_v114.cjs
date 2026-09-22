'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-model-forms-v114/garden/branch-canopy'),name='berlin-kiez-garden-v1';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),shipping=process.argv.includes('--shipping');
const before=read(path.join(stage,'baseline',name+'.json')),data=read(path.join(stage,'models',name+'.json'));
const planter=read(path.join(root,'audit/berlin-model-forms-v114/garden/planter-sprays/models',name+'.json'));
for(const key of ['tree','leaves','trunk'])assert.deepEqual(data.meshes[key],before.meshes[key]);
for(const key of ['atlas','material','streetCanopyRadius'])assert.deepEqual(data[key],before[key]);
assert.deepEqual(data.meshes.planter,planter.meshes.planter);assert.equal(data.planterRevision,planter.planterRevision);
assert.equal(data.canopyRevision,'branch-led-lobed-crown-v114');
const unpack=r=>Object.fromEntries([['position',4,'readFloatLE'],['normal',2,'readInt16LE'],['color',1,'readUInt8'],['uv',4,'readFloatLE'],['index',2,'readUInt16LE']].map(([key,size,fn])=>{const b=Buffer.from(r[key],'base64');return[key,Array.from({length:b.length/size},(_,i)=>b[fn](i*size))];}));
const sub=(a,b)=>a.map((x,k)=>x-b[k]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
const reports={};
for(const role of ['treeNear','treeStreetFar']){
  const r=data.meshes[role],m=unpack(r);assert.ok(r.triangles<=(role==='treeNear'?25000:7000));
  assert.equal(m.index.length,r.triangles*3);assert.equal(m.position.length,r.vertices*3);assert.ok(m.index.every(i=>i<r.vertices));
  let radius=0,minFacing=Infinity;
  for(let i=0;i<r.vertices;i++){
    const p=m.position.slice(i*3,i*3+3),n=m.normal.slice(i*3,i*3+3);assert.ok(p.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...n)/32767-1)<.0001,role+' vertex '+i+' normal '+n);radius=Math.max(radius,Math.hypot(p[0],p[2]));
  }
  assert.ok(radius<data.streetCanopyRadius);
  for(let axis=0;axis<3;axis++){const a=m.position.filter((_,i)=>i%3===axis);assert.ok(Math.abs(Math.min(...a)-r.min[axis])<.00001&&Math.abs(Math.max(...a)-r.max[axis])<.00001);}
  for(let f=552;f<r.triangles;f++){
    const ids=m.index.slice(f*3,f*3+3),p=ids.map(i=>m.position.slice(i*3,i*3+3));
    const normal=cross(sub(p[1],p[0]),sub(p[2],p[0])),area=Math.hypot(...normal);assert.ok(area>1e-9,'non-degenerate tree face');
    const shade=[0,1,2].map(k=>ids.reduce((s,i)=>s+m.normal[i*3+k]/32767,0));
    const facing=dot(normal,shade)/(area*Math.hypot(...shade));minFacing=Math.min(minFacing,facing);assert.ok(facing>-.001,'authored normal follows visible surface '+JSON.stringify({role,f,facing,p}));
  }
  reports[role]={triangles:r.triangles,vertices:r.vertices,radius,minFacing};
}
assert.ok(data.meshes.treeStreetFar.triangles<data.meshes.treeNear.triangles*.42);
const near=unpack(data.meshes.treeNear),far=unpack(data.meshes.treeStreetFar),originalNear=unpack(before.meshes.treeNear);
// The accepted trunk is the first 552 faces in both new runtime roles.
for(let i=0;i<552*3;i++)for(const [attr,stride]of [['position',3],['normal',3],['color',3],['uv',2]])assert.deepEqual(near[attr].slice(near.index[i]*stride,near.index[i]*stride+stride),far[attr].slice(far.index[i]*stride,far.index[i]*stride+stride));
for(let i=0;i<552*3;i++)for(const [attr,stride]of [['position',3],['normal',3],['color',3],['uv',2]])assert.deepEqual(near[attr].slice(near.index[i]*stride,near.index[i]*stride+stride),originalNear[attr].slice(originalNear.index[i]*stride,originalNear.index[i]*stride+stride),'accepted original trunk '+attr);
function glb(file){const b=fs.readFileSync(file),n=b.readUInt32LE(12);return{doc:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)};}
const a=glb(path.join(stage,'baseline',name+'.glb')),b=glb(path.join(stage,'models',name+'.glb'));
for(const key of ['nodes','materials','textures','images','scenes'])assert.deepEqual(b.doc[key],a.doc[key]);
const changed=new Set();let checkedCorners=0;
function accessor(id){const x=b.doc.accessors[id],v=b.doc.bufferViews[x.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[x.type],size={5121:1,5123:2,5126:4}[x.componentType],fn={5121:'readUInt8',5123:'readUInt16LE',5126:'readFloatLE'}[x.componentType];return Array.from({length:x.count*n},(_,i)=>b.bin[fn]((v.byteOffset||0)+(x.byteOffset||0)+Math.floor(i/n)*(v.byteStride||size*n)+(i%n)*size));}
for(const [meshName,record,faceOffset]of [['Kiez_Tree_Leaves_Street',data.meshes.treeNear,552],['Kiez_Flower_Planter',data.meshes.planter,0]]){
  const p=b.doc.meshes.find(m=>m.name===meshName).primitives[0],m=unpack(record),indices=accessor(p.indices);
  for(const id of [...Object.values(p.attributes),p.indices])changed.add(b.doc.accessors[id].bufferView);
  assert.equal(indices.length,(record.triangles-faceOffset)*3);
  for(const [key,semantic,stride]of [['position','POSITION',3],['normal','NORMAL',3],['uv','TEXCOORD_0',2]]){
    const values=accessor(p.attributes[semantic]);
    for(let i=0;i<indices.length;i++)for(let k=0;k<stride;k++)assert.ok(Math.abs(values[indices[i]*stride+k]-m[key][m.index[i+faceOffset*3]*stride+k]/(key==='normal'?32767:1))<.000001,'GLB '+meshName+' '+key+' agrees with runtime');
  }
  const paint=accessor(p.attributes.COLOR_0),paintType=b.doc.accessors[p.attributes.COLOR_0].componentType,paintScale=paintType===5123?257:1;
  for(let i=0;i<indices.length;i++)for(let k=0;k<3;k++)assert.equal(paint[indices[i]*4+k]/paintScale,m.color[m.index[i+faceOffset*3]*3+k],'GLB painted colors agree with runtime');
  checkedCorners+=indices.length;
}
let protectedViews=0;
for(let i=0;i<a.doc.bufferViews.length;i++)if(!changed.has(i)){const x=a.doc.bufferViews[i],y=b.doc.bufferViews[i];assert.deepEqual(b.bin.subarray(y.byteOffset||0,(y.byteOffset||0)+y.byteLength),a.bin.subarray(x.byteOffset||0,(x.byteOffset||0)+x.byteLength));protectedViews++;}
if(shipping){
  for(const suffix of ['.json','.inline.js','.glb','.blend','-atlas.jpg'])assert.deepEqual(fs.readFileSync(path.join(root,'assets/models',name+suffix)),fs.readFileSync(path.join(stage,'models',name+suffix)));
  const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8'),match=html.match(/var BERLIN_KIEZ_GARDEN_DATA\s*=\s*(\{[^\r\n]*\});/);assert.ok(match);assert.deepEqual(JSON.parse(match[1]),data);
  assert.equal((html.match(/\bfunction decodeBerlinMeshRecord\s*\(/g)||[]).length,1);
}
console.log(JSON.stringify({passed:true,shipping,...reports,checkedCorners,protectedViews,acceptedPlanterExact:true,extraMaterials:0,extraDraws:0},null,2));
