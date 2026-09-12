'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const assert = require('assert/strict');
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
c.clamp = THREE.MathUtils.clamp;
vm.runInContext(section('  var geoCache = Object.create(null);', '  function icoGeo(r)'), c);
vm.runInContext(section('  function mergeBoxes(specs) {', '\n  // DRAW-CALL CONSOLIDATION:'), c);
c.scene = new THREE.Scene();
c.camera = new THREE.PerspectiveCamera(65, 390 / 844, 0.1, 1800);
c.mat = (color, options) => new THREE.MeshStandardMaterial({color, ...options});
c.PROFILE_RENDER = true;
c.canvas = {dataset:{}};
vm.runInContext(section('  var gardenRoot = new THREE.Group();', '  // ---------------------------------------------------- distant skyline'), c);
const meshes = [c.gardenCrowns, c.gardenTrunks, c.gardenBeds];
const vertex = new THREE.Vector3(), expected = new THREE.Matrix4(), actual = new THREE.Matrix4();
let checkedVertices = 0, views = 0, minimumCount = 72, maximumCount = 0;
// The culling sphere must enclose every vertex of all three actual shipped
// geometries, including their different root offsets.
meshes.forEach((mesh, kind) => {
  const positions = mesh.geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    vertex.y += kind === 1 ? 1.95 : kind === 2 ? -0.02 : 0;
    assert.ok(c.gardenLocalSphere.containsPoint(vertex), 'union encloses the complete garden');
  }
});
for (const aspect of [390 / 844, 844 / 390, 16 / 9]) {
  for (const z of [0, 23.99, 24.01, 287.99, 288.01, 640, 1280]) {
    for (const x of [-4, 0, 4]) {
      c.camera.aspect = aspect;
      c.camera.position.set(x, 3.5 + (z % 3), z);
      c.camera.lookAt(-x * 0.15, 1.1, z + 17);
      c.camera.updateProjectionMatrix();
      c.updateGardenLayer(z);
      const count = c.gardenCrowns.count;
      minimumCount = Math.min(minimumCount, count); maximumCount = Math.max(maximumCount, count);
      assert.ok(meshes.every(mesh => mesh.count === count && mesh.visible === (count > 0)));
      let output = 0;
      for (const garden of c.gardenPositions) {
        // Independent visibility oracle: project the actual vertices. Every
        // vertex on screen must belong to a retained garden.
        for (let kind = 0; kind < meshes.length; kind++) {
          const positions = meshes[kind].geometry.attributes.position;
          for (let i = 0; i < positions.count; i += 3) {
            vertex.fromBufferAttribute(positions, i);
            vertex.multiplyScalar(garden.size);
            vertex.x += garden.x + c.gardenRoot.position.x;
            vertex.y += kind === 1 ? 1.95 * garden.size : kind === 2 ? -0.02 : 0;
            vertex.z += garden.currentZ;
            vertex.project(c.camera);
            if (Math.abs(vertex.x) <= 1 && Math.abs(vertex.y) <= 1 && Math.abs(vertex.z) <= 1) {
              assert.ok(garden.visible, 'a projected vertex must never be culled');
            }
            checkedVertices++;
          }
          if (garden.visible) {
            expected.makeScale(garden.size, garden.size, garden.size);
            expected.setPosition(garden.x, kind === 1 ? 1.95 * garden.size : kind === 2 ? -0.02 : 0, garden.currentZ);
            meshes[kind].getMatrixAt(output, actual);
            assert.ok(actual.elements.every((v, j) => Math.abs(v - expected.elements[j]) < 0.0002), 'compaction preserves transforms');
          }
        }
        if (garden.visible) {
          const color = new THREE.Color(); c.gardenCrowns.getColorAt(output, color);
          assert.ok(Math.abs(color.r - garden.color.r) < 1e-6 && Math.abs(color.g - garden.color.g) < 1e-6 && Math.abs(color.b - garden.color.b) < 1e-6, 'color follows its garden');
          output++;
        }
      }
      assert.equal(output, count);
      const versions = meshes.map(mesh => mesh.instanceMatrix.version);
      const colorVersion = c.gardenCrowns.instanceColor.version;
      c.updateGardenLayer(z);
      assert.deepEqual(meshes.map(mesh => mesh.instanceMatrix.version), versions, 'stable view performs no uploads');
      assert.equal(c.gardenCrowns.instanceColor.version, colorVersion);
      views++;
    }
  }
}
assert.ok(maximumCount < 72, 'off-screen gardens stop submitting vertices');
console.log(`PASS: ${views} portrait/landscape/desktop views, ${checkedVertices.toLocaleString()} projected vertices; ${minimumCount}–${maximumCount}/72 gardens retained; exact geometry, transforms, colours, wrap continuity and change-only uploads.`);
