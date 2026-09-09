'use strict';
// Exercise the shipped controller and geometry, without a mocked copy of either.
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'berlin-runner.html'), 'utf8');
function section(a, b) {
  const start = html.indexOf(a), end = html.indexOf(b, start + a.length);
  assert.ok(start >= 0 && end > start, `source anchors: ${a}`);
  return html.slice(start, end);
}
const cadence = section('  var presentationClock = 0;', '  var graphicsContextLost');
for (const hz of [59.94, 60, 90, 120, 144]) {
  const c = vm.createContext({Math}); vm.runInContext(cadence, c);
  for (const target of [30, 60]) {
    c.presentationClock = 0;
    let renders = 0;
    for (let i = 1; i <= hz * 10; i++) if (c.presentationDue(i * 1000 / hz, 1000 / target)) renders++;
    assert.ok(Math.abs(renders - target * 10) <= 2, `${hz} Hz -> ${target}: ${renders}`);
  }
}
// Background street work follows wall time, independently of display refresh.
const workCadence = section('  var deferredTrafficDt = 0;', '  var perfWarmup = 0;');
for (const hz of [30, 59.94, 60, 90, 120, 144]) {
  for (const shadowPeriod of [6, 8, 12]) {
    const c = vm.createContext({Math, shadowRefreshPeriod:()=>shadowPeriod});
    vm.runInContext(workCadence, c);
    let traffic=0, shadows=0;
    for (let i=0;i<Math.floor(hz*10);i++) {
      c.updateRenderCadence(1/hz);
      traffic += Number(c.trafficRefreshDue); shadows += Number(c.shadowRefreshDue);
    }
    assert.ok(Math.abs(traffic-300)<=1, `${hz} Hz traffic stays at 30 Hz: ${traffic}`);
    assert.ok(Math.abs(shadows-600/shadowPeriod)<=1, `${hz} Hz shadow cadence: ${shadows}`);
  }
}
// Switching AO/bloom/shadows alone must not clear the canvas, reallocate its
// drawing buffer, or invalidate its depth texture. Rotation commits once.
const resizeCalls=[];
let postResizes=0;
const buffer=vm.createContext({Math, window:{innerWidth:390,innerHeight:844,devicePixelRatio:3},
  MIN_RENDER_SCALE:0.5,EMERGENCY_RENDER_SCALE:0.92,emergencyResolutionActive:false,
  MAX_RENDER_DPR:2,renderScale:1,clamp:(x,a,b)=>Math.max(a,Math.min(x,b)),
  renderer:{setDrawingBufferSize:(...args)=>resizeCalls.push(args)},
  postResize(){postResizes++;}
});
vm.runInContext(section('  var renderViewportW = 0,', '  applyRenderScale(renderScale);'),buffer);
buffer.applyRenderScale(1); buffer.applyRenderScale(1);
assert.equal(resizeCalls.length,1,'unchanged size avoids GPU storage invalidation');
assert.equal(postResizes,1,'effect-only tiers leave the depth attachment alone');
buffer.window.innerWidth=844; buffer.window.innerHeight=390;
buffer.applyRenderScale(1);
assert.deepEqual(resizeCalls[1],[844,390,2],'rotation commits the final buffer once');
buffer.applyRenderScale(0.75);
assert.deepEqual(resizeCalls[2],[844,390,1.5],'measured quality changes update internal DPR');
assert.equal(postResizes,3);
// Physical 3x phone screens, high-DPI laptops and 4K desktops must all stay
// within the real scene pixel budget; never confuse CSS pixels with DPR.
const budgetSource = section('  var PIXEL_BUDGET =', '  // Begin at the device budget');
for (const [w,h,dpr,mobile] of [[390,844,3,true],[844,390,3,true],[1920,1080,1,false],[3840,2160,1,false],[2560,1600,2,false]]) {
  const c = vm.createContext({Math, IS_MOBILE:mobile, window:{innerWidth:w,innerHeight:h}});
  vm.runInContext(budgetSource, c);
  const ratio = Math.min(c.MAX_RENDER_DPR, dpr);
  assert.ok(w*h*ratio*ratio <= c.PIXEL_BUDGET + 1, `${w}x${h} respects pixel budget`);
  assert.ok(ratio > 0 && Number.isFinite(ratio));
}
function controller(mobile, minScale) {
  const c = vm.createContext({Math, Infinity,
    clamp:(x,a,b)=>Math.max(a,Math.min(x,b)), lerp:(a,b,t)=>a+(b-a)*t,
    POST:{dofOn:false,aoOn:true,bloomOn:true,outlineOn:true},
    sceneRTBaseSamples:mobile?0:2, MIN_RENDER_SCALE:minScale,
    EMERGENCY_RENDER_SCALE:0.92, renderScale:1, emergencyResolutionActive:false,
    started:true,gameOver:false,document:{hidden:false},canvas:{dataset:{}},
    applyShadowScope(){},setSceneRTLeanMode(){},
    applyRenderScale(s){c.renderScale=s;},
    passBeautyCalls:0,passOutlineCalls:0,passPostCalls:0,
    passBeautyTriangles:0,passOutlineTriangles:0,passPostTriangles:0,
  });
  vm.runInContext(section('  var frameNumber = 0;', '  var presentationClock = 0;'),c);
  return c;
}
const slow = controller(true,0.52);
for (let i=0;i<1000;i++) {slow.frameNumber++;slow.monitorFrameBudget(1/30);}
assert.ok(slow.qualityTier > 0, 'sustained 30 fps enables measured load shedding');
assert.ok(slow.renderScale < 1, 'phone recovers fill budget');
const lowTier = slow.qualityTier;
for(let i=0;i<3600;i++){slow.frameNumber++;slow.monitorFrameBudget(1/60);}
assert.ok(slow.qualityTier < lowTier, 'sustained 60 fps recovers image quality');
const smooth = controller(false,1);
for(let i=0;i<1800;i++){smooth.frameNumber++;smooth.monitorFrameBudget(i===240?0.1:1/60);}
assert.equal(smooth.qualityTier,0,'one hitch must not degrade a smooth device');
smooth.document.hidden=true;
for(let i=0;i<300;i++)smooth.monitorFrameBudget(0.1);
assert.equal(smooth.qualityTier,0,'background frames cannot demote quality');
slow.MIN_RENDER_SCALE=1; slow.buildQualityLadder();
assert.equal(slow.RES_TIER_COUNT,0,'resize removes unavailable supersampling rungs');
assert.equal(slow.TIER_MSAA_OFF,0,'phone ladder has no inert MSAA rung');
const rotated=controller(false,0.5);
rotated.applyQualityTier(rotated.TIER_RES_START+1);
rotated.MIN_RENDER_SCALE=1;
const mappedResolution=rotated.rebuildViewportQualityTier();
rotated.applyQualityTier(mappedResolution);
assert.ok(rotated.aoActive && rotated.bloomActive && !rotated.shadowSlow,
  'losing supersampling rungs preserves lighting and bloom');
rotated.applyQualityTier(rotated.TIER_SHADOW_OFF);
rotated.MIN_RENDER_SCALE=0.5;
const mappedShadow=rotated.rebuildViewportQualityTier();
assert.equal(mappedShadow,rotated.TIER_SHADOW_OFF,'restoring supersampling preserves the shadow cost domain');
rotated.applyQualityTier(mappedShadow);
assert.ok(rotated.aoActive && rotated.bloomActive,'resize does not shed extra effects');
const events = {}, recovery=vm.createContext({
  canvas:{dataset:{},addEventListener:(name,fn)=>{events[name]=fn;}},
  musicStop(){},stopSpeech(){},musicStart(){},
  performance:{now:()=>1234},renderer:{shadowMap:{}},POST:{},
  started:true,gameOver:false,photoMode:false,musicEnabled:false,
  accum:1,last:0,presentationClock:200,photoRenderDirty:false,perfWarmup:10,
});
vm.runInContext(section('  var graphicsContextLost = false;','  function frame(now)'),recovery);
let prevented=false;
events.webglcontextlost({preventDefault(){prevented=true;}});
assert.ok(prevented && recovery.graphicsContextLost,'context loss pauses presentation and permits restoration');
events.webglcontextrestored();
assert.ok(!recovery.graphicsContextLost && recovery.photoRenderDirty && recovery.renderer.shadowMap.needsUpdate);
assert.equal(recovery.accum,0,'GPU restore discards stale simulation time');
assert.equal(recovery.last,1234);
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const t=vm.createContext({console});vm.runInContext(scripts.find(s=>s.includes('three.js r156 (MIT)')),t);
const cache = new Map();
const merge=new Function('THREE', section('  function mergeBoxes(specs) {','\n  // DRAW-CALL CONSOLIDATION:')+';return mergeBoxes;')(t.THREE);
const tree=new Function('THREE','cached','mergeBoxes',section('  function sculptedCanopyGeometry() {','  function makeTree()')+';return sculptedCanopyGeometry;')(
  t.THREE,(key,fn)=>{if(!cache.has(key))cache.set(key,fn());return cache.get(key);},merge);
const canopy=tree();
assert.equal(canopy,tree(),'all tree crowns share one geometry');
assert.ok(canopy.attributes.position.count/3 < 3600,'sculpted canopy triangle budget');
assert.ok([...canopy.attributes.position.array,...canopy.attributes.color.array].every(Number.isFinite));
canopy.computeBoundingBox();
assert.ok(canopy.boundingBox.max.x < 2.05 && canopy.boundingBox.min.x > -2.05,'canopy stays inside live cull bounds');
// Exercise the actual lamp factory and batching functions with the shipped
// merger. Material/primitive stubs avoid texture painting, not geometry logic.
const THREE=t.THREE, lampCache=new Map();
// Execute the shipped ground clone and cel patch against the embedded r156.
// A tint-only material must share GPU textures and keep the shader hook that
// Three intentionally does not copy with Material.clone().
const groundContext=vm.createContext({THREE,window:{}});
vm.runInContext(section('  var CEL_BANDS =', '  // ---------------------------------------------- shared flat-prop material'),groundContext);
const cobbleMaterial=groundContext.applyCelShading(new THREE.MeshStandardMaterial({
  map:new THREE.Texture(),normalMap:new THREE.Texture(),roughnessMap:new THREE.Texture(),roughness:1
}));
const bareGroundClone=cobbleMaterial.clone();
assert.equal(bareGroundClone.onBeforeCompile,THREE.Material.prototype.onBeforeCompile,'r156 clone omits shader callback');
assert.equal(bareGroundClone.customProgramCacheKey,THREE.Material.prototype.customProgramCacheKey,'r156 clone omits custom program key');
groundContext.MAT={cobble:cobbleMaterial};
vm.runInContext(section('  MAT.tramBed = applyCelShading(MAT.cobble.clone());', '  // Same treatment for the viaduct masonry'),groundContext);
const bedMaterial=groundContext.MAT.tramBed;
for(const channel of ['map','normalMap','roughnessMap'])assert.equal(bedMaterial[channel],cobbleMaterial[channel],`${channel} shares the existing GPU resource`);
assert.notEqual(bedMaterial.color,cobbleMaterial.color,'bed and gutters have independent colour uniforms');
assert.notEqual(bedMaterial.emissive,cobbleMaterial.emissive,'bed emission does not mutate gutters');
assert.equal(bedMaterial.customProgramCacheKey(),cobbleMaterial.customProgramCacheKey(),'tint-only bed retains the same cel program key');
function patchedGroundShader(material){const shader={uniforms:{},fragmentShader:THREE.ShaderLib.standard.fragmentShader};material.onBeforeCompile(shader);return shader;}
const bedShader=patchedGroundShader(bedMaterial),cobbleShader=patchedGroundShader(cobbleMaterial);
assert.equal(bedShader.fragmentShader,cobbleShader.fragmentShader,'clone gets exactly the same cel shader source');
assert.equal((bedShader.fragmentShader.match(/float celQuantize\(/g)||[]).length,1,'cel patch is applied once');
assert.equal(bedShader.uniforms.uCelBands,cobbleShader.uniforms.uCelBands,'both surfaces share live cel settings');
const chainedMaterial=new THREE.MeshStandardMaterial();
chainedMaterial.onBeforeCompile=shader=>{shader.uniforms.existingHook={value:1};};
chainedMaterial.customProgramCacheKey=()=> 'existing-hook';
groundContext.applyCelShading(chainedMaterial);
assert.equal(patchedGroundShader(chainedMaterial).uniforms.existingHook.value,1,'cel application preserves an existing shader hook');
assert.equal(chainedMaterial.customProgramCacheKey(),'cel-v1|existing-hook','cel application preserves an existing program key');
console.log('PASS: r156 ground clone shares all three texture resources; independent palette uniforms; single cel patch, identical program key and preserved callback chain.');
const cachedLamp=(key,fn)=>{if(!lampCache.has(key))lampCache.set(key,fn());return lampCache.get(key);};
const compact=new Function('THREE','mergeBoxes',section('  var staticMergeGeometryCache = new Map();','  // Merges building parts that carry different materials')+';return compactStaticPropGroup;')(THREE,merge);
const lampMaterials={};
for(const name of ['metalDark','poleGreen','chrome','lampGlobe'])lampMaterials[name]=new THREE.MeshStandardMaterial({transparent:name==='lampGlobe'});
const lampContext=vm.createContext({THREE,ASSETS:{},MAT:lampMaterials,cached:cachedLamp,
  cylGeo:(a,b,h,n)=>cachedLamp([a,b,h,n].join(','),()=>new THREE.CylinderGeometry(a,b,h,n)),
  roundedBox:(w,h,d,r,mat,x=0,y=0,z=0)=>{
    const m=new THREE.Mesh(cachedLamp([w,h,d,r].join(':'),()=>new THREE.BoxGeometry(w,h,d)),mat);
    m.position.set(x,y,z);return m;
  },
  flagGeo:new THREE.PlaneGeometry(0.6,0.4),FLAG_MATS:[new THREE.MeshBasicMaterial()],
  lampConeMat:new THREE.MeshBasicMaterial({transparent:true,blending:THREE.AdditiveBlending}),
  registerProp:(_kind,g)=>compact(g)
});
vm.runInContext(section('  function makeStreetLamp() {','  // One shared sculpted canopy:'),lampContext);
const lampRoot=new THREE.Group(), lamps=[lampContext.makeStreetLamp(),lampContext.makeStreetLamp()];
lamps.forEach((lamp,i)=>{lamp.position.set(i?9:-9,0.16,i?9:-11);lamp.rotation.y=i?0:Math.PI;lampRoot.add(lamp);});
const lampDrawsBefore=lamps.reduce((n,lamp)=>n+lamp.children.filter(o=>o.isMesh).length,0);
const lampBatches=lampContext.batchRigidChunkProps(lampRoot,lamps,'lamp');
lampContext.syncRigidChunkProps(lampBatches);
const lampDrawsAfter=lamps.reduce((n,lamp)=>n+lamp.children.filter(o=>o.isMesh).length,0)+lampBatches.length;
assert.equal(lampDrawsBefore-lampDrawsAfter,4,'paired street lamps save four opaque draws');
for (const batch of lampBatches) {
  assert.equal(batch.mesh.count,2);
  assert.equal(batch.mesh.castShadow,batch.entries[0].source.castShadow);
  assert.ok(batch.mesh.boundingSphere && Number.isFinite(batch.mesh.boundingSphere.radius));
  batch.entries.forEach((entry,i)=>{
    const expected=new THREE.Matrix4().multiplyMatrices(entry.prop.matrix,entry.local),actual=new THREE.Matrix4();
    batch.mesh.getMatrixAt(i,actual);
    assert.ok(actual.elements.every((v,j)=>Math.abs(v-expected.elements[j])<1e-5),'lamp batch preserves local transforms');
  });
}
lamps.forEach(lamp=>{
  assert.ok(lamp.children.includes(lamp.userData.flag) && lamp.children.includes(lamp.userData.flagStub),'flag remains independently toggled');
  assert.ok(lamp.children.includes(lamp.userData.bulb) && lamp.children.includes(lamp.userData.cone),'transparent layers retain original sorting');
});
lamps[0].visible=false;lampContext.syncRigidChunkProps(lampBatches);
assert.ok(lampBatches.every(b=>b.mesh.count===1),'individual authored lamp culling is preserved');
lamps[1].visible=false;lampContext.syncRigidChunkProps(lampBatches);
assert.ok(lampBatches.every(b=>b.mesh.count===0 && !b.mesh.visible),'empty lamp batches submit nothing');
lamps.forEach(l=>l.visible=true);lampContext.syncRigidChunkProps(lampBatches);
assert.ok(lampBatches.every(b=>b.mesh.count===2 && b.mesh.visible),'lamp reroll restores both instances');
// Four real tree factories reuse precisely the same opaque geometry. Their
// existing per-tree cull updates compact prefixes only on an actual transition.
lampContext.MAT.kerb=new THREE.MeshStandardMaterial();
lampContext.PROP_BARK=new THREE.MeshStandardMaterial();
lampContext.SOFT_TREE_CANOPY=new THREE.MeshStandardMaterial({vertexColors:true});
lampContext.sculptedCanopyGeometry=()=>canopy;
vm.runInContext(section('  function makeTree() {','  // Litfaßsäule'),lampContext);
const grove=new THREE.Group(), trees=Array.from({length:4},()=>lampContext.makeTree());
trees.forEach((tr,i)=>{tr.position.set(i%2?9:-9,0.16,-12+i*12);tr.rotation.y=i*0.7;tr.scale.setScalar(0.8+i*0.1);tr.userData.rolledActive=true;grove.add(tr);});
const treeDrawsBefore=trees.reduce((n,tr)=>n+tr.children.filter(o=>o.isMesh).length,0);
const treeBatches=lampContext.batchRigidChunkProps(grove,trees,'tree');
lampContext.syncRigidChunkProps(treeBatches);
assert.equal(treeDrawsBefore-treeBatches.length,12,'full four-tree grove saves twelve beauty draws');
assert.equal(treeBatches.filter(b=>b.mesh.castShadow).length,2,'trunk and crown retain their separate shadow behavior');
const crownBatch=treeBatches.find(b=>b.mesh.material===lampContext.SOFT_TREE_CANOPY);
assert.equal(crownBatch.mesh.geometry,canopy,'instancing keeps exact coloured canopy geometry');
for(const batch of treeBatches)batch.entries.forEach((entry,i)=>{
  const expected=new THREE.Matrix4().multiplyMatrices(entry.prop.matrix,entry.local),actual=new THREE.Matrix4();
  batch.mesh.getMatrixAt(i,actual);
  assert.ok(actual.elements.every((v,j)=>Math.abs(v-expected.elements[j])<1e-5),'grove retains individual scale, rotation and placement');
});
Object.assign(lampContext,{chunk:grove,ud:{trees,treeBatches},bulkNear:true,nearCullZ:-5});
const treeCull=section('    var treeBatchDirty = false;', '    // mass used to have');
vm.runInContext(treeCull,lampContext);
assert.ok(treeBatches.every(b=>b.mesh.count===3),'original trailing-canopy cull removes only the passed tree');
const treeVersion=crownBatch.mesh.instanceMatrix.version;
vm.runInContext(treeCull,lampContext);
assert.equal(crownBatch.mesh.instanceMatrix.version,treeVersion,'steady grove does not upload any new matrices');
lampContext.nearCullZ=50;vm.runInContext(treeCull,lampContext);
assert.ok(treeBatches.every(b=>b.mesh.count===0&&!b.mesh.visible),'fully passed grove submits nothing');
lampContext.nearCullZ=-50;vm.runInContext(treeCull,lampContext);
assert.ok(treeBatches.every(b=>b.mesh.count===4&&b.mesh.visible),'recycled grove restores every authored tree');
lampContext.ASSETS.props={tree:'optional.glb'};
assert.equal(lampContext.batchRigidChunkProps(grove,trees,'tree').length,0,'optional external tree assets retain original rendering path');
console.log('PASS: actual four-tree grove saves 12 beauty/6 caster submissions; exact canopy, transforms, existing cull, empty/recycled grove and change-only uploads.');
// Run the shipped warm-up orchestration against real Three scene objects.
// The renderer records work instead of compiling GPU programs in Node.
function checkProgramWarmup(postOn) {
  const warmScene=new THREE.Scene(), sun=new THREE.DirectionalLight();
  sun.castShadow=true; sun.shadow.mapSize.set(1024,1024); warmScene.add(sun);
  const material=new THREE.MeshStandardMaterial(), geometry=new THREE.BoxGeometry(1,1,1);
  const plain=new THREE.InstancedMesh(geometry,material,2);
  const tinted=new THREE.InstancedMesh(geometry,material,2); tinted.setColorAt(0,new THREE.Color()); tinted.count=0;
  const hiddenRoot=new THREE.Group(); hiddenRoot.visible=false;
  const hiddenMaterial=new THREE.MeshBasicMaterial();hiddenRoot.add(new THREE.Mesh(geometry,hiddenMaterial));
  warmScene.add(plain,tinted,hiddenRoot);
  const vertexGeometry=geometry.clone();vertexGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3),3));
  warmScene.add(new THREE.Mesh(vertexGeometry,material));
  const skinned=new THREE.SkinnedMesh(geometry,material),bone=new THREE.Bone();skinned.add(bone);skinned.bind(new THREE.Skeleton([bone]));warmScene.add(skinned);
  const alphaMaterial=new THREE.MeshBasicMaterial({transparent:true,side:THREE.DoubleSide});warmScene.add(new THREE.Mesh(geometry,alphaMaterial));
  const sourceRT=new THREE.WebGLRenderTarget(300,600,{type:THREE.HalfFloatType,samples:2});
  sourceRT.texture.colorSpace=THREE.NoColorSpace;
  let target=null,compiled=0,rendered=0,finished=false,atlasDisposed=0,proxyDisposed=0,targetDisposed=false,tick=0;
  const callbacks=[], canvas={dataset:{}};
  const renderer={shadowMap:{needsUpdate:false},getRenderTarget:()=>target,setRenderTarget:t=>{target=t;},
    compile(scene){
      compiled++;const meshes=scene.children.filter(o=>o.isMesh);
      assert.equal(meshes.length,6,'only actual six material/geometry/object shapes are gathered');
      assert.equal(meshes.filter(o=>o.isInstancedMesh).length,2,'plain and tinted pools each warm their actual shape once');
      assert.equal(meshes.filter(o=>o.isInstancedMesh&&o.instanceColor).length,1,'empty tinted pool keeps its allocated colour variant');
      assert.ok(meshes.some(o=>o.material===hiddenMaterial),'hidden future material is still covered');
      assert.ok(meshes.some(o=>o.isSkinnedMesh&&o.skeleton===skinned.skeleton),'skinning uses actual skeleton');
      assert.ok(meshes.some(o=>o.geometry===vertexGeometry),'vertex-colour geometry remains exact');
      assert.ok(meshes.every(o=>o.frustumCulled===false&&o.castShadow),'depth program coverage remains exhaustive');
      if(postOn){assert.equal(target.width,8);assert.equal(target.height,8);assert.equal(target.texture.type,sourceRT.texture.type);assert.equal(target.texture.colorSpace,sourceRT.texture.colorSpace);assert.equal(target.samples,sourceRT.samples);target.addEventListener('dispose',()=>{targetDisposed=true;});}
      else assert.equal(target,null,'direct renderer keeps canvas output/tone-mapping path');
    },
    render(scene){rendered++;const clonedSun=scene.children.find(o=>o.isDirectionalLight);assert.equal(clonedSun.shadow.mapSize.x,32);clonedSun.shadow.map={dispose(){atlasDisposed++;}};scene.children.forEach(o=>{if(o.isInstancedMesh)o.addEventListener('dispose',()=>{proxyDisposed++;});});}
  };
  const warmContext=vm.createContext({THREE,scene:warmScene,sun,renderer,POST:{on:postOn},sceneRT:sourceRT,camera:new THREE.PerspectiveCamera(),canvas,
    performance:{now:()=>tick++},requestAnimationFrame:fn=>callbacks.push(fn),
    unifyFlatPropMaterials:()=>({converted:0,baked:0,cloned:0}),batchChunkFlatDetails:()=>({sources:0,batches:0})});
  vm.runInContext(section('  function warmRemainingPrograms(done) {','  function maybeFinishPreload() {'),warmContext);
  warmContext.warmRemainingPrograms(()=>{finished=true;});
  assert.ok(!finished,'Start stays gated until depth warm-up and cleanup complete');
  while(callbacks.length)callbacks.shift()();
  assert.ok(finished&&compiled===1&&rendered===1);
  assert.equal(target,null);assert.equal(atlasDisposed,1);assert.equal(proxyDisposed,2);
  assert.equal(targetDisposed,postOn);assert.equal(sun.shadow.mapSize.x,1024,'gameplay shadow resolution is untouched');
  assert.equal(alphaMaterial.forceSinglePass,true);
  for(const field of ['warmObjects','warmGatherMs','warmCompileMs','warmDepthMs','warmTotalMs'])assert.ok(Number.isFinite(Number(canvas.dataset[field])),field);
}
checkProgramWarmup(true);checkProgramWarmup(false);
console.log('PASS: reachable shader shapes; tiny warm target keeps HDR/MSAA/colour space; hidden/skinned/depth coverage, gated completion, proxy/atlas cleanup, direct-render fallback.');
// Exercise the shipped reset fragment in strict mode: obsolete pool counters
// previously passed parsing but prevented the entire game from starting.
const poolReset = section('    if (pretzelSolidInst) {', '    clearParticles();');
const poolState = vm.createContext({pretzelSolidInst:{count:7,visible:true},pretzelHaloInst:{count:7,visible:true}});
vm.runInContext('"use strict";\n' + poolReset,poolState);
for (const pool of [poolState.pretzelSolidInst,poolState.pretzelHaloInst]) {
  assert.equal(pool.count,0); assert.equal(pool.visible,false);
}
vm.runInContext('pretzelSolidInst=null;pretzelHaloInst=null;',poolState);
vm.runInContext('"use strict";\n' + poolReset,poolState);
console.log(`PASS: collectible reset; actual lamp factory saves ${lampDrawsBefore-lampDrawsAfter} draws per visible pair; transforms, culling, shadow flags and independent transparent/flag layers preserved.`);
console.log('PASS: 30/60 Hz presentation at 59.94–144 Hz; stable traffic/shadow work at 30–144 Hz; allocation-free effect tier changes; single-commit rotation; Retina/4K pixel budgets; sustained pressure/recovery; context recovery; hitch/background guards; shared canopy geometry and bounds.');
