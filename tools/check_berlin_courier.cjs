'use strict';
// Verify bind-space accessories against the actual bundled rig, not a mock rig.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'berlin-runner.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x => x[1]);
const context = vm.createContext({console});
vm.runInContext(scripts.find(s => s.includes('three.js r156 (MIT)')), context);
const T = context.THREE;
const glb = fs.readFileSync(path.join(root, 'assets/models/berlin-runner-hero-v12.glb'));
const jsonLength = glb.readUInt32LE(12);
const doc = JSON.parse(glb.subarray(20, 20 + jsonLength));
const bin = glb.subarray(28 + jsonLength);
function attribute(index) {
  const a = doc.accessors[index], b = doc.bufferViews[a.bufferView];
  assert.equal(b.byteStride, undefined, 'fixture uses packed attributes');
  const types = {5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array};
  const size = {SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16}[a.type];
  const Type = types[a.componentType];
  const offset = (b.byteOffset || 0) + (a.byteOffset || 0);
  const bytes = Uint8Array.from(bin.subarray(offset, offset + a.count * size * Type.BYTES_PER_ELEMENT));
  return new T.BufferAttribute(new Type(bytes.buffer), size, !!a.normalized);
}
const skin = doc.skins[0], jointSet = new Set(skin.joints);
const nodes = doc.nodes.map((n, i) => {
  const o = jointSet.has(i) ? new T.Bone() : new T.Group();
  o.name = n.name;
  if (n.translation) o.position.fromArray(n.translation);
  if (n.rotation) o.quaternion.fromArray(n.rotation);
  if (n.scale) o.scale.fromArray(n.scale);
  if (n.matrix) { o.matrix.fromArray(n.matrix); o.matrix.decompose(o.position, o.quaternion, o.scale); }
  return o;
});
doc.nodes.forEach((n, i) => (n.children || []).forEach(c => nodes[i].add(nodes[c])));
nodes.filter(n => !n.parent).forEach(n => n.updateMatrixWorld(true));
const inverse = attribute(skin.inverseBindMatrices);
const skeleton = new T.Skeleton(skin.joints.map(i => nodes[i]), skin.joints.map((_, i) =>
  new T.Matrix4().fromArray(inverse.array, i * 16)));
const primitive = doc.meshes[0].primitives[0], geometry = new T.BufferGeometry();
geometry.setAttribute('position', attribute(primitive.attributes.POSITION));
geometry.setAttribute('skinIndex', attribute(primitive.attributes.JOINTS_0));
geometry.setAttribute('skinWeight', attribute(primitive.attributes.WEIGHTS_0));
const mesh = new T.SkinnedMesh(geometry, new T.MeshStandardMaterial());
mesh.bind(skeleton, new T.Matrix4());
const before = Buffer.from(geometry.attributes.position.array.buffer).toString('base64');
const start = html.indexOf('  function dressCourierHero(mesh) {');
const end = html.indexOf('\n  function findHeroRunClip', start);
assert.ok(start > 0 && end > start);
const mergeStart = html.indexOf('  function mergeBoxes(specs) {');
const mergeEnd = html.indexOf('\n  // DRAW-CALL CONSOLIDATION:', mergeStart);
const mergeBoxes = new Function('THREE', html.slice(mergeStart, mergeEnd) + '\nreturn mergeBoxes;')(T);
const dress = new Function('THREE', 'heroTrimMat', 'roundedBox', 'mergeBoxes',
  html.slice(start, end) + '\nreturn dressCourierHero;')(
    T, color => new T.MeshStandardMaterial({color}),
    (w, h, d, r, material, x, y, z) => {
      const o = new T.Mesh(new T.BoxGeometry(w, h, d), material);
      o.position.set(x, y, z); return o;
    }, mergeBoxes);
dress(mesh);
const cap = skeleton.bones.find(b => b.name === 'Head').getObjectByName('Courier cap');
const bag = skeleton.bones.find(b => b.name === 'Spine02').getObjectByName('Courier sling bag');
assert.ok(cap && bag, 'both accessories attach to the intended actual bones');
assert.equal(cap.children.length + bag.children.length, 7, 'outfit stays within seven draws');
assert.equal(before, Buffer.from(geometry.attributes.position.array.buffer).toString('base64'), 'source skin geometry stays intact');
for (const accessory of [cap, bag]) {
  nodes.filter(n => !n.parent).forEach(n => n.updateMatrixWorld(true));
  const box = new T.Box3().setFromObject(accessory);
  const size = box.getSize(new T.Vector3());
  assert.ok([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].every(Number.isFinite));
  assert.ok(size.x > 0.1 && size.x < 0.7 && size.y < 0.7, `${accessory.name} remains human scale`);
  const oldPosition = accessory.getWorldPosition(new T.Vector3());
  accessory.parent.rotation.x += 0.4;
  nodes.filter(n => !n.parent).forEach(n => n.updateMatrixWorld(true));
  assert.ok(oldPosition.distanceTo(accessory.getWorldPosition(new T.Vector3())) > 0.005, 'accessory follows bone animation');
}
assert.ok(fs.existsSync(path.join(root, 'assets/img/berlin-summer-sky-v1.png')));
const inline = fs.readFileSync(path.join(root, 'assets/img/berlin-art.inline.js'), 'utf8');
assert.ok(inline.includes('summerSky: \'data:image/png;base64,'));
console.log('PASS: actual GLB bind-space fit, bone attachment/motion, untouched source geometry, and offline sky companion.');
