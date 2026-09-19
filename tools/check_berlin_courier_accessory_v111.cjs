'use strict';
// Reuse the existing actual-rig setup, then inspect the staged factory output.
const fs=require('fs'),path=require('path'),Module=require('module');
const fixture=fs.readFileSync(path.join(__dirname,'check_berlin_courier.cjs'),'utf8');
const cut=fixture.indexOf('const originalBones = ');
if(cut<0)throw Error('actual-rig setup anchor changed');
const checks=String.raw`
assert.equal(refine(mesh),true);
const stage=path.join(root,'audit/berlin-courier-v111');
const initial=fs.readFileSync(path.join(stage,'baseline/dressCourierHero.js'),'utf8');
const candidate=fs.readFileSync(path.join(stage,'dressCourierHero.js'),'utf8');
const marker='    var packGeometry = ',endMarker='    bag.scale.setScalar(0.74);';
assert.equal(candidate.slice(0,candidate.indexOf(marker)),initial.slice(0,initial.indexOf(marker)),'cap, rig bounds and attachment code exact');
assert.equal(candidate.slice(candidate.indexOf(endMarker)),initial.slice(initial.indexOf(endMarker)),'bag placement, scale and bind attachment exact');
const bagData=JSON.parse(fs.readFileSync(path.join(stage,'baseline/berlin-courier-bag-v1.json')));
context.atob=atob;
const decodeBerlinMeshRecord=vm.runInContext(fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8')+'\ndecodeBerlinMeshRecord;',context);
const mergeStart=html.indexOf('  function mergeBoxes(specs) {'),mergeEnd=html.indexOf('\n  // DRAW-CALL CONSOLIDATION:',mergeStart);
const mergeBoxes=new Function('THREE',html.slice(mergeStart,mergeEnd)+'\nreturn mergeBoxes;')(T);
const rbStart=html.indexOf('  function roundedBoxGeo('),rbEnd=html.indexOf('  // Generalised sibling',rbStart);
const rbFactory=new Function('THREE','q','cached','clamp',html.slice(rbStart,rbEnd)+'\nreturn roundedBoxGeo;');
const geometryCache=new Map();
const roundedBoxGeo=rbFactory(T,v=>Math.round(v*100)/100,(key,build)=>{if(!geometryCache.has(key))geometryCache.set(key,build());return geometryCache.get(key);},(x,a,b)=>Math.min(b,Math.max(a,x)));
const roundedBox=(w,h,d,r,material,x,y,z,bevel)=>{const m=new T.Mesh(roundedBoxGeo(w,h,d,r,bevel),material);m.position.set(x||0,y||0,z||0);return m;};
const material=(color,rough,rim)=>{const m=new T.MeshStandardMaterial({color,roughness:rough});m.userData.rim=rim;return m;};
const build=source=>new Function('THREE','heroTrimMat','roundedBox','mergeBoxes','BERLIN_COURIER_BAG_DATA','decodeBerlinMeshRecord',source+'\nreturn dressCourierHero;')(T,material,roundedBox,mergeBoxes,bagData,decodeBerlinMeshRecord);
function dress(source){const f=build(source);f(mesh);const cap=skeleton.bones.find(b=>b.name==='Head').children.filter(o=>o.name==='Courier cap').at(-1),bag=skeleton.bones.find(b=>b.name==='Spine02').children.filter(o=>o.name==='Courier sling bag').at(-1);return {f,cap,bag};}
const beforeDress=dress(initial),afterDress=dress(candidate);
assert.equal(afterDress.cap.children.length+afterDress.bag.children.length,7,'exactly seven accessory material draws');
assert.equal(afterDress.bag.children.length,3,'canvas, trim and leather remain three batches');
assert.deepEqual(afterDress.bag.matrix.elements,beforeDress.bag.matrix.elements,'exact rig attachment matrix');
assert.deepEqual(afterDress.bag.scale.toArray(),beforeDress.bag.scale.toArray());
assert.equal(afterDress.bag.parent,beforeDress.bag.parent,'unchanged Spine02 parent');
for(let i=0;i<afterDress.cap.children.length;i++){
  const a=afterDress.cap.children[i],b=beforeDress.cap.children[i];
  assert.equal(a.material.color.getHex(),b.material.color.getHex(),'cap material unchanged');
  for(const name of Object.keys(a.geometry.attributes))assert.deepEqual(Array.from(a.geometry.attributes[name].array),Array.from(b.geometry.attributes[name].array),'cap attributes unchanged');
}
const canvasOf=o=>o.bag.children.find(c=>c.material.map),beforeCanvas=canvasOf(beforeDress),afterCanvas=canvasOf(afterDress);
assert.equal(afterCanvas.material.color.getHex(),0x2d7376);assert.equal(afterCanvas.material.roughness,.91);
for(const name of Object.keys(afterCanvas.geometry.attributes))assert.deepEqual(Array.from(afterCanvas.geometry.attributes[name].array),Array.from(beforeCanvas.geometry.attributes[name].array),'all canvas geometry, normals, UV and contact coverage exact');
assert.equal(afterCanvas.geometry.attributes.position.count,2588*3);
const triangles=o=>o.bag.children.reduce((s,m)=>s+(m.geometry.index?.count||m.geometry.attributes.position.count)/3,0);
assert.ok(triangles(afterDress)-triangles(beforeDress)<=180,'at most one lightweight seam added');
const bounds=o=>new T.Box3().setFromObject(o);
mesh.updateMatrixWorld(true);nodes.filter(n=>!n.parent).forEach(n=>n.updateMatrixWorld(true));
const bb=bounds(beforeDress.bag),ab=bounds(afterDress.bag);
assert.ok(ab.min.distanceTo(bb.min)<1e-7&&ab.max.distanceTo(bb.max)<1e-7,'same total bag envelope');
const leather=afterDress.bag.children.find(m=>m.material.color.getHex()===0xb68b57);
const beforeLeather=beforeDress.bag.children.find(m=>m.material.color.getHex()===0xe7cfaa);
leather.geometry.computeBoundingBox();beforeLeather.geometry.computeBoundingBox();
const lc=leather.geometry.boundingBox.getCenter(new T.Vector3()),oldLc=beforeLeather.geometry.boundingBox.getCenter(new T.Vector3());
assert.ok(lc.x<0&&oldLc.x>0&&lc.y<oldLc.y,'leather closure moved to rear-view right and down');
const probeMeshes=afterDress.bag.children.map(m=>{const clone=new T.Mesh(m.geometry,m.material);clone.updateMatrixWorld(true);return clone;});
const hardwareVisibility=[];
for(const dy of [-.022,0,.022]){
  const ray=new T.Raycaster(new T.Vector3(lc.x,lc.y+dy,-2),new T.Vector3(0,0,1));
  const hits=ray.intersectObjects(probeMeshes,false);assert.ok(hits.length,'closure ray hits the actual geometry');
  const hitColor=hits[0].object.material.color.getHex();
  assert.ok(hitColor===0xb68b57||hitColor===0x244e54,'leather tongue and clasp sit visibly in front of the canvas');
  hardwareVisibility.push({dy,hitColor});
}
const preview=o=>o.bag.children.map(m=>({color:m.material.color.toArray(),roughness:m.material.roughness,textured:!!m.material.map,position:Array.from(m.geometry.attributes.position.array),normal:Array.from(m.geometry.attributes.normal.array),uv:Array.from(m.geometry.attributes.uv.array),index:m.geometry.index?Array.from(m.geometry.index.array):null}));
fs.writeFileSync(path.join(stage,'preview-geometry.json'),JSON.stringify({before:preview(beforeDress),candidate:preview(afterDress)}));
const verifyExport=!process.argv.includes('--prepare-preview');
if(verifyExport){
const readGlb=where=>{const bytes=fs.readFileSync(path.join(stage,where,'berlin-courier-bag-v1.glb')),size=bytes.readUInt32LE(12);return {json:JSON.parse(bytes.subarray(20,20+size)),binary:bytes.subarray(28+size)};};
const baseGlb=readGlb('baseline'),stageGlb=readGlb('models');
assert.deepEqual(stageGlb.binary,baseGlb.binary,'GLB geometry, normals, UV, indices and embedded image binary exact');
assert.deepEqual({...stageGlb.json,materials:undefined},{...baseGlb.json,materials:undefined},'all non-material GLB document fields exact');
const stagedPbr=stageGlb.json.materials[0].pbrMetallicRoughness;
assert.ok(stagedPbr.baseColorFactor.every((v,i)=>Math.abs(v-[...afterCanvas.material.color.toArray(),1][i])<1e-9),'GLB tint matches runtime (Three approximates the sRGB conversion constant)');
assert.equal(stagedPbr.roughnessFactor,afterCanvas.material.roughness);
assert.deepEqual(stagedPbr.baseColorTexture,baseGlb.json.materials[0].pbrMetallicRoughness.baseColorTexture,'exact V104 contact texture reference');
for(const ext of ['json','inline.js'])assert.deepEqual(fs.readFileSync(path.join(stage,'models/berlin-courier-bag-v1.'+ext)),fs.readFileSync(path.join(stage,'baseline/berlin-courier-bag-v1.'+ext)),'runtime asset bytes exact');
assert.deepEqual(fs.readFileSync(path.join(stage,'models/berlin-courier-bag-contact-v104.png')),Buffer.from(bagData.atlas.data,'base64'),'contact atlas bytes exact');
}
const report={draws:7,bagDraws:3,beforeBagTriangles:triangles(beforeDress),candidateBagTriangles:triangles(afterDress),addedTriangles:triangles(afterDress)-triangles(beforeDress),shellTriangles:2588,geometryAndUVExact:true,rigAttachmentExact:true,capExact:true,bagEnvelopeExact:true,glbBinaryExact:verifyExport,glbRuntimeMaterialExact:verifyExport,hardwareVisibility,leatherBefore:oldLc.toArray(),leatherCandidate:lc.toArray()};
fs.writeFileSync(path.join(stage,'runtime-validation.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS actual rig:',JSON.stringify(report));
`;
const source=fixture.slice(0,cut)+checks;
const mod=new Module(__filename,module);mod.filename=__filename;mod.paths=module.paths;mod._compile(source,__filename);
