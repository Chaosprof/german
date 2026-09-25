'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const {loadCourierSurface}=require('./load_berlin_courier_surface.cjs');
const stage=path.resolve(__dirname,'../audit/berlin-parity-v145'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const s=loadCourierSurface('audit/berlin-parity-v145/baseline.html'),now=loadCourierSurface('audit/berlin-parity-v145/candidate.html');
const {T,doc,nodes,skeleton,attribute}=s,before=s.accepted,after=now.accepted;
const delta=JSON.parse(fs.readFileSync(path.join(stage,'changed-vertices.json'))),changed=new Set(delta.position),protectedIds=Array.from({length:before.attributes.position.count},(_,i)=>i).filter(i=>!changed.has(i));
const vector=(g,i)=>new T.Vector3().fromBufferAttribute(g.attributes.position,i);
const baselineMesh=new T.SkinnedMesh(before,s.mesh.material),candidateMesh=new T.SkinnedMesh(after,s.mesh.material);
baselineMesh.bind(skeleton,new T.Matrix4());candidateMesh.bind(skeleton,new T.Matrix4());
const shoeIds=[[],[]],names=skeleton.bones.map(b=>b.name);
for(let i=0;i<before.attributes.position.count;i++)for(let side=0;side<2;side++){
 let weight=0;for(let k=0;k<4;k++)if(new RegExp('^'+['Left','Right'][side]+'(Foot|ToeBase)$').test(names[before.attributes.skinIndex.getComponent(i,k)]))weight+=before.attributes.skinWeight.getComponent(i,k);
 if(weight>.35)shoeIds[side].push(i);
}
const changedFaces=[];for(let t=0;t<before.index.count;t+=3){const ids=[0,1,2].map(k=>before.index.getX(t+k));if(ids.some(i=>changed.has(i)))changedFaces.push(ids);}
const root=new T.Group();nodes.filter(n=>!n.parent).forEach(n=>root.add(n));const bind=nodes.map(n=>[n.position.clone(),n.quaternion.clone(),n.scale.clone()]),mixer=new T.AnimationMixer(root);
const restore=()=>{nodes.forEach((n,i)=>{n.position.copy(bind[i][0]);n.quaternion.copy(bind[i][1]);n.scale.copy(bind[i][2]);});root.updateMatrixWorld(true);skeleton.update();};
const contacts=[],bad=[];let maxFloorLowering=0,maxPosedMove=0,poseSamples=0,trianglePoseSamples=0,minAreaRatio=1,minFaceCos=1;
for(const animation of doc.animations){
 restore();const clip=new T.AnimationClip(animation.name,-1,animation.channels.map(ch=>{
 const sampler=animation.samplers[ch.sampler],property={translation:'position',rotation:'quaternion',scale:'scale'}[ch.target.path],Track=property==='quaternion'?T.QuaternionKeyframeTrack:T.VectorKeyframeTrack;
 return new Track(nodes[ch.target.node].name+'.'+property,attribute(sampler.input).array,attribute(sampler.output).array);
 }));const action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
 for(let step=0;step<17;step++){
  const phase=Math.min(.99,step/16);mixer.setTime(clip.duration*phase);root.updateMatrixWorld(true);skeleton.update();poseSamples++;
  const posedBefore=[],posedAfter=[];
  for(let i=0;i<before.attributes.position.count;i++){
   const a=baselineMesh.applyBoneTransform(i,vector(before,i)),b=candidateMesh.applyBoneTransform(i,vector(after,i));
   assert.ok(Number.isFinite(b.x+b.y+b.z));maxPosedMove=Math.max(maxPosedMove,a.distanceTo(b));
   if(!changed.has(i))assert.ok(a.equals(b),'protected posed position '+i);
   posedBefore.push(a);posedAfter.push(b);
  }
  const lowBefore=shoeIds.map(ids=>Math.min(...ids.map(i=>posedBefore[i].y))),lowAfter=shoeIds.map(ids=>Math.min(...ids.map(i=>posedAfter[i].y)));
  const lower=Math.min(...lowBefore)-Math.min(...lowAfter);maxFloorLowering=Math.max(maxFloorLowering,lower);contacts.push({clip:animation.name,phase,before:lowBefore,after:lowAfter,lower});
  if(step%4===0){trianglePoseSamples++;for(const ids of changedFaces){
   const face=p=>p[ids[1]].clone().sub(p[ids[0]]).cross(p[ids[2]].clone().sub(p[ids[0]])),a=face(posedBefore),b=face(posedAfter);
   if(a.length()<1e-8)continue;const ratio=b.length()/a.length(),cos=a.clone().normalize().dot(b.clone().normalize());minAreaRatio=Math.min(minAreaRatio,ratio);minFaceCos=Math.min(minFaceCos,cos);
   if(ratio<.1||cos<0)bad.push({clip:animation.name,phase,ids,ratio,cos});
  }}
 }mixer.stopAllAction();mixer.uncacheClip(clip);
}restore();
const report={passed:bad.length===0&&maxFloorLowering<.004,candidateSha256:sha(fs.readFileSync(path.join(stage,'candidate.html'))),poseSamples,trianglePoseSamples,changedFaces:changedFaces.length,protectedPositionChecks:protectedIds.length*poseSamples,contactPadVertices:delta.contactPads.length,maxFloorLowering,maxPosedMove,minAreaRatio,minFaceCos,bad,contacts};
fs.writeFileSync(path.join(stage,'pose-check.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,contacts:contacts.length,bad:bad.slice(0,10)},null,2));assert.equal(report.passed,true,'pose and floor-contact checks');
