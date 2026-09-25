'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {loadCourierSurface}=require('./load_berlin_courier_surface.cjs'),{sculptCourierSurfaceV145}=require('./berlin_courier_surface_v145.js');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v145'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const f of ['','baseline','models','frames','benchmark'])fs.mkdirSync(path.join(stage,f),{recursive:true});
const pagePath=path.join(root,'berlin-runner.html'),baseline=path.join(stage,'baseline.html');
if(!fs.existsSync(baseline)){
  const page=fs.readFileSync(pagePath);assert.equal(sha(page),'af088367ffc06b4b5761857e5a7d8c2a7cd1609c4aa0503a9080195c357f30ab');fs.writeFileSync(baseline,page);
  for(const ext of ['.bin','.json','.inline.js','.blend'])fs.copyFileSync(path.join(root,'assets/models/berlin-courier-forms-v114'+ext),path.join(stage,'baseline/berlin-courier-forms-v114'+ext));
}
const s=loadCourierSurface(path.relative(root,baseline)),{T,accepted:before,base,geometry:original,skeleton,joints,glb}=s;
const pinsPath=path.join(stage,'pose-pins.json'),posePins=fs.existsSync(pinsPath)?JSON.parse(fs.readFileSync(pinsPath)):[];
const after=before.clone();after.userData=JSON.parse(JSON.stringify(before.userData));const sculpt=sculptCourierSurfaceV145(T,after,original,skeleton,joints,posePins);
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength),vec=(g,i,name='position')=>new T.Vector3().fromBufferAttribute(g.attributes[name],i);
for(const key of Object.keys(before.attributes))if(!['position','normal'].includes(key))assert.deepEqual(bytes(after.attributes[key].array),bytes(before.attributes[key].array));assert.deepEqual(bytes(after.index.array),bytes(before.index.array));
const ids=[],changedPositions=[],changedNormals=[],contacts=[],protectedIds=[];let maxMove=0,maxNormalAngle=0;
const names=skeleton.bones.map(b=>b.name),si=original.attributes.skinIndex,sw=original.attributes.skinWeight;
for(let i=0;i<before.attributes.position.count;i++){
  let foot=0,hand=0,leg=0;for(let k=0;k<4;k++){const name=names[si.getComponent(i,k)],w=sw.getComponent(i,k);if(/^(Left|Right)(Foot|ToeBase)$/.test(name))foot+=w;if(/^(Left|Right)Hand$/.test(name))hand+=w;if(/^(Left|Right)Leg$/.test(name))leg+=w;}
  const distance=vec(after,i).distanceTo(vec(before,i));maxMove=Math.max(maxMove,distance);assert.ok(distance<=.015001&&Number.isFinite(distance));
  assert.ok(Math.abs(vec(after,i,'normal').length()-1)<1e-5);
  if(distance>0)changedPositions.push(i);else protectedIds.push(i);
  if(!bytes(after.attributes.normal.array).subarray(i*12,i*12+12).equals(bytes(before.attributes.normal.array).subarray(i*12,i*12+12)))changedNormals.push(i);
  maxNormalAngle=Math.max(maxNormalAngle,Math.acos(Math.max(-1,Math.min(1,vec(before,i,'normal').dot(vec(after,i,'normal')))))*180/Math.PI);
  if(foot>.35&&before.attributes.position.getY(i)<=.015){assert.equal(distance,0,'contact pad preserved');assert.deepEqual(bytes(after.attributes.normal.array).subarray(i*12,i*12+12),bytes(before.attributes.normal.array).subarray(i*12,i*12+12));contacts.push(i);}
  if(distance>0||changedNormals.at(-1)===i)assert.ok(foot>.35||hand>.35||leg>.35,'surface edit outside target limbs');
  if(['position','normal'].some(key=>!bytes(after.attributes[key].array).subarray(i*12,i*12+12).equals(bytes(base.attributes[key].array).subarray(i*12,i*12+12))))ids.push(i);
}
const changedSet=new Set([...changedPositions,...changedNormals]);let minArea=Infinity,maxArea=0,minFaceCos=1,minNormalAlignment=1;
for(let t=0;t<after.index.count;t+=3){
  const vs=[0,1,2].map(k=>after.index.getX(t+k));if(!vs.some(i=>changedSet.has(i)))continue;
  const face=g=>{const [a,b,c]=vs.map(i=>vec(g,i));return b.sub(a).cross(c.sub(a));},old=face(before),now=face(after);if(old.length()<1e-9)continue;
  const ratio=now.length()/old.length(),cos=now.clone().normalize().dot(old.clone().normalize());assert.ok(ratio>=.20&&ratio<=5&&cos>=.25,'valid bounded deformation at triangle '+t/3);minArea=Math.min(minArea,ratio);maxArea=Math.max(maxArea,ratio);minFaceCos=Math.min(minFaceCos,cos);
  const meanNormal=g=>vs.reduce((sum,i)=>sum.add(vec(g,i,'normal')),new T.Vector3()).normalize();if(old.clone().normalize().dot(meanNormal(before))>.2){const alignment=now.normalize().dot(meanNormal(after));assert.ok(alignment>=.05,'outward normals at '+t/3);minNormalAlignment=Math.min(minNormalAlignment,alignment);}
}
const offset=(ids.length*2+3)&~3,payload=Buffer.alloc(offset+ids.length*24);
ids.forEach((id,k)=>{payload.writeUInt16LE(id,k*2);bytes(after.attributes.position.array).copy(payload,offset+k*24,id*12,id*12+12);bytes(after.attributes.normal.array).copy(payload,offset+k*24+12,id*12,id*12+12);});
const probes=[...new Set([0,...ids.filter((_,i)=>i%Math.max(1,Math.floor(ids.length/64))===0)])];
const patch={version:114,finishRevision:120,surfaceRevision:145,vertices:after.attributes.position.count,count:ids.length,baseProbes:probes.flatMap(i=>[i,...vec(base,i).toArray(),...vec(base,i,'normal').toArray()]),data:payload.toString('base64')};
const block='  // BEGIN COURIER_FORMS_PATCH_V114\n  var BERLIN_COURIER_FORMS_PATCH_V114 = '+JSON.stringify(patch)+';\n'+fs.readFileSync(path.join(__dirname,'berlin_courier_forms_patch_v114.js'),'utf8')+'\n  // END COURIER_FORMS_PATCH_V114';
const prefix='berlin-courier-forms-v114';fs.writeFileSync(path.join(stage,'models',prefix+'.bin'),payload);fs.writeFileSync(path.join(stage,'models',prefix+'.json'),JSON.stringify(patch));fs.writeFileSync(path.join(stage,'models',prefix+'.inline.js'),block+'\n');
const applied=base.clone();applied.userData=JSON.parse(JSON.stringify(base.userData));assert.equal(new Function('atob',block+'\nreturn applyBerlinCourierFormsPatchV114;')(atob)(applied),true);
for(const key of ['position','normal'])assert.deepEqual(bytes(applied.attributes[key].array),bytes(after.attributes[key].array));
function writeGLB(g,file){
  const size=glb.readUInt32LE(12),j=JSON.parse(glb.subarray(20,20+size)),bin=Buffer.from(glb.subarray(28+size)),allowed=[];
  for(const [name,key]of [['POSITION','position'],['NORMAL','normal']]){const a=j.accessors[j.meshes[0].primitives[0].attributes[name]],v=j.bufferViews[a.bufferView],at=(v.byteOffset||0)+(a.byteOffset||0),data=bytes(g.attributes[key].array);data.copy(bin,at);allowed.push([at,at+data.length]);if(a.min)a.min=[0,1,2].map(k=>Math.min(...Array.from({length:a.count},(_,i)=>g.attributes[key].getComponent(i,k))));if(a.max)a.max=[0,1,2].map(k=>Math.max(...Array.from({length:a.count},(_,i)=>g.attributes[key].getComponent(i,k))));}
  let at=0;for(const [a,b]of allowed.sort((a,b)=>a[0]-b[0])){assert.deepEqual(bin.subarray(at,a),glb.subarray(28+size+at,28+size+a));at=b;}assert.deepEqual(bin.subarray(at),glb.subarray(28+size+at));
  let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const head=Buffer.alloc(20),bh=Buffer.alloc(8);head.write('glTF');head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+bin.length,8);head.writeUInt32LE(json.length,12);head.write('JSON',16);bh.writeUInt32LE(bin.length);bh.write('BIN\0',4);fs.writeFileSync(path.join(stage,file),Buffer.concat([head,json,bh,bin]));
}
writeGLB(before,'before-authoring.glb');writeGLB(after,'courier-surface-v145-authoring.glb');
let page=s.html;const a=page.indexOf('  // BEGIN COURIER_FORMS_PATCH_V114'),b=page.indexOf('  // END COURIER_FORMS_PATCH_V114',a);assert.ok(a>0&&b>a);page=page.slice(0,a)+block+page.slice(b+'  // END COURIER_FORMS_PATCH_V114'.length);assert.equal(page.split("'kiez-reference-v144'").length,2);page=page.replace("'kiez-reference-v144'","'kiez-reference-v145'");
const edits=[
  ['sole = new Float32Array(pos.count * 2)','sole = new Float32Array(pos.count * 3)'],
  ['soleLength = 0, headWeight','soleLength = 0, soleWidth = 0, headWeight'],
  ['            soleLength += weight * THREE.MathUtils.clamp((point.z - fb.min.z) / Math.max(0.01, fb.max.z - fb.min.z), 0, 1);',
   '            soleLength += weight * THREE.MathUtils.clamp((point.z - fb.min.z) / Math.max(0.01, fb.max.z - fb.min.z), 0, 1);\n            soleWidth += weight * (point.x - (fb.min.x + fb.max.x) * 0.5) * 2 / Math.max(0.01, fb.max.x - fb.min.x);'],
  ['sole[i * 2] = Math.min(1, soleWeight);','sole[i * 3] = Math.min(1, soleWeight);'],
  ['sole[i * 2 + 1] = soleLength;','sole[i * 3 + 1] = soleLength;\n      sole[i * 3 + 2] = soleWidth;'],
  ["new THREE.BufferAttribute(sole, 2)","new THREE.BufferAttribute(sole, 3)"],
  ['attribute vec2 aCourierSole;','attribute vec3 aCourierSole;'],
  ['varying vec2 vCourierSole;','varying vec3 vCourierSole;'],
  ["          'float courierTread = 1.0 - smoothstep(0.28, 0.40, abs(fract(vCourierSole.y * 7.0) - 0.5));',\n          'vec3 courierRubber = mix(courierSoleColor, courierTreadColor, courierTread * 0.48);'",
   "          // Small paired tread pads, separated by cross-grooves and a centre\n          // channel; the unbroken perimeter keeps the outsole silhouette clean.\n          'float courierTreadEdge = (1.0-smoothstep(0.66,0.84,abs(vCourierSole.z))) * smoothstep(0.025,0.09,vCourierSole.y) * (1.0-smoothstep(0.91,0.98,vCourierSole.y));',\n          'float courierTread = smoothstep(0.28,0.39,abs(fract(vCourierSole.y * 9.0) - 0.5));',\n          'courierTread = max(courierTread,1.0-smoothstep(0.025,0.10,abs(vCourierSole.z)));',\n          'vec3 courierRubber = mix(courierTreadColor,courierSoleColor,courierTread*courierTreadEdge*0.58+0.24);'"],
  ['reference-outfit-v140','reference-outfit-v145'],['courierReferenceOutfitV140|','courierReferenceOutfitV145|'],
  ["heroShaderPatch(m, 'heroTrim' + color, rim === undefined ? 0.42 : rim, false)","heroShaderPatch(m, 'heroTrimUniformsV145', rim === undefined ? 0.42 : rim, false)"]
];
for(const [old,next]of edits){assert.ok(page.includes(old),'missing tread edit '+old);page=page.split(old).join(next);}
fs.writeFileSync(path.join(stage,'tread-edits.json'),JSON.stringify(edits,null,2));
fs.writeFileSync(path.join(stage,'candidate.html'),page);
const runtime=loadCourierSurface(path.relative(root,path.join(stage,'candidate.html'))).accepted;
for(const key of ['position','normal'])assert.deepEqual(bytes(runtime.attributes[key].array),bytes(after.attributes[key].array));
let finishDelta=0;for(let i=0;i<before.attributes.aCourierFinish.count;i++)finishDelta=Math.max(finishDelta,Math.abs(runtime.attributes.aCourierFinish.getX(i)-before.attributes.aCourierFinish.getX(i)));
for(const key of ['uv','skinIndex','skinWeight','aCourierSleeve','aCourierGarment'])assert.deepEqual(bytes(runtime.attributes[key].array),bytes(before.attributes[key].array));
for(let i=0;i<before.attributes.position.count;i++)for(let c=0;c<2;c++)assert.equal(runtime.attributes.aCourierSole.getComponent(i,c),before.attributes.aCourierSole.getComponent(i,c));
const report={passed:true,candidateSha256:sha(page),sourceHeroSha256:sha(glb),sculpt,posePins:posePins.length,vertices:after.attributes.position.count,triangles:after.index.count/3,changedPositions:changedPositions.length,changedNormals:changedNormals.length,protectedPositions:protectedIds.length,contactPadVertices:contacts.length,maxMove,maxNormalAngle,minArea,maxArea,minFaceCos,minNormalAlignment,patchVertices:ids.length,payloadBytes:payload.length,maxDerivedFinishChange:finishDelta,UVSkinMaterialMasksExact:true,unchangedTopology:true,extraDraws:0,extraPerFrameCPUWork:0,extraAttributeBytes:after.attributes.position.count*4,fragmentArithmeticChanged:true};
fs.writeFileSync(path.join(stage,'surface-check.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(stage,'changed-vertices.json'),JSON.stringify({position:changedPositions,normal:changedNormals,contactPads:contacts}));console.log(JSON.stringify(report,null,2));
