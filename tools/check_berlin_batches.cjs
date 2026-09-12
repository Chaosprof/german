'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'berlin-runner.html'), 'utf8');
function section(start, end) {
  const a = html.indexOf(start), b = html.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, start);
  return html.slice(a, b);
}
const c = vm.createContext({console});
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(m => m[1]).find(s => s.includes('three.js r156 (MIT)')), c);
const THREE = c.THREE;
c.PROP_FLAT_MAT = new THREE.MeshStandardMaterial({vertexColors:true});
c.clamp = THREE.MathUtils.clamp;
vm.runInContext(section('  function isFlatPropMaterial(', '  // Once the resident macro-cycle'), c);
c.scene = new THREE.Scene();
const sharedGeometry = new THREE.BoxGeometry(1,1,1);
const red = new THREE.MeshStandardMaterial({color:0xe33745,envMapIntensity:0.68});
const green = new THREE.MeshStandardMaterial({color:0x33a776,envMapIntensity:0.68});
const unconverted = new THREE.Mesh(sharedGeometry,new THREE.MeshStandardMaterial({map:new THREE.Texture()}));
const sharedUsers = [red,green,red,green].map(m=>new THREE.Mesh(sharedGeometry,m));
c.scene.add(...sharedUsers,unconverted);
const sharedResult = c.unifyFlatPropMaterials();
assert.equal(sharedResult.converted,4);
assert.equal(sharedResult.cloned,2,'one immutable copy per source/material pair');
assert.equal(sharedUsers[0].geometry,sharedUsers[2].geometry);
assert.equal(sharedUsers[1].geometry,sharedUsers[3].geometry);
assert.notEqual(sharedUsers[0].geometry,sharedUsers[1].geometry);
assert.equal(sharedGeometry.attributes.color,undefined,'nonconverting users retain original geometry');
assert.equal(unconverted.geometry,sharedGeometry);
assert.ok(Math.abs(sharedUsers[0].geometry.attributes.color.getX(0)-red.color.r)<1/65535);
assert.ok(Math.abs(sharedUsers[1].geometry.attributes.color.getY(0)-green.color.g)<1/65535);
vm.runInContext(section('  function mergedFlatGeometry(', '  function mat(color, opts)'), c);
const chunk = new THREE.Group();
chunk.position.set(0, 0, 80);
const ud = chunk.userData;
for (const name of ['transit','station','bridge','tunnel']) {
  const root = new THREE.Group(); root.position.set(2, 1, 8); root.rotation.y = 0.32;
  ud[name] = {root}; chunk.add(root);
}
const train = new THREE.Group();
train.position.set(3, 2, 0); train.rotation.y = -0.2;
ud.transit.train = train; ud.transit.root.add(train);
let colorId = 1;
function mesh(parent, x) {
  const geo = new THREE.BoxGeometry(1, 2, 3);
  const n = geo.attributes.position.count;
  const colors = new Uint16Array(n * 3).fill(colorId++ * 3900);
  const surface = new Uint8Array(n * 2).fill(72 + colorId * 3);
  geo.setAttribute('color', new THREE.Uint16BufferAttribute(colors, 3, true));
  geo.setAttribute('aSurf', new THREE.Uint8BufferAttribute(surface, 2, true));
  const result = new THREE.Mesh(geo, c.PROP_FLAT_MAT);
  result.position.set(x, x * 0.2, 1); result.rotation.z = 0.11 * x;
  result.updateMatrix(); result.matrixAutoUpdate = result.matrixWorldAutoUpdate = false;
  parent.add(result); return result;
}
const a = mesh(ud.transit.root, 0), b = mesh(ud.transit.root, 2);
for (const source of [a,b]) {
  const copy = new THREE.Mesh(source.geometry,source.material);
  copy.matrix.copy(source.matrix);
  copy.matrixAutoUpdate = copy.matrixWorldAutoUpdate = false;
  ud.tunnel.root.add(copy);
}
const trainA = mesh(train, 0), trainB = mesh(train, 1);
const referenced = mesh(ud.transit.root, -3); ud.transit.independent = referenced;
const hidden = mesh(ud.transit.root, 3); hidden.visible = false;
const optOut = mesh(ud.transit.root, 4); optOut.userData.noStaticMerge = true;
const otherLayer = mesh(ud.transit.root, 5); otherLayer.layers.set(2);
const receiving = mesh(ud.transit.root, 6); receiving.receiveShadow = true;
// These originally cast shadows, but are temporarily outside the shadow band.
// They must not be grouped with permanently non-casting siblings.
const castingA = mesh(ud.station.root, 0), castingB = mesh(ud.station.root, 1);
const permanentNonCaster = mesh(ud.station.root, 2);
castingA.castShadow = castingB.castShadow = false;
ud.shadowCasters = [castingA, castingB];
c.chunks = [chunk];
function capture(root) {
  root.updateMatrixWorld(true);
  const rows = [];
  root.traverseVisible(m => {
    if (!m.isMesh) return;
    const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
    for (let i=0; i<geo.attributes.position.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(geo.attributes.position,i).applyMatrix4(m.matrixWorld);
      const normal = new THREE.Vector3().fromBufferAttribute(geo.attributes.normal,i).applyMatrix3(normalMatrix).normalize();
      rows.push([...p.toArray(),...normal.toArray(),geo.attributes.uv.getX(i),geo.attributes.uv.getY(i),
        geo.attributes.color.getX(i),geo.attributes.color.getY(i),geo.attributes.color.getZ(i),
        geo.attributes.aSurf.getX(i),geo.attributes.aSurf.getY(i),m.layers.mask,Number(m.receiveShadow)]);
    }
  });
  // Vertex colour identifies original pieces independently of merged order.
  return rows.sort((a,b) => a[8]-b[8] || a[6]-b[6] || a[7]-b[7] || a[3]-b[3] || a[4]-b[4] || a[5]-b[5]);
}
function equivalent(a,b) {
  assert.equal(a.length,b.length,'same triangles');
  for(let i=0;i<a.length;i++)for(let j=0;j<a[i].length;j++)
    assert.ok(Math.abs(a[i][j]-b[i][j])<0.00001,`world geometry/surface ${i}:${j}`);
}
const before = capture(chunk);
const result = c.batchSetPieceFlatSiblings();
assert.equal(result.sources,8); assert.equal(result.batches,4);
assert.equal(result.geometries,3,'identical parent-local assemblies share a geometry buffer');
equivalent(before,capture(chunk));
for(const node of [referenced,hidden,optOut,otherLayer,receiving,permanentNonCaster]) assert.ok(node.parent,'independent state retained');
assert.equal(ud.shadowCasters.length,1,'original casters replaced by their batch');
assert.equal(ud.shadowCasters[0].castShadow,false,'current far shadow state retained');
assert.ok(!ud.shadowCasters.includes(castingA) && !ud.shadowCasters.includes(castingB));
// Restore original meshes just in a reference hierarchy to compare moving
// parent transforms after batching, using the actual shipped merger output.
const actualTrainMesh = train.children[0];
train.remove(actualTrainMesh); train.add(trainA,trainB);
train.position.x += 11; train.rotation.y += 0.37; chunk.position.z += 640;
chunk.updateMatrixWorld(true);
const movedBefore = capture(train);
train.remove(trainA,trainB); train.add(actualTrainMesh);
chunk.updateMatrixWorld(true);
equivalent(movedBefore,capture(train));
train.visible = false;
assert.equal(capture(chunk).filter(row=>row[8]===trainA.geometry.attributes.color.getX(0)).length,0,'train visibility remains independent');
console.log('PASS: shipped sibling merger preserves every vertex, normal, UV, colour and surface value; independent visibility/layers/receivers, original shadow-band membership, moving train hierarchy and 640 m recycling.');
// Frozen grouping nodes carry no independent state. Their transformed pieces
// may share a draw, while referenced/animated/hidden groups stay separate.
const nestedChunk=new THREE.Group(),nestedData=nestedChunk.userData;
for(const name of ['transit','station','bridge','tunnel']){
  nestedData[name]={root:new THREE.Group()};nestedChunk.add(nestedData[name].root);
}
nestedData.shadowCasters=[];
const nestedRoot=nestedData.bridge.root,leaves=[];
for(let i=0;i<3;i++){
  const group=new THREE.Group();group.position.set(i*3,1,-i*4);
  group.rotation.set(.1*i,.3*i,0);group.scale.set(1+i*.2,.9,1.1);
  group.updateMatrix();group.matrixAutoUpdate=false;nestedRoot.add(group);
  leaves.push(mesh(group,0),mesh(group,1));
}
const moving=new THREE.Group();nestedRoot.add(moving);
const movingMesh=mesh(moving,0);
const toggled=new THREE.Group();toggled.matrixAutoUpdate=false;nestedRoot.add(toggled);
nestedData.bridge.sign=toggled;const toggledMesh=mesh(toggled,2);
const concealed=new THREE.Group();concealed.matrixAutoUpdate=false;concealed.visible=false;
nestedRoot.add(concealed);const concealedMesh=mesh(concealed,3);
const nestedBefore=capture(nestedChunk);c.chunks=[nestedChunk];
const nestedResult=c.batchSetPieceFlatSiblings();
assert.equal(nestedResult.sources,6);assert.equal(nestedResult.batches,1);
equivalent(nestedBefore,capture(nestedChunk));
assert.equal(movingMesh.parent,moving);assert.equal(toggledMesh.parent,toggled);assert.equal(concealedMesh.parent,concealed);
moving.position.x=12;toggled.visible=false;concealed.visible=true;nestedChunk.position.z=640;
const movedRows=capture(nestedChunk);
assert.ok(movedRows.some(row=>row[8]===movingMesh.geometry.attributes.color.getX(0)&&row[0]>10));
assert.ok(!movedRows.some(row=>row[8]===toggledMesh.geometry.attributes.color.getX(0)));
assert.ok(movedRows.some(row=>row[8]===concealedMesh.geometry.attributes.color.getX(0)));
console.log('PASS: six frozen nested pieces share one draw with exact transformed vertices; moving, referenced and hidden parents retain independent state.');
