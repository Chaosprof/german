'use strict';
// V152 reference vehicles: test the real runtime factories of the tram, car,
// van and bus, their materials, footprints, budgets and pooling, the shared
// quantised mesh decoder and the vehicle ink mask in the post composite.
// node tools/check_berlin_vehicles_v152.cjs [--shipping]
//   default: audit/berlin-vehicles-v152/candidate.html; --shipping: berlin-runner.html
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');

function check(shipping = process.argv.includes('--shipping'), htmlOverride) {
  const root = path.resolve(__dirname, '..'), stage = path.join(root, 'audit/berlin-vehicles-v152');
  const pagePath = htmlOverride || (shipping ? path.join(root, 'berlin-runner.html') : path.join(stage, 'candidate.html'));
  const html = fs.readFileSync(pagePath, 'utf8');
  function section(a, b) {
    const i = html.indexOf(a), j = html.indexOf(b, i + a.length);
    assert.ok(i >= 0 && j > i, 'section ' + a.slice(0, 60));
    return html.slice(i, j);
  }
  const c = vm.createContext({ console });
  vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m => m[1].includes('three.js r156 (MIT)'))[1], c);
  const T = c.THREE;
  c.atob = s => Buffer.from(s, 'base64').toString('binary');
  c.clamp = T.MathUtils.clamp;
  c.mat = (color, options) => new T.MeshStandardMaterial({ color, ...options });
  c.applyCelShading = m => m;
  c.MAT = new Proxy({}, { get(t, k) { return t[k] || (t[k] = c.mat(0x72899a)); } });
  c.PROP_TAIL = new T.MeshBasicMaterial({ color: 0xff4d3d });
  c.destRollMat = new T.MeshBasicMaterial({ map: new T.Texture() });
  c.freezeObjectTree = g => g.updateMatrixWorld(true);
  c.registerProp = (_, g) => g;

  // The page's decoder is the canonical tools copy, which knows quantised records.
  const decoderPage = section('// Small, synchronous decoder for Blender-exported static mesh records.', '\n\n// Embed berlin-kiez-garden');
  const decoderTools = fs.readFileSync(path.join(__dirname, 'berlin_packed_geometry.js'), 'utf8').replace(/\nif \(typeof module[^\n]*\n?$/, '').trimEnd();
  assert.equal(decoderPage, decoderTools, 'the page decoder equals tools/berlin_packed_geometry.js');
  assert.ok(decoderPage.includes('record.positionQ') && decoderPage.includes('record.uvQ'), 'decoder expands quantised records');
  vm.runInContext(decoderTools, c);

  // Vehicle environment, ink mask, shared lamp/glass helpers.
  const envSrc = fs.readFileSync(path.join(__dirname, 'berlin_vehicle_env_v152.js'), 'utf8');
  assert.ok(html.includes(envSrc), 'the page embeds tools/berlin_vehicle_env_v152.js unchanged');
  vm.runInContext(envSrc, c);
  assert.equal(c.vehicleEnvTexture(), null, 'no renderer in node: the env helper stays inert');
  assert.ok(html.includes("'float vehicleInkMask(vec2 uv, float centreA){',") &&
    html.includes("'  if (edge > 0.0) edge *= vehicleInkMask(vUv, mid.a);',"), 'the composite drops ink on vehicle pixels');
  assert.ok(fs.existsSync(path.join(root, 'assets/img/berlin-street-env-v1.jpg')), 'street reflection panorama is shipped');
  const env = fs.readFileSync(path.join(root, 'assets/img/berlin-street-env-v1.jpg'));
  let w = 0, h = 0;
  for (let i = 2; i < env.length;) {           // JPEG SOF scan for the pixel size
    const len = env.readUInt16BE(i + 2), marker = env[i + 1];
    if (marker >= 0xc0 && marker <= 0xc3) { h = env.readUInt16BE(i + 5); w = env.readUInt16BE(i + 7); break; }
    i += 2 + len;
  }
  assert.deepEqual([w, h], [1024, 512], 'the panorama matches the PMREM refill layout (1024 x 512)');

  for (const s of [section('  var geoCache = Object.create(null);', '  // ------------------------------------------------- generated prop swaps'),
    section('  function mergeBoxes(specs) {', '\n  // DRAW-CALL CONSOLIDATION:'),
    section('  var staticMergeGeometryCache = new Map();', '  // Merges building parts that carry different materials'),
    section('  // BEGIN BLENDER KIEZ CAR BODY', '  // END BLENDER KIEZ CAR BODY'),
    section('  function makeCar(colorHex) {', '\n  // BVG double-decker'),
    section('  // BEGIN BLENDER REFERENCE BUS', '  // END BLENDER REFERENCE BUS'),
    section('  function makeBus() {', '\n  // Ampelm'),
    section('  // BEGIN BLENDER VINTAGE TRAM', '  // END BLENDER VINTAGE TRAM'),
    section('  function makeRunnerTram() {', '  // BEGIN BLENDER REFERENCE VAN'),
    section('  // BEGIN BLENDER REFERENCE VAN', '  // END BLENDER REFERENCE VAN'),
    section('  function makeDeliveryMicrovan() {', '  function makeRoadworksCar(templateIndex) {')]) vm.runInContext(s, c);

  const specs = {
    tram: { data: c.BERLIN_REFERENCE_TRAM_DATA, rev: 'reference-kt4-v152', make: () => c.makeRunnerTram(), roleKey: 'tramRole',
      roles: ['body', 'destination', 'glass', 'interior', 'interiorLight', 'lamp', 'roofLamp', 'tail'],
      box: [1.25, 5.0, 4.0], minTop: 4.8, budget: 56000, json: 'tram/models/berlin-reference-tram-v152.json',
      contract: { halfW: 1.25, halfD: 4, yMin: 0, yMax: 3.15 } },
    car: { data: c.BERLIN_REFERENCE_CAR_DATA, rev: 'reference-trabant-v152', make: () => c.makeCar(0x3e7faa), roleKey: 'carRole',
      roles: ['amber', 'glass', 'lamp', 'paint', 'tail', 'trim'], box: [1.0, 1.95, 2.1], minTop: 1.55, budget: 30000,
      json: 'car/models/berlin-reference-car-v152.json', contract: { halfW: 1, halfD: 2.1, yMin: 0, yMax: 1.95 } },
    van: { data: c.BERLIN_REFERENCE_VAN_DATA, rev: 'reference-barkas-v152', make: () => c.makeDeliveryMicrovan(), roleKey: 'vanRole',
      roles: ['amber', 'body', 'glass', 'lamp', 'tail'], box: [1.0, 1.95, 2.1], minTop: 1.85, budget: 30000,
      json: 'van/models/berlin-reference-van-v152.json', contract: { halfW: 1, halfD: 2.1, yMin: 0, yMax: 1.95 } },
    bus: { data: c.BERLIN_REFERENCE_BUS_DATA, rev: 'reference-sd202-v152', make: () => c.makeBus(), roleKey: 'busRole',
      roles: ['body', 'destination', 'glass', 'interior', 'interiorLight', 'lamp', 'tail'], box: [1.45, 3.95, 5.56], minTop: 3.8,
      budget: 38000, json: 'bus/models/berlin-reference-bus-v152.json' },
  };
  // Gameplay colliders are untouched: the page still declares the same obstacle kinds.
  assert.ok(html.includes("{ name: 'car',      kind: 'block', build: makeRoadworksCar, halfW: 1.00,         halfD: 2.10, yMin: 0,    yMax: 1.95 },"),
    'car collider unchanged');
  assert.ok(html.includes("{ name: 'tram',     kind: 'block', build: makeRunnerTram,   halfW: 1.25,         halfD: 4.00, yMin: 0,    yMax: 3.15 }"),
    'tram collider unchanged');

  const report = { passed: true, page: path.relative(root, pagePath), vehicles: {} };
  for (const [name, s] of Object.entries(specs)) {
    assert.ok(s.data, name + ' data is embedded');
    assert.equal(s.data.finishRevision, s.rev, name + ' revision');
    const canonical = path.join(shipping ? path.join(root, 'assets/models') : path.join(stage, name === 'tram' ? 'tram/models' : name + '/models'),
      path.basename(s.json));
    // Compare normalised JSON text: Python writes -0.0 where the page round-trips 0.
    assert.equal(JSON.stringify(s.data), JSON.stringify(JSON.parse(fs.readFileSync(canonical, 'utf8'))),
      name + ' embedded data equals ' + path.relative(root, canonical));
    if (s.contract) assert.deepEqual(JSON.parse(JSON.stringify(s.data.collisionContract)), s.contract, name + ' collision contract');
    for (const rec of Object.values(s.data.meshes)) assert.ok(rec.positionQ && rec.qCenter && rec.qHalf, name + ' meshes are quantised');
    const model = s.make();
    model.updateMatrixWorld(true);
    const roles = [...new Set(model.children.map(m => m.userData[s.roleKey]))].sort();
    assert.deepEqual(roles, s.roles, name + ' runtime roles');
    const bounds = new T.Box3().setFromObject(model);
    assert.ok(bounds.min.x >= -s.box[0] - 1e-4 && bounds.max.x <= s.box[0] + 1e-4, name + ' width inside footprint ' + bounds.max.x);
    assert.ok(bounds.min.z >= -s.box[2] - 1e-4 && bounds.max.z <= s.box[2] + 1e-4, name + ' length inside footprint ' + bounds.max.z);
    assert.ok(bounds.min.y >= -1e-4 && bounds.max.y <= s.box[1] + 1e-4 && bounds.max.y >= s.minTop, name + ' height ' + bounds.max.y);
    let triangles = 0;
    for (const mesh of model.children) {
      const g = mesh.geometry, { position: p, normal: n, uv } = g.attributes;
      triangles += g.index.count / 3;
      for (let i = 0; i < p.count; i++) {
        assert.ok(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)), name + ' finite positions');
        assert.ok(Math.abs(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)) - 1) < .004, name + ' unit normals');
      }
      for (const index of g.index.array) assert.ok(index < p.count, name + ' index in range');
      const atlas = ['body', 'interior', 'paint', 'trim'].includes(mesh.userData[s.roleKey]);
      if (atlas) for (let i = 0; i < uv.count; i++)
        assert.ok(uv.getX(i) >= -1e-4 && uv.getX(i) <= 1.0001 && uv.getY(i) >= -1e-4 && uv.getY(i) <= 1.0001, name + ' atlas UVs inside the sheet');
    }
    assert.ok(triangles <= s.budget, name + ' triangle budget ' + triangles);
    // Materials: lacquer, reflections, lamps above the bloom threshold, no ink.
    const byRole = r => model.children.find(m => m.userData[s.roleKey] === r).material;
    const paint = byRole(name === 'car' ? 'paint' : 'body');
    assert.ok(paint.isMeshPhysicalMaterial && paint.clearcoat === 1 && paint.clearcoatMap && paint.roughnessMap && paint.metalnessMap,
      name + ' paint is a clearcoated physical material with its surface map');
    assert.ok(paint.customProgramCacheKey().startsWith('vehicle-ink-mask|'), name + ' paint writes the vehicle ink mask');
    const glass = byRole('glass');
    assert.ok(glass.transparent && !glass.depthWrite && glass.blendDstAlpha === T.OneFactor && glass.blendSrcAlpha === T.ZeroFactor,
      name + ' glass blends over the cabin and keeps the mask alpha');
    assert.equal(glass.customProgramCacheKey(), 'vehicle-street-glass-v152', name + ' glass shares the street-glass program');
    const lamp = byRole('lamp');
    assert.ok(lamp.isMeshBasicMaterial && lamp.map && Math.max(lamp.color.r, lamp.color.g) > 1.0, name + ' lamps glow above 1.0');
    // Pooled clones share geometry and materials (no per-clone JSON of textures).
    const clone = model.clone(true);
    assert.ok(clone.children.every((mesh, i) => mesh.geometry === model.children[i].geometry && mesh.material === model.children[i].material),
      name + ' clones share geometry and materials');
    if (name === 'car') {
      assert.ok(model.userData.bodyMat === paint && !Object.keys(model.userData).includes('bodyMat'),
        'car paint handle is reachable but kept out of userData JSON');
      assert.equal(paint.color.getHex(), 0x3e7faa, 'car paint takes the requested colour');
      const white = c.makeCar(0xffffff);
      assert.ok(white.userData.bodyMat !== paint && white.userData.trimMat === model.userData.trimMat, 'each car owns its paint, trims are shared');
    }
    report.vehicles[name] = { triangles, draws: model.children.length, bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() } };
  }
  // Silhouette probes: rays from typical chase angles hit the intended surfaces.
  const ray = new T.Raycaster();
  function first(model, key, origin, dir, skipGlass) {
    ray.set(new T.Vector3(...origin), new T.Vector3(...dir).normalize());
    const hit = ray.intersectObject(model, true).filter(h => !skipGlass || h.object.userData[key] !== 'glass')[0];
    return hit && hit.object.userData[key];
  }
  const tram = c.makeRunnerTram(); tram.updateMatrixWorld(true);
  for (const x of [-.6, 0, .6]) for (const y of [1.7, 2.2, 2.6]) assert.equal(first(tram, 'tramRole', [x, y, -9], [0, 0, 1]), 'glass', 'tall windscreen at ' + [x, y]);
  assert.equal(first(tram, 'tramRole', [0, 1.0, -9], [0, 0, 1]), 'body', 'yellow nose under the windscreen');
  for (const x of [-.72, .72]) assert.equal(first(tram, 'tramRole', [x, .745, -9], [0, 0, 1]), 'lamp', 'low headlamp');
  assert.equal(first(tram, 'tramRole', [0, 3.085, -9], [0, 0, 1]), 'roofLamp', 'amber route lamp on the cap');
  assert.equal(first(tram, 'tramRole', [0, .34, -9], [0, 0, 1]), 'body', 'chunky bumper');
  const roofHit = (ray.set(new T.Vector3(0, 8, -.5), new T.Vector3(0, -1, 0)), ray.intersectObject(tram, true)[0]);
  assert.ok(roofHit && roofHit.point.y > 3.5 && roofHit.point.y < 3.7, 'charcoal roof box stands above the roof');
  const pan = (ray.set(new T.Vector3(.5, 8, -1.72), new T.Vector3(0, -1, 0)), ray.intersectObject(tram, true)[0]);
  assert.ok(pan && pan.point.y > 4.8, 'T-shaped pantograph head spans the roof');
  for (const z of [-1.28, -.10, 1.08]) assert.equal(first(tram, 'tramRole', [6, 2.0, z], [-1, 0, 0]), 'glass', 'side window at ' + z);
  assert.equal(first(tram, 'tramRole', [6, .9, -1.5], [-1, 0, 0]), 'body', 'yellow side under the windows');
  const car = c.makeCar(0xc95645); car.updateMatrixWorld(true);
  assert.equal(first(car, 'carRole', [0, 1.3, 9], [0, 0, -1]), 'glass', 'car windscreen');
  for (const x of [-.6, .6]) assert.equal(first(car, 'carRole', [x, .74, 9], [0, 0, -1]), 'lamp', 'car headlamp');
  assert.equal(first(car, 'carRole', [0, .47, 9], [0, 0, -1]), 'trim', 'chrome front bumper');
  assert.equal(first(car, 'carRole', [5, 1.25, .2], [-1, 0, 0]), 'glass', 'car door window');
  assert.equal(first(car, 'carRole', [5, .36, 1.28], [-1, 0, 0]), 'trim', 'wheel in its well');
  const rim = (ray.set(new T.Vector3(5, .36, 1.28), new T.Vector3(-1, 0, 0)), ray.intersectObject(car, true)[0]);
  assert.ok(rim && rim.face.normal.clone().transformDirection(rim.object.matrixWorld).x > 0, 'rim faces outward (visible under back-face culling)');
  const van = c.makeDeliveryMicrovan(); van.updateMatrixWorld(true);
  assert.equal(first(van, 'vanRole', [.5, 1.4, 9], [0, 0, -1]), 'glass', 'van windscreen');
  assert.equal(first(van, 'vanRole', [0, .64, 9], [0, 0, -1]), 'body', 'van grille band');
  const bus = c.makeBus(); bus.updateMatrixWorld(true);
  assert.equal(first(bus, 'busRole', [.5, 1.6, 12], [0, 0, -1]), 'glass', 'bus lower windscreen');
  assert.equal(first(bus, 'busRole', [0, 2.47, 12], [0, 0, -1], true), 'destination', 'bus destination display');
  assert.equal(first(bus, 'busRole', [4, 3.1, -1.9], [-1, 0, 0]), 'glass', 'bus upper deck window');
  report.probes = 'ok';
  if (fs.existsSync(stage)) fs.writeFileSync(path.join(stage, shipping ? 'shipping-check.json' : 'candidate-check.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
  return report;
}
module.exports = check;
if (require.main === module) check();
