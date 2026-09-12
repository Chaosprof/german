'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const fixture = fs.readFileSync(path.join(__dirname, 'check_berlin_vehicles.cjs'), 'utf8');
const c = new Function('require', '__dirname', fixture.slice(0, fixture.indexOf('const vertex =')) + ';return c;')(require, __dirname);
const html = fs.readFileSync(path.join(__dirname, '..', 'berlin-runner.html'), 'utf8');
const start = html.indexOf('  var SHARED_POOL_ZERO_ELEMENTS =');
const end = html.indexOf('  // One real InstancedMesh per type', start);
assert.ok(start > 0 && end > start);
c.CULL_SHARED_POOLS = true; c.performance = {now: () => 0};
vm.runInContext(html.slice(start, end), c);
const THREE = c.THREE;
c.indexRigidSceneGeometry(); c.compactRigidSceneAttributes();
const geo = c.parkedCarInst.reduce((a, b) =>
  a.geometry.attributes.position.count > b.geometry.attributes.position.count ? a : b).geometry;
const pool = c.makeSharedPool(geo, c.MAT.test, 6, {withColor: true, posY: 0.178});
const caster = c.makeSharedPool(geo, c.MAT.test, 1, {castShadow: true});
assert.equal(caster.view, undefined, 'existing caster pools retain their complete submission');
const alpha = c.MAT.test.clone(); alpha.transparent = true;
assert.equal(c.makeSharedPool(geo, alpha, 1, {}).view, undefined, 'transparent pools retain their original ordering');
const sourceMatrices = [], chunkViews = [];
for (let slot = 0; slot < c.CHUNK_COUNT; slot++) {
  const chunk = new THREE.Group(); chunk.position.z = slot * 45;
  const view = c.poolView(pool, slot, chunk); chunkViews.push({view, chunk});
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3((i - 2.5) * 15, i % 3 * 7, i * 3),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.37),
      new THREE.Vector3(i % 2 ? -1.2 : 0.8, 0.7 + i * 0.2, 1.3));
    m.elements[4] += 0.17; // shear as well as reflection/non-uniform scale
    sourceMatrices.push(m.clone()); view.setMatrixAt(i, m);
    view.setColorAt(i, new THREE.Color(i / 6, slot / 4, 0.5));
  }
  c.syncPoolRange(pool, slot, true);
}
c.repackPool(pool);
assert.equal(pool.view.count, 24);
const world = new THREE.Matrix4(), local = new THREE.Matrix4(), actual = new THREE.Matrix4();
const vertex = new THREE.Vector3(), color = new THREE.Color();
let projections = 0, views = 0, minShown = 24, maxShown = 0;
const committedVersion = pool.mesh.instanceMatrix.version;
for (const aspect of [390 / 844, 844 / 390, 16 / 9]) for (const rootShift of [0, 640]) {
  c.worldRoot.position.set(8, -2, rootShift);
  c.worldRoot.rotation.set(0, 0.08, 0); c.worldRoot.updateMatrix();
  for (const z of [-20, 20, 70, 130]) for (const x of [-6, 6]) {
    c.camera.aspect = aspect; c.camera.fov = 55 + (z > 60 ? 12 : 0); c.camera.updateProjectionMatrix();
    c.camera.position.set(x, 4, z + rootShift); c.camera.lookAt(x * 0.3, 3, z + rootShift + 35);
    c.updateVehicleFrusta(); c.syncSharedPoolVisibility(); views++;
    let output = 0;
    for (let i = 0; i < pool.view.count; i++) {
      const source = pool.view.order[i];
      local.fromArray(pool.view.matrices, source * 16);
      world.multiplyMatrices(c.worldRoot.matrixWorld, pool.mesh.matrix).multiply(local);
      for (let v = 0; v < geo.attributes.position.count; v++) {
        vertex.fromBufferAttribute(geo.attributes.position, v).applyMatrix4(world).project(c.camera);
        const visible = Math.abs(vertex.x) <= 1 && Math.abs(vertex.y) <= 1 && Math.abs(vertex.z) <= 1;
        if (visible) assert.ok(i < pool.mesh.count, 'every projected vertex retains its complete instance');
        projections++;
      }
      if (i >= pool.mesh.count) continue;
      pool.mesh.getMatrixAt(output, actual); pool.mesh.getColorAt(output, color);
      assert.deepEqual(actual.elements, local.elements, 'exact committed matrix in the sorted prefix');
      assert.deepEqual([color.r, color.g, color.b], Array.from(pool.view.colors.slice(source * 3, source * 3 + 3)), 'tint follows its retained instance');
      output++;
    }
    assert.equal(pool.mesh.count, output); assert.equal(pool.mesh.visible, output > 0);
    minShown = Math.min(minShown, output); maxShown = Math.max(maxShown, output);
    assert.equal(pool.mesh.instanceMatrix.version, committedVersion, 'camera/FOV/root changes never upload instance buffers');
    const version = pool.mesh.instanceMatrix.version;
    c.syncSharedPoolVisibility();
    assert.equal(pool.mesh.instanceMatrix.version, version, 'unchanged membership avoids buffer uploads');
  }
}
assert.ok(minShown < 12 && maxShown > minShown, 'camera culling removes substantial invisible work');

// Dirty layout changes keep their old committed transforms until the existing
// repack budget releases them; camera filtering must not bypass that budget.
const committed = Array.from(pool.view.matrices.slice(0, 16));
const moved = sourceMatrices[0].clone(); moved.elements[12] += 1000;
chunkViews[0].view.setMatrixAt(0, moved);
c.syncSharedPoolVisibility();
assert.deepEqual(Array.from(pool.view.matrices.slice(0, 16)), committed);
c.repackPool(pool); c.syncSharedPoolVisibility();
assert.equal(pool.view.matrices[12], moved.elements[12]);

// Hidden chunks and recycled slots cannot leave stale instances. A later
// caster promotion restores every committed instance, including off-screen ones.
c.syncPoolRange(pool, 0, false); c.repackPool(pool); c.syncSharedPoolVisibility();
assert.equal(pool.view.count, 18);
chunkViews[0].chunk.position.z += 640;
for (let i = 0; i < 6; i++) chunkViews[0].view.setMatrixAt(i, sourceMatrices[i]);
c.syncPoolRange(pool, 0, true); c.repackPool(pool); c.syncSharedPoolVisibility();
assert.equal(pool.view.matrices[14], sourceMatrices[0].elements[14] + 640);
pool.mesh.castShadow = true; c.syncSharedPoolVisibility();
assert.equal(pool.mesh.count, pool.view.count);
for (let i = 0; i < pool.view.count; i++) for (let k = 0; k < 16; k++) {
  assert.equal(pool.mesh.instanceMatrix.array[i * 16 + k], pool.view.matrices[pool.view.order[i] * 16 + k]);
}
pool.mesh.castShadow = false;
for (let slot = 0; slot < c.CHUNK_COUNT; slot++) c.syncPoolRange(pool, slot, false);
c.repackPool(pool); c.syncSharedPoolVisibility();
assert.equal(pool.mesh.count, 0); assert.equal(pool.mesh.visible, false);

// A large primitive can cross the view with all its vertices outside it.
const spanning = c.makeSharedPool(new THREE.PlaneGeometry(1000, 1000), c.MAT.test, 1, {});
const spanChunk = new THREE.Group(), spanView = c.poolView(spanning, 0, spanChunk);
spanView.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, 0, 20));
c.syncPoolRange(spanning, 0, true); c.repackPool(spanning);
c.worldRoot.position.set(0, 0, 0); c.worldRoot.rotation.set(0, 0, 0); c.worldRoot.updateMatrix();
c.camera.position.set(0, 0, 0); c.camera.lookAt(0, 0, 20); c.camera.updateProjectionMatrix();
c.updateVehicleFrusta(); c.syncSharedPoolVisibility();
assert.equal(spanning.mesh.count, 1, 'intersecting surfaces remain even when every corner is off screen');
c.CULL_SHARED_POOLS = false;
const disabled = c.makeSharedPool(geo, c.MAT.test, 1, {});
assert.equal(disabled.view, undefined, 'diagnostic baseline allocates no culling cache');
console.log(`PASS: ${views} camera/viewport/root views, ${projections.toLocaleString()} actual vehicle-geometry projections; ${minShown}–${maxShown}/24 retained; exact matrices/tints, shear/reflection, no camera-driven uploads, budgeted commits, empty/recycled chunks and caster/transparent preservation.`);
