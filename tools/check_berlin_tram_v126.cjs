'use strict';
// V126 reference tram: test the actual runtime factory, its visible surfaces and batching.
// node tools/check_berlin_tram_v126.cjs [--shipping]
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
function check(shipping = process.argv.includes('--shipping')) {
  const root = path.resolve(__dirname, '..'), stage = path.join(root, 'audit/berlin-tram-v126');
  const folder = shipping ? path.join(root, 'assets/models') : path.join(stage, 'models');
  const html = fs.readFileSync(shipping ? path.join(root, 'berlin-runner.html') : path.join(stage, 'candidate.html'), 'utf8');
  // V152 superseded the shipped V126 coach; validate what actually ships.
  if (shipping && html.includes('var BERLIN_REFERENCE_TRAM_DATA = ')) return require('./check_berlin_vehicles_v152.cjs')(true);
  function section(a, b) { const i = html.indexOf(a), j = html.indexOf(b, i + a.length); assert.ok(i >= 0 && j > i, a); return html.slice(i, j); }
  const c = vm.createContext({ console });
  vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m => m[1].includes('three.js r156 (MIT)'))[1], c);
  const T = c.THREE; c.atob = s => Buffer.from(s, 'base64').toString('binary'); c.clamp = T.MathUtils.clamp;
  c.mat = (color, options) => new T.MeshStandardMaterial({ color, ...options });
  c.MAT = { metalDark: c.mat(0x23343b), tyre: c.mat(0x18232a) }; c.STATION_MAT = { steel: c.mat(0x596a75) };
  c.PROP_TAIL = new T.MeshBasicMaterial({ color: 0xff4d3d }); c.destRollMat = new T.MeshBasicMaterial();
  c.freezeObjectTree = g => g.updateMatrixWorld(true); c.registerProp = (_, g) => g;
  for (const s of [section('  var geoCache = Object.create(null);', '  // ------------------------------------------------- generated prop swaps'),
    section('  function mergeBoxes(specs) {', '\n  // DRAW-CALL CONSOLIDATION:'),
    section('  var staticMergeGeometryCache = new Map();', '  // Merges building parts that carry different materials'),
    fs.readFileSync(path.join(__dirname, 'berlin_packed_geometry.js'), 'utf8'),
    section('var BERLIN_VINTAGE_TRAM_DATA = ', '  function makeRunnerTram() {'),
    section('  function makeRunnerTram() {', '  function makeDeliveryMicrovan() {')]) vm.runInContext(s, c);

  const data = c.BERLIN_VINTAGE_TRAM_DATA;
  assert.equal(data.finishRevision, 'reference-coach-v126');
  assert.equal(JSON.stringify(data), JSON.stringify(JSON.parse(fs.readFileSync(path.join(folder, 'berlin-vintage-tram-v90.json'), 'utf8'))),
    'embedded tram data equals the canonical JSON');
  const inline = vm.createContext({}); vm.runInContext(fs.readFileSync(path.join(folder, 'berlin-vintage-tram-v90.inline.js'), 'utf8'), inline);
  assert.equal(JSON.stringify(inline.BERLIN_VINTAGE_TRAM_DATA), JSON.stringify(data), 'inline script equals the canonical JSON');
  assert.deepEqual(JSON.parse(JSON.stringify(data.collisionContract)), { halfW: 1.25, halfD: 4, yMin: 0, yMax: 3.15 }, 'gameplay collider unchanged');
  for (const key of ['albedo', 'orm']) assert.ok(/^data:image\/(jpeg|png);base64,/.test(data.textures[key]), key + ' atlas is embedded');
  const glb = fs.readFileSync(path.join(folder, 'berlin-vintage-tram-v90.glb'));
  assert.equal(glb.readUInt32LE(0), 0x46546c67, 'native GLB source is present');

  const model = c.makeRunnerTram(); model.updateMatrixWorld(true);
  const roles = model.children.map(m => m.userData.tramRole);
  assert.deepEqual([...new Set(roles)].sort(), ['body', 'destination', 'glass', 'interior', 'interiorLight', 'lamp', 'roofLamp', 'tail']);
  const bounds = new T.Box3().setFromObject(model);
  assert.ok(bounds.min.x >= -1.25 && bounds.max.x <= 1.25 && bounds.min.z >= -4 && bounds.max.z <= 4, 'inside the 2.5 x 8 m footprint');
  assert.ok(bounds.min.y >= -1e-5 && bounds.max.y <= 4.52 && bounds.max.y > 4.3, 'tall pantograph inside the 4.52 m render envelope');
  let triangles = 0;
  for (const mesh of model.children) {
    const g = mesh.geometry, { position: p, normal: n, uv } = g.attributes;
    triangles += g.index.count / 3;
    for (let i = 0; i < p.count; i++) {
      assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i) + uv.getX(i) + uv.getY(i)));
      assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < .003, 'unit normals');
    }
    for (const index of g.index.array) assert.ok(index < p.count);
    if (mesh.userData.tramRole === 'body' || mesh.userData.tramRole === 'interior')
      for (let i = 0; i < uv.count; i++) assert.ok(uv.getX(i) >= 0 && uv.getX(i) <= 1 && uv.getY(i) >= 0 && uv.getY(i) <= 1, 'atlas UVs inside the sheet');
  }
  assert.ok(triangles <= 40000, 'V126 tram stays within its 40k-triangle budget: ' + triangles);

  const m = c.makeRunnerTram.materials;
  assert.ok(m.body.map && m.body.roughnessMap === m.body.metalnessMap && m.body.map !== m.body.roughnessMap, 'one baked atlas plus one ORM map');
  assert.ok(m.interior.emissiveMap === m.interior.map && m.interior.emissiveIntensity > 0, 'the cabin is lit from within');
  assert.ok(m.glass.transparent && !m.glass.depthWrite, 'glass is see-through and does not hide the cabin');
  assert.ok(m.lamp.color.r > 1.08 && m.roofLamp.color.r > 1.08, 'lamps burn above the bloom threshold');
  assert.ok(model.children.filter(o => o.castShadow).every(o => o.userData.tramRole === 'body'), 'only the coachwork casts the stable shadow');

  const ray = new T.Raycaster(), checks = [];
  function probe(origin, direction, role, label, opts = {}) {
    ray.set(new T.Vector3(...origin), new T.Vector3(...direction).normalize());
    const hits = ray.intersectObject(model, true).filter(h => !opts.skipGlass || h.object.userData.tramRole !== 'glass');
    const hit = hits[0];
    assert.ok(hit && hit.object.userData.tramRole === role, label + ' got ' + (hit && hit.object.userData.tramRole));
    checks.push({ origin, direction, role, label, point: hit.point.clone(), skipGlass: !!opts.skipGlass });
    return hit;
  }
  for (const end of [-1, 1]) {
    for (const x of [-.6, -.2, .25, .6]) for (const y of [1.75, 2.05, 2.35]) probe([x, y, end * 9], [0, 0, -end], 'glass', 'windscreen glass');
    // Low sight lines meet the lit seats; higher ones look down the aisle and out the far cab.
    for (const x of [-.6, .6]) probe([x, 1.75, end * 9], [0, 0, -end], 'interior', 'lit cabin behind the windscreen', { skipGlass: true });
    for (const x of [-.70, .70]) probe([x, .87, end * 9], [0, 0, -end], 'lamp', 'glowing headlamp');
    probe([0, 1.05, end * 9], [0, 0, -end], 'body', 'yellow nose panel');
    probe([0, 2.50, end * 9], [0, 0, -end], 'destination', 'destination roller inside the cab', { skipGlass: true });
  }
  for (const side of [-1, 1]) {
    for (const [z0, z1] of [[-1.74, -0.96], [-0.84, -0.06], [0.06, 0.84], [0.96, 1.74]]) {
      const z = (z0 + z1) / 2;
      for (const y of [1.80, 2.20]) probe([side * 6, y, z], [-side, 0, 0], 'glass', 'passenger window glass');
      // Each window frames one seat back (rows face away from the centre, backs 0.2 m outboard).
      probe([side * 6, 1.70, z + Math.sign(z) * .20], [-side, 0, 0], 'interior', 'seat backs through the passenger window', { skipGlass: true });
    }
    for (const z of [-2.35, 2.35]) probe([side * 6, 1.95, z + .15], [-side, 0, 0], 'glass', 'door glazing');
    for (const z of [-3.0, -1.35, 1.35, 3.0]) probe([side * 6, 1.05, z], [-side, 0, 0], 'body', 'side coachwork below the belt');
  }
  const roof = probe([0, 6, -1.6], [0, -1, 0], 'body', 'dark roof equipment box');
  assert.ok(roof.point.y > 3.2 && roof.point.y < 3.4, 'raised roof box');

  c.compactStaticPropGroup(model, { skipTransparent: true }); model.updateMatrixWorld(true);
  assert.ok(model.children.length <= 8, 'at most eight material batches: ' + model.children.length);
  for (const p of checks) {
    ray.set(new T.Vector3(...p.origin), new T.Vector3(...p.direction).normalize());
    const hit = ray.intersectObject(model, true).filter(h => !p.skipGlass || h.object.userData.tramRole !== 'glass' && h.object.material !== m.glass)[0];
    assert.ok(hit && hit.point.distanceTo(p.point) < 2e-5, 'batching preserves ' + p.label);
  }
  c.registerProp = (_, g) => { c.compactStaticPropGroup(g); return g; };
  const second = c.makeRunnerTram(), clone = second.clone(true);
  assert.ok(second.children.every((mesh, i) => mesh.material === second.children[i].material));
  assert.ok(clone.children.every((mesh, i) => mesh.geometry === second.children[i].geometry && mesh.material === second.children[i].material),
    'pooled clones share geometry and materials');
  const result = { passed: true, shipping, triangles, draws: model.children.length, visibilityRays: checks.length,
    collisionContract: JSON.parse(JSON.stringify(data.collisionContract)), bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } };
  if (fs.existsSync(stage)) fs.writeFileSync(path.join(stage, shipping ? 'shipping-check.json' : 'geometry-check.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  return result;
}
module.exports = check; if (require.main === module) check();
