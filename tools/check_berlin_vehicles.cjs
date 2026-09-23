'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const assert = require('assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'berlin-runner.html'), 'utf8');
function section(a, b) {
  const start = html.indexOf(a), end = html.indexOf(b, start + a.length);
  assert.ok(start >= 0 && end > start, a);
  return html.slice(start, end);
}
const c = vm.createContext({console});
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(m => m[1]).find(s => s.includes('three.js r156 (MIT)')), c);
const THREE = c.THREE;
c.atob=value=>Buffer.from(value,'base64').toString('binary');
const tramData=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/models/berlin-vintage-tram-v90.json'),'utf8'));
const tramBlock=section('  // BEGIN BLENDER VINTAGE TRAM','  // END BLENDER VINTAGE TRAM');
const tramAssignment=tramBlock.match(/^\s*\/\/ BEGIN BLENDER VINTAGE TRAM\s+var BERLIN_VINTAGE_TRAM_DATA\s*=\s*([\s\S]*);\s*$/);
assert.ok(tramAssignment,'the playable build contains one marked Blender tram data assignment');
assert.deepEqual(JSON.parse(tramAssignment[1]),tramData,'the embedded Blender tram data exactly matches the validated asset');
const tramInline=tramAssignment[0];
vm.runInContext(fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8'),c);
vm.runInContext(tramInline,c);
c.BERLIN_KIEZ_CAR_BODY=JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/models/berlin-kiez-car-body-v1.json'),'utf8'));
assert.ok(html.includes('var BERLIN_KIEZ_CAR_BODY = '+JSON.stringify(c.BERLIN_KIEZ_CAR_BODY)+';'),
  'the playable build contains the current Blender car shells');
c.clamp = THREE.MathUtils.clamp;
c.mat = (color, options) => new THREE.MeshStandardMaterial({color, ...options});
c.MAT = new Proxy({}, {get(target, name) {
  return target[name] || (target[name] = c.mat(0x72899a));
}});
c.PROP_TAIL = c.mat(0xd83929);
c.freezeObjectTree = root => root.updateMatrixWorld(true);
vm.runInContext(section('  var geoCache = Object.create(null);', '  // ------------------------------------------------- generated prop swaps'), c);
vm.runInContext(section('  function mergeBoxes(specs) {', '\n  // DRAW-CALL CONSOLIDATION:'), c);
vm.runInContext(section('  var staticMergeGeometryCache = new Map();', '  // Merges building parts that carry different materials'), c);
c.registerProp = (_kind, root) => { c.compactStaticPropGroup(root); return root; };
vm.runInContext(section('  function makeCar(colorHex) {', '  // Ampelmännchen crossing light'), c);
// The painted decks need a real crown, closed outward-facing surfaces and
// visible trim after batching. Flat replacement boxes or an oversized crown
// must not pass simply because the material and mesh counts still match.
const carCompactRegister = c.registerProp;
c.registerProp = (_kind, root) => root;
const shapedCar = c.makeCar(0x448877);
c.registerProp = carCompactRegister;
shapedCar.updateMatrixWorld(true);
const carRay = new THREE.Raycaster(), carDown = new THREE.Vector3(0,-1,0);
for (const [name,z] of [['bonnet',1.3],['boot',-1.5],['roof',-0.2]]) {
  const geometry = c.geoCache[`trabant_crowned_${name}_v1`];
  const mesh = shapedCar.children.find(o => o.geometry === geometry);
  assert.ok(mesh && geometry.index, `${name} is a cached indexed painted surface`);
  const positions = geometry.attributes.position;
  assert.equal(geometry.attributes.normal.count,positions.count);
  assert.equal(geometry.attributes.uv.count,positions.count);
  const edges = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  const pointKey = i => [positions.getX(i),positions.getY(i),positions.getZ(i)].map(v => v.toFixed(6)).join(',');
  for (let i=0;i<geometry.index.count;i+=3) {
    const ids = [0,1,2].map(j => geometry.index.getX(i+j));
    a.fromBufferAttribute(positions,ids[0]); b.fromBufferAttribute(positions,ids[1]); d.fromBufferAttribute(positions,ids[2]);
    const normal = b.sub(a).cross(d.sub(a));
    assert.ok(normal.lengthSq()>1e-12, `${name} has no degenerate faces`);
    for(let j=0;j<3;j++) {
      const endpoints = [pointKey(ids[j]),pointKey(ids[(j+1)%3])].sort();
      const key=endpoints.join('|'); edges.set(key,(edges.get(key)||0)+1);
    }
  }
  assert.ok([...edges.values()].every(n=>n===2), `${name} is watertight across its duplicated cap rims`);
  geometry.computeBoundingBox();
  const halfWidth=geometry.boundingBox.max.x, heights=[];
  for(const x of [0,0.3,0.6,0.95]) {
    carRay.set(new THREE.Vector3(x*halfWidth,3,z),carDown);
    const hit=carRay.intersectObject(mesh)[0];
    assert.ok(hit && hit.face.normal.y>0, `${name} crown faces upward and remains visible`);
    heights.push(hit.point.y);
  }
  assert.ok(heights.every((h,i)=>i===0||h<heights[i-1]) && heights[0]-heights[3]>0.024,
    `${name} slopes continuously from its centre to its shoulder`);
}
const carTrimProbes=[];
for(const end of [-1,1]) for(const cameraX of [-4,0,4]) {
  const origin=new THREE.Vector3(cameraX,3.5,end*9);
  for(const part of shapedCar.children.filter(o=>o.isMesh)) {
    const glass=part.material===shapedCar.userData.glazingMat;
    if(!glass && part.material!==(end>0?shapedCar.userData.headlampMat:c.PROP_TAIL)) continue;
    const bounds=new THREE.Box3().setFromObject(part), centre=bounds.getCenter(new THREE.Vector3());
    if(centre.z*end<=0 || (glass && bounds.max.x-bounds.min.x<1)) continue;
    for(const u of [-1,0,1]) for(const v of [-1,0,1]) {
      const target=centre.clone();
      target.x+=u*(bounds.max.x-bounds.min.x)*0.22;
      target.y+=v*(bounds.max.y-bounds.min.y)*0.17;
      carRay.set(origin,target.sub(origin).normalize());
      const hit=carRay.intersectObject(part)[0];
      assert.ok(hit,'probe reaches actual windshield or lamp geometry');
      carTrimProbes.push({origin:origin.clone(),point:hit.point.clone(),material:part.material});
    }
  }
}
const bodyShell=shapedCar.children.find(o=>o.geometry===c.geoCache.blender_kiez_car_v1_body);
assert.ok(bodyShell,'the running car uses its authored Blender body');
for(const side of [-1,1])for(const z of [-1.35,1.35])for(const offset of [-.2,0,.2]) {
  carRay.set(new THREE.Vector3(side*2,.66,z+offset),new THREE.Vector3(-side,0,0));
  const bodyHit=carRay.intersectObject(bodyShell)[0];
  assert.ok(!bodyHit||Math.abs(bodyHit.point.x)<.75,'the outer side skin has a real opening into the recessed wheel well');
  const carHit=carRay.intersectObject(shapedCar,true)[0];
  assert.ok(carHit&&carHit.object.material===c.MAT.tyre,'the assembled wheel remains visible through its open fender');
}
for(const part of shapedCar.children.filter(o=>o.material===shapedCar.userData.glazingMat)) {
  const bounds=new THREE.Box3().setFromObject(part),centre=bounds.getCenter(new THREE.Vector3());
  if(bounds.max.x-bounds.min.x>1)continue;
  // Each side batch contains two panes. Aim through actual triangles, then
  // verify the cabin frame cannot hide that same hit from the street.
  const pos=part.geometry.attributes.position;
  for(let triangle=0;triangle<pos.count;triangle+=3) {
    const target=new THREE.Vector3();
    for(let i=0;i<3;i++)target.add(new THREE.Vector3().fromBufferAttribute(pos,triangle+i));
    target.multiplyScalar(1/3).applyMatrix4(part.matrixWorld);
    for(const dz of [-.8,0,.8]) {
      const origin=new THREE.Vector3(Math.sign(centre.x)*5,1.8,target.z+dz);
      carRay.set(origin,target.clone().sub(origin).normalize());
      const hit=carRay.intersectObject(part)[0];assert.ok(hit);
      carTrimProbes.push({origin,point:hit.point.clone(),material:part.material});
    }
  }
}
for(const key of ['body','cabin']) {
  const geo=c.geoCache['blender_kiez_car_v1_'+key],p=geo.attributes.position,n=geo.attributes.normal;
  for(let i=0;i<p.count;i++)assert.ok(Number.isFinite(p.getX(i))&&Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.00001,
    'Blender shells retain finite positions and unit corner normals');
}
c.compactStaticPropGroup(shapedCar); shapedCar.updateMatrixWorld(true);
for(const probe of carTrimProbes) {
  carRay.set(probe.origin,probe.point.clone().sub(probe.origin).normalize());
  const hit=carRay.intersectObject(shapedCar,true)[0];
  assert.ok(hit && hit.object.material===probe.material && hit.point.distanceTo(probe.point)<0.00001,
    'crowned car decks leave the actual windscreens and lamps visible from front/rear oblique views');
}
assert.equal(carTrimProbes.length,186);
const carBounds=new THREE.Box3().setFromObject(shapedCar);
assert.ok(carBounds.min.x>=-1.056 && carBounds.max.x<=1.056 && carBounds.min.y>=0 &&
  carBounds.max.y<=1.696 && carBounds.min.z>=-2.151 && carBounds.max.z<=2.151,
  'shaped car stays within its previous collision and culling envelope');
let carMeshes=0, carTriangles=0;
shapedCar.traverse(o=>{if(o.isMesh){carMeshes++;carTriangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;}});
assert.ok(carMeshes<=9 && carTriangles<=7296,'car crown does not increase compacted draws or triangles');
console.log(`PASS: three watertight crowned car decks; ${carTrimProbes.length} visible windshield/lamp rays; ${carMeshes} meshes / ${carTriangles} triangles; bounds preserved.`);
// One existing colour-only template becomes a microvan, with no extra pool
// variants or collision spec. Test the shipped factory and template selector.
c.STATION_MAT={sbahnCream:c.mat(0xf2dba6),steel:c.mat(0x596a75)};
c.destRollMat=new THREE.MeshBasicMaterial();
vm.runInContext(section('  function makeRunnerTram() {','  function makeDeliveryMicrovan() {'),c);
c.PROP_CAFE_CREAM=c.mat(0xe7d6b3); c.PROP_LUGGAGE_TEAL=c.mat(0x2f716f);
c.CAR_COLORS=[0x448877]; c.pick=values=>values[0]; c.LANE_W=3;
vm.runInContext(section('  function makeDeliveryMicrovan() {','  // Close obstacle variants'),c);
const vanRegister=c.registerProp;
c.registerProp=(_kind,root)=>root;
const deliveryVan=c.makeDeliveryMicrovan(); c.registerProp=vanRegister;
deliveryVan.updateMatrixWorld(true);
const vanTrimProbes=[];
for(const part of deliveryVan.children.filter(o=>o.isMesh)) {
  const glass=part.material===c.MAT.glassDark, frontLamp=part.material===c.MAT.bulb;
  if(!glass && !frontLamp && part.material!==c.PROP_TAIL) continue;
  const bounds=new THREE.Box3().setFromObject(part), centre=bounds.getCenter(new THREE.Vector3());
  const sideGlass=glass && bounds.max.x-bounds.min.x<0.1;
  const origins=sideGlass ? [new THREE.Vector3(Math.sign(centre.x)*6,2.3,0.5),new THREE.Vector3(Math.sign(centre.x)*6,2.3,2.5)] :
    [-3,0,3].map(x=>new THREE.Vector3(x,2.6,(glass||frontLamp)?8:-8));
  for(const origin of origins) for(const u of [-1,0,1]) for(const v of [-1,0,1]) {
    const target=centre.clone();
    if(sideGlass)target.z+=u*(bounds.max.z-bounds.min.z)*0.22;
    else target.x+=u*(bounds.max.x-bounds.min.x)*0.22;
    target.y+=v*(bounds.max.y-bounds.min.y)*0.17;
    carRay.set(origin,target.sub(origin).normalize());
    const hit=carRay.intersectObject(part)[0];
    assert.ok(hit,'delivery van probe reaches its actual glass or lens');
    vanTrimProbes.push({origin,point:hit.point.clone(),material:part.material});
  }
}
c.compactStaticPropGroup(deliveryVan); deliveryVan.updateMatrixWorld(true);
for(const probe of vanTrimProbes){
  carRay.set(probe.origin,probe.point.clone().sub(probe.origin).normalize());
  const hit=carRay.intersectObject(deliveryVan,true)[0];
  assert.ok(hit && hit.object.material===probe.material && hit.point.distanceTo(probe.point)<0.00001,
    'delivery van shell leaves recessed cab glass and lamps visible in front, rear and oblique views');
}
assert.equal(vanTrimProbes.length,171);
// The tall cargo roof creates a different silhouette across its useful width;
// wheels remain grounded and all trim fits the existing exact car envelope.
const vanBounds=new THREE.Box3().setFromObject(deliveryVan);
assert.ok(vanBounds.min.x>=-1 && vanBounds.max.x<=1 && vanBounds.min.z>=-2.1 &&
  vanBounds.max.z<=2.1 && vanBounds.min.y>=0 && vanBounds.max.y<=1.95);
for(const x of [-0.5,0,0.5]){
  carRay.set(new THREE.Vector3(x,3,-0.4),carDown);
  assert.ok(carRay.intersectObject(deliveryVan,true)[0].point.y>1.90,'cargo roof retains a broad tall silhouette');
}
let vanMeshes=0,vanTriangles=0;
deliveryVan.traverse(o=>{if(o.isMesh){vanMeshes++;vanTriangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;
  for(const name of ['position','normal','uv'])assert.ok(o.geometry.attributes[name],'van geometry enters existing material batching');}});
assert.ok(vanMeshes<=carMeshes && vanTriangles<=carTriangles,'van does not grow draw or triangle cost');
for(const name of ['makeScaffold','makeCafeCanopy','makeSkip','makeLuggageTrolley','makeMaintenanceCluster'])c[name]=()=>new THREE.Group();
vm.runInContext(section('  var OB_KINDS = [','  function registerObstacleTemplateClone(root) {'),c);
assert.equal(c.OB_KINDS[2].halfW,1);assert.equal(c.OB_KINDS[2].halfD,2.1);assert.equal(c.OB_KINDS[2].yMax,1.95);
assert.equal(c.OB_TEMPLATE_VARIANTS,4);
assert.ok(c.OB_VISUAL_TEMPLATES.slice(0,3).every(appearances=>appearances.length===2&&appearances.every(templates=>templates.length===4)),
  'all original obstacle pool dimensions are preserved');
assert.equal(c.OB_VISUAL_TEMPLATES[3].length,1);
assert.equal(c.OB_VISUAL_TEMPLATES[3][0].length,4);
assert.equal(c.OB_KINDS[3].name,'tram');
assert.ok(c.OB_VISUAL_TEMPLATES[2][0].slice(0,3).every(template=>template.userData.bodyMat),
  'first three ordinary car colour templates remain');
const vanTemplate=c.OB_VISUAL_TEMPLATES[2][0][3],vanClone=vanTemplate.clone(true);
assert.equal(vanTemplate.rotation.y,Math.PI,'delivery van uses the existing nose-on obstacle orientation');
assert.ok(!vanTemplate.userData.bodyMat && new THREE.Box3().setFromObject(vanTemplate).max.y>1.9,
  'fourth existing template is the taller microvan');
assert.ok(vanClone.children.every((mesh,i)=>mesh.geometry===vanTemplate.children[i].geometry && mesh.material===vanTemplate.children[i].material),
  'obstacle clones share the already batched microvan assets');
console.log(`PASS: delivery microvan replaces one of four car templates; ${vanTrimProbes.length} visible glass/lamp rays; ${vanMeshes} meshes / ${vanTriangles} triangles; exact collision envelope and shared clone assets.`);
// The large runner tram has real glazing apertures and a rear-facing identity.
// Keep this factory/art check separate from obstacle scheduling and pool counts.
if(tramData.finishRevision==='raked-cab-visible-divider-v121'){
  // The V103 vertex/roof snapshots below deliberately describe the older
  // coach. V121 has its own actual-surface rays, exact UV/topology/native
  // proof and stricter 8,200-triangle/nine-batch budget.
  require('./check_berlin_tram_v121.cjs')(true);
  assert.equal(c.OB_KINDS[3].yMax,3.15,'V121 retains the gameplay collider');
}else{
const tramRegister=c.registerProp;
c.registerProp=(_kind,root)=>root;
const runnerTram=c.makeRunnerTram();c.registerProp=tramRegister;runnerTram.updateMatrixWorld(true);
const tramGlass=c.makeRunnerTram.glazingMaterial;
const tramHeadlamp=c.makeRunnerTram.headlampMaterial;
assert.ok(tramHeadlamp.isMeshBasicMaterial&&tramHeadlamp!==c.MAT.bulb,
  'tram ivory headlamps retain their daytime appearance without changing city lamps');
assert.ok(c.makeRunnerTram.yellowMaterial!==c.MAT.bvgYellow,
  'the vintage paint is local to the tram');
assert.ok(tramGlass&&tramGlass!==c.MAT.glassDark&&!tramGlass.transparent,
  'tram owns an opaque glass finish without recolouring other city vehicles');
assert.equal(runnerTram.children.filter(o=>o.material===tramGlass).length,16,
  'all cab, door and passenger panes use the same shared tram glass material');
const tramProbes=[];
for(const part of runnerTram.children.filter(o=>o.isMesh)){
  const glass=part.material===tramGlass, lamp=part.material===c.PROP_TAIL||part.material===tramHeadlamp;
  const sign=part.material===c.destRollMat;
  const bumper=part.material===c.MAT.metalDark&&Math.abs(part.position.z)>3.9;
  if(!glass&&!lamp&&!sign&&!bumper)continue;
  const bounds=new THREE.Box3().setFromObject(part),centre=bounds.getCenter(new THREE.Vector3());
  const sideGlass=glass&&bounds.max.x-bounds.min.x<0.15;
  const origins=sideGlass?[-4,0,4].map(offset=>new THREE.Vector3(Math.sign(centre.x)*7,4.2,centre.z+offset)):
    [-4,0,4].map(x=>new THREE.Vector3(x,4.5,Math.sign(centre.z)*12));
  // Sample each side of the intentional cab mullion/door seam, not the seam.
  // Offset the flat sign's middle probe from its shared triangle diagonal to
  // avoid a floating-point edge miss in Three's single-sided ray intersection.
  const horizontal=glass?[-0.27,-0.13,0.13,0.27]:sign?[-0.22,0.035,0.22]:[-0.22,0,0.22];
  for(const origin of origins)for(const u of horizontal)for(const v of [-0.19,0,0.19]){
    const target=centre.clone();
    if(sideGlass)target.z+=u*(bounds.max.z-bounds.min.z);else target.x+=u*(bounds.max.x-bounds.min.x);
    target.y+=v*(bounds.max.y-bounds.min.y);
    carRay.set(origin,target.sub(origin).normalize());const hit=carRay.intersectObject(part)[0];
    assert.ok(hit,'tram probe reaches the real glazing, lens, bumper or destination board');
    tramProbes.push({origin,point:hit.point.clone(),material:part.material});
  }
}
c.compactStaticPropGroup(runnerTram);runnerTram.updateMatrixWorld(true);
assert.equal(runnerTram.children.filter(o=>o.material===tramGlass).length,1,
  'all tram glazing remains one opaque material batch');
for(const probe of tramProbes){
  carRay.set(probe.origin,probe.point.clone().sub(probe.origin).normalize());
  const hit=carRay.intersectObject(runnerTram,true)[0];
  assert.ok(hit&&hit.object.material===probe.material&&hit.point.distanceTo(probe.point)<0.00001,
    'actual tram apertures expose glazing; lamps, bumpers and route displays remain in front of the shell');
}
assert.equal(tramProbes.length,792);
const tramBounds=new THREE.Box3().setFromObject(runnerTram);
assert.ok(tramBounds.min.x>=-1.25&&tramBounds.max.x<=1.25&&tramBounds.min.z>=-4&&tramBounds.max.z<=4&&
  tramBounds.min.y>=0&&Math.abs(tramBounds.max.y-4.10)<.000002,'tram decoration fits its exact 4.10 m render envelope');
assert.equal(c.OB_KINDS[3].yMax,3.15,'roof decoration leaves the original gameplay collider unchanged');
assert.equal(tramData.roofRevision,'raised-equipment-v103');
const roofBaseline=JSON.parse(fs.readFileSync(path.join(__dirname,'../audit/berlin-tram-roof-v103/baseline/berlin-vintage-tram-v90.json'),'utf8'));
assert.deepEqual(tramData.meshes,roofBaseline.meshes,'roof pass changes no mesh vertex attributes or topology');
const roofEdits=new Set([63,64,65,66,67,68,69,70,71,72,75,76,77,78,81,82,83,84,85].map(i=>'part_'+String(i).padStart(3,'0')));
tramData.parts.forEach((p,i)=>{if(!roofEdits.has(p.mesh))assert.deepEqual(p,roofBaseline.parts[i],'all non-roof transforms remain exact');});
for(const x of [-0.6,0,0.6]){
  carRay.set(new THREE.Vector3(x,4.5,2.5),carDown);const hit=carRay.intersectObject(runnerTram,true)[0];
  assert.ok(hit&&hit.object.material===c.makeRunnerTram.creamMaterial&&hit.point.y>2.77,
    'broad rounded cream crown leaves room for the classic pantograph');
}
// The classic driving cab now faces the runner at -Z. The stationary obstacle
// keeps its original orientation/envelope and both bogies beneath the body.
carRay.set(new THREE.Vector3(-0.70,1.01,-10),new THREE.Vector3(0,0,1));
assert.equal(carRay.intersectObject(runnerTram,true)[0].object.material,tramHeadlamp);
let tramDraws=0,tramTriangles=0;
runnerTram.traverse(o=>{if(o.isMesh){tramDraws++;tramTriangles+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;
  assert.ok(!o.material.transparent&&o.castShadow,'tram has only opaque batches with a solid shadow');
  for(const name of ['position','normal','uv'])assert.ok(o.geometry.attributes[name]);}});
assert.ok(tramDraws<=9&&tramTriangles<=8000,'rounded Blender tram respects its opaque draw and triangle budget');
const cachedTram=c.makeRunnerTram(),clonedTram=cachedTram.clone(true);
assert.equal(cachedTram.children.length,runnerTram.children.length);
assert.ok(cachedTram.children.every((mesh,i)=>mesh.geometry===runnerTram.children[i].geometry&&mesh.material===runnerTram.children[i].material),
  'tram factories reuse the cached merged geometry and shared palette');
assert.ok(clonedTram.children.every((mesh,i)=>mesh.geometry===cachedTram.children[i].geometry&&mesh.material===cachedTram.children[i].material),
  'tram pool clones share all geometry and materials');
console.log(`PASS: runner tram ${tramProbes.length} actual glazing/trim rays; split driving cab, facing lamps, cream crown/pantograph, exact 2.5×8 m footprint, 4.10 m roof render height / unchanged 3.15 m collision height; ${tramDraws} opaque draws / ${tramTriangles} triangles; cached factories and clones.`);
}
// The shaped bus shell once buried its rear bumper and lamps. Find the real
// trim meshes before batching, then ray-test their actual surface points
// against the complete batched vehicle from six elevated camera positions.
const compactRegister = c.registerProp;
c.registerProp = (_kind, root) => root;
const trimBus = c.makeBus();
c.registerProp = compactRegister;
trimBus.updateMatrixWorld(true);
const trimParts = [];
trimBus.traverse(o => { if (o.isMesh) trimParts.push(o); });
const trimFeatures = [];
for (const end of [-1,1]) {
  const definitions = [
    {name:'bumper', x:0, y:0.59, material:c.MAT.chrome},
    {name:'left lamp', x:-0.78, y:0.89, material:end > 0 ? c.MAT.chrome : c.PROP_TAIL},
    {name:'right lamp', x:0.78, y:0.89, material:end > 0 ? c.MAT.chrome : c.PROP_TAIL},
    {name:'destination sign', x:0, y:2.51, material:c.MAT.signBlue}
  ];
  for (const definition of definitions) {
    const matching = trimParts.filter(o => o.material === definition.material &&
      Math.abs(o.position.x - definition.x) < 0.001 &&
      Math.abs(o.position.y - definition.y) < 0.001 && o.position.z * end > 5);
    assert.equal(matching.length, 1, `actual ${end > 0 ? 'front' : 'rear'} ${definition.name} exists`);
    const part = matching[0];
    part.geometry.computeBoundingBox();
    const bounds = part.geometry.boundingBox, points = [];
    // Stay inside each rounded face while covering its centre and perimeter.
    // Z comes from actual geometry, so moving a lamp back into the shell will
    // move these probes with it and expose the occluding yellow body.
    for (const u of [-1,0,1]) for (const v of [-1,0,1]) {
      points.push(part.localToWorld(new THREE.Vector3(
        (bounds.min.x + bounds.max.x) * 0.5 + u * (bounds.max.x - bounds.min.x) * 0.28,
        (bounds.min.y + bounds.max.y) * 0.5 + v * (bounds.max.y - bounds.min.y) * 0.17,
        end > 0 ? bounds.max.z : bounds.min.z)));
    }
    trimFeatures.push({end, name:definition.name, material:definition.material, points});
  }
}
c.compactStaticPropGroup(trimBus);
trimBus.updateMatrixWorld(true);
const trimBounds = new THREE.Box3().setFromObject(trimBus);
assert.ok(trimBounds.min.x >= -1.4 && trimBounds.max.x <= 1.4 &&
  trimBounds.min.y >= -0.00001 && trimBounds.max.y <= 3.77 &&
  trimBounds.min.z >= -5.5 && trimBounds.max.z <= 5.718,
  'the actual bus, including exposed trim, stays inside its conservative vehicle envelope');
const trimCamera = new THREE.PerspectiveCamera(60,16/9,0.1,100);
const trimRay = new THREE.Raycaster(), trimProjected = new THREE.Vector3();
let trimVisibleSamples = 0;
for (const end of [-1,1]) for (const cameraX of [-6,0,6]) {
  trimCamera.position.set(cameraX,4,end * 15);
  trimCamera.lookAt(0,1.8,0); trimCamera.updateMatrixWorld(true);
  for (const feature of trimFeatures) {
    if (feature.end !== end) continue;
    for (const point of feature.points) {
      trimProjected.copy(point).project(trimCamera);
      assert.ok(Math.abs(trimProjected.x) < 1 && Math.abs(trimProjected.y) < 1 && Math.abs(trimProjected.z) < 1);
      trimRay.setFromCamera(new THREE.Vector2(trimProjected.x,trimProjected.y),trimCamera);
      const hit = trimRay.intersectObject(trimBus,true)[0];
      assert.ok(hit && hit.object.material === feature.material && hit.point.distanceTo(point) < 0.00001,
        `${end > 0 ? 'front' : 'rear'} ${feature.name} is visible ahead of the actual bus body from camera X=${cameraX}`);
      trimVisibleSamples++;
    }
  }
}
assert.equal(trimVisibleSamples,216);
console.log(`PASS: ${trimVisibleSamples} actual bus trim surface rays; front/rear bumpers, lamps and destination signs stay visible from centre and both oblique views; full vehicle bounds preserved.`);
c.scene = new THREE.Scene();
c.worldRoot = new THREE.Group(); c.scene.add(c.worldRoot);
c.camera = new THREE.PerspectiveCamera(65, 16 / 9, 0.4, 500);
c.sun = new THREE.DirectionalLight(); c.sun.castShadow = true;
c.scene.add(c.sun, c.sun.target);
c.sun.shadow.camera.near = 1; c.sun.shadow.camera.far = 170;
c.ASSETS = {}; c.CHUNK_COUNT = 4; c.chunks = [];
c.outlineParkedDetails = []; c.outlineParkedWasVisible = [];
c.PROFILE_RENDER = true; c.canvas = {dataset:{}};
vm.runInContext(section('  var PARKED_PER_CHUNK = 4;', '  // -------------------------------------------------- scene-wide instancing'), c);
const trafficTemplate = c.makeCar(0xffffff);
c.trafficInst = c.buildParkedInstanceBuckets(trafficTemplate, trafficTemplate.userData.bodyMat);
c.movingTraffic = []; c.trafficInstancesDirty = true;
c.poolScratchColor = new THREE.Color();
vm.runInContext(section('  var trafficBounds = instanceBucketSphere(trafficInst);', '  for (var ti = 0; ti < TRAFFIC_N; ti++)'), c);
for (let i = 0; i < 6; i++) {
  const holder = new THREE.Group();
  holder.position.set(i % 2 ? 9 : -9, 0, -25 + i * 30);
  holder.rotation.y = i % 2 ? Math.PI : 0;
  holder.scale.setScalar(0.94 + (i % 3) * 0.035);
  holder.userData.instColor = [0xc95645, 0x4f9968, 0x3e7faa][i % 3];
  c.movingTraffic.push(holder);
}
for (let i = 0; i < 4; i++) {
  const chunk = new THREE.Group(); chunk.position.z = i * 40;
  chunk.updateMatrix();
  chunk.userData.cars = []; c.worldRoot.add(chunk); c.chunks.push(chunk);
  for (let side = -1; side <= 1; side += 2) {
    const car = new THREE.Group(), bus = new THREE.Group();
    car.position.set(side * 11.5, 0, -12); bus.position.set(side * 11.5, 0, 12);
    car.rotation.y = bus.rotation.y = side > 0 ? Math.PI : 0;
    car.scale.setScalar(0.9 + i * 0.06); bus.scale.setScalar(0.72);
    car.userData.parkedColor = 0xc87b32 + i;
    car.userData.parkedRenderVisible = bus.userData.parkedRenderVisible = true;
    chunk.add(car, bus); chunk.userData.cars.push({car,bus});
  }
}
const vertex = new THREE.Vector3(), world = new THREE.Matrix4(), actual = new THREE.Matrix4();
const expected = new THREE.Matrix4(), color = new THREE.Color(), wanted = new THREE.Color();
let vertices = 0, shadowOnly = 0, views = 0, minTraffic = 6, maxTraffic = 0;
let minParked = 16, maxParked = 0;
function checkHolder(holder, buckets, retained, localMatrix, output, tint) {
  world.multiplyMatrices(c.worldRoot.matrixWorld, localMatrix);
  for (const bucket of buckets) {
    expected.multiplyMatrices(world, bucket.userData.local);
    const positions = bucket.geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 6) {
      vertex.fromBufferAttribute(positions, i).applyMatrix4(expected).project(c.camera);
      const screen = Math.abs(vertex.x) <= 1 && Math.abs(vertex.y) <= 1 && Math.abs(vertex.z) <= 1;
      vertex.fromBufferAttribute(positions, i).applyMatrix4(expected).project(c.sun.shadow.camera);
      const light = Math.abs(vertex.x) <= 1 && Math.abs(vertex.y) <= 1 && Math.abs(vertex.z) <= 1;
      if (screen || light) assert.ok(retained, 'a visible vertex or off-screen shadow caster is retained');
      if (screen) assert.equal(retained, 2, 'camera-visible geometry belongs to the beauty prefix');
      if (light && !screen) shadowOnly++;
      vertices++;
    }
    if (retained) {
      expected.multiplyMatrices(localMatrix, bucket.userData.local);
      bucket.getMatrixAt(output, actual);
      assert.ok(actual.elements.every((v,j) => Math.abs(v - expected.elements[j]) < 0.00005), 'exact compacted transform');
      if (bucket.userData.tinted) {
        bucket.getColorAt(output, color); wanted.setHex(tint);
        assert.ok(Math.hypot(color.r-wanted.r, color.g-wanted.g, color.b-wanted.b) < 1e-6, 'tint follows its vehicle');
      }
    }
  }
}
const holderMatrix = new THREE.Matrix4();
for (const aspect of [390/844, 844/390, 16/9]) {
  for (const z of [-20, 0, 40, 100]) for (const lane of [-4, 0, 4]) for (const box of [15, 32]) {
    c.camera.aspect = aspect; c.camera.position.set(lane, 3.8 + (z === 40 ? 1.6 : 0), z);
    c.camera.lookAt(-lane * 0.1, 1.4, z + 18); c.camera.updateProjectionMatrix();
    c.sun.position.set(lane - 45, 72, z + 48); c.sun.target.position.set(lane, 0, z + 14);
    Object.assign(c.sun.shadow.camera, {left:-box,right:box,top:box,bottom:-box});
    c.sun.shadow.camera.updateProjectionMatrix();
    // Parent motion/rotation ensures culling and uploading use the same space.
    c.worldRoot.position.x = z === 100 ? 3 : 0; c.worldRoot.rotation.y = z === 100 ? 0.1 : 0;
    c.updateVehicleFrusta(); c.syncTrafficInstances(); c.syncParkedInstances();
    let traffic = 0, cars = 0, buses = 0;
    for (const pass of [2,1,0]) {
    for (const holder of c.movingTraffic) {
      if (holder.userData.trafficInView !== pass) continue;
      checkHolder(holder, c.trafficInst, holder.userData.trafficInView, holder.matrix, traffic, holder.userData.instColor);
      if (holder.userData.trafficInView) traffic++;
    }
    for (const chunk of c.chunks) for (const slot of chunk.userData.cars) {
      for (const kind of ['car','bus']) {
        const holder = slot[kind], isCar = kind === 'car';
        if (holder.userData.parkedInView !== pass) continue;
        holderMatrix.multiplyMatrices(chunk.matrix, holder.matrix);
        checkHolder(holder, isCar ? c.parkedCarInst : c.parkedBusInst, holder.userData.parkedInView,
          holderMatrix, isCar ? cars : buses, holder.userData.parkedColor);
        if (holder.userData.parkedInView) { if (isCar) cars++; else buses++; }
      }
    }
    }
    const trafficBeauty=c.movingTraffic.filter(h=>h.userData.trafficInView===2).length;
    const carBeauty=c.chunks.reduce((n,ch)=>n+ch.userData.cars.filter(s=>s.car.userData.parkedInView===2).length,0);
    const busBeauty=c.chunks.reduce((n,ch)=>n+ch.userData.cars.filter(s=>s.bus.userData.parkedInView===2).length,0);
    for (const [buckets,count,beauty] of [[c.trafficInst,traffic,trafficBeauty],[c.parkedCarInst,cars,carBeauty],[c.parkedBusInst,buses,busBeauty]]) {
      assert.ok(buckets.every(m=>m.count===count && m.visible===(count>0)));
      if (count) assert.ok(buckets.every(m=>m.instanceMatrix.updateRange.count===count*16));
      for (const mesh of buckets) {
        const version = mesh.instanceMatrix.version;
        mesh.onBeforeRender();
        assert.equal(mesh.count,beauty,'beauty uses exactly the camera prefix');
        assert.ok(mesh.count<=count);
        mesh.onAfterRender();
        assert.equal(mesh.count,count,'full caster union restored before the next shadow pass');
        assert.equal(mesh.instanceMatrix.version,version,'pass selection never uploads instance buffers');
      }
    }
    minTraffic=Math.min(minTraffic,traffic); maxTraffic=Math.max(maxTraffic,traffic);
    minParked=Math.min(minParked,cars+buses); maxParked=Math.max(maxParked,cars+buses);
    const versions=[...c.trafficInst,...c.parkedCarInst,...c.parkedBusInst].map(m=>m.instanceMatrix.version);
    c.syncTrafficInstances(); c.syncParkedInstances();
    assert.deepEqual([...c.trafficInst,...c.parkedCarInst,...c.parkedBusInst].map(m=>m.instanceMatrix.version),versions,'stationary visibility does not upload');
    views++;
  }
}
assert.ok(shadowOnly>0 && minTraffic<6 && minParked<16);
// Use the shipped frozen-tree and recycle paths: parked visibility only reads
// chunk transforms, so it must not force their static descendants to update.
vm.runInContext(section('  function freezeObjectTree(root, dynamicNodes, keepRootDynamic) {',
  '  // Chunk scenery only changes when its pooled chunk is recycled.'), c);
c.ALL_POOLS = [];
vm.runInContext(section('  var runtimeChunkRecycles = 0;',
  '  // Recycle any chunk that has fallen a full chunk behind the camera.'), c);
const frozenFixtures = c.chunks.map(chunk => {
  const staticBranch = new THREE.Group(), leaf = new THREE.Group();
  const mover = new THREE.Group(), movingLeaf = new THREE.Group();
  leaf.position.set(2,3,4); staticBranch.add(leaf);
  movingLeaf.position.set(1,2,3); mover.add(movingLeaf);
  chunk.add(staticBranch,mover);
  c.freezeObjectTree(chunk,[mover],false);
  return {chunk,leaf,mover,movingLeaf,updates:0};
});
c.scene.updateMatrix(); c.scene.matrixAutoUpdate=false;
c.worldRoot.updateMatrix(); c.worldRoot.matrixAutoUpdate=false;
c.scene.updateMatrixWorld(true);
for (const fixture of frozenFixtures) {
  const update = fixture.leaf.updateMatrixWorld;
  fixture.leaf.updateMatrixWorld = function(force) {
    fixture.updates++;
    return update.call(this,force);
  };
}
for (const dirty of [false,true,false]) {
  const movingBefore = frozenFixtures.map(f => f.movingLeaf.matrixWorld.elements[12]);
  frozenFixtures.forEach(f => f.mover.position.x+=0.25);
  if (dirty) c.parkedInstancesDirty=true;
  c.updateVehicleFrusta(); c.syncParkedInstances(); c.scene.updateMatrixWorld();
  assert.ok(frozenFixtures.every(f => f.updates===0),
    'unchanged chunks retain frozen descendants through visibility reads and dirty vehicle repacks');
  assert.ok(frozenFixtures.every((f,i) => f.movingLeaf.matrixWorld.elements[12]!==movingBefore[i]),
    'authored movers still update through protected branches');
}
for (const fixture of frozenFixtures) {
  const before = fixture.leaf.matrixWorld.elements.slice();
  c.recyclePreparedChunk(fixture.chunk,fixture.chunk.position.z+640);
  assert.equal(fixture.updates,1,'recycling refreshes the frozen descendant once');
  assert.ok(Math.abs(fixture.leaf.matrixWorld.elements[14]-before[14]-640*c.worldRoot.matrixWorld.elements[10])<1e-8,
    'recycled world transform includes the current parent rotation');
  c.syncParkedInstances(); c.scene.updateMatrixWorld();
  assert.equal(fixture.updates,1,'parked synchronization does not repeat the recycle traversal');
  c.recyclePreparedChunk(fixture.chunk,fixture.chunk.position.z-640);
  assert.ok(fixture.leaf.matrixWorld.elements.every((v,i)=>Math.abs(v-before[i])<1e-8),
    'returning a chunk restores its exact world transform');
}
c.scene.matrixAutoUpdate=true; c.worldRoot.matrixAutoUpdate=true;
// Hidden chunks must not leave stale vehicles in the world-level pools.
c.camera.position.set(0,4,0); c.camera.lookAt(0,1,18);
c.sun.position.set(-45,72,48); c.sun.target.position.set(0,0,14);
c.worldRoot.position.set(0,0,0); c.worldRoot.rotation.set(0,0,0);
c.updateVehicleFrusta();
c.chunks.forEach(chunk=>chunk.visible=false); c.syncParkedInstances();
assert.ok([...c.parkedCarInst,...c.parkedBusInst].every(m=>m.count===0&&!m.visible));
c.chunks.forEach(chunk=>{chunk.visible=true;c.recyclePreparedChunk(chunk,chunk.position.z+640);});
c.parkedInstancesDirty=true; c.syncParkedInstances();
assert.ok([...c.parkedCarInst,...c.parkedBusInst].every(m=>m.count===0),'recycled chunks leave no ghost vehicle');
c.chunks.forEach(chunk=>c.recyclePreparedChunk(chunk,chunk.position.z-640)); c.parkedInstancesDirty=true; c.syncParkedInstances();
assert.ok(c.parkedCarInst[0].count+c.parkedBusInst[0].count>0,'returning chunks restore vehicles');
// Empty traffic, followed by a previously culled slot moving into the view.
c.movingTraffic.forEach(h=>h.position.z+=640); c.trafficInstancesDirty=true; c.syncTrafficInstances();
assert.ok(c.trafficInst.every(m=>m.count===0&&!m.visible));
c.movingTraffic[0].position.set(0,0,140); c.trafficInstancesDirty=true; c.syncTrafficInstances();
assert.ok(c.trafficInst.every(m=>m.count===1&&m.visible));
c.movingTraffic[0].position.set(80,0,40);
c.sun.position.set(35,72,88); c.sun.target.position.set(80,0,54);
c.updateVehicleFrusta(); c.trafficInstancesDirty=true; c.syncTrafficInstances();
assert.ok(c.trafficInst.every(m=>m.visible&&m.count===1&&m.userData.vehicleViewCount===0),'shadow-only fleet stays available to the light');
for (const mesh of c.trafficInst) {
  mesh.onBeforeRender(); assert.equal(mesh.count,0,'empty camera prefix submits no triangles');
  mesh.onAfterRender(); assert.equal(mesh.count,1,'shadow-only fleet restored');
}
// Run the shipped collision and pooling paths together. A struck car must not
// cover the continuing runner when its centre passes the chase view, while
// impact feedback, shield consumption and logical pool lifetime stay intact.
const collision = vm.createContext({
  gameOver:false, player:{x:0,y:0,z:95}, prevZ:94, playerHeight:()=>1.8,
  HALF_D:0.35, HALF_W:0.3, LANES:[-3.2,0,3.2], PLAY_RENDER_FAR:160,
  obstacles:[], pretzels:[], powerups:[], graceTimer:0, stumbleTimer:0,
  shieldCharges:0, stumbles:0, shieldSounds:0, hudUpdates:0,
  fxPopup(){}, fxScreenPulse(){}, fxCamKick(){}
});
vm.runInContext('function stumble(){stumbles++;} function playPowerupSound(){shieldSounds++;} function updatePowerupHUD(){hudUpdates++;}',collision);
vm.runInContext(section('  function collide() {','  function laneOf(x)'),collision);
vm.runInContext(section('  function recycle() {','  // ============================================================= visuals'),collision);
for (const shield of [0,1]) {
  const obstacle = {active:true,hit:false,z:100,lane:1,
    spec:{halfD:2.3,halfW:0.95,yMin:0,yMax:1.6},holder:{visible:true}};
  Object.assign(collision,{obstacles:[obstacle],shieldCharges:shield,graceTimer:0,
    stumbleTimer:0,stumbles:0,shieldSounds:0,hudUpdates:0});
  collision.player.x=0; collision.player.z=95; collision.prevZ=94;
  collision.collide(); collision.recycle();
  assert.ok(!obstacle.hit && obstacle.holder.visible,'approaching obstacle remains intact');
  collision.prevZ=95; collision.player.z=98;
  collision.collide(); collision.recycle();
  assert.ok(obstacle.hit && obstacle.active && obstacle.holder.visible,
    'the real impact resolves before the struck vehicle leaves the view');
  assert.equal(collision.stumbles,shield?0:1);
  assert.equal(collision.shieldSounds,shield);
  assert.equal(collision.hudUpdates,shield);
  assert.equal(collision.shieldCharges,0);
  collision.prevZ=98; collision.player.z=100;
  collision.collide(); collision.recycle();
  assert.ok(obstacle.active && !obstacle.holder.visible,'spent vehicle clears at its centre without freeing its pool slot');
  collision.player.z=126; collision.collide(); collision.recycle();
  assert.ok(obstacle.active && !obstacle.holder.visible,'original logical lifetime includes the 26 m boundary');
  collision.player.z=126.01; collision.collide(); collision.recycle();
  assert.ok(!obstacle.active && !obstacle.holder.visible);
  assert.equal(collision.stumbles,shield?0:1,'impact feedback is not repeated');
  assert.equal(collision.shieldSounds,shield,'shield is not consumed twice');
  // The same pooled slot, reset by spawning, must draw again. An avoided car
  // retains its visual after passing the runner and still uses normal expiry.
  Object.assign(obstacle,{active:true,hit:false,z:150});
  collision.player.x=-3.2; collision.prevZ=149; collision.player.z=150;
  collision.collide(); collision.recycle();
  assert.ok(obstacle.active && !obstacle.hit && obstacle.holder.visible,'reused and avoided vehicles remain visible');
}
console.log(`PASS: ${views} views and ${vertices.toLocaleString()} actual car/bus vertex projections; ${shadowOnly.toLocaleString()} off-screen light-volume vertices preserved; traffic ${minTraffic}–${maxTraffic}/6, parked ${minParked}–${maxParked}/16; transforms, tints, stable uploads, frozen descendants, live movers, hidden chunks, 640 m recycling and collision-to-visual lifetime.`);

// Exercise the shipped scheduler and slot writers together. A long vehicle
// must leave both the advertised reward route and the question approach clear.
const course=vm.createContext({OB_KINDS:c.OB_KINDS,LANES:[3,0,-3],HALF_D:.42,
  clamp:THREE.MathUtils.clamp,lerp:THREE.MathUtils.lerp,Math:Object.create(Math),
  player:{z:0},POWERUP_TYPES:['magnet','spring','shield'],spawnPowerup(){}});
let courseSeed=1;
course.Math.random=()=>{courseSeed=(Math.imul(courseSeed,1664525)+1013904223)>>>0;return courseSeed/4294967296;};
course.rand=(a,b)=>a+(b-a)*course.Math.random();course.randInt=(a,b)=>Math.floor(course.rand(a,b+1));
vm.runInContext(section('  function freeObstacleSlots() {','  // ========================================================= collectibles'),course);
vm.runInContext(section('  function freePretzelSlots() {','  // A diagonal reward trail'),course);
vm.runInContext(section('  var GATE_CLEAR_BEFORE = 17;','  function answerArticle('),course);
const realRewardRun=course.spawnPretzelRun,courseRuns=[];
course.spawnPretzelRun=(...args)=>{
  const free=course.pretzels.filter(p=>!p.active);realRewardRun(...args);
  courseRuns.push({lane:args[0],z:args[1],count:args[2],arc:args[3],placed:free.filter(p=>p.active)});
};
let checkedTrams=0,checkedCourses=0;
for(const velocity of [18,26,42,54])for(const difficultyDistance of [0,1400])for(let seed=1;seed<=32;seed++){
  courseSeed=seed;courseRuns.length=0;
  Object.assign(course,{speed:velocity,distance:difficultyDistance,overdriveTier:0,
    lastObstacleZ:9,powerupCorridorIndex:0});
  course.obstacles=Array.from({length:48},()=>({active:false,holder:{visible:false,position:new THREE.Vector3(),updateMatrix(){}},
    variants:c.OB_VISUAL_TEMPLATES.map(appearances=>appearances.map(()=>({visible:false})))}));
  course.pretzels=Array.from({length:80},()=>({active:false,sprite:{visible:false,position:new THREE.Vector3()}}));
  const gateZ=Math.max(58,velocity*2.85);
  course.scheduleCorridor(gateZ);checkedCourses++;
  const active=course.obstacles.filter(o=>o.active);
  for(const tram of active.filter(o=>o.spec.name==='tram')){
    checkedTrams++;
    assert.ok(tram.z+tram.spec.halfD+course.HALF_D<=gateZ-17+1e-9,'entire tram collision ends before the clear quiz approach');
    const cue=courseRuns.find(run=>run.count===5&&Math.abs(run.z-(tram.z-8))<1e-9);
    assert.ok(cue&&cue.placed.length===5&&cue.lane!==tram.lane,'five actual pooled rewards begin before the tram in an open lane');
    assert.ok(cue.placed[0].z<tram.z-tram.spec.halfD-course.HALF_D);
    assert.ok(active.every(o=>o===tram||Math.abs(o.z-tram.z)>10),'tram beat never adds a second blocked lane');
    for(const other of active.filter(o=>o!==tram)){
      const gap=Math.abs(other.z-tram.z)-other.spec.halfD-tram.spec.halfD-2*course.HALF_D;
      assert.ok(gap>=Math.max(21,velocity*.58)-4.2-2*course.HALF_D-1.5-1e-8,
        'long tram preserves the former car beat recovery clearance');
    }
  }
  // An exhausted reward pool must never turn the promised cue into an empty
  // route or overwrite pickups already in flight.
  course.obstacles.forEach(o=>o.active=false);course.pretzels.forEach(p=>p.active=true);
  course.lastObstacleZ=9;courseSeed=seed;courseRuns.length=0;
  course.scheduleCorridor(gateZ);
  assert.ok(course.obstacles.every(o=>!o.active||o.spec.name!=='tram'),'reward-pool exhaustion falls back to ordinary obstacles');
}
assert.ok(checkedTrams>20,'deterministic courses exercise the new encounter repeatedly');
const tramSpec=c.OB_KINDS[3];
Object.assign(collision,{HALF_D:.42,HALF_W:.40,LANES:[3,0,-3]});
for(const shield of [0,1])for(const height of [0,2.58,3.2])for(let lane=0;lane<3;lane++){
  const tram={active:true,hit:false,z:100,lane:1,spec:tramSpec,holder:{visible:true}};
  Object.assign(collision,{obstacles:[tram],shieldCharges:shield,graceTimer:0,stumbleTimer:0,stumbles:0,shieldSounds:0,hudUpdates:0});
  Object.assign(collision.player,{x:collision.LANES[lane],y:height,z:95.57});collision.prevZ=95.4;
  collision.collide();assert.equal(tram.hit,false,'tram contact starts at its true swept near edge');
  collision.prevZ=95.57;collision.player.z=95.59;collision.collide();collision.recycle();
  const shouldHit=lane===1&&height<3.15;
  assert.equal(tram.hit,shouldHit,'ordinary jump is blocked, side lanes and a powered vault remain clear');
  assert.equal(tram.holder.visible,true,'near-face contact remains visible briefly');
  collision.prevZ=95.59;collision.player.z=96;collision.collide();collision.recycle();
  assert.equal(tram.holder.visible,!shouldHit,'only an already-hit tram clears at its near body face');
  collision.player.z=126.01;collision.collide();collision.recycle();
  assert.equal(tram.active,false);assert.equal(tram.holder.visible,false);
  assert.equal(collision.stumbles,shouldHit&&!shield?1:0);assert.equal(collision.shieldSounds,shouldHit&&shield?1:0);
}
console.log(`PASS: ${checkedCourses} seeded courses / ${checkedTrams} trams; full quiz clearance, real five-pickup routes, recovery spacing, pool exhaustion and 18 collision/shield/vault cases.`);

// Carry the actual scheduler, random state and occupied pools across queued
// gates. The first approach deliberately has more room than later corridors;
// testing only fresh player=0 courses concealed empty 58 m slow-speed runs.
vm.runInContext(section('  function gateDistance() {','  function queueWordForReview'),course);
const slideTime=Number(html.match(/var SLIDE_TIME = ([\d.]+);/)[1]);
const pickup=vm.createContext({grounded:true,slideTimer:slideTime,slideExitGrace:0,
  SLIDE_H:Number(html.match(/var SLIDE_H = ([\d.]+);/)[1]),
  STAND_H:Number(html.match(/var STAND_H = ([\d.]+);/)[1]),
  player:{x:0,y:0,z:0},magnetTimer:0,pretzelCount:0,quizScore:0,
  playPretzelSound(){},fxPretzelPop(){},requestAnimationFrame(fn){fn();},
  el:{pretzels:{textContent:'',parentElement:{classList:{add(){},remove(){}}}}}});
vm.runInContext(section('  function playerHeight() {','  function collide() {'),pickup);
vm.runInContext(section('  function collectPretzels() {','  function playPowerupSound('),pickup);
const realApproachFit=course.obstacleFitsQuizApproach,fitAttempts=[];
course.obstacleFitsQuizApproach=(specIdx,z,gateZ)=>{
  const fits=realApproachFit(specIdx,z,gateZ);fitAttempts.push({specIdx,z,fits});return fits;
};
const slideFormations=new Set(),rejectedKinds=new Set();
let sequentialCourses=0,checkedSlidePickups=0,rejectedCompanions=0,recoveryPairs=0,minFreeSlots=48;
const density=[];
for(const [velocity,difficulty,streak] of [[13,0,0],[18,0,0],[26,0,0],[26,.5,10],
  [26,1,20],[36,.5,10],[42,.5,10],[54,1,20]]) {
  let laterBeats=0;
  for(let seed=1;seed<=64;seed++) {
    courseSeed=Math.imul(seed,0x9e3779b9)>>>0;
    Object.assign(course,{speed:velocity,distance:difficulty*1400,overdriveTier:0,
      quizStreak:streak,lastObstacleZ:0,powerupCorridorIndex:0});
    course.obstacles=Array.from({length:48},()=>({active:false,
      holder:{visible:false,position:new THREE.Vector3(),updateMatrix(){}},
      variants:c.OB_VISUAL_TEMPLATES.map(a=>a.map(()=>({visible:false})))}));
    course.pretzels=Array.from({length:80},()=>({active:false,
      sprite:{visible:false,position:new THREE.Vector3()}}));
    const gateSpacing=course.gateDistance();
    for(let gateIndex=0;gateIndex<12;gateIndex++) {
      course.player.z=Math.max(0,(gateIndex-3)*gateSpacing);
      course.obstacles.forEach(o=>{if(o.active&&o.z<course.player.z-26)o.active=false;});
      course.pretzels.forEach(p=>{if(p.active&&p.z<course.player.z-10)p.active=false;});
      const prior=new Set(course.obstacles.filter(o=>o.active)),gateZ=(gateIndex+1)*gateSpacing;
      courseRuns.length=0;fitAttempts.length=0;course.scheduleCorridor(gateZ);sequentialCourses++;
      const active=course.obstacles.filter(o=>o.active&&!prior.has(o)),beats=[];
      for(const obstacle of active) {
        assert.ok(obstacle.z+obstacle.spec.halfD+course.HALF_D<=gateZ-17+1e-9,
          'every actual obstacle, including an offset companion, ends before the quiz approach');
        if(gateIndex)assert.ok(obstacle.z-obstacle.spec.halfD-course.HALF_D>=gateIndex*gateSpacing+9-1e-9,
          'the full contact interval also preserves the previous gate recovery area');
        let beat=beats.find(b=>Math.abs(b.z-obstacle.z)<4);
        if(!beat)beats.push(beat={z:obstacle.z,objects:[]});beat.objects.push(obstacle);
      }
      if(!gateIndex&&velocity<=26)assert.equal(active.length,0,'first quiz retains its warm-up approach');
      if(gateIndex)laterBeats+=beats.length;
      minFreeSlots=Math.min(minFreeSlots,course.freeObstacleSlots());
      for(const attempt of fitAttempts.filter(a=>!a.fits)) {
        rejectedKinds.add(attempt.specIdx);
        if([1,2].includes(attempt.specIdx)&&active.some(o=>o.spec.kind==='block'&&Math.abs(o.z-attempt.z)<=1.5)) {
          rejectedCompanions++;
          assert.ok(active.every(o=>Math.abs(o.z-attempt.z)>1e-9),'a rejected offset companion never gets a pooled visual/collider');
        }
      }
      for(let index=0;index<beats.length;index++) {
        const beat=beats[index],high=beat.objects.every(o=>o.spec.kind==='high');
        if(high)assert.ok(beat.objects.length===1||beat.objects.length===3,'full-width slide never becomes a partial two-lane wall');
        else assert.ok(new Set(beat.objects.map(o=>o.lane)).size<=2,'every blocking beat leaves an open lane');
        if(index) {
          const previous=beats[index-1],previousHigh=previous.objects.every(o=>o.spec.kind==='high');
          const recoverySeconds=previousHigh?THREE.MathUtils.lerp(1,.76,difficulty):THREE.MathUtils.lerp(.70,.58,difficulty);
          const tramPadding=[previous,beat].reduce((n,b)=>n+(b.objects.some(o=>o.spec.name==='tram')?1.9:0),0);
          assert.ok(beat.z-previous.z-tramPadding>=Math.max(24-difficulty*3,velocity*recoverySeconds)-1e-8,
            'actual consecutive beats retain the action recovery floor and both long-tram allowances');
          if(previousHigh&&previous.objects.length===3) {
            const near=b=>Math.min(...b.objects.map(o=>o.z-o.spec.halfD-course.HALF_D));
            assert.ok((near(beat)-near(previous))/velocity>=slideTime,
              'a required slide can finish before the next physical near edge, including offset cars');
          }
          recoveryPairs++;
        }
        if(high&&beat.objects.length===3) {
          assert.equal(new Set(beat.objects.map(o=>o.lane)).size,3,'slide wall covers all three lanes together');
          const cue=courseRuns.find(run=>run.count===5&&Math.abs(run.z-(beat.z-1))<1e-9);
          if(cue) {
            assert.equal(cue.arc,false,'required slide never advertises a conflicting jump arc');
            slideFormations.add(Math.abs(Math.floor(cue.z*.20)+cue.lane*7+cue.count*3)%3);
            pickup.pretzels=cue.placed.map(p=>({...p,sprite:{visible:true}}));
            pickup.player.x=course.LANES[cue.lane];pickup.pretzelCount=0;
            for(const reward of pickup.pretzels) {
              pickup.prevZ=reward.z-.1;pickup.player.z=reward.z;pickup.collectPretzels();
            }
            assert.equal(pickup.pretzelCount,cue.placed.length,'real pickup path collects every slide reward at the real low collider height');
            checkedSlidePickups+=cue.placed.length;
          }
        }
      }
    }
  }
  const mean=laterBeats/(64*11);density.push(`${velocity}/${difficulty}:${mean.toFixed(2)}`);
  if(velocity<=18)assert.ok(mean>.4&&mean<.85,'slow later corridors gain measured encounters while retaining breathers');
}
assert.equal(rejectedKinds.size,4,'courses exercise full-envelope rejection for every obstacle spec');
assert.ok(rejectedCompanions>0,'courses reach optional companions that alone cross the quiz boundary');
assert.equal(slideFormations.size,3,'all three flat slide formations reach actual pickup checks');
assert.ok(checkedSlidePickups>100&&recoveryPairs>100&&minFreeSlots>0,'bounded course coverage never relies on obstacle pool exhaustion');
console.log(`PASS: ${sequentialCourses} sequential corridors; all swept quiz boundaries, ${rejectedCompanions} rejected offset companions, ${recoveryPairs} action-recovery pairs, ${checkedSlidePickups} real slide pickups across all formations; minimum ${minFreeSlots}/48 free slots. Later beats by speed/difficulty: ${density.join(', ')}.`);

// The authored opening is inserted after all visible future corridors have
// already been scheduled. Exercise that real order, including random extremes,
// so the close tram cannot overlap another prop or create a three-lane wall.
vm.runInContext(section('  function ensureGatesAhead() {','  // Fill the run-up'),course);
vm.runInContext(section('  var WORLD_EMERGE =','  // Stock linear fog'),course);
const openingCourseSource=section('    // A composed opening:', '\n  function showHeroLoadError()')
  .replace(/\r\n/g,'\n').replace(/\n  }\s*$/,'');
const seededRandom=course.Math.random;
let openingCourses=0,closestOpeningGap=Infinity;
for(const velocity of [13,26])for(const offset of [0,500])for(let trial=-2;trial<24;trial++){
  courseSeed=(trial+3)*982451653;
  course.Math.random=trial===-2?()=>0:trial===-1?()=>.999999:seededRandom;
  Object.assign(course,{speed:velocity,distance:0,overdriveTier:0,quizStreak:0,
    lastObstacleZ:offset,nextGateZ:offset,powerupCorridorIndex:0,started:true,gameOver:false});
  course.player.z=offset;course.gates=[];
  course.spawnGate=z=>course.gates.push({position:{z},userData:{active:true}});
  course.obstacles=Array.from({length:48},()=>({active:false,
    holder:{visible:false,position:new THREE.Vector3(),updateMatrix(){}},
    variants:c.OB_VISUAL_TEMPLATES.map(a=>a.map(()=>({visible:false})))}));
  course.pretzels=Array.from({length:80},()=>({active:false,
    sprite:{visible:false,position:new THREE.Vector3()}}));
  courseRuns.length=0;course.ensureGatesAhead();
  const scheduled=course.obstacles.filter(o=>o.active),rewardBefore=new Set(course.pretzels.filter(p=>p.active));
  assert.ok(scheduled.every(o=>o.z>=offset+58),'first scheduling beat cannot enter the authored opening');
  vm.runInContext(openingCourseSource,course);
  const openingTrams=course.obstacles.filter(o=>o.active&&!scheduled.includes(o));
  assert.equal(openingTrams.length,1,'actual queued corridors leave a real slot for the opening tram');
  const tram=openingTrams[0];
  assert.equal(tram.spec.name,'tram');assert.equal(tram.lane,2);
  assert.ok(tram.z>offset+24&&tram.z<=offset+28,'tram stays in its bounded visible approach');
  assert.ok((tram.z-offset-tram.spec.halfD-course.HALF_D)/velocity>=.85,
    'the opening keeps at least 850 ms to its nearest collision face even at fast speed');
  assert.ok(course.obstacleFitsQuizApproach(3,tram.z,course.gates[0].position.z),'full tram clears first quiz reaction space');
  for(const other of scheduled){
    const gap=Math.abs(other.z-tram.z)-other.spec.halfD-tram.spec.halfD-2*course.HALF_D;
    assert.ok(gap>12,'opening tram neither overlaps a queued prop nor combines with a same-depth blocked lane');
    closestOpeningGap=Math.min(closestOpeningGap,gap);
  }
  const openingRewards=course.pretzels.filter(p=>p.active&&!rewardBefore.has(p));
  assert.deepEqual(openingRewards.map(p=>p.z),[8,16,24,32].map(z=>z+offset));
  assert.ok(openingRewards.every(p=>p.lane===1&&p.y===1.15),'four opening rewards remain in the clear center');
  openingCourses++;
}
course.Math.random=seededRandom;
console.log(`PASS: ${openingCourses} actual queued opening courses at13/26m/s, fresh/restart offsets and random extremes; four pooled center pickups, first quiz clearance and minimum ${closestOpeningGap.toFixed(2)}m surface gap to scheduled props.`);
