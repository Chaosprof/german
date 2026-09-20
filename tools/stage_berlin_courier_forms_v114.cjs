'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-model-forms-v114/courier',process.env.BERLIN_COURIER_CONTOURS?'contour-trial':process.env.BERLIN_COURIER_SOFT_NORMALS?'normal-trial':'');
fs.mkdirSync(stage,{recursive:true});
const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
const test=fs.readFileSync(path.join(__dirname,'check_berlin_courier.cjs'),'utf8');
const prefix=test.slice(0,test.indexOf('const before = Buffer'));
const {T,doc,nodes,mesh,geometry,skeleton,attribute,glb}=new Function('require','__dirname',prefix+'\nreturn {T,doc,nodes,mesh,geometry,skeleton,attribute,glb};')(require,__dirname);
const a=html.indexOf('  function refineCourierSilhouette(mesh) {'),b=html.indexOf('\n  // Both arms share',a);
const c=html.indexOf('  // BEGIN COURIER_CLOTH_PATCH_V97'),d=html.indexOf('  // END COURIER_CLOTH_PATCH_V97',c);
assert.ok(a>0&&b>a&&c>0&&d>c);
const refineSource=html.slice(a,b).replace('    applyBerlinCourierFormsPatchV114(geo);','');
new Function('THREE','atob',html.slice(c,d)+'\n'+refineSource+'\nreturn refineCourierSilhouette;')(T,atob)(mesh);
const accepted=mesh.geometry,changed=accepted.clone();
changed.userData=JSON.parse(JSON.stringify(accepted.userData));
const joints=skeleton.bones.map((_,i)=>new T.Vector3().setFromMatrixPosition(skeleton.boneInverses[i].clone().invert()));
const sourceHash=crypto.createHash('sha256').update(glb).digest('hex');
const formPath=path.join(__dirname,process.env.BERLIN_COURIER_CONTOURS?'berlin_courier_contours_v114.js':process.env.BERLIN_COURIER_SOFT_NORMALS?'berlin_courier_soft_normals_v114.js':'berlin_courier_forms_v114.js');
if(!fs.existsSync(formPath)){
  const rows=[];
  for(let i=0;i<geometry.attributes.position.count;i++)if(accepted.attributes.aCourierSleeve.getX(i)>.8){
    const wrist=accepted.attributes.aCourierGarment.getY(i);
    if(wrist>.05&&wrist<.24) rows.push({i,wrist,p:[0,1,2].map(k=>accepted.attributes.position.getComponent(i,k))});
  }
  console.log(JSON.stringify({joints:skeleton.bones.map((b,i)=>({name:b.name,p:joints[i].toArray()})),sleeve:rows},null,2));
  process.exit(0);
}
const sculpt=require(formPath).sculptCourierFormsV114;
const start=performance.now();sculpt(T,changed,geometry,skeleton,joints);const sculptMs=performance.now()-start;
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength);
for(const name of Object.keys(accepted.attributes))if(!['position','normal'].includes(name))assert.deepEqual(bytes(changed.attributes[name].array),bytes(accepted.attributes[name].array),name+' remains exact');
assert.deepEqual(bytes(changed.index.array),bytes(accepted.index.array));
assert.deepEqual(changed.userData.courierAccessoryBounds,accepted.userData.courierAccessoryBounds,'accessory anchors exact');
const ids=[];let maxMove=0,minAreaRatio=Infinity,maxAreaRatio=0,minFaceCos=1,minimumArtistAlignment=1;const failures=[],normalFailures=[];
const v=(g,i,n='position')=>new T.Vector3().fromBufferAttribute(g.attributes[n],i);
for(let i=0;i<accepted.attributes.position.count;i++){
  const delta=v(accepted,i).distanceTo(v(changed,i));
  assert.ok(Number.isFinite(delta)&&delta<.08);maxMove=Math.max(maxMove,delta);
  assert.ok(Math.abs(v(changed,i,'normal').length()-1)<1e-5);
  if(['position','normal'].some(name=>!bytes(accepted.attributes[name].array).subarray(i*12,i*12+12).equals(bytes(changed.attributes[name].array).subarray(i*12,i*12+12))))ids.push(i);
}
const changedIds=new Set(ids),idx=accepted.index;
for(let i=0;i<idx.count;i+=3){
  const vertices=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)];if(!vertices.some(i=>changedIds.has(i)))continue;
  const cross=g=>{const [a,b,c]=vertices.map(i=>v(g,i));return b.sub(a).cross(c.sub(a));};
  const before=cross(accepted),after=cross(changed);if(before.length()<1e-9)continue;
  const ratio=after.length()/before.length(),cos=before.dot(after)/(before.length()*after.length());
  minAreaRatio=Math.min(minAreaRatio,ratio);maxAreaRatio=Math.max(maxAreaRatio,ratio);minFaceCos=Math.min(minFaceCos,cos);
  const beforeN=vertices.reduce((sum,i)=>sum.add(v(accepted,i,'normal')),new T.Vector3()).normalize();
  const afterN=vertices.reduce((sum,i)=>sum.add(v(changed,i,'normal')),new T.Vector3()).normalize();
  if(before.clone().normalize().dot(beforeN)>.2){
    const alignment=after.clone().normalize().dot(afterN);minimumArtistAlignment=Math.min(minimumArtistAlignment,alignment);
    if(alignment<=0)normalFailures.push({triangle:i/3,alignment,vertices});
  }
  if(ratio<.15||ratio>8||cos<0)failures.push({triangle:i/3,vertices,ratio,cos,before:vertices.map(i=>v(accepted,i).toArray()),after:vertices.map(i=>v(changed,i).toArray()),wrist:vertices.map(i=>accepted.attributes.aCourierGarment.getY(i))});
}
fs.writeFileSync(path.join(stage,'triangle-validation.json'),JSON.stringify({minAreaRatio,maxAreaRatio,minFaceCos,minimumArtistAlignment,failures,normalFailures},null,2));
assert.equal(failures.length,0,'no collapsed or inverted faces: '+JSON.stringify(failures.slice(0,3)));
assert.equal(normalFailures.length,0,'no newly opposed smooth normals: '+JSON.stringify(normalFailures.slice(0,3)));
// Absolute patch installs after V97. It changes positions/normals only.
const offset=(ids.length*2+3)&~3,payload=Buffer.alloc(offset+ids.length*24);
ids.forEach((i,k)=>{payload.writeUInt16LE(i,k*2);bytes(changed.attributes.position.array).copy(payload,offset+k*24,i*12,i*12+12);bytes(changed.attributes.normal.array).copy(payload,offset+k*24+12,i*12,i*12+12);});
const probes=Array.from(new Set([0,...ids.filter((_,i)=>i%Math.max(1,Math.floor(ids.length/64))===0)]));
const patch={version:114,vertices:accepted.attributes.position.count,count:ids.length,baseProbes:probes.flatMap(i=>[i,...v(accepted,i).toArray(),...v(accepted,i,'normal').toArray()]),data:payload.toString('base64')};
fs.writeFileSync(path.join(stage,'courier-forms-v114.bin'),payload);
fs.writeFileSync(path.join(stage,'courier-forms-v114.json'),JSON.stringify(patch));
fs.writeFileSync(path.join(stage,'courier-forms-v114.inline.js'),'  // BEGIN COURIER_FORMS_PATCH_V114\n  var BERLIN_COURIER_FORMS_PATCH_V114 = '+JSON.stringify(patch)+';\n'+fs.readFileSync(path.join(__dirname,'berlin_courier_forms_patch_v114.js'),'utf8')+'\n  // END COURIER_FORMS_PATCH_V114\n');
const apply=new Function('atob',fs.readFileSync(path.join(stage,'courier-forms-v114.inline.js'),'utf8')+'\nreturn applyBerlinCourierFormsPatchV114;')(atob);
const applied=accepted.clone();applied.userData=JSON.parse(JSON.stringify(accepted.userData));
const t0=performance.now();assert.equal(apply(applied),true);const decodeAndApplyMs=performance.now()-t0;
for(const name of ['position','normal'])assert.deepEqual(bytes(applied.attributes[name].array),bytes(changed.attributes[name].array),'packed '+name+' exactly reproduces sculpt');
const corrupted=accepted.clone();corrupted.userData=JSON.parse(JSON.stringify(accepted.userData));corrupted.attributes.position.setX(probes[0],corrupted.attributes.position.getX(probes[0])+.01);
const corruptBefore=bytes(corrupted.attributes.position.array).toString('base64');assert.equal(apply(corrupted),false);assert.equal(bytes(corrupted.attributes.position.array).toString('base64'),corruptBefore);
function writeRenderCopy(g,file){
  const length=glb.readUInt32LE(12),j=JSON.parse(glb.subarray(20,20+length)),bin=Buffer.from(glb.subarray(28+length));
  for(const [key,name]of [['POSITION','position'],['NORMAL','normal']]){
    const acc=j.accessors[j.meshes[0].primitives[0].attributes[key]],view=j.bufferViews[acc.bufferView],offset=(view.byteOffset||0)+(acc.byteOffset||0);
    bytes(g.attributes[name].array).copy(bin,offset);
    if(acc.min)acc.min=[0,1,2].map(k=>Math.min(...Array.from({length:acc.count},(_,i)=>g.attributes[name].getComponent(i,k))));
    if(acc.max)acc.max=[0,1,2].map(k=>Math.max(...Array.from({length:acc.count},(_,i)=>g.attributes[name].getComponent(i,k))));
  }
  let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const head=Buffer.alloc(20),bh=Buffer.alloc(8);head.write('glTF');head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+bin.length,8);head.writeUInt32LE(json.length,12);head.write('JSON',16);bh.writeUInt32LE(bin.length);bh.write('BIN\0',4);
  fs.writeFileSync(path.join(stage,file),Buffer.concat([head,json,bh,bin]));
}
writeRenderCopy(accepted,'courier-before-authoring.glb');writeRenderCopy(changed,'courier-forms-v114-authoring.glb');
const protectedIds=[],welds=new Map();let protectedExact=0,maxSeamPosition=0,maxSeamNormal=0;
for(let i=0;i<geometry.attributes.position.count;i++){
  let head=0,hand=0,foot=0;
  for(let k=0;k<4;k++){
    const name=skeleton.bones[geometry.attributes.skinIndex.getComponent(i,k)].name,w=geometry.attributes.skinWeight.getComponent(i,k);
    if(/^(Head|head_end|headfront|neck)$/.test(name))head+=w;
    if(/^(Left|Right)Hand$/.test(name))hand+=w;
    if(/^(Left|Right)(Foot|ToeBase)$/.test(name))foot+=w;
  }
  if(head>.001||hand>.45||foot>.45||geometry.attributes.position.getY(i)<.215||geometry.attributes.position.getY(i)>1.285){
    for(const name of ['position','normal'])assert.deepEqual(bytes(changed.attributes[name].array).subarray(i*12,i*12+12),bytes(accepted.attributes[name].array).subarray(i*12,i*12+12));
    protectedIds.push(i);protectedExact++;
  }
  const key=v(accepted,i).toArray().map(n=>n.toFixed(6)).join(',')+'|'+v(accepted,i,'normal').toArray().map(n=>n.toFixed(5)).join(',');
  const other=welds.get(key);
  if(other===undefined)welds.set(key,i);else{
    maxSeamPosition=Math.max(maxSeamPosition,v(changed,i).distanceTo(v(changed,other)));
    maxSeamNormal=Math.max(maxSeamNormal,v(changed,i,'normal').distanceTo(v(changed,other,'normal')));
  }
}
assert.ok(maxSeamPosition<.0001&&maxSeamNormal<.002,'UV seams stay closed');
const changedMesh=new T.SkinnedMesh(changed,mesh.material);changedMesh.bind(skeleton,new T.Matrix4());
let previewBeforeGeometry=accepted,previewBeforeMesh=mesh;
if(process.env.BERLIN_COURIER_CONTOURS){
  previewBeforeGeometry=accepted.clone();previewBeforeGeometry.userData=JSON.parse(JSON.stringify(accepted.userData));
  const baselineApply=new Function('atob',fs.readFileSync(path.join(root,'audit/berlin-model-forms-v114/courier/normal-trial/courier-forms-v114.inline.js'),'utf8')+'\nreturn applyBerlinCourierFormsPatchV114;')(atob);
  assert.equal(baselineApply(previewBeforeGeometry),true);
  previewBeforeMesh=new T.SkinnedMesh(previewBeforeGeometry,mesh.material);previewBeforeMesh.bind(skeleton,new T.Matrix4());
  writeRenderCopy(previewBeforeGeometry,'courier-contour-before-authoring.glb');
}
const animationRoot=new T.Group();nodes.filter(n=>!n.parent).forEach(n=>animationRoot.add(n));
const bind=nodes.map(n=>[n.position.clone(),n.quaternion.clone(),n.scale.clone()]);
const mixer=new T.AnimationMixer(animationRoot);let posedSamples=0,maxPosedMove=0;const previews=[];
function restore(){nodes.forEach((n,i)=>{n.position.copy(bind[i][0]);n.quaternion.copy(bind[i][1]);n.scale.copy(bind[i][2]);});animationRoot.updateMatrixWorld(true);skeleton.update();}
function actualClip(a){return new T.AnimationClip(a.name,-1,a.channels.map(ch=>{
  const sampler=a.samplers[ch.sampler],property={translation:'position',rotation:'quaternion',scale:'scale'}[ch.target.path];
  const Track=property==='quaternion'?T.QuaternionKeyframeTrack:T.VectorKeyframeTrack;
  return new Track(nodes[ch.target.node].name+'.'+property,attribute(sampler.input).array,attribute(sampler.output).array);
}));}
for(const a of doc.animations){
  restore();const clip=actualClip(a),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
  for(const phase of [0,.125,.25,.375,.5,.625,.75,.875,.99]){
    mixer.setTime(clip.duration*phase);animationRoot.updateMatrixWorld(true);skeleton.update();posedSamples++;
    for(const i of ids){const delta=mesh.applyBoneTransform(i,v(accepted,i)).distanceTo(changedMesh.applyBoneTransform(i,v(changed,i)));assert.ok(Number.isFinite(delta)&&delta<.08);maxPosedMove=Math.max(maxPosedMove,delta);}
    for(const i of protectedIds)assert.deepEqual(mesh.applyBoneTransform(i,v(accepted,i)),changedMesh.applyBoneTransform(i,v(changed,i)));
    if((a.name==='run'&&phase===.25)||(a.name==='hero_jump_l'&&phase===.5)||(a.name==='hero_roll'&&phase===.375)){
      const pose={name:a.name,phase,meshes:[]};
      for(const [name,m,g]of [['before',previewBeforeMesh,previewBeforeGeometry],['candidate',changedMesh,changed]]){
        const position=[],normal=[];
        for(let i=0;i<g.attributes.position.count;i++){
          position.push(...m.applyBoneTransform(i,v(g,i)).toArray());const nn=v(g,i,'normal'),sum=new T.Vector3();
          for(let k=0;k<4;k++){const w=g.attributes.skinWeight.getComponent(i,k);if(!w)continue;const bi=g.attributes.skinIndex.getComponent(i,k),matrix=new T.Matrix3().setFromMatrix4(new T.Matrix4().fromArray(skeleton.boneMatrices,bi*16));sum.addScaledVector(nn.clone().applyMatrix3(matrix),w);}
          normal.push(...sum.normalize().toArray());
        }
        pose.meshes.push({name,position,normal});
      }
      previews.push(pose);
    }
  }
  mixer.stopAllAction();mixer.uncacheClip(clip);
}
restore();
const colors=[],sourceColors=process.env.BERLIN_COURIER_CONTOURS?JSON.parse(fs.readFileSync(path.join(stage,'source-colors.json'),'utf8')):null;
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const color=hex=>new T.Color(hex).toArray();
const mix=(a,b,t)=>a.map((v,k)=>v+(b[k]-v)*t);
for(let i=0;i<geometry.attributes.position.count;i++){
  const y=geometry.attributes.position.getY(i),wrist=accepted.attributes.aCourierGarment.getY(i),sleeve=smooth(.12,.78,accepted.attributes.aCourierSleeve.getX(i));
  let rgb=y<.215?color(0xe7ddc7):y<.76?color(0x4b6976):y<1.36?color(0xc65a32):color(0xe5ab84);
  const forearm=(1-smooth(.112,.126,wrist))*sleeve,cuff=smooth(.119,.126,wrist)*(1-smooth(.151,.162,wrist))*sleeve;
  if(sourceColors){
    rgb=sourceColors[i].rgb.slice();
    const garmentY=accepted.attributes.aCourierGarment.getX(i),luma=rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    const cloth=sourceColors[i].cloth*smooth(-.24,-.19,garmentY)*(1-smooth(.36,.45,garmentY));
    rgb=mix(rgb,color(0xc65a32).map(c=>c*Math.max(.92,Math.min(1.06,luma/.15))),cloth*.88);
    rgb=mix(rgb,color(0xc65a32),sleeve);
    const hem=cloth*smooth(-.180,-.165,garmentY)*(1-smooth(-.115,-.105,garmentY));
    rgb=mix(rgb,color(0x99472e),hem);
  }
  rgb=mix(rgb,color(0xe5ab84),forearm);rgb=mix(rgb,color(0x99472e),cuff);colors.push(...rgb);
}
fs.writeFileSync(path.join(stage,'preview-poses.json'),JSON.stringify({index:Array.from(idx.array),colors,poses:previews}));
const report={stagedOnly:true,sourceHash,triangles:idx.count/3,vertices:accepted.attributes.position.count,changedVertices:ids.length,maxMove,minAreaRatio,maxAreaRatio,minFaceCos,minimumArtistAlignment,sculptMs,decodeAndApplyMs,payloadBytes:payload.length,sculpt:changed.userData.courierFormsV114,UVSkinMasksTopologyExact:true,accessoryAnchorBoundsExact:true,protectedExact,maxSeamPosition,maxSeamNormal,posedSamples,maxPosedMove,clips:doc.animations.map(a=>a.name),packedEqualsSculpt:true,incompatibleSkipsWithoutMutation:true,extraDraws:0,extraPerFrameWork:0};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
