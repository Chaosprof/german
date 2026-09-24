'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v140');
for(const dir of ['','frames'])fs.mkdirSync(path.join(stage,dir),{recursive:true});
if(!fs.existsSync(path.join(stage,'baseline.html')))fs.copyFileSync(path.join(root,'berlin-runner.html'),path.join(stage,'baseline.html'));
const html=fs.readFileSync(path.join(stage,'baseline.html'),'utf8'),test=fs.readFileSync(path.join(__dirname,'check_berlin_courier.cjs'),'utf8'),prefix=test.slice(0,test.indexOf('const before = Buffer'));
const {T,doc,bin,mesh,geometry,skeleton}=new Function('require','__dirname',prefix+'\nreturn {T,doc,bin,mesh,geometry,skeleton};')(require,__dirname);
const a=html.indexOf('  function refineCourierSilhouette(mesh) {'),b=html.indexOf('\n  // Both arms share',a);
const c=html.indexOf('  // BEGIN COURIER_CLOTH_PATCH_V97'),d=html.indexOf('  // END COURIER_CLOTH_PATCH_V97',c);
const e=html.indexOf('  // BEGIN COURIER_FORMS_PATCH_V114'),f=html.indexOf('  // END COURIER_FORMS_PATCH_V114',e);
new Function('THREE','atob',html.slice(c,d)+'\n'+html.slice(e,f)+'\n'+html.slice(a,b)+'\nreturn refineCourierSilhouette;')(T,atob)(mesh);
const surface=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));surface.updateMatrixWorld(true);
const ray=new T.Raycaster(),bary=new T.Vector3(),pa=new T.Vector3(),pb=new T.Vector3(),pc=new T.Vector3();
const probes=[];
for(const side of [-1,1])for(const y of [.02,.045,.07,.095,.12,.145,.17,.195,.22,.26,.30,.36,.42,.48,.56,.64,.72])for(const x of [.045,.08,.115,.15,.185])for(const direction of [-1,1]){
  ray.set(new T.Vector3(x*side,y,direction),new T.Vector3(0,0,-direction));
  const hit=ray.intersectObject(surface)[0];if(!hit)continue;
  const face=hit.face;
  T.Triangle.getBarycoord(hit.point,pa.fromBufferAttribute(geometry.attributes.position,face.a),pb.fromBufferAttribute(geometry.attributes.position,face.b),pc.fromBufferAttribute(geometry.attributes.position,face.c),bary);
  const value=(attr,k)=>attr.getComponent(face.a,k)*bary.x+attr.getComponent(face.b,k)*bary.y+attr.getComponent(face.c,k)*bary.z;
  const footWeight=Object.fromEntries([face.a,face.b,face.c].map(i=>[i,0]));
  for(const i of [face.a,face.b,face.c])for(let k=0;k<4;k++)if(/^(Left|Right)(Foot|ToeBase)$/.test(skeleton.bones[geometry.attributes.skinIndex.getComponent(i,k)].name))footWeight[i]+=geometry.attributes.skinWeight.getComponent(i,k);
  probes.push({side,y,x:x*side,direction,uv:hit.uv.toArray(),point:hit.point.toArray(),face:[face.a,face.b,face.c],bary:bary.toArray(),garment:[0,1,2,3].map(k=>value(mesh.geometry.attributes.aCourierGarment,k)),sleeve:value(mesh.geometry.attributes.aCourierSleeve,0),sole:value(mesh.geometry.attributes.aCourierSole,0),footWeight:footWeight[face.a]*bary.x+footWeight[face.b]*bary.y+footWeight[face.c]*bary.z});
}
const atlas=doc.bufferViews[doc.images[0].bufferView];fs.writeFileSync(path.join(stage,'source-atlas.webp'),bin.subarray(atlas.byteOffset||0,(atlas.byteOffset||0)+atlas.byteLength));
fs.writeFileSync(path.join(stage,'surface-probes.json'),JSON.stringify(probes));
const garment=mesh.geometry.attributes.aCourierGarment;
let min=Infinity,max=-Infinity,partial=0;for(let i=0;i<garment.count;i++)if(garment.getW(i)>0){min=Math.min(min,geometry.attributes.position.getY(i));max=Math.max(max,geometry.attributes.position.getY(i));if(garment.getW(i)<.99)partial++;}
console.log(JSON.stringify({probes:probes.length,shoeMaskHeight:[min,max],partiallyPaintedVertices:partial},null,2));
