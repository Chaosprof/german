'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-model-forms-v114/courier/contour-trial');fs.mkdirSync(stage,{recursive:true});
const script=fs.readFileSync(path.join(__dirname,'check_berlin_courier.cjs'),'utf8'),prefix=script.slice(0,script.indexOf('const before = Buffer'));
const {T,geometry,mesh,skeleton}=new Function('require','__dirname',prefix+'\nreturn {T,geometry,mesh,skeleton};')(require,__dirname);
const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
const a=html.indexOf('  function refineCourierSilhouette(mesh) {'),b=html.indexOf('\n  // Both arms share',a),c=html.indexOf('  // BEGIN COURIER_CLOTH_PATCH_V97'),d=html.indexOf('  // END COURIER_CLOTH_PATCH_V97',c);
new Function('THREE','atob',html.slice(c,d)+'\n'+html.slice(a,b).replace('    applyBerlinCourierFormsPatchV114(geo);','')+'\nreturn refineCourierSilhouette;')(T,atob)(mesh);
const g=mesh.geometry,p=g.attributes.position,idx=g.index,si=geometry.attributes.skinIndex,sw=geometry.attributes.skinWeight,names=skeleton.bones.map(b=>b.name),joints=skeleton.boneInverses.map(m=>new T.Vector3().setFromMatrixPosition(m.clone().invert()));
const welds=new Map(),vid=[],parents=[];
for(let i=0;i<p.count;i++){const k=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(6)).join(',');if(!welds.has(k)){welds.set(k,welds.size);parents.push(parents.length);}vid.push(welds.get(k));}
const parent=i=>parents[i]===i?i:parents[i]=parent(parents[i]);
const edges=new Map();
for(let t=0;t<idx.count;t+=3)for(let k=0;k<3;k++){
  const a=vid[idx.getX(t+k)],b=vid[idx.getX(t+(k+1)%3)];parents[parent(a)]=parent(b);
  const key=[a,b].sort((a,b)=>a-b).join(',');edges.set(key,(edges.get(key)||0)+1);
}
const groups=new Map();for(let i=0;i<p.count;i++){
  const root=parent(vid[i]);if(!groups.has(root))groups.set(root,{vertices:[],bounds:new T.Box3()});const group=groups.get(root);group.vertices.push(i);group.bounds.expandByPoint(new T.Vector3().fromBufferAttribute(p,i));
}
const components=[...groups.values()].map(g=>({vertices:g.vertices.length,min:g.bounds.min.toArray(),max:g.bounds.max.toArray()})).sort((a,b)=>b.vertices-a.vertices);
const colors=JSON.parse(fs.readFileSync(path.join(stage,'source-colors.json'),'utf8'));
const rings={Left:{},Right:{}},hem=[];
for(let i=0;i<p.count;i++){
  const m={Left:0,Right:0};let leg=0,spine=0;
  for(let k=0;k<4;k++){const name=names[si.getComponent(i,k)],w=sw.getComponent(i,k);if(/^Left(Shoulder|Arm)$/.test(name))m.Left+=w;if(/^Right(Shoulder|Arm)$/.test(name))m.Right+=w;if(/(UpLeg|Leg)$/.test(name))leg+=w;if(/Spine/.test(name))spine+=w;}
  const q=new T.Vector3().fromBufferAttribute(p,i);
  for(const side of ['Left','Right'])if(m[side]>.45){
    const a=joints[names.indexOf(side+'Arm')],axis=joints[names.indexOf(side+'ForeArm')].clone().sub(a).normalize(),d=q.clone().sub(a),along=d.dot(axis),r=d.addScaledVector(axis,-along).length();
    const bucket=Math.floor(along/.025)*.025,key=bucket.toFixed(3);(rings[side][key]||(rings[side][key]=[])).push(r);
  }
  if(geometry.attributes.position.getY(i)>.67&&geometry.attributes.position.getY(i)<.84&&colors[i].cloth>.8&&Math.abs(q.x)<.3)hem.push({i,p:q.toArray(),rawY:geometry.attributes.position.getY(i),spine,leg});
}
for(const side of ['Left','Right'])for(const [k,v]of Object.entries(rings[side])){v.sort((a,b)=>a-b);rings[side][k]={count:v.length,min:v[0],q25:v[Math.floor(v.length*.25)],median:v[Math.floor(v.length*.5)],q75:v[Math.floor(v.length*.75)],max:v.at(-1)};}
const angular=Array.from({length:16},()=>[]);hem.forEach(v=>{const theta=Math.atan2(v.p[2]-.018,v.p[0])+Math.PI;angular[Math.min(15,Math.floor(theta/(Math.PI*2)*16))].push(v);});
const hemProfile=angular.map((vs,k)=>({angle:k*22.5,count:vs.length,min:Math.min(...vs.map(v=>v.p[1])),max:Math.max(...vs.map(v=>v.p[1]))}));
const report={components,boundaryEdges:[...edges].filter(([_,n])=>n===1).length,rings,hem,hemProfile};fs.writeFileSync(path.join(stage,'inspection.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({components,boundaryEdges:report.boundaryEdges,rings,hemCount:hem.length,hemProfile},null,2));
