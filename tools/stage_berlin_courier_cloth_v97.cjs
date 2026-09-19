'use strict';
// Stages a replacement one-time refinement plus exact skinned authoring copies.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-courier-cloth-v97');
const base=path.join(stage,'baseline'),out=path.join(stage,'models');
fs.mkdirSync(base,{recursive:true});fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
const start=html.indexOf('  function refineCourierSilhouette(mesh) {'),end=html.indexOf('\n  // Both arms share',start);
assert.ok(start>0&&end>start);
for(const [name,bytes]of [['refineCourierSilhouette.js',Buffer.from(html.slice(start,end))],
  ['berlin-runner-hero-v14.glb',fs.readFileSync(path.join(root,'assets/models/berlin-runner-hero-v14.glb'))]])
  if(!fs.existsSync(path.join(base,name)))fs.writeFileSync(path.join(base,name),bytes);
const original=fs.readFileSync(path.join(base,'refineCourierSilhouette.js'),'utf8');
const sourceGlb=fs.readFileSync(path.join(base,'berlin-runner-hero-v14.glb'));
const hashes={refinement:sha(Buffer.from(original)),glb:sha(sourceGlb),
  bag:sha(fs.readFileSync(path.join(root,'assets/models/berlin-courier-bag-v1.json')))};
const hashFile=path.join(base,'sha256.json');
if(fs.existsSync(hashFile))assert.deepEqual(JSON.parse(fs.readFileSync(hashFile)),hashes);
else fs.writeFileSync(hashFile,JSON.stringify(hashes,null,2));
const sculpt=fs.readFileSync(path.join(__dirname,'berlin_courier_cloth_form_v97.js'),'utf8').split("if(typeof module!==")[0];
const eol=original.includes('\r\n')?'\r\n':'\n';
const marker='    geo.computeBoundingBox(); geo.computeBoundingSphere();';
assert.equal(original.split(marker).length,2);
const inserted=sculpt.replace(/\r?\n/g,eol)+eol+
  '    sculptCourierClothV97(THREE, geo, mesh.geometry, sk, bonePoints, shoeCuffY);'+eol;
const candidate=original.replace(marker,inserted+marker);
fs.writeFileSync(path.join(stage,'refineCourierSilhouette-v97.js'),candidate);
const accessoryBefore="    var torso = bounds(['Spine', 'Spine01', 'Spine02']);";
const accessoryAfter="    var torso = geo.userData.courierAccessoryBounds ? new THREE.Box3(new THREE.Vector3().fromArray(geo.userData.courierAccessoryBounds.min), new THREE.Vector3().fromArray(geo.userData.courierAccessoryBounds.max)) : bounds(['Spine', 'Spine01', 'Spine02']);";
assert.ok(html.includes(accessoryBefore)||html.includes(accessoryAfter),'accepted or guarded accessory measurement anchor');
fs.writeFileSync(path.join(stage,'accessory-bounds-patch.json'),JSON.stringify({before:accessoryBefore,after:accessoryAfter},null,2));

const test=fs.readFileSync(path.join(__dirname,'check_berlin_courier.cjs'),'utf8');
const prefix=test.slice(0,test.indexOf('const before = Buffer'));
const fixtureFs=Object.create(fs);
fixtureFs.readFileSync=(name,...args)=>typeof name==='string'&&name.endsWith('assets'+path.sep+'models'+path.sep+'berlin-runner-hero-v14.glb')?sourceGlb:fs.readFileSync(name,...args);
const {T,doc,nodes,mesh,geometry,skeleton,attribute}=new Function('require','__dirname',prefix+'\nreturn {T,doc,nodes,mesh,geometry,skeleton,attribute};')
  (name=>name==='fs'?fixtureFs:require(name),__dirname);
const sourceSnapshot={};for(const [name,a]of Object.entries(geometry.attributes))sourceSnapshot[name]=Buffer.from(a.array.buffer).toString('base64');
const refine=source=>new Function('THREE',source+'\nreturn refineCourierSilhouette;')(T);
refine(original)(mesh);const accepted=mesh.geometry;
const changedMesh=new T.SkinnedMesh(geometry,mesh.material);changedMesh.bind(skeleton,new T.Matrix4());
const t0=performance.now();refine(candidate)(changedMesh);const startupMs=performance.now()-t0;
const changed=changedMesh.geometry,clothReport=changed.userData.courierClothV97;
for(const name of Object.keys(geometry.attributes))assert.equal(Buffer.from(geometry.attributes[name].array.buffer).toString('base64'),sourceSnapshot[name]);
for(const name of ['uv','skinIndex','skinWeight','aCourierSleeve','aCourierSole','aCourierGarment'])
  assert.deepEqual(Buffer.from(changed.attributes[name].array.buffer),Buffer.from(accepted.attributes[name].array.buffer),name+' remains exact');
assert.deepEqual(Buffer.from(changed.index.array.buffer),Buffer.from(accepted.index.array.buffer));
const protectedVertices=[],changedVertices=[],welds=new Map();let maxMove=0,minAreaRatio=Infinity,maxAreaRatio=0,minFaceCos=1,maxSeamPositionError=0,maxSeamNormalError=0;
const vector=(g,i,name='position')=>new T.Vector3().fromBufferAttribute(g.attributes[name],i);
const names=skeleton.bones.map(b=>b.name);
function weight(i,re){let sum=0;for(let c=0;c<4;c++)if(re.test(names[geometry.attributes.skinIndex.getComponent(i,c)]))sum+=geometry.attributes.skinWeight.getComponent(i,c);return sum;}
const torsoBounds=g=>{const b=new T.Box3();for(let i=0;i<g.attributes.position.count;i++)if(weight(i,/^(Spine|Spine01|Spine02)$/)>.45)b.expandByPoint(vector(g,i));return b;};
assert.equal(JSON.stringify(changed.userData.courierAccessoryBounds),JSON.stringify({min:torsoBounds(accepted).min.toArray(),max:torsoBounds(accepted).max.toArray()}),'bag size and attachment input AABB stays exact');
for(let i=0;i<geometry.attributes.position.count;i++){
  const before=vector(accepted,i),after=vector(changed,i),delta=after.distanceTo(before);
  const protectedRegion=weight(i,/^(Head|head_end|headfront|neck)$/)>.001||weight(i,/^(Left|Right)Hand$/)>.45||weight(i,/^(Left|Right)(Foot|ToeBase)$/)>.45;
  if(protectedRegion){protectedVertices.push(i);for(const name of ['position','normal'])for(let k=0;k<3;k++)assert.equal(changed.attributes[name].getComponent(i,k),accepted.attributes[name].getComponent(i,k));}
  if(delta>0)changedVertices.push(i);
  assert.ok(Number.isFinite(delta)&&delta<.12);maxMove=Math.max(maxMove,delta);
  assert.ok(Math.abs(vector(changed,i,'normal').length()-1)<.00001);
  const key=before.toArray().map(v=>v.toFixed(6)).join(',')+'|'+vector(accepted,i,'normal').toArray().map(v=>v.toFixed(5)).join(',');
  const other=welds.get(key);if(other!==undefined){maxSeamPositionError=Math.max(maxSeamPositionError,after.distanceTo(vector(changed,other)));maxSeamNormalError=Math.max(maxSeamNormalError,vector(changed,i,'normal').distanceTo(vector(changed,other,'normal')));}
  else welds.set(key,i);
}
assert.ok(maxSeamPositionError<.0001,'duplicate UV positions remain welded');
assert.ok(maxSeamNormalError<.002,'smooth artist normals remain continuous across UV seams');
const changedSet=new Set(changedVertices),index=geometry.index,badTriangles=[],artistReversals=[];let newlyReversedArtistFaces=0,minimumArtistAlignment=1;
for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];if(!ids.some(v=>changedSet.has(v)))continue;
  const cross=g=>{const [a,b,c]=ids.map(i=>vector(g,i));return b.sub(a).cross(c.sub(a));};
  const a=cross(accepted),b=cross(changed);if(a.length()<1e-9)continue;const ratio=b.length()/a.length();
  minAreaRatio=Math.min(minAreaRatio,ratio);maxAreaRatio=Math.max(maxAreaRatio,ratio);minFaceCos=Math.min(minFaceCos,a.dot(b)/(a.length()*b.length()));
  const beforeNormal=ids.reduce((sum,v)=>sum.add(vector(accepted,v,'normal')),new T.Vector3()).normalize();
  const afterNormal=ids.reduce((sum,v)=>sum.add(vector(changed,v,'normal')),new T.Vector3()).normalize();
  const beforeAlignment=a.clone().normalize().dot(beforeNormal),afterAlignment=b.clone().normalize().dot(afterNormal);
  if(beforeAlignment>.2){minimumArtistAlignment=Math.min(minimumArtistAlignment,afterAlignment);if(afterAlignment<=0){newlyReversedArtistFaces++;artistReversals.push({triangle:i/3,beforeAlignment,afterAlignment,ids,prior:ids.map(v=>vector(accepted,v).toArray()),next:ids.map(v=>vector(changed,v).toArray())});}}
  if(ratio<.12||ratio>8||a.dot(b)/(a.length()*b.length())<-.1){const pa=ids.map(v=>vector(accepted,v));
    const edgeSum=pa[0].distanceToSquared(pa[1])+pa[1].distanceToSquared(pa[2])+pa[2].distanceToSquared(pa[0]);
    const na=ids.reduce((sum,v)=>sum.add(vector(accepted,v,'normal')),new T.Vector3()).normalize();
    const nb=ids.reduce((sum,v)=>sum.add(vector(changed,v,'normal')),new T.Vector3()).normalize();
    badTriangles.push({triangle:i/3,ratio,area:a.length(),quality:2*Math.sqrt(3)*a.length()/edgeSum,cos:a.dot(b)/(a.length()*b.length()),priorNormalDot:a.clone().normalize().dot(na),nextNormalDot:b.clone().normalize().dot(nb),ids,prior:ids.map(v=>vector(accepted,v).toArray()),next:ids.map(v=>vector(changed,v).toArray())});}
}
fs.writeFileSync(path.join(stage,'triangle-debug.json'),JSON.stringify({clothReport,minAreaRatio,maxAreaRatio,minFaceCos,badTriangles,artistReversals},null,2));
assert.ok(minAreaRatio>.12&&maxAreaRatio<8,'cloth triangles retain usable areas: '+JSON.stringify({minAreaRatio,maxAreaRatio,minFaceCos,badCount:badTriangles.length}));
assert.ok(minFaceCos>-.1,'no strongly inverted cloth triangles');
assert.equal(newlyReversedArtistFaces,0,'no cloth faces newly oppose their smooth normals');

function writeRenderCopy(g,file){
  const n=sourceGlb.readUInt32LE(12),j=JSON.parse(sourceGlb.subarray(20,20+n)),bin=Buffer.from(sourceGlb.subarray(28+n));
  const primitive=j.meshes[0].primitives[0],allowed=[];
  for(const [key,name]of [['POSITION','position'],['NORMAL','normal']]){
    const a=j.accessors[primitive.attributes[key]],view=j.bufferViews[a.bufferView],offset=(view.byteOffset||0)+(a.byteOffset||0);
    const data=Buffer.from(g.attributes[name].array.buffer);data.copy(bin,offset);allowed.push([offset,offset+data.length]);
    if(a.min)a.min=[0,1,2].map(k=>{let v=Infinity;for(let i=0;i<a.count;i++)v=Math.min(v,g.attributes[name].getComponent(i,k));return v;});
    if(a.max)a.max=[0,1,2].map(k=>{let v=-Infinity;for(let i=0;i<a.count;i++)v=Math.max(v,g.attributes[name].getComponent(i,k));return v;});
  }
  allowed.sort((a,b)=>a[0]-b[0]);let at=0;for(const [a,b]of allowed){assert.deepEqual(bin.subarray(at,a),sourceGlb.subarray(28+n+at,28+n+a));at=b;}assert.deepEqual(bin.subarray(at),sourceGlb.subarray(28+n+at));
  assert.equal(j.animations.length,15);assert.equal(j.meshes.length,1);assert.equal(j.meshes[0].primitives.length,1);
  let json=Buffer.from(JSON.stringify(j));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
  const head=Buffer.alloc(20),bh=Buffer.alloc(8);head.write('glTF');head.writeUInt32LE(2,4);head.writeUInt32LE(28+json.length+bin.length,8);head.writeUInt32LE(json.length,12);head.write('JSON',16);bh.writeUInt32LE(bin.length);bh.write('BIN\0',4);
  fs.writeFileSync(file,Buffer.concat([head,json,bh,bin]));
}
writeRenderCopy(accepted,path.join(out,'courier-accepted-render-copy.glb'));
writeRenderCopy(changed,path.join(out,'courier-cloth-render-copy-v97.glb'));

const animationRoot=new T.Group();nodes.filter(n=>!n.parent).forEach(n=>animationRoot.add(n));
const bind=nodes.map(n=>[n.position.clone(),n.quaternion.clone(),n.scale.clone()]);
const mixer=new T.AnimationMixer(animationRoot),preview=[];let poseSamples=0,maxPosedMove=0;
function actualClip(a){return new T.AnimationClip(a.name,-1,a.channels.map(ch=>{const sampler=a.samplers[ch.sampler],property={translation:'position',rotation:'quaternion',scale:'scale'}[ch.target.path];
  const Track=property==='quaternion'?T.QuaternionKeyframeTrack:T.VectorKeyframeTrack;return new Track(nodes[ch.target.node].name+'.'+property,attribute(sampler.input).array,attribute(sampler.output).array);}));}
function restore(){nodes.forEach((n,i)=>{n.position.copy(bind[i][0]);n.quaternion.copy(bind[i][1]);n.scale.copy(bind[i][2]);});animationRoot.updateMatrixWorld(true);skeleton.update();}
for(const a of doc.animations){restore();const clip=actualClip(a),action=mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;action.play();
  for(const phase of [0,.125,.25,.375,.5,.625,.75,.875,.99]){
    mixer.setTime(clip.duration*phase);animationRoot.updateMatrixWorld(true);skeleton.update();poseSamples++;
    for(const v of changedVertices){const p=mesh.applyBoneTransform(v,vector(accepted,v)),q=changedMesh.applyBoneTransform(v,vector(changed,v));const delta=q.distanceTo(p);assert.ok(Number.isFinite(delta)&&delta<.13);maxPosedMove=Math.max(maxPosedMove,delta);}
    for(const v of protectedVertices){const p=mesh.applyBoneTransform(v,vector(accepted,v)),q=changedMesh.applyBoneTransform(v,vector(changed,v));assert.deepEqual(p,q);}
    if((a.name==='run'&&phase===.25)||(a.name==='hero_jump_l'&&phase===.5)||(a.name==='hero_roll'&&phase===.375)){
      const data={name:a.name,phase,meshes:[]};
      for(const [name,m,g]of [['accepted',mesh,accepted],['candidate',changedMesh,changed]]){
        const positions=[],normals=[];for(let v=0;v<g.attributes.position.count;v++){
          positions.push(...m.applyBoneTransform(v,vector(g,v)).toArray());
          const normal=vector(g,v,'normal'),result=new T.Vector3();
          for(let c=0;c<4;c++){const w=g.attributes.skinWeight.getComponent(v,c);if(!w)continue;const bi=g.attributes.skinIndex.getComponent(v,c),matrix=new T.Matrix3().setFromMatrix4(new T.Matrix4().fromArray(skeleton.boneMatrices,bi*16));result.addScaledVector(normal.clone().applyMatrix3(matrix),w);}
          normals.push(...result.normalize().toArray());
        }
        data.meshes.push({name,positions,normals});
      }
      preview.push(data);
    }
  }
  mixer.stopAllAction();mixer.uncacheClip(clip);
}
restore();
const colors=[];for(let i=0;i<geometry.attributes.position.count;i++){
  const y=geometry.attributes.position.getY(i),skin=weight(i,/^(Head|head_end|headfront|neck|LeftHand|RightHand)$/)>.45;
  const rgb=skin?[.52,.37,.23]:y<.205?[.72,.61,.43]:y<.755?[.18,.24,.25]:[.65,.20,.085];colors.push(...rgb);
}
fs.writeFileSync(path.join(stage,'preview-poses.json'),JSON.stringify({index:Array.from(index.array),colors,poses:preview}));
const report={candidateOnly:true,sourceHashes:hashes,vertices:geometry.attributes.position.count,triangles:index.count/3,
  changedVertices:changedVertices.length,protectedHeadHandShoeVertices:protectedVertices.length,
  protectedPositionsAndNormalsExact:true,bagSizingAndAnchorBoundsExact:true,sourceGeometryUnchanged:true,
  indicesUVsSkinWeightsJointsAndShaderAttributesExact:true,all15AnimationPayloadsExact:true,oneExistingSkinnedPrimitive:true,
  cloth:clothReport,oneTimeRefinementMs:startupMs,maxMove,minAreaRatio,maxAreaRatio,minFaceNormalCosine:minFaceCos,
  newlyReversedArtistFaces,minimumArtistAlignment,
  maxSeamPositionError,maxSeamNormalError,poseSamples,maxPosedMove,poseClips:doc.animations.map(a=>a.name),
  authoringCopiesOnly:'The two GLBs already contain the render-copy refinement. Do not install them under the original v14 filename or refine them again.'};
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
