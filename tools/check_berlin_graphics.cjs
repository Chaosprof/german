// Run with: node tools/check_berlin_graphics.cjs
// Tests the actual embedded geometry merger, including its canopy-color path.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'berlin-runner.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
scripts.forEach((source, i) => new vm.Script(source, {filename:`inline-${i}.js`}));
const context = vm.createContext({console});
vm.runInContext(scripts.find(s => s.includes('three.js r156 (MIT)')), context);
const THREE = context.THREE;
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
const rollBayStart = html.indexOf('    var hasErker = streetCorner ||');
const rollBayEnd = html.indexOf('    // Balcony only where there is no Erker',rollBayStart);
const rollBay = new Function('d','w','s','streetCorner','styleUnit','dressBias','erkerGeo','crossingCornerBayGeo','STOREY_H','ERKER_H',
  'var styleSeed = 0;\n'+html.slice(rollBayStart,rollBayEnd));
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
const cornerSelector = html.slice(html.indexOf('        var streetCorner = hasCross'),html.indexOf('        // The crossing keeps a full 18 m opening'));
const selectCorner = new Function('hasCross','b2','var hasStation=false,hasBridge=false,hasTunnel=false,bridgeEdgeChunk=false;'+cornerSelector+'return streetCorner;');
assert.equal(selectCorner(false,0),false,'ordinary kiosk frontages never receive a deep crossing overhang');
assert.equal(selectCorner(true,0),true);
assert.equal(selectCorner(true,1),false);
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
console.log(`PASS: ${scripts.length} scripts; geometry/color ownership; corner normals/cap alignment; ${crossingRoadClearance.toFixed(3)}m asphalt clearance; 18m crossing opening; ordinary kiosk frontage protection; crossing→ordinary→hidden pooled recycle; coffee-sign bounds and parking reservations.`);
