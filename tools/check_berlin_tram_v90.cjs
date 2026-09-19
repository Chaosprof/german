'use strict';
// Exercise actual staged geometry and material batching, independent of screenshots.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-tram-roof-v103');
const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
function section(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j);}
const c=vm.createContext({console});
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('three.js r156 (MIT)'))[1],c);
const THREE=c.THREE;c.atob=s=>Buffer.from(s,'base64').toString('binary');c.clamp=THREE.MathUtils.clamp;
c.mat=(color,opts)=>new THREE.MeshStandardMaterial({color,...opts});
c.MAT={metalDark:c.mat(0x23343b),tyre:c.mat(0x18232a)};c.STATION_MAT={steel:c.mat(0x596a75)};
c.PROP_TAIL=new THREE.MeshBasicMaterial({color:0xff4d3d});c.destRollMat=new THREE.MeshBasicMaterial();
c.freezeObjectTree=root=>root.updateMatrixWorld(true);c.registerProp=(kind,root)=>root;
for(const source of [section('  var geoCache = Object.create(null);','  // ------------------------------------------------- generated prop swaps'),
  section('  function mergeBoxes(specs) {','\n  // DRAW-CALL CONSOLIDATION:'),
  section('  var staticMergeGeometryCache = new Map();','  // Merges building parts that carry different materials'),
  fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8'),
  fs.readFileSync(path.join(stage,'models/berlin-vintage-tram-v90.inline.js'),'utf8'),
  fs.readFileSync(path.join(stage,'makeRunnerTram.js'),'utf8')])vm.runInContext(source,c);
const data=c.BERLIN_VINTAGE_TRAM_DATA,source=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-tram-v90/baseline/tram-source.json')));
const tram=c.makeRunnerTram();tram.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(tram);
const initial=JSON.parse(fs.readFileSync(path.join(stage,'baseline/berlin-vintage-tram-v90.json')));
const refitted=new Set();
const roofEdits=new Set([63,64,65,66,67,68,69,70,71,72,75,76,77,78,81,82,83,84,85].map(i=>'part_'+String(i).padStart(3,'0')));
assert.equal(data.roofRevision,'raised-equipment-v103');
data.parts.forEach((p,i)=>{if(!roofEdits.has(p.mesh))assert.equal(JSON.stringify(p),JSON.stringify(initial.parts[i]),'non-roof object transform exact');});
for(const [name,record]of Object.entries(initial.meshes))if(!refitted.has(name))
  assert.ok(JSON.stringify(data.meshes[name])===JSON.stringify(record),'readability pass preserves exact geometry: '+name);
const pixels=Buffer.from(data.glassTexture.data,'base64');assert.equal(pixels.length,128*128*4);
const rowMean=y=>{let total=0;for(let x=0;x<128;x++)total+=(pixels[(y*128+x)*4]+pixels[(y*128+x)*4+1]+pixels[(y*128+x)*4+2])/3;return total/128;};
assert.ok(rowMean(110)-rowMean(16)>50&&rowMean(16)<70,'deep lower glass with a clear broad sky gradient');
for(let y=0;y<128;y++)for(let x=0;x<128;x++){
  const i=(y*128+x)*4;assert.equal(pixels[i+3],255,'reflection stays opaque');
  if(x)for(let k=0;k<3;k++)assert.ok(Math.abs(pixels[i+k]-pixels[i-4+k])<5,'no high-frequency glass noise');
}
assert.ok(bounds.min.x>=-1.25001&&bounds.max.x<=1.25001&&bounds.min.y>=-.00001&&Math.abs(bounds.max.y-4.10)<.000002&&bounds.min.z>=-4.00001&&bounds.max.z<=4.00001);
const materials=new Set(tram.children.map(o=>o.material));assert.equal(materials.size,9);
const total=tram.children.reduce((n,o)=>n+o.geometry.index.count/3,0);assert.equal(total,7796);
for(const mesh of tram.children){
  const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,uv=mesh.geometry.attributes.uv;
  assert.ok(p&&n&&uv);
  for(let i=0;i<p.count;i++){
    assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)+uv.getX(i)+uv.getY(i)));
    assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.002,'finite normalized authored normals');
  }
}
const glb=fs.readFileSync(path.join(stage,'models/berlin-vintage-tram-v90.glb'));
const gltf=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString('utf8'));
assert.equal(gltf.materials.length,9);assert.ok(gltf.materials.every(m=>!m.alphaMode||m.alphaMode==='OPAQUE'));
assert.equal(gltf.meshes.reduce((n,m)=>n+m.primitives.reduce((s,p)=>s+gltf.accessors[p.indices].count/3,0),0),total,'actual GLB topology matches runtime');
const bodyEdges=new Map();let bodyFaces=0;
for(const mesh of tram.children.filter(o=>o.userData.tramPart.startsWith('body_'))){
  const p=mesh.geometry.attributes.position,index=mesh.geometry.index;
  const key=v=>[p.getX(v),p.getY(v),p.getZ(v)].map(x=>x.toFixed(5)).join(',');
  for(let i=0;i<index.count;i+=3){
    const v=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    for(let j=0;j<3;j++){const edge=[key(v[j]),key(v[(j+1)%3])].sort().join('|');bodyEdges.set(edge,(bodyEdges.get(edge)||0)+1);}
    bodyFaces++;
  }
}
assert.ok([...bodyEdges.values()].every(n=>n===2),'hollow body is enclosed through every window return: '+JSON.stringify([...bodyEdges].filter(([k,n])=>n!==2).slice(0,12)));
let preserved=0;
for(let pi=2;pi<source.parts.length;pi++){
  const before=source.parts[pi],part=data.parts.find(p=>p.mesh===before.name),mesh=tram.children.find(o=>o.userData.tramPart===before.name);
  if(roofEdits.has(part.mesh))continue;
  assert.equal(JSON.stringify(part.translation),JSON.stringify(before.translation));
  assert.equal(JSON.stringify(part.quaternion),JSON.stringify(before.quaternion));
  if(Math.abs(before.translation[2])>3.7)continue;
  const oldIndex=before.index,g=mesh.geometry;
  assert.equal(g.index.count,oldIndex.length,'roof/bogie/equipment topology retained');
  for(let i=0;i<oldIndex.length;i++)for(let k=0;k<3;k++){
    const vi=g.index.getX(i),old=oldIndex[i];
    assert.ok(Math.abs(g.attributes.position.array[vi*3+k]-before.position[old*3+k])<.000002,'protected equipment position');
    assert.ok(Math.abs(g.attributes.normal.array[vi*3+k]/32767-before.normal[old*3+k])<.00007,'protected equipment normal');
  }
  preserved++;
}
assert.equal(preserved,65);
const ray=new THREE.Raycaster(),probes=[],frameProbes=[];
for(const [end,rimName,mullionName]of [[-1,'part_086','part_091'],[1,'part_103','part_108']]){
  const rim=tram.children.find(o=>o.userData.tramPart===rimName),mullion=tram.children.find(o=>o.userData.tramPart===mullionName);
  assert.equal(rim.material,c.makeRunnerTram.creamMaterial);assert.equal(mullion.material,c.makeRunnerTram.creamMaterial);
  const mb=new THREE.Box3().setFromObject(mullion);assert.ok(Math.abs(mb.max.x-mb.min.x-.050)<.00001,'restrained 5 cm center strip');
  for(const [x,y,part]of [[0,1.91,mullion],[-1.039,1.90,rim],[1.039,1.90,rim],[-.45,2.46,rim],[.45,2.46,rim],[-.45,1.35,rim],[.45,1.35,rim]]){
    const origin=new THREE.Vector3(x,y,end*9);ray.set(origin,new THREE.Vector3(0,0,-end));
    const hit=ray.intersectObject(part)[0];assert.ok(hit,'cream rim and center strip face the cab viewer');
    frameProbes.push({origin,point:hit.point.clone(),material:part.material});
  }
}
for(const part of tram.children){
  const role=part.userData.tramRole,glass=role==='glass',lamp=role==='headlamp'||role==='tail',sign=role==='destination';
  const bumper=role==='dark'&&Math.abs(part.position.z)>3.9;
  if(!glass&&!lamp&&!sign&&!bumper)continue;
  const box=new THREE.Box3().setFromObject(part),center=box.getCenter(new THREE.Vector3());
  const sideGlass=glass&&box.max.x-box.min.x<.15;
  const origins=sideGlass?[-4,0,4].map(offset=>new THREE.Vector3(Math.sign(center.x)*7,4.2,center.z+offset)):
    [-4,0,4].map(x=>new THREE.Vector3(x,4.5,Math.sign(center.z)*12));
  const horizontal=glass?[-.27,-.13,.13,.27]:sign?[-.22,.035,.22]:[-.22,0,.22];
  for(const origin of origins)for(const u of horizontal)for(const v of [-.19,0,.19]){
    const target=center.clone();if(sideGlass)target.z+=u*(box.max.z-box.min.z);else target.x+=u*(box.max.x-box.min.x);
    target.y+=v*(box.max.y-box.min.y);ray.set(origin,target.sub(origin).normalize());
    const hit=ray.intersectObject(part)[0];assert.ok(hit,'probe hits '+part.userData.tramPart+' '+role);
    probes.push({origin,point:hit.point.clone(),material:part.material,name:part.userData.tramPart,role});
  }
}
c.compactStaticPropGroup(tram);tram.updateMatrixWorld(true);
const failures=[];
for(const probe of probes){
  ray.set(probe.origin,probe.point.clone().sub(probe.origin).normalize());const hit=ray.intersectObject(tram,true)[0];
  if(!(hit&&hit.object.material===probe.material&&hit.point.distanceTo(probe.point)<.00002))failures.push({part:probe.name,role:probe.role,point:probe.point.toArray(),origin:probe.origin.toArray(),hit:hit&&hit.point.toArray(),material:hit&&hit.object.material===c.makeRunnerTram.creamMaterial?'cream':'other'});
}
if(failures.length)fs.writeFileSync(path.join(stage,'trim-failures.json'),JSON.stringify(failures,null,2));
assert.equal(failures.length,0,'real cab/side/door apertures expose all trim probes: '+JSON.stringify(failures.slice(0,8)));
assert.equal(probes.length,792);assert.equal(tram.children.length,9);
for(const probe of frameProbes){
  ray.set(probe.origin,probe.point.clone().sub(probe.origin).normalize());const hit=ray.intersectObject(tram,true)[0];
  assert.ok(hit&&hit.object.material===probe.material&&hit.point.distanceTo(probe.point)<.00002,'cab frame remains visible on the complete tram');
}
assert.ok(tram.children.every(o=>!o.material.transparent&&o.castShadow));
c.registerProp=(kind,g)=>{c.compactStaticPropGroup(g);return g;};
const repeat=c.makeRunnerTram(),clone=repeat.clone(true);
assert.ok(repeat.children.every((o,i)=>o.geometry===tram.children[i].geometry&&o.material===tram.children[i].material),'repeated templates share compacted assets');
assert.ok(clone.children.every((o,i)=>o.geometry===repeat.children[i].geometry&&o.material===repeat.children[i].material),'pooled clones share all assets');
// Genuine broad curvature: nose recedes toward its outer corner and the roof
// continuously rolls down toward the side while staying under the equipment.
const noseDepth=[];
for(const x of [0,.4,.7,.95,1.10]){
  ray.set(new THREE.Vector3(x,.98,-8),new THREE.Vector3(0,0,1));const hit=ray.intersectObjects(tram.children.filter(o=>o.material===c.makeRunnerTram.yellowMaterial))[0];
  assert.ok(hit,'real rounded front body');noseDepth.push(hit.point.z);
}
assert.ok(noseDepth[4]-noseDepth[0]>.15,'front shoulders curve at least15cm into the side');
const heights=[];
for(const x of [0,.4,.7,.95,1.10]){
  ray.set(new THREE.Vector3(x,4.5,2.5),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(tram,true)[0];
  assert.ok(hit&&hit.object.material===c.makeRunnerTram.creamMaterial,'continuous cream barrel roof');heights.push(hit.point.y);
}
assert.ok(heights.every((v,i)=>i===0||v<heights[i-1])&&heights[0]-heights[4]>.15,'roof crown rolls smoothly toward the shoulders');
const report={ok:true,triangles:total,bodyFaces,watertightBody:true,draws:tram.children.length,visibleTrimRays:probes.length,visibleFrameRays:frameProbes.length,initialBodyAndOtherPartsExact:true,skyGradientRowMeans:[rowMean(16),rowMean(110)],preservedEquipmentParts:preserved,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},noseDepth,roofHeights:heights};
fs.writeFileSync(path.join(stage,'geometry-check.json'),JSON.stringify(report,null,2));console.log('PASS: '+JSON.stringify(report));
