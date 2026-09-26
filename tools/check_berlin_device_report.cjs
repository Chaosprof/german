'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','berlin-runner.html'),'utf8');
function section(a,b) {
  const start=html.indexOf(a),end=html.indexOf(b,start+a.length);
  assert.ok(start>=0&&end>start,a);return html.slice(start,end);
}
const c=vm.createContext({console});
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map(m=>m[1]).find(s=>s.includes('three.js r156 (MIT)')),c);
const THREE=c.THREE;
Object.assign(c,{window:{location:{search:'?profile=1'},innerWidth:390,innerHeight:844,devicePixelRatio:3},
  navigator:{userAgent:'iPhone Safari test fixture'},IS_MOBILE:true,
  renderer:{capabilities:{isWebGL2:true},info:{render:{calls:123,triangles:456}}},
  started:true,gameOver:false,perfWarmup:10,qualityTier:0,renderScale:1,distance:100,
  aoActive:false,contactAORT:null,
  canvas:{width:780,height:1688,dataset:{postProcessing:'depth-composite',resolutionPolicy:'fixed-high-detail',pixelBudget:'1250000'}},
  scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),MAT:{},
  STREET_MAT:{}});
c.scene.fog=new THREE.Fog(0xdbe4e9,48,168);
Object.assign(c,{sun:new THREE.DirectionalLight(0xffdfb4,3.32),hemi:{intensity:1.10},fill:{intensity:.44},POST:{exposure:1.04},
  surfaceVistaRequested:true,surfaceVistaPrecision:'highp',surfaceVistaState:{map:null,enabled:0,strength:.65,fadeNear:120,fadeFar:178},
  skyTextures:[{image:{width:1536,height:1024},userData:{panoramaScale:3}}],
  skyMat:{uniforms:{uMapAScale:{value:3},uMix:{value:0},uDayAir:{value:1},uStreetVistaOn:{value:0}}}});
c.sun.position.set(-62,75,-9);c.sun.target.position.set(0,0,14);
c.BASE_EXPOSURE=1.04;c.shadowFocused=false;c.shadowSlow=false;
vm.runInContext(section('  var POST = {','  var postVert ='),c);
vm.runInContext(html.match(/  var SHADOW_BOX =[^;]+;/)[0],c);
c.sun.shadow.mapSize.set(c.SHADOW_MAP_SIZE,c.SHADOW_MAP_SIZE);
vm.runInContext(section('  function shadowRefreshPeriod() {','  // Broader load-shedding'),c);
vm.runInContext(section('  var PROFILE_RENDER =','  // Called in place of renderer.render'),c);
vm.runInContext(section('  function makeDeviceReport(deviceLabel) {','  var profilePanel = null;'),c);
c.profileSessionStarted=Date.UTC(2026,8,9,12);
function frames(n,dt) {for(let i=0;i<n;i++)c.profileFrame(dt);}
frames(603,1/60);
assert.equal(c.profileSession.length,2);
assert.ok(c.profileSession.every(s=>Math.abs(s.fps-60)<0.1));
// Partial old-size data is discarded on rotation, while completed evidence stays.
frames(120,1/60);
c.window.innerWidth=844;c.window.innerHeight=390;c.canvas.width=1688;c.canvas.height=780;
c.profileFrame(1/60);
assert.equal(c.profileSamples.length,0,'transition frame belongs to neither new sample window');
frames(151,1/30);
assert.equal(c.profileSession.length,3);
const landscape=c.profileSession[2];
assert.deepEqual(Array.from(landscape.viewport),[844,390]);
assert.deepEqual(Array.from(landscape.buffer),[1688,780]);
assert.ok(Math.abs(landscape.fps-30)<0.1);
// Adaptive buffer resizing also starts a fresh window without mixing frame sizes.
frames(45,1/30);c.canvas.width=1350;c.canvas.height=624;c.profileFrame(1/30);
assert.equal(c.profileSamples.length,0);frames(301,1/60);
assert.equal(c.profileSession.length,4);
const report=c.makeDeviceReport('iPhone test · Low Power Mode off');
assert.equal(report.device,'iPhone test · Low Power Mode off');
assert.equal(report.dpr,3);assert.equal(report.mobilePath,true);
assert.equal(report.presentation.resolutionPolicy,'fixed-high-detail');
assert.equal(report.presentation.pixelBudget,1250000);
assert.equal(report.presentation.scenePixels,1350*624,'report gives actual latest scene allocation');
assert.equal(report.renderer.gpuTimer,'unavailable','unsupported GPU timer never blocks a report');
assert.equal(report.lighting.setting,'fixed warm daylight');
assert.deepEqual(Array.from(report.lighting.sun.position),[-62,75,-9]);
assert.equal(report.lighting.sun.intensity,3.32);
assert.equal(report.lighting.sky.painted,true,'report identifies the loaded plate instead of assuming it loaded');
assert.deepEqual([report.lighting.sky.width,report.lighting.sky.height,report.lighting.sky.horizontalScale],[1536,1024,3]);
assert.deepEqual([report.lighting.sky.elevationScale,report.lighting.sky.elevationOffset],[1.35,.34]);
assert.deepEqual([report.lighting.sky.mix,report.lighting.sky.dayAir],[0,1]);
assert.equal(report.lighting.sky.distantStreetLoaded,false,'a requested city backdrop is not reported as loaded before decode');
assert.equal(report.lighting.sky.surfaceStreet.requested,true);
assert.equal(report.lighting.sky.surfaceStreet.loaded,false);
assert.equal(report.lighting.sky.surfaceStreet.enabled,false);
assert.deepEqual(Array.from(report.lighting.sky.surfaceStreet.depthFade),[120,178]);
assert.deepEqual(Array.from(report.lighting.sky.surfaceStreet.signedElevation),[-.022,.045]);
c.surfaceVistaState.map=new THREE.Texture();c.surfaceVistaState.enabled=1;
assert.equal(c.makeDeviceReport('surface ready').lighting.sky.surfaceStreet.enabled,true);
c.surfaceVistaRequested=false;c.surfaceVistaState.enabled=0;
const surfaceOptOut=c.makeDeviceReport('surface disabled').lighting.sky.surfaceStreet;
assert.equal(surfaceOptOut.loaded,true);assert.equal(surfaceOptOut.requested,false);assert.equal(surfaceOptOut.enabled,false);
c.surfaceVistaRequested=true;c.surfaceVistaState.map=null;
c.skyMat.uniforms.uStreetVistaOn.value=1;
assert.equal(c.makeDeviceReport('loaded city').lighting.sky.distantStreetLoaded,true);
c.skyTextures[0]={image:{width:2048,height:512},userData:{}};c.skyMat.uniforms.uMapAScale.value=1;
const fallbackSkyReport=c.makeDeviceReport('sky fallback').lighting.sky;
assert.equal(fallbackSkyReport.painted,false);
assert.deepEqual([fallbackSkyReport.elevationScale,fallbackSkyReport.elevationOffset],[1,0],'procedural fallback reports its own projection');
assert.equal(report.configurations.length,3,'rotation and adaptive resolution are separated');
assert.equal(report.configurations[0].averageFps,60);
assert.ok(Math.abs(report.configurations[1].averageFps-30)<0.1);
assert.equal(report.startedAt,'2026-09-09T12:00:00.000Z');
assert.notEqual(report.windows,c.profileSession,'report owns its window list');
// Inspect actual Three meshes only on report request. Labels and rectangles
// must identify a large exposed wall, while normal frame collection stays inert.
c.camera.position.set(0,3,18);c.camera.lookAt(0,3,0);c.camera.updateMatrixWorld(true);
const wallMaterial=new THREE.MeshStandardMaterial({color:0x8899aa});c.MAT.concrete=wallMaterial;
const chunk=new THREE.Group();chunk.userData.chunkSlot=2;c.scene.add(chunk);
const wall=new THREE.Mesh(new THREE.BoxGeometry(8,7,.4),wallMaterial);
wall.position.y=3.5;chunk.add(wall);chunk.userData.courtyard=wall;
const ground=new THREE.Mesh(new THREE.PlaneGeometry(40,40),wallMaterial);
ground.name='excluded ground';ground.rotation.x=-Math.PI/2;chunk.add(ground);
const offscreen=new THREE.Mesh(new THREE.BoxGeometry(8,7,.4),wallMaterial);
offscreen.name='excluded offscreen';offscreen.position.set(400,3.5,0);chunk.add(offscreen);
const hidden=wall.clone();hidden.name='excluded hidden';hidden.visible=false;chunk.add(hidden);
const materialHidden=wall.clone();materialHidden.name='excluded material-hidden holder';
materialHidden.material=wallMaterial.clone();materialHidden.material.visible=false;chunk.add(materialHidden);
const textured=new THREE.Mesh(new THREE.BoxGeometry(8,7,.4),new THREE.MeshStandardMaterial({map:new THREE.Texture()}));
textured.name='excluded textured';textured.position.set(0,3.5,-1);chunk.add(textured);
const tiny=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),wallMaterial);tiny.name='excluded tiny';chunk.add(tiny);
const instanced=new THREE.InstancedMesh(new THREE.BoxGeometry(3,2,.2),wallMaterial,2);
instanced.name='instanced return';instanced.setMatrixAt(0,new THREE.Matrix4().makeTranslation(0,3,-2));
instanced.setMatrixAt(1,new THREE.Matrix4().makeTranslation(400,3,-2));chunk.add(instanced);
instanced.count=0;instanced.userData.streetFixtureBeautyCount=2;
c.scene.updateMatrixWorld(true);
const childrenBefore=chunk.children.slice(),positionsBefore=Array.from(wall.geometry.attributes.position.array);
const instancesBefore=Array.from(instanced.instanceMatrix.array),callsBefore=c.renderer.info.render.calls;
const surfaceReport=c.makeDeviceReport('wall inspection'),surfaces=surfaceReport.renderer.visibleSurfaces;
assert.equal(surfaces.length,2,'only large visible untextured vertical wall and instance are reported');
const wallSurface=surfaces.find(s=>s.source.endsWith('/courtyard'));
assert.ok(wallSurface && wallSurface.source.includes('chunk[2]'),'source ancestry identifies the owned courtyard surface');
assert.deepEqual(Array.from(wallSurface.geometrySize),[8,7,.4]);
assert.equal(wallSurface.materials[0].name,'MAT.concrete');
assert.equal(wallSurface.materials[0].color,'8899aa');assert.equal(wallSurface.materials[0].map,null);
assert.ok(wallSurface.screenRect[0]<.5 && wallSurface.screenRect[2]>.5 && wallSurface.screenRect[1]<wallSurface.screenRect[3],
  'normalized projected rectangle surrounds the known centered wall');
assert.equal(surfaces.find(s=>s.source.endsWith('/instanced return')).instance,0,'offscreen instance is excluded independently');
assert.deepEqual(chunk.children,childrenBefore,'inspection never re-parents or removes a surface');
assert.deepEqual(Array.from(wall.geometry.attributes.position.array),positionsBefore,'inspection preserves the mesh');
assert.deepEqual(Array.from(instanced.instanceMatrix.array),instancesBefore,'inspection preserves instance transforms');
assert.equal(c.renderer.info.render.calls,callsBefore,'inspection adds no render calls');
for(let i=0;i<24;i++) {
  const filler=new THREE.Mesh(new THREE.BoxGeometry(3,2,.2),wallMaterial);
  filler.name='bounded wall '+i;filler.position.set(0,3,-4-i*.3);chunk.add(filler);
}
c.scene.updateMatrixWorld(true);
assert.equal(c.makeDeviceReport('bounded inspection').renderer.visibleSurfaces.length,20,'surface output is bounded to twenty entries');
c.PROFILE_RENDER=false;
assert.equal(c.makeDeviceReport('ordinary URL').renderer.visibleSurfaces.length,0,'ordinary URLs do not inspect surfaces');
c.PROFILE_RENDER=true;c.scene.remove(chunk);
// Opaque gate holders keep object visibility for animation/state while their
// materials suppress the original draws. Geometry inventory must count only
// the visible pool, including when a holder shares its exact geometry.
const inventoryGeo=new THREE.BoxGeometry(1,1,1),inventoryMat=new THREE.MeshBasicMaterial();
const inventoryVisible=new THREE.InstancedMesh(inventoryGeo,inventoryMat,2);inventoryVisible.frustumCulled=false;
inventoryVisible.count=0;inventoryVisible.userData.streetFixtureBeautyCount=2;c.scene.add(inventoryVisible);
const inventoryHiddenMat=inventoryMat.clone();inventoryHiddenMat.visible=false;
const inventoryHolder=new THREE.Mesh(inventoryGeo,inventoryHiddenMat);inventoryHolder.frustumCulled=false;c.scene.add(inventoryHolder);
const inventoryHiddenGroups=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),[inventoryHiddenMat,inventoryHiddenMat]);
inventoryHiddenGroups.frustumCulled=false;c.scene.add(inventoryHiddenGroups);
// The thermal run is bounded at ten minutes; the live canvas retains one minute.
frames(60*60*11,1/60);
assert.equal(c.profileSession.length,120);assert.equal(c.profileHistory.length,12);
assert.equal(JSON.parse(c.canvas.dataset.profileHistory).length,12);
const visibleGeometryCosts=JSON.parse(c.canvas.dataset.profileGeometry);
assert.equal(visibleGeometryCosts.length,1,'material-hidden holders/groups are excluded from reported geometry');
assert.equal(visibleGeometryCosts[0].nodes,1,'a source holder sharing the pool geometry is never counted twice');
assert.equal(visibleGeometryCosts[0].instances,2,'geometry inventory reports beauty count rather than the restored shadow prefix');
c.scene.remove(inventoryVisible,inventoryHolder,inventoryHiddenGroups);
// Refresh overhead must be measured independently from steady render cost.
let stageClock=100;c.performance={now:()=>stageClock};c.profileStageAt=stageClock;
c.profileSamples.length=0;c.profileElapsed=0;c.profileStages.fill(0);c.profileRenderBuckets.fill(0);
c.shadowRefreshDue=false;stageClock=103;c.profileStage(3);stageClock=108;c.profileStage(3);
c.shadowRefreshDue=true;stageClock=120;c.profileStage(3);c.profileFrame(5.1);
const costs=c.profileSession[c.profileSession.length-1].renderCpuMs;
assert.equal(costs.steady,4,'steady render bucket averages its own two 3ms/5ms samples');
assert.equal(costs.shadowRefresh,12,'refresh bucket retains the separate 12ms sample');
assert.deepEqual(Array.from(c.profileRenderBuckets),[0,0,0,0],'completed windows reset both render buckets');
c.profileFrame(5.1);
assert.equal(c.profileSession[c.profileSession.length-1].renderCpuMs.steady,null,'missing render samples remain unavailable');
assert.equal(c.profileSession[c.profileSession.length-1].renderCpuMs.shadowRefresh,null,'missing shadow samples remain unavailable');
// One sampled beauty frame uses the documented material callback. Restore the
// original hooks and exclude capture overhead plus the following rAF interval.
Object.assign(c,{photoMode:false,frameNumber:42,shadowRefreshDue:false,
  facadeMats:[],facadeCoreMats:[],facadeTrimCoreMats:[],shopMats:[],AWNING_MATS:[],hangingSignMats:[],
  rig:new THREE.Group(),trafficRoot:new THREE.Group(),chunks:[],ALL_POOLS:[],PROP_FLAT_MAT:null});
const countMaterial=new THREE.MeshStandardMaterial(),doubleMaterial=new THREE.MeshBasicMaterial({
  transparent:true,side:THREE.DoubleSide,forceSinglePass:false});
let hookCalls=0,hookObject=null;
const savedHook=countMaterial.onBeforeRender=function(r,s,cam,geo,obj){hookCalls++;hookObject=obj;};
const capturedMesh=new THREE.Mesh(new THREE.BoxGeometry(),countMaterial);
const capturedInstances=new THREE.InstancedMesh(capturedMesh.geometry,countMaterial,4);
const capturedDouble=new THREE.Mesh(capturedMesh.geometry,doubleMaterial);
c.scene.add(capturedMesh,capturedInstances,capturedDouble);
c.profileInventoryRequested=true;c.profileInventoryBegin();
assert.notEqual(countMaterial.onBeforeRender,savedHook,'callback is installed only for the requested frame');
assert.equal(c.profileInventorySkip,2);
countMaterial.onBeforeRender(c.renderer,c.scene,c.camera,capturedMesh.geometry,capturedMesh,{start:0,count:6});
capturedInstances.count=2;
countMaterial.onBeforeRender(c.renderer,c.scene,c.camera,capturedInstances.geometry,capturedInstances,null);
capturedInstances.count=0;
countMaterial.onBeforeRender(c.renderer,c.scene,c.camera,capturedInstances.geometry,capturedInstances,null);
doubleMaterial.onBeforeRender(c.renderer,c.scene,c.camera,capturedDouble.geometry,capturedDouble,null);
countMaterial.onBeforeRender(c.renderer,new THREE.Scene(),c.camera,capturedMesh.geometry,capturedMesh,null);
c.profileInventoryEnd();
const inventory=JSON.parse(c.canvas.dataset.profileMaterials);
assert.equal(inventory.draws,4,'one group, one nonempty instanced draw and two transparent-side submissions');
assert.equal(inventory.triangles,50,'group range, live instance prefix and double-side triangles are counted');
assert.equal(inventory.excludesShadowAndPost,true);
assert.equal(inventory.domains[0].draws,4);assert.equal(inventory.materials.length,2);
assert.equal(countMaterial.onBeforeRender,savedHook,'original callback identity is restored immediately');
assert.equal(hookCalls,4);assert.equal(hookObject,capturedMesh,'existing hook receives its original object argument');
assert.equal(c.profileInventoryHooks.length,0);assert.equal(c.profileInventoryRows,null);
c.profileSamples.length=0;c.profileElapsed=0;c.profileStages.fill(0);c.profileRenderBuckets.fill(0);
stageClock+=50;c.profileStage(3);c.profileFrame(.050);
stageClock+=40;c.profileStage(3);c.profileFrame(.040);
assert.equal(c.profileSamples.length,0);assert.equal(c.profileElapsed,0);
assert.deepEqual(Array.from(c.profileStages),[0,0,0,0],'instrumented CPU samples are excluded');
assert.equal(c.profileInventorySkip,0);
c.profileFrame(1/60);assert.equal(c.profileSamples.length,1,'ordinary intervals resume recording');
assert.equal(c.makeDeviceReport('draw inventory').renderer.materialSubmissions.draws,4,'export carries the actual sampled inventory');
// The actual shape facade calls its palette's live hook. Capturing both
// owners must still count each real draw exactly once, in either wrapper
// installation order, while preserving the user's callback.
c.renderer.setOpaqueSort=()=>{};
vm.runInContext(section('  var materialShapeFamilies =','  function mat(color, opts) {'),c);
c.installMaterialShapes();
const capturedFacade=capturedInstances.material,facadeHook=capturedFacade.onBeforeRender;
assert.notEqual(capturedFacade,countMaterial);
for(const facadeFirst of [false,true]){
  if(facadeFirst){c.scene.remove(capturedMesh);c.scene.add(capturedMesh);}
  const originalCalls=hookCalls;
  c.profileInventoryRequested=true;c.profileInventoryBegin();
  capturedInstances.count=2;
  countMaterial.onBeforeRender(c.renderer,c.scene,c.camera,capturedMesh.geometry,capturedMesh,{start:0,count:6});
  capturedFacade.onBeforeRender(c.renderer,c.scene,c.camera,capturedInstances.geometry,capturedInstances,null);
  doubleMaterial.onBeforeRender(c.renderer,c.scene,c.camera,capturedDouble.geometry,capturedDouble,null);
  c.profileInventoryEnd();
  const ownedInventory=JSON.parse(c.canvas.dataset.profileMaterials);
  assert.equal(ownedInventory.draws,4,'facade delegation never invents a second instance draw');
  assert.equal(ownedInventory.triangles,50,'source and facade triangles are counted once');
  assert.equal(ownedInventory.materials.length,3,'ordinary, instanced and transparent draws retain their actual owners');
  assert.equal(hookCalls-originalCalls,2,'each actual Standard-material draw still invokes the live original hook once');
  assert.equal(capturedFacade.onBeforeRender,facadeHook);assert.equal(countMaterial.onBeforeRender,savedHook);
}
capturedMesh.material=[countMaterial,doubleMaterial];
c.profileInventoryRequested=true;c.profileInventoryBegin();
countMaterial.onBeforeRender(c.renderer,c.scene,c.camera,capturedMesh.geometry,capturedMesh,{materialIndex:0,start:0,count:6});
c.scene.overrideMaterial=countMaterial;
countMaterial.onBeforeRender(c.renderer,c.scene,c.camera,capturedInstances.geometry,capturedInstances,null);
c.scene.overrideMaterial=null;c.profileInventoryEnd();
const groupedInventory=JSON.parse(c.canvas.dataset.profileMaterials);
assert.equal(groupedInventory.draws,2,'group-selected and scene-override owners remain countable');
assert.equal(groupedInventory.triangles,26);assert.equal(groupedInventory.materials.length,1);
c.profileInventorySkip=0;
c.scene.remove(capturedMesh,capturedInstances,capturedDouble);
// Ordinary URLs perform no recording and create no profile-only DOM panel.
c.PROFILE_RENDER=false;const stored=c.profileSession.length;frames(1000,1/60);
assert.equal(c.profileSession.length,stored);
c.profileInventoryRequested=true;c.profileInventoryBegin();
assert.equal(c.profileInventoryRows,null,'ordinary URL never installs inventory hooks');
const flags=section('  var PROFILE_RENDER =','  var profileStages =');
for(const [query,indexed] of [['?index=0',true],['?profile=1&index=0',false],['?profile=1&index=01',true]]) {
  c.window.location.search=query;vm.runInContext(flags,c);
  assert.equal(c.INDEX_RIGID_GEOMETRY,indexed,'unindexed comparison is opt-in and exact');
}
for(const [query,culled] of [['?poolcull=0',true],['?profile=1&poolcull=0',false],['?profile=1&poolcull=01',true]]) {
  c.window.location.search=query;vm.runInContext(flags,c);
  assert.equal(c.CULL_SHARED_POOLS,culled,'unculled comparison is opt-in and exact');
}
console.log('PASS: shipped frame collector/report; weighted FPS, viewport/buffer separation, bounded history, optional GPU timing, separate steady/shadow costs, bounded report-only surface identification and no inspection/recording on ordinary URLs.');
