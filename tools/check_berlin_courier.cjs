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
const glb = fs.readFileSync(path.join(root, 'assets/models/berlin-runner-hero-v13.glb'));
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
geometry.setAttribute('normal', attribute(primitive.attributes.NORMAL));
geometry.setAttribute('skinIndex', attribute(primitive.attributes.JOINTS_0));
geometry.setAttribute('skinWeight', attribute(primitive.attributes.WEIGHTS_0));
const mesh = new T.SkinnedMesh(geometry, new T.MeshStandardMaterial());
mesh.bind(skeleton, new T.Matrix4());
const before = Buffer.from(geometry.attributes.position.array.buffer).toString('base64');
const refineStart = html.indexOf('  function refineCourierSilhouette(mesh) {');
const refineEnd = html.indexOf('\n  // Both arms share', refineStart);
const refine = new Function('THREE', html.slice(refineStart, refineEnd) + '\nreturn refineCourierSilhouette;')(T);
const originalBones = skeleton.bones.map(b => b.matrixWorld.elements.slice());
assert.equal(refine(mesh), true);
assert.notEqual(mesh.geometry, geometry, 'refinement owns a render copy');
assert.equal(mesh.geometry.attributes.position.count, geometry.attributes.position.count, 'no extra skinned vertices');
assert.deepEqual(Array.from(mesh.geometry.attributes.skinWeight.array), Array.from(geometry.attributes.skinWeight.array));
assert.deepEqual(Array.from(mesh.geometry.attributes.skinIndex.array), Array.from(geometry.attributes.skinIndex.array));
assert.deepEqual(skeleton.bones.map(b => b.matrixWorld.elements.slice()), originalBones, 'joint lengths and bind pose stay intact');
const sleeveVertices = {Left: 0, Right: 0};
const soleVertices = {Left: 0, Right: 0};
const garmentVertices = {Left:0, Right:0, Hem:0};
const garmentProbes = [];
const garment = mesh.geometry.attributes.aCourierGarment;
const smooth = (low, high, value) => T.MathUtils.smoothstep(value, low, high);
for (let v = 0; v < mesh.geometry.attributes.position.count; v++) {
  for (let c = 0; c < 3; c++) {
    assert.ok(Number.isFinite(mesh.geometry.attributes.position.getComponent(v, c)));
    assert.ok(Number.isFinite(mesh.geometry.attributes.normal.getComponent(v, c)));
  }
  const sleeve = mesh.geometry.attributes.aCourierSleeve.getX(v);
  const soleMask = mesh.geometry.attributes.aCourierSole.getX(v);
  const soleLength = mesh.geometry.attributes.aCourierSole.getY(v);
  const hem = smooth(-0.180, -0.165, garment.getX(v)) * (1 - smooth(-0.115, -0.105, garment.getX(v)));
  const cuff = smooth(0.006, 0.012, garment.getY(v)) * (1 - smooth(0.052, 0.060, garment.getY(v))) * smooth(0.12, 0.78, sleeve);
  assert.ok([garment.getX(v), garment.getY(v), hem, cuff].every(Number.isFinite));
  if (garment.getX(v) >= -0.105) assert.equal(hem, 0, 'jacket above the actual bottom band stays red');
  if (garment.getY(v) < 0.006 || garment.getY(v) > 0.060) assert.equal(cuff, 0, 'cuffs stay on the wrist end of the sleeve');
  if (hem > 0.65) garmentVertices.Hem++;
  if (cuff > 0.65) garmentVertices[geometry.attributes.position.getX(v) > 0 ? 'Left' : 'Right']++;
  if (hem > 0.65 || cuff > 0.65) garmentProbes.push(v);
  assert.ok(sleeve >= 0 && sleeve <= 1);
  assert.ok(soleMask >= 0 && soleMask <= 1 && soleLength >= 0 && soleLength <= 1.000001);
  const sideFootWeights = {Left:0, Right:0};
  for (let c = 0; c < 4; c++) {
    const name = skeleton.bones[geometry.attributes.skinIndex.getComponent(v, c)].name;
    if (/^(Left|Right)(Foot|ToeBase)$/.test(name)) {
      sideFootWeights[name.startsWith('Left') ? 'Left' : 'Right'] += geometry.attributes.skinWeight.getComponent(v, c);
    }
  }
  for (const side of ['Left', 'Right']) if (sideFootWeights[side] > 0.95 && soleMask > 0.7) soleVertices[side]++;
  if (geometry.attributes.position.getY(v) > 0.041 || geometry.attributes.normal.getY(v) >= -0.26) {
    assert.equal(soleMask, 0, 'ankles, uppers and vertical midsole walls retain their original colour');
  }
  for (let c = 0; c < 4; c++) {
    const name = skeleton.bones[geometry.attributes.skinIndex.getComponent(v, c)].name;
    if (geometry.attributes.skinWeight.getComponent(v, c) > 0.9) {
      if (/Hand$/.test(name)) assert.equal(cuff, 0, 'hand skin is not repainted by cuff trim');
    }
    if (geometry.attributes.skinWeight.getComponent(v, c) < 0.99) continue;
    if (/^(Left|Right)(Arm|ForeArm)$/.test(name)) {
      assert.ok(sleeve > 0.99, 'both full sleeves receive the same tint');
      sleeveVertices[name.startsWith('Left') ? 'Left' : 'Right']++;
    }
    if (/^(Left|Right)(Foot|ToeBase)$/.test(name) && geometry.attributes.position.getY(v) < 0.02) {
      assert.ok(Math.abs(mesh.geometry.attributes.position.getY(v) - geometry.attributes.position.getY(v)) < 1e-6, 'shoe sole heights stay anchored');
    }
  }
}
assert.ok(sleeveVertices.Left > 100 && sleeveVertices.Right > 100, 'both sleeves are present on the actual asset');
assert.ok(soleVertices.Left > 30 && soleVertices.Right > 30, 'both actual shoe undersides receive readable rubber coverage');
assert.ok(garmentVertices.Left > 25 && garmentVertices.Right > 25 && garmentVertices.Hem > 60,
  'both cuffs and the geometric hem region have actual-mesh coverage');
const sleeveStart = html.indexOf('  function courierSleeveMaterial(material) {');
const sleeveEnd = html.indexOf('\n  // Dress the authored rig', sleeveStart);
const finishMaterial = new Function('THREE', html.slice(sleeveStart, sleeveEnd) + '\nreturn courierSleeveMaterial;')(T);
const finish = new T.MeshStandardMaterial();
let previousShaderCalls = 0;
finish.onBeforeCompile = () => previousShaderCalls++;
finish.customProgramCacheKey = () => 'existingHeroShader';
finishMaterial(finish);
const shader = { uniforms:{}, vertexShader:T.ShaderLib.standard.vertexShader, fragmentShader:T.ShaderLib.standard.fragmentShader };
finish.onBeforeCompile(shader);
assert.equal(previousShaderCalls, 1, 'costume/lighting shader chain remains intact');
assert.equal((shader.vertexShader.match(/attribute vec2 aCourierSole;/g) || []).length, 1);
assert.ok(shader.vertexShader.includes('vCourierSole = aCourierSole;'));
assert.ok(shader.fragmentShader.includes('fract(vCourierSole.y * 5.0)'));
assert.ok(shader.fragmentShader.includes('diffuseColor.rgb = mix(diffuseColor.rgb, courierRubber'));
assert.ok(shader.uniforms.courierSoleColor.value.isColor && shader.uniforms.courierTreadColor.value.isColor);
assert.ok(shader.uniforms.courierHemColor.value.isColor);
assert.equal((shader.vertexShader.match(/attribute vec2 aCourierGarment;/g) || []).length, 1);
assert.ok(shader.vertexShader.includes('vCourierGarment = aCourierGarment;'));
assert.ok(shader.fragmentShader.includes('max(courierHem, courierCuff)'));
assert.ok(finish.customProgramCacheKey().includes('existingHeroShader'));
assert.equal((shader.fragmentShader.match(/texture2D\(/g) || []).length,
  (T.ShaderLib.standard.fragmentShader.match(/texture2D\(/g) || []).length, 'sole adds no texture fetch');
// Exterior rear rays and the exact atlas pixels they hit: a previous hem
// counted 103 valid vertices but sat 18 cm above the real clothing boundary.
// Pin the shipped WebP. compress_hero_webp.py --check proves every decoded
// pixel equals the source PNG used to inspect these clothing-boundary samples.
const atlasView = doc.bufferViews[doc.images[0].bufferView];
const atlasBytes = bin.subarray(atlasView.byteOffset || 0, (atlasView.byteOffset || 0) + atlasView.byteLength);
assert.equal(require('crypto').createHash('sha256').update(atlasBytes).digest('hex'),
  '58e9a306e45f40c4a87ce91cc353b7ccc9bf994bf3e378649767d40d46e133ed');
const rearAtlasSamples = [
  [-.12,.74,.8647033159,.9166491219,70,97,150], [-.12,.77,.8693019857,.9393699763,53,55,55],
  [-.06,.74,.9023640694,.9143857415,77,100,144],[-.06,.77,.9067074072,.9403628690,53,53,55],
  [0,.74,.3710580190,.4011831167,71,101,147], [0,.77,.3743887547,.3601183231,55,55,57],
  [.06,.74,.3421097308,.3954332502,70,99,147],[.06,.77,.3469207298,.3649936617,51,52,53],
  [.12,.74,.3043661897,.3921360271,67,98,149],[.12,.77,.3134658045,.3638007194,52,55,56]
];
let samplePixel;
const fakeDocument = {createElement: () => ({getContext: () => ({
  drawImage: () => {}, getImageData: () => ({data:samplePixel}), putImageData: () => {}
})})};
const recolorStart = html.indexOf('  var HERO_GARMENT_SAT =');
const recolorEnd = html.indexOf('  function buildHeroCostume', recolorStart);
const recolorSample = new Function('document', html.slice(recolorStart, recolorEnd) + '\nreturn recolourHeroGarment;')(fakeDocument);
const clothExpression = shader.fragmentShader.match(/float courierCloth = ([^;]+);/)[1];
const hemExpression = shader.fragmentShader.match(/float courierHem = ([^;]+);/)[1];
const evalCloth = new Function('smoothstep','max','diffuseColor', 'return ' + clothExpression + ';');
const evalHem = new Function('smoothstep','courierCloth','vCourierGarment', 'return ' + hemExpression + ';');
const rearGeo = geometry.clone(); rearGeo.setIndex(attribute(primitive.indices));
rearGeo.setAttribute('uv', attribute(primitive.attributes.TEXCOORD_0));
const rearMesh = new T.Mesh(rearGeo, new T.MeshBasicMaterial({side:T.DoubleSide})); rearMesh.updateMatrixWorld(true);
const rearRay = new T.Raycaster(), bary = new T.Vector3(), pa = new T.Vector3(), pb = new T.Vector3(), pc = new T.Vector3();
for (const s of rearAtlasSamples) {
  rearRay.set(new T.Vector3(s[0],s[1],-1), new T.Vector3(0,0,1));
  const hit = rearRay.intersectObject(rearMesh)[0]; assert.ok(hit);
  assert.ok(Math.abs(hit.uv.x-s[2]) < 1e-7 && Math.abs(hit.uv.y-s[3]) < 1e-7, 'fixture hits the inspected exterior atlas pixel');
  const f = hit.face;
  T.Triangle.getBarycoord(hit.point, pa.fromBufferAttribute(geometry.attributes.position,f.a),
    pb.fromBufferAttribute(geometry.attributes.position,f.b), pc.fromBufferAttribute(geometry.attributes.position,f.c), bary);
  const value = k => garment.getComponent(f.a,k)*bary.x + garment.getComponent(f.b,k)*bary.y + garment.getComponent(f.c,k)*bary.z;
  samplePixel = new Uint8ClampedArray([s[4],s[5],s[6],255]); recolorSample({image:{width:1,height:1}});
  const color = new T.Color().setRGB(samplePixel[0]/255,samplePixel[1]/255,samplePixel[2]/255).convertSRGBToLinear();
  const cloth = evalCloth(smooth, Math.max, color);
  const mask = evalHem(smooth, cloth, {x:value(0),y:value(1)});
  if (s[1] === .77) assert.ok(mask > .95, 'hem reaches the actual red-cloth bottom in each rear column');
  else assert.equal(mask, 0, 'blue jeans below the actual cloth boundary retain their source colour');
}
// Sample the shipped performances with both the original and refined skin.
// A sneaker can grow around the ankle, but must remain a bounded deformation
// through the toe hinge, jump tuck and roll instead of separating from its rig.
const shoeProbes = [];
for (let v = 0; v < geometry.attributes.position.count; v += 11) {
  let shoeWeight = 0;
  for (let c = 0; c < 4; c++) {
    const name = skeleton.bones[geometry.attributes.skinIndex.getComponent(v, c)].name;
    if (/^(Left|Right)(Foot|ToeBase)$/.test(name)) shoeWeight += geometry.attributes.skinWeight.getComponent(v, c);
  }
  if (shoeWeight > 0.99) shoeProbes.push(v);
}
assert.ok(shoeProbes.length > 20, 'actual shoe geometry is sampled');
const animationRoot = new T.Group();
nodes.filter(n => !n.parent).forEach(n => animationRoot.add(n));
const bindTransforms = nodes.map(n => [n.position.clone(), n.quaternion.clone(), n.scale.clone()]);
const referenceMesh = new T.SkinnedMesh(geometry, mesh.material);
referenceMesh.bind(skeleton, new T.Matrix4());
const mixer = new T.AnimationMixer(animationRoot), sourcePoint = new T.Vector3(), refinedPoint = new T.Vector3();
const testedClips = ['run', 'hero_jump_l', 'hero_jump_r', 'hero_land', 'hero_roll', 'hero_lane_l', 'hero_lane_r'];
let sampledPoses = 0, maxShoeDisplacement = 0;
for (const clipName of testedClips) {
  const animation = doc.animations.find(a => a.name === clipName);
  assert.ok(animation, `${clipName} is present in the actual GLB`);
  const tracks = animation.channels.map(channel => {
    const sampler = animation.samplers[channel.sampler];
    assert.equal(sampler.interpolation, 'LINEAR');
    const property = {translation:'position', rotation:'quaternion', scale:'scale'}[channel.target.path];
    const Track = property === 'quaternion' ? T.QuaternionKeyframeTrack : T.VectorKeyframeTrack;
    return new Track(nodes[channel.target.node].name + '.' + property,
      attribute(sampler.input).array, attribute(sampler.output).array);
  });
  const clip = new T.AnimationClip(clipName, -1, tracks);
  const action = mixer.clipAction(clip); action.setLoop(T.LoopOnce, 1); action.clampWhenFinished = true; action.play();
  for (const phase of [0, 0.25, 0.5, 0.75, 0.99]) {
    mixer.setTime(clip.duration * phase); animationRoot.updateMatrixWorld(true); skeleton.update();
    for (const v of shoeProbes) {
      referenceMesh.applyBoneTransform(v, sourcePoint.fromBufferAttribute(geometry.attributes.position, v));
      mesh.applyBoneTransform(v, refinedPoint.fromBufferAttribute(mesh.geometry.attributes.position, v));
      assert.ok([refinedPoint.x, refinedPoint.y, refinedPoint.z].every(Number.isFinite));
      const displacement = sourcePoint.distanceTo(refinedPoint);
      assert.ok(displacement < 0.15, `${clipName} sneaker remains attached to its animated ankle`);
      maxShoeDisplacement = Math.max(maxShoeDisplacement, displacement);
    }
    for (const v of garmentProbes) {
      mesh.applyBoneTransform(v, refinedPoint.fromBufferAttribute(mesh.geometry.attributes.position, v));
      assert.ok([refinedPoint.x, refinedPoint.y, refinedPoint.z].every(Number.isFinite), `${clipName} garment trim follows the skin`);
    }
    sampledPoses++;
  }
  mixer.stopAllAction(); mixer.uncacheClip(clip);
}
nodes.forEach((n, i) => { n.position.copy(bindTransforms[i][0]); n.quaternion.copy(bindTransforms[i][1]); n.scale.copy(bindTransforms[i][2]); });
animationRoot.updateMatrixWorld(true); skeleton.update();
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
console.log(`PASS: actual GLB silhouette/normals; sleeves/soles (${soleVertices.Left}/${soleVertices.Right}); cuffs (${garmentVertices.Left}/${garmentVertices.Right}); actual rear hem/denim atlas boundary in five columns; protected hands/trousers; shader assembly; ${sampledPoses} garment/sole animation poses (max shoe change ${maxShoeDisplacement.toFixed(4)}m); anchored soles; unchanged rig/weights; seven accessory batches; source ownership; offline sky.`);
