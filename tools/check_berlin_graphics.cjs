// Run with: node tools/check_berlin_graphics.cjs
// Tests the actual embedded geometry merger, including its canopy-color path.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'berlin-runner.html'), 'utf8').replace(/\r\n/g, '\n');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
scripts.forEach((source, i) => new vm.Script(source, {filename:`inline-${i}.js`}));
const context = vm.createContext({console});
vm.runInContext(scripts.find(s => s.includes('three.js r156 (MIT)')), context);
const THREE = context.THREE;
const postStart=html.indexOf('  function makeReferenceStonePostGeometry() {');
const postEnd=html.indexOf('  var bollardGeometry =',postStart);
const stonePost=new Function('THREE',html.slice(postStart,postEnd)+'return makeReferenceStonePostGeometry();')(THREE);
assert.equal(stonePost.index.count/3,320,'one shared post stays within its 320-triangle budget');
const postBox=stonePost.boundingBox;
assert.ok(Math.abs(postBox.min.y+.4)<1e-6&&Math.abs(postBox.max.y-.6)<1e-6);
assert.ok(postBox.max.x<=.180001&&postBox.min.x>=-.180001);
for(let v=0;v<stonePost.attributes.position.count;v++) {
  const n=new THREE.Vector3().fromBufferAttribute(stonePost.attributes.normal,v);
  assert.ok(Math.abs(n.length()-1)<.00001,'post profile normals are normalized');
}
const postMesh=new THREE.Mesh(stonePost,new THREE.MeshStandardMaterial({vertexColors:true}));
let postRays=0;
for(const y of [-.33,0,.35,.46,.57])for(let side=0;side<16;side++) {
  const angle=side/16*Math.PI*2,ray=new THREE.Raycaster(new THREE.Vector3(Math.cos(angle),y,Math.sin(angle)),new THREE.Vector3(-Math.cos(angle),0,-Math.sin(angle)));
  assert.ok(ray.intersectObject(postMesh).length,'rounded post has a closed outward-facing silhouette');postRays++;
}
const rollStart=html.indexOf('  function rollBollards(ud) {'),rollEnd=html.indexOf('  // Station/bridge/tunnel frontages',rollStart);
const rollStone=new Function('THREE','REFERENCE_STONE_POSTS','ROAD_HALF','BOLLARD_ZERO','bollardZeroQuat','BOLLARD_ZERO_SCALE',html.slice(rollStart,rollEnd)+'return rollBollards;')(
  THREE,true,7.2,new THREE.Vector3(0,-50,0),new THREE.Quaternion(),new THREE.Vector3(0,0,0));
const postMatrices=Array.from({length:16},()=>new THREE.Matrix4());
const postUd={motif:0,bollardsView:{setMatrixAt:(i,m)=>postMatrices[i].copy(m),needsUpdate:()=>{}}};
for(const motif of [0,1,2,1,0]) {
  postUd.motif=motif;rollStone(postUd);
  const visible=postMatrices.filter(m=>m.elements[0]!==0);
  assert.equal(visible.length,motif===1?8:16,'crossings clear their middle and recycled blocks restore all posts');
  for(const m of visible) {
    assert.ok(Math.abs(m.elements[12])-.18>7.2,'post silhouette stays outside every running lane');
    if(motif===1)assert.ok(Math.abs(m.elements[14])-.18>9,'complete viaduct opening remains clear');
    assert.equal(m.elements[13],.4,'post base retains its curb-relative height');
  }
}
console.log(`PASS: stone curb posts; ${postRays} silhouette rays, unit normals, 320 triangles, same 16-slot pool, road/crossing clearance and recycled layout.`);
function sourceBetween(start, end) {
  const a=html.indexOf(start), b=html.indexOf(end,a+start.length);
  assert.ok(a>=0 && b>a, `embedded source section: ${start}`);
  return html.slice(a,b);
}
const begin = html.indexOf('  function mergeBoxes(specs) {');
const end = html.indexOf('\n  // DRAW-CALL CONSOLIDATION:', begin);
const merge = new Function('THREE', html.slice(begin, end) + '\nreturn mergeBoxes;')(THREE);
const colored = new THREE.BoxGeometry(1, 1, 1);
const colors = new Uint16Array(colored.attributes.position.count * 3);
for (let i = 0; i < colors.length; i += 3) { colors[i] = 32768; colors[i+1] = 65535; colors[i+2] = 16384; }
colored.setAttribute('color', new THREE.Uint16BufferAttribute(colors, 3, true));
const originalX = colored.attributes.position.getX(0);
const plain = new THREE.BoxGeometry(1, 1, 1);
const result = merge([{geo:colored, x:3}, {geo:plain}]);
assert.equal(result.attributes.position.count, 72);
assert.equal(result.attributes.color.count, 72);
assert.ok(Math.abs(result.attributes.color.getX(0) - 32768 / 65535) < 1e-6);
assert.equal(result.attributes.color.getY(0), 1);
assert.equal(result.attributes.color.getX(36), 1);
assert.equal(result.attributes.position.getX(0), originalX + 3);
assert.equal(colored.attributes.position.getX(0), originalX, 'shared input geometry must remain unchanged');
assert.equal(merge([{geo:plain}]).attributes.color, undefined, 'plain batches must not allocate unused colors');
assert.ok(result.boundingSphere && Number.isFinite(result.boundingSphere.radius));

// The transit landmark is a closed masonry body with a genuine open barrel.
// Ray tests exercise the actual exported surface, not its construction formula.
const transitCache=new Map(),transitRoot=new THREE.Group();
const transitDeckLift=Number(html.match(/var deckLift = ([\d.]+);/)[1]);
const transitContext=vm.createContext({THREE,Math,mergeBoxes:merge,root:transitRoot,
  deckLift:transitDeckLift,
  STREET_MAT:{viaductBrick:new THREE.MeshStandardMaterial({map:new THREE.Texture()})},
  cached:(key,build)=>{if(!transitCache.has(key))transitCache.set(key,build());return transitCache.get(key);}});
const transitArchSource=sourceBetween("    var archGeo = cached('viaduct_masonry_arch_v4'",
  '    // Cream coping sits above the arch;');
vm.runInContext(transitArchSource,transitContext);
const transitArch=transitContext.archGeo,transitMesh=transitContext.masonryArch;
vm.runInContext(transitArchSource,transitContext);
assert.equal(transitContext.archGeo,transitArch,'every recycled transit root reuses one masonry geometry');
transitMesh.updateMatrixWorld(true);transitArch.computeBoundingBox();
assert.ok(transitArch.boundingBox.min.x>=-26.001&&transitArch.boundingBox.max.x<=26.001,
  'outer support piers stay within the existing 52m deck footprint');
assert.ok(transitArch.boundingBox.min.y>=-.02&&Math.abs(transitArch.boundingBox.max.y-10.15)<.001,
  'taller spandrels terminate at the 10.15m deck underside');
assert.ok(transitArch.boundingBox.min.z>=-2.406&&transitArch.boundingBox.max.z<=2.406,
  'shallow raised ring and bevel remain inside the existing 4.9m coping depth');
assert.equal(transitArch.groups.length,0,'solid brick body and both lips use one material submission');
assert.ok(transitMesh.material.vertexColors&&!transitContext.STREET_MAT.viaductBrick.vertexColors,
  'radial stone colors stay on one dedicated opaque arch material');
assert.equal(transitMesh.material,transitContext.STREET_MAT.viaductRing,'recycled roots share the colored masonry material');
assert.equal(transitMesh.material.map,transitContext.STREET_MAT.viaductBrick.map,'base brick atlas stays shared and unmodified');
for(let v=0;v<transitArch.attributes.position.count;v++){
  const p=transitArch.attributes.position,n=transitArch.attributes.normal,u=transitArch.attributes.uv;
  assert.ok([p.getX(v),p.getY(v),p.getZ(v),u.getX(v),u.getY(v)].every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(n.getX(v),n.getY(v),n.getZ(v))-1)<1e-5,'unit arch and bevel normals');
}
let openTransitRays=0;
for(const x of [-5.0,-2.8,0,2.8,5.0])for(const y of [.35,1.8,3.9,6.3]){
  const hits=new THREE.Raycaster(new THREE.Vector3(x,y,-15),new THREE.Vector3(0,0,1)).intersectObject(transitMesh);
  assert.equal(hits.length,0,'runner, jump and gate headroom remain open through the full barrel');openTransitRays++;
}
for(const angle of [20,45,70,90,110,135,160]){
  const a=angle*Math.PI/180,dir=new THREE.Vector3(Math.cos(a),Math.sin(a),0);
  const hits=new THREE.Raycaster(new THREE.Vector3(0,1.18,0),dir).intersectObject(transitMesh);
  assert.ok(hits.length&&Math.abs(hits[0].distance-7.26)<.005,'actual barrel preserves the old inner radius');
  assert.ok(hits[0].face.normal.dot(dir)<-.99,'barrel faces into the aperture');
  assert.ok(Math.abs(hits[0].uv.y-a*7.26/2.16)<.001,'radial brick courses follow the curved reveal');
}
for(const x of [-6.2,-3.2,3.2,6.2]){
  const hits=new THREE.Raycaster(new THREE.Vector3(x,8.8,-15),new THREE.Vector3(0,0,1)).intersectObject(transitMesh);
  assert.ok(hits.length&&hits[0].face.normal.z<-.99,'solid front spandrels face the approaching camera');
  assert.ok(Math.abs(hits[0].uv.x-x/.64)<1e-5&&Math.abs(hits[0].uv.y-8.8/2.16)<1e-5,
    'front masonry uses correctly scaled planar brick courses');
}
for(const side of [-1,1]){
  const direction=new THREE.Vector3(0,0,1);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(side*18,4,-15),direction).intersectObject(transitMesh).length,0,
    'open side bays retain the cross-street sightlines');
  for(const point of [[side*18,8.2],[side*25.35,.25]])assert.ok(
    new THREE.Raycaster(new THREE.Vector3(point[0],point[1],-15),direction).intersectObject(transitMesh).length,
    'solid side span connects the deck to a ground-reaching outer pier');
}
// Probe the actual entrance stones and narrow radial joints. Changing their
// color cannot quietly hide another overlaid ring or narrow the playable arch.
const stoneColors=new Set();let stoneRays=0;
for(let stone=0;stone<61;stone++)for(const radius of [7.52,8.13]){
  const angle=(stone+.5)*Math.PI/61;
  const hit=new THREE.Raycaster(new THREE.Vector3(Math.cos(angle)*radius,
    1.18+Math.sin(angle)*radius,-15),new THREE.Vector3(0,0,1)).intersectObject(transitMesh)[0];
  assert.ok(hit&&hit.face.normal.z<-.99,'each voussoir presents a visible front face');
  const projection=-hit.point.z-2.3;
  assert.ok(Math.abs(projection-(stone===30?.092:.075))<1e-5,'both sides of the broader ring project 75mm, with a 92mm keystone');
  stoneColors.add(transitArch.attributes.color.getX(hit.face.a).toFixed(3));stoneRays++;
}
for(let seam=1;seam<61;seam++)for(const radius of [7.52,8.13]){
  const angle=seam*Math.PI/61;
  const hit=new THREE.Raycaster(new THREE.Vector3(Math.cos(angle)*radius,
    1.18+Math.sin(angle)*radius,-15),new THREE.Vector3(0,0,1)).intersectObject(transitMesh)[0];
  assert.ok(hit&&Math.abs(hit.point.z+2.3)<1e-5,'radial mortar joint exposes the original masonry face');stoneRays++;
}
assert.equal(stoneColors.size,6,'five restrained brick tones plus one keystone survive geometry merging');
assert.ok(transitArch.attributes.position.count/3<3000,'solid arch remains within a small fixed geometry budget');
console.log(`PASS: cached ${transitArch.attributes.position.count/3}-triangle transit masonry, ${openTransitRays} open corridor rays, ${stoneRays} visible stone/joint rays, shared atlas/material, radial reveal UVs, front spandrels, unit normals, taller deck and unchanged footprint/aperture.`);

// Build every shipped terrace width/height/shop combination with the actual
// geometry factories. Check the form and UVs independently of its box assembly.
context.mergeBoxes=merge;
context.FACADE_STOREY_BANDS=Number(html.match(/var FACADE_STOREY_BANDS = (\d+)/)[1]);
context.buildingCoreGeo={};
context.MERGE_CORE_SHOP=false;
vm.runInContext(sourceBetween('  function scaleUV(', '  // ----------------------------------------------------- smooth PBR lighting'),context);
vm.runInContext(sourceBetween('  var STOREY_H =', '  // Which atlas cell'),context);
vm.runInContext(sourceBetween('  function mergeCoreParts(', '  // The whole point'),context);
vm.runInContext(sourceBetween('  function getTerraceBuildingCoreGeo(', '  function styleUnit('),context);
const shopSources=Object.fromEntries(Array.from(context.BUILD_WIDTHS,w=>[
  w,Array.from(context.shopGeo[w].attributes.position.array)
]));
let terraceVariants=0;
const terraceGeometries=new Set();
const extent=(points,axis)=>Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis]));
for(const width of context.BUILD_WIDTHS) for(const storeys of context.BUILD_STOREYS.filter(s=>s>=5)) for(const shopOn of [false,true]) {
  const geo=context.getTerraceBuildingCoreGeo(width,storeys,shopOn);
  terraceGeometries.add(geo);terraceVariants++;
  assert.equal(context.getTerraceBuildingCoreGeo(width,storeys,shopOn),geo,'recycled terrace uses its cached geometry');
  assert.deepEqual(Array.from(geo.groups,g=>g.materialIndex),shopOn?[0,2]:[0],
    'terrace retains the original facade/shop group IDs and draw count');
  const position=geo.attributes.position, normal=geo.attributes.normal, uv=geo.attributes.uv, color=geo.attributes.color;
  assert.equal(geo.groups.reduce((n,g)=>n+g.count,0),position.count,'material groups cover the complete core');
  geo.computeBoundingBox();
  assert.ok(geo.boundingBox.min.x>=-width/2-1e-5 && geo.boundingBox.max.x<=width/2+1e-5,'original frontage width');
  assert.ok(geo.boundingBox.min.z>=-15-1e-5 && geo.boundingBox.max.z<=0.10001,'original depth and shopfront clearance');
  assert.ok(Math.abs(geo.boundingBox.min.y)<1e-5 && geo.boundingBox.max.y<=storeys*context.STOREY_H+0.24001,'ground contact and bounded upper roof');
  const frontPlanes=new Map();
  for(let i=0;i<position.count;i++) {
    const x=position.getX(i), y=position.getY(i), z=position.getZ(i);
    assert.ok([x,y,z,uv.getX(i),uv.getY(i)].every(Number.isFinite),'finite geometry and UVs');
    const length=Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i));
    assert.ok(Math.abs(length-1)<1e-5,'terrace has finite unit normals');
    // The two full-color facade planes are independent of the darker mass and
    // parapets, and are confined to material group 0 (excluding the shop).
    if(i<geo.groups[0].count && color.getX(i)>.999 && normal.getZ(i)>.999) {
      const planeKey=z.toFixed(4);
      if(!frontPlanes.has(planeKey))frontPlanes.set(planeKey,[]);
      frontPlanes.get(planeKey).push({x,y,z,u:uv.getX(i),v:uv.getY(i)});
    }
  }
  assert.equal(frontPlanes.size,2,'two actual windowed frontage levels');
  const [lower,upper]=Array.from(frontPlanes.values()).sort((a,b)=>b[0].z-a[0].z);
  assert.ok(Math.abs(lower[0].z-upper[0].z-2.6)<1e-5,'upper frontage retreats exactly 2.6m');
  assert.ok(Math.abs(extent(lower,'x')-width)<1e-5 && extent(upper,'x')<width-1,'upper storeys narrow the silhouette');
  const shoulder=(storeys-2)*context.STOREY_H;
  assert.ok(Math.abs(Math.max(...lower.map(p=>p.y))-shoulder)<1e-5 &&
    Math.abs(Math.min(...upper.map(p=>p.y))-shoulder)<1e-5,'setback begins at the upper two storeys');
  for(const plane of [lower,upper]) {
    assert.ok(Math.abs(extent(plane,'u')/extent(plane,'x')-1/context.FACADE_TILE_W)<1e-6,'window width remains scaled in metres');
    for(const p of plane) assert.ok(Math.abs(p.v-p.y/(context.STOREY_H*context.FACADE_STOREY_BANDS))<1e-6,
      'painted floor sequence continues through the setback without UV stretching or restart');
  }
}
assert.equal(terraceVariants,24,'all shipped terrace geometry combinations checked');
assert.equal(terraceGeometries.size,terraceVariants,'different forms never alias the same cached buffer');
for(const width of context.BUILD_WIDTHS) assert.deepEqual(Array.from(context.shopGeo[width].attributes.position.array),shopSources[width],
  'terrace assembly never mutates the shared shop geometry');
const bayStart = html.indexOf('  var erkerGeo = (function () {');
const bayEnd = html.indexOf('\n  })();', bayStart) + '\n  })();'.length;
const bay = new Function('THREE','ERKER_H','FACADE_TILE_W','FACADE_STOREY_BANDS','scaleUV',
  html.slice(bayStart,bayEnd) + '\nreturn erkerGeo;')(THREE,10.8,7.2,3,(geo,u,v)=>{
    const uv=geo.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*u,uv.getY(i)*v);
  });
bay.computeBoundingBox();
assert.equal(bay.index.count/3,12,'shaped bay retains the original box triangle budget');
assert.ok(Math.abs(bay.boundingBox.min.z)<1e-5,'bay starts at the facade');
assert.ok(bay.boundingBox.max.z<2,'bay stays inside the sidewalk setback');
assert.ok(Math.abs(bay.boundingBox.min.y)<1e-5 && bay.boundingBox.max.y<10.81);
for(let i=0;i<bay.attributes.normal.count;i++){
  const n=new THREE.Vector3().fromBufferAttribute(bay.attributes.normal,i);
  assert.ok(Number.isFinite(n.length()) && Math.abs(n.length()-1)<1e-5,'deformed bay has finite unit face normals');
}
// Exercise the actual corner roll and detached cap writer through reuse. A
// scaled data-holder cap must match the bay, remain outside the road/crossing,
// and return to its ordinary geometry/scale instead of leaking the last roll.
const crossingLine = html.match(/  var crossingCornerBayGeo = [^;]+;/)[0];
const crossingBay = new Function('erkerGeo', crossingLine + '\nreturn crossingCornerBayGeo;')(bay);
crossingBay.computeBoundingBox();
assert.notEqual(crossingBay, bay);
assert.equal(crossingBay.index.count, bay.index.count, 'crossing corner also retains the 12-triangle bay budget');
assert.ok(Math.abs(bay.boundingBox.max.z - 1.9) < 1e-5, 'shared ordinary bay is not rescaled');
for (const variant of [crossingBay]) for (let i=0;i<variant.attributes.normal.count;i++) {
  const normal = new THREE.Vector3().fromBufferAttribute(variant.attributes.normal,i);
  assert.ok(Math.abs(normal.length()-1)<1e-5, 'anisotropic corner geometry preserves unit normals');
}
const roundedStart = html.indexOf('  var geoCache = Object.create(null);');
const roundedEnd = html.indexOf('  // Generalised sibling to roundedBoxGeo', roundedStart);
const buildRounded = new Function('THREE','clamp', html.slice(roundedStart,roundedEnd)+'\nreturn roundedBoxGeo;')(THREE,THREE.MathUtils.clamp);
const capGeometry = buildRounded(5.04,.46,2.28,.14,.04);
// Build the complete bridge support assembly up to the moving train. This
// catches a raised arch with old rails/coping left behind at the former height.
const supportStart=html.indexOf('  function makeTransitSpectacle(chunkSlot) {');
const supportEnd=html.indexOf('    for (var carIndex = 0;',supportStart);
const supportMaterials={},supportSteel={};
for(const key of ['metalDark','stone','rail'])supportMaterials[key]=new THREE.MeshStandardMaterial();
for(const key of ['viaductBrick','viaductDeck','viaductSteel'])supportSteel[key]=new THREE.MeshStandardMaterial();
const supportCache=new Map();
const supportFactory=new Function('THREE','cached','roundedBox','roundedBoxGeo','mergeBoxes','MAT','STREET_MAT',
  'stadtbahnFasciaGeometry','stadtbahnFasciaMat','viaductSignMat',
  html.slice(supportStart,supportEnd)+'return {root:root,train:train};}\nreturn makeTransitSpectacle;')(
    THREE,(key,create)=>{if(!supportCache.has(key))supportCache.set(key,create());return supportCache.get(key);},
    (w,h,d,r,m,x,y,z,b)=>{const o=new THREE.Mesh(buildRounded(w,h,d,r,b),m);o.position.set(x,y,z);return o;},
    buildRounded,merge,supportMaterials,supportSteel,()=>new THREE.PlaneGeometry(1,1),
    new THREE.MeshBasicMaterial(),new THREE.MeshBasicMaterial());
const support=supportFactory(0);support.root.updateMatrixWorld(true);
const rails=support.root.children.filter(o=>o.material===supportMaterials.rail);
assert.equal(rails.length,2,'both original rail supports remain');
assert.ok(Math.abs(support.train.position.y-11.14)<1e-6,'moving train follows the raised rail level');
for(const rail of rails){
  const b=new THREE.Box3().setFromObject(rail);
  assert.ok(Math.abs(b.max.y-11.20)<.001&&Math.abs(b.min.y-11.08)<.001,'actual rail surfaces rise with the deck');
}
const deckMesh=support.root.children.find(o=>o.material===supportSteel.viaductDeck&&Math.abs(o.position.y-10.61)<.001);
assert.ok(deckMesh,'full steel deck is raised with the masonry');
const deckBounds=new THREE.Box3().setFromObject(deckMesh);
assert.ok(Math.abs(deckBounds.min.y-10.15)<.001&&Math.abs(deckBounds.max.y-11.07)<.001,
  'deck underside meets the masonry and top sits under the rails');
for(const x of [-5,0,5])for(const y of [.35,1.8,3.9,6.3])assert.equal(
  new THREE.Raycaster(new THREE.Vector3(x,y,-15),new THREE.Vector3(0,0,1)).intersectObject(support.root,true).length,0,
  'complete support assembly leaves the playable aperture clear');
console.log('PASS: complete raised bridge support assembly; aligned masonry/deck/rails/train level and unobstructed playable aperture.');
const rollBayStart = html.indexOf('    var hasErker = streetCorner ||');
const rollBayEnd = html.indexOf('    // Balcony only where there is no Erker',rollBayStart);
const rollBay = new Function('d','w','s','streetCorner','styleUnit','dressBias','erkerGeo','crossingCornerBayGeo','STOREY_H','ERKER_H',
  'var styleSeed = 0;\n'+html.slice(rollBayStart,rollBayEnd));
const terraceRule=html.match(/    d\.terraceForm =[^;]+;/)[0];
const rollTerraceForm=new Function('d','s','styleUnit','var styleSeed=0;\n'+terraceRule);
const rollRoof=new Function('d','w','h','styleUnit','ordinaryRoofMats','roofAccentMats','mansardGeo','dormerGeo',
  'var styleSeed=0;\n'+sourceBetween('    d.roofBlock.visible = styleUnit(styleSeed, 11)', '    // Bake the final, rolled transforms'));
const roofMaterial=new THREE.MeshStandardMaterial();
const rollHeaderStart=html.indexOf('    var storeyPool =',html.indexOf('  function rollBuilding('));
const rollHeaderEnd=html.indexOf('    // Rotating hue palette',rollHeaderStart);
const rollHeader=new Function('streetCorner','heightBand',
  'var d={},styleSeed=0,TALL_STOREYS=[6],LOW_STOREYS=[3],BUILD_STOREYS=[4],STOREY_H=3.6;function styleUnit(){return 0;}\n'+
  html.slice(rollHeaderStart,rollHeaderEnd)+'\nreturn {storeys:s,family:d.facadeFamily};');
assert.equal(rollHeader(true,-1).storeys,5,'corner upgrades a short roll to five storeys');
assert.equal(rollHeader(true,1).storeys,6,'corner preserves taller existing rolls');
assert.equal(rollHeader(true,0).family,0,'corner selects Altbau instead of a Platte bay');
const crossingPositionLine=html.match(/        if \(streetCorner && hasCross\) centre = [^;]+;/)[0];
const crossingPosition=new Function('side','var streetCorner=true,hasCross=true,centre=0;\n'+crossingPositionLine+'\nreturn centre;');
const capWriterStart = html.indexOf('  function writeBuildingPartPools(');
const capWriterEnd = html.indexOf('    // roofBlock varies',capWriterStart);
const zeroCap = new THREE.Matrix4().makeScale(0,0,0);
const writeCap = new Function('buildingPartZeroMat','buildingPartScratchA','buildingPartScratchB',
  html.slice(capWriterStart,capWriterEnd)+'\n}\nreturn writeBuildingPartPools;')(zeroCap,new THREE.Matrix4(),new THREE.Matrix4());
const ROAD_EDGE = Number(html.match(/var ROAD_HALF = ([\d.]+)/)[1]);
const WALK_EDGE = Number(html.match(/var WALK_OUT = ([\d.]+)/)[1]);
const cornerSelector = html.slice(html.indexOf('        var streetCorner =',html.indexOf('  function rollChunk(')),html.indexOf('        // The crossing keeps a full 18 m opening'));
const selectCorner = new Function('hasCross','b2','referenceBeat','var hasStation=false,hasBridge=false,hasTunnel=false,bridgeEdgeChunk=false;'+cornerSelector+'return streetCorner;');
assert.equal(selectCorner(false,0),false,'ordinary kiosk frontages never receive a deep crossing overhang');
assert.equal(selectCorner(true,0),true);
assert.equal(selectCorner(true,1),false);
assert.equal(selectCorner(true,0,true),false,'reference crossings use the continuous prior-block facade, without a duplicate legacy approach corner');
let crossingRoadClearance = Infinity;
for (const side of [-1,1]) for (const width of [11,13.5,16]) {
  const block = new THREE.Group(); block.rotation.y = side<0 ? Math.PI/2 : -Math.PI/2;
  block.position.set(side*(WALK_EDGE+.1),0,0); block.updateMatrix();
  const d = block.userData = {side,facadeFamily:0,facadeCell:0,
    erker:new THREE.Mesh(bay),erkerCap:new THREE.Mesh(capGeometry)};
  let capMatrix;
  const views = {erkerCapView:{setMatrixAt:(_,matrix)=>capMatrix=matrix.clone()}};
  rollBay(d,width,5,true,()=>.5,0,bay,crossingBay,3.6,10.8);
  assert.equal(d.erker.geometry,crossingBay);
  d.erker.updateMatrix(); writeCap(views,block,0,true);
  const worldBay = new THREE.Box3().setFromBufferAttribute(d.erker.geometry.attributes.position)
    .applyMatrix4(new THREE.Matrix4().multiplyMatrices(block.matrix,d.erker.matrix));
  const worldCap = new THREE.Box3().setFromBufferAttribute(capGeometry.attributes.position).applyMatrix4(capMatrix);
  const distance = side<0 ? -worldCap.max.x : worldCap.min.x;
  assert.ok(distance>ROAD_EDGE+.59, 'corner cornice stays beyond asphalt on both road sides');
  assert.ok(worldCap.min.y<worldBay.max.y && worldCap.max.y>worldBay.max.y, 'cornice overlaps the bay top rather than floating');
  assert.ok(worldCap.min.z>=-width/2 && worldCap.max.z<=width/2, 'corner cornice stays within its building frontage');
  if(width===11) {
    block.position.set(side*(WALK_EDGE+.1),0,crossingPosition(side));block.updateMatrix();
    rollBay(d,width,5,true,()=>.5,0,bay,crossingBay,3.6,10.8);
    assert.equal(d.erker.geometry,crossingBay,'crossing roll selects the deeper shared bay');
    writeCap(views,block,0,true);
    assert.ok(Math.abs(block.position.z)>=9+width/2,'authored building core preserves the full crossing width');
    const crossingCap=new THREE.Box3().setFromBufferAttribute(capGeometry.attributes.position).applyMatrix4(capMatrix);
    const crossingDistance=(side<0?-crossingCap.max.x:crossingCap.min.x)-ROAD_EDGE;
    crossingRoadClearance=Math.min(crossingRoadClearance,crossingDistance);
    assert.ok(crossingDistance>.59,'deeper crossing cap still clears asphalt');
    assert.ok(crossingCap.max.z<=-9,'both approach corner projections stay outside the full 18m crossing');
    assert.ok(crossingCap.min.z>=block.position.z-width/2 && crossingCap.max.z<=block.position.z+width/2,
      'reversed bay bias remains inside the approach building footprint');
  }
  rollBay(d,width,5,false,()=>.5,0,bay,crossingBay,3.6,10.8);
  assert.equal(d.erker.geometry,bay,'ordinary reroll restores ordinary bay');
  assert.deepEqual(Array.from(d.erkerCap.scale.toArray()),[1,1,1],'ordinary reroll resets every cap scale axis');
  assert.equal(d.erkerCap.position.z,.95,'ordinary reroll restores the ordinary cap centre');
  writeCap(views,block,0,true);
  const ordinaryScale=new THREE.Vector3().setFromMatrixScale(capMatrix);
  assert.ok(ordinaryScale.distanceTo(new THREE.Vector3(1,1,1))<1e-6,'pooled ordinary cap has no stale corner scaling');
  rollBay(d,width,3,false,()=>.5,0,bay,crossingBay,3.6,10.8);writeCap(views,block,0,true);
  assert.ok(!d.erker.visible && !d.erkerCap.visible);
  assert.equal(capMatrix.determinant(),0,'hidden reroll collapses old pooled cap');
  rollBay(d,width,5,true,()=>.5,0,bay,crossingBay,3.6,10.8);writeCap(views,block,0,false);
  assert.equal(capMatrix.determinant(),0,'hidden whole building collapses its active corner cap');
  // Reuse that same rolled building fixture: a terrace cannot leave a bay
  // floating over its cut-back wall or leak its roof offset into an ordinary roll.
  for(const name of ['roofBlock','roofShell','roofDormers','chimneyA','chimneyB','aerial','roofFurnA','roofFurnB','gable'])d[name]=new THREE.Mesh();
  d.roofBits=new THREE.Group();d.facadeFamily=1;
  rollTerraceForm(d,5,()=>.5);
  assert.equal(d.terraceForm,true,'eligible modern form selects the terrace');
  rollBay(d,width,5,false,()=>.5,0,bay,crossingBay,3.6,10.8);
  assert.ok(!d.erker.visible && !d.erkerCap.visible,'terrace suppresses incompatible projecting bay');
  rollRoof(d,width,18,()=>.5,[roofMaterial],[roofMaterial],{[width]:plain},{[width]:plain});
  assert.equal(d.roofBits.position.z,-2.6,'pooled roof group follows the upper-floor setback');
  assert.equal(d.roofBlock.position.z,-6,'roof block sits on the recessed upper roof');
  assert.ok(!d.roofFurnA.visible && !d.roofFurnB.visible,'oversized furniture stays off the smaller roof');
  rollTerraceForm(d,4,()=>.5);
  assert.equal(d.terraceForm,false,'ordinary reroll clears the previous terrace form');
  rollRoof(d,width,14.4,()=>.5,[roofMaterial],[roofMaterial],{[width]:plain},{[width]:plain});
  assert.equal(d.roofBits.position.z,0,'ordinary reroll clears the pooled roof offset');
  assert.equal(d.roofBlock.position.z,-3.8,'ordinary reroll restores its roof-block placement');
  assert.ok(Math.abs(d.chimneyA.position.x+width*.23)<1e-5,'ordinary reroll restores the width-based chimney placement');
  assert.ok(d.roofFurnA.visible && d.roofFurnB.visible,'ordinary modern roof restores its furniture');
}
const coffeeContext=vm.createContext({});
// Tall street fixtures cannot grow through the newly occupied upper sidewalk.
const canopyRule=html.match(/      var clearsCornerBay =[^;]+;/)[0];
const clearsCorner=new Function('hasCross','bridgeEdgeChunk','tree',canopyRule+'return clearsCornerBay;');
for(const z of [-17,-11,9,16]) for(const radius of [1.6,2.05,2.4]) {
  const tree={position:{z},scale:{z:1.05},userData:{canopyRadius:radius}};
  assert.equal(clearsCorner(false,false,tree),true,'ordinary tree rolls stay available');
  assert.equal(clearsCorner(true,true,tree),true,'uncornered viaduct neighbors keep their trees');
  if(clearsCorner(true,false,tree)) assert.ok(z-radius*1.05>-8.8,'visible canopy clears the corner footprint');
}
const lampRule=html.match(/      if \(hasCross && !bridgeEdgeChunk && lamp.position.z < 0\)[^;]+;/)[0];
const lamp={position:{z:-11}};
new Function('hasCross','bridgeEdgeChunk','lamp',lampRule)(true,false,lamp);
assert.equal(lamp.position.z,-18.5);
assert.ok(lamp.position.z+1.25<-15.82,'approach lamp and flag precede the projected bay');
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','assets/models/berlin-coffee-sign-v1.mesh.js'),'utf8'),coffeeContext);
const coffeeData=coffeeContext.BERLIN_COFFEE_SIGN;
const coffeeStart=html.indexOf('  function makeCoffeeSignGeometry(data) {');
const coffeeEnd=html.indexOf('  var kioskCoffeeGeo',coffeeStart);
const buildCoffee=new Function('THREE',html.slice(coffeeStart,coffeeEnd)+'\nreturn makeCoffeeSignGeometry;')(THREE);
assert.equal(buildCoffee(null),null,'copied HTML retains its kiosk if the optional companion is absent');
const coffee=buildCoffee(coffeeData), cp=coffee.attributes.position, cn=coffee.attributes.normal;
assert.equal(coffee.attributes.color.count,cp.count);
assert.equal(cn.count,cp.count);
assert.ok(coffee.attributes.color.normalized,'Blender linear RGB bytes reach the shader normalized');
assert.ok(coffee.index.count/3<=2200,'shared rooftop sign stays inside its triangle budget');
for(let i=0;i<coffee.index.count;i++)assert.ok(coffee.index.getX(i)<cp.count);
for(let i=0;i<cp.count;i++){
  const p=new THREE.Vector3().fromBufferAttribute(cp,i), n=new THREE.Vector3().fromBufferAttribute(cn,i);
  assert.ok(Number.isFinite(p.length()));
  assert.ok(Math.abs(n.length()-1)<0.001,'Blender normals retain unit length');
}
const cb=coffee.boundingBox, cs=cb.getSize(new THREE.Vector3());
assert.ok(Math.abs(cb.min.y)<1e-4 && cs.y<2.5,'sign stands on the roof at its authored height');
assert.ok(cs.x<1.8 && cs.z<1.8,'sign stays inside the kiosk footprint');
const parkingStart=html.indexOf('  var propBoundsRootInv =');
const parkingEnd=html.indexOf('  // freezeChunkStaticMatrices',parkingStart);
const reserveFixture=new Function('THREE','ROAD_HALF',html.slice(parkingStart,parkingEnd)+'\nreturn reserveParkingFixture;')(THREE,7);
const fixture=new THREE.Group(), fixtureChunk=new THREE.Group();
fixture.add(new THREE.Mesh(new THREE.BoxGeometry(3.6,5.5,2.8)));
fixtureChunk.position.z=1000; fixtureChunk.add(fixture);
fixture.position.set(8.7,0.16,4); fixture.rotation.y=-Math.PI/2;
let blocked={'-1':[],'1':[]};reserveFixture(blocked,fixture);
assert.equal(blocked['-1'].length,0,'opposite curb remains available');
assert.equal(blocked['1'].length,1,'visible kiosk reserves its actual curb interval');
assert.ok(Math.abs(blocked['1'][0].z-4)<1e-5,'world/chunk offset does not move the parking reservation');
assert.ok(Math.abs(blocked['1'][0].halfLength-1.8)<1e-5,'rotated width determines reserved length');
fixture.position.x=20;blocked={'-1':[],'1':[]};reserveFixture(blocked,fixture);
assert.equal(blocked['1'].length,0,'fixtures behind the parking strip do not remove curb capacity');
fixture.position.x=8.7;fixture.visible=false;reserveFixture(blocked,fixture);
assert.equal(blocked['1'].length,0,'inactive pooled variants reserve no space');
fixture.visible=true;fixture.clear();delete fixture.userData.localVisualBounds;
reserveFixture(blocked,fixture,{minX:-0.45,maxX:0.45,minZ:-0.45,maxZ:0.45});
assert.ok(Math.abs(blocked['1'][0].halfLength-0.45)<1e-5,'detached instanced tree/lamp roots still reserve their solid bases');

// Oberbaum surface changes must leave the old arch silhouette, clearance and
// triangle budget intact. Test the actual cached factories and decoded courses.
const masonryConstants=html.match(/var OBERBAUM_MASONRY_ROWS = (\d+), OBERBAUM_MASONRY_COLUMNS = (\d+)/);
context.OBERBAUM_MASONRY_ROWS=Number(masonryConstants[1]);
context.OBERBAUM_MASONRY_COLUMNS=Number(masonryConstants[2]);
context.oberbaumBrickTex=new THREE.Texture();
context.oberbaumBrickTex.repeat.set(...html.match(/oberbaumBrickTex\.repeat\.set\(([^)]+)\)/)[1].split(',').map(Number));
vm.runInContext(sourceBetween('  function mapOberbaumMasonry(', '  var bridgeCableMat ='),context);
const bridgeCache=new Map();
const cachedBridge=(key,create)=>{
  if(!bridgeCache.has(key))bridgeCache.set(key,create());
  return bridgeCache.get(key);
};
for(const [name,stop,radius,tube,segments,courses] of [
  ['sideArchGeo','    [-1, 1].forEach(function (side) {',3.55,.34,28,12],
  ['portalArchGeo','    [-18.6, 18.6].forEach(function (portalZ, portalIndex) {',8.2,.38,32,24]
]) {
  const factory=new Function('cached','makeOberbaumArchGeo',
    sourceBetween(`    var ${name} = cached('oberbaum_`,stop)+`\nreturn ${name};`);
  const geo=factory(cachedBridge,context.makeOberbaumArchGeo), old=new THREE.TorusGeometry(radius,tube,8,segments,Math.PI);
  assert.equal(factory(cachedBridge,context.makeOberbaumArchGeo),geo,'bridge portals reuse shared arch geometry');
  for(const attribute of ['position','normal'])assert.deepEqual(Array.from(geo.attributes[attribute].array),Array.from(old.attributes[attribute].array),
    'masonry remapping preserves every arch position and normal');
  assert.deepEqual(Array.from(geo.index.array),Array.from(old.index.array),'arch silhouette/clearance retains the same topology');
  assert.equal(geo.groups.length,old.groups.length,'arch art creates no extra material groups');
  for(let i=0;i<geo.attributes.uv.count;i++) {
    const uv=geo.attributes.uv, sourceUV=old.attributes.uv;
    assert.ok(Math.abs(uv.getY(i)*context.oberbaumBrickTex.repeat.y*context.OBERBAUM_MASONRY_ROWS-sourceUV.getX(i)*courses)<1e-5,
      'broad masonry courses cross the arch span, rather than stripe the tube');
    assert.ok(Math.abs(uv.getX(i)*context.oberbaumBrickTex.repeat.x-sourceUV.getY(i))<1e-5,
      'one complete masonry wrap meets cleanly around the tube');
  }
}
const towerFactory=new Function('cached','roundedBoxGeo','mergeBoxes','mapOberbaumMasonry',
  sourceBetween("        var towerBrickGeo = cached('oberbaum_tower_brick'",'        var tower = new THREE.Mesh')+'\nreturn towerBrickGeo;');
const tower=towerFactory(cachedBridge,buildRounded,merge,context.mapOberbaumMasonry);
tower.computeBoundingBox();
const towerSize=tower.boundingBox.getSize(new THREE.Vector3());
assert.ok(Math.abs(towerSize.x-2.1)<1e-5 && Math.abs(towerSize.y-6.65)<1e-5 && Math.abs(towerSize.z-2)<1e-5,
  'tower masonry keeps its full authored placement and clearance bounds');
assert.ok(tower.userData.rigidMerged && tower.groups.length===0,'tower remains one batchable masonry geometry');
for(let i=0;i<tower.attributes.position.count;i++) {
  const n=tower.attributes.normal, uv=tower.attributes.uv, p=tower.attributes.position;
  assert.ok(Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i)),'finite tower masonry UVs');
  assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5,'tower retains unit normals');
  if(Math.abs(n.getY(i))<.5) assert.ok(Math.abs(uv.getY(i)*context.oberbaumBrickTex.repeat.y*context.OBERBAUM_MASONRY_ROWS-p.getY(i)/.42)<1e-5,
    'tower shaft and separate pilasters share the same 42cm masonry courses');
}
const bridgeRelief={brick:{},brickLight:{}};
new Function('relief','BRIDGE_MAT','oberbaumBrickTex',sourceBetween('  relief(BRIDGE_MAT.brick,', '  function mapOberbaumMasonry('))(
  material=>{material.normalMap=new THREE.Texture();material.roughnessMap=new THREE.Texture();material.normalScale=new THREE.Vector2(1,1);},
  bridgeRelief,context.oberbaumBrickTex);
for(const key of ['brick','brickLight'])for(const map of ['normalMap','roughnessMap'])assert.ok(
  bridgeRelief[key][map].repeat.equals(context.oberbaumBrickTex.repeat),'bridge surface maps align with the color courses');

// Riverbank skyline boxes become foreground returns through the crossing.
const riverFacade=new Function('cached','roundedBoxGeo','STOREY_H','FACADE_TILE_W','FACADE_STOREY_BANDS',
  sourceBetween('  function riverbankFacadeGeometry(', '  function makeSpreeBridgeSequence(')+
  '\nreturn riverbankFacadeGeometry;')(cachedBridge,buildRounded,3.6,7.2,3);
let riverVariants=0;
for(const bank of [-1,1])for(const skylineIndex of [1,3,5]) {
  const width=8+(skylineIndex%3)*2.2, height=4.2+((skylineIndex*7+(bank>0?2:0))%5)*1.35;
  const original=buildRounded(width,height,5.8,.16,.035), originalUV=Array.from(original.attributes.uv.array);
  const geo=riverFacade(width,height), p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;
  assert.equal(riverFacade(width,height),geo,'recycled riverbank blocks reuse their mapped geometry');
  assert.notEqual(geo,original,'shared rounded geometry keeps its other material users intact');
  for(const attribute of ['position','normal'])assert.deepEqual(Array.from(geo.attributes[attribute].array),Array.from(original.attributes[attribute].array),
    'riverbank facade retains the exact rounded silhouette and normals');
  assert.deepEqual(Array.from(original.attributes.uv.array),originalUV,'facade repair does not mutate the source cache');
  assert.deepEqual(Array.from(geo.groups,g=>[g.start,g.count,g.materialIndex]),Array.from(original.groups,g=>[g.start,g.count,g.materialIndex]),
    'facade adds no topology or material groups');
  const faces={px:[],nx:[],pz:[],nz:[]};
  for(let i=0;i<p.count;i++) {
    assert.ok(Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i)),'finite riverbank UVs');
    if(Math.abs(n.getY(i))>.5) {
      assert.ok(Math.abs(uv.getX(i)-.5)<1e-6 && Math.abs(uv.getY(i)-(1-.056/3))<1e-6,'roofs sample plain cornice, never window rows');
    } else {
      const floorHeight=height/Math.max(1,Math.round(height/3.6));
      assert.ok(Math.abs(uv.getY(i)*3-(p.getY(i)+height/2)/floorHeight)<1e-5,'whole painted floor bands fit the existing block height');
      const face=n.getX(i)>.99?'px':n.getX(i)<-.99?'nx':n.getZ(i)>.99?'pz':n.getZ(i)<-.99?'nz':null;
      if(face)faces[face].push({x:uv.getX(i),y:uv.getY(i)});
    }
  }
  for(const [face,points] of Object.entries(faces)) {
    assert.ok(points.length>2 && extent(points,'x')>.65 && extent(points,'y')>.30,
      `riverbank ${face} return maps a facade, not one edge pixel`);
  }
  riverVariants++;
}
const skylineAt=html.indexOf('      var skylineXs ='), skylineEnd=html.indexOf('\n    });\n\n    // Emit the batched steel',skylineAt);
assert.ok(skylineAt>0 && skylineEnd>skylineAt);
const riverIndustrial=new Function('THREE','roundedBoxGeo','roundSegments','mapOberbaumMasonry','mergeBoxes',
  sourceBetween('  var riverbankIndustrialCache =', '  function makeSpreeBridgeSequence(')+
  '\nreturn riverbankIndustrialGeometry;')(THREE,buildRounded,r=>Math.max(5,Math.min(16,Math.round(4+r*18))),context.mapOberbaumMasonry,merge);
let industrialVariants=0,industrialTriangles=0;
for(const bank of [-1,1])for(const skylineIndex of [0,2,4]) {
  const width=8+(skylineIndex%3)*2.2, height=4.2+((skylineIndex*7+(bank>0?2:0))%5)*1.35;
  const original=buildRounded(width,height,5.8,.16,.035), originalPositions=Array.from(original.attributes.position.array);
  const parts=riverIndustrial(width,height);
  assert.equal(riverIndustrial(width,height),parts,'industrial returns reuse their cached parts');
  const assembly=new THREE.Group(), materials={};
  for(const [name,geo] of Object.entries(parts)) {
    materials[name]=new THREE.MeshStandardMaterial();assembly.add(new THREE.Mesh(geo,materials[name]));
    assert.equal(geo.groups.length,0,'industrial detail stays one geometry per existing material');
    industrialTriangles+=geo.attributes.position.count/3;
    for(let i=0;i<geo.attributes.position.count;i++) {
      const n=geo.attributes.normal,uv=geo.attributes.uv;
      assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5,'industrial normals remain finite and unit length');
      assert.ok(Number.isFinite(uv.getX(i)) && Number.isFinite(uv.getY(i)),'finite industrial UVs');
    }
  }
  assembly.updateMatrixWorld(true);original.computeBoundingBox();
  const bounds=new THREE.Box3().setFromObject(assembly);
  for(const edge of ['min','max'])assert.ok(bounds[edge].distanceTo(original.boundingBox[edge])<1e-5,
    'industrial openings preserve the exact exterior and silhouette bounds');
  assert.equal(original.parameters.shapes.holes.length,0,'opening cuts never modify the shared rounded shape');
  assert.deepEqual(Array.from(original.attributes.position.array),originalPositions,'industrial repair preserves source-cache geometry');
  const columns=width<9?2:3,span=width*.78, bayX=-span/2+.5*span/columns;
  for(const side of [-1,1])for(const [x,y,expected] of [
    [bayX+.20,height*.73-height/2,'glass'],[.25,.2+Math.min(2.8,height*.47)/2-height/2,'glass'],
    [width*.44,0,'masonry']
  ]) {
    const ray=new THREE.Raycaster(new THREE.Vector3(x,y,side*10),new THREE.Vector3(0,0,-side));
    const hit=ray.intersectObject(assembly,true)[0];
    assert.ok(hit && hit.object.material===materials[expected],`${side<0?'approach':'river'} face exposes ${expected} at the authored location`);
    if(expected==='glass')assert.ok(Math.abs(hit.point.z)<2.85,'glass recesses behind the original outer cap');
  }
  industrialVariants++;
}
assert.ok(industrialTriangles/industrialVariants<1600,'openings retain a bounded low-thousands triangle budget per block');
const blueFacade=new THREE.MeshStandardMaterial(), riverBrick=new THREE.MeshStandardMaterial(), riverGlass=new THREE.MeshStandardMaterial(),riverStone=new THREE.MeshStandardMaterial();
const standaloneFacades=Array(12).fill(null);standaloneFacades[11]=blueFacade;
const riverRoot=new THREE.Group();
const addRiverBlocks=new Function('THREE','bank','root','riverbankFacadeGeometry','riverbankIndustrialGeometry','facadeMats','BRIDGE_MAT','MAT',html.slice(skylineAt,skylineEnd));
for(const bank of [-1,1])addRiverBlocks(THREE,bank,riverRoot,riverFacade,riverIndustrial,standaloneFacades,
  {brick:riverBrick,stone:riverStone},{glassDark:riverGlass});
assert.equal(riverRoot.children.filter(m=>m.material===blueFacade).length,6,'six concrete returns share one ordinary facade material');
assert.equal(riverRoot.children.filter(m=>m.material===riverBrick).length,6,'brick neighbours retain their original material');
assert.equal(riverRoot.children.filter(m=>m.material===riverGlass).length,6,'six brick blocks share the existing blue glass material');
assert.equal(riverRoot.children.filter(m=>m.material===riverStone).length,6,'six brick blocks share the existing stone frame material');
for(const mesh of riverRoot.children.filter(m=>m.material===blueFacade)) {
  mesh.geometry.computeBoundingBox();
  const bounds=mesh.geometry.boundingBox.clone().translate(mesh.position);
  assert.ok(bounds.max.x<=-19.8 || bounds.min.x>=19.8,'riverbank returns remain outside crossing and play lanes');
  assert.ok(Math.abs(bounds.min.y)<1e-4,'riverbank mass retains ground contact');
  assert.ok(Math.abs(Math.abs(mesh.position.z)-29.5)<1e-6,'riverbank retains its original bank offset');
}
console.log(`PASS: ${riverVariants} riverbank facade variants; exact rounded positions/normals, cache ownership, four mapped returns, plain roofs, one facade material and unchanged brick neighbours/clearance.`);
console.log(`PASS: ${industrialVariants} industrial riverbank variants; exact exterior bounds, cached source ownership, recessed glazing rays through both cap faces, ${Math.round(industrialTriangles/industrialVariants)} triangles per block and existing material identities.`);

// Exercise the actual station-train factory and sibling merger. The cabin
// openings must expose glazing from both sides and both outer cab ends.
const trainCache=new Map(),cachedTrain=(key,build)=>{
  if(!trainCache.has(key))trainCache.set(key,build());return trainCache.get(key);
};
const trainCylinder=new Function('THREE','q','cached',sourceBetween('  function cylGeo(', '  function icoGeo(')+'return cylGeo;')(
  THREE,v=>Math.round(v*100)/100,cachedTrain);
const trainMergedPart=new Function('THREE','mergeBoxes',sourceBetween('  function mergedPart(', '  // Draw-call consolidation for rigid prop')+'return mergedPart;')(THREE,merge);
const trainCompact=new Function('THREE','mergeBoxes',sourceBetween('  var staticMergeGeometryCache =', '  // Merges building parts that carry different materials')+
  'return compactStaticPropGroup;')(THREE,merge);
const trainMaterials=Object.fromEntries(['metalDark','glassDark','glassLit','chrome','tyre','bulb'].map(name=>[name,new THREE.MeshStandardMaterial()]));
const stationMaterials=Object.fromEntries(['sbahnRed','sbahnCream','steel'].map(name=>[name,new THREE.MeshStandardMaterial()]));
const destinationMaterial=new THREE.MeshBasicMaterial({map:new THREE.Texture()});
const stationFactory=new Function('THREE','cached','roundedBoxGeo','cylGeo','mergeBoxes','mergedPart','compactStaticPropGroup','STATION_MAT','MAT','destRollMat',
  sourceBetween('  function makeStationTrain() {','  function makeStationSequence() {')+'return makeStationTrain;')(
  THREE,cachedTrain,buildRounded,trainCylinder,merge,trainMergedPart,trainCompact,stationMaterials,trainMaterials,destinationMaterial);
const stationTrain=stationFactory();stationTrain.updateMatrixWorld(true);
let trainDraws=0,trainTriangles=0;
stationTrain.traverse(mesh=>{
  if(!mesh.isMesh)return;trainDraws++;const geo=mesh.geometry;
  trainTriangles+=(geo.index?geo.index.count:geo.attributes.position.count)/3;
  assert.notEqual(mesh.material,trainMaterials.glassLit,'opaque emissive cream window rectangles are absent');
  for(let i=0;i<geo.attributes.position.count;i++) {
    const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;
    assert.ok([p.getX(i),p.getY(i),p.getZ(i),uv.getX(i),uv.getY(i)].every(Number.isFinite),'finite station-train buffers');
    assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5,'station-train normals are unit length');
  }
});
assert.equal(trainDraws,9,'two-car train uses nine material submissions, below the former ten');
const stationBounds=new THREE.Box3().setFromObject(stationTrain);
assert.ok(stationBounds.min.x>=-1.25501 && stationBounds.max.x<=1.36751,'both glazed sides remain inside the old lateral envelope');
assert.ok(stationBounds.min.y>=.00999 && stationBounds.max.y<=3.43501,'train retains rail and pantograph clearance');
assert.ok(stationBounds.min.z>=-8.11001 && stationBounds.max.z<=8.11001,'outer cab stays behind the original end lamps');
assert.deepEqual(Array.from(stationTrain.children.filter(o=>o.isGroup),o=>o.position.z),[-3.89,3.89],'married-pair spacing is unchanged');
let trainSurfaceRays=0;
function trainRay(origin,direction,material,description) {
  const ray=new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction));
  const hit=ray.intersectObject(stationTrain,true)[0];
  assert.ok(hit && hit.object.material===material,description);trainSurfaceRays++;return hit;
}
for(const carCenter of [-3.89,3.89])for(const side of [-1,1]) {
  for(const z of [-1.8,-.6,.6,1.8]) {
    const hit=trainRay([side*3,1.70,carCenter+z],[-side,0,0],trainMaterials.glassDark,'side window is visible through an actual body opening');
    assert.ok(Math.abs(hit.point.x)<1.20,'window glass is recessed behind the painted shoulder');
    for(const oblique of [-1,1]) {
      const origin=new THREE.Vector3(side*6,1.70,carCenter+z+oblique*3);
      const direction=hit.point.clone().sub(origin).normalize();
      trainRay(origin.toArray(),direction.toArray(),trainMaterials.glassDark,'side glazing survives both oblique approach directions');
    }
  }
  for(const z of [-2.83,2.83])trainRay([side*3,1.55,carCenter+z],[-side,0,0],trainMaterials.glassDark,'door glazing remains visible inside the jambs');
  trainRay([side*3,1.70,carCenter],[-side,0,0],stationMaterials.sbahnRed,'a real red pillar separates window bays');
  trainRay([side*3,.15,carCenter+1.92],[-side,0,0],trainMaterials.tyre,'rail wheel remains visible below the body skirt');
}
for(const end of [-1,1]) {
  const hit=trainRay([.40,1.51,end*12],[0,0,-end],trainMaterials.glassDark,'outer cab exposes its recessed windscreen');
  assert.ok(Math.abs(hit.point.z)<8.01,'windscreen stays behind the open cab cap');
  trainRay([.30,2.10,end*12],[0,0,-end],destinationMaterial,'destination roller keeps its original visible location');
  trainRay([.64,1.00,end*12],[0,0,-end],trainMaterials.bulb,'outer cab lamps keep their original visible location');
}
const shellBefore=Array.from(trainCache.get('station_open_coach_v1|-1').attributes.position.array);
stationFactory();assert.deepEqual(Array.from(trainCache.get('station_open_coach_v1|-1').attributes.position.array),shellBefore,'rebuilding train instances preserves shared shell geometry');
console.log(`PASS: actual two-car station train; ${trainSurfaceRays} glazing/door/cab/marker/wheel rays, original layout and clearance, nine material batches and ${trainTriangles} triangles.`);

// Execute the authored station roof/utility blocks through their real merger.
// Fixtures must be mounted beneath the wings, not cross the roadway or pipes;
// relocated fixed-pool light markers must correspond to visible luminaires.
const utilityMats=Object.fromEntries(['steel','wing','light'].map(name=>[name,new THREE.MeshStandardMaterial()]));
utilityMats.canopy=new THREE.MeshStandardMaterial({transparent:true,opacity:.4,side:THREE.DoubleSide});
const utilityPipes={pipeGalv:new THREE.MeshStandardMaterial(),pipeCopper:new THREE.MeshStandardMaterial()};
const utilityContext=vm.createContext({THREE,root:new THREE.Group(),stationSteelSpecs:[],STATION_MAT:utilityMats,TUNNEL_MAT:utilityPipes,
  cached:cachedTrain,roundedBoxGeo:buildRounded,cylGeo:trainCylinder,mergedPart:trainMergedPart,
  outlineTransparentDetails:[],outlineTransparentWasVisible:[],seqLightMarkers:[]});
vm.runInContext(sourceBetween('  function roundedBox(w,','  // ------------------------------------------------- generated prop swaps'),utilityContext);
vm.runInContext(sourceBetween('  function registerSeqLightMarker(', '  // Runs once per frame (see frame(),'),utilityContext);
vm.runInContext(sourceBetween("    var stationWingPlaneGeo = cached(",'    var stationSafetyStripGeo =')+
  sourceBetween('    // Dark side wings and a translucent central roof visibly change the light.','    // Paired arch portals create')+
  sourceBetween('    var stationPipeGeo =','    // Portals retain independent approach culling.'),utilityContext);
const utilities=utilityContext.root;utilities.updateMatrixWorld(true);
const utilityBounds=mesh=>new THREE.Box3().setFromObject(mesh);
const utilityFixtures=utilities.children.filter(mesh=>mesh.material===utilityMats.light);
const utilityWings=utilities.children.filter(mesh=>mesh.material===utilityMats.wing);
const utilityPipeMeshes=utilities.children.filter(mesh=>Object.values(utilityPipes).includes(mesh.material));
const ribs=[],housings=[];
for(const spec of utilityContext.stationSteelSpecs) {
  spec.geo.computeBoundingBox();
  const bounds=spec.geo.boundingBox.clone().translate(new THREE.Vector3(spec.x,spec.y,spec.z));
  (bounds.getSize(new THREE.Vector3()).x>20?ribs:housings).push(bounds);
}
assert.equal(ribs.length,4,'all four original structural cross-ribs remain');
assert.deepEqual(ribs.map(bounds=>bounds.getCenter(new THREE.Vector3()).z),[-12,-4,4,12]);
for(const rib of ribs) {
  const size=rib.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.x-29.5)<1e-5&&Math.abs(size.y-.14)<1e-5&&Math.abs(size.z-.14)<1e-5,
    'structural ribs retain their original geometry and span');
}
assert.equal(utilityFixtures.length,8,'each cross-rib carries one short fixture over each platform');
assert.equal(housings.length,8,'each fixture has a real steel mounting housing');
assert.equal(utilityPipeMeshes.length,2,'both existing service-pipe materials and runs remain');
for(const fixture of utilityFixtures) {
  const bounds=utilityBounds(fixture),size=bounds.getSize(new THREE.Vector3());
  const wing=utilityWings.find(mesh=>Math.sign(mesh.position.x)===Math.sign(fixture.position.x)),roof=utilityBounds(wing);
  assert.ok(bounds.min.x>roof.min.x&&bounds.max.x<roof.max.x&&bounds.min.z>roof.min.z&&bounds.max.z<roof.max.z&&bounds.max.y<roof.min.y,
    'entire fixture fits beneath its real platform wing');
  assert.ok(Math.abs(size.z-3.4)<1e-5&&size.x<.2,'short fixtures run along the platform instead of across the roadway');
  assert.ok(Math.min(Math.abs(bounds.min.x),Math.abs(bounds.max.x))>7.2,'fixture stays completely outside the road');
  const housing=housings.find(box=>box.intersectsBox(bounds));
  assert.ok(housing&&ribs.some(rib=>rib.intersectsBox(housing)),'lamp connects through its housing to a structural rib');
  assert.ok(utilityPipeMeshes.every(pipe=>!bounds.intersectsBox(utilityBounds(pipe))&&!housing.intersectsBox(utilityBounds(pipe))),
    'neither lens nor mounting housing intersects a service pipe');
}
for(const pipe of utilityPipeMeshes) {
  const bounds=utilityBounds(pipe),roof=utilityBounds(utilityWings.find(mesh=>Math.sign(mesh.position.x)===Math.sign(pipe.position.x)));
  assert.ok(bounds.min.x>roof.min.x&&bounds.max.x<roof.max.x&&bounds.min.z>roof.min.z&&bounds.max.z<roof.max.z&&bounds.max.y<roof.min.y,
    'complete pipe run fits under the wing without extending into the roadway');
}
assert.equal(utilityContext.seqLightMarkers.length,2,'relocation does not increase fixed-pool marker pressure');
for(const entry of utilityContext.seqLightMarkers) {
  assert.equal(entry.color,0xffc77f);assert.equal(entry.intensity,1.85);assert.equal(entry.distance,19);assert.equal(entry.decay,2);
  const ray=new THREE.Raycaster(entry.marker.position.clone(),new THREE.Vector3(0,1,0));
  const hit=ray.intersectObject(utilities,true)[0];
  assert.ok(hit&&hit.object.material===utilityMats.light&&hit.distance<.3,'each warm source is directly beneath a visible lamp');
}
trainCompact(utilities,{skipTransparent:true});
const utilityMeshes=utilities.children.filter(mesh=>mesh.isMesh);
assert.equal(utilityMeshes.length,6,'utility relocation retains the original six material submissions including roof glazing');
assert.equal(new Set(utilityMeshes.map(mesh=>mesh.material)).size,6,'added housings and paired lights reuse existing material batches');
console.log('PASS: station utilities; eight mounted platform fixtures clear both pipes, four original ribs, two colocated warm sources and unchanged six material batches.');
// Run the real six gate variants and article painter. Native canvas metrics
// are optional: set NODE_PATH to the bundled node_modules to measure the
// installed Windows font as well as the dependency-free layout assertions.
let nativeCanvas=null;
try { nativeCanvas=require('@napi-rs/canvas'); } catch(error) {
  if(error.code!=='MODULE_NOT_FOUND')throw error;
}
const gateFontPath=path.join(process.env.WINDIR || 'C:/Windows','Fonts','seguibl.ttf');
const hasGateFont=!!(nativeCanvas && fs.existsSync(gateFontPath) &&
  nativeCanvas.GlobalFonts.registerFromPath(gateFontPath,'Segoe UI Black'));
const gateCanvasRecords=[];
function gateCanvasTexture(width,height,paint) {
  const canvas=hasGateFont?nativeCanvas.createCanvas(width,height):{width,height};
  const target=hasGateFont?canvas.getContext('2d'):{font:'',textAlign:'start',textBaseline:'alphabetic',lineWidth:1};
  const draws=[];
  const painter=new Proxy(target,{
    set(object,key,value){Reflect.set(object,key,value,object);return true;},
    get(object,key){
      if(key==='fillText'||key==='strokeText')return (...args)=>{
        draws.push({method:key,args,font:object.font,align:object.textAlign,baseline:object.textBaseline,lineWidth:object.lineWidth});
        if(hasGateFont)object[key](...args);
      };
      if(key==='createLinearGradient'&&!hasGateFont)return ()=>({addColorStop(){}});
      const value=Reflect.get(object,key,object);
      return typeof value==='function'?value.bind(object):value===undefined?()=>{}:value;
    }
  });
  paint(painter,width,height);
  const texture=new THREE.CanvasTexture(canvas);texture.userData={draws};
  gateCanvasRecords.push({texture,canvas,draws});return texture;
}
const gateRoadHalf=Number(html.match(/var ROAD_HALF = ([\d.]+)/)[1]),gateLaneW=Number(html.match(/var LANE_W = ([\d.]+)/)[1]);
const gateContext=vm.createContext({THREE,console,ROAD_HALF:gateRoadHalf,LANE_W:gateLaneW,LANES:[gateLaneW,0,-gateLaneW],
  mat:(color,options)=>new THREE.MeshStandardMaterial({color,...options}),roundedBoxGeo:buildRounded,mergeBoxes:merge,
  MAT:{rail:new THREE.MeshStandardMaterial()},STREET_MAT:{viaductBrickPier:new THREE.MeshStandardMaterial()},
  scene:new THREE.Scene(),canvasTexture:gateCanvasTexture,
  gateHaloTex:new THREE.Texture(),gatePadTex:new THREE.Texture(),gateChevronTex:new THREE.Texture()});
vm.runInContext(sourceBetween('  var ARTICLE_HEX =','  // Rasterize and upload every gate verdict'),gateContext);
vm.runInContext(sourceBetween('  function roundedBox(w,','  // ------------------------------------------------- generated prop swaps'),gateContext);
vm.runInContext(sourceBetween('  function freezeObjectTree(','  function freezeChunkStaticMatrices('),gateContext);
vm.runInContext(sourceBetween('  var gateBeamMat =','  for (var gi = 0; gi < GATE_POOL; gi++)'),gateContext);
const gate=gateContext.makeGate();gate.visible=true;
const gateSigns=Array.from(gate.userData.portals,p=>p.userData.sign);
assert.deepEqual(Array.from(gate.userData.portals,p=>p.position.x),[gateLaneW,0,-gateLaneW],'article portals keep their lane centers');
assert.ok(gateSigns.every(sign=>sign.geometry===gateContext.gateSignFaceGeo),'all articles share the canonical sign-face geometry');
const signUV=gateContext.gateSignFaceGeo.attributes.uv;
for(let i=0;i<signUV.count;i++)assert.ok([0,1].includes(signUV.getX(i))&&[0,1].includes(signUV.getY(i)),'sign faces retain complete non-mirrored atlas UVs');
const passage=new THREE.Box3(new THREE.Vector3(-gateLaneW*1.5,0,-1),new THREE.Vector3(gateLaneW*1.5,3.5,1));
const towerPassage=new THREE.Box3(new THREE.Vector3(-gateContext.GATE_LINTEL_GAP/2+.0002,5.58,-1),
  new THREE.Vector3(gateContext.GATE_LINTEL_GAP/2-.0002,100,1));
for(const portal of gate.userData.portals) {
  const sign=portal.userData.sign,backing=portal.children.find(mesh=>mesh.material===portal.userData.signPlateMat);
  assert.ok(backing,'every answer retains its physical enamel backing');
  const faceBounds=new THREE.Box3().setFromObject(sign),backingBounds=new THREE.Box3().setFromObject(backing);
  assert.ok(faceBounds.min.x>backingBounds.min.x&&faceBounds.max.x<backingBounds.max.x&&
    faceBounds.min.y>backingBounds.min.y&&faceBounds.max.y<backingBounds.max.y,'complete sign face fits inside its physical backing');
  assert.ok(backingBounds.min.z-faceBounds.max.z>0&&backingBounds.min.z-faceBounds.max.z<.02,
    'sign face sits just ahead of the backing without z-fighting');
  for(const mesh of portal.children) {
    const bounds=new THREE.Box3().setFromObject(mesh);
    if(bounds.min.y<3.5)assert.ok(bounds.max.y<.1,'only horizontal ground cues remain below the suspended answers');
  }
}
const ga=new THREE.Vector3(),gb=new THREE.Vector3(),gc=new THREE.Vector3(),gt=new THREE.Triangle(ga,gb,gc);
let gateSignRays=0,gateVariants=0;
for(const kiez of [false,true]) {
gateContext.KIEZ_DISTRICT_ENABLED=kiez;
for(const key of gateContext.FRAME_VARIANT_KEYS) {
  const variant=gateContext.getFrameVariant(key);
  assert.equal(gateContext.getFrameVariant(key),variant,'hardware variants reuse their two cached geometries');
  for(const role of ['beam','accent']) {
    const mesh=gate.userData[role==='beam'?'frameBeamMesh':'frameAccentMesh'];
    mesh.geometry=variant[role];mesh.material=variant[role+'Mat'];
    assert.ok(!Array.isArray(mesh.material)&&mesh.geometry.groups.length===0,'hardware remains exactly two single-material submissions');
  }
  gate.updateMatrixWorld(true);
  const hardware=[gate.userData.frameBeamMesh,gate.userData.frameAccentMesh],points=[];
  const footprint=new THREE.Box3();
  for(const mesh of hardware) {
    const geo=mesh.geometry,p=geo.attributes.position,n=geo.attributes.normal;
    geo.computeBoundingBox();footprint.union(geo.boundingBox);
    for(let i=0;i<p.count;i++) {
      points.push([p.getX(i),p.getY(i),p.getZ(i)]);
      assert.ok(Number.isFinite(n.getX(i))&&Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5,'gate normals remain finite and unit length');
    }
    for(let i=0;i<p.count;i+=3) {
      ga.fromBufferAttribute(p,i);gb.fromBufferAttribute(p,i+1);gc.fromBufferAttribute(p,i+2);
      assert.ok(!passage.intersectsTriangle(gt),`${key} leaves the complete three-lane width clear below 3.5m`);
      assert.ok(!towerPassage.intersectsTriangle(gt),`${key} has no triangle crossing the centered tower sightline`);
    }
  }
  assert.ok(footprint.min.x>=-(gateRoadHalf+.711)&&footprint.max.x<=gateRoadHalf+.711,'hardware stays inside the original outer-foot envelope');
  assert.ok(footprint.min.z>=-.471&&footprint.max.z<=.561,`${key} header and canopy keep their authored shallow footprint`);
  const pointKey=p=>p.map(v=>Math.round(v*10000)).join(','),cloud=new Set(points.map(pointKey));
  for(const p of points) {
    const mirror=[-p[0],p[1],p[2]],base=mirror.map(v=>Math.round(v*10000));
    let found=cloud.has(base.join(','));
    for(let dx=-1;!found&&dx<=1;dx++)for(let dy=-1;!found&&dy<=1;dy++)for(let dz=-1;!found&&dz<=1;dz++)
      found=cloud.has([base[0]+dx,base[1]+dy,base[2]+dz].join(','));
    assert.ok(found,`${key} hardware is mirror-symmetric within 0.15mm`);
    if(p[1]>5.58)assert.ok(Math.abs(p[0])>=gateContext.GATE_LINTEL_GAP/2-.0002,`${key} retains the actual centered tower opening above its canopy`);
  }
  for(const cameraX of gateContext.LANES)for(const distance of [14,30,60])for(const sign of gateSigns)
  for(const u of [-.95,0,.95])for(const v of [-.32,0,.32]) {
    const target=new THREE.Vector3(u,v,0).applyMatrix4(sign.matrixWorld);
    const origin=new THREE.Vector3(cameraX,4.4,-distance),direction=target.clone().sub(origin).normalize();
    const ray=new THREE.Raycaster(origin,direction),hit=ray.intersectObject(gate,true).find(h=>!h.object.material.transparent);
    assert.ok(hit&&hit.object===sign,`${key} sign face is unoccluded from every lane approach`);gateSignRays++;
  }
  gateVariants++;
}
}
const kiezFrame=gateContext.getFrameVariant('classic');
for(const key of gateContext.FRAME_VARIANT_KEYS)
  assert.equal(gateContext.getFrameVariant(key),kiezFrame,'the continuous Kiez shares one cached historic frame across the existing shuffle bag');
assert.equal(kiezFrame.accentMat.emissive.getHex(),0,'the daylight brass collars do not emit artificial yellow light');
// Sign backing and painted border both contain the entire foreground label.
gateContext.gateSignFaceGeo.computeBoundingBox();
const signSize=gateContext.gateSignFaceGeo.boundingBox.getSize(new THREE.Vector3());
for(const article of ['der','die','das'])for(const state of ['idle','right','wrong']) {
  const texture=gateContext.articleTexture(article,state);
  assert.equal(gateContext.articleTexture(article,state),texture,'gate verdict painting is cached');
  const record=gateCanvasRecords.find(r=>r.texture===texture),draws=record.draws;
  assert.ok(draws.length>=3&&draws.every(d=>d.args[0]===article),'each verdict preserves the complete article');
  for(const draw of draws) {
    const fontSize=Number(draw.font.match(/([\d.]+)px/)[1]);
    assert.ok(Math.abs(fontSize*signSize.y/record.canvas.height-(1.18*.55))<.007,'actual painted font size retains the prior physical letter scale');
    assert.ok(draw.align==='center'&&draw.baseline==='middle','lettering stays centered in the smaller face');
    if(hasGateFont) {
      const context2d=record.canvas.getContext('2d');context2d.font=draw.font;context2d.textAlign=draw.align;context2d.textBaseline=draw.baseline;
      const metric=context2d.measureText(article),[label,x,y]=draw.args,pad=draw.method==='strokeText'?draw.lineWidth/2:0;
      assert.ok(x-metric.actualBoundingBoxLeft-pad>33&&x+metric.actualBoundingBoxRight+pad<record.canvas.width-33,
        `${article} glyph width and outline fit inside the painted inner rim`);
      assert.ok(y-metric.actualBoundingBoxAscent-pad>33&&y+metric.actualBoundingBoxDescent+pad<record.canvas.height-33,
        `${article} glyph height, outline and drop shadow fit inside the painted inner rim`);
      const currentHeight=(metric.actualBoundingBoxAscent+metric.actualBoundingBoxDescent)*signSize.y/record.canvas.height;
      context2d.font=draw.font.replace(/([\d.]+)px/,Math.round(record.canvas.height*.55)+'px');
      const oldMetric=context2d.measureText(label),oldHeight=(oldMetric.actualBoundingBoxAscent+oldMetric.actualBoundingBoxDescent)*1.18/record.canvas.height;
      assert.ok(Math.abs(currentHeight/oldHeight-1)<.02,'measured Segoe glyph height stays within 2% of the former world height');
    }
  }
}
console.log(`PASS: ${gateVariants} actual gate variants; cached two-draw hardware (${(kiezFrame.beam.attributes.position.count+kiezFrame.accent.attributes.position.count)/3} Kiez triangles), full lane passage, mirrored tower notch, ${gateSignRays} sign-face rays, cached article layout and ${hasGateFont?'native Segoe glyph metrics/border fit':'font-size contract (native metrics unavailable)'}.`);

// Run the actual opaque gate pool through Three's public render lifecycle.
// Source meshes retain the original state/visibility API while submissions
// move to the shared plate and article/verdict texture buckets.
gateContext.ARTICLES=['der','die','das'];gateContext.PROFILE_RENDER=false;
gateContext.window={location:{search:''}};
gateContext.gates=[gate,...Array.from({length:5},()=>gateContext.makeGate())];
vm.runInContext(sourceBetween('  function setPortalState(', '  function spawnGate('),gateContext);
const gateBeforeCalls=[],beforeGateBatch=(...args)=>gateBeforeCalls.push(args);
gateContext.scene.onBeforeRender=beforeGateBatch;
const gateBatchSource=sourceBetween('  // Opaque gate faces share geometry', '  function setPortalState(');
vm.runInContext(gateBatchSource,gateContext);
const gateBatches=gateContext.gateSignBatches,gatePoolCamera=new THREE.PerspectiveCamera(60,16/9,.1,350);
gatePoolCamera.position.set(0,4.5,-16);gatePoolCamera.lookAt(0,4.5,100);
const gatePoolRenderer={},gatePoolTarget={},poolFrustum=new THREE.Frustum(),poolProjection=new THREE.Matrix4();
function presentGatePools() {
  gateContext.scene.updateMatrixWorld();gatePoolCamera.updateMatrixWorld();
  gateContext.scene.onBeforeRender(gatePoolRenderer,gateContext.scene,gatePoolCamera,gatePoolTarget);
  const forwarded=gateBeforeCalls.at(-1);
  assert.deepEqual(forwarded,[gatePoolRenderer,gateContext.scene,gatePoolCamera,gatePoolTarget],
    'pool preserves the existing public scene callback and every argument');
  poolFrustum.setFromProjectionMatrix(poolProjection.multiplyMatrices(gatePoolCamera.projectionMatrix,gatePoolCamera.matrixWorldInverse));
  const expected=new Map(gateBatches.pools.map(pool=>[pool,[]]));
  for(const entry of gateBatches.entries)for(const [source,pool] of [
    [entry.plate,gateBatches.pools[0]],[entry.sign,gateBatches.byTexture.get(entry.sign.material.map)]
  ]) {
    let visible=source.layers.test(gatePoolCamera.layers);
    for(let ancestor=source;ancestor&&ancestor!==gateContext.scene;ancestor=ancestor.parent)visible&&=ancestor.visible;
    if(visible&&(!source.frustumCulled||poolFrustum.intersectsObject(source)))expected.get(pool).push(source);
  }
  let originalDraws=0,pooledDraws=0;
  const inverseParent=gateContext.scene.matrixWorld.clone().invert();
  for(const [pool,sources] of expected) {
    const mesh=pool.mesh;originalDraws+=sources.length;pooledDraws+=Number(mesh.visible);
    assert.equal(mesh.count,sources.length,'packed count matches the original independently culled source meshes');
    assert.equal(mesh.visible,sources.length>0,'empty texture buckets never submit');
    for(let i=0;i<sources.length;i++) {
      const source=sources[i],expectedMatrix=inverseParent.clone().multiply(source.matrixWorld);
      for(let j=0;j<16;j++)assert.equal(mesh.instanceMatrix.array[i*16+j],Math.fround(expectedMatrix.elements[j]),
        'instance contains the current exact source world transform in its parent space');
      assert.deepEqual(Array.from(mesh.instanceColor.array.slice(i*3,i*3+3)),Array.from(source.material.color.toArray(),Math.fround),
        'linear instance tint reproduces the original material uniform');
      assert.equal(mesh.geometry,source.geometry,'plate bevels and canonical sign UVs use the exact original geometry');
      for(const key of ['toneMapped','transparent','opacity','depthWrite','depthTest','side','blending','fog'])
        assert.equal(mesh.material[key],source.material[key],`gate ${key} remains unchanged`);
      for(const key of ['castShadow','receiveShadow','renderOrder'])assert.equal(mesh[key],source[key]);
      assert.equal(mesh.layers.mask,source.layers.mask);assert.equal(source.material.visible,false);
      assert.equal(mesh.material.visible,true);
      if(pool!==gateBatches.pools[0])assert.equal(mesh.material.map,source.material.map,'article/state map identity is exact');
    }
  }
  return {originalDraws,pooledDraws};
}
for(let gi=0;gi<gateContext.gates.length;gi++) {
  const g=gateContext.gates[gi];g.position.z=[18,45,80,115,150,190][gi];g.updateMatrix();g.visible=gi<3;
  g.userData.z=g.position.z;g.userData.active=gi<3;g.userData.resolved=false;g.userData.spawnZ=0;
  for(let pi=0;pi<3;pi++)gateContext.setPortalState(g.userData.portals[pi],gateContext.ARTICLES[pi],'idle');
}
assert.equal(gateBatches.entries.length,18);assert.equal(gateBatches.pools.length,10);
assert.equal(gateBatches.byTexture.size,9,'all prewarmed article/verdict textures have a bucket');
assert.deepEqual(presentGatePools(),{originalDraws:18,pooledDraws:4},'three complete idle gates save exactly fourteen opaque draws');
const gateBufferVersions=()=>Array.from(gateBatches.pools,p=>[p.mesh.instanceMatrix.version,p.mesh.instanceColor.version]);
const settledGateVersions=gateBufferVersions();presentGatePools();
assert.deepEqual(gateBufferVersions(),settledGateVersions,'unchanged matrices and colors do not upload again');
gateContext.activeGate=gateContext.gates[0];gateContext.player={z:0};gateContext.t=2.75;
gateContext.clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
vm.runInContext(sourceBetween('    // Gate approach glow + the HUD countdown rule.', '    // Pretzels spin and bob.'),gateContext);
presentGatePools();
assert.equal(gateBufferVersions()[0][0],settledGateVersions[0][0],'sign bobbing never reuploads stationary plates');
assert.ok(gateBatches.pools.slice(1).some((pool,i)=>pool.mesh.instanceMatrix.version>settledGateVersions[i+1][0]),
  'the actual approach animation updates its instanced faces on this render');
assert.ok(gateBatches.entries.every(entry=>entry.sign.visible&&entry.plate.visible),
  'the original mesh visibility remains available to state/animation callers');
for(let gi=0;gi<3;gi++)for(let pi=0;pi<3;pi++)gateContext.setPortalState(
  gateContext.gates[gi].userData.portals[pi],gateContext.ARTICLES[pi],['idle','right','wrong'][gi]);
assert.deepEqual(presentGatePools(),{originalDraws:18,pooledDraws:10},'all nine verdict maps retain exact colors and still save eight draws');
const movingGate=gateContext.gates[0],movingPortal=movingGate.userData.portals[0];
movingGate.rotation.set(.02,.11,-.025);movingGate.scale.set(1.03,.98,1.04);movingGate.updateMatrix();
movingPortal.rotation.y=-.08;movingPortal.updateMatrix();
gateContext.scene.position.set(.4,-.2,.7);gateContext.scene.rotation.y=.015;gateContext.scene.updateMatrix();
presentGatePools(); // root, portal, source and pool-parent matrices are all represented
movingPortal.visible=false;presentGatePools();movingPortal.visible=true;
movingPortal.userData.sign.visible=false;presentGatePools();movingPortal.userData.sign.visible=true;
// Photo orbit and viewport changes happen without another simulation step.
gatePoolCamera.lookAt(0,4.5,-100);
assert.deepEqual(presentGatePools(),{originalDraws:0,pooledDraws:0},'Photo camera alone can cull every opaque gate instance');
gatePoolCamera.lookAt(0,4.5,100);assert.ok(presentGatePools().pooledDraws>0,'Photo orbit restores the current gate faces');
gatePoolCamera.aspect=.45;gatePoolCamera.position.z=16;gatePoolCamera.updateProjectionMatrix();presentGatePools();
gatePoolCamera.aspect=16/9;gatePoolCamera.position.z=-16;gatePoolCamera.updateProjectionMatrix();presentGatePools();
vm.runInContext(sourceBetween('  function resolveGates() {','  function collectPretzels() {'),gateContext);
gateContext.player.z=42;gateContext.nearCullZ=20;gateContext.PLAY_RENDER_FAR=220;
for(const g of gateContext.gates)g.userData.resolved=true;
gateContext.resolveGates();presentGatePools();
assert.equal(gateContext.gates[0].visible,false,'resolved gates retire before logical recycling');
for(const g of gateContext.gates){g.visible=false;g.userData.active=false;}
assert.deepEqual(presentGatePools(),{originalDraws:0,pooledDraws:0},'reset leaves no stale opaque gate draws');

// The actual elevated chase camera must never fly through a passed gate.
// Walk the shipped camera and gate resolver across the checkpoint; isolated
// sign-visibility rays from a stationary approach camera missed this failure.
gateContext.scene.position.set(0,0,0);gateContext.scene.rotation.set(0,0,0);gateContext.scene.updateMatrix();
const passingGate=gateContext.gates[0];passingGate.position.set(0,0,0);passingGate.rotation.set(0,0,0);
passingGate.scale.set(1,1,1);passingGate.updateMatrix();passingGate.userData.z=0;
for(const portal of passingGate.userData.portals){portal.rotation.set(0,0,0);portal.updateMatrix();}
vm.runInContext(sourceBetween('  function laneOf(x) {','  function resolveGates() {'),gateContext);
gateContext.laneWrapAge=Infinity;
gateContext.LANE_WRAP_TIME=Number(html.match(/var LANE_WRAP_TIME = ([\d.]+)/)[1]);
vm.runInContext(html.match(/  function laneForArticle\(\) \{[\s\S]*?\n  \}/)[0],gateContext);
let passageAnswers=0;gateContext.answerArticle=()=>passageAnswers++;
const gateCameraContext=vm.createContext({THREE,camera:gatePoolCamera,chunks:[],LANES:gateContext.LANES,
  laneWrapAge:Infinity,laneWrapDuration:0.76,laneWrapDir:0,visualLaneVelocity:0,lerp:THREE.MathUtils.lerp,
  visualPlayer:{x:0,y:0,z:0},overdriveIntensity:0,cameraShakeClock:0,bridgeReveal:0,routeCameraBend:0,routeCameraCrest:0,
  fxPrevPlayerX:0,fxLaneVel:0,slideVisual:0,targetLane:1,grounded:true,runPhase:0,airVisual:0,landingPulse:0,
  camPos:new THREE.Vector3(),camLook:new THREE.Vector3(),camShake:0,fxKickAmp:0,fxKickX:0,fxKickY:0,fxKickZ:0,
  leanRoll:0,fxBank:0,fxKickRoll:0,answerKick:0,fxFovPunch:0,fovVisual:62,
  clamp:gateContext.clamp,damp:(rate,dt)=>1-Math.exp(-rate*dt),playerSurfaceY:()=>0,routePathBank:()=>0});
gateCameraContext.sampleRoutePoint=(x,y,z)=>{gateCameraContext.routePointX=x;gateCameraContext.routePointY=y;gateCameraContext.routePointZ=z;};
// Camera framing now uses the shared lane-wrap easing function. Execute its
// shipping definition in this isolated camera fixture instead of a test stub.
vm.runInContext(html.match(/  function phaseEase\(v\) \{[\s\S]*?\n  \}/)[0],gateCameraContext);
vm.runInContext(sourceBetween('  function baseCameraFov(aspect) {','  var camera = new THREE.PerspectiveCamera('),gateCameraContext);
vm.runInContext(sourceBetween('  function updateCamera(dt) {','  function updateEnvironmentMood(od) {'),gateCameraContext);
let gatePassageViews=0,maxPassingSignHeight=0,minPassingCameraDepth=Infinity;
for(const aspect of [16/9,9/16])for(const speed of [13,26,54])
for(const pose of [{y:0,slide:0},{y:2.45,slide:0},{y:4.25,slide:0},{y:0,slide:1}])for(let laneIndex=0;laneIndex<3;laneIndex++) {
  const c=gateCameraContext,playerX=gateContext.LANES[laneIndex];
  c.speedOver=()=>speed===13?0:speed-26;c.targetLane=laneIndex;c.visualPlayer.x=playerX;c.visualPlayer.y=pose.y;
  c.slideVisual=pose.slide;c.airVisual=Number(pose.y>0);c.grounded=pose.y===0;c.fxPrevPlayerX=playerX;c.fxLaneVel=0;c.fxBank=0;
  gatePoolCamera.aspect=aspect;gatePoolCamera.fov=c.baseCameraFov(aspect);c.fovVisual=gatePoolCamera.fov;gatePoolCamera.updateProjectionMatrix();
  c.camPos.set(0,4,-speed-6);c.camLook.set(0,1,-speed+10);
  for(let step=-60;step<0;step++){c.visualPlayer.z=(step+.5)*speed/60;c.updateCamera(1/60);}
  gatePoolCamera.updateMatrixWorld();
  passingGate.userData.active=true;passingGate.userData.resolved=false;passingGate.visible=true;
  gateContext.player={x:playerX,z:c.visualPlayer.z};const answersBefore=passageAnswers;
  gateContext.resolveGates();presentGatePools();
  assert.ok(passingGate.visible&&!passingGate.userData.resolved&&passageAnswers===answersBefore,
    'unresolved checkpoint remains visible through the final pre-crossing step');
  for(const portal of passingGate.userData.portals) {
    const sign=portal.userData.sign,points=sign.geometry.attributes.position;let low=Infinity,high=-Infinity;
    for(let i=0;i<points.count;i++) {
      const point=new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(sign.matrixWorld);
      const depth=-point.clone().applyMatrix4(gatePoolCamera.matrixWorldInverse).z;minPassingCameraDepth=Math.min(minPassingCameraDepth,depth);
      assert.ok(depth>gatePoolCamera.near+2,'last visible plate remains safely beyond the moving near plane');
      point.project(gatePoolCamera);low=Math.min(low,point.y);high=Math.max(high,point.y);
    }
    maxPassingSignHeight=Math.max(maxPassingSignHeight,(high-low)/2);
    assert.ok((high-low)/2<.30,'last visible answer stays a bounded plate rather than filling the viewport');
  }
  gateContext.player.z=c.visualPlayer.z+speed/60;gateContext.resolveGates();
  assert.ok(passingGate.userData.resolved&&passingGate.userData.active&&!passingGate.visible,
    'actual crossing retires the whole gate, including baked housing, while keeping logical ownership');
  assert.equal(passageAnswers,answersBefore+1,'visual retirement preserves one verdict at the physical crossing');
  assert.deepEqual(presentGatePools(),{originalDraws:0,pooledDraws:0},'retirement removes every original and pooled face on that render');
  for(const passed of [1,3,5,8]){gateContext.player.z=passed;gateContext.resolveGates();assert.equal(passingGate.visible,false);}
  assert.equal(passageAnswers,answersBefore+1,'approaching the lens never resolves a passed gate again');
  gatePassageViews++;
}
gateContext.player.z=30;gateContext.resolveGates();assert.equal(passingGate.userData.active,true,'visual retirement does not advance recycling');
gateContext.player.z=30.01;gateContext.resolveGates();assert.equal(passingGate.userData.active,false,'the original 30 m logical recycle boundary remains');
console.log(`PASS: ${gatePassageViews} actual chase-camera gate crossings; last-visible sign ≤${(maxPassingSignHeight*100).toFixed(1)}% viewport height, ≥${minPassingCameraDepth.toFixed(2)}m lens depth, exact verdict and complete pooled retirement.`);
vm.runInContext(sourceBetween('  function spawnGate(z) {','  // ========================================================== obstacles'),gateContext);
gateContext.CHUNK_LEN=40;gateContext.nextGateVariant=()=> 'classic';
const recycledGate=gateContext.spawnGate(110);presentGatePools();
assert.equal(recycledGate,gateContext.gates[0]);
for(const portal of recycledGate.userData.portals)assert.equal(portal.userData.signMat.map,
  gateContext.articleTexture(portal.userData.article,'idle'),'recycled gates replace previous verdict maps before drawing');
const callbackBeforeFallback=gateContext.scene.onBeforeRender,childrenBeforeFallback=gateContext.scene.children.length;
const fallbackGate=gateContext.makeGate();gateContext.gates=[fallbackGate];
gateContext.PROFILE_RENDER=true;gateContext.window.location.search='?profile=1&gatesigns=0';
vm.runInContext(gateBatchSource,gateContext);
assert.equal(gateContext.gateSignBatches,null,'profiling fallback creates no pools');
assert.equal(gateContext.scene.onBeforeRender,callbackBeforeFallback,'fallback does not wrap the render callback');
assert.equal(gateContext.scene.children.length,childrenBeforeFallback+1,'fallback adds only its original gate');
assert.ok(fallbackGate.userData.portals.every(p=>p.userData.signMat.visible&&p.userData.signPlateMat.visible),
  'fallback retains all original material submissions');
console.log('PASS: actual opaque gate pools; 18→4 idle draws, all nine verdict maps, exact geometry/parent transforms/tints, current bobbing, unchanged-frame uploads, independent visibility, Photo orbit/resize culling, crossing retirement/reset/recycle and profile fallback.');

// Compare every actual ordinary building variant against its retained original
// three-group path. The trim optimization may change submissions, never bytes
// describing the building, shop UVs, or the original distant material treatment.
const coreContext=vm.createContext({THREE,console,window:{location:{search:''}},
  mergeBoxes:merge,FACADE_STOREY_BANDS:context.FACADE_STOREY_BANDS,
  renderScale:1,PROFILE_RENDER:false});
for(const [start,end] of [
  ['  function scaleUV(', '  // ----------------------------------------------------- smooth PBR lighting'],
  ['  var STOREY_H =', '  // Which atlas cell'],
  ['  function mergeCoreParts(', '  // The whole point'],
  ['  var trimGeo =', '  // Altbau reveals share'],
  ['  function makeMansardGeo(', '  // Projecting fabric awning'],
  ['  var massCrownGeo =', '  // A real Staffelgeschoss:'],
  ['  var CEL_BANDS =', '  // ---------------------------------------------- shared flat-prop material'],
  ['  function mat(color, opts)', '  var MAT =']
]) vm.runInContext(sourceBetween(start,end),coreContext);
coreContext.MAT={facadeStone:coreContext.mat(0xd3c6aa,{roughness:.88})};
coreContext.facadeTex=Array.from({length:16},()=>new THREE.Texture());
const facadeSource=sourceBetween('  var facadeMats =', '  // Emission is driven');
vm.runInContext(facadeSource,coreContext);
coreContext.shopSheets=Array.from({length:16},()=>({map:new THREE.Texture(),emissive:new THREE.Texture()}));
const shopSource=sourceBetween('  var shopMats =', '  var ordinaryRoofMats =');
vm.runInContext(shopSource,coreContext);
let coreVariants=0, coreDrawsSaved=0, shopDrawsSaved=0;
for(const width of coreContext.BUILD_WIDTHS) for(const storeys of coreContext.BUILD_STOREYS)
for(let crown=0;crown<coreContext.MASS_CROWN_VARIANTS;crown++)
for(const trim of [false,true]) for(const shop of [false,true]) {
  coreContext.MERGE_CORE_TRIM=false;coreContext.MERGE_CORE_SHOP=false;
  const original=coreContext.getBuildingCoreGeo(width,storeys,crown,trim,shop);
  coreContext.MERGE_CORE_TRIM=true;
  const trimOnly=coreContext.getBuildingCoreGeo(width,storeys,crown,trim,shop);
  coreContext.MERGE_CORE_SHOP=true;
  const combined=coreContext.getBuildingCoreGeo(width,storeys,crown,trim,shop);
  assert.equal(coreContext.getBuildingCoreGeo(width,storeys,crown,trim,shop),combined,'combined variants are cached');
  for(const name of ['position','normal','uv','color']) {
    const a=original.attributes[name],b=combined.attributes[name];
    assert.equal(a.itemSize,b.itemSize);
    assert.deepEqual(Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength),
      Buffer.from(b.array.buffer,b.array.byteOffset,b.array.byteLength),`${name} is byte-identical in both submission paths`);
  }
  assert.deepEqual(combined.boundingSphere,original.boundingSphere,'culling bounds retain the authored silhouette');
  assert.deepEqual(Array.from(combined.groups,g=>g.materialIndex),[0],'complete core submits once');
  assert.equal(original.groups.length-combined.groups.length,Number(trim)+Number(shop),'one submission per former trim/shop group is removed');
  assert.equal(trimOnly.groups.length-combined.groups.length,Number(shop),'shop adds exactly one saved draw over the previous trim path');
  assert.equal(combined.groups.reduce((sum,g)=>sum+g.count,0),combined.attributes.position.count,'all vertices remain submitted once');
  if(trim || shop) {
    const role=combined.attributes.aCoreTrim;
    assert.equal(role.itemSize,1); assert.equal(role.normalized,false);
    assert.equal(role.array.BYTES_PER_ELEMENT,1,'role costs one byte per core vertex');
    for(let i=0;i<role.count;i++) assert.equal(role.getX(i),original.groups.find(g=>i>=g.start && i<g.start+g.count).materialIndex,
      'every facade/trim/shop vertex retains its original material role and primitive order');
  } else assert.equal(combined.attributes.aCoreTrim,undefined,'ordinary untrimmed cores allocate no new attribute');
  coreVariants++;coreDrawsSaved+=original.groups.length-combined.groups.length;
  shopDrawsSaved+=trimOnly.groups.length-combined.groups.length;
}
vm.runInContext(sourceBetween('  function getTerraceBuildingCoreGeo(', '  function styleUnit('),coreContext);
for(const width of coreContext.BUILD_WIDTHS) for(const storeys of coreContext.BUILD_STOREYS.filter(s=>s>=5))
for(const shop of [false,true]) {
  coreContext.MERGE_CORE_SHOP=false;
  const original=coreContext.getTerraceBuildingCoreGeo(width,storeys,shop);
  coreContext.MERGE_CORE_SHOP=true;
  const combined=coreContext.getTerraceBuildingCoreGeo(width,storeys,shop);
  assert.equal(coreContext.getTerraceBuildingCoreGeo(width,storeys,shop),combined,'terrace role variants reuse their cache');
  for(const name of ['position','normal','uv','color'])assert.deepEqual(
    Buffer.from(combined.attributes[name].array.buffer),Buffer.from(original.attributes[name].array.buffer),
    `terrace ${name} remains byte-identical when its shop is combined`);
  assert.deepEqual(combined.boundingSphere,original.boundingSphere);
  assert.deepEqual(Array.from(combined.groups,g=>g.materialIndex),[0]);
  assert.equal(original.groups.length-combined.groups.length,Number(shop));
  if(shop)for(let i=0;i<combined.attributes.aCoreTrim.count;i++)assert.equal(
    combined.attributes.aCoreTrim.getX(i),i<original.groups[0].count?0:2,'terrace shop stays in its exact original vertex range');
  shopDrawsSaved+=original.groups.length-combined.groups.length;
}
const combinedMaterial=coreContext.facadeTrimCoreMats[0],facadeMaterial=coreContext.facadeCoreMats[0];
function coreShader(material) {
  const shader={uniforms:{},vertexShader:THREE.ShaderLib.standard.vertexShader,
    fragmentShader:THREE.ShaderLib.standard.fragmentShader};
  material.onBeforeCompile(shader);return shader;
}
const combinedShader=coreShader(combinedMaterial),originalShader=coreShader(facadeMaterial);
assert.equal(combinedMaterial.map,facadeMaterial.map,'facade uses the same texture and its live repeat/offset/filter settings');
assert.equal(combinedMaterial.type,'MeshStandardMaterial','directional and indirect PBR shading remains active');
for(const name of ['roughness','metalness','envMapIntensity','vertexColors','dithering','side','depthWrite','toneMapped'])
  assert.equal(combinedMaterial[name],facadeMaterial[name],`facade ${name} is unchanged`);
assert.equal((combinedShader.fragmentShader.match(/float celQuantize\(/g)||[]).length,1,'combined material chains one cel patch');
assert.equal(combinedShader.uniforms.uCelBands,originalShader.uniforms.uCelBands,'live cel controls stay shared');
assert.equal(combinedShader.uniforms.uCelSoft,originalShader.uniforms.uCelSoft);
assert.notEqual(combinedMaterial.customProgramCacheKey(),facadeMaterial.customProgramCacheKey(),'trim shader cannot alias the distant shader');
// Execute the exact injected selectors, with a texture sample standing in for
// map_fragment. Every PBR input must equal its former separate material input.
const mapSelector=combinedShader.fragmentShader.match(/if \( vCoreTrim < 0\.5 \) \{\n#include <map_fragment>\n\} else \{\n  diffuseColor\.rgb = uCoreTrimColor;\n\}/)[0];
const surfaceSelectors=['Roughness','Metalness'].map(name=>combinedShader.fragmentShader.match(
  new RegExp(`if \\( vCoreTrim > 0\\.5 \\) ${name.toLowerCase()}Factor = uCoreTrim${name};`))[0]).join('\n');
const selectInputs=new Function('vCoreTrim','diffuseColor','texel','uCoreTrimColor','roughnessFactor','metalnessFactor',
  'uCoreTrimRoughness','uCoreTrimMetalness',
  mapSelector.replace('#include <map_fragment>','diffuseColor.rgb = diffuseColor.rgb.map((v,i)=>v*texel[i]);')+'\n'+
  surfaceSelectors+'\nreturn {color:diffuseColor.rgb,roughness:roughnessFactor,metalness:metalnessFactor};');
const envSelector='( vCoreTrim > 0.5 ? uCoreTrimEnv : envMapIntensity )';
const envSource=THREE.ShaderChunk.envmap_physical_pars_fragment.replace(/\benvMapIntensity\b/g,envSelector);
assert.ok(combinedShader.fragmentShader.includes(envSource),'both irradiance and radiance retain the exact original PMREM code');
assert.equal(envSource.split(envSelector).join('envMapIntensity'),THREE.ShaderChunk.envmap_physical_pars_fragment);
const selectEnv=new Function('vCoreTrim','uCoreTrimEnv','envMapIntensity',`return ${envSelector};`);
const stone=coreContext.MAT.facadeStone;
for(const role of [0,1]) for(const pixel of [[0,0,0],[.02,.38,.9],[1,1,1]]) {
  const actual=selectInputs(role,{rgb:facadeMaterial.color.toArray()},pixel,stone.color.toArray(),
    facadeMaterial.roughness,facadeMaterial.metalness,combinedShader.uniforms.uCoreTrimRoughness.value,
    combinedShader.uniforms.uCoreTrimMetalness.value);
  assert.deepEqual(actual.color,role?stone.color.toArray():facadeMaterial.color.toArray().map((v,i)=>v*pixel[i]));
  assert.equal(actual.roughness,(role?stone:facadeMaterial).roughness);
  assert.equal(actual.metalness,(role?stone:facadeMaterial).metalness);
  assert.equal(selectEnv(role,combinedShader.uniforms.uCoreTrimEnv.value,facadeMaterial.envMapIntensity),
    (role?stone:facadeMaterial).envMapIntensity);
}
stone.color=new THREE.Color(0xc4a475);stone.roughness=.63;stone.metalness=.11;stone.envMapIntensity=.29;
assert.equal(combinedShader.uniforms.uCoreTrimColor.value,stone.color,'trim palette replacement is read live');
assert.equal(combinedShader.uniforms.uCoreTrimRoughness.value,.63);
assert.equal(combinedShader.uniforms.uCoreTrimMetalness.value,.11);
assert.equal(combinedShader.uniforms.uCoreTrimEnv.value,.29,'trim uniform getters preserve live surface controls');
// The shop's exact source material remains the authority for its texture,
// ordinary (non-cel) lighting and independently animated window/sign emission.
const shopMaterial=coreContext.shopMats[0],shopCombined=coreContext.getFacadeShopCoreMaterial(0,0);
const shopShader=coreShader(shopCombined),shopUniforms=shopShader.uniforms;
assert.equal(coreContext.getFacadeShopCoreMaterial(0,0),shopCombined,'recycled buildings share cached facade/shop combinations');
assert.notEqual(coreContext.getFacadeShopCoreMaterial(0,1),shopCombined,'different shop artwork retains its own sampler uniforms');
assert.equal(coreContext.getFacadeShopCoreMaterial(0,1).customProgramCacheKey(),shopCombined.customProgramCacheKey(),
  'different artwork shares one shader program');
assert.notEqual(shopCombined.customProgramCacheKey(),combinedMaterial.customProgramCacheKey(),'shop and trim-only shaders never alias');
for(const name of ['map','vertexColors','dithering','side','depthWrite','toneMapped'])assert.equal(shopCombined[name],facadeMaterial[name]);
assert.equal(shopCombined.opacity,shopMaterial.opacity,'the opaque source materials agree on alpha');
assert.equal(shopUniforms.uCoreShopMap.value,shopMaterial.map);
assert.equal(shopUniforms.uCoreShopEmissiveMap.value,shopMaterial.emissiveMap);
assert.equal(shopUniforms.uCelBands,originalShader.uniforms.uCelBands);
assert.equal(shopUniforms.uCelSoft,originalShader.uniforms.uCelSoft);
assert.equal(coreShader(shopMaterial).fragmentShader,THREE.ShaderLib.standard.fragmentShader,'shop source has always used plain Standard lighting');
const celArithmetic='float celNL = clamp( dot( geometry.normal, directLight.direction ), 0.0, 1.0 );\n'+
  '\tdirectLight.color *= celQuantize( celNL, uCelBands, uCelSoft ) / max( celNL, 1e-4 );';
const shopCelGuard='if ( vCoreTrim < 1.5 ) {\n\t'+celArithmetic+'\n\t}';
const directCount=(THREE.ShaderChunk.lights_fragment_begin.match(/RE_Direct\( directLight/g)||[]).length;
assert.equal(shopShader.fragmentShader.split(shopCelGuard).length-1,directCount,
  'every point/spot/directional slot bypasses cel quantization on shop triangles');
assert.ok(shopShader.fragmentShader.split(shopCelGuard).join(celArithmetic).includes(coreContext.celLightsFragmentBegin()),
  'apart from the role guard, direct lighting preserves the complete cel/zero-light/shadow chunk');
const celSelect=new Function('vCoreTrim','geometry','directLight','uCelBands','uCelSoft','celQuantize',
  'clamp','dot','max',shopCelGuard.replace('float celNL','let celNL')+';return directLight.color;');
for(const role of [0,1,2])for(const cosine of [0,.12,.49,.88,1]) {
  const quantize=nl=>nl*.82+Math.floor(nl*2)*.09;
  const actual=celSelect(role,{normal:[0,1,0]},{direction:[0,cosine,0],color:.73},3,.1,quantize,
    (x,a,b)=>Math.max(a,Math.min(b,x)),(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),Math.max);
  assert.equal(actual,role===2?.73:.73*(quantize(cosine)/Math.max(cosine,1e-4)),
    'shop receives the original unmodified direct light; facade and trim retain their previous cel response');
}
const shopMapSelector=shopShader.fragmentShader.slice(shopShader.fragmentShader.indexOf('if ( vCoreTrim > 1.5 ) {\n'),
  shopShader.fragmentShader.indexOf('#include <color_fragment>')).trim();
assert.ok(shopMapSelector.includes('texture2D( uCoreShopMap, vCoreShopMapUv )'),'shop samples its own map/UV varying');
const shopMapJS=shopMapSelector
  .replace('diffuseColor = vec4( uCoreShopColor, opacity ) * texture2D( uCoreShopMap, vCoreShopMapUv );',
    'diffuseColor.rgb = uCoreShopColor.map((v,i)=>v*shopTexel[i]);')
  .replace('#include <map_fragment>','diffuseColor.rgb = diffuseColor.rgb.map((v,i)=>v*facadeTexel[i]);');
const shopSurfaces=['Roughness','Metalness'].map(name=>shopShader.fragmentShader.match(new RegExp(
  `if \\( vCoreTrim > 1\\.5 \\) ${name.toLowerCase()}Factor = uCoreShop${name};\\n`+
  `else if \\( vCoreTrim > 0\\.5 \\) ${name.toLowerCase()}Factor = uCoreTrim${name};`))[0]).join('\n');
const selectShopInputs=new Function('vCoreTrim','diffuseColor','facadeTexel','shopTexel','uCoreTrimColor','uCoreShopColor',
  'roughnessFactor','metalnessFactor','uCoreTrimRoughness','uCoreTrimMetalness','uCoreShopRoughness','uCoreShopMetalness',
  shopMapJS+'\n'+shopSurfaces+'\nreturn {color:diffuseColor.rgb,roughness:roughnessFactor,metalness:metalnessFactor};');
const shopEnvSelector='( vCoreTrim > 1.5 ? uCoreShopEnv : ( vCoreTrim > 0.5 ? uCoreTrimEnv : envMapIntensity ) )';
assert.ok(shopShader.fragmentShader.includes(THREE.ShaderChunk.envmap_physical_pars_fragment.replace(/\benvMapIntensity\b/g,shopEnvSelector)),
  'shop retains the exact Standard PMREM code and selects its original intensity');
const selectShopEnv=new Function('vCoreTrim','uCoreTrimEnv','uCoreShopEnv','envMapIntensity',`return ${shopEnvSelector};`);
for(const role of [0,1,2])for(const pixel of [[0,0,0],[.02,.38,.9],[1,1,1]]) {
  const facadePixel=pixel.slice().reverse(),sourceMaterial=[facadeMaterial,stone,shopMaterial][role];
  const actual=selectShopInputs(role,{rgb:facadeMaterial.color.toArray()},facadePixel,pixel,
    stone.color.toArray(),shopMaterial.color.toArray(),facadeMaterial.roughness,facadeMaterial.metalness,
    stone.roughness,stone.metalness,shopMaterial.roughness,shopMaterial.metalness);
  assert.deepEqual(actual.color,sourceMaterial.color.toArray().map((v,i)=>v*(role===1?1:(role===2?pixel:facadePixel)[i])));
  assert.equal(actual.roughness,sourceMaterial.roughness);assert.equal(actual.metalness,sourceMaterial.metalness);
  assert.equal(selectShopEnv(role,stone.envMapIntensity,shopMaterial.envMapIntensity,facadeMaterial.envMapIntensity),sourceMaterial.envMapIntensity);
}
const emissionSelector=shopShader.fragmentShader.match(/if \( vCoreTrim > 1\.5 \) totalEmissiveRadiance = uCoreShopEmission \*\n  texture2D\( uCoreShopEmissiveMap, vCoreShopEmissiveUv \)\.rgb;/)[0];
const selectEmission=new Function('vCoreTrim','totalEmissiveRadiance','uCoreShopEmission','mask',emissionSelector.replace(
  'uCoreShopEmission *\n  texture2D( uCoreShopEmissiveMap, vCoreShopEmissiveUv ).rgb',
  'uCoreShopEmission.map((v,i)=>v*mask[i])')+'\nreturn totalEmissiveRadiance;');
const emissionStorage=shopUniforms.uCoreShopEmission.value;
for(const intensity of [0,.34,1.2])for(const mask of [[0,0,0],[.1,.45,.8],[1,1,1]]) {
  shopMaterial.emissiveIntensity=intensity;
  const emission=shopUniforms.uCoreShopEmission.value;
  assert.equal(emission,emissionStorage,'live mood emission reuses one color without per-frame allocation');
  for(const role of [0,1,2])assert.deepEqual(selectEmission(role,[0,0,0],emission.toArray(),mask),
    role===2?shopMaterial.emissive.toArray().map((v,i)=>v*intensity*mask[i]):[0,0,0],
    'black masks stay unlit while window/sign masks receive the exact former mood emission');
}
for(const [textureKey,uniformKey,transformKey,uvName] of [
  ['map','uCoreShopMap','uCoreShopMapTransform','vCoreShopMapUv'],
  ['emissiveMap','uCoreShopEmissiveMap','uCoreShopEmissiveTransform','vCoreShopEmissiveUv']
]) {
  const texture=shopMaterial[textureKey];texture.repeat.set(1.7,.8);texture.offset.set(.13,-.07);
  texture.center.set(.4,.6);texture.rotation=.37;texture.colorSpace=THREE.SRGBColorSpace;
  const expectedMatrix=new THREE.Matrix3().setUvTransform(.13,-.07,1.7,.8,.37,.4,.6);
  assert.equal(shopUniforms[uniformKey].value,texture,'source texture and sRGB/filter/wrapping settings remain shared');
  assert.ok(shopUniforms[transformKey].value.equals(expectedMatrix),'live offset/repeat/rotation applies without an original shop draw');
  assert.ok(shopShader.vertexShader.includes(`${uvName} = ( ${transformKey} * vec3( uv, 1.0 ) ).xy;`));
  texture.matrixAutoUpdate=false;texture.matrix.setUvTransform(.22,.13,.9,1.4,-.18,0,0);
  const authoredMatrix=texture.matrix.clone();assert.ok(shopUniforms[transformKey].value.equals(authoredMatrix),'manual UV matrices stay intact');
  shopMaterial[textureKey]=new THREE.Texture();
  assert.equal(shopUniforms[uniformKey].value,shopMaterial[textureKey],'texture replacement remains live');
  assert.equal(shopUniforms[transformKey].value,shopMaterial[textureKey].matrix);
}
shopMaterial.color=new THREE.Color(0xb0d2c8);shopMaterial.emissive=new THREE.Color(0xe5d1a3);
shopMaterial.roughness=.61;shopMaterial.metalness=.12;shopMaterial.envMapIntensity=.31;
assert.equal(shopUniforms.uCoreShopColor.value,shopMaterial.color);
assert.ok(shopUniforms.uCoreShopEmission.value.equals(shopMaterial.emissive.clone().multiplyScalar(shopMaterial.emissiveIntensity)));
for(const [key,name] of [['Roughness','roughness'],['Metalness','metalness'],['Env','envMapIntensity']])
  assert.equal(shopUniforms['uCoreShop'+key].value,shopMaterial[name],'shop material controls stay live');
assert.ok(html.includes('shopMats[smi].emissiveIntensity = shopIntensity;'),'existing route mood continues to drive the source shop materials');
// Material selection is independent of the far LOD: the original unpatched
// vertex-coloured facade still paints the complete far geometry at 149 metres.
vm.runInContext(sourceBetween('  function applyBuildingSurfaceMaterials(', '  function rollBuilding('),coreContext);
for(const family of [0,1]) for(const far of [false,true]) for(const shopOn of [false,true]) {
  const d={facadeFamily:family,fallbackFacadeIndex:0,fallbackShopIndex:0,coreFar:far,shopOn,
    core:{},coreFullMaterials:[null,stone,null],erker:{},balconyPanel:{},gable:{},facadeProjection:{}};
  coreContext.applyBuildingSurfaceMaterials(d);
  assert.equal(d.coreFullMaterials[0],shopOn?coreContext.getFacadeShopCoreMaterial(0,0):family===0?combinedMaterial:facadeMaterial);
  assert.equal(d.coreFullMaterials[1],stone);assert.equal(d.coreFullMaterials[2],coreContext.shopMats[0]);
  assert.equal(d.coreFarMaterial,facadeMaterial);
  assert.equal(d.core.material,far?facadeMaterial:d.coreFullMaterials);
}
assert.equal(Number(html.match(/var CORE_LOD_FAR = (\d+)/)[1]),149,'actual established haze transition remains at 149 m');
for(const [scale,profile,search,enabled,shopEnabled] of [[1,true,'?profile=1&coretrim=0',false,false],
  [1,true,'?profile=1&coreshop=0',true,false],[1,true,'?profile=1',true,true],
  [1,false,'?coretrim=0&coreshop=0',true,true],[.75,false,'',false,false]]) {
  coreContext.renderScale=scale;coreContext.PROFILE_RENDER=profile;coreContext.window.location.search=search;
  vm.runInContext(facadeSource,coreContext);
  assert.equal(coreContext.MERGE_CORE_TRIM,enabled,'only profiling opt-out or the existing Basic fallback disables batching');
  assert.equal(coreContext.MERGE_CORE_SHOP,shopEnabled,'shop comparison flag retains the prior trim-only path');
  if(!enabled)assert.equal(coreContext.facadeTrimCoreMats,coreContext.facadeCoreMats,'fallback uses original material identities');
  assert.equal(coreContext.facadeCoreMats[0].type,scale<.99?'MeshBasicMaterial':'MeshStandardMaterial');
}
console.log(`PASS: ${coreVariants} ordinary and 24 terrace core variants, ${coreDrawsSaved} combined submissions removed across ordinary variants, ${shopDrawsSaved} shop draws saved over trim-only; byte-identical geometry/UVs/normals/colours, exact PBR input selection, PMREM/cel controls, original 149m LOD and Basic/profile fallback.`);
console.log(`PASS: ${scripts.length} scripts; geometry/color ownership; ${terraceVariants} terrace variants with footprint, normals, UV continuity, cutback, draw groups and cached reuse; terrace→ordinary roof reset; Oberbaum radial courses, original arch topology, tower scale/bounds and surface-map alignment; corner normals/cap alignment; ${crossingRoadClearance.toFixed(3)}m asphalt clearance; 18m crossing opening; ordinary kiosk frontage protection; crossing→ordinary→hidden pooled recycle; coffee-sign bounds and parking reservations.`);
