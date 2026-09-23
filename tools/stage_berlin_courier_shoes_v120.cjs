'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-courier-v120/shoes');fs.mkdirSync(stage,{recursive:true});
const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8'),test=fs.readFileSync(path.join(__dirname,'check_berlin_courier.cjs'),'utf8'),prefix=test.slice(0,test.indexOf('const before = Buffer'));
const {T,doc,nodes,mesh,geometry,skeleton,attribute,glb}=new Function('require','__dirname',prefix+'\nreturn {T,doc,nodes,mesh,geometry,skeleton,attribute,glb};')(require,__dirname);
const a=html.indexOf('  function refineCourierSilhouette(mesh) {'),b=html.indexOf('\n  // Both arms share',a),c=html.indexOf('  // BEGIN COURIER_CLOTH_PATCH_V97'),d=html.indexOf('  // END COURIER_CLOTH_PATCH_V97',c);
assert.ok(a>0&&b>a&&c>0&&d>c);
new Function('THREE','atob',html.slice(c,d)+'\n'+html.slice(a,b).replace('    applyBerlinCourierFormsPatchV114(geo);','')+'\nreturn refineCourierSilhouette;')(T,atob)(mesh);
const v97=mesh.geometry,accepted=v97.clone();accepted.userData=JSON.parse(JSON.stringify(v97.userData));
const baselineScope=fs.readFileSync(path.join(root,'audit/berlin-model-forms-v114/courier/quiet-hem/courier-forms-v114.inline.js'),'utf8');
assert.equal(new Function('atob',baselineScope+'\nreturn applyBerlinCourierFormsPatchV114;')(atob)(accepted),true);
const changed=accepted.clone();changed.userData=JSON.parse(JSON.stringify(accepted.userData));
const joints=skeleton.boneInverses.map(m=>new T.Vector3().setFromMatrixPosition(m.clone().invert())),names=skeleton.bones.map(b=>b.name);
const sides=['Left','Right'],shoeIds=[[],[]],bounds=sides.map(()=>new T.Box3());
for(let i=0;i<geometry.attributes.position.count;i++){
  for(let side=0;side<2;side++){
    let w=0;for(let k=0;k<4;k++)if(new RegExp('^'+sides[side]+'(Foot|ToeBase)$').test(names[geometry.attributes.skinIndex.getComponent(i,k)]))w+=geometry.attributes.skinWeight.getComponent(i,k);
    if(w>.45){shoeIds[side].push(i);bounds[side].expandByPoint(new T.Vector3().fromBufferAttribute(accepted.attributes.position,i));}
  }
}
const info={bounds:bounds.map(b=>({min:b.min.toArray(),max:b.max.toArray()})),joints:sides.map(side=>({foot:joints[names.indexOf(side+'Foot')].toArray(),toe:joints[names.indexOf(side+'ToeBase')].toArray()})),vertices:shoeIds.map(ids=>ids.length)};
if(!fs.existsSync(path.join(__dirname,'berlin_courier_shoes_v120.js'))){console.log(JSON.stringify(info,null,2));process.exit(0);}
const sculpt=require('./berlin_courier_shoes_v120.js').sculptCourierShoesV120;
sculpt(T,changed,geometry,skeleton,joints);
const bytes=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength),vec=(g,i,name='position')=>new T.Vector3().fromBufferAttribute(g.attributes[name],i);
for(const key of Object.keys(accepted.attributes))if(!['position','normal'].includes(key))assert.deepEqual(bytes(changed.attributes[key].array),bytes(accepted.attributes[key].array),key+' exact');
assert.deepEqual(bytes(changed.index.array),bytes(accepted.index.array));assert.deepEqual(changed.userData.courierAccessoryBounds,accepted.userData.courierAccessoryBounds);
const ids=[],shoeChanged=[],protectedIds=[],welds=new Map();let maxMove=0,maxSeamP=0,maxSeamN=0;
const shoeSet=new Set(shoeIds.flat());
for(let i=0;i<accepted.attributes.position.count;i++){
  const delta=vec(changed,i).distanceTo(vec(accepted,i));assert.ok(Number.isFinite(delta)&&delta<.065);maxMove=Math.max(maxMove,delta);
  assert.ok(Math.abs(vec(changed,i,'normal').length()-1)<1e-5);
  if(!shoeSet.has(i)){
    for(const key of ['position','normal'])assert.deepEqual(bytes(changed.attributes[key].array).subarray(i*12,i*12+12),bytes(accepted.attributes[key].array).subarray(i*12,i*12+12),'outside shoe '+key+' '+i);
    protectedIds.push(i);
  }
  if(delta>0)shoeChanged.push(i);
  if(['position','normal'].some(key=>!bytes(changed.attributes[key].array).subarray(i*12,i*12+12).equals(bytes(v97.attributes[key].array).subarray(i*12,i*12+12))))ids.push(i);
  const key=vec(accepted,i).toArray().map(v=>v.toFixed(6)).join(',')+'|'+vec(accepted,i,'normal').toArray().map(v=>v.toFixed(5)).join(',');
  if(welds.has(key)){const other=welds.get(key);maxSeamP=Math.max(maxSeamP,vec(changed,i).distanceTo(vec(changed,other)));maxSeamN=Math.max(maxSeamN,vec(changed,i,'normal').distanceTo(vec(changed,other,'normal')));}else welds.set(key,i);
}
assert.ok(maxSeamP<1e-5&&maxSeamN<.002);
let minArea=Infinity,maxArea=0,minFaceCos=1,minAlignment=1;const bad=[];
for(let t=0;t<changed.index.count;t+=3){
  const ids=[0,1,2].map(k=>changed.index.getX(t+k));if(!ids.some(i=>shoeSet.has(i)))continue;
  const face=g=>{const [a,b,c]=ids.map(i=>vec(g,i));return b.sub(a).cross(c.sub(a));};
  const a=face(accepted),b=face(changed);if(a.length()<1e-9)continue;
  const ratio=b.length()/a.length(),cos=a.clone().normalize().dot(b.clone().normalize());minArea=Math.min(minArea,ratio);maxArea=Math.max(maxArea,ratio);minFaceCos=Math.min(minFaceCos,cos);
  const na=ids.reduce((s,i)=>s.add(vec(accepted,i,'normal')),new T.Vector3()).normalize(),nb=ids.reduce((s,i)=>s.add(vec(changed,i,'normal')),new T.Vector3()).normalize();
  const align=b.clone().normalize().dot(nb);if(a.clone().normalize().dot(na)>.2)minAlignment=Math.min(minAlignment,align);
  if(ratio<.12||ratio>8||cos<0||(a.clone().normalize().dot(na)>.2&&align<0))bad.push({t:t/3,ids,ratio,cos,align});
}
fs.writeFileSync(path.join(stage,'triangles.json'),JSON.stringify({minArea,maxArea,minFaceCos,minAlignment,bad},null,2));assert.equal(bad.length,0,JSON.stringify(bad.slice(0,5)));
const candidateMesh=new T.SkinnedMesh(changed,mesh.material);candidateMesh.bind(skeleton,new T.Matrix4());const baselineMesh=new T.SkinnedMesh(accepted,mesh.material);baselineMesh.bind(skeleton,new T.Matrix4());
const animationRoot=new T.Group();nodes.filter(n=>!n.parent).forEach(n=>animationRoot.add(n));const bind=nodes.map(n=>[n.position.clone(),n.quaternion.clone(),n.scale.clone()]),mixer=new T.AnimationMixer(animationRoot);
function restore(){nodes.forEach((n,i)=>{n.position.copy(bind[i][0]);n.quaternion.copy(bind[i][1]);n.scale.copy(bind[i][2]);});animationRoot.updateMatrixWorld(true);skeleton.update();}
function clip(a){return new T.AnimationClip(a.name,-1,a.channels.map(ch=>{const sampler=a.samplers[ch.sampler],property={translation:'position',rotation:'quaternion',scale:'scale'}[ch.target.path],Track=property==='quaternion'?T.QuaternionKeyframeTrack:T.VectorKeyframeTrack;return new Track(nodes[ch.target.node].name+'.'+property,attribute(sampler.input).array,attribute(sampler.output).array);}));}
let poseSamples=0,maxPosedMove=0,maxFloorLowering=0;const poses=[],contacts=[];
for(const a of doc.animations){restore();const cl=clip(a),action=mixer.clipAction(cl);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
  for(const phase of [0,.0625,.125,.1875,.25,.3125,.375,.4375,.5,.5625,.625,.6875,.75,.8125,.875,.9375,.99]){
    mixer.setTime(cl.duration*phase);animationRoot.updateMatrixWorld(true);skeleton.update();poseSamples++;
    const lowBefore=[Infinity,Infinity],lowAfter=[Infinity,Infinity];
    for(let side=0;side<2;side++)for(const i of shoeIds[side]){
      const before=baselineMesh.applyBoneTransform(i,vec(accepted,i)),after=candidateMesh.applyBoneTransform(i,vec(changed,i));
      maxPosedMove=Math.max(maxPosedMove,before.distanceTo(after));assert.ok(Number.isFinite(after.y));lowBefore[side]=Math.min(lowBefore[side],before.y);lowAfter[side]=Math.min(lowAfter[side],after.y);
    }
    const lower=Math.min(...lowBefore)-Math.min(...lowAfter);maxFloorLowering=Math.max(maxFloorLowering,lower);contacts.push({clip:a.name,phase,before:lowBefore,after:lowAfter,lower});
    for(const i of protectedIds)assert.deepEqual(baselineMesh.applyBoneTransform(i,vec(accepted,i)),candidateMesh.applyBoneTransform(i,vec(changed,i)));
    if(a.name==='run'&&[.125,.25,.5].includes(phase)){
      const meshes=[];for(const [name,m,g]of [['before',baselineMesh,accepted],['candidate',candidateMesh,changed]]){
        const position=[],normal=[];
        for(let i=0;i<g.attributes.position.count;i++){
          position.push(...m.applyBoneTransform(i,vec(g,i)).toArray());const nn=vec(g,i,'normal'),sum=new T.Vector3();
          for(let k=0;k<4;k++){const w=g.attributes.skinWeight.getComponent(i,k);if(!w)continue;const bi=g.attributes.skinIndex.getComponent(i,k),matrix=new T.Matrix3().setFromMatrix4(new T.Matrix4().fromArray(skeleton.boneMatrices,bi*16));sum.addScaledVector(nn.clone().applyMatrix3(matrix),w);}normal.push(...sum.normalize().toArray());
        }meshes.push({name,position,normal});
      }poses.push({name:a.name,phase,meshes});
    }
  }mixer.stopAllAction();mixer.uncacheClip(cl);
}restore();
fs.writeFileSync(path.join(stage,'pose-contacts.json'),JSON.stringify({maxFloorLowering,contacts},null,2));
// Contact change is evaluated against the baseline's existing pose contact.
assert.ok(maxFloorLowering<.004,'shoe shape adds floor penetration: '+maxFloorLowering);
const offset=(ids.length*2+3)&~3,payload=Buffer.alloc(offset+ids.length*24);ids.forEach((i,k)=>{payload.writeUInt16LE(i,k*2);bytes(changed.attributes.position.array).copy(payload,offset+k*24,i*12,i*12+12);bytes(changed.attributes.normal.array).copy(payload,offset+k*24+12,i*12,i*12+12);});
const probes=Array.from(new Set([0,...ids.filter((_,i)=>i%Math.max(1,Math.floor(ids.length/64))===0)]));
const patch={version:114,finishRevision:120,vertices:changed.attributes.position.count,count:ids.length,baseProbes:probes.flatMap(i=>[i,...vec(v97,i).toArray(),...vec(v97,i,'normal').toArray()]),data:payload.toString('base64')};
fs.writeFileSync(path.join(stage,'courier-forms-v114.bin'),payload);fs.writeFileSync(path.join(stage,'courier-forms-v114.json'),JSON.stringify(patch));
const scope='  // BEGIN COURIER_FORMS_PATCH_V114\n  var BERLIN_COURIER_FORMS_PATCH_V114 = '+JSON.stringify(patch)+';\n'+fs.readFileSync(path.join(__dirname,'berlin_courier_forms_patch_v114.js'),'utf8')+'\n  // END COURIER_FORMS_PATCH_V114\n';fs.writeFileSync(path.join(stage,'courier-forms-v114.inline.js'),scope);
const applied=v97.clone();applied.userData=JSON.parse(JSON.stringify(v97.userData));assert.equal(new Function('atob',scope+'\nreturn applyBerlinCourierFormsPatchV114;')(atob)(applied),true);
for(const key of ['position','normal'])assert.deepEqual(bytes(applied.attributes[key].array),bytes(changed.attributes[key].array));
function writeGLB(g,name){
  const length=glb.readUInt32LE(12),j=JSON.parse(glb.subarray(20,20+length)),bin=Buffer.from(glb.subarray(28+length));
  const allowed=[];for(const [key,name]of [['POSITION','position'],['NORMAL','normal']]){const acc=j.accessors[j.meshes[0].primitives[0].attributes[key]],view=j.bufferViews[acc.bufferView],at=(view.byteOffset||0)+(acc.byteOffset||0),data=bytes(g.attributes[name].array);data.copy(bin,at);allowed.push([at,at+data.length]);if(acc.min)acc.min=[0,1,2].map(k=>Math.min(...Array.from({length:acc.count},(_,i)=>g.attributes[name].getComponent(i,k))));if(acc.max)acc.max=[0,1,2].map(k=>Math.max(...Array.from({length:acc.count},(_,i)=>g.attributes[name].getComponent(i,k))));}
  let at=0;for(const [a,b]of allowed.sort((a,b)=>a[0]-b[0])){assert.deepEqual(bin.subarray(at,a),glb.subarray(28+length+at,28+length+a));at=b;}assert.deepEqual(bin.subarray(at),glb.subarray(28+length+at));
  let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const head=Buffer.alloc(20),bh=Buffer.alloc(8);head.write('glTF');head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+bin.length,8);head.writeUInt32LE(json.length,12);head.write('JSON',16);bh.writeUInt32LE(bin.length);bh.write('BIN\0',4);fs.writeFileSync(path.join(stage,name),Buffer.concat([head,json,bh,bin]));
}
writeGLB(accepted,'courier-shoes-before-authoring.glb');writeGLB(changed,'courier-forms-v114-authoring.glb');
const colors=[];for(let i=0;i<accepted.attributes.position.count;i++){const y=geometry.attributes.position.getY(i);let c=new T.Color(y<.215?0xe7ddc7:y<.76?0x4b6976:y<1.36?0xc65a32:0xe5ab84);if(accepted.attributes.aCourierSole.getX(i)>.25)c=new T.Color(0xa18560);colors.push(...c.toArray());}
fs.writeFileSync(path.join(stage,'preview-poses.json'),JSON.stringify({index:Array.from(changed.index.array),colors,poses}));
const report={stagedOnly:true,sourceHash:crypto.createHash('sha256').update(glb).digest('hex'),shoeInfo:info,changedShoePositions:shoeChanged.length,fullPatchVertices:ids.length,payloadBytes:payload.length,protectedNonShoeVertices:protectedIds.length,nonShoePositionsNormalsExact:true,UVSkinMasksTopologyAnimationsExact:true,bagBoundsExact:true,maxMove,minArea,maxArea,minFaceCos,minAlignment,maxSeamP,maxSeamN,poseSamples,maxPosedMove,maxFloorLowering,sculpt:changed.userData.courierShoesV120,packedEqualsSculpt:true,extraDraws:0,extraVertices:0,extraPerFrameWork:0};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
