'use strict';
// Stage only. Installation is a separate exact-snippet recipe for the parent.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-courier-cloth-v97');
const output=path.join(stage,'packed'),baseDir=path.join(output,'baseline');
fs.mkdirSync(baseDir,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
function glb(file){
  const raw=fs.readFileSync(file),length=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+length)),bin=raw.subarray(28+length);
  const primitive=doc.meshes[0].primitives[0];
  function attribute(name){const a=doc.accessors[primitive.attributes[name]],v=doc.bufferViews[a.bufferView];assert.equal(v.byteStride,undefined);
    const start=(v.byteOffset||0)+(a.byteOffset||0);return new Float32Array(Uint8Array.from(bin.subarray(start,start+a.count*12)).buffer);}
  return {raw,doc,bin,position:attribute('POSITION'),normal:attribute('NORMAL')};
}
const accepted=glb(path.join(stage,'models/courier-accepted-render-copy.glb'));
const target=glb(path.join(stage,'models/courier-cloth-render-copy-v97.glb'));
const validation=JSON.parse(fs.readFileSync(path.join(stage,'validation.json')));
assert.equal(validation.newlyReversedArtistFaces,0);assert.equal(validation.protectedPositionsAndNormalsExact,true);
const ids=[];for(let v=0;v<accepted.position.length/3;v++){
  if(['position','normal'].some(name=>!bytes(accepted[name]).subarray(v*12,v*12+12).equals(bytes(target[name]).subarray(v*12,v*12+12))))ids.push(v);
}
assert.equal(ids.length,validation.changedVertices);
const valuesOffset=(ids.length*2+3)&~3,payload=Buffer.alloc(valuesOffset+ids.length*24);
ids.forEach((v,i)=>{payload.writeUInt16LE(v,i*2);bytes(target.position).copy(payload,valuesOffset+i*24,v*12,v*12+12);bytes(target.normal).copy(payload,valuesOffset+i*24+12,v*12,v*12+12);});
const probeIds=new Set(Array.from({length:48},(_,i)=>Math.floor(i*(accepted.position.length/3-1)/47)));
for(let k=0;k<3;k++)for(const direction of [-1,1]){let best=0;for(let v=1;v<accepted.position.length/3;v++)if(accepted.position[v*3+k]*direction>accepted.position[best*3+k]*direction)best=v;probeIds.add(best);}
const baseProbes=[...probeIds].sort((a,b)=>a-b).flatMap(v=>[v,...accepted.position.slice(v*3,v*3+3),...accepted.normal.slice(v*3,v*3+3)]);
const patch={version:97,vertices:validation.vertices,triangles:validation.triangles,count:ids.length,
  baseProbes,accessoryBounds:{min:validation.cloth.accessoryTorsoMin,max:validation.cloth.accessoryTorsoMax},data:payload.toString('base64')};
fs.writeFileSync(path.join(output,'courier-cloth-patch-v97.bin'),payload);
fs.writeFileSync(path.join(output,'courier-cloth-patch-v97.json'),JSON.stringify(patch));
const applier=fs.readFileSync(path.join(__dirname,'berlin_courier_cloth_patch_v97.js'),'utf8');
const scope='  // BEGIN COURIER_CLOTH_PATCH_V97\n  var BERLIN_COURIER_CLOTH_PATCH_V97 = '+JSON.stringify(patch)+';\n'+applier+'\n  // END COURIER_CLOTH_PATCH_V97\n';
fs.writeFileSync(path.join(output,'courier-cloth-packed-scope-v97.js'),scope);
const original=fs.readFileSync(path.join(stage,'baseline/refineCourierSilhouette.js'),'utf8');
const marker='    geo.computeBoundingBox(); geo.computeBoundingSphere();';
assert.equal(original.split(marker).length,2);
const refineSource=original.replace(marker,'    applyBerlinCourierClothPatchV97(geo);\n'+marker);
fs.writeFileSync(path.join(output,'refineCourierSilhouette-packed-v97.js'),refineSource);
const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
const begin=html.indexOf('  function refineCourierSilhouette(mesh) {'),end=html.indexOf('\n  // Both arms share',begin);
assert.ok(begin>0&&end>begin);
const artisticSource=fs.readFileSync(path.join(stage,'refineCourierSilhouette-v97.js'),'utf8');
assert.equal(html.slice(begin,end).replace(/\r/g,'').trim(),artisticSource.replace(/\r/g,'').trim(),'pack only the accepted, installed corrected sculpt');
const virtualHtml=html.slice(0,begin)+scope+'\n'+refineSource+html.slice(end);
const checkerPath=path.join(root,'tools/check_berlin_courier.cjs');
const checker=fs.readFileSync(checkerPath,'utf8');
const replacements=[
  {before:"const refine = new Function('THREE', html.slice(refineStart, refineEnd) + '\\nreturn refineCourierSilhouette;')(T);",
   after:"const clothScopeStart=html.indexOf('  // BEGIN COURIER_CLOTH_PATCH_V97');\nconst clothScopeEnd=html.indexOf('  // END COURIER_CLOTH_PATCH_V97',clothScopeStart);\nconst clothScope=clothScopeStart<0?'':html.slice(clothScopeStart,clothScopeEnd);\nconst makeRefine=source=>new Function('THREE','atob',clothScope+'\\n'+source+'\\nreturn refineCourierSilhouette;')(T,atob);\nconst refine=makeRefine(html.slice(refineStart,refineEnd));"},
  {before:"assert.equal(refine(mesh), true);",after:"assert.equal(refine(mesh), true);\nif(clothScope)assert.equal(mesh.geometry.userData.courierClothV97?.baked,true,'actual v14 applies the packed accepted cloth');"},
  {before:"new Function('THREE',previousRefineSource+'return refineCourierSilhouette;')(T)(previousMesh);",
   after:"makeRefine(previousRefineSource)(previousMesh);\nif(clothScope)assert.notEqual(previousMesh.geometry.userData.courierClothV97?.baked,true,'former head/trouser variant retains its own refinement');"},
  {before:"new Function('THREE',html.slice(refineStart,refineEnd).replace('uniform = 1.10','uniform = 1.20')+\n  '\\nreturn refineCourierSilhouette;')(T)(formerHeadMesh);",
   after:"makeRefine(html.slice(refineStart,refineEnd).replace('uniform = 1.10','uniform = 1.20'))(formerHeadMesh);\nif(clothScope)assert.notEqual(formerHeadMesh.geometry.userData.courierClothV97?.baked,true,'former head variant skips the absolute cloth patch');"}
];
let stagedChecker=checker;
for(const r of replacements){assert.equal(stagedChecker.split(r.before).length,2,'one checker anchor');stagedChecker=stagedChecker.replace(r.before,r.after);}
fs.writeFileSync(path.join(output,'check_berlin_courier.cjs'),stagedChecker);
fs.writeFileSync(path.join(output,'checker-patch.json'),JSON.stringify(replacements,null,2));
for(const [name,data]of [['refineCourierSilhouette.js',html.slice(begin,end)],['check_berlin_courier.cjs',checker]]){
  const file=path.join(baseDir,name);if(!fs.existsSync(file))fs.writeFileSync(file,data);else assert.equal(fs.readFileSync(file,'utf8'),data,'immutable packed baseline');
}
// Reuse the existing courier fixture; do not rerun the expensive artistic sculpt.
const fixturePrefix=checker.slice(0,checker.indexOf('const before = Buffer'));
const {T,geometry,skeleton,mesh}=new Function('require','__dirname',fixturePrefix+'\nreturn {T,geometry,skeleton,mesh};')(require,__dirname);
const sourceAttributes={};for(const [name,a]of Object.entries(geometry.attributes))sourceAttributes[name]=Buffer.from(bytes(a.array));
const sourceIndices=Buffer.from(bytes(geometry.index.array));
const makeRefine=source=>new Function('THREE','atob',scope+'\n'+source+'\nreturn refineCourierSilhouette;')(T,atob);
const applyRefine=makeRefine(refineSource),t0=performance.now();applyRefine(mesh);const fullRefineMs=performance.now()-t0;
assert.equal(mesh.geometry.userData.courierClothV97.baked,true);
for(const name of ['position','normal'])assert.deepEqual(bytes(mesh.geometry.attributes[name].array),bytes(target[name]),'baked '+name+' equals the accepted corrected target exactly');
assert.equal(JSON.stringify(mesh.geometry.userData.courierAccessoryBounds),JSON.stringify(patch.accessoryBounds));
for(const [name,a]of Object.entries(geometry.attributes))assert.deepEqual(bytes(a.array),sourceAttributes[name],'source '+name+' stays exact');
assert.deepEqual(bytes(geometry.index.array),sourceIndices);assert.deepEqual(bytes(mesh.geometry.index.array),sourceIndices);
for(const name of ['uv','skinIndex','skinWeight'])assert.deepEqual(bytes(mesh.geometry.attributes[name].array),sourceAttributes[name]);
const acceptedMesh=new T.SkinnedMesh(geometry,mesh.material);acceptedMesh.bind(skeleton,new T.Matrix4());
new Function('THREE',original+'\nreturn refineCourierSilhouette;')(T)(acceptedMesh);
for(const name of ['aCourierSleeve','aCourierSole','aCourierGarment'])assert.deepEqual(bytes(mesh.geometry.attributes[name].array),bytes(acceptedMesh.geometry.attributes[name].array));
const applyOnly=new Function('atob',scope+'\nreturn applyBerlinCourierClothPatchV97;')(atob);
const applyGeo=acceptedMesh.geometry.clone(),a0=performance.now();assert.equal(applyOnly(applyGeo),true);const decodeAndApplyMs=performance.now()-a0;
const warmGeo=acceptedMesh.geometry.clone(),w0=performance.now();assert.equal(applyOnly(warmGeo),true);const cachedApplyMs=performance.now()-w0;
for(const name of ['position','normal'])assert.deepEqual(bytes(applyGeo.attributes[name].array),bytes(target[name]));
const incompatible=acceptedMesh.geometry.clone();incompatible.attributes.position.setX(baseProbes[0],baseProbes[1]+.001);
const skipP=Buffer.from(bytes(incompatible.attributes.position.array)),skipN=Buffer.from(bytes(incompatible.attributes.normal.array));
assert.equal(applyOnly(incompatible),false);assert.deepEqual(bytes(incompatible.attributes.position.array),skipP);assert.deepEqual(bytes(incompatible.attributes.normal.array),skipN);assert.equal(incompatible.userData.courierClothV97,undefined);
// Exercise the same canonical checker source with only its required scope edits,
// reading a virtual staged HTML. No canonical file is written by this tool.
const testFs=Object.create(fs);testFs.readFileSync=(file,...args)=>path.resolve(file)===path.join(root,'berlin-runner.html')?virtualHtml:fs.readFileSync(file,...args);
new Function('require','__dirname',stagedChecker)(name=>name==='fs'?testFs:require(name),__dirname);
const report={acceptedCorrectedTargetSha256:sha(target.raw),payloadSha256:sha(payload),payloadBytes:payload.length,
  inlineScopeBytes:Buffer.byteLength(scope),changedVertices:ids.length,baseProbeVertices:probeIds.size,
  exactTargetPositionsAndNormals:true,sourceAttributesAndIndicesExact:true,sourceRigAnimationUVAndMaterialsUntouched:true,
  protectedVerticesExactByTargetEquality:true,accessoryBoundsExact:true,shaderAttributesExact:true,
  actualPatchMarker:true,incompatibleBaseSkipsWithoutMutation:true,existingCourierCheckerPasses:true,
  fullRefineMs,decodeAndApplyMs,cachedApplyMs,priorSculptRefineMs:validation.oneTimeRefinementMs,
  poseRevalidation:'Not repeated: target Float32 positions/normals match the already checked 135-pose corrected surface byte for byte.'};
fs.writeFileSync(path.join(output,'validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
