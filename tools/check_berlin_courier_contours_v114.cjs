'use strict';
// Independent comparison against the frozen normal-only V114 target.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'audit/berlin-model-forms-v114/courier');
function read(file){const raw=fs.readFileSync(file),length=raw.readUInt32LE(12),doc=JSON.parse(raw.subarray(20,20+length)),bin=raw.subarray(28+length);return{raw,doc,bin};}
const source=read(path.join(root,'assets/models/berlin-runner-hero-v14.glb'));
const baseline=read(path.join(dir,'normal-trial/courier-forms-v114-authoring.glb'));
const target=read(path.join(dir,'contour-trial/courier-forms-v114-authoring.glb'));
function accessor(model,key){const primitive=model.doc.meshes[0].primitives[0],a=model.doc.accessors[primitive.attributes[key]],b=model.doc.bufferViews[a.bufferView];const at=(b.byteOffset||0)+(a.byteOffset||0),count=a.count*(a.type==='VEC3'?3:4),Type={5121:Uint8Array,5123:Uint16Array,5126:Float32Array}[a.componentType];return{at,length:count*Type.BYTES_PER_ELEMENT,values:new Type(Uint8Array.from(model.bin.subarray(at,at+count*Type.BYTES_PER_ELEMENT)).buffer)};}
const sourceP=accessor(source,'POSITION'),beforeP=accessor(baseline,'POSITION'),beforeN=accessor(baseline,'NORMAL'),afterP=accessor(target,'POSITION'),afterN=accessor(target,'NORMAL'),skinI=accessor(source,'JOINTS_0').values,skinW=accessor(source,'WEIGHTS_0').values;
const names=source.doc.skins[0].joints.map(i=>source.doc.nodes[i].name);
const ranges=[afterP,afterN].map(a=>[a.at,a.at+a.length]).sort((a,b)=>a[0]-b[0]);
let at=0;for(const [a,b]of ranges){assert.deepEqual(target.bin.subarray(at,a),source.bin.subarray(at,a));at=b;}assert.deepEqual(target.bin.subarray(at),source.bin.subarray(at));
for(const key of ['animations','skins','nodes','materials','images','textures','meshes'])assert.deepEqual(target.doc[key],source.doc[key],key+' exact');
const fixture=fs.readFileSync(path.join(__dirname,'check_berlin_courier.cjs'),'utf8');
const {T,skeleton}=new Function('require','__dirname',fixture.slice(0,fixture.indexOf('const before = Buffer'))+'\nreturn {T,skeleton};')(require,__dirname);
const joints=skeleton.boneInverses.map(m=>new T.Vector3().setFromMatrixPosition(m.clone().invert()));
const wrists=['Left','Right'].map(s=>{const wrist=joints[names.indexOf(s+'Hand')],elbow=joints[names.indexOf(s+'ForeArm')];return{wrist,axis:wrist.clone().sub(elbow).normalize()};});
const preserved={lowerBody:0,forearmsAndCuffs:0};let changedVertices=0,maxAdditionalMove=0,upperBackVertices=0,maximumUpperBackMove=0;
for(let i=0;i<sourceP.values.length/3;i++){
  const raw=new T.Vector3().fromArray(sourceP.values,i*3),before=new T.Vector3().fromArray(beforeP.values,i*3),after=new T.Vector3().fromArray(afterP.values,i*3);
  let arm=0;for(let c=0;c<4;c++)if(/^(Left|Right)(Shoulder|Arm|ForeArm)$/.test(names[skinI[i*4+c]]))arm+=skinW[i*4+c];
  const frame=wrists[raw.x>=0?0:1],wrist=frame.wrist.clone().sub(raw).dot(frame.axis);
  const kinds=[];if(raw.y<=.721)kinds.push('lowerBody');if(arm>.5&&wrist<=.205)kinds.push('forearmsAndCuffs');
  if(raw.y>=1.01&&raw.y<1.17&&Math.abs(raw.x)<.08&&raw.z<-.08){upperBackVertices++;maximumUpperBackMove=Math.max(maximumUpperBackMove,before.distanceTo(after));}
  for(const kind of kinds){for(let k=0;k<3;k++){assert.equal(afterP.values[i*3+k],beforeP.values[i*3+k],kind+' position '+i);assert.equal(afterN.values[i*3+k],beforeN.values[i*3+k],kind+' normal '+i);}preserved[kind]++;}
  const delta=before.distanceTo(after);maxAdditionalMove=Math.max(maxAdditionalMove,delta);if(delta>0)changedVertices++;
}
assert.ok(preserved.lowerBody>2000&&preserved.forearmsAndCuffs>100,JSON.stringify(preserved));
assert.ok(upperBackVertices>30&&maximumUpperBackMove<.0075,JSON.stringify({upperBackVertices,maximumUpperBackMove}));
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const report={baseline:'Frozen V114 normal-trial authoring GLB',target:'V114 contour-trial complete patch',preserved,allNontargetBinBytesExact:true,originalAnimationsSkinUVsMaterialsExact:true,changedPositionVertices:changedVertices,maxAdditionalMove,upperBackVertices,maximumUpperBackMove,originalHeroSha256:sha(source.raw),patchSha256:sha(fs.readFileSync(path.join(dir,'contour-trial/courier-forms-v114.bin'))),inlineSha256:sha(fs.readFileSync(path.join(dir,'contour-trial/courier-forms-v114.inline.js')))};
fs.writeFileSync(path.join(dir,'contour-trial/additional-preservation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
