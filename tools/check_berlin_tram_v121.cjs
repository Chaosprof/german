'use strict';
// Independently check the finished cab's physical apertures, topology and batching.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
function check(shipping=process.argv.includes('--shipping')) {
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-tram-v121');
const folder=path.join(root,shipping?'assets/models':'audit/berlin-parity-tram-v121/models');
const html=fs.readFileSync(path.join(root,shipping?'berlin-runner.html':'audit/berlin-parity-tram-v121/candidate.html'),'utf8');
function section(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j);}
const c=vm.createContext({console});
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('three.js r156 (MIT)'))[1],c);
const T=c.THREE;c.atob=s=>Buffer.from(s,'base64').toString('binary');c.clamp=T.MathUtils.clamp;
c.mat=(color,opts)=>new T.MeshStandardMaterial({color,...opts});c.MAT={metalDark:c.mat(0x23343b),tyre:c.mat(0x18232a)};c.STATION_MAT={steel:c.mat(0x596a75)};
c.PROP_TAIL=new T.MeshBasicMaterial({color:0xff4d3d});c.destRollMat=new T.MeshBasicMaterial();c.freezeObjectTree=g=>g.updateMatrixWorld(true);c.registerProp=(_,g)=>g;
for(const s of [section('  var geoCache = Object.create(null);','  // ------------------------------------------------- generated prop swaps'),
  section('  function mergeBoxes(specs) {','\n  // DRAW-CALL CONSOLIDATION:'),section('  var staticMergeGeometryCache = new Map();','  // Merges building parts that carry different materials'),
  fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8'),section('var BERLIN_VINTAGE_TRAM_DATA = ','  function makeRunnerTram() {'),
  section('  function makeRunnerTram() {','  function makeDeliveryMicrovan() {')])vm.runInContext(s,c);
const data=c.BERLIN_VINTAGE_TRAM_DATA,base=JSON.parse(fs.readFileSync(path.join(stage,'baseline/berlin-vintage-tram-v90.json')));
assert.equal(data.finishRevision,'raked-cab-visible-divider-v121');
assert.equal(JSON.stringify(data),JSON.stringify(JSON.parse(fs.readFileSync(path.join(folder,'berlin-vintage-tram-v90.json')))));
for(const key of ['collisionContract','colors','glassTexture'])assert.equal(JSON.stringify(data[key]),JSON.stringify(base[key]));
assert.equal(data.parts.length,base.parts.length);let changed=0;
for(let i=0;i<data.parts.length;i++){
  const p=data.parts[i],old=base.parts[i],a=data.meshes[p.mesh],b=base.meshes[p.mesh];
  for(const key of ['mesh','translation','quaternion','scale'])assert.equal(JSON.stringify(p[key]),JSON.stringify(old[key]),'preserved attachment '+p.mesh);
  assert.equal(p.role,['part_091','part_108'].includes(p.mesh)?'cream':old.role,'only visible divider material changes');
  for(const key of ['uv','index','triangles','vertices'])assert.equal(a[key],b[key],'exact topology and UVs '+p.mesh);
  if(a.position!==b.position)changed++;
}
assert.ok(changed>100,'whole coach and fittings deform together');
const tram=c.makeRunnerTram();tram.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(tram);
assert.ok(bounds.min.x>=-1.25001&&bounds.max.x<=1.25001&&bounds.min.y>=-.00001&&bounds.max.y<=4.52001&&bounds.min.z>=-4.00001&&bounds.max.z<=4.00001);
const total=tram.children.reduce((s,m)=>s+m.geometry.index.count/3,0);assert.equal(total,8200);
for(const m of tram.children){const {position:p,normal:n,uv}=m.geometry.attributes;
  for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)+uv.getX(i)+uv.getY(i)));assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.002);}
}
const ray=new T.Raycaster(),checks=[];
function probe(x,y,end,material,label){ray.set(new T.Vector3(x,y,end*9),new T.Vector3(0,0,-end));const hit=ray.intersectObject(tram,true)[0];
  assert.ok(hit&&hit.object.material===material,label+' '+end+' got '+(hit&&hit.object.userData.tramPart));checks.push({x,y,end,material,label,point:hit.point.clone()});return hit.point;
}
for(const end of [-1,1]){
  for(const x of [-.6,-.3,.3,.6])for(const y of [1.85,2.2,2.5])probe(x,y,end,c.makeRunnerTram.glazingMaterial,'both unobstructed windscreen panes');
  for(const y of [1.85,2.2,2.5])probe(0,y,end,c.makeRunnerTram.creamMaterial,'contrasting continuous centre pillar');
  for(const x of [-.93,.93])probe(x,2.2,end,c.makeRunnerTram.creamMaterial,'cream cab cheeks');
  for(const x of [-.6,0,.6])probe(x,1.4,end,c.makeRunnerTram.creamMaterial,'cream band below glass');
  for(const x of [-.8,0,.8])probe(x,.55,end,c.MAT.metalDark,'dark continuous bumper skirt');
  const low=probe(.5,1.85,end,c.makeRunnerTram.glazingMaterial,'rake lower'),high=probe(.5,2.5,end,c.makeRunnerTram.glazingMaterial,'rake upper');
  assert.ok(end*(low.z-high.z)>.045,'upper glazing visibly recedes from the lower glass');
}
c.compactStaticPropGroup(tram);tram.updateMatrixWorld(true);assert.equal(tram.children.length,9);assert.ok(tram.children.every(m=>!m.material.transparent&&m.castShadow));
for(const p of checks){ray.set(new T.Vector3(p.x,p.y,p.end*9),new T.Vector3(0,0,-p.end));const hit=ray.intersectObject(tram,true)[0];assert.ok(hit&&hit.object.material===p.material&&hit.point.distanceTo(p.point)<.00002,'batch preserves actual visible surface '+p.label);}
c.registerProp=(_,g)=>{c.compactStaticPropGroup(g);return g;};const second=c.makeRunnerTram();assert.ok(second.children.every((m,i)=>m.geometry===tram.children[i].geometry&&m.material===tram.children[i].material));
const glb=fs.readFileSync(path.join(folder,'berlin-vintage-tram-v90.glb')),len=glb.readUInt32LE(12),gltf=JSON.parse(glb.subarray(20,20+len));
assert.equal(gltf.materials.length,9);assert.ok(gltf.materials.every(m=>!m.alphaMode||m.alphaMode==='OPAQUE'));
assert.equal(gltf.meshes.reduce((s,m)=>s+m.primitives.reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0),0),8200);
const result={passed:true,shipping,triangles:total,draws:9,visibilityRays:checks.length,changedRecords:changed,exactUVTopology:true,exactCollisionContract:true,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
fs.writeFileSync(path.join(stage,shipping?'shipping-check.json':'geometry-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
return result;
}
module.exports=check;if(require.main===module)check();
