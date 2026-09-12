'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const fixture = fs.readFileSync(path.join(__dirname, 'check_berlin_vehicles.cjs'), 'utf8');
const c = new Function('require', '__dirname', fixture.slice(0, fixture.indexOf('const vertex =')) + ';return c;')(require, __dirname);
const THREE = c.THREE;
c.indexRigidSceneGeometry();
const originals = new Map();
c.scene.traverse(mesh => {
  if (mesh.geometry && mesh.geometry.userData.rigidMerged) originals.set(mesh.geometry, mesh.geometry.clone());
});
const stats = c.compactRigidSceneAttributes();
assert.ok(stats.geometries >= 10, 'actual car and bus geometry is compacted');
assert.equal(stats.bytesAfter, stats.bytesBefore / 2, 'eligible attributes use half the storage');
let normals = 0, worstAngle = 0;
const beforeNormal = new THREE.Vector3(), afterNormal = new THREE.Vector3();
for (const [geo, original] of originals) {
  assert.deepEqual(geo.groups, original.groups);
  assert.deepEqual(geo.drawRange, original.drawRange);
  if (geo.index) assert.deepEqual(geo.index.array, original.index.array, 'triangle stream stays exact');
  for (const name of ['position', 'uv']) {
    if (original.attributes[name]) assert.deepEqual(geo.attributes[name].array, original.attributes[name].array, name);
  }
  const a = original.attributes.normal, b = geo.attributes.normal;
  if (!a) continue;
  assert.equal(b.array.constructor.name, 'Int16Array');
  assert.equal(b.normalized, true);
  for (let i = 0; i < a.count; i++) {
    beforeNormal.fromBufferAttribute(a, i); afterNormal.fromBufferAttribute(b, i);
    assert.ok(beforeNormal.distanceTo(afterNormal) <= Math.sqrt(3) / 65534 + 1e-12);
    if (beforeNormal.lengthSq() && afterNormal.lengthSq()) {
      const angle = beforeNormal.angleTo(afterNormal) * 180 / Math.PI;
      worstAngle = Math.max(worstAngle, angle);
      assert.ok(angle < 0.003, 'actual lighting-normal error stays below 0.003 degrees');
    }
    normals++;
  }
}
assert.equal(c.compactRigidSceneAttributes().geometries, 0, 'repeat warm-up keeps compact buffers');

// Cover the entire linear colour range, including dark colours and alpha.
const colours = new THREE.BufferGeometry(); colours.userData.rigidMerged = true;
const values = Array.from({length: 65536}, (_, i) => i === 0 ? 0 : i === 65535 ? 1 : (i + 0.375) / 65535);
colours.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(values.length / 4 * 3), 3));
colours.setAttribute('color', new THREE.Float32BufferAttribute(values, 4));
const oldPosition = colours.attributes.position, oldColour = colours.attributes.color;
oldColour.name = 'linear colour'; const upload = () => {}; oldColour.onUpload(upload);
let disposals = 0;
colours.addEventListener('dispose', () => {
  disposals++;
  assert.equal(colours.attributes.color, oldColour, 'GPU source is attached while it is released');
});
const colourStats = c.compactRigidAttributes(colours);
assert.equal(disposals, 1); assert.equal(colours.attributes.position, oldPosition);
assert.equal(colours.attributes.color.array.constructor.name, 'Uint16Array');
assert.equal(colours.attributes.color.name, oldColour.name);
assert.equal(colours.attributes.color.onUploadCallback, upload);
assert.ok(colourStats.maxColorError <= 1 / 131070 + 1e-12);
for (let i = 0; i < values.length; i++) {
  assert.ok(Math.abs(colours.attributes.color.array[i] / 65535 - oldColour.array[i]) <= 1 / 131070 + 1e-12);
}

// Unsupported or mutable geometry retains its original storage and ownership.
for (const mode of ['untagged', 'dynamic', 'morph', 'interleaved', 'instance-geometry', 'instance-attribute', 'integer-shader']) {
  const g = mode === 'instance-geometry' ? new THREE.InstancedBufferGeometry() : new THREE.BufferGeometry();
  g.userData.rigidMerged = mode !== 'untagged';
  const a = new THREE.Float32BufferAttribute([0, 1, 0], 3);
  g.setAttribute('normal', a);
  if (mode === 'dynamic') a.setUsage(THREE.DynamicDrawUsage);
  if (mode === 'morph') g.morphAttributes.normal = [a.clone()];
  if (mode === 'interleaved') g.setAttribute('normal', new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(a.array, 3), 3, 0));
  if (mode === 'instance-attribute') g.setAttribute('offset', new THREE.InstancedBufferAttribute(new Float32Array(3), 3));
  if (mode === 'integer-shader') a.gpuType = THREE.IntType;
  const original = g.attributes.normal;
  g.addEventListener('dispose', () => assert.fail(`${mode} must not dispose`));
  assert.equal(c.compactRigidAttributes(g), null, mode);
  assert.equal(g.attributes.normal, original);
}
for (const value of [-0.001, 1.001, NaN, Infinity]) {
  const g = new THREE.BufferGeometry(); g.userData.rigidMerged = true;
  g.setAttribute('color', new THREE.Float32BufferAttribute([value, 0.5, 1], 3));
  const original = g.attributes.color;
  assert.equal(c.compactRigidAttributes(g), null, `out-of-range colour ${value}`);
  assert.equal(g.attributes.color, original);
}
for (const kind of ['points', 'skin', 'morph']) {
  const g = new THREE.BufferGeometry(); g.userData.rigidMerged = true;
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0], 3));
  c.scene = new THREE.Scene(); c.scene.add(new THREE.Mesh(g));
  const other = kind === 'points' ? new THREE.Points(g) : kind === 'skin' ? new THREE.SkinnedMesh(g) : new THREE.Mesh(g);
  if (kind === 'morph') other.morphTargetInfluences = [];
  c.scene.add(other);
  assert.equal(c.compactRigidSceneAttributes().geometries, 0, `shared ${kind} geometry excluded`);
}
console.log(`PASS: ${stats.geometries} actual rigid geometries, ${normals.toLocaleString()} normals, max lighting-normal error ${worstAngle.toFixed(6)} degrees; eligible buffers halved; exact positions/UVs/topology; 16-bit linear colour error bound, HDR/mutable exclusions and GPU ownership verified.`);
