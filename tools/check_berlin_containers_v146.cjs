'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v146'),prefix='berlin-street-containers-v146';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const candidate=fs.readFileSync(path.join(stage,'candidate.html'),'utf8'),baseline=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
const edits=JSON.parse(fs.readFileSync(path.join(stage,'source-edits.json')));
let restored=candidate;for(const [before,after]of [...edits].reverse()){
  assert.equal(restored.split(after).length,2);restored=restored.replace(after,before);
}assert.equal(restored,baseline,'all non-container source is byte identical');
assert.equal(sha(baseline),'cd96a16ec90c5e2f2b2492a98a9b9080e6cea3000a3b61c3a111c404de4b9f36');
const scripts=[...candidate.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());
scripts.forEach(s=>new vm.Script(s));
const scope=vm.createContext({console});vm.runInContext(scripts.find(s=>s.includes('three.js r156 (MIT)')),scope);const T=scope.THREE;
scope.atob=atob;vm.runInContext(fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8'),scope);
const decode=scope.decodeBerlinMeshRecord;
const records=JSON.parse(fs.readFileSync(path.join(stage,'models',prefix+'.json')));
assert.ok(candidate.includes(fs.readFileSync(path.join(stage,'models',prefix+'.inline.js'),'utf8').trimEnd()));
const native=JSON.parse(fs.readFileSync(path.join(stage,'native-check.json')));assert.equal(native.passed,true);
const glb=fs.readFileSync(path.join(stage,'models',prefix+'.glb'));assert.equal(sha(glb),native.glbSha256);
assert.equal(glb.readUInt32LE(0),0x46546c67);assert.equal(glb.readUInt32LE(8),glb.length);
const jsonLength=glb.readUInt32LE(12),doc=JSON.parse(glb.subarray(20,20+jsonLength)),bin=glb.subarray(28+jsonLength);
const view=i=>{const v=doc.bufferViews[i];return bin.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);};
const accessor=i=>{const a=doc.accessors[i];assert.ok(!a.byteOffset);return view(a.bufferView);};
assert.deepEqual(view(doc.images[0].bufferView),fs.readFileSync(path.join(root,'assets/models/berlin-kiez-garden-v1-atlas.jpg')));
assert.equal(doc.materials.length,1);assert.equal(doc.materials[0].pbrMetallicRoughness.metallicFactor,0);
const meshes={},report={};
for(const [role,record]of Object.entries(records.meshes)){
 const geometry=decode(T,record),p=geometry.attributes.position,n=geometry.attributes.normal,c=geometry.attributes.color,u=geometry.attributes.uv;
 meshes[role]=geometry;assert.equal(p.count,record.vertices);assert.equal(geometry.index.count,record.triangles*3);
 const welded=new Map(),ids=[],edges=new Map();let minArea=Infinity,minNormalDot=Infinity,volume=0;
 for(let i=0;i<p.count;i++){
  const v=new T.Vector3().fromBufferAttribute(p,i),normal=new T.Vector3().fromBufferAttribute(n,i);
  assert.ok(v.toArray().every(Number.isFinite));assert.ok(Math.abs(normal.length()-1)<.00005);
  assert.equal(u.getX(i),.015625);assert.equal(u.getY(i),.015625);
  assert.ok(c.getY(i)-c.getX(i)<.005,'stone/soil cannot enter the existing leaf lighting branch');
  const key=v.toArray().map(x=>Math.round(x*1e6)).join(',');if(!welded.has(key))welded.set(key,welded.size);ids.push(welded.get(key));
 }
 const a=new T.Vector3(),b=new T.Vector3(),cc=new T.Vector3();
 for(let i=0;i<geometry.index.count;i+=3){
  const indices=[0,1,2].map(k=>geometry.index.getX(i+k));
  a.fromBufferAttribute(p,indices[0]);b.fromBufferAttribute(p,indices[1]);cc.fromBufferAttribute(p,indices[2]);
  const cross=b.clone().sub(a).cross(cc.clone().sub(a));minArea=Math.min(minArea,cross.length()/2);assert.ok(cross.length()>1e-10);
  volume+=a.dot(b.clone().cross(cc))/6;
  const average=new T.Vector3();indices.forEach(j=>average.add(new T.Vector3().fromBufferAttribute(n,j)));
  minNormalDot=Math.min(minNormalDot,cross.clone().normalize().dot(average.normalize()));
  for(let k=0;k<3;k++){
   const from=ids[indices[k]],to=ids[indices[(k+1)%3]],key=[Math.min(from,to),Math.max(from,to)].join(':');
   const edge=edges.get(key)||{count:0,direction:0};edge.count++;edge.direction+=from<to?1:-1;edges.set(key,edge);
  }
 }
 assert.ok(volume>0);assert.ok(minNormalDot>0,'shading normals follow outward triangles');
 assert.ok([...edges.values()].every(e=>e.count===2&&e.direction===0),'welded surface is closed and consistently wound');
 assert.ok(geometry.boundingBox.min.x>=-.921&&geometry.boundingBox.max.x<=.921&&geometry.boundingBox.max.y<=1.195);
 const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial()),ray=new T.Raycaster(new T.Vector3(0,2,0),new T.Vector3(0,-1,0));mesh.updateMatrixWorld();
 const soilHit=ray.intersectObject(mesh)[0];assert.ok(soilHit);const soilY=role==='treeUrn'?.942:.1;
 assert.ok(Math.abs(soilHit.point.y-soilY)<1e-5,'soil cap is visibly below the rim');
 const primitive=doc.meshes.find(m=>m.name===role).primitives[0];
 for(const [key,semantic]of [['position','POSITION'],['uv','TEXCOORD_0']])assert.deepEqual(accessor(primitive.attributes[semantic]),Buffer.from(record[key],'base64'));
 assert.deepEqual(accessor(primitive.indices),Buffer.from(record.index,'base64'));
 const normals=accessor(primitive.attributes.NORMAL),colors=accessor(primitive.attributes.COLOR_0);
 for(let i=0;i<n.array.length;i++)assert.equal(normals.readFloatLE(i*4),Math.fround(n.array[i]/32767));
 for(let i=0;i<c.count;i++){for(let k=0;k<3;k++)assert.equal(colors[i*4+k],c.array[i*3+k]);assert.equal(colors[i*4+3],255);}
 report[role]={vertices:p.count,triangles:record.triangles,weldedVertices:welded.size,closedEdges:edges.size,volume,minArea,minNormalDot,
  soilY:soilHit.point.y,bounds:{min:geometry.boundingBox.min.toArray(),max:geometry.boundingBox.max.toArray()}};
}
const previous=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-parity-v145/shipping.json'))),protectedFiles={...previous.protectedFiles};
for(const [name,hash]of Object.entries(previous.changedAssets))protectedFiles['assets/models/'+name]=hash;
for(const [file,hash]of Object.entries(protectedFiles))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);
const addedAssets={};for(const ext of ['blend','glb','json','inline.js']){const name=prefix+'.'+ext;addedAssets[name]=sha(fs.readFileSync(path.join(stage,'models',name)));}
const result={passed:true,candidateSha256:sha(candidate),pageBytes:Buffer.byteLength(candidate),addedPageBytes:Buffer.byteLength(candidate)-Buffer.byteLength(baseline),sourceEditCount:edits.length,
 parsedScripts:scripts.length,roles:report,oldTrianglesPerSevenBases:7*216,newTrianglesPerSevenBases:records.meshes.treeUrn.triangles+6*records.meshes.treePit.triangles,
 sharedOriginalAtlas:true,protectedFiles,addedAssets};
fs.writeFileSync(path.join(stage,'source-check.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,protectedFiles:Object.keys(protectedFiles).length,addedAssets:Object.keys(addedAssets)},null,2));
