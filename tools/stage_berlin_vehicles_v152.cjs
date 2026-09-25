'use strict';
// Stage the V152 reference vehicles into a candidate page (and optionally install it).
// node tools/stage_berlin_vehicles_v152.cjs [--install]
// Inputs:
//   audit/berlin-vehicles-v152/tram/models/berlin-reference-tram-v152.inline.js
//     (tools/stage_berlin_tram_v152.py in Blender + tools/finish_berlin_tram_v152.py)
//   audit/berlin-vehicles-v152/car/models/berlin-reference-car-v152.inline.js (optional)
//     (tools/stage_berlin_car_v152.py in Blender + tools/finish_berlin_car_v152.py)
//   tools/berlin_vehicle_env_v152.js, tools/berlin_tram_v152_factory.js,
//   tools/berlin_car_v152_factory.js (optional)
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), vm = require('vm');
const root = path.resolve(__dirname, '..'), stage = path.join(root, 'audit/berlin-vehicles-v152');
const baseline = path.join(stage, 'baseline.html');
if (!fs.existsSync(baseline)) fs.copyFileSync(path.join(root, 'berlin-runner.html'), baseline);
let h = fs.readFileSync(baseline, 'utf8');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
function once(hay, needle, label) {
  const i = hay.indexOf(needle);
  assert.ok(i >= 0 && hay.indexOf(needle, i + 1) < 0, 'exactly one anchor: ' + label);
  return i;
}

// 1. Shared street reflection for every vehicle, right after the scene probe.
const envAnchor = '\n  buildFinishEnvironment();\n';
const e0 = once(h, envAnchor, 'buildFinishEnvironment call') + envAnchor.length;
h = h.slice(0, e0) + '\n' + read('tools/berlin_vehicle_env_v152.js') + h.slice(e0);

// 1b. The shared mesh decoder learns the V152 quantised records (tools copy is canonical).
const d0 = once(h, '// Small, synchronous decoder for Blender-exported static mesh records.', 'mesh decoder');
const d1 = h.indexOf('\n\n// Embed berlin-kiez-garden', d0);
assert.ok(d1 > d0, 'decoder is followed by the garden kit');
h = h.slice(0, d0) + read('tools/berlin_packed_geometry.js').replace(/\nif \(typeof module[^\n]*\n?$/, '').trimEnd() + h.slice(d1);

// 1c. Static batching read normals with a raw array copy. Blender records carry
// normalized int16 normals, so a merged V152 bus body kept 32767-length normals
// (the shader renormalised them, but warm-up could not compact them). Copy the
// real values for any normalized or non-float source; float data is unchanged.
const mergeAnchor = '      nor.set(g.attributes.normal.array, o * 3);\n';
assert.equal(h.split(mergeAnchor).length, 3, 'mergeBoxes and mergeCoreParts normal copies');
h = h.split(mergeAnchor).join([
  '      var srcNormal = g.attributes.normal;',
  '      if (srcNormal.normalized || !(srcNormal.array instanceof Float32Array)) {',
  '        for (var ni = 0; ni < srcNormal.count; ni++) {',
  '          nor[(o + ni) * 3] = srcNormal.getX(ni); nor[(o + ni) * 3 + 1] = srcNormal.getY(ni);',
  '          nor[(o + ni) * 3 + 2] = srcNormal.getZ(ni);',
  '        }',
  '      } else nor.set(srcNormal.array, o * 3);', ''].join('\n'));

// 2. Tram data and factory.
const a = once(h, '  // BEGIN BLENDER VINTAGE TRAM', 'tram data begin');
const b = h.indexOf('  // END BLENDER VINTAGE TRAM', a);
assert.ok(b > a, 'tram data end');
h = h.slice(0, a) + '  // BEGIN BLENDER VINTAGE TRAM\n' +
  read('audit/berlin-vehicles-v152/tram/models/berlin-reference-tram-v152.inline.js') + h.slice(b);
const f0 = once(h, '  function makeRunnerTram() {', 'makeRunnerTram');
const f1 = h.indexOf('  function makeDeliveryMicrovan() {', f0);
assert.ok(f1 > f0, 'makeDeliveryMicrovan follows makeRunnerTram');
h = h.slice(0, f0) + read('tools/berlin_tram_v152_factory.js') + h.slice(f1);

// 3. Cars (when built).
const carData = 'audit/berlin-vehicles-v152/car/models/berlin-reference-car-v152.inline.js';
if (fs.existsSync(path.join(root, carData)) && fs.existsSync(path.join(root, 'tools/berlin_car_v152_factory.js'))) {
  const c0 = once(h, '  // BEGIN BLENDER KIEZ CAR BODY', 'car data begin');
  const c1 = h.indexOf('  // END BLENDER KIEZ CAR BODY', c0);
  assert.ok(c1 > c0, 'car data end');
  h = h.slice(0, c0) + '  // BEGIN BLENDER KIEZ CAR BODY\n' + read(carData) + h.slice(c1);
  const m0 = once(h, '  function makeCar(colorHex) {', 'makeCar');
  const m1 = h.indexOf('\n  // BVG double-decker', m0);
  assert.ok(m1 > m0, 'makeBus comment follows makeCar');
  // Keep the comment line that precedes makeCar in the baseline.
  h = h.slice(0, m0) + read('tools/berlin_car_v152_factory.js') + h.slice(m1);
  const busData = 'audit/berlin-vehicles-v152/bus/models/berlin-reference-bus-v152.inline.js';
  const busFactory = 'tools/berlin_bus_v152_factory.js';
  if (fs.existsSync(path.join(root, busData)) && fs.existsSync(path.join(root, busFactory))) {
    const b0 = once(h, '  function makeBus() {', 'makeBus');
    const b1 = h.indexOf('\n  // Ampelm', b0);
    assert.ok(b1 > b0, 'the Ampelmaennchen block follows makeBus');
    h = h.slice(0, b0) + '  // BEGIN BLENDER REFERENCE BUS\n' + read(busData) + '  // END BLENDER REFERENCE BUS\n' +
      read(busFactory) + h.slice(b1);
  }
  const v0 = h.indexOf('  function makeDeliveryMicrovan() {');
  const v1 = h.indexOf('  function makeRoadworksCar(templateIndex) {', v0);
  const vanFactory = 'tools/berlin_van_v152_factory.js';
  const vanData = 'audit/berlin-vehicles-v152/van/models/berlin-reference-van-v152.inline.js';
  if (v0 > 0 && v1 > v0 && fs.existsSync(path.join(root, vanFactory)) && fs.existsSync(path.join(root, vanData)))
    h = h.slice(0, v0) + '  // BEGIN BLENDER REFERENCE VAN\n' + read(vanData) + '  // END BLENDER REFERENCE VAN\n' +
      read(vanFactory) + h.slice(v1);
}

// 4. Vehicle ink mask in the post composite (vehicles write scene alpha 0).
const compAnchor = "        'void main(){',\n        '  vec2 d = vUv - 0.5;',";
once(h, compAnchor, 'composite main');
h = h.replace(compAnchor, [
  "        // V152: vehicles (tram and cars) write alpha 0 into the scene target.",
  "        // The reference draws them as smooth lacquered models with soft",
  "        // shading and no ink, so the line is dropped on and around them.",
  "        'float vehicleInkMask(vec2 uv, float centreA){',",
  "        '  vec2 o = uOutlineTexel * uOutlineWidth * 1.6;',",
  "        '  float m = min(centreA, texture2D(tScene, uv + vec2(o.x, 0.0)).a);',",
  "        '  m = min(m, texture2D(tScene, uv - vec2(o.x, 0.0)).a);',",
  "        '  m = min(m, texture2D(tScene, uv + vec2(0.0, o.y)).a);',",
  "        '  m = min(m, texture2D(tScene, uv - vec2(0.0, o.y)).a);',",
  "        '  return clamp(m, 0.0, 1.0);',",
  "        '}',", ''].join('\n') + compAnchor);
const edgeAnchor = "        '  float edge = outlineEdge(vUv, centerDist, centerNormal);',";
once(h, edgeAnchor, 'composite edge');
h = h.replace(edgeAnchor, edgeAnchor + "\n        '  if (edge > 0.0) edge *= vehicleInkMask(vUv, mid.a);',");

h = h.replace(/canvas\.dataset\.graphicsRevision = 'kiez-reference-v\d+';/, "canvas.dataset.graphicsRevision = 'kiez-reference-v152';");
for (const s of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(s[1]);
fs.writeFileSync(path.join(stage, 'candidate.html'), h);
if (process.argv.includes('--install')) {
  const models = path.join(root, 'assets/models');
  for (const [dir, prefix] of [['tram', 'berlin-reference-tram-v152'], ['car', 'berlin-reference-car-v152'], ['van', 'berlin-reference-van-v152'], ['bus', 'berlin-reference-bus-v152']]) {
    for (const ext of ['blend', 'glb', 'json', 'inline.js']) {
      const src = path.join(stage, dir, 'models', prefix + '.' + ext);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(models, prefix + '.' + ext));
    }
  }
  fs.writeFileSync(path.join(root, 'berlin-runner.html'), h);
  const sw = path.join(root, 'sw.js');
  let swSrc = fs.readFileSync(sw, 'utf8').replace(/artikel-blitz-v\d+/, 'artikel-blitz-v152');
  if (!swSrc.includes('./assets/img/berlin-street-env-v1.jpg'))
    swSrc = swSrc.replace('  "./assets/img/berlin-summer-sky-v1.png",\n', '  "./assets/img/berlin-summer-sky-v1.png",\n  "./assets/img/berlin-street-env-v1.jpg",\n');
  fs.writeFileSync(sw, swSrc);
}
console.log('V152 vehicles staged' + (process.argv.includes('--install') ? ' and installed' : '') +
  ' (' + (fs.statSync(path.join(stage, 'candidate.html')).size / 1e6).toFixed(2) + ' MB)');
