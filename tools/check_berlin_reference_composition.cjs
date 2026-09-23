'use strict';
// Exercise the shipped placement code against the actual authored meshes.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.resolve(root, process.env.BERLIN_HTML || 'berlin-runner.html'), 'utf8').replace(/\r\n/g,'\n');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const scope = vm.createContext({console});
vm.runInContext(scripts.find(s => s.includes('three.js r156 (MIT)')), scope);
const T = scope.THREE;
scope.atob = s => Buffer.from(s, 'base64').toString('binary');
scope.BERLIN_REFERENCE_ARCHITECTURE = JSON.parse(fs.readFileSync(path.join(root, process.env.BERLIN_ARCHITECTURE_DIR || 'assets/models', 'berlin-reference-architecture-v1.json')));
for (const name of ['berlin_packed_geometry.js', 'berlin_kiez_kit.js']) vm.runInContext(fs.readFileSync(name==='berlin_kiez_kit.js'&&process.env.BERLIN_KIEZ_KIT?path.resolve(root,process.env.BERLIN_KIEZ_KIT):path.join(__dirname,name), 'utf8'), scope);
const noop = () => {};
const ctx = new Proxy({createLinearGradient: () => ({addColorStop: noop})}, {get: (o,k) => o[k] || noop, set: (o,k,v) => (o[k] = v, true)});
const kit = scope.createBerlinKiezKit(T, (color, opts) => new T.MeshStandardMaterial({color, ...opts}),
  (width, height) => ({width, height, getContext: () => ctx}));
function section(a, b, from = 0) {
  const start = html.indexOf(a, from), end = html.indexOf(b, start);
  assert.ok(start >= 0 && end > start, 'shipped source anchors found: ' + a);
  return html.slice(start, end);
}
const rollStart = html.indexOf('  function rollChunk(');
const flags = section('    var worldChunkIndex =', '    ud.motif =', rollStart);
const layoutSetup = section('    var motifWidths =', '    var windowBayIdx =', rollStart);
const loopStart = html.indexOf('    [-1, 1].forEach(function (side, sideIdx)', rollStart);
const layoutLoop = section('    [-1, 1].forEach(function (side, sideIdx)', '        // Window-bay and shopDepth instances', loopStart) + '\n      }\n    });';
const layoutCode = new vm.Script(flags + '\nvar hasCross = motif === 1, crossZ = 0;\n' + layoutSetup + layoutLoop);
function block(index) {
  const buildings = Array.from({length: 6}, (_, slot) => {
    const g = new T.Group(); g.userData.side = slot < 3 ? -1 : 1;
    g.rotation.y = -g.userData.side * Math.PI / 2; return g;
  });
  const c = vm.createContext({CHUNK_LEN: 40, WALK_OUT: 12.4, KIEZ_DISTRICT_ENABLED: true,
    chunkZ: index * 40, ud: {buildings}, writeBuildingPartPools: noop, macroHueFamily: noop,
    rollBuilding(g, width) {
      g.userData.width = width;
      const variant = g.userData.kiezVariantOverride ?? 3;
      g.add(new T.Mesh(kit.geometry(width, variant, g.userData.side), kit.material));
    }});
  layoutCode.runInContext(c);
  for (const g of buildings) {g.position.z += index * 40; g.updateMatrixWorld(true);}
  return {index, buildings, reference: c.referenceBeat, cross: c.hasCross, motif: c.motif, context: c};
}
const blocks = Array.from({length: 65}, (_, i) => block(i - 16));
const actorFlags = new vm.Script(section('    ud.motif =', '    if (hasStation)', rollStart));
// Execute the shipped flags across recycled/negative indices and both routes.
// Inactive legacy actors must be explicitly retired, not merely hidden behind
// the reference facades while their mover callbacks continue running.
let routeFlagChecks = 0;
for (const reference of [true,false]) for (let index = -32; index <= 64; index++) {
  const part = () => ({root:{visible:true},train:{},vessels:{},sweep:{}});
  const ud = {construction:{visible:true},constructionSides:[],catenary:{},station:part(),bridge:part(),tunnel:part()};
  const state = vm.createContext({CHUNK_LEN:40,chunkZ:index*40,KIEZ_DISTRICT_ENABLED:reference,ud,
    setMoverLive:(actor,on)=>{actor.live=on;}});
  vm.runInContext(flags,state);actorFlags.runInContext(state);
  const cycle = ((index%8)+8)%8,macro=((index%16)+16)%16,motif=((index%4)+4)%4;
  assert.equal(state.referenceBeat,reference);
  for (const [key,expected] of [['station',!reference&&motif===2&&cycle===2],
    ['bridge',!reference&&motif===2&&macro===6],['tunnel',!reference&&motif===0&&macro===12]]) {
    assert.equal(ud[key].root.visible,expected,'macro actor visibility follows the selected route');
    assert.equal((key==='bridge'?ud[key].vessels:ud[key].train).live,expected,'inactive transport movers are retired on reroll');
    if(key==='tunnel')assert.equal(ud[key].sweep.live,expected);
  }
  assert.equal(ud.construction.visible,!reference&&motif===3,'construction survives only in the unchanged legacy route');
  if(reference){assert.ok([0,1,2].includes(ud.motif));assert.equal(ud.catenary.visible,true);}
  else assert.equal(ud.motif,motif,'legacy four-beat motif sequence is preserved');
  routeFlagChecks++;
}
let visible = 0, minRoadGap = Infinity, ordinarySeams = 0;
for (const b of blocks) {
  assert.equal(b.buildings.length, 6, 'same six reusable facade slots');
  assert.equal(b.reference,true,'every Kiez block retains the reference garden street');
  assert.equal(b.context.bridgeEdgeChunk,false,'removed river sequence leaves no bridge-neighbour special cases');
  assert.equal(b.buildings.filter(g=>g.visible).length,b.cross?2:6,
    'ordinary blocks retain every lot; only the two approach frontages border a crossing');
  for (const g of b.buildings.filter(g => g.visible)) {
    visible++;
    const box = new T.Box3().setFromObject(g);
    const roadGap = (g.userData.side > 0 ? box.min.x : -box.max.x) - 7.2;
    minRoadGap = Math.min(minRoadGap, roadGap);
    assert.ok(roadGap >= .3, 'all masonry, awnings and trim clear the fixed road by at least 30 cm');
    if (b.reference && b.cross) {
      assert.ok(Math.abs(g.position.z - b.index * 40) - g.userData.width / 2 >= 9,
        'actual frontages preserve the full 18 m crossing opening');
    }
  }
}
for (const side of [-1, 1]) {
  const street = blocks.flatMap(b => b.buildings.filter(g => g.visible && g.userData.side === side))
    .sort((a,b) => a.position.z - b.position.z);
  for (let i = 1; i < street.length; i++) {
    const a = street[i - 1], b = street[i];
    const gap = b.position.z - b.userData.width / 2 - a.position.z - a.userData.width / 2;
    assert.ok(gap >= -.001, 'consecutive real building bodies never intersect across recycled blocks');
    assert.ok(Math.abs(gap-2/3)<.001||Math.abs(gap-24)<.001||Math.abs(gap-29)<.001,
      'every gap is an ordinary lot joint or the authored crossing, never a removed macro destination');
    if(gap>1)assert.ok(blocks.some(block=>block.cross&&
      a.position.z+a.userData.width/2<=block.index*40-9&&b.position.z-b.userData.width/2>=block.index*40+9),
      'every larger gap contains a complete18m viaduct/cross-street aperture');
    if (Math.abs(gap - 2 / 3) < .001) ordinarySeams++;
  }
}
const opening = blocks.find(b => b.index === 0);
const camera = new T.PerspectiveCamera(40, 16 / 9, .1, 350);
camera.position.set(0, 2.55, -6.5); camera.lookAt(0, 2.45, 11.3); camera.updateMatrixWorld(true);
const atlasCell = uv => Math.floor(uv.x * 4) + 4 * Math.floor((1 - uv.y) * 4);
const projection = [];
for (const [slot, cell, expectedLeft, expectedRight] of [[5,5,13,29], [2,4,75,99]]) {
  const g = opening.buildings[slot], mesh = g.children[0], pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
  let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    if (atlasCell(new T.Vector2(uv.getX(i), uv.getY(i))) !== cell || pos.getY(i) < .50 || pos.getY(i) > (cell === 5 ? 5.12 : 3.9)) continue;
    const p = new T.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(camera);
    left = Math.min(left, (p.x + 1) * 50); right = Math.max(right, (p.x + 1) * 50);
    top = Math.min(top, (1 - p.y) * 50); bottom = Math.max(bottom, (1 - p.y) * 50);
  }
  assert.ok(left >= expectedLeft && right <= expectedRight, 'actual authored goods are inside the requested outer-third frame: '+JSON.stringify({slot,left,right,expectedLeft,expectedRight}));
  const sourceXs = cell === 5 ? [-4.9,-3.8,-2.7,-1.6,-.5] : [-5.3,-4.2,-3.1,-1.1,0,1.1,3.1,4.2,5.3];
  let visibleGoods = 0; const blockedGoods=[], visibleColumnCounts=new Map();
  for (const x of sourceXs) for (const y of [1.25,2.05,2.8]) {
    const target = new T.Vector3(x * g.userData.side * g.userData.width / 13.5, y, -.625).applyMatrix4(mesh.matrixWorld);
    const projected = target.clone().project(camera);
    if (Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) continue;
    const ray = new T.Raycaster(camera.position, target.sub(camera.position).normalize());
    const hit = ray.intersectObjects(opening.buildings.filter(b => b.visible), true)[0];
    if (hit && hit.object === mesh && atlasCell(hit.uv) === cell) {visibleGoods++;visibleColumnCounts.set(x,(visibleColumnCounts.get(x)||0)+1);}
    else blockedGoods.push({x,y,cell:hit?.uv?atlasCell(hit.uv):null,point:hit?.point.toArray(),building:hit?.object.parent.position.toArray()});
  }
  // The farther bakery angle exposes three complete merchandise columns.
  // Require every sampled height in those columns to reach the real room;
  // report partial visibility rather than treating a wall hit as merchandise.
  const fullVisibleColumns=[...visibleColumnCounts.values()].filter(count=>count===3).length;
  assert.ok(fullVisibleColumns >= 3, 'perspective rays reach three complete merchandise columns: '+JSON.stringify({slot,visibleGoods,fullVisibleColumns,blockedGoods}));
  projection.push({shop: cell === 5 ? 'bakery' : 'bookstore', left, right, top, bottom, visibleGoods,fullVisibleColumns,blockedGoods});
}
// Retiring a complete chunk must never remove its forward-shifted facade in view.
const retire = Number(html.match(/var visible = dz > -(\d+(?:\.\d+)?) && dz < farLimit/)[1]);
const retireCamera = new T.PerspectiveCamera(40, 16 / 9, .1, 350);
retireCamera.position.set(0, 2.55, -8.1); retireCamera.lookAt(0, 2.45, 11.3); retireCamera.updateMatrixWorld(true);
const frustum = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(retireCamera.projectionMatrix, retireCamera.matrixWorldInverse));
for (const g of opening.buildings) {
  const bounds = new T.Box3().setFromObject(g).translate(new T.Vector3(0, 0, -retire));
  assert.ok(!frustum.intersectsBox(bounds), 'whole-chunk retirement is beyond the current desktop frustum, including maximum chase dolly');
}
assert.ok(html.includes('c.position.z < playerZ - CHUNK_LEN * 1.6'), 'recycling retains its later 64 m retirement margin');
// Instantiate the actual Blender props and their shipped placement blocks.
vm.runInContext(fs.readFileSync(path.join(__dirname, 'berlin_garden_integration.js'), 'utf8'), scope);
const garden = scope.createBerlinGardenKit(T, (color, opts) => new T.MeshStandardMaterial({color, ...opts}),
  JSON.parse(fs.readFileSync(path.join(root, process.env.BERLIN_GARDEN_DIR || 'assets/models', 'berlin-kiez-garden-v1.json'))));
const makePlanter = new Function('THREE', 'berlinGardenKit', 'registerProp',
  section('  function makePlanter()', '  // Wheelie bin') + '\nreturn makePlanter;')(T, garden, (kind,g) => (g.userData.propKind = kind, g));
const propSlots = [makePlanter(), makePlanter(), makePlanter()].map(g => ({variants: [g]}));
const cafeContext=vm.createContext({THREE:T,clamp:T.MathUtils.clamp,KIEZ_DISTRICT_ENABLED:true,
  MAT:{metalDark:new T.MeshStandardMaterial(),barrierWhite:new T.MeshStandardMaterial()},
  PROP_WOOD:new T.MeshStandardMaterial(),freezeObjectTree:g=>g.updateMatrixWorld(true)});
for(const [a,b]of [
  ['  var geoCache = Object.create(null);','  // ------------------------------------------------- generated prop swaps'],
  ['  function mergeBoxes(specs) {','\n  // DRAW-CALL CONSOLIDATION:'],
  ['  var staticMergeGeometryCache = new Map();','  // Merges building parts that carry different materials']
])vm.runInContext(section(a,b),cafeContext);
cafeContext.registerProp=(kind,g)=>{cafeContext.compactStaticPropGroup(g);g.userData.propKind=kind;return g;};
vm.runInContext(section('  function makeCafeSet()','  // Pavement commuters'),cafeContext);
const cafe=cafeContext.makeCafeSet();
const cafeMeshes=[];cafe.traverse(m=>{if(m.isMesh)cafeMeshes.push(m);});
assert.equal(cafeMeshes.length,3,'the complete bistro set compacts to three opaque material batches');
assert.ok(cafeMeshes.every(m=>!m.material.transparent));
const furnishedSlots=[...propSlots,{variants:[cafe]}];
const planterExtent = new Function('THREE', section('  var propBoundsRootInv =', '  var PARKING_TRUNK_BOUNDS =') +
  '\nreturn propExtentTowardFacade;')(T);
const props = {ud: {props: furnishedSlots, buildings: opening.buildings}, referenceBeat: true, contactCount: 0,
  pushContact: (_,count) => count + 1, propExtentTowardFacade: planterExtent};
const planterPlacement = section('    if (referenceBeat) {\n      var referencePlanterCount', '    // Crate stacks:', rollStart);
vm.runInNewContext(planterPlacement, props);
const cafeBounds=new T.Box3().setFromObject(cafe);
assert.ok(cafe.visible&&cafeBounds.min.x>7.5&&cafeBounds.max.x<10.66,
  'the bakery bistro uses its existing slot and clears road and facade');
assert.ok(cafeBounds.min.y>=.16&&cafeBounds.max.y<1.15,'the bistro stays grounded and below the display sightlines');
for(const g of propSlots.map(slot=>slot.variants[0]))
  assert.ok(!cafeBounds.intersectsBox(new T.Box3().setFromObject(g)),'chairs and table do not intersect the planted containers');
let minimumPlanterClearance = Infinity;
const planterProjection=[];
for (const g of propSlots.map(slot => slot.variants[0])) {
  assert.ok(g.visible, 'three existing planter slots remain assigned to the focal shops');
  const side = Math.sign(g.position.x), bounds = new T.Box3().setFromObject(g);
  const gap = (side > 0 ? bounds.min.x : -bounds.max.x) - 7.2;
  minimumPlanterClearance = Math.min(minimumPlanterClearance, gap);
  assert.ok(gap >= .3, 'actual complete planter retains at least 30 cm positive road clearance');
  assert.ok((side > 0 ? bounds.max.x : -bounds.min.x) <= 10.66,
    'actual planter flowers and pot remain ahead of the facade wall');
  assert.ok(bounds.max.y-bounds.min.y>=1.75&&bounds.max.y-bounds.min.y<=2.02,
    'the full planted silhouette remains between 1.75 and 2.02m while framing the display');
  const foot=new T.Vector3(g.position.x,bounds.min.y,g.position.z).project(camera);
  const top=new T.Vector3(g.position.x,bounds.max.y,g.position.z).project(camera);
  planterProjection.push({side:side>0?'left':'right',x:g.position.x,z:g.position.z,
    screenX:(foot.x+1)*50,screenTop:(1-top.y)*50,screenBottom:(1-foot.y)*50});
}
assert.deepEqual(propSlots.map(slot=>Math.sign(slot.variants[0].position.x)),[1,-1,-1],
  'one bakery planter and two bookstore planters frame the portal edges');
const builders = section('    var propBuilders = [', '    var shuffledProps =', html.indexOf('  function makeChunk('));
const builderNames=builders.match(/make[A-Za-z]+/g);
assert.equal(builderNames.length,22,'existing builder-list length and24-root pool retained');
assert.equal(builderNames.filter(name=>name==='makePlanter').length,3,
  'every shuffle guarantees three actual Blender planter instances');
let planterPortalRays=0;
for(const [slot,xs]of [[5,[-4.2,-2.7,-1.2]],[2,[-4.2,0,4.2]]]) {
  const building=opening.buildings[slot],scale=building.userData.width/13.5;
  for(const x of xs)for(const y of [1.9,2.6]) {
    const target=new T.Vector3(x*scale*building.userData.side,y,-.625).applyMatrix4(building.matrixWorld);
    const ray=new T.Raycaster(camera.position,target.clone().sub(camera.position).normalize());
    const hit=ray.intersectObjects([...opening.buildings.filter(b=>b.visible),...furnishedSlots.map(slot=>slot.variants[0])],true)[0];
    assert.ok(hit&&hit.object.parent===building,`foreground plants leave display centres visible: shop ${slot}, local x ${x}, height ${y}; hit parent ${hit?.object.parent?.position.toArray()}`);
    planterPortalRays++;
  }
}
// Confirm actual pool enrollment; cloning holder materials must leave the
// shared garden material live, with all three plants submitted by one draw.
const fixtureScene=new T.Scene(),fixtureWorld=new T.Group(),fixtureChunk=new T.Group();
fixtureScene.add(fixtureWorld);fixtureWorld.add(fixtureChunk);
const pooledPlanters=propSlots.map(slot=>slot.variants[0].clone(true));
const nearbyCafe=cafe.clone(true),hiddenCafe=cafe.clone(true);hiddenCafe.visible=false;
const pooledFixtures=[...pooledPlanters,nearbyCafe,hiddenCafe];
pooledFixtures.forEach(g=>fixtureChunk.add(g));
fixtureChunk.userData={lampBatches:[],treeBatches:[],manholes:[],lamps:[],props:pooledFixtures.map(g=>({variants:[g]}))};
const poolContext=vm.createContext({THREE:T,PROFILE_RENDER:false,ASSETS:{props:{}},scene:fixtureScene,
  worldRoot:fixtureWorld,chunks:[fixtureChunk],sun:new T.DirectionalLight(),updateStreetTreeLOD:noop});
vm.runInContext('var streetFixturePools=null;\n'+section('  function installStreetFixturePools()', '  var SOFT_TREE_CANOPY =')+
  '\ninstallStreetFixturePools();',poolContext);
assert.equal(poolContext.streetFixturePools.pools.length,4,'planters share one pool and the complete bistro shares three across the street');
assert.equal(poolContext.streetFixturePools.sources.length,9);
fixtureScene.updateMatrixWorld(true);
fixtureScene.onBeforeRender({shadowMap:{enabled:false}},fixtureScene,camera);
assert.equal(poolContext.streetFixturePools.pools[0].mesh.userData.streetFixtureBeautyCount,3,
  'all three visible plants render through one instanced beauty draw');
for(const pool of poolContext.streetFixturePools.pools.slice(1))
  assert.equal(pool.mesh.userData.streetFixtureBeautyCount,1,'only the visible bistro contributes to each shared material draw');
const roundedGeo = new Function('THREE', 'clamp', section('  var geoCache = Object.create(null);',
  '  // Generalised sibling to roundedBoxGeo') + '\nreturn roundedBoxGeo;')(T, T.MathUtils.clamp);
const getFarTree = new Function('THREE', 'berlinGardenKit', 'var streetTreeFarGeometry=null;\n' +
  section('  function getStreetTreeFarGeometry()', '  function makeTree()') + '\nreturn getStreetTreeFarGeometry;')(T, garden);
const makeTree = new Function('THREE', 'berlinGardenKit', 'registerProp', 'roundedBox', 'MAT', 'getStreetTreeFarGeometry',
  section('  function makeTree()', '  // Litfaßsäule') + '\nreturn makeTree;')(T, garden, (kind,g) => g,
    (w,h,d,r,mat,x,y,z,bevel) => {const m = new T.Mesh(roundedGeo(w,h,d,r,bevel), mat); m.position.set(x,y,z); return m;},
    {kerb: kit.material, metalDark: kit.material}, getFarTree);
const trees = Array.from({length: 4}, makeTree);
const treePlacement = section('    ud.trees.forEach(function (tree, i)', '    // Sidewalk props:', rollStart);
vm.runInNewContext(treePlacement,
  {ud: {trees}, motif: 0, referenceBeat: true, ROAD_HALF: 7.2, hierarchyStoryOn: false,
    hasCross: false, hasStation: false, hasBridge: false, hasTunnel: false, bridgeEdgeChunk: false,
    contactCount: 0, pushContact: (_,count) => count + 1});
let minimumPitRoadClearance = Infinity, maximumPitFacadeReach = -Infinity;
for (const g of trees) {
  g.updateMatrixWorld(true);
  const side = Math.sign(g.position.x), pit = new T.Box3();
  for (const mesh of g.children.slice(1)) pit.union(new T.Box3().setFromObject(mesh));
  const gap = (side > 0 ? pit.min.x : -pit.max.x) - 7.2;
  const reach = side > 0 ? pit.max.x : -pit.min.x;
  minimumPitRoadClearance = Math.min(minimumPitRoadClearance, gap);
  maximumPitFacadeReach = Math.max(maximumPitFacadeReach, reach);
  assert.ok(gap >= .3, 'the complete rotated/scaled tree pit clears road+30cm');
  assert.ok(reach <= 10.70, 'the rotated tree pit is ahead of the new frontage plinth');
}
// The changed crowns remain inside their owning slabs, including recycled
// positions. The existing chunk-edge gate therefore retains its full margin.
let stagedTreeBlocks = 0, stagedTreeCount = 0;
for (const b of blocks.filter(b => b.reference)) {
  const fixture = b.context;
  fixture.ud.trees = Array.from({length: 4}, makeTree);
  Object.assign(fixture, {ROAD_HALF: 7.2, hierarchyStoryOn: false, contactCount: 0,
    pushContact: (_, count) => count + 1});
  vm.runInContext(treePlacement, fixture);
  stagedTreeBlocks++;
  for (const tree of fixture.ud.trees.filter(tree => tree.visible)) {
    tree.updateMatrixWorld(true);
    const bounds = new T.Box3().setFromObject(tree);
    assert.ok(bounds.min.z >= -20 && bounds.max.z <= 20,
      'actual crown remains inside the owner chunk used by near/far/recycle gates');
    const pit = new T.Box3();
    for (const mesh of tree.children.slice(1)) pit.union(new T.Box3().setFromObject(mesh));
    assert.ok((tree.position.x > 0 ? pit.min.x : -pit.max.x) >= 7.5,
      'every visible staged tree pit retains road+30cm clearance across recycled blocks');
    stagedTreeCount++;
  }
}
const margin = Number(html.match(/var NEAR_CULL_MARGIN = ([\d.]+)/)[1]);
const bulkFar = Number(html.match(/var NEAR_BULK_FAR = ([\d.]+)/)[1]);
const treeWantedSource = section('      var canopyExtent = (tree.userData.canopyRadius', '      if (tree.visible !== treeWanted)', html.indexOf('  function applyChunkLOD('));
const treeWanted = new Function('tree', 'chunk', 'playerZ', 'nearCullZ',
  'var dz=chunk.position.z-playerZ,CHUNK_LEN=40,NEAR_BULK_FAR=' + bulkFar + ';\n' +
  html.match(/    var chunkNearAlive = [^;]+;/)[0] + '\n' +
  html.match(/    var bulkNear = [^;]+;/)[0] + '\n' + treeWantedSource + '\nreturn treeWanted;');
let invisibleRetirementChecks = 0;
const treeViewProfiles=[
  {name:'desktop',fov:40,aspect:16/9,height:2.55,aim:2.45,ahead:11.3,backs:[6.5,8.1]},
  {name:'phone',fov:69,aspect:390/844,height:3.57,aim:1.12,ahead:12.8,backs:[5.5,7.1]}
];
for (const profile of treeViewProfiles) for (const back of profile.backs) for (const cx of [-1.5, 0, 1.5]) for (let playerZ=-12; playerZ<=72; playerZ+=2) {
  const chase = new T.PerspectiveCamera(profile.fov,profile.aspect,.1,350);
  chase.position.set(cx,profile.height,playerZ-back); chase.lookAt(cx,profile.aim,playerZ+profile.ahead); chase.updateMatrixWorld(true);
  const view = new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(chase.projectionMatrix,chase.matrixWorldInverse));
  for (const tree of trees) {
    if (treeWanted(tree,{position:{z:0}},playerZ,playerZ-back-margin)) continue;
    assert.ok(!view.intersectsBox(new T.Box3().setFromObject(tree)),
      'actual tree near-retirement occurs outside the '+profile.name+' chase frustum, including lateral lag and maximum dolly');
    invisibleRetirementChecks++;
  }
}
// Compare only the previous versus current tree placements. Geometry, camera,
// facade and material are identical on each side of this occlusion check.
function treeScene(previous) {
  const result=[];
  for (const chunkZ of [0,40]) trees.forEach((original,i) => {
    const copy=original.clone(true);
    copy.position.z=chunkZ+(previous?[12,18,8,18][i]:original.position.z);
    copy.updateMatrixWorld(true);result.push(copy);
  });
  return result;
}
const oldTrees=treeScene(true), newTrees=treeScene(false);
const treeOcclusion=[],treeSightlines=[];
for (const [slot,name] of [[5,'bakery canopy'],[5,'bakery display'],[2,'bookstore arches']]) {
  const building=opening.buildings[slot], scale=building.userData.width/13.5, targets=[];
  if(name==='bakery canopy') {
    for(let x=-5.9;x<.4;x+=.65)for(const z of [.65,1.20,1.75]) {
      targets.push(new T.Vector3(x*scale,5.65-(z-.2)*1.8/1.95+.04,z).applyMatrix4(building.matrixWorld));
    }
  } else if(slot===5) {
    for(const x of [-4.9,-3.8,-2.7,-1.6,-.5])for(const y of [1.25,2.05,2.8]) {
      targets.push(new T.Vector3(x*scale,y,-.625).applyMatrix4(building.matrixWorld));
    }
  } else {
    for(const x of [-5.3,-4.2,-3.1,-1.1,0,1.1,3.1,4.2,5.3])for(const y of [2.6,3.0,3.5]) {
      targets.push(new T.Vector3(x*scale*building.userData.side,y,-.625).applyMatrix4(building.matrixWorld));
    }
  }
  let before=0, after=0, inFrame=0;const merchandiseOccluders=[];
  for(const playerZ of [0,2,5]) {
    const chase=camera.clone();chase.position.z+=playerZ;chase.lookAt(0,2.45,11.3+playerZ);chase.updateMatrixWorld(true);
    for(const target of targets) {
      const screen=target.clone().project(chase);if(Math.abs(screen.x)>1||Math.abs(screen.y)>1)continue;
      inFrame++;
      const ray=new T.Raycaster(chase.position,target.clone().sub(chase.position).normalize());
      for(const [collection,old] of [[oldTrees,true],[newTrees,false]]) {
        const hit=ray.intersectObjects([...opening.buildings.filter(b=>b.visible),...collection],true)[0];
        if(hit&&hit.object.parent===building){if(old)before++;else after++;}
        else if(!old&&name==='bakery display')merchandiseOccluders.push({playerZ,
          target:target.toArray(),tree:hit?.object.parent.position.toArray(),hit:hit?.point.toArray()});
      }
    }
  }
  // Foreground foliage may overlap the awning as in the reference. Actual
  // bakery merchandise and book displays must retain their clear sightlines.
  if(name!=='bakery canopy') {
    assert.ok(after>=before,'foreground staging does not reduce visible merchandise in '+name+' '+
      JSON.stringify({before,after,inFrame,occluders:merchandiseOccluders.slice(0,4)}));
    assert.equal(after,inFrame,'foreground trees keep sampled merchandise sightlines to '+name+' clear');
  }
  treeOcclusion.push({subject:name,inFrame,before,after});
  // Check the taller accepted crowns against independently verified facade
  // sightlines. Phone views include the earlier approach while these side
  // shops are still inside its narrower horizontal field of view.
  for(const profile of treeViewProfiles){
    let viewRays=0,facadeVisible=0,treeBlocked=0,openingBlocked=0;const blockedSamples=[];
    for(const playerZ of [-12,-6,0,2,5])for(const cameraX of [-1.5,0,1.5]){
      const chase=new T.PerspectiveCamera(profile.fov,profile.aspect,.1,350);
      chase.position.set(cameraX,profile.height,playerZ-profile.backs[0]);
      chase.lookAt(cameraX,profile.aim,playerZ+profile.ahead);chase.updateMatrixWorld(true);
      for(const target of targets){
        const screen=target.clone().project(chase);if(Math.abs(screen.x)>1||Math.abs(screen.y)>1)continue;
        viewRays++;
        const ray=new T.Raycaster(chase.position,target.clone().sub(chase.position).normalize());
        const facadeHit=ray.intersectObjects(opening.buildings.filter(b=>b.visible),true)[0];
        if(!facadeHit||facadeHit.object.parent!==building)continue;
        facadeVisible++;
        const treeHit=ray.intersectObjects(newTrees,true)[0];
        if(treeHit&&treeHit.distance<facadeHit.distance-.001){treeBlocked++;if(playerZ>=0)openingBlocked++;blockedSamples.push({playerZ,cameraX,target:target.toArray(),
          tree:treeHit.object.parent.position.toArray(),hit:treeHit.point.toArray()});}
      }
    }
    assert.ok(facadeVisible>0,'approach samples reach '+name+' in the '+profile.name+' view');
    if(name!=='bakery canopy')assert.equal(openingBlocked,0,
      'foreground trees preserve opening/run merchandise sightlines to '+name+' across '+profile.name+' lateral views');
    // Earlier approach overlap is reported separately: a distant branch may
    // cross an awning edge without covering its focal opening/run view.
    treeSightlines.push({view:profile.name,subject:name,viewRays,facadeVisible,treeBlocked,openingBlocked,blockedSamples});
  }
}
const report = {pass: true, blocks: blocks.length, routeFlagChecks, visibleFacades: visible,
  minimumRoadClearance: minRoadGap, ordinarySeams, projection, minimumPlanterClearance,
  planterProjection, planterPortalRays, planterDraws:poolContext.streetFixturePools.pools.length,
  minimumPitRoadClearance, maximumPitFacadeReach, stagedTreeBlocks, stagedTreeCount,
  invisibleRetirementChecks, treeOcclusion,treeSightlines};
const reportJson = JSON.stringify(report, null, 2);
if (process.argv[2]) fs.writeFileSync(path.resolve(root, process.argv[2]), reportJson + '\n');
console.log(reportJson);
