'use strict';
// Independent, read-only checks for the staged oval-leaf hypothesis.
// node tools/check_berlin_oval_foliage_v92.cjs
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const crypto = require('crypto'), vm = require('vm');
const root = path.resolve(__dirname, '..');
const stage = path.join(root, 'audit/berlin-oval-foliage-v92');
const prefix = 'berlin-kiez-garden-v1';
const read = (dir, suffix) => fs.readFileSync(path.join(stage, dir, prefix + suffix));
const before = JSON.parse(read('baseline', '.json'));
const after = JSON.parse(read('models', '.json'));
const scope = {};
vm.runInNewContext(read('models', '.inline.js').toString(), scope);
assert.equal(JSON.stringify(scope.BERLIN_KIEZ_GARDEN_DATA), JSON.stringify(after));
const hashes = JSON.parse(fs.readFileSync(path.join(stage, 'baseline/sha256.json')));
for (const [name, hash] of Object.entries(hashes)) {
  const bytes = fs.readFileSync(path.join(stage, 'baseline', name));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), hash);
}
assert.deepEqual(read('models', '-atlas.jpg'), read('baseline', '-atlas.jpg'));
assert.deepEqual({...after, meshes: null}, {...before, meshes: null});
assert.equal(after.material.transparent, false);
assert.equal(after.material.side, 'FrontSide');
for (const key of Object.keys(before.meshes)) {
  if (!['treeNear', 'treeStreetFar'].includes(key)) assert.deepEqual(after.meshes[key], before.meshes[key]);
}
const specs = {position: [Float32Array, 3], normal: [Int16Array, 3], color: [Uint8Array, 3], uv: [Float32Array, 2]};
function decode(record) {
  const result = {};
  for (const [key, [Type]] of Object.entries({...specs, index: [record.vertices < 65536 ? Uint16Array : Uint32Array, 1]})) {
    const buffer = Buffer.from(record[key], 'base64');
    result[key] = new Type(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length));
  }
  return result;
}
const point = (data, i) => [...data.position.slice(i*3, i*3+3)];
const pointKey = p => p.join(',');
function components(data) {
  const parents = [], welded = [], ids = new Map(), points = [];
  function find(i) { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; }
  for (let i = 0; i < data.position.length/3; i++) {
    const p = point(data, i), key = pointKey(p);
    if (!ids.has(key)) { ids.set(key, parents.length); parents.push(parents.length); points.push(p); }
    welded.push(ids.get(key));
  }
  for (let i = 0; i < data.index.length; i += 3) {
    const a = find(welded[data.index[i]]);
    for (let k = 1; k < 3; k++) parents[find(welded[data.index[i+k]])] = a;
  }
  const groups = new Map();
  for (let i = 0; i < data.index.length; i += 3) {
    const root = find(welded[data.index[i]]);
    if (!groups.has(root)) groups.set(root, {faces: [], vertices: new Set(), points: new Set()});
    const g = groups.get(root); g.faces.push(i/3);
    for (let k = 0; k < 3; k++) { g.vertices.add(data.index[i+k]); g.points.add(welded[data.index[i+k]]); }
  }
  for (const g of groups.values()) {
    g.unique = [...g.points].map(i => points[i]);
    g.center = [0, 1, 2].map(k => g.unique.reduce((s, p) => s+p[k], 0)/g.unique.length);
  }
  return [...groups.values()];
}
function triangleCounter(data, faces) {
  const counter = new Map();
  for (const fi of faces) {
    const corners = [...data.index.slice(fi*3, fi*3+3)].map(i => Object.entries(specs).flatMap(([key, [, n]]) => [...data[key].slice(i*n, i*n+n)]));
    const key = JSON.stringify(corners);
    counter.set(key, (counter.get(key) || 0)+1);
  }
  return [...counter].sort(([a], [b]) => a.localeCompare(b));
}
const sub = (a, b) => a.map((v, i) => v-b[i]);
const dot = (a, b) => a.reduce((s, v, i) => s+v*b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const reports = {}, leafPayloads = {};
for (const [key, expected, limit] of [['treeNear', 1680, 28000], ['treeStreetFar', 418, 7500]]) {
  const old = decode(before.meshes[key]), current = decode(after.meshes[key]);
  const oldGroups = components(old), newGroups = components(current);
  const oldLeaves = oldGroups.filter(g => g.faces.length === 8 && g.unique.length === 6 && g.center[1] > 4.4);
  assert.equal(oldLeaves.length, expected);
  const candidates = newGroups.filter(g => g.faces.length === 16 && g.unique.length === 10);
  const selected = new Set(); let centerError = 0, meanColorError = 0;
  const payloads = [];
  for (const source of oldLeaves) {
    const matches = candidates.filter(g => Math.max(...g.center.map((v, i) => Math.abs(v-source.center[i]))) < 0.00001);
    assert.equal(matches.length, 1, 'each accepted leaf retains one uniquely matched centroid');
    const g = matches[0]; assert.ok(!selected.has(g)); selected.add(g);
    centerError = Math.max(centerError, ...g.center.map((v, i) => Math.abs(v-source.center[i])));
    const oldRGB = new Map(), newRGB = new Map(), newNormals = new Map();
    for (const vi of source.vertices) oldRGB.set(pointKey(point(old, vi)), [...old.color.slice(vi*3, vi*3+3)]);
    for (const vi of g.vertices) {
      const p = pointKey(point(current, vi)), rgb = [...current.color.slice(vi*3, vi*3+3)];
      if (newRGB.has(p)) assert.deepEqual(newRGB.get(p), rgb, 'both leaf sides have the same inherited color');
      newRGB.set(p, rgb);
      if (!newNormals.has(p)) newNormals.set(p, []);
      newNormals.get(p).push([...current.normal.slice(vi*3, vi*3+3)].map(v => v/32767));
      assert.deepEqual([...current.uv.slice(vi*2, vi*2+2)], [.015625, .015625]);
    }
    for (const normals of newNormals.values()) {
      for (const n of normals) assert.ok(Math.abs(dot(n, n)-1) < .0001);
      if (normals.length === 2) assert.ok(dot(normals[0], normals[1]) < -.9999, 'split rim normals face opposite sides');
    }
    for (let k = 0; k < 3; k++) {
      const prior = [...oldRGB.values()].map(c => c[k]), next = [...newRGB.values()].map(c => c[k]);
      assert.ok(Math.min(...next) >= Math.min(...prior) && Math.max(...next) <= Math.max(...prior));
      const error = Math.abs(next.reduce((a, b) => a+b)/10-prior.reduce((a, b) => a+b)/6);
      assert.ok(error <= .033334); meanColorError = Math.max(meanColorError, error);
    }
    const edges = new Map(); let volume = 0;
    for (const fi of g.faces) {
      const p = [...current.index.slice(fi*3, fi*3+3)].map(i => point(current, i));
      const area = cross(sub(p[1], p[0]), sub(p[2], p[0]));
      assert.ok(dot(area, area) > 1e-18);
      volume += dot(sub(p[0], g.center), cross(sub(p[1], g.center), sub(p[2], g.center)))/6;
      for (const [a, b] of [[0, 1], [1, 2], [2, 0]]) {
        const edge = [pointKey(p[a]), pointKey(p[b])].sort().join('|'); edges.set(edge, (edges.get(edge) || 0)+1);
      }
    }
    assert.ok(volume > 0); assert.ok([...edges.values()].every(n => n === 2));
    payloads.push(JSON.stringify(triangleCounter(current, g.faces)));
  }
  assert.equal(selected.size, expected);
  const protectedOld = oldGroups.filter(g => !oldLeaves.includes(g)).flatMap(g => g.faces);
  const protectedNew = newGroups.filter(g => !selected.has(g)).flatMap(g => g.faces);
  assert.deepEqual(triangleCounter(current, protectedNew), triangleCounter(old, protectedOld));
  assert.deepEqual(after.meshes[key].min, before.meshes[key].min);
  assert.deepEqual(after.meshes[key].max, before.meshes[key].max);
  for (let k = 0; k < 3; k++) {
    let aMin=Infinity, aMax=-Infinity, bMin=Infinity, bMax=-Infinity;
    for (let i=k; i<old.position.length; i+=3) { aMin=Math.min(aMin,old.position[i]);aMax=Math.max(aMax,old.position[i]); }
    for (let i=k; i<current.position.length; i+=3) { bMin=Math.min(bMin,current.position[i]);bMax=Math.max(bMax,current.position[i]); }
    assert.equal(aMin,bMin);assert.equal(aMax,bMax);
  }
  assert.ok(after.meshes[key].triangles <= limit);
  assert.equal(after.meshes[key].triangles, protectedOld.length+16*expected);
  leafPayloads[key] = new Set(payloads);
  reports[key] = {leaves: expected, triangles: after.meshes[key].triangles, protectedTriangles: protectedOld.length,
    allProtectedCornersExact: true, closedManifoldLeaves: true, maxCenterError: centerError, maxMeanRGBError: meanColorError};
}
for (const payload of leafPayloads.treeStreetFar) assert.ok(leafPayloads.treeNear.has(payload), 'far leaf geometry, normals, UVs and RGB exactly match near');
function glb(buffer) {
  assert.equal(buffer.toString('ascii',0,4),'glTF'); assert.equal(buffer.readUInt32LE(8),buffer.length);
  const size=buffer.readUInt32LE(12); return {json:JSON.parse(buffer.toString('utf8',20,20+size)), binary:buffer.subarray(28+size)};
}
const original = glb(read('baseline','.glb')), result = glb(read('models','.glb'));
for (const key of ['meshes','nodes','materials','textures','images','samplers','scenes','scene']) assert.deepEqual(result.json[key],original.json[key]);
const primitive=result.json.meshes.find(m=>m.name==='Kiez_Tree_Leaves_Street').primitives[0];
const changed=new Set([...Object.values(primitive.attributes),primitive.indices].map(i=>result.json.accessors[i].bufferView));
for (let i=0;i<original.json.bufferViews.length;i++) if (!changed.has(i)) {
  const a=original.json.bufferViews[i],b=result.json.bufferViews[i];
  assert.deepEqual(result.binary.subarray(b.byteOffset,b.byteOffset+b.byteLength),original.binary.subarray(a.byteOffset,a.byteOffset+a.byteLength));
}
assert.equal(result.json.accessors[primitive.indices].count,1680*16*3);
console.log('PASS: v92 staged leaves, exact branch/core/other-record preservation, RGB inheritance, closed thin sides, fixed centres and crown bounds, shared near/far payloads, unchanged material/atlas and protected GLB views.');
console.log(JSON.stringify(reports,null,2));
