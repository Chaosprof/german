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
const glb = fs.readFileSync(path.join(root, 'assets/models/berlin-runner-hero-v14.glb'));
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
geometry.setAttribute('uv', attribute(primitive.attributes.TEXCOORD_0));
geometry.setAttribute('skinIndex', attribute(primitive.attributes.JOINTS_0));
geometry.setAttribute('skinWeight', attribute(primitive.attributes.WEIGHTS_0));
geometry.setIndex(attribute(primitive.indices));
const mesh = new T.SkinnedMesh(geometry, new T.MeshStandardMaterial());
mesh.bind(skeleton, new T.Matrix4());
const before = Buffer.from(geometry.attributes.position.array.buffer).toString('base64');
const refineStart = html.indexOf('  function refineCourierSilhouette(mesh) {');
const refineEnd = html.indexOf('\n  // Both arms share', refineStart);
const clothScopeStart=html.indexOf('  // BEGIN COURIER_CLOTH_PATCH_V97');
const clothScopeEnd=html.indexOf('  // END COURIER_CLOTH_PATCH_V97',clothScopeStart);
const clothScope=clothScopeStart<0?'':html.slice(clothScopeStart,clothScopeEnd);
const makeRefine=source=>new Function('THREE','atob',clothScope+'\n'+source+'\nreturn refineCourierSilhouette;')(T,atob);
const refine=makeRefine(html.slice(refineStart,refineEnd));
const originalBones = skeleton.bones.map(b => b.matrixWorld.elements.slice());
assert.equal(refine(mesh), true);
if(clothScope)assert.equal(mesh.geometry.userData.courierClothV97?.baked,true,'actual v14 applies the packed accepted cloth');
assert.notEqual(mesh.geometry, geometry, 'refinement owns a render copy');
assert.equal(mesh.geometry.attributes.position.count, geometry.attributes.position.count, 'no extra skinned vertices');
assert.deepEqual(Array.from(mesh.geometry.attributes.skinWeight.array), Array.from(geometry.attributes.skinWeight.array));
assert.deepEqual(Array.from(mesh.geometry.attributes.skinIndex.array), Array.from(geometry.attributes.skinIndex.array));
assert.deepEqual(skeleton.bones.map(b => b.matrixWorld.elements.slice()), originalBones, 'joint lengths and bind pose stay intact');
assert.deepEqual(Array.from(mesh.geometry.attributes.uv.array),Array.from(geometry.attributes.uv.array),'authored UVs remain byte-identical');
assert.deepEqual(Array.from(mesh.geometry.index.array),Array.from(geometry.index.array),'triangle topology remains byte-identical');
// Reverse only the recorded mask-authoring edits to recover the accepted v110
// refinement. New mask channels must not alter a single rendered surface byte.
const outfitEdits=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-courier-v111/character-edits.json'),'utf8'));
let priorMaskSource=html.slice(refineStart,refineEnd),reversedMaskEdits=0;
for(const edit of [...outfitEdits].reverse())if(priorMaskSource.includes(edit.after)) {
  priorMaskSource=priorMaskSource.replace(edit.after,edit.before);reversedMaskEdits++;
}
assert.ok(reversedMaskEdits>=6,'recorded mask edits reconstruct the previous refinement');
const priorMaskMesh=new T.SkinnedMesh(geometry,mesh.material);priorMaskMesh.bind(skeleton,new T.Matrix4());
makeRefine(priorMaskSource)(priorMaskMesh);
for(const name of ['position','normal','uv','skinIndex','skinWeight','aCourierSleeve','aCourierSole'])
  assert.deepEqual(Array.from(mesh.geometry.attributes[name].array),Array.from(priorMaskMesh.geometry.attributes[name].array),
    'outfit masks preserve every accepted '+name+' value');
assert.equal(priorMaskMesh.geometry.attributes.aCourierGarment.itemSize,2);
assert.equal(mesh.geometry.attributes.aCourierGarment.itemSize,4);
for(let v=0;v<geometry.attributes.position.count;v++)for(let c=0;c<2;c++)
  assert.equal(mesh.geometry.attributes.aCourierGarment.getComponent(v,c),priorMaskMesh.geometry.attributes.aCourierGarment.getComponent(v,c),
    'waist and wrist coordinates remain exactly unchanged');
// Compare against the accepted pre-expansion body. Shin weights also reach
// the shoes, so keeping the Foot transform alone does not preserve contact.
const previousRefineSource=html.slice(refineStart,refineEnd).replace('radial = 1.32','radial = 1.14')
  .replace('radial = 1.36','radial = 1.18').replace('uniform = 1.10','uniform = 1.20');
const previousMesh=new T.SkinnedMesh(geometry,mesh.material);previousMesh.bind(skeleton,new T.Matrix4());
makeRefine(previousRefineSource)(previousMesh);
if(clothScope)assert.notEqual(previousMesh.geometry.userData.courierClothV97?.baked,true,'former head/trouser variant retains its own refinement');
let protectedShoeVertices=0;
for(let v=0;v<geometry.attributes.position.count;v++){
  let shoeWeight=0;
  for(let c=0;c<4;c++)if(/^(Left|Right)(Foot|ToeBase)$/.test(skeleton.bones[geometry.attributes.skinIndex.getComponent(v,c)].name))
    shoeWeight+=geometry.attributes.skinWeight.getComponent(v,c);
  if(shoeWeight>.45||(shoeWeight>0&&geometry.attributes.position.getY(v)<.02)){
    for(const attributeName of ['position','normal'])for(let c=0;c<3;c++)assert.equal(
      mesh.geometry.attributes[attributeName].getComponent(v,c),previousMesh.geometry.attributes[attributeName].getComponent(v,c),
      'entire shoe surface and sole retain the accepted refinement exactly');
    protectedShoeVertices++;
  }
}
assert.ok(protectedShoeVertices>1300,'the actual shoes and mixed-weight cuffs are covered');
function regionBounds(geo,names){
  const wanted=new Set(names),box=new T.Box3();
  for(let v=0;v<geo.attributes.position.count;v++){
    let weight=0;for(let c=0;c<4;c++)if(wanted.has(skeleton.bones[geo.attributes.skinIndex.getComponent(v,c)].name))weight+=geo.attributes.skinWeight.getComponent(v,c);
    if(weight>.45)box.expandByPoint(new T.Vector3().fromBufferAttribute(geo.attributes.position,v));
  }
  return box;
}
const headFamily=['Head','head_end','headfront'];
const headWidthRatio=regionBounds(mesh.geometry,headFamily).getSize(new T.Vector3()).x/
  regionBounds(previousMesh.geometry,headFamily).getSize(new T.Vector3()).x;
assert.ok(headWidthRatio>.90&&headWidthRatio<.93,'actual head width reduces by 8–10% for the closer reference camera');
for(const side of ['Left','Right'])for(const region of ['UpLeg','Leg']){
  const width=regionBounds(mesh.geometry,[side+region]).getSize(new T.Vector3()).x;
  const formerWidth=regionBounds(previousMesh.geometry,[side+region]).getSize(new T.Vector3()).x;
  assert.ok(width>formerWidth*1.025&&width<formerWidth*1.18,'actual trouser silhouette grows without lengthening joints');
}
// The shipped v14 tips currently have no weighted vertices. Redistribute
// actual fully head-weighted vertices across all three real head bones to
// prove the shared transform also preserves tip-weighted islands and seams.
const familyIndices=headFamily.map(name=>skeleton.bones.findIndex(b=>b.name===name));
assert.ok(familyIndices.every(i=>i>=0));
const tipGeometry=geometry.clone(),tipProbes=[];
for(let v=0;v<geometry.attributes.position.count;v++){
  let headWeight=0;for(let c=0;c<4;c++)if(geometry.attributes.skinIndex.getComponent(v,c)===familyIndices[0])headWeight+=geometry.attributes.skinWeight.getComponent(v,c);
  if(headWeight>.99999){
    tipGeometry.attributes.skinIndex.setXYZW(v,...familyIndices,0);tipGeometry.attributes.skinWeight.setXYZW(v,.25,.25,.5,0);tipProbes.push(v);
  }
}
const tipMesh=new T.SkinnedMesh(tipGeometry,mesh.material);tipMesh.bind(skeleton,new T.Matrix4());refine(tipMesh);
for(const v of tipProbes)for(const name of ['position','normal'])for(let c=0;c<3;c++)assert.ok(
  Math.abs(tipMesh.geometry.attributes[name].getComponent(v,c)-mesh.geometry.attributes[name].getComponent(v,c))<1e-7,
  'head, end and front influences produce the same surface without a seam');
assert.equal(tipProbes.length,990,'all fully head-weighted vertices in the actual v14 surface are exercised');
for(const v of tipProbes)assert.equal(tipMesh.geometry.attributes.aCourierGarment.getZ(v),mesh.geometry.attributes.aCourierGarment.getZ(v),
  'posterior hair mask follows the complete head bone family without seams');
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
  const cuff = smooth(0.119, 0.126, garment.getY(v)) * (1 - smooth(0.151, 0.162, garment.getY(v))) * smooth(0.12, 0.78, sleeve);
  assert.ok([garment.getX(v), garment.getY(v), garment.getZ(v), garment.getW(v), hem, cuff].every(Number.isFinite));
  if (garment.getX(v) >= -0.105) assert.equal(hem, 0, 'jacket above the actual bottom band stays red');
  if (garment.getY(v) < 0.119 || garment.getY(v) > 0.162) assert.equal(cuff, 0, 'pushed-up cuffs stay on their authored forearm band');
  if (hem > 0.65) garmentVertices.Hem++;
  if (cuff > 0.65) garmentVertices[geometry.attributes.position.getX(v) > 0 ? 'Left' : 'Right']++;
  if (hem > 0.65 || cuff > 0.65) garmentProbes.push(v);
  assert.ok(sleeve >= 0 && sleeve <= 1);
  assert.ok(soleMask >= 0 && soleMask <= 1 && soleLength >= 0 && soleLength <= 1.000001);
  const sideFootWeights = {Left:0, Right:0};
  let headWeight=0,handWeight=0;
  for (let c = 0; c < 4; c++) {
    const name = skeleton.bones[geometry.attributes.skinIndex.getComponent(v, c)].name;
    const weight=geometry.attributes.skinWeight.getComponent(v,c);
    if(/^(Head|head_end|headfront)$/.test(name))headWeight+=weight;
    if(/^(Left|Right)Hand/.test(name))handWeight+=weight;
    if (/^(Left|Right)(Foot|ToeBase)$/.test(name)) {
      sideFootWeights[name.startsWith('Left') ? 'Left' : 'Right'] += geometry.attributes.skinWeight.getComponent(v, c);
    }
  }
  const shoeWeight=sideFootWeights.Left+sideFootWeights.Right;
  assert.ok(garment.getZ(v)>=0&&garment.getZ(v)<=Math.min(1,headWeight)+1e-7,'hair is bounded by actual head weights');
  assert.ok(garment.getW(v)>=0&&garment.getW(v)<=Math.min(1,shoeWeight)+1e-7,'sneaker material cannot reach non-foot influences');
  if(!headWeight)assert.equal(garment.getZ(v),0,'body, hands and denim receive no posterior hair tint');
  if(!shoeWeight)assert.equal(garment.getW(v),0,'new cream shoe material stays on actual foot geometry');
  if(headWeight>.9&&geometry.attributes.position.getZ(v)>=.015)assert.equal(garment.getZ(v),0,'front head vertices retain facial paint');
  if(handWeight>.9){assert.equal(garment.getZ(v),0);assert.equal(garment.getW(v),0);assert.equal(cuff,0);}
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
let previousShaderCalls = 0,previousShaderThis,previousShaderRenderer;
finish.onBeforeCompile = function(_shader,renderer){previousShaderCalls++;previousShaderThis=this;previousShaderRenderer=renderer;};
finish.customProgramCacheKey = () => 'existingHeroShader';
finishMaterial(finish);
const shader = { uniforms:{}, vertexShader:T.ShaderLib.standard.vertexShader, fragmentShader:T.ShaderLib.standard.fragmentShader };
const shaderRenderer={};finish.onBeforeCompile(shader,shaderRenderer);
assert.equal(previousShaderCalls, 1, 'costume/lighting shader chain remains intact');
assert.equal(previousShaderThis,finish);assert.equal(previousShaderRenderer,shaderRenderer,'existing shader hook receives its owner and renderer');
assert.equal((shader.vertexShader.match(/attribute vec2 aCourierSole;/g) || []).length, 1);
assert.ok(shader.vertexShader.includes('vCourierSole = aCourierSole;'));
assert.ok(shader.fragmentShader.includes('fract(vCourierSole.y * 5.0)'));
assert.ok(shader.fragmentShader.includes('diffuseColor.rgb = mix(diffuseColor.rgb, courierRubber'));
assert.ok(shader.uniforms.courierSoleColor.value.isColor && shader.uniforms.courierTreadColor.value.isColor);
assert.ok(shader.uniforms.courierHemColor.value.isColor);
assert.equal((shader.vertexShader.match(/attribute vec4 aCourierGarment;/g) || []).length, 1);
assert.equal((shader.fragmentShader.match(/varying vec4 vCourierGarment;/g) || []).length, 1);
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
const clothGate = shader.fragmentShader.match(/courierCloth \*= ([^;]+);/)[1];
const evalCloth = new Function('smoothstep','max','courierSource','vCourierGarment',
  'return (' + clothExpression + ') * (' + clothGate + ');');
const evalHem = new Function('smoothstep','courierCloth','vCourierGarment', 'return ' + hemExpression + ';');
const maskExpression=name=>{const found=shader.fragmentShader.match(new RegExp('float '+name+' = ([^;]+);'));assert.ok(found,'actual shader mask '+name);return found[1];};
const evalSleeve=new Function('smoothstep','vCourierSleeve','return '+maskExpression('courierSleeve')+';');
const evalForearm=new Function('smoothstep','vCourierGarment','courierSleeve','return '+maskExpression('courierForearm')+';');
const evalCuff=new Function('smoothstep','vCourierGarment','courierSleeve','return '+maskExpression('courierCuff')+';');
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
  const cloth = evalCloth(smooth, Math.max, color, {x:value(0),y:value(1),z:value(2),w:value(3)});
  const mask = evalHem(smooth, cloth, {x:value(0),y:value(1)});
  if (s[1] === .77) assert.ok(mask > .95, 'hem reaches the actual red-cloth bottom in each rear column');
  else {
    assert.equal(mask, 0, 'blue jeans below the actual cloth boundary retain their source colour');
    assert.equal(value(2),0);assert.equal(value(3),0,'actual exterior denim receives neither new material mask');
  }
}
function surfaceMaskAt(origin,direction) {
  rearRay.set(origin,direction);const hit=rearRay.intersectObject(rearMesh)[0];assert.ok(hit,'protected surface ray hits the actual mesh');
  const f=hit.face;
  T.Triangle.getBarycoord(hit.point,pa.fromBufferAttribute(geometry.attributes.position,f.a),
    pb.fromBufferAttribute(geometry.attributes.position,f.b),pc.fromBufferAttribute(geometry.attributes.position,f.c),bary);
  const value=(attribute,k)=>attribute.getComponent(f.a,k)*bary.x+attribute.getComponent(f.b,k)*bary.y+attribute.getComponent(f.c,k)*bary.z;
  const g={x:value(garment,0),y:value(garment,1),z:value(garment,2),w:value(garment,3)};
  const sleeve=evalSleeve(smooth,value(mesh.geometry.attributes.aCourierSleeve,0));
  return {hit,g,sleeve,forearm:evalForearm(smooth,g,sleeve),cuff:evalCuff(smooth,g,sleeve)};
}
let faceSurfaceChecks=0,cuffSurfaceChecks=0;
for(const y of [1.40,1.45,1.50,1.55])for(const x of [-.05,0,.05]) {
  const probe=surfaceMaskAt(new T.Vector3(x,y,1),new T.Vector3(0,0,-1));
  assert.equal(probe.g.z,0);assert.equal(probe.g.w,0);assert.equal(probe.sleeve,0);
  assert.equal(evalCloth(smooth,Math.max,{r:1,g:0,b:0},probe.g),0,'even red facial texels cannot enter the garment colour gate');
  faceSurfaceChecks++;
}
// Side rays land on verified skin pixels of the pinned donor atlas, not on
// the posterior patterned headwear. They catch interpolated mask leakage.
for(const side of [-1,1])for(const y of [1.44,1.48]) {
  const probe=surfaceMaskAt(new T.Vector3(side,y,-.015),new T.Vector3(-side,0,0));
  assert.ok(probe.g.z<.001,'side-ear skin remains outside posterior hair tint');faceSurfaceChecks++;
}
const bindPoint=name=>new T.Vector3().setFromMatrixPosition(skeleton.boneInverses[skeleton.bones.findIndex(b=>b.name===name)].clone().invert());
for(const side of ['Left','Right']) {
  const wrist=bindPoint(side+'Hand'),axis=wrist.clone().sub(bindPoint(side+'ForeArm')).normalize();
  const outward=new T.Vector3(0,0,1).addScaledVector(axis,-axis.z).normalize();
  for(const sign of [-1,1])for(const distance of [.070,.139,.185]) {
    const center=wrist.clone().addScaledVector(axis,-distance);
    const probe=surfaceMaskAt(center.clone().addScaledVector(outward,sign),outward.clone().multiplyScalar(-sign));
    assert.ok(Math.abs(probe.g.y-distance)<1e-6,'actual surface interpolates the original wrist coordinate');
    assert.ok(probe.sleeve>.95,'probe hits the authored sleeve surface');
    assert.equal(probe.g.z,0);assert.equal(probe.g.w,0);
    if(distance<.1){assert.ok(probe.forearm>.95);assert.equal(probe.cuff,0,'exposed forearm stays below the rolled cuff');}
    else if(distance<.16){assert.ok(probe.cuff>.95);assert.equal(probe.forearm,0,'both sides of the real cuff have solid cloth coverage');}
    else {assert.equal(probe.forearm,0);assert.equal(probe.cuff,0,'upper sleeve remains jacket fabric');}
    cuffSurfaceChecks++;
  }
}
console.log(`PASS: four-channel surface masks preserve all accepted geometry/UV/skin/cloth bytes and original waist/wrist values; ${faceSurfaceChecks} face/ear and ${cuffSurfaceChecks} actual pushed-sleeve/cuff probes; foot-only sneaker mask.`);
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
const testedClips = ['idle', 'run', 'hero_jump', 'hero_jump_l', 'hero_jump_r', 'hero_land',
  'hero_lane_l', 'hero_lane_l_support_l', 'hero_lane_r', 'hero_lane_r_support_r',
  'hero_roll', 'hero_stumble', 'hero_victory_l', 'hero_victory_r', 'run_authored'];
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
// Sample the actual imported run and the actual runtime torso code. The
// complete rig reverses the authored donor's spine names; its mocap already
// has a strong shoulder counter-swing that the old Spine01 overlay suppressed.
const yawStart = html.indexOf('  function heroRunChestYawWeight(');
const yawEnd = html.indexOf('\n  function poseRunner(', yawStart);
assert.ok(yawStart > 0 && yawEnd > yawStart);
const chestYawWeight = new Function('clamp', html.slice(yawStart, yawEnd) + '\nreturn heroRunChestYawWeight;')(T.MathUtils.clamp);
const counterStart = html.indexOf("      nudgeCharBone('Spine', 0.045");
const counterEnd = html.indexOf('\n      // Run juice', counterStart);
const juiceStart = html.indexOf("        nudgeCharBone('Spine01', 0.055", counterEnd);
const juiceEnd = html.indexOf('\n        // Head stays level', juiceStart);
const hipBob = html.match(/nudgeCharBone\('Hips', Math\.cos\(runPhase \* 2\) \* 0\.020, 0, 0, runCounter\);/);
assert.ok(counterStart > 0 && counterEnd > counterStart && juiceEnd > juiceStart && hipBob);
const torsoLayer = new Function('nudgeCharBone', 'heroRunChestYawWeight', 'runCounter', 'charAssetComplete',
  'namedPrimaryWeight', 'namedLaneOwnership', 'swing', 'swing2', 'heroSpeedK', 'runPhase',
  html.slice(counterStart, counterEnd) + html.slice(juiceStart, juiceEnd) + hipBob[0]);
// Execute the shipped arm field, including its action ownership gate, rather
// than duplicating its coefficients in a test-only pose implementation.
const armSource = html.match(/var armOpen = [\s\S]*?nudgeCharBone\('RightArm', 0, 0, armOpen, 1\);/);
assert.ok(armSource, 'the complete rig owns a bounded upper-arm spread');
const armLayer = new Function('nudgeCharBone', 'clamp', 'completeRunWeight',
  'namedPrimaryWeight', 'namedLaneOwnership', armSource[0] + '\nreturn armOpen;');
for (const run of [0, .25, .5, .75, 1]) for (const primary of [0, .25, .5, 1])
  for (const lane of [0, .25, .5, 1]) {
    const offsets = [];
    const angle = armLayer((...args) => offsets.push(args), T.MathUtils.clamp, run, primary, lane);
    assert.ok(Number.isFinite(angle) && angle >= 0 && angle <= .10, 'arm spread remains within 0.10 radians');
    assert.deepEqual(offsets, [['LeftArm', 0, 0, -angle, 1], ['RightArm', 0, 0, angle, 1]],
      'only upper arms receive equal, opposite offsets');
    if (!run || primary === 1 || lane === 1) assert.equal(angle, 0, 'rest and full named ownership disable arm spread');
  }
const boneLookup = Object.fromEntries(nodes.map(n => [n.name, n]));
const nudgeStart = html.indexOf('  function nudgeCharBone(');
const nudgeEnd = html.indexOf('\n  // Absolute counterpart', nudgeStart);
const nudge = new Function('charBones', html.slice(nudgeStart, nudgeEnd) + '\nreturn nudgeCharBone;')(boneLookup);
function actualClip(name) {
  const animation = doc.animations.find(a => a.name === name);
  return new T.AnimationClip(name + '_torso_probe', -1, animation.channels.map(channel => {
    const sampler = animation.samplers[channel.sampler];
    const property = {translation:'position', rotation:'quaternion', scale:'scale'}[channel.target.path];
    const Track = property === 'quaternion' ? T.QuaternionKeyframeTrack : T.VectorKeyframeTrack;
    return new Track(nodes[channel.target.node].name + '.' + property,
      attribute(sampler.input).array, attribute(sampler.output).array);
  }));
}
const probeRunClip = actualClip('run');
const probeRunAction = mixer.clipAction(probeRunClip); probeRunAction.paused = true; probeRunAction.play();
const shoulderA = new T.Vector3(), shoulderB = new T.Vector3();
const yawSamples = {source:[], previous:[], corrected:[]};
let maxYawFootDelta = 0;
const armSeparation = {before: {elbow: [], hand: []}, after: {elbow: [], hand: []}};
function sampleArmSeparation(target) {
  const torso = boneLookup.Spine.getWorldPosition(new T.Vector3());
  for (const side of ['Left', 'Right']) for (const [part, bone] of [['elbow', 'ForeArm'], ['hand', 'Hand']]) {
    const p = boneLookup[side + bone].getWorldPosition(new T.Vector3()).sub(torso);
    target[part].push(Math.hypot(p.x, p.z));
  }
}
function shoulderYaw() {
  boneLookup.LeftShoulder.getWorldPosition(shoulderA);
  boneLookup.RightShoulder.getWorldPosition(shoulderB);
  shoulderA.sub(shoulderB); return Math.atan2(shoulderA.z, shoulderA.x) * 180 / Math.PI;
}
for (let frame = 0; frame < 60; frame++) {
  const phase = frame / 60 * Math.PI * 2;
  probeRunAction.time = frame / 60 * probeRunClip.duration; mixer.update(0);
  const cleanPose = nodes.map(n => n.quaternion.clone());
  animationRoot.updateMatrixWorld(true); yawSamples.source.push(shoulderYaw());
  let oldFeet;
  for (const variant of ['previous','corrected','fallback','primary','lane']) {
    nodes.forEach((n,i) => n.quaternion.copy(cleanPose[i]));
    torsoLayer(nudge, variant === 'previous' ? weight => weight : chestYawWeight,
      1, variant !== 'fallback', variant === 'primary' ? 1 : 0, variant === 'lane' ? 1 : 0,
      Math.sin(phase), -Math.sin(phase), 0, phase);
    animationRoot.updateMatrixWorld(true);
    if (variant === 'corrected') sampleArmSeparation(armSeparation.before);
    if (variant !== 'previous' && variant !== 'fallback') {
      const armPose = ['LeftArm', 'RightArm'].map(name => boneLookup[name].quaternion.toArray());
      armLayer(nudge, T.MathUtils.clamp, 1, variant === 'primary' ? 1 : 0, variant === 'lane' ? 1 : 0);
      if (variant === 'primary' || variant === 'lane')
        // nudgeCharBone writes through Euler angles even for a zero offset;
        // Float32 imported quaternions round-trip with sub-microradian error.
        ['LeftArm', 'RightArm'].forEach((name, side) => assert.ok(
          boneLookup[name].quaternion.toArray().every((v, k) => Math.abs(v - armPose[side][k]) < 1e-6),
          'full action ownership preserves both authored upper-arm rotations'));
    }
    animationRoot.updateMatrixWorld(true);
    if (variant === 'corrected') sampleArmSeparation(armSeparation.after);
    const feet = ['LeftFoot','RightFoot'].map(name => boneLookup[name].getWorldPosition(new T.Vector3()));
    if (variant === 'previous') oldFeet = feet;
    else for (let side=0;side<2;side++) maxYawFootDelta = Math.max(maxYawFootDelta, feet[side].distanceTo(oldFeet[side]));
    if (yawSamples[variant]) yawSamples[variant].push(shoulderYaw());
    if (variant === 'fallback' || variant === 'primary' || variant === 'lane') {
      assert.ok(Math.abs(shoulderYaw() - yawSamples.previous[frame]) < 1e-10,
        'fallback rigs and full named-action ownership preserve their original torso pose');
    }
  }
  nodes.forEach((n,i) => n.quaternion.copy(cleanPose[i]));
}
const yawExcursion = Object.fromEntries(Object.entries(yawSamples).map(([name,values]) =>
  [name, Math.max(...values) - Math.min(...values)]));
assert.ok(yawExcursion.corrected > yawExcursion.previous * 1.45, 'ordinary run restores visible shoulder excursion');
assert.ok(Math.abs(yawExcursion.corrected - yawExcursion.source) < 4, 'restored excursion stays close to the underlying mocap');
assert.equal(maxYawFootDelta, 0, 'both feet retain exact world positions at all 60 run phases');
const mean = values => values.reduce((a, b) => a + b, 0) / values.length;
const armGain = Object.fromEntries(['elbow', 'hand'].map(part => [part,
  mean(armSeparation.after[part]) - mean(armSeparation.before[part])]));
assert.ok(armGain.elbow > .010 && armGain.hand > .012,
  'the actual run gains visible elbow and hand clearance from the torso');
// Repeated real mixer transitions exercise a paused/scrubbed base run, an
// additive roll and a lane cut. Replaying the same sequence must be periodic;
// an additive Euler offset cannot accumulate when clips hand ownership back.
const probeActions = ['hero_roll','hero_lane_l'].map(name => {
  const clip = actualClip(name); T.AnimationUtils.makeClipAdditive(clip,0,clip,120);
  const action = mixer.clipAction(clip); action.paused=true; action.play(); action.weight=0;
  return action;
});
const transitionReference = [];
for (let cycle=0;cycle<5;cycle++) for (let frame=0;frame<120;frame++) {
  const phase=frame/120*Math.PI*2;
  const primary=frame>=40&&frame<70?Math.sin((frame-40)/30*Math.PI):0;
  const lane=frame>=76&&frame<100?Math.sin((frame-76)/24*Math.PI):0;
  probeRunAction.time=frame/120*probeRunClip.duration; probeRunAction.weight=1-primary;
  probeActions[0].time=Math.max(0,(frame-40)/30)*probeActions[0].getClip().duration;probeActions[0].weight=primary;
  probeActions[1].time=Math.max(0,(frame-76)/24)*probeActions[1].getClip().duration;probeActions[1].weight=lane;
  mixer.update(0);
  torsoLayer(nudge,chestYawWeight,1-primary,true,primary,lane,Math.sin(phase),-Math.sin(phase),0,phase);
  armLayer(nudge,T.MathUtils.clamp,1-primary,primary,lane);
  const rotations=['Spine','Spine01','Spine02','LeftArm','RightArm','LeftForeArm','RightForeArm']
    .map(name=>boneLookup[name].quaternion.clone());
  if(cycle===0)transitionReference.push(rotations);
  // Compare components: exported float quaternions are not perfectly unit
  // length, so angleTo can report a small angle even against the same value.
  else rotations.forEach((q,i)=>assert.ok(q.toArray().every((v,k)=>
    Math.abs(v-transitionReference[frame][i].toArray()[k])<1e-9),'run/action transitions have no cumulative yaw drift'));
}
mixer.stopAllAction();mixer.uncacheClip(probeRunClip);
probeActions.forEach(action=>mixer.uncacheClip(action.getClip()));
nodes.forEach((n,i)=>{n.position.copy(bindTransforms[i][0]);n.quaternion.copy(bindTransforms[i][1]);n.scale.copy(bindTransforms[i][2]);});
animationRoot.updateMatrixWorld(true);skeleton.update();
console.log(`PASS: complete-rig shoulder excursion ${yawExcursion.previous.toFixed(2)}° -> ${yawExcursion.corrected.toFixed(2)}° (source ${yawExcursion.source.toFixed(2)}°); elbow/hand clearance +${(armGain.elbow*1000).toFixed(2)}/+${(armGain.hand*1000).toFixed(2)} mm; exact foot positions; preserved fallback/named ownership; 600 run/roll/cut transition samples without drift.`);
const start = html.indexOf('  function dressCourierHero(mesh) {');
const end = html.indexOf('\n  function findHeroRunClip', start);
assert.ok(start > 0 && end > start);
const mergeStart = html.indexOf('  function mergeBoxes(specs) {');
const mergeEnd = html.indexOf('\n  // DRAW-CALL CONSOLIDATION:', mergeStart);
const mergeBoxes = new Function('THREE', html.slice(mergeStart, mergeEnd) + '\nreturn mergeBoxes;')(T);
const packStart=html.indexOf('  // BEGIN BLENDER COURIER BAG');
const packEnd=html.indexOf('  // END BLENDER COURIER BAG',packStart);
assert.ok(packStart>0&&packEnd>packStart,'the shipping page embeds its backpack geometry');
const bagData=new Function(html.slice(packStart,packEnd)+'\nreturn BERLIN_COURIER_BAG_DATA;')();
assert.deepEqual(bagData,JSON.parse(fs.readFileSync(path.join(root,'assets/models/berlin-courier-bag-v1.json'),'utf8')),
  'actual embedded backpack matches the Blender export');
context.atob=atob;
const decodeBerlinMeshRecord=vm.runInContext(fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8')+
  '\ndecodeBerlinMeshRecord;',context);
let bagTriangles=0;
for(const [name,record] of Object.entries(bagData.meshes)){
  const g=decodeBerlinMeshRecord(T,record),p=g.attributes.position,n=g.attributes.normal,index=g.index;
  assert.equal(index.count,record.triangles*3);bagTriangles+=record.triangles;
  const weld=[],ids=new Map(),edges=new Map();let volume=0;
  for(let i=0;i<p.count;i++){
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
    if(!ids.has(key))ids.set(key,ids.size);weld.push(ids.get(key));
    const normal=new T.Vector3().fromBufferAttribute(n,i);
    assert.ok(Math.abs(normal.length()-1)<.0001,'unit exported cloth normals');
  }
  for(let i=0;i<index.count;i+=3){
    const face=[index.getX(i),index.getX(i+1),index.getX(i+2)];
    assert.ok(face.every(v=>v>=0&&v<p.count),'indices stay inside the packed vertex buffer');
    const v=face.map(k=>new T.Vector3().fromBufferAttribute(p,k));
    const area=new T.Vector3().crossVectors(v[1].clone().sub(v[0]),v[2].clone().sub(v[0]));
    assert.ok(area.lengthSq()>1e-14,'cloth triangles are nondegenerate');
    volume+=v[0].dot(new T.Vector3().crossVectors(v[1],v[2]))/6;
    for(let j=0;j<3;j++){
      const edge=[weld[face[j]],weld[face[(j+1)%3]]].sort((a,b)=>a-b).join(',');
      edges.set(edge,(edges.get(edge)||0)+1);
    }
  }
  assert.ok([...edges.values()].every(count=>count===2),name+' is a closed, two-sided physical shell');
  assert.ok(volume>.005,name+' has outward winding and positive volume');
  g.dispose();
}
assert.equal(Object.keys(bagData.meshes).length,3);assert.ok(bagTriangles<2800);
const makeDress = source => new Function('THREE', 'heroTrimMat', 'roundedBox', 'mergeBoxes', 'BERLIN_COURIER_BAG_DATA', 'decodeBerlinMeshRecord',
  source + '\nreturn dressCourierHero;')(
    T, color => new T.MeshStandardMaterial({color}),
    (w, h, d, r, material, x, y, z) => {
      const o = new T.Mesh(new T.BoxGeometry(w, h, d), material);
      o.position.set(x, y, z); return o;
    }, mergeBoxes, bagData, decodeBerlinMeshRecord);
const dress = makeDress(html.slice(start,end));
dress(mesh);
assert.equal(Object.keys(dress.packGeometry).length,3,'actual rig uses all three authored cloth shells');
console.log('PASS: '+bagTriangles+' Blender cloth triangles; three closed shells, outward winding, unit normals; exact embedded asset.');
const cap = skeleton.bones.find(b => b.name === 'Head').getObjectByName('Courier cap');
const bag = skeleton.bones.find(b => b.name === 'Spine02').getObjectByName('Courier sling bag');
assert.ok(cap && bag, 'both accessories attach to the intended actual bones');
assert.equal(cap.children.length, 4, 'crown, forward brim and rear adjustment retain four cap draws');
assert.equal(bag.children.length, 3, 'exposed straps and hardware retain three satchel draws');
assert.equal(cap.children.length + bag.children.length, 7, 'outfit stays within seven draws');
if(bagData.atlas){
  const textured=bag.children.filter(o=>o.material.map);
  assert.equal(textured.length,1,'three canvas shells share one merged textured draw');
  assert.equal(textured[0].material.map,dress.packTexture,'merged bag owns the cached atlas');
  assert.equal(dress.packTexture.colorSpace,T.SRGBColorSpace,'contact bake is decoded once');
  assert.equal(dress.packTexture.minFilter,T.LinearMipmapLinearFilter,'small moving bag uses mipmaps');
  assert.ok(cap.children.every(o=>!o.material.map),'canvas contact does not tint the cap or its seams');
  const merged=textured[0].geometry;
  assert.equal(merged.index?merged.index.count:merged.attributes.position.count,bagTriangles*3,
    'all three shells retain their complete surface in one draw');
  const expectedUV=[];
  for(const key of ['body','pocket','flap']){
    const g=decodeBerlinMeshRecord(T,bagData.meshes[key]);
    for(let i=0;i<g.index.count;i++){const v=g.index.getX(i);expectedUV.push(g.attributes.uv.getX(v),g.attributes.uv.getY(v));}
    g.dispose();
  }
  assert.deepEqual(Array.from(merged.attributes.uv.array),expectedUV,'batching preserves every authored atlas corner');
}
// Dress the former larger head too. The backpack must remain independent
// of head sizing; compare every actual merged vertex in world space.
const formerHeadMesh=new T.SkinnedMesh(geometry,mesh.material);formerHeadMesh.bind(skeleton,new T.Matrix4());
makeRefine(html.slice(refineStart,refineEnd).replace('uniform = 1.10','uniform = 1.20'))(formerHeadMesh);
if(clothScope)assert.notEqual(formerHeadMesh.geometry.userData.courierClothV97?.baked,true,'former head variant skips the absolute cloth patch');
makeDress(html.slice(start,end))(formerHeadMesh);
const previousCap=cap.parent.children.filter(o=>o.name==='Courier cap').at(-1);
const previousBag=bag.parent.children.filter(o=>o.name==='Courier sling bag').at(-1);
assert.notEqual(previousCap,cap);assert.notEqual(previousBag,bag);
animationRoot.updateMatrixWorld(true);
let maxBagDelta=0;
for(const [current,former] of [[cap,previousCap],[bag,previousBag]]){
  assert.equal(current.children.length,former.children.length,'head growth adds no accessory draws');
  for(let i=0;i<current.children.length;i++){
    const a=current.children[i],b=former.children[i];
    assert.equal(a.geometry.attributes.position.count,b.geometry.attributes.position.count,'accessory vertex count remains fixed');
    assert.equal(a.geometry.index?.count,b.geometry.index?.count,'accessory triangle count remains fixed');
    if(current===bag)for(let v=0;v<a.geometry.attributes.position.count;v++){
      const av=new T.Vector3().fromBufferAttribute(a.geometry.attributes.position,v).applyMatrix4(a.matrixWorld);
      const bv=new T.Vector3().fromBufferAttribute(b.geometry.attributes.position,v).applyMatrix4(b.matrixWorld);
      maxBagDelta=Math.max(maxBagDelta,av.distanceTo(bv));
    }
  }
}
// The torso bounds include a few blended neck vertices. They move slightly
// with the reduced head, but must not resize the pack by the head's 8–10%.
assert.ok(maxBagDelta<.0025,'blended neck vertices move every pack vertex by less than 2.5 mm');
const capWidthRatio=new T.Box3().setFromObject(cap).getSize(new T.Vector3()).x/
  new T.Box3().setFromObject(previousCap).getSize(new T.Vector3()).x;
assert.ok(capWidthRatio>.90&&capWidthRatio<.93,'attached cap follows the reduced actual head');
previousCap.removeFromParent();previousBag.removeFromParent();
console.log(`PASS: fuller trousers; head/cap width ${((headWidthRatio-1)*100).toFixed(2)}%; ${tipProbes.length} shared-head seam probes; ${protectedShoeVertices} unchanged shoe/cuff vertices and normals; head-independent pack displacement ${(maxBagDelta*1000).toFixed(4)} mm; unchanged UVs, topology and accessory draws.`);
assert.equal(before, Buffer.from(geometry.attributes.position.array.buffer).toString('base64'), 'source skin geometry stays intact');
for (const accessory of [cap, bag]) {
  for (const part of accessory.children) {
    assert.ok(Array.from(part.geometry.attributes.position.array).every(Number.isFinite),
      `${accessory.name} has finite merged shell, strap and hardware vertices`);
    assert.ok(Array.from(part.geometry.attributes.normal.array).every(Number.isFinite),
      `${accessory.name} has finite merged normals`);
  }
  nodes.filter(n => !n.parent).forEach(n => n.updateMatrixWorld(true));
  const box = new T.Box3().setFromObject(accessory);
  const size = box.getSize(new T.Vector3());
  assert.ok([box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].every(Number.isFinite));
  assert.ok(size.x > 0.1 && size.x < 0.7 && size.y > 0 && size.y < 0.7 && size.z > 0 && size.z < 0.7,
    `${accessory.name} and exposed straps remain inside a human-scale envelope`);
  const localMatrix = accessory.matrix.toArray(), parentRotation = accessory.parent.quaternion.clone();
  const oldPosition = accessory.getWorldPosition(new T.Vector3());
  accessory.parent.rotation.x += 0.4;
  nodes.filter(n => !n.parent).forEach(n => n.updateMatrixWorld(true));
  assert.ok(oldPosition.distanceTo(accessory.getWorldPosition(new T.Vector3())) > 0.005, 'accessory follows bone animation');
  assert.deepEqual(accessory.matrix.toArray(), localMatrix, 'bone motion preserves the accessory attachment transform');
  accessory.parent.quaternion.copy(parentRotation);
}
assert.ok(fs.existsSync(path.join(root, 'assets/img/berlin-summer-sky-v1.png')));
const inline = fs.readFileSync(path.join(root, 'assets/img/berlin-art.inline.js'), 'utf8');
assert.ok(inline.includes('summerSky: \'data:image/png;base64,'));
console.log(`PASS: actual GLB silhouette/normals; sleeves/soles (${soleVertices.Left}/${soleVertices.Right}); cuffs (${garmentVertices.Left}/${garmentVertices.Right}); actual rear hem/denim atlas boundary in five columns; protected hands/trousers; shader assembly; ${sampledPoses} garment/sole animation poses (max shoe change ${maxShoeDisplacement.toFixed(4)}m); anchored soles; unchanged rig/weights; seven accessory batches; source ownership; offline sky.`);
