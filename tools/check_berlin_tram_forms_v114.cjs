'use strict';
// Actual runtime factory + batching, with a choice of staged or shipped payload.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-model-forms-v114/tram');
const shipped=process.argv.includes('--shipping'),upright=process.argv.includes('--upright'),folder=shipped?path.join(root,'assets/models'):path.join(stage,upright?'upright/models':'models');
const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
function section(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j);}
const c=vm.createContext({console});
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('three.js r156 (MIT)'))[1],c);
const T=c.THREE;c.atob=s=>Buffer.from(s,'base64').toString('binary');c.clamp=T.MathUtils.clamp;
c.mat=(color,opts)=>new T.MeshStandardMaterial({color,...opts});
c.MAT={metalDark:c.mat(0x23343b),tyre:c.mat(0x18232a)};c.STATION_MAT={steel:c.mat(0x596a75)};
c.PROP_TAIL=new T.MeshBasicMaterial({color:0xff4d3d});c.destRollMat=new T.MeshBasicMaterial();
c.freezeObjectTree=g=>g.updateMatrixWorld(true);c.registerProp=(kind,g)=>g;
const packedText=fs.readFileSync(path.join(folder,'berlin-vintage-tram-v90.inline.js'),'utf8');
const payload=shipped?section('var BERLIN_VINTAGE_TRAM_DATA = ','  function makeRunnerTram() {'):packedText;
for(const source of [section('  var geoCache = Object.create(null);','  // ------------------------------------------------- generated prop swaps'),
 section('  function mergeBoxes(specs) {','\n  // DRAW-CALL CONSOLIDATION:'),
 section('  var staticMergeGeometryCache = new Map();','  // Merges building parts that carry different materials'),
 fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8'),payload,
 section('  function makeRunnerTram() {','  function makeDeliveryMicrovan() {')])vm.runInContext(source,c);
const data=c.BERLIN_VINTAGE_TRAM_DATA;
assert.equal(JSON.stringify(data),JSON.stringify(JSON.parse(fs.readFileSync(path.join(folder,'berlin-vintage-tram-v90.json')))),'loaded runtime equals canonical/staged JSON');
if(shipped){const p=vm.createContext({});vm.runInContext(packedText,p);assert.equal(JSON.stringify(p.BERLIN_VINTAGE_TRAM_DATA),JSON.stringify(data),'inline source matches shipping HTML');}
const base=JSON.parse(fs.readFileSync(path.join(stage,'baseline/berlin-vintage-tram-v90.json')));
const report=JSON.parse(fs.readFileSync(path.join(stage,'build-report.json'))),edits=new Set(report.editedParts);
assert.equal(data.cabRevision,'sculpted-recessed-cab-v114');assert.equal(data.roofRevision,base.roofRevision);
assert.deepEqual(JSON.parse(JSON.stringify(data.collisionContract)),base.collisionContract);
assert.deepEqual(JSON.parse(JSON.stringify(data.colors)),base.colors);assert.deepEqual(JSON.parse(JSON.stringify(data.glassTexture)),base.glassTexture);
assert.equal(data.parts.length,122);assert.equal(base.parts.length,120);
let protectedCount=0;
for(let i=0;i<120;i++){
  const p=data.parts[i],old=base.parts[i];assert.equal(p.mesh,old.mesh,'original part order prefix');
  for(const k of ['translation','quaternion','scale'])assert.equal(JSON.stringify(p[k]),JSON.stringify(old[k]),'exact transform '+p.mesh);
  if(!upright&&!edits.has(p.mesh)){assert.equal(JSON.stringify(data.meshes[p.mesh]),JSON.stringify(base.meshes[p.mesh]),'exact protected record '+p.mesh);assert.equal(p.role,old.role);protectedCount++;}
}
if(!upright){assert.equal(protectedCount,104);assert.ok(report.bodyGeometryExact&&report.roofGeometryAndTransformsExact);}
function shape(x,y) {
  const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
  return [x*(1-.035*smooth(1.25,2.8,y)),y+.42*smooth(.7,2.8,y)];
}
if(upright) {
  assert.equal(data.proportionRevision,'upright-coach-v114');
  const cab=JSON.parse(fs.readFileSync(path.join(stage,'models/berlin-vintage-tram-v90.json')));
  assert.equal(JSON.stringify(data.parts),JSON.stringify(cab.parts),'all part transforms/material roles exact');
  for(const p of data.parts) {
    const old=cab.meshes[p.mesh],now=data.meshes[p.mesh];
    for(const key of ['uv','index','triangles','vertices'])assert.equal(now[key],old[key],'coach contour keeps topology and UVs '+p.mesh);
    const matrix=new T.Matrix4().compose(new T.Vector3().fromArray(p.translation),new T.Quaternion().fromArray(p.quaternion),new T.Vector3().fromArray(p.scale));
    const a=Buffer.from(old.position,'base64'),b=Buffer.from(now.position,'base64');
    for(let i=0;i<old.vertices;i++) {
      const source=new T.Vector3(...[0,1,2].map(k=>a.readFloatLE(i*12+k*4))).applyMatrix4(matrix);
      const target=new T.Vector3(...[0,1,2].map(k=>b.readFloatLE(i*12+k*4))).applyMatrix4(matrix);
      const expected=shape(source.x,source.y);
      assert.ok(target.distanceTo(new T.Vector3(expected[0],expected[1],source.z))<.000005,'baked coach geometry equals shape in world coordinates');
    }
  }
}

const tram=c.makeRunnerTram();tram.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(tram);
assert.ok(bounds.min.x>=-1.25001&&bounds.max.x<=1.25001&&bounds.min.y>=-.00001&&Math.abs(bounds.max.y-(upright?4.52:4.1))<.00001&&bounds.min.z>=-4.00001&&bounds.max.z<=4.00001);
const total=tram.children.reduce((s,m)=>s+m.geometry.index.count/3,0);assert.equal(total,report.triangles);assert.ok(total<=10000);
for(const mesh of tram.children){
  const {position:p,normal:n,uv}=mesh.geometry.attributes;assert.ok(p&&n&&uv);
  for(let i=0;i<p.count;i++){
    assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)+uv.getX(i)+uv.getY(i)),'finite attributes');
    assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.002,'normalized normal '+mesh.userData.tramPart);
  }
}
const glb=fs.readFileSync(path.join(folder,'berlin-vintage-tram-v90.glb'));
const gltf=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString());
assert.equal(gltf.materials.length,9);assert.ok(gltf.materials.every(m=>!m.alphaMode||m.alphaMode==='OPAQUE'));
assert.equal(gltf.meshes.reduce((s,m)=>s+m.primitives.reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0),0),total,'GLB triangles agree');
const ray=new T.Raycaster(),checks=[];
function probe(x,y,end,material,label){
 if(upright)[x,y]=shape(x,y);
 ray.set(new T.Vector3(x,y,end*9),new T.Vector3(0,0,-end));
 const hit=ray.intersectObject(tram,true)[0];assert.ok(hit&&hit.object.material===material,label+' '+end+' got '+(hit&&hit.object.userData.tramPart));
 checks.push({x,y,end,material,label,point:hit.point.clone()});
}
for(const end of [-1,1]){
 for(const x of [-.65,-.3,.3,.65])for(const y of [1.6,1.91,2.20])probe(x,y,end,c.makeRunnerTram.glazingMaterial,'open actual glazing aperture');
 for(const x of [-1.025,1.025])probe(x,1.91,end,c.makeRunnerTram.creamMaterial,'rounded cream cheek');
 for(const x of [-.902,.902])probe(x,1.91,end,c.MAT.metalDark,'deep black gasket');
 probe(0,1.91,end,c.MAT.metalDark,'dimensional central post');
 for(const x of [-.6,0,.6])probe(x,1.303,end,c.makeRunnerTram.creamMaterial,'exposed curved sill');
 for(const x of [-.8,0,.8])probe(x,.55,end,c.MAT.metalDark,'curved lower skirt');
 probe(.371,1.67,end,c.MAT.metalDark,'raised diagonal wiper');
}
c.compactStaticPropGroup(tram);tram.updateMatrixWorld(true);
assert.equal(tram.children.length,9);assert.ok(tram.children.every(m=>!m.material.transparent&&m.castShadow));
for(const p of checks){ray.set(new T.Vector3(p.x,p.y,p.end*9),new T.Vector3(0,0,-p.end));const hit=ray.intersectObject(tram,true)[0];assert.ok(hit&&hit.object.material===p.material&&hit.point.distanceTo(p.point)<.00002,'merged visibility '+p.label);}
c.registerProp=(kind,g)=>{c.compactStaticPropGroup(g);return g;};const repeated=c.makeRunnerTram();
assert.ok(repeated.children.every((m,i)=>m.geometry===tram.children[i].geometry&&m.material===tram.children[i].material),'shared batched templates');
const result={ok:true,shipping:shipped,triangles:total,draws:tram.children.length,protectedRecords:protectedCount,exactExistingTransforms:120,
 apertureAndCoachworkVisibilityRays:checks.length,bodyExact:!upright,roofExact:!upright,proportions:upright?'upright-coach-v114':'original',collisionContract:data.collisionContract,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
fs.writeFileSync(path.join(stage,upright?'upright/'+(shipped?'shipping-check.json':'geometry-check.json'):(shipped?'shipping-check.json':'geometry-check.json')),JSON.stringify(result,null,2));console.log('PASS '+JSON.stringify(result));
