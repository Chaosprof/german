'use strict';
// Exercise the shipped controller and geometry, without a mocked copy of either.
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const path = require('path');
const useKiezLamps = process.argv.includes('--kiez-lamps');
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
  LOCK_MOBILE_PRESENTATION:false,STABLE_PRESENTATION_SCALE:1,
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
// Compact desktop panels must retain desktop rendering defaults; a phone's
// rendering path must likewise survive portrait-to-landscape rotation.
const deviceSource = section('  var HAS_FINE_POINTER =', '  // Fill cost is a function');
for (const [width,fine,mobile] of [[393,true,false],[762,true,false],[1280,true,false],
  [393,false,true],[844,false,true],[1366,true,false]]) {
  const c=vm.createContext({window:{innerWidth:width,matchMedia:()=>({matches:fine})}});
  vm.runInContext(deviceSource,c);
  assert.equal(c.IS_MOBILE,mobile, `${width}px ${fine?'fine':'coarse'} pointer rendering path`);
}
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
    IS_MOBILE:mobile,LOCK_MOBILE_PRESENTATION:mobile,STABLE_PRESENTATION_SCALE:1,
    clamp:(x,a,b)=>Math.max(a,Math.min(x,b)), lerp:(a,b,t)=>a+(b-a)*t,
    POST:{dofOn:false,aoOn:true,bloomOn:true,outlineOn:true},
    sceneRTBaseSamples:mobile?0:2, MIN_RENDER_SCALE:minScale,
    EMERGENCY_RENDER_SCALE:0.92, renderScale:1, emergencyResolutionActive:false,
    started:true,gameOver:false,document:{hidden:false},canvas:{dataset:{}},
    shadowFocused:false,applyShadowScope(focused){c.shadowFocused=focused;},setSceneRTLeanMode(){},
    applyRenderScale(s){c.renderScale=s;},
    passBeautyCalls:0,passOutlineCalls:0,passPostCalls:0,
    passBeautyTriangles:0,passOutlineTriangles:0,passPostTriangles:0,
  });
  vm.runInContext(section('  var frameNumber = 0;', '  var presentationClock = 0;'),c);
  return c;
}
const slow = controller(false,0.52);
for (let i=0;i<1000;i++) {slow.frameNumber++;slow.monitorFrameBudget(Math.max(1/60,slow.renderScale*slow.renderScale/30));}
assert.ok(slow.qualityTier > 0, 'fill pressure keeps resolution reductions that measurably help');
assert.ok(slow.renderScale < 1, 'adaptive desktop recovers fill budget');
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
const phone=controller(true,0.52);
assert.equal(phone.TIER_MSAA_OFF,0,'phone ladder has no inert MSAA rung');
assert.equal(phone.RES_TIER_COUNT,0,'phone has no resolution-reduction rungs');
assert.equal(phone.QUALITY_TIER_MAX,2,'phone retains only cadence/particle relief');
assert.equal(phone.TIER_BLOOM_OFF,0,'phone never drops the lighting finish');

// Exercise the actual allocator together with every mobile tier and sustained
// frame-pressure trace. Even a direct emergency/low-scale request cannot erase
// Retina detail. Desktop adaptation is covered independently below.
for(const [width,height,dpr] of [[375,667,2],[390,844,3],[430,932,3],[844,390,3],[1024,1366,2]]) {
  const c=controller(true,.5);let allocations=0;
  c.window={innerWidth:width,innerHeight:height,devicePixelRatio:dpr};
  c.renderer={setDrawingBufferSize(w,h,ratio){allocations++;c.canvas.width=Math.floor(w*ratio);c.canvas.height=Math.floor(h*ratio);}};
  vm.runInContext(budgetSource,c);
  vm.runInContext(section('  var renderScale = 1;','  renderer.outputColorSpace ='),c);
  const pixels=c.canvas.width*c.canvas.height;
  assert.equal(c.canvas.dataset.resolutionPolicy,'fixed-high-detail');
  assert.ok(pixels<=1250000 && pixels>Math.min(width*height*dpr*dpr,1250000)*.99);
  for(const requestedScale of [.92,.5,.1,0,1]) {
    c.emergencyResolutionActive=true;c.applyRenderScale(requestedScale);
    assert.equal(c.renderScale,1);assert.equal(c.canvas.width*c.canvas.height,pixels);
  }
  c.emergencyResolutionActive=false;
  for(let tier=0;tier<=c.QUALITY_TIER_MAX;tier++) {
    c.applyQualityTier(tier);assert.equal(c.renderScale,1);
    assert.ok(c.aoActive && c.bloomActive && c.outlineActive);
    assert.equal(c.emergencyResolutionActive,false);
  }
  for(const frameMs of [1000/60,25,1000/30,80,1000/60]) {
    for(let frame=0;frame<Math.ceil(180000/frameMs);frame++) {
      c.frameNumber++;c.monitorFrameBudget(frameMs/1000);
      assert.equal(c.renderScale,1);
      assert.ok(c.aoActive && c.bloomActive && c.outlineActive);
      assert.equal(c.canvas.width*c.canvas.height,pixels);
    }
  }
  assert.equal(allocations,1,'15-minute pressure/recovery trace never reallocates the mobile scene');
}
console.log('PASS: fixed mobile sampling/lighting at five Retina phone/tablet/landscape sizes; every tier, emergency requests, and 15-minute slow/recovery traces retain the exact opening buffer.');
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
// Run deterministic frame-cost traces through the shipped controller. These
// are responses to actual tier choices, so an ineffective rung cannot appear
// useful merely because a test supplies a faster stream after every demotion.
function qualityTrace(c,seconds,frameCost) {
  let elapsed=0, previous=c.qualityTier;
  const transitions=[];
  while(elapsed<seconds) {
    const ms=frameCost(c);
    c.frameNumber++;c.monitorFrameBudget(ms/1000);elapsed+=ms/1000;
    if(c.qualityTier!==previous) {
      transitions.push({at:elapsed,from:previous,to:c.qualityTier});previous=c.qualityTier;
    }
  }
  return transitions;
}
function settledController(ms) {
  const c=controller(false,.8);c.perfWarmup=3;c.perfEmaMs=ms;return c;
}
// One dropped refresh per15 frames is a visible ~56fps cadence, even though
// it never reaches the old52fps demotion threshold. Only resolution affects
// this trace; measured recovery must preserve all lighting and scene detail.
const nearBudget=controller(false,.8);
qualityTrace(nearBudget,30,c=>c.renderScale<.97?1000/60:(c.frameNumber%15===0?1000/30:1000/60));
assert.ok(nearBudget.renderScale<1&&nearBudget.renderScale>.85,
  'sustained near60fps misses trigger a small useful supersampling reduction');
assert.ok(nearBudget.qualityTier<nearBudget.TIER_SHADOW_SLOW&&nearBudget.aoActive&&nearBudget.bloomActive,
  'near-budget recovery keeps all lighting and geometry detail');
for(const ms of [20,1000/30]) {
  const c=controller(false,.8), moves=qualityTrace(c,70,()=>ms);
  assert.ok(moves.some(m=>m.to===c.QUALITY_TIER_MAX),'ineffective early rungs must not prevent deeper domains being explored');
  assert.equal(c.qualityTier,0,`${ms.toFixed(2)}ms unchanged frames restore the original picture`);
  assert.equal(c.ladderCeiling,0,'unchanged pressure does not repeat the unsuccessful walk');
  assert.ok(c.aoActive && c.bloomActive && !c.shadowSlow && !c.shadowFocused && c.outlineActive);
  assert.equal(c.renderScale,1);assert.equal(c.ladderProbeUntil,0);
}
const early=settledController(26);
qualityTrace(early,60,c=>c.qualityTier>=c.TIER_MSAA_OFF?22:26);
assert.equal(early.qualityTier,early.TIER_MSAA_OFF,'later ineffective reductions restore the useful AA checkpoint');
assert.ok(early.aoActive && early.bloomActive && !early.shadowSlow);
const severeEarly=settledController(40);
qualityTrace(severeEarly,50,c=>c.qualityTier>=2?34:40);
assert.equal(severeEarly.qualityTier,2,'EMA carryover must not credit an ineffective rung after a useful severe-load bundle');
assert.ok(Math.abs(severeEarly.ladderCheckpointMs-34)<1e-9,'checkpoint verdict measures settled intervals, not the previous rung EMA tail');
const cumulative=settledController(26);
qualityTrace(cumulative,60,c=>26-Math.min(c.qualityTier,4)*.24);
assert.equal(cumulative.qualityTier,4,'four sub-1% savings accumulate into a useful checkpoint');
assert.ok(cumulative.aoActive && cumulative.bloomActive && !cumulative.shadowSlow);
const deep=settledController(26);
const deepMoves=qualityTrace(deep,70,c=>c.qualityTier>=c.TIER_SHADOW_OFF?1000/60:26);
assert.ok(deepMoves.some(m=>m.to===deep.TIER_SHADOW_OFF),'ineffective resolution steps still reach useful shadow relief');
assert.equal(deep.qualityTier,deep.TIER_SHADOW_OFF,'useful deep recovery is retained');
assert.equal(deep.ladderCheckpointTier,deep.TIER_SHADOW_OFF);
assert.equal(deep.promoteFloor,deep.TIER_SHADOW_OFF,'failed promotions retain the measured recovery tier');
assert.ok(deepMoves.some(m=>m.from===deep.TIER_SHADOW_OFF && m.to===deep.TIER_SHADOW_OFF-1),'comfortable play still tries a promotion');
assert.ok(deep.aoActive && deep.bloomActive,'useful shadow relief never needlessly reaches AO/bloom cuts');
qualityTrace(deep,35,()=>1000/60);
assert.ok(deep.qualityTier<deep.TIER_SHADOW_OFF,'sustained changed conditions can promote past the remembered floor');
const recoveredTop=settledController(20);
qualityTrace(recoveredTop,50,()=>20);
assert.equal(recoveredTop.ladderCeiling,0);
qualityTrace(recoveredTop,16,()=>1000/60);
assert.equal(recoveredTop.ladderCeiling,recoveredTop.QUALITY_TIER_MAX,'full-quality recovery also reopens exploration for later load');
qualityTrace(recoveredTop,35,c=>c.qualityTier>=c.TIER_SHADOW_OFF?1000/60:26);
assert.equal(recoveredTop.qualityTier,recoveredTop.TIER_SHADOW_OFF,'a prior no-benefit verdict cannot block relief after sustained recovery');
const interruptedProbe=settledController(26);
qualityTrace(interruptedProbe,1.3,()=>26);
assert.ok(interruptedProbe.ladderProbeUntil>0);
const frozenProbe=[interruptedProbe.ladderProbeUntil,interruptedProbe.ladderProbeFrames,interruptedProbe.ladderProbeMs,
  interruptedProbe.ladderCheckpointTier,interruptedProbe.ladderCheckpointMs];
interruptedProbe.document.hidden=true;
qualityTrace(interruptedProbe,5,()=>100);
assert.deepEqual([interruptedProbe.ladderProbeUntil,interruptedProbe.ladderProbeFrames,interruptedProbe.ladderProbeMs,
  interruptedProbe.ladderCheckpointTier,interruptedProbe.ladderCheckpointMs],frozenProbe,'background time contributes no probe evidence');
interruptedProbe.document.hidden=false;
interruptedProbe.promoteFloor=4;interruptedProbe.promoteWatch=3;
const retainedRetryTier=interruptedProbe.qualityTier;
vm.runInContext(section('    // A fresh run re-measures the device from scratch,', '    // Retain measured quality across retries;'),interruptedProbe);
assert.equal(interruptedProbe.qualityTier,retainedRetryTier,'retry retains its current picture');
assert.equal(interruptedProbe.ladderCheckpointTier,retainedRetryTier);
assert.equal(interruptedProbe.ladderCheckpointMs,0);assert.equal(interruptedProbe.ladderProbeFrames,0);
assert.equal(interruptedProbe.ladderProbeUntil,0);assert.equal(interruptedProbe.promoteFloor,0);
// Exercise the real resize commit, including remapped rung numbers and an
// interrupted probe. Identical viewport notifications remain a no-op.
const resized=settledController(26);
Object.assign(resized,{window:{innerWidth:1280,innerHeight:720,devicePixelRatio:1},
  lastViewportW:1280,lastViewportH:720,lastViewportDpr:1.25,
  PROFILE_RENDER:false,IS_MOBILE:false,PIXEL_BUDGET:4608000,measureSafeArea(){},
  camera:{aspect:16/9,fov:40,position:{toArray:()=>[0,3,-7]},updateProjectionMatrix(){}},
  photoMode:false,fovVisual:40,pMat:{uniforms:{uScale:{value:0}}}});
vm.runInContext(section('  function baseCameraFov(aspect)', '  var camera = new THREE.PerspectiveCamera'),resized);
resized.applyQualityTier(resized.TIER_SHADOW_OFF);
resized.ladderProbeUntil=.7;resized.ladderProbeFrames=18;resized.ladderCheckpointTier=8;resized.ladderCheckpointMs=26;
vm.runInContext(section('  function commitViewportResize()', '  function queueViewportResize()'),resized);
resized.commitViewportResize();
assert.equal(resized.RES_TIER_COUNT,0);
assert.equal(resized.qualityTier,resized.TIER_SHADOW_OFF,'resize retains the actual shadow domain');
assert.equal(resized.ladderCheckpointTier,resized.qualityTier,'checkpoint uses the new rung numbering');
assert.equal(resized.ladderCheckpointMs,0);assert.equal(resized.ladderProbeUntil,0);assert.equal(resized.ladderProbeFrames,0);
assert.ok(resized.aoActive && resized.bloomActive);
resized.ladderProbeUntil=.6;resized.commitViewportResize();
assert.equal(resized.ladderProbeUntil,.6,'identical resize does not cancel a valid new probe');
resized.window.devicePixelRatio=2;resized.commitViewportResize();
assert.equal(resized.RES_TIER_COUNT,3);assert.equal(resized.ladderCheckpointTier,resized.TIER_SHADOW_OFF);
assert.equal(resized.ladderProbeUntil,0);
// The paused photograph retains its pose, but the lens must follow orientation
// immediately; it cannot wait for the stopped simulation to update the camera.
Object.assign(resized,{photoMode:true,canvas:{dataset:{}},distance:3.5,player:{z:3.5},
  camLook:{toArray:()=>[0,2.45,13.7]}});
resized.window.innerWidth=390;resized.window.innerHeight=844;resized.commitViewportResize();
assert.equal(resized.camera.fov,69);assert.equal(resized.fovVisual,69);
assert.equal(JSON.parse(resized.canvas.dataset.photoPose).distance,3.5);
resized.camera.fov+=3;
resized.window.innerWidth=1280;resized.window.innerHeight=720;resized.commitViewportResize();
assert.equal(resized.camera.fov,43,'rotation preserves the action lens offset');
assert.equal(JSON.parse(resized.canvas.dataset.photoPose).fov,43);
console.log('PASS: ineffective 20/33 ms traces restore full picture; early, cumulative and deep useful checkpoints; severe-probe EMA-tail rejection; promotions/recovery and hidden/reset/resize evidence.');
let environmentRebuilds=0;
const events = {}, recovery=controller(false,.8);
Object.assign(recovery,{
  canvas:{dataset:{},addEventListener:(name,fn)=>{events[name]=fn;}},
  musicStop(){},stopSpeech(){},musicStart(){},
  buildFinishEnvironment(){environmentRebuilds++;},
  performance:{now:()=>1234},renderer:{shadowMap:{}},POST:{},
  started:true,gameOver:false,photoMode:false,musicEnabled:false,
  PROFILE_RENDER:false,profileContextRestores:0,profileRestorePending:false,
  accum:1,last:0,presentationClock:200,photoRenderDirty:false,perfWarmup:10,
});
recovery.applyQualityTier(recovery.TIER_SHADOW_OFF);
recovery.ladderProbeUntil=.6;recovery.ladderProbeFrames=12;recovery.ladderCheckpointTier=0;recovery.ladderCheckpointMs=26;
recovery.ladderCeiling=1;recovery.promoteFloor=1;
vm.runInContext(section('  var graphicsContextLost = false;','  function frame(now)'),recovery);
let prevented=false;
events.webglcontextlost({preventDefault(){prevented=true;}});
assert.ok(prevented && recovery.graphicsContextLost,'context loss pauses presentation and permits restoration');
events.webglcontextrestored();
assert.ok(!recovery.graphicsContextLost && recovery.photoRenderDirty && recovery.renderer.shadowMap.needsUpdate);
assert.equal(recovery.accum,0,'GPU restore discards stale simulation time');
assert.equal(recovery.last,1234);
assert.equal(environmentRebuilds,1,'generated reflections are rebuilt after GPU context restoration');
assert.equal(recovery.qualityTier,recovery.TIER_SHADOW_OFF,'context restore retains the current picture');
assert.equal(recovery.ladderCheckpointTier,recovery.qualityTier,'context restore rebases the checkpoint');
assert.equal(recovery.ladderCheckpointMs,0);assert.equal(recovery.ladderProbeUntil,0);assert.equal(recovery.ladderProbeFrames,0);
assert.equal(recovery.ladderCeiling,recovery.QUALITY_TIER_MAX);assert.equal(recovery.promoteFloor,0);
const restoreButton={disabled:true},restoreStatus={textContent:''};
recovery.PROFILE_RENDER=true;recovery.profileRestorePending=true;
recovery.document={getElementById:id=>id==='profilerestore'?restoreButton:restoreStatus};
events.webglcontextlost({preventDefault(){}});events.webglcontextrestored();
assert.equal(recovery.profileContextRestores,1,'device report counts completed restorations');
assert.equal(recovery.profileRestorePending,false);
assert.equal(restoreButton.disabled,false);assert.ok(restoreStatus.textContent.includes('wiederhergestellt'));
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
const t=vm.createContext({console});vm.runInContext(scripts.find(s=>s.includes('three.js r156 (MIT)')),t);
const merge=new Function('THREE', section('  function mergeBoxes(specs) {','\n  // DRAW-CALL CONSOLIDATION:')+';return mergeBoxes;')(t.THREE);
t.mat=(color,options)=>new t.THREE.MeshStandardMaterial({color,...options});
t.atob=s=>Buffer.from(s,'base64').toString('binary');
vm.runInContext(section('  // BEGIN BLENDER GARDEN KIT','  // END BLENDER GARDEN KIT'),t);
const canopy=t.berlinGardenKit.geometry('treeNear');
assert.equal(canopy,t.berlinGardenKit.geometry('treeNear'),'all street trees share one geometry');
assert.ok(canopy.index.count/3 <= 14000,'accepted taller street tree stays within its14,000-triangle budget');
assert.ok([...canopy.attributes.position.array,...canopy.attributes.color.array].every(Number.isFinite));
canopy.computeBoundingBox();
const streetTreeHeight=canopy.boundingBox.max.y-canopy.boundingBox.min.y;
assert.ok(streetTreeHeight>8&&streetTreeHeight<8.5,'accepted street crown retains its taller authored envelope');
assert.equal(t.berlinGardenKit.canopyRadius,2.85,'street-only cull radius comes from the accepted asset metadata');
function treeGeometryFingerprint(geometry){
  const hash=require('crypto').createHash('sha256');
  for(const attr of [...Object.values(geometry.attributes),geometry.index].filter(Boolean))
    hash.update(Buffer.from(attr.array.buffer,attr.array.byteOffset,attr.array.byteLength));
  return hash.digest('hex');
}
const backgroundTree=t.berlinGardenKit.geometry('tree'),backgroundLeaves=t.berlinGardenKit.geometry('leaves');
const backgroundFingerprints=[backgroundTree,backgroundLeaves].map(treeGeometryFingerprint);
for(let i=0;i<canopy.attributes.position.count;i++){
  const p=canopy.attributes.position;
  assert.ok(Math.hypot(p.getX(i),p.getZ(i))<t.berlinGardenKit.canopyRadius,'rotated tree stays inside live cull bounds');
}
// Exercise the actual lamp factory and batching functions with the shipped
// merger. Material/primitive stubs avoid texture painting, not geometry logic.
const THREE=t.THREE, lampCache=new Map();
// Execute the shipped light rig: translating its camera must change only whole
// shadow texels, never the fractional sampling phase of a fixed world point.
const stableLight=vm.createContext({THREE,Math,scene:new THREE.Scene()});
vm.runInContext(section('  var sun = new THREE.DirectionalLight(', '  // Broad, neutral-cool sky bounce'),stableLight);
vm.runInContext(section('  var WORLD_EMERGE =', '  // Stock linear fog'),stableLight);
function refreshStableLight(z) {
  stableLight.updateStableSunShadow(z);stableLight.scene.updateMatrixWorld(true);
  stableLight.sun.shadow.updateMatrices(stableLight.sun);
}
const fixedLight=stableLight.sun, fixedShadow=fixedLight.shadow;
assert.equal(fixedShadow.mapSize.x,2048);assert.equal(fixedShadow.mapSize.y,2048);
for(const [edge,value] of [['left',-112],['right',112],['top',112],['bottom',-112]])
  assert.equal(fixedShadow.camera[edge],value,'initialized coverage matches the approved fixed112m half extent');
assert.ok(Math.abs(fixedShadow.camera.projectionMatrix.elements[0]-1/stableLight.SHADOW_BOX)<1e-12,
  'camera projection is initialized from its live bounds before the first shadow map');
const fixedProjection=Array.from(fixedShadow.camera.projectionMatrix.elements);
const fixedShape=[fixedShadow.mapSize.x,fixedShadow.mapSize.y,fixedShadow.camera.near,
  fixedShadow.camera.far,fixedShadow.camera.left,fixedShadow.camera.right,fixedShadow.radius];
for(const focused of [true,false,true,false]) {
  stableLight.applyShadowScope(focused);refreshStableLight(0);
  assert.equal(stableLight.shadowFocused,focused,'quality still selects the refresh cadence');
  assert.deepEqual(Array.from(fixedShadow.camera.projectionMatrix.elements),fixedProjection,
    'every quality transition retains the original initialized projection');
  assert.deepEqual([fixedShadow.mapSize.x,fixedShadow.mapSize.y,fixedShadow.camera.near,
    fixedShadow.camera.far,fixedShadow.camera.left,fixedShadow.camera.right,fixedShadow.radius],fixedShape,
    'quality cannot change map resolution, depth range or physical filter footprint');
}
let gridPhaseChecks=0,shadowCoverageChecks=0;
for(const origin of [0,400,10000]) {
  refreshStableLight(origin);
  const points=[[-30,0,20],[0,0,80],[12.4,0,170],[30,0,180],[-12.4,20.485,40]]
    .map(([x,y,z])=>new THREE.Vector3(x,y,z+origin));
  const original=points.map(p=>p.clone().applyMatrix4(fixedShadow.matrix));
  for(const advance of [.0001,.01,.2,1.3,2.6,5.2,10,40]) {
    refreshStableLight(origin+advance);
    assert.ok(fixedLight.position.clone().sub(fixedLight.target.position)
      .distanceTo(stableLight.shadowSunOffset)<1e-10,'translation retains exact authored sun direction');
    points.forEach((point,i)=>{
      const projected=point.clone().applyMatrix4(fixedShadow.matrix);
      for(const axis of ['x','y']) {
        const delta=(projected[axis]-original[i][axis])*fixedShadow.mapSize[axis];
        assert.ok(Math.abs(delta-Math.round(delta))<1e-7,'fixed world points retain their light-space texel phase');
        gridPhaseChecks++;
      }
    });
  }
  refreshStableLight(origin);
  // The 60 m cross street is the widest shadow-receiving ground; the much
  // larger background plane does not receive shadows. Include a margin past
  // fog178, then trace toward the real sun to cover tall off-camera casters.
  for(const x of [-30,-12.4,0,12.4,30])for(const z of [-12,0,60,120,stableLight.FOG_FAR_MAX,stableLight.FOG_FAR_MAX+6])
    for(const height of [0,8.5,20.485,30]) {
      const p=new THREE.Vector3(x,0,origin+z).addScaledVector(stableLight.shadowSunOffset,
        height/stableLight.shadowSunOffset.y);
      assert.ok(fixedShadow.getFrustum().containsPoint(p),'visible ground and its sunward caster ray remain inside the actual light frustum');
      shadowCoverageChecks++;
    }
}
assert.match(section('  function updateWorldVisuals(', '    var rimBlend'),
  /if\s*\(shadowRefreshDue\)\s*updateStableSunShadow\(player\.z\)/,
  'running rig uses only route progress, never camera or lane X');
// r156 constructs its own depth material. Execute that actual selector to
// prove the invisible proxy's beauty depthWrite/colorWrite do not disable it.
const embeddedThree=scripts.find(s=>s.includes('three.js r156 (MIT)'));
const depthStart=embeddedThree.indexOf('function b(e,n,i,s){let a=null;const o=!0===i.isPointLight?e.customDistanceMaterial');
const depthEnd=embeddedThree.indexOf('function T(n,i,s,a,l)',depthStart);
assert.ok(depthStart>=0&&depthEnd>depthStart,'embedded shadow-depth material selector found');
const depthMaterial=new THREE.MeshDepthMaterial(),proxyMaterial=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false});
const selectDepth=new Function('t','d','u','p','r','f',embeddedThree.slice(depthStart,depthEnd)+';return b;')(
  {localClippingEnabled:false},new THREE.MeshDistanceMaterial(),depthMaterial,{},THREE.VSMShadowMap,
  {[THREE.FrontSide]:THREE.BackSide,[THREE.BackSide]:THREE.FrontSide,[THREE.DoubleSide]:THREE.DoubleSide});
assert.equal(selectDepth(new THREE.Mesh(new THREE.BoxGeometry(),proxyMaterial),proxyMaterial,fixedLight,THREE.PCFSoftShadowMap),depthMaterial);
assert.ok(depthMaterial.depthWrite&&depthMaterial.colorWrite&&depthMaterial.visible,
  'proxy suppresses beauty writes but still emits visible packed depth into the shadow map');
console.log(`PASS: fixed shadow projection/quality; ${gridPhaseChecks} world-point texel-phase checks; ${shadowCoverageChecks} receiver/caster coverage cases; actual r156 proxy depth writes.`);
// Execute the shipped ground clone and cel patch against the embedded r156.
// A tint-only material must share GPU textures and keep the shader hook that
// Three intentionally does not copy with Material.clone().
const groundContext=vm.createContext({THREE,window:{location:{search:'?profile=1&lightfacing=1'}}});
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
assert.equal(chainedMaterial.customProgramCacheKey(),'pbr-daylight-v3|existing-hook','natural PBR application preserves an existing program key');
console.log('PASS: r156 ground clone shares all three texture resources; independent palette uniforms; single cel patch, identical program key and preserved callback chain.');
// The shipped r156 light classifier already knows when an exact zero would
// reach RE_Direct. Verify every direct-light block is guarded without changing
// shadow sampling, loop declarations or any other surrounding shader source.
const directCall='RE_Direct( directLight, geometry, material, reflectedLight );';
const pointCall='getPointLightInfo( pointLight, geometry, directLight );';
const celChunk=groundContext.celLightsFragmentBegin();
const guardedBlocks=[...celChunk.matchAll(/if \( directLight\.visible \) \{[^{}]*\}/g)].map(m=>m[0]);
const pointGuardPattern=/\{ vec3 berlinLightDelta[^{}]*if \( berlinLightInRange[^{}]*\{[^{}]*\} else \{[^{}]*\} \}/g;
const pointGuards=[...celChunk.matchAll(pointGuardPattern)].map(m=>m[0]);
const facingPattern=/\n#if defined\( STANDARD \) && !defined\( USE_CLEARCOAT \)\n\t\tdirectLight\.visible = directLight\.visible && dot\( geometry\.normal, directLight\.direction \) > 0\.0;\n#endif/g;
const facingGuards=[...celChunk.matchAll(facingPattern)].map(m=>m[0]);
assert.equal(facingGuards.length,3,'point, spot and sun all reject zero native irradiance before shadow work');
for(const info of [pointCall,'getSpotLightInfo( spotLight, geometry, directLight );','getDirectionalLightInfo( directionalLight, geometry, directLight );']){
  const infoAt=celChunk.indexOf(info),facingAt=celChunk.indexOf('directLight.visible = directLight.visible && dot(',infoAt);
  const shadowAt=celChunk.indexOf('directLight.color *= ( directLight.visible && receiveShadow )',infoAt);
  assert.ok(infoAt>=0&&facingAt>infoAt&&shadowAt>facingAt,'actual shaded normal is checked before its unchanged shadow eligibility expression');
}
const originalDirectCount=THREE.ShaderChunk.lights_fragment_begin.split(directCall).length-1;
assert.equal(originalDirectCount,3,'r156 point, spot and directional direct-light blocks');
assert.equal(guardedBlocks.length,originalDirectCount,'all direct-light blocks have their own guard');
assert.ok(guardedBlocks.every(block=>block.includes('celQuantize(')&&block.includes(directCall)),
  'compatibility authoring branch and native PBR invocation remain scoped');
assert.match(groundContext.CEL_FUNCTIONS_GLSL,/#define BERLIN_SMOOTH_LIGHTING 1/,'shipped shaders compile out stepped lighting');
const naturalLightBlocks=guardedBlocks.map(block=>block.replace(/#ifndef BERLIN_SMOOTH_LIGHTING\n[\s\S]*?#endif\n/g,''));
assert.ok(naturalLightBlocks.every(block=>!block.includes('celQuantize(')&&!block.includes('directLight.color')),
  'compiled daylight never reshapes direct radiance before Standard diffuse/specular evaluation');
assert.equal(pointGuards.length,1,'one guard covers the unrolled fixed point-light slots');
assert.equal(celChunk.replace(/if \( directLight\.visible \) \{[^{}]*\}/g,directCall).replace(pointGuardPattern,pointCall).replace(facingPattern,''),
  THREE.ShaderChunk.lights_fragment_begin,'all source outside the exact-zero light injections, including point shadows, is byte-exact');
function glslBody(source,signature) {
  const start=source.indexOf(signature);assert.ok(start>=0,signature);
  const open=source.indexOf('{',start);let at=open+1,depth=1;
  while(depth&&at<source.length){if(source[at]==='{')depth++;else if(source[at]==='}')depth--;at++;}
  assert.equal(depth,0,'balanced shipped shader function');return source.slice(open+1,at-1);
}
const lightPars=THREE.ShaderChunk.lights_pars_begin;
assert.match(glslBody(lightPars,'void getPointLightInfo('),
  /light\.visible = \( light\.color != vec3\( 0\.0 \) \)/,
  'the guard uses r156 exact-zero classification, not a brightness threshold');
const attenuationBody=glslBody(lightPars,'float getDistanceAttenuation(');
const attenuationBranches=attenuationBody.match(/#if defined \( LEGACY_LIGHTS \)([\s\S]*?)#else([\s\S]*?)#endif/);
assert.ok(attenuationBranches,'both shipped attenuation modes are exercised');
const scalarHelpers={pow:Math.pow,max:Math.max,pow2:x=>x*x,pow4:x=>x*x*x*x,
  saturate:x=>Math.max(0,Math.min(1,x))};
// Execute the shipped point-info body with vector operators translated to
// array arithmetic, then compare its exact output through the new GLSL guard.
const pointInfoBody=glslBody(lightPars,'void getPointLightInfo(')
  .replace('vec3 lVector = pointLight.position - geometry.position;','let lVector = pointLight.position.map((v,i)=>v-geometry.position[i]);')
  .replace('float lightDistance','let lightDistance')
  .replace('light.color = pointLight.color;','light.color = pointLight.color.slice();')
  .replace('light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );',
    'light.color = light.color.map(v=>v*getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay ));')
  .replace('light.color != vec3( 0.0 )','light.color.some(v=>v!==0)');
assert.ok(!/\bvec3\b|\bfloat\b/.test(pointInfoBody),'every operation in the shipped point-info body is accounted for');
const pointInfo=new Function('pointLight','geometry','light','normalize','length','getDistanceAttenuation',pointInfoBody);
const guardedPointInfo=new Function('pointLight','geometry','directLight','getPointLightInfo',pointGuards[0]
  .replace('vec3 berlinLightDelta = pointLight.position - geometry.position;', 'let berlinLightDelta = pointLight.position.map((v,i)=>v-geometry.position[i]);')
  .replace('bool berlinLightInRange', 'let berlinLightInRange')
  .replace('dot(berlinLightDelta, berlinLightDelta)', 'berlinLightDelta.reduce((sum,v)=>sum+v*v,0)')
  .replace('any( notEqual( pointLight.color, vec3( 0.0 ) ) )','pointLight.color.some(v=>v!==0)')
  .replace(/vec3\( 0\.0 \)/g,'[0,0,0]'));
let skippedPointInfo=0,retainedPointInfo=0;
for(const branch of attenuationBranches.slice(1)) {
  const attenuation=new Function('lightDistance','cutoffDistance','decayExponent',...Object.keys(scalarHelpers),
    branch.replace(/\bfloat (\w+)\b/g,'let $1'));
  for(const radius of [0,18,34])for(const range of [.01,9,17.99999,18,34,68])for(const decay of [0,1,2])
  for(const color of [[0,0,0],[-0,0,0],[1e-10,0,0],[0,1e-10,0],[0,0,1e-10],[1,.55,.2]]) {
    const source={position:[0,0,range],color,distance:radius,decay},geometry={position:[0,0,0]};
    let infoCalls=0;
    function info(light,geometry,result) {
      infoCalls++;pointInfo(light,geometry,result,
        v=>v.map(x=>x/Math.hypot(...v)),v=>Math.hypot(...v),
        (...args)=>attenuation(...args,...Object.values(scalarHelpers)));
    }
    const original={},patched={color:[4,5,6],direction:[1,2,3],visible:true};
    info(source,geometry,original);infoCalls=0;guardedPointInfo(source,geometry,patched,info);
    const nonzero=color.some(v=>v!==0);
    const needsInfo=nonzero&&(radius<=0||decay<=0||range<radius);
    assert.equal(infoCalls,needsInfo?1:0,'zero colours and finite exhausted light volumes skip the full light calculation');
    assert.ok(patched.color.every((v,i)=>v===original.color[i]),'point radiance is exact in both attenuation modes');
    assert.equal(patched.visible,original.visible,'zero and out-of-range classification is unchanged');
    if(needsInfo) {assert.deepEqual(patched.direction,original.direction,'active light direction is exact');retainedPointInfo++;}
    else {assert.deepEqual(patched.direction,[0,0,0],'skipped slots receive defined zero incident data');skippedPointInfo++;}
    for(const receiveShadow of [true,false])assert.equal(patched.visible&&receiveShadow,original.visible&&receiveShadow,
      'unchanged point-shadow condition samples exactly the same lights');
  }
}
const futurePointPatch=new Function('THREE','var _celLightsChunk=null;'+
  section('  function celLightsFragmentBegin() {','  // Wires the lighting optimization')+'return celLightsFragmentBegin;');
const noDirectSource=THREE.ShaderChunk.lights_fragment_begin.split(directCall).join('RE_DirectFuture( directLight );');
assert.equal(futurePointPatch({ShaderChunk:{lights_fragment_begin:noDirectSource}})(),noDirectSource,
  'missing direct marker leaves the complete future shader unchanged');
const noPointSource=THREE.ShaderChunk.lights_fragment_begin.replace(pointCall,'getPointLightInfoFuture( pointLight, geometry, directLight );');
const noPointPatched=futurePointPatch({ShaderChunk:{lights_fragment_begin:noPointSource}})();
assert.equal(noPointPatched.replace(/if \( directLight\.visible \) \{[^{}]*\}/g,directCall).replace(facingPattern,''),noPointSource,
  'changed point signature retains Three point-info behavior with only the established direct-light patch');
console.log(`PASS: ${skippedPointInfo} exact-zero point slots skip getPointLightInfo; ${retainedPointInfo} dim/active/out-of-range slots preserve exact r156 output, shadow eligibility and future-chunk fallback.`);
// The guard uses the actual r156 native irradiance factor. Include clearcoat's
// independent normal: rejecting by only the base normal would erase that lobe.
const directPhysical=glslBody(THREE.ShaderChunk.lights_physical_pars_fragment,'void RE_Direct_Physical(');
assert.match(directPhysical,/float dotNL = saturate\( dot\( geometry.normal, directLight.direction \) \);\s*vec3 irradiance = dotNL \* directLight.color;/);
assert.match(directPhysical,/clearcoatSpecular \+= ccIrradiance \*/);
assert.match(directPhysical,/reflectedLight.directSpecular \+= irradiance \*/);
assert.match(directPhysical,/reflectedLight.directDiffuse \+= irradiance \*/);
const facingBody=facingGuards[0].replace(/\n?#(?:if[^\n]*|endif)/g,'');
const applyFacing=new Function('directLight','geometry','dot',facingBody);
const facingDot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
let facingCases=0,skippedFacingShadows=0;
for(const nl of [-1,-.75,-.001,-1e-12,0,1e-12,.001,.4,1])
for(const radiance of [0,1e-12,.1,3.32])for(const shadow of [0,.075,.4,.775,1])
for(const clearcoat of [false,true])for(const receiveShadow of [false,true]){
  const geometry={normal:[0,0,1]},direction=[Math.sqrt(1-nl*nl),0,nl];
  const originalVisible=radiance!==0,incident={visible:originalVisible,direction,color:radiance};
  if(!clearcoat)applyFacing(incident,geometry,facingDot);
  const originalShadow=originalVisible&&receiveShadow?shadow:1;
  const actualShadow=incident.visible&&receiveShadow?shadow:1;
  function shade(visible,factor){
    const base=Math.max(0,nl)*radiance*factor;
    return {diffuse:visible?base*.37:0,specular:visible?base*.61:0,
      clearcoat:clearcoat&&visible?Math.max(0,.45)*radiance*factor*.23:0};
  }
  assert.deepEqual(shade(incident.visible,actualShadow),shade(originalVisible,originalShadow),
    'front/grazing/back normals, dim lights and every penumbra preserve all native light lobes');
  if(!clearcoat&&nl<=0&&originalVisible&&receiveShadow){assert.equal(incident.visible,false);skippedFacingShadows++;}
  facingCases++;
}
for(const search of ['', '?profile=1&lightfacing=0','?lightfacing=0','?profile=1','?lightfacing=1','?profile=1&lightfacing=1']){
  const baseline=vm.createContext({THREE,window:{location:{search}}});
  vm.runInContext(section('  var CEL_BANDS =', '  // ---------------------------------------------- shared flat-prop material'),baseline);
  const baselineChunk=baseline.celLightsFragmentBegin();
  assert.equal((baselineChunk.match(facingPattern)||[]).length,search==='?profile=1&lightfacing=1'?3:0,
    'unproven facing branch is opt-in only in an explicit profiling session');
  assert.equal((baselineChunk.match(pointGuardPattern)||[]).length,1,'facing A/B retains existing range and exact-zero optimizations');
}
console.log(`PASS: ${facingCases} native PBR/clearcoat cases preserve exact light; ${skippedFacingShadows} back-facing shadow evaluations removed; profile-only facing A/B keeps all previous guards.`);
const clampLight=(x,a,b)=>Math.max(a,Math.min(b,x));
const quantizeBody=glslBody(groundContext.CEL_FUNCTIONS_GLSL,'float celQuantize(')
  .replace(/\b(?:float|int) (\w+)\b/g,'let $1').replace(/\bfloat\(/g,'Number(');
const quantize=new Function('nl','bands','soft','smoothstep','mix','max',
  'const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),ceil=Math.ceil,floor=Math.floor;'+quantizeBody);
const smoothStep=(a,b,x)=>{const t=clampLight((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const mixLight=(a,b,t)=>a+(b-a)*t;
let quantizeSamples=0;
for(const bands of [1,1.5,2,3,3.5,4,5,7,8,10])for(const soft of [.01,.1,.32,.5,.7,1.2]) {
  for(let i=0;i<=2000;i++) {
    const nl=i/2000; let sum=0;
    for(let edge=1;edge<8&&edge<bands;edge++)sum+=smoothStep(edge-soft,edge+soft,nl*bands);
    const original=mixLight(nl,sum/Math.max(bands-1,1),.18);
    const actual=quantize(nl,bands,soft,smoothStep,mixLight,Math.max);
    assert.ok(Math.abs(actual-original)<1e-12,'closed form preserves the original stepped light, including live tuning');
    quantizeSamples++;
  }
}
console.log(`PASS: ${quantizeSamples} toon-light samples preserve the original curve.`);
const lightMath={clamp:clampLight,dot:(a,b)=>a.reduce((sum,x,i)=>sum+x*b[i],0),max:Math.max,
  uCelBands:groundContext.CEL_BANDS.value,uCelSoft:groundContext.CEL_EDGE_SOFT.value};
const guardedLight=new Function('directLight','geometry','material','reflectedLight','RE_Direct','celQuantize',
  ...Object.keys(lightMath),naturalLightBlocks[0]);
const unguardedLight=new Function('directLight','geometry','material','reflectedLight','RE_Direct','celQuantize',
  ...Object.keys(lightMath),directCall);
let guardedZeroLights=0,retainedLightChannels=0;
for(const branch of attenuationBranches.slice(1)) {
  const attenuation=new Function('lightDistance','cutoffDistance','decayExponent',...Object.keys(scalarHelpers),
    branch.replace(/\bfloat (\w+)\b/g,'let $1'));
  for(const radius of [18,19,34])for(const distance of [0.01,radius*0.5,radius*(1-1e-6),radius,radius*1.2])
  for(const intensity of [0,1e-10,1.85])for(const rgb of [[1,0.55,0.2],[0,0.3,1]]) {
    const falloff=attenuation(distance,radius,2,...Object.values(scalarHelpers));
    const radiance=rgb.map(v=>v*intensity*falloff),visible=radiance.some(v=>v!==0);
    for(const channel of radiance)for(const nl of [-0.3,0,0.33,0.8]) {
      function shade(run) {
        let quantizations=0,directCalls=0;const reflected={diffuse:0.2,specular:0.4};
        run({visible,color:channel,direction:[Math.sqrt(1-nl*nl),0,nl]},
          {normal:[0,0,1]}, {},reflected,
          (light,_geometry,_material,result)=>{directCalls++;result.diffuse+=light.color*0.37;result.specular+=light.color*0.61;},
          (n,b,s)=>{quantizations++;return quantize(n,b,s,
            (a,z,x)=>{const t=clampLight((x-a)/(z-a),0,1);return t*t*(3-2*t);},
            (a,b,t)=>a+(b-a)*t,Math.max);},...Object.values(lightMath));
        return {reflected,quantizations,directCalls};
      }
      const before=shade(unguardedLight),after=shade(guardedLight);
      assert.deepEqual(after.reflected,before.reflected,'active contribution and existing accumulated light are unchanged');
      assert.equal(after.quantizations,0,'native daylight performs no quantization, including arbitrarily dim active lights');
      assert.equal(after.directCalls,visible?1:0,'only zero-contribution lights skip direct shading');
      if(visible)retainedLightChannels++;else guardedZeroLights++;
    }
  }
}
console.log(`PASS: exact r156 direct-light source transformation; ${guardedZeroLights} zero-intensity/out-of-range cases skip cel and PBR work; ${retainedLightChannels} active channels retain exact contributions in both attenuation modes.`);
const cachedLamp=(key,fn)=>{if(!lampCache.has(key))lampCache.set(key,fn());return lampCache.get(key);};
const compact=new Function('THREE','mergeBoxes',section('  var staticMergeGeometryCache = new Map();','  // Merges building parts that carry different materials')+';return compactStaticPropGroup;')(THREE,merge);
const lampMaterials={};
for(const name of ['metalDark','poleGreen','chrome','lampGlobe'])lampMaterials[name]=new THREE.MeshStandardMaterial({transparent:name==='lampGlobe'});
const lampContext=vm.createContext({THREE,ASSETS:{},MAT:lampMaterials,cached:cachedLamp,KIEZ_DISTRICT_ENABLED:useKiezLamps,
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
if(useKiezLamps) {
  let solidTriangles=0;
  for(const mesh of lamps[0].children.filter(mesh=>mesh.isMesh&&!mesh.material.transparent&&mesh!==lamps[0].userData.flag)) {
    const geometry=mesh.geometry,position=geometry.attributes.position,normal=geometry.attributes.normal;
    solidTriangles+=(geometry.index?geometry.index.count:position.count)/3;
    for(let i=0;i<position.count;i++) {
      assert.ok(Number.isFinite(position.getX(i)+position.getY(i)+position.getZ(i)),'lantern vertices are finite');
      assert.ok(Math.abs(Math.hypot(normal.getX(i),normal.getY(i),normal.getZ(i))-1)<1e-5,'lantern normals are unit length');
    }
  }
  assert.ok(solidTriangles>=500&&solidTriangles<=900,'complete opaque lantern remains within its 500–900 triangle budget');
  const iron=lamps[0].children.find(mesh=>mesh.material===lampMaterials.metalDark&&!mesh.userData.noStaticMerge);
  iron.geometry.computeBoundingBox();
  assert.ok(iron.geometry.boundingBox.min.y>=-1e-6&&iron.geometry.boundingBox.max.y<=6.50,'gas lantern preserves grounded root and original height contract');
  assert.ok(iron.geometry.boundingBox.max.x-iron.geometry.boundingBox.min.x<.55,'narrow upright silhouette replaces the overhanging curved arm');
  assert.equal(lamps[0].userData.bulb.material,lampMaterials.lampGlobe,'daylight callback owns the original shared lamp material');
  assert.equal(lamps[0].userData.bulb.geometry,lamps[1].userData.bulb.geometry,'all lamp panes reuse one cached mesh');
  assert.equal(iron.geometry,lamps[1].children.find(mesh=>mesh.material===lampMaterials.metalDark&&!mesh.userData.noStaticMerge).geometry,'all ironwork reuses one cached mesh');
  assert.ok(!lampMaterials.lampGlobe.transparent&&lampMaterials.lampGlobe.opacity===1&&lampMaterials.lampGlobe.depthWrite,'panes use the opaque depth-writing pool path');
  assert.equal(new Set(lamps[0].children.filter(mesh=>mesh.isMesh&&!mesh.userData.noStaticMerge&&!mesh.material.transparent).map(mesh=>mesh.material)).size,2,'body and panes need only two shared opaque materials');
  console.log(`PASS: reference gas lantern geometry; ${solidTriangles} opaque triangles, <6.5 m height, slender capped silhouette, unit normals and shared material/cache ownership.`);
}
lamps.forEach((lamp,i)=>{lamp.position.set(i?9:-9,0.16,i?9:-11);lamp.rotation.y=i?0:Math.PI;lampRoot.add(lamp);});
const lampDrawsBefore=lamps.reduce((n,lamp)=>n+lamp.children.filter(o=>o.isMesh).length,0);
const lampBatches=lampContext.batchRigidChunkProps(lampRoot,lamps,'lamp');
lampContext.syncRigidChunkProps(lampBatches);
const lampDrawsAfter=lamps.reduce((n,lamp)=>n+lamp.children.filter(o=>o.isMesh).length,0)+lampBatches.length;
assert.equal(lampDrawsBefore-lampDrawsAfter,useKiezLamps?2:4,'paired street lamps instance each identical opaque part once');
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
  assert.ok(lamp.children.includes(lamp.userData.cone),'cone retains original independent sorting');
  if(useKiezLamps) assert.ok(lampBatches.some(batch=>batch.entries.some(entry=>entry.source===lamp.userData.bulb)),'bulb reference survives while opaque panes enter their instance pool');
  else assert.ok(lamp.children.includes(lamp.userData.bulb),'legacy globe retains original transparent sorting');
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
lampContext.berlinGardenKit=t.berlinGardenKit;
vm.runInContext(section('  var streetTreeFarGeometry = null;','  // Litfaßsäule'),lampContext);
const grove=new THREE.Group(), trees=Array.from({length:4},()=>lampContext.makeTree());
trees.forEach((tr,i)=>{tr.position.set(i%2?9:-9,0.16,-12+i*12);tr.rotation.y=i*0.7;tr.scale.setScalar(0.8+i*0.1);tr.userData.rolledActive=true;grove.add(tr);});
const treeDrawsBefore=trees.reduce((n,tr)=>n+tr.children.filter(o=>o.isMesh).length,0);
const treeBatches=lampContext.batchRigidChunkProps(grove,trees,'tree');
lampContext.syncRigidChunkProps(treeBatches);
assert.equal(treeDrawsBefore-treeBatches.filter(b=>b.mesh.visible&&!b.shadowOnly).length,9,'four complete near trees share three beauty draws including pits');
assert.equal(treeBatches.filter(b=>b.mesh.castShadow&&b.mesh.visible).length,1,'joined branches and leaves retain one active shadow caster');
const crownBatch=treeBatches.find(b=>b.mesh.material===t.berlinGardenKit.material);
assert.equal(crownBatch.mesh.geometry,canopy,'instancing keeps exact Blender tree geometry');
for(const batch of treeBatches.filter(b=>b.lodFar!==true))batch.entries.forEach((entry,i)=>{
  const expected=new THREE.Matrix4().multiplyMatrices(entry.prop.matrix,entry.local),actual=new THREE.Matrix4();
  batch.mesh.getMatrixAt(i,actual);
  assert.ok(actual.elements.every((v,j)=>Math.abs(v-expected.elements[j])<1e-5),'grove retains individual scale, rotation and placement');
});
Object.assign(lampContext,{chunk:grove,ud:{trees,treeBatches},bulkNear:true,nearCullZ:-5});
const treeCull=section('    var treeBatchDirty = false;', '    // mass used to have');
vm.runInContext(treeCull,lampContext);
assert.ok(treeBatches.every(b=>b.mesh.count===(b.shadowOnly?4:b.lodFar===true?0:3)),
  'beauty culls the passed tree while every authored tree remains a stable shadow caster');
const treeVersion=crownBatch.mesh.instanceMatrix.version;
vm.runInContext(treeCull,lampContext);
assert.equal(crownBatch.mesh.instanceMatrix.version,treeVersion,'steady grove does not upload any new matrices');
lampContext.nearCullZ=50;vm.runInContext(treeCull,lampContext);
assert.ok(treeBatches.every(b=>b.shadowOnly?b.mesh.count===4&&b.mesh.visible:b.mesh.count===0&&!b.mesh.visible),
  'fully passed beauty submits nothing while off-camera shadows remain resident');
lampContext.nearCullZ=-50;vm.runInContext(treeCull,lampContext);
assert.ok(treeBatches.every(b=>b.mesh.count===(b.lodFar===true?0:4)&&b.mesh.visible===(b.lodFar!==true)),'recycled grove restores every authored tree');
// Distance LOD preserves the actual near geometry and the authored street far
// envelope. Exercise selection and packed transforms through the
// shipped writers, including perspective/Photo changes and hysteresis.
const farCrownBatch=treeBatches.find(b=>b.lodFar===true), farCrown=farCrownBatch.geometry;
const staticCrownBatch=treeBatches.find(b=>b.shadowOnly);
assert.equal(staticCrownBatch.geometry,farCrown,'one fixed authored far crown supplies shadows at all beauty distances');
assert.ok(staticCrownBatch.mesh.userData.staticTreeShadow&&staticCrownBatch.mesh.castShadow);
assert.ok(!crownBatch.mesh.castShadow&&!farCrownBatch.mesh.castShadow,'beauty LOD meshes cannot alter the shadow map');
assert.ok(!staticCrownBatch.material.colorWrite&&!staticCrownBatch.material.depthWrite,'proxy cannot alter beauty colour or depth');
const casterSnapshot=()=>Array.from(staticCrownBatch.mesh.instanceMatrix.array);
trees.forEach(tree=>tree.userData.treeLodFar=false);lampContext.syncRigidChunkProps(treeBatches);
const unchangedCaster=casterSnapshot();
trees.forEach(tree=>{tree.userData.treeLodFar=true;tree.visible=false;});lampContext.syncRigidChunkProps(treeBatches);
assert.equal(staticCrownBatch.mesh.count,4);assert.deepEqual(casterSnapshot(),unchangedCaster,
  'changing beauty LOD and hiding all original roots leaves every shadow transform byte unchanged');
trees[0].userData.rolledActive=false;lampContext.syncRigidChunkProps(treeBatches);
assert.equal(staticCrownBatch.mesh.count,3,'an unauthored tree never acquires a shadow proxy');
trees.forEach(tree=>{tree.userData.rolledActive=true;tree.userData.treeLodFar=false;tree.visible=true;});
lampContext.syncRigidChunkProps(treeBatches);
assert.equal(farCrownBatch.material,crownBatch.material,'both levels share the identical opaque PBR atlas');
assert.equal(lampContext.getStreetTreeFarGeometry(),farCrown,'one cached lower-detail geometry');
assert.equal(farCrown,t.berlinGardenKit.geometry('treeStreetFar'),'runtime uses the exact cached authored street LOD without cloning or resizing');
assert.notEqual(farCrown,backgroundTree,'street LOD never replaces the background grove');
assert.deepEqual([backgroundTree,backgroundLeaves].map(treeGeometryFingerprint),backgroundFingerprints,
  'street construction and LOD leave every background vertex/index/normal/UV/color byte unchanged');
for(const edge of ['min','max'])assert.ok(farCrown.boundingBox[edge].distanceTo(canopy.boundingBox[edge])<1e-5,'all artist-authored bounds are matched');
assert.ok(farCrown.index.count/3<=4000,'authored street far model stays within its4,000-triangle budget');
for(let i=0,p=farCrown.attributes.position;i<p.count;i++)assert.ok(Math.hypot(p.getX(i),p.getZ(i))<t.berlinGardenKit.canopyRadius,
  'authored far leaves also fit the shared yaw-independent cull radius');
assert.ok(farCrown.index.count<canopy.index.count*.42,'each distant tree removes at least58% of its triangles');
const lodCamera=new THREE.PerspectiveCamera(40,16/9,.1,420);
lodCamera.lookAt(0,0,1);lodCamera.updateMatrixWorld();
grove.userData={trees,treeBatches};
Object.assign(lampContext,{chunks:[grove],PROFILE_RENDER:false,window:{location:{search:''}}});
function selectTreeLOD(depths,scale=1){
  trees.forEach((tree,i)=>{tree.visible=true;tree.position.set(i%2?9:-9,0,depths[i]);tree.scale.setScalar(scale);});
  grove.updateMatrixWorld(true);lodCamera.updateMatrixWorld();lampContext.updateStreetTreeLOD(lodCamera);
}
selectTreeLOD([25,34,42,43]);
assert.ok(trees.every(tree=>!tree.userData.treeLodFar),'taller desktop trees keep full detail beyond the42m distance gate while occupying over19% of the frame');
assert.equal(crownBatch.mesh.count,4);assert.equal(farCrownBatch.mesh.count,0);
const treeLodProjection=[];
for(const [label,fov,pixels] of [['desktop',40,720],['phone',69,844],['Photo zoom',20,720]])for(const scale of [.94,1,1.12,1.30]){
  lodCamera.fov=fov;lodCamera.updateProjectionMatrix();
  const projectedHeight=depth=>{
    const bottom=new THREE.Vector3(0,canopy.boundingBox.min.y*scale,depth).project(lodCamera);
    const top=new THREE.Vector3(0,canopy.boundingBox.max.y*scale,depth).project(lodCamera);
    return Math.abs(top.y-bottom.y)/2;
  };
  // Find independent image-space limits by projecting the real mesh envelope.
  const gate=(fraction,minimum)=>{let lo=minimum,hi=300;
    for(let i=0;i<50;i++){const mid=(lo+hi)/2;if(projectedHeight(mid)>=fraction)lo=mid;else hi=mid;}return (lo+hi)/2;};
  const enter=gate(.19,42),exit=gate(.24,34),all=d=>[d,d,d,d];
  selectTreeLOD(all(25),scale);
  selectTreeLOD(all(enter-.01),scale);assert.ok(trees.every(tree=>!tree.userData.treeLodFar),'full geometry stays until both distance and actual projection permit entry');
  selectTreeLOD(all(enter+.01),scale);assert.ok(trees.every(tree=>tree.userData.treeLodFar),'small distant trees enter the authored far pool');
  assert.equal(crownBatch.mesh.count,0);assert.equal(farCrownBatch.mesh.count,4);
  const lodVersion=farCrownBatch.mesh.instanceMatrix.version;
  selectTreeLOD(all((enter+exit)/2),scale);
  assert.equal(farCrownBatch.mesh.instanceMatrix.version,lodVersion,'hysteresis does not rewrite matrices or oscillate detail');
  selectTreeLOD(all(exit+.01),scale);assert.ok(trees.every(tree=>tree.userData.treeLodFar),'far survives inside its distance/projection hysteresis');
  selectTreeLOD(all(exit-.01),scale);assert.ok(trees.every(tree=>!tree.userData.treeLodFar),'approaching canopy restores full detail at the projected exit boundary');
  assert.equal(crownBatch.mesh.count,4);assert.equal(farCrownBatch.mesh.count,0);
  treeLodProjection.push({view:label,scale,enterMeters:+enter.toFixed(3),enterPixels:+(projectedHeight(enter)*pixels).toFixed(2),
    exitMeters:+exit.toFixed(3),exitPixels:+(projectedHeight(exit)*pixels).toFixed(2)});
}
lodCamera.fov=40;lodCamera.updateProjectionMatrix();selectTreeLOD([70,70,70,70]);
assert.ok(trees.every(tree=>tree.userData.treeLodFar));
lampContext.PROFILE_RENDER=true;lampContext.window.location.search='?profile=1&treelod=0';
lampContext.updateStreetTreeLOD(lodCamera);
assert.ok(trees.every(tree=>!tree.userData.treeLodFar),'profile baseline restores every full model without reinstalling pools');
lampContext.PROFILE_RENDER=false;
console.log(`PASS: camera-aware street-tree LOD, exact foreground, authored/cache identity, immutable background, hysteresis/Photo/baseline; four distant crowns save${(canopy.index.count-farCrown.index.count)*4/3}triangles with one shared opaque far draw. Projection ${JSON.stringify(treeLodProjection)}`);
lampContext.ASSETS.props={tree:'optional.glb'};
assert.equal(lampContext.batchRigidChunkProps(grove,trees,'tree').length,0,'optional external tree assets retain original rendering path');
console.log('PASS: actual four-tree grove saves 9 beauty/3 caster submissions; exact Blender branches/leaves, transforms, existing cull, empty/recycled grove and change-only uploads.');
// Promote actual lamp/tree batch outputs and mapped manholes across chunks.
// Check source-equivalent frustum decisions and per-pass membership rather
// than inferring FPS from the reduced number of material submissions.
lampContext.ASSETS.props={};lampContext.PROFILE_RENDER=false;
lampContext.window={location:{search:''}};
const fixtureScene=new THREE.Scene(),fixtureWorld=new THREE.Group(),fixtureSun=new THREE.DirectionalLight();
fixtureScene.add(fixtureWorld,fixtureSun,fixtureSun.target);
fixtureSun.position.set(16,30,-10);fixtureSun.target.position.set(0,0,35);fixtureSun.castShadow=true;
Object.assign(fixtureSun.shadow.camera,{left:-46,right:46,top:46,bottom:-46,near:.1,far:160});
fixtureSun.shadow.camera.updateProjectionMatrix();
const fixtureCamera=new THREE.PerspectiveCamera(70,16/9,.1,420);
fixtureCamera.position.set(0,7,-30);fixtureCamera.lookAt(0,4,140);
const fixtureRenderer={shadowMap:{enabled:true}},fixtureChunks=[],fixtureLamps=[];
const manholeGeometry=new THREE.CylinderGeometry(.44,.44,.045,24);
const manholeMaterial=new THREE.MeshStandardMaterial({map:new THREE.Texture(),roughness:.78,metalness:.22});
const puddleMaterial=new THREE.MeshStandardMaterial({transparent:true,opacity:.2,depthWrite:false});
const fixtureTransparent=[];
const furnitureGeometry=new THREE.BoxGeometry(1.8,.65,.6);
const furnitureMaterial=new THREE.MeshStandardMaterial({map:new THREE.Texture(),color:0x548997});
const furnitureRoots=[],excludedFurniture=[];
vm.runInContext(section('  function freezeObjectTree(','  function freezeChunkStaticMatrices('),lampContext);
for(let ci=0;ci<5;ci++) {
  const chunk=new THREE.Group();chunk.position.z=ci*40+10;fixtureWorld.add(chunk);
  const lampPair=[lampContext.makeStreetLamp(),lampContext.makeStreetLamp()];
  lampPair.forEach((lamp,i)=>{
    lamp.position.set(i?9:-9,.16,i?9:-11);lamp.rotation.y=i?0:Math.PI;chunk.add(lamp);
    if(lamp.userData.bulb.material.transparent) fixtureTransparent.push({object:lamp.userData.bulb,material:lamp.userData.bulb.material,parent:lamp});
    fixtureTransparent.push({object:lamp.userData.cone,material:lamp.userData.cone.material,parent:lamp});
  });
  const lampRows=lampContext.batchRigidChunkProps(chunk,lampPair,'lamp');lampContext.syncRigidChunkProps(lampRows);
  const treeGroup=[];
  if(ci<2)for(let i=0;i<4;i++) {
    const tree=lampContext.makeTree();tree.position.set(i%2?10:-10,.16,-12+i*8);treeGroup.push(tree);chunk.add(tree);
  }
  const treeRows=lampContext.batchRigidChunkProps(chunk,treeGroup,'tree');lampContext.syncRigidChunkProps(treeRows);
  const manholes=[];
  if(ci<3)for(let i=0;i<2;i++) {
    const cover=new THREE.Mesh(manholeGeometry,manholeMaterial);cover.position.set(i?3:-3,.028,i?7:-7);
    cover.receiveShadow=true;manholes.push(cover);chunk.add(cover);
  }
  const puddle=new THREE.Mesh(new THREE.PlaneGeometry(1,1),puddleMaterial);chunk.add(puddle);
  fixtureTransparent.push({object:puddle,material:puddleMaterial,parent:chunk});
  chunk.userData={lampBatches:lampRows,treeBatches:treeRows,manholes,puddles:[puddle],trees:treeGroup,
    shadowCasters:[...lampRows,...treeRows].map(row=>row.mesh).filter(mesh=>mesh.castShadow)};
  const variants=[];
  for(let i=0;i<2;i++) {
    const root=new THREE.Group();root.position.set(i?8:-8,.3,i?12:-12);root.rotation.y=i?.4:-.6;
    root.scale.set(1.1,.9,1.2);root.userData.propKind='bench';
    const seat=new THREE.Mesh(furnitureGeometry,furnitureMaterial);
    seat.position.set(.2,.45,.1);seat.castShadow=i===0;seat.receiveShadow=true;root.add(seat);
    for(const exclusion of ['controlled','callback','swapped']) {
      const other=new THREE.Mesh(furnitureGeometry,furnitureMaterial);other.position.y=2;
      if(exclusion==='controlled')other.userData.noStaticMerge=true;
      if(exclusion==='callback')other.onBeforeRender=function(){};
      if(exclusion==='swapped') {
        const replacement=new THREE.Group();replacement.userData.swapped=true;
        replacement.add(other);chunk.add(replacement);variants.push(replacement);
      } else root.add(other);
      excludedFurniture.push(other);
    }
    chunk.add(root);variants.push(root);furnitureRoots.push(root);
    if(seat.castShadow)chunk.userData.shadowCasters.push(seat);
  }
  chunk.userData.props=[{variants}];
  lampContext.freezeObjectTree(chunk,[],false);
  fixtureChunks.push(chunk);fixtureLamps.push(lampPair);
}
const sourceShadowBand=new Function('ud','visible','dz',section('    var shadowNear = visible;',
  '    // Bollards and lane dashes lived under this chunk'));
const chunkVisible=new Function('dz','CHUNK_CULL_FAR',section('    var farLimit = CHUNK_CULL_FAR;',
  '    var ud = chunk.userData;')+';return visible;');
const casterLifetime={shadowNear:null,shadowCasters:[{castShadow:false},{castShadow:false}]};
for(const [dz,expected] of [[-56.01,false],[-55.99,true],[-38,true],[-20,true],[58,true],[178,true],[209.99,true],[210.01,false]]) {
  const visible=chunkVisible(dz,210);sourceShadowBand(casterLifetime,visible,dz);
  assert.equal(visible,expected,'phased facades retain the approved full resident interval');
  assert.ok(casterLifetime.shadowCasters.every(mesh=>mesh.castShadow===expected),
    'no separate distance band can retire a resident static caster');
}
for(const chunk of fixtureChunks)sourceShadowBand(chunk.userData,true,chunk.position.z);
let fixtureBeforeCount=0;const fixtureBeforeArgs=[];
fixtureScene.onBeforeRender=function(...args){fixtureBeforeCount++;fixtureBeforeArgs.push(args);};
Object.assign(lampContext,{scene:fixtureScene,worldRoot:fixtureWorld,sun:fixtureSun,chunks:fixtureChunks});
lampContext.installStreetFixturePools();
const fixturePools=lampContext.streetFixturePools;
assert.equal(fixturePools.sources.length,useKiezLamps?36:46,'two chunk-local fixed shadow holders accompany unchanged beauty fixtures');
assert.equal(fixturePools.pools.length,useKiezLamps?9:11,'one shared shadow-only canopy pool accompanies unchanged beauty pools');
assert.equal(fixturePools.furnitureSources,10);
assert.ok(excludedFurniture.every(mesh=>mesh.material===furnitureMaterial),'controlled, custom callback and replaced assets remain untouched');
assert.ok(fixturePools.sources.every(row=>row.source.material!==row.material&&!row.source.material.visible&&row.material.visible),
  'only holder material clones are hidden; the shared PBR palette stays visible');
for(const item of fixtureTransparent) {
  assert.equal(item.object.material,item.material);assert.equal(item.object.parent,item.parent);
  assert.ok(item.material.visible,'alpha globes, cones and puddles remain untouched');
}
const fixtureView=new THREE.Frustum(),fixtureProjection=new THREE.Matrix4();
function presentStreetFixtures() {
  fixtureScene.updateMatrixWorld();fixtureCamera.updateMatrixWorld();
  const callbacksBefore=fixtureBeforeCount;
  fixtureScene.onBeforeRender(fixtureRenderer,fixtureScene,fixtureCamera,null);
  assert.equal(fixtureBeforeCount,callbacksBefore+1,'existing scene callback runs exactly once');
  assert.deepEqual(fixtureBeforeArgs.at(-1),[fixtureRenderer,fixtureScene,fixtureCamera,null]);
  fixtureView.setFromProjectionMatrix(fixtureProjection.multiplyMatrices(fixtureCamera.projectionMatrix,fixtureCamera.matrixWorldInverse));
  const lightFrustum=fixtureSun.shadow.getFrustum(),inverseRoot=fixtureWorld.matrixWorld.clone().invert();
  const expected=new Map(Array.from(fixturePools.pools,pool=>[pool,{casters:[],others:[],inView:false}]));
  let oldBeautyDraws=0,oldShadowDraws=0;
  for(const row of fixturePools.sources) {
    const source=row.source;
    let visible=row.material.visible&&source.layers.test(fixtureCamera.layers)&&(!source.isInstancedMesh||source.count>0);
    for(let parent=source;parent;parent=parent.parent)visible&&=parent.visible;
    const inView=visible&&!source.userData.staticTreeShadow&&(!source.frustumCulled||fixtureView.intersectsObject(source));
    const inShadow=visible&&fixtureRenderer.shadowMap.enabled&&fixtureSun.castShadow&&fixtureSun.visible&&source.castShadow&&
      (!source.frustumCulled||lightFrustum.intersectsObject(source));
    oldBeautyDraws+=Number(inView);oldShadowDraws+=Number(inShadow);
    const group=expected.get(row.pool);group.inView||=inView;
    if(inShadow)group.casters.push(source);else if(inView)group.others.push(source);
  }
  let beautyDraws=0,shadowDraws=0;
  for(const [pool,group] of expected) {
    const mesh=pool.mesh,sequence=[...group.casters,...group.others];
    let count=0,shadowCount=0;
    for(const source of sequence) {
      const sourceCount=source.isInstancedMesh?source.count:1;
      for(let i=0;i<sourceCount;i++) {
        const wanted=inverseRoot.clone().multiply(source.matrixWorld);
        if(source.isInstancedMesh){const instance=new THREE.Matrix4();source.getMatrixAt(i,instance);wanted.multiply(instance);}
        for(let j=0;j<16;j++)assert.equal(mesh.instanceMatrix.array[count*16+j],Math.fround(wanted.elements[j]),
          'current frozen/moving root and original packed instance transform are represented exactly');
        count++;
      }
      if(group.casters.includes(source))shadowCount+=sourceCount;
      assert.equal(mesh.geometry,source.geometry,'original geometry, UVs, packed colors and normals remain shared');
      assert.equal(mesh.receiveShadow,source.receiveShadow);assert.equal(mesh.layers.mask,source.layers.mask);
      assert.equal(mesh.renderOrder,source.renderOrder);
      assert.equal(mesh.customDepthMaterial,source.customDepthMaterial);assert.equal(mesh.customDistanceMaterial,source.customDistanceMaterial);
    }
    assert.equal(mesh.material,pool.material,'exact live PBR material and cel hook identity are retained');
    assert.equal(mesh.count,shadowCount,'shadow pass sees only the original caster prefix');
    assert.equal(mesh.castShadow,shadowCount>0);assert.equal(mesh.visible,count>0);
    assert.equal(mesh.userData.streetFixtureShadowCount,shadowCount);
    assert.equal(mesh.userData.streetFixtureBeautyCount,group.inView?count:0);
    shadowDraws+=Number(mesh.visible&&mesh.castShadow&&mesh.count>0);
    mesh.onBeforeRender();
    assert.equal(mesh.count,group.inView?count:0,'beauty restores visible noncasters without adding them to the shadow prefix');
    beautyDraws+=Number(mesh.visible&&mesh.count>0);
    mesh.onAfterRender();assert.equal(mesh.count,shadowCount,'next shadow refresh starts with the correct caster prefix');
  }
  return {oldBeautyDraws,beautyDraws,oldShadowDraws,shadowDraws};
}
const fixtureStart=presentStreetFixtures();
assert.equal(fixtureStart.oldBeautyDraws,useKiezLamps?33:43);assert.equal(fixtureStart.beautyDraws,useKiezLamps?8:10,'mixed near/far trees cost one additional world draw');
lampContext.PROFILE_RENDER=true;lampContext.canvas={dataset:{}};lampContext.frameNumber=0;
presentStreetFixtures();
const measuredTreeLOD=JSON.parse(lampContext.canvas.dataset.streetFixturePooling);
assert.equal(measuredTreeLOD.treeLodNear,2);assert.equal(measuredTreeLOD.treeLodFar,6);
assert.equal(measuredTreeLOD.treeLodSavedTriangles,(canopy.index.count-farCrown.index.count)*2,
  'existing device report counts actual submitted near/far crowns and exact triangle savings');
lampContext.PROFILE_RENDER=false;
const fixtureVersions=()=>Array.from(fixturePools.pools,pool=>pool.mesh.instanceMatrix.version);
const originalVersions=fixtureVersions();presentStreetFixtures();
assert.deepEqual(fixtureVersions(),originalVersions,'unchanged frame uploads no world-pool matrices');
furnitureRoots[0].visible=false;presentStreetFixtures();
furnitureRoots[0].visible=true;furnitureRoots[0].position.z+=3;furnitureRoots[0].updateMatrix();
lampContext.freezeObjectTree(fixtureChunks[0],[],false);presentStreetFixtures();
const poolChildrenBefore=fixtureWorld.children.length,beforeInstallAgain=fixtureScene.onBeforeRender;
lampContext.installStreetFixturePools();
assert.equal(fixtureWorld.children.length,poolChildrenBefore);assert.equal(fixtureScene.onBeforeRender,beforeInstallAgain,'installation is idempotent');
fixtureWorld.position.set(.7,.2,-.3);fixtureWorld.rotation.y=.015;fixtureWorld.updateMatrix();
fixtureChunks[0].rotation.y=.13;fixtureChunks[0].scale.set(1.02,.98,1.04);fixtureChunks[0].updateMatrix();presentStreetFixtures();
fixtureLamps[0][0].visible=false;lampContext.syncRigidChunkProps(fixtureChunks[0].userData.lampBatches);presentStreetFixtures();
fixtureChunks[0].userData.trees[0].visible=false;lampContext.syncRigidChunkProps(fixtureChunks[0].userData.treeBatches);presentStreetFixtures();
fixtureChunks[0].userData.manholes[0].visible=false;presentStreetFixtures();
// Casters now survive the former near band and retire only with their owning
// chunk. The fixed canopy pool never emits a beauty instance.
sourceShadowBand(fixtureChunks[1].userData,true,80);presentStreetFixtures();
assert.ok(fixtureChunks[1].userData.shadowCasters.every(mesh=>mesh.castShadow),
  'crossing the old58m cutoff cannot add or remove visible ground shadows');
sourceShadowBand(fixtureChunks[1].userData,false,80);presentStreetFixtures();
assert.ok(fixtureChunks[1].userData.shadowCasters.every(mesh=>!mesh.castShadow));
fixtureRenderer.shadowMap.enabled=false;
assert.equal(presentStreetFixtures().shadowDraws,0,'disabled shadows do not leave any stale caster prefix');
fixtureRenderer.shadowMap.enabled=true;sourceShadowBand(fixtureChunks[1].userData,true,40);presentStreetFixtures();
// Photo camera changes never require the fixed-step simulation to run.
fixtureCamera.lookAt(0,7,-150);
const turnedAway=presentStreetFixtures();assert.equal(turnedAway.oldBeautyDraws,0);assert.equal(turnedAway.beautyDraws,0);
assert.ok(turnedAway.shadowDraws>0,'off-camera original casters survive Photo orbit');
assert.ok(html.includes('renderInstances=function(i,a,o){if(0===o)return;')&&html.includes('renderInstances=function(i,l,c){if(0===c)return;'),
  'shipped r156 skips zero-instance beauty calls in both indexed and nonindexed buffer renderers');
fixtureCamera.lookAt(0,4,140);fixtureCamera.aspect=.45;fixtureCamera.updateProjectionMatrix();presentStreetFixtures();
fixtureCamera.aspect=16/9;fixtureCamera.updateProjectionMatrix();presentStreetFixtures();
for(const chunk of fixtureChunks)chunk.visible=false;
assert.deepEqual(presentStreetFixtures(),{oldBeautyDraws:0,beautyDraws:0,oldShadowDraws:0,shadowDraws:0},'hidden/reset chunks empty both passes');
const recycled=fixtureChunks[0];recycled.position.z=130;recycled.updateMatrix();recycled.visible=true;
fixtureLamps[0][0].visible=true;lampContext.syncRigidChunkProps(recycled.userData.lampBatches);
recycled.userData.trees[0].visible=true;lampContext.syncRigidChunkProps(recycled.userData.treeBatches);
recycled.userData.manholes[0].visible=true;sourceShadowBand(recycled.userData,true,130);
assert.ok(presentStreetFixtures().beautyDraws>0,'a recycled chunk restores fresh positions and complete instance prefixes');
assert.equal(fixtureSun.shadow.camera.left,-46);assert.equal(fixtureSun.shadow.camera.right,46,'authored shadow extent is unchanged');
const fallbackSource=fixturePools.sources[0].source,originalFallbackMaterial=fallbackSource.material;
const fallbackHook=fixtureScene.onBeforeRender,fallbackChildren=fixtureWorld.children.length;
lampContext.streetFixturePools=null;lampContext.PROFILE_RENDER=true;lampContext.window.location.search='?profile=1&streetfixtures=0';
lampContext.installStreetFixturePools();assert.equal(lampContext.streetFixturePools,null);
assert.equal(fixtureScene.onBeforeRender,fallbackHook);assert.equal(fixtureWorld.children.length,fallbackChildren);
assert.equal(fallbackSource.material,originalFallbackMaterial,'profiling fallback changes no sources or callbacks');
console.log(`PASS: actual world street pools; ${fixtureStart.oldBeautyDraws}→${fixtureStart.beautyDraws} opaque draws, original geometry/PBR identity, source frusta and caster prefixes, frozen/transformed roots, change-only uploads, LOD/reset/recycle and Photo orbit/resize; alpha layers untouched.`);
// Material shape facades own independent r156 program caches while every
// mutable palette property and custom hook stays live on its original owner.
const shapeSource=section('  var materialShapeFamilies =','  function mat(color, opts) {');
const shapeScene=new THREE.Scene(),shapeGeometry=new THREE.BoxGeometry(1,1,1);
const shapePalette=groundContext.applyCelShading(new THREE.MeshStandardMaterial({color:0x386fa8,
  roughness:.48,metalness:.55,envMapIntensity:.68,map:new THREE.Texture()}));
shapePalette.userData.cycle=shapePalette.userData;
const shapeRegular=new THREE.Mesh(shapeGeometry,shapePalette);
const shapePlain=new THREE.InstancedMesh(shapeGeometry,shapePalette,2);
const shapeColored=new THREE.InstancedMesh(shapeGeometry,shapePalette,2);
shapeColored.setColorAt(0,new THREE.Color(.7,.4,.1));shapeColored.count=0;
const shapeOther=new THREE.MeshStandardMaterial(),shapeSingle=new THREE.InstancedMesh(shapeGeometry,shapeOther,1);
const shapeAlpha=new THREE.MeshStandardMaterial({transparent:true,opacity:.3});
const shapeAlphaPlain=new THREE.Mesh(shapeGeometry,shapeAlpha),shapeAlphaInst=new THREE.InstancedMesh(shapeGeometry,shapeAlpha,1);
shapeScene.add(shapeRegular,shapePlain,shapeColored,shapeSingle,shapeAlphaPlain,shapeAlphaInst);
let shapeSort=null;
const shapeContext=vm.createContext({THREE,scene:shapeScene,renderer:{setOpaqueSort:f=>{shapeSort=f;}},
  PROFILE_RENDER:false,window:{location:{search:''}}});
vm.runInContext(shapeSource,shapeContext);shapeContext.installMaterialShapes();
const plainFacade=shapePlain.material,coloredFacade=shapeColored.material;
assert.equal(shapeRegular.material,shapePalette,'ordinary ownership stays on the original palette');
assert.notEqual(plainFacade,shapePalette);assert.notEqual(coloredFacade,plainFacade);
assert.equal(new Set([shapePalette.id,plainFacade.id,coloredFacade.id]).size,3);
assert.equal(new Set([shapePalette.uuid,plainFacade.uuid,coloredFacade.uuid]).size,3,'GPU owners have unique material UUIDs');
assert.equal(shapePlain.instanceColor,null,'specialization never manufactures instance colours');
assert.equal(shapeGeometry.attributes.color,undefined,'missing vertex colours retain Three defaults');
assert.equal(shapeColored.count,0,'empty coloured pools keep their future shape without becoming visible');
assert.equal(shapeSingle.material,shapeOther,'single-shape families remain unchanged');
assert.equal(shapeAlphaInst.material,shapeAlpha,'transparent ordering and ownership remain unchanged');
assert.equal(shapeContext.materialShapeFamilies.size,1);
shapeContext.installMaterialShapes();assert.equal(shapePlain.material,plainFacade,'installation is idempotent');
for(const key of Object.getOwnPropertyNames(shapePalette)){
  if(['id','uuid','_listeners','version','onBeforeCompile','customProgramCacheKey'].includes(key))continue;
  assert.equal(plainFacade[key],shapePalette[key],`${key} reads the original palette`);
}
shapePalette.color.setHex(0xd48246);shapePalette.emissiveIntensity=.43;
shapePalette.envMapIntensity=.95;shapePalette.roughness=.62;shapePalette.metalness=.31;
shapePalette.depthFunc=THREE.GreaterEqualDepth;shapePalette.depthWrite=false;shapePalette.polygonOffset=true;
shapePalette.polygonOffsetFactor=-2;shapePalette.side=THREE.DoubleSide;
shapePalette.map=new THREE.Texture();shapePalette.normalMap=new THREE.Texture();
for(const key of ['color','emissiveIntensity','envMapIntensity','roughness','metalness','depthFunc','depthWrite',
  'polygonOffset','polygonOffsetFactor','side','map','normalMap'])assert.equal(plainFacade[key],shapePalette[key],`${key} changes propagate without a frame copy`);
shapeContext.materialShapeSource(plainFacade).roughness=.57;
assert.equal(plainFacade.roughness,.57,'drawn variants resolve to the canonical palette for edits');
assert.equal(Object.getPrototypeOf(plainFacade),shapePalette,'renderer lookups inherit palette data without per-property getter calls');
const patchedA={uniforms:{},vertexShader:'',fragmentShader:THREE.ShaderLib.standard.fragmentShader};
const patchedB={uniforms:{},vertexShader:'',fragmentShader:THREE.ShaderLib.standard.fragmentShader};
shapePalette.onBeforeCompile(patchedA);plainFacade.onBeforeCompile(patchedB);
assert.equal(patchedB.fragmentShader,patchedA.fragmentShader);assert.equal(patchedB.uniforms.uCelBands,patchedA.uniforms.uCelBands);
assert.equal(plainFacade.customProgramCacheKey(),shapePalette.customProgramCacheKey(),'cel hooks and program key survive specialization');
for(const key of ['onBuild','onBeforeCompile','customProgramCacheKey','onBeforeRender']){
  const saved=shapePalette[key],argument={};let called=0;
  shapePalette[key]=function(value){assert.equal(this,shapePalette);assert.equal(value,argument);called++;return 'live-hook';};
  assert.equal(plainFacade[key](argument),'live-hook');assert.equal(called,1,'replacement hook keeps its original this/arguments');
  shapePalette[key]=saved;
}
const originalVersion=shapePalette.version;
plainFacade.needsUpdate=true;assert.equal(plainFacade.version,originalVersion+1);
assert.equal(shapePalette.version,originalVersion);assert.equal(coloredFacade.version,originalVersion);
shapePalette.needsUpdate=true;assert.equal(plainFacade.version,originalVersion+2);assert.equal(coloredFacade.version,originalVersion+1);
let plainDisposals=0,coloredDisposals=0,sourceDisposals=0;
plainFacade.addEventListener('dispose',e=>{assert.equal(e.target,plainFacade);plainDisposals++;});
coloredFacade.addEventListener('dispose',e=>{assert.equal(e.target,coloredFacade);coloredDisposals++;});
shapePalette.addEventListener('dispose',e=>{assert.equal(e.target,shapePalette);sourceDisposals++;});
plainFacade.dispose();assert.deepEqual([plainDisposals,coloredDisposals,sourceDisposals],[1,0,0]);
shapePalette.dispose();assert.deepEqual([plainDisposals,coloredDisposals,sourceDisposals],[2,1,1],'source disposal releases every independent GPU cache exactly once');
shapePlain.setColorAt(0,new THREE.Color());assert.equal(shapePlain.material,coloredFacade,'late colour allocation selects the cached colour shape');
shapePlain.instanceColor=null;assert.equal(shapePlain.material,plainFacade);
shapePlain.material=shapeOther;assert.equal(shapePlain.material,shapeOther,'runtime material replacement retains an unshared palette');
shapePlain.material=shapePalette;assert.equal(shapePlain.material,plainFacade,'restoring a shared palette reuses its cached owner');
// Compare the actual embedded r156 opaque comparator, including equal-depth
// ties and explicit groups/orders. Facade IDs must never reorder the picture.
const threeSource=scripts.find(s=>s.includes('three.js r156 (MIT)'));
const originalSort=new Function(section('function ga(t,e){','function _a(',threeSource)+';return ga;')();
const sortItems=Array.from({length:48},(_,i)=>({id:i,object:i%3===0?shapeRegular:i%3===1?shapePlain:shapeColored,
  material:i%4===0?shapeOther:i%3===0?shapePalette:i%3===1?plainFacade:coloredFacade,
  groupOrder:i%5===0?1:0,renderOrder:i%7===0?-1:0,z:i%6}));
const expectedOrder=sortItems.map(item=>({...item,material:shapeContext.materialShapeSource(item.material)})).sort(originalSort).map(item=>item.id);
assert.deepEqual(sortItems.slice().sort(shapeSort).map(item=>item.id),expectedOrder,'opaque order is identical to r156 with original material IDs');
// Execute r156's actual per-draw program re-selection condition and metadata
// writer. Program linking is replaced by a counter; the cache decision is not.
const selectionAt=threeSource.indexOf('let M=!1;',threeSource.indexOf('this.renderBufferDirect=function'));
const selectionEnd=threeSource.indexOf('let T=!1,',selectionAt);
assert.ok(selectionAt>=0&&selectionEnd>selectionAt&&selectionEnd-selectionAt<1500,'bounded r156 selection source');
const actualSelection=threeSource.slice(selectionAt,selectionEnd);
const chooseProgram=new Function('i','v','x','r','o','l','s','c','h','d','p','m','f','ut','_','Et','e','$t',actualSelection+'return b;');
const metadataSource=section('function Qt(t,e){','qt.setAnimationLoop(',threeSource);
function shapeResolutionTrace(specialized){
  const properties=new WeakMap(),get=m=>{if(!properties.has(m))properties.set(m,{});return properties.get(m);};
  const updateMetadata=new Function('mt',metadataSource+';return Qt;')({get});let resolutions=0;
  function resolve(material,scene,object){
    resolutions++;const state=get(material),instancing=!!object.isInstancedMesh;
    updateMetadata(material,{outputColorSpace:THREE.NoColorSpace,instancing,instancingColor:instancing&&object.instanceColor!==null,
      skinning:false,morphTargets:false,morphNormals:false,morphColors:false,morphTargetsCount:0,numClippingPlanes:0,
      numClipIntersection:0,vertexAlphas:false,vertexTangents:false,toneMapping:THREE.NoToneMapping});
    state.envMap=null;state.fog=null;state.currentProgram={};return state.currentProgram;
  }
  for(let repeat=0;repeat<20;repeat++)for(const object of [shapeRegular,shapePlain,shapeColored]){
    const material=specialized?object.material:shapePalette;
    chooseProgram(material,get(material),{state:{version:0}},object,THREE.NoColorSpace,null,null,
      false,false,false,false,false,THREE.NoToneMapping,{isWebGL2:true},0,{numPlanes:0,numIntersection:0},shapeScene,resolve);
  }
  return resolutions;
}
assert.equal(shapeResolutionTrace(false),60,'r156 re-resolves the warmed shared owner at every alternating shape');
assert.equal(shapeResolutionTrace(true),3,'independent material caches resolve once per shape and retain their programs');
// Actual group ranges, rather than retained fallback array slots, decide
// whether a regular draw exists beside a shared instanced palette.
const groupShapeScene=new THREE.Scene(),groupShapeGeometry=new THREE.BoxGeometry(1,1,1);
groupShapeGeometry.clearGroups();groupShapeGeometry.addGroup(0,6,0);
groupShapeGeometry.addGroup(6,6,1);groupShapeGeometry.addGroup(0,0,2);
groupShapeGeometry.setDrawRange(0,6);
const groupShapeMaterials=Array.from({length:4},()=>new THREE.MeshStandardMaterial());
const groupShapeMesh=new THREE.Mesh(groupShapeGeometry,groupShapeMaterials);
const groupShapeInstances=groupShapeMaterials.map(material=>new THREE.InstancedMesh(shapeGeometry,material,1));
const noGroupGeometry=shapeGeometry.clone();noGroupGeometry.clearGroups();
groupShapeScene.add(groupShapeMesh,new THREE.Mesh(noGroupGeometry,groupShapeMaterials),...groupShapeInstances);
const groupShapeContext=vm.createContext({THREE,scene:groupShapeScene,renderer:{setOpaqueSort(){}},PROFILE_RENDER:false});
vm.runInContext(shapeSource,groupShapeContext);groupShapeContext.installMaterialShapes();
assert.equal(groupShapeContext.materialShapeFamilies.size,1,'clipped, empty, unreferenced and absent groups create no false mixed family');
assert.equal(groupShapeMesh.material,groupShapeMaterials,'regular material arrays and original group ordering remain intact');
assert.notEqual(groupShapeInstances[0].material,groupShapeMaterials[0],'the actually drawn array group still specializes its instanced sibling');
for(let i=1;i<4;i++)assert.equal(groupShapeInstances[i].material,groupShapeMaterials[i],`dormant array slot ${i} leaves the one-shape owner unchanged`);
const fallbackShapeContext=vm.createContext({THREE,scene:shapeScene,PROFILE_RENDER:true,
  renderer:{setOpaqueSort(){assert.fail('fallback must not change sorting');}},window:{location:{search:'?profile=1&materialshapes=0'}}});
vm.runInContext(shapeSource,fallbackShapeContext);fallbackShapeContext.installMaterialShapes();
assert.equal(fallbackShapeContext.materialShapesInstalled,false);assert.equal(fallbackShapeContext.materialShapeFamilies.size,0);
console.log('PASS: material shape ownership, live palette/hooks, independent UUID/version/dispose, exact opaque ordering, actual r156 selection 60→3 resolutions, unchanged colour attributes and profiling fallback.');
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
  const holderMaterial=material.clone();holderMaterial.visible=false;warmScene.add(new THREE.Mesh(geometry,holderMaterial));
  warmScene.add(plain,tinted,hiddenRoot);
  const vertexGeometry=geometry.clone();vertexGeometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*3),3));
  warmScene.add(new THREE.Mesh(vertexGeometry,material));
  const skinned=new THREE.SkinnedMesh(geometry,material),bone=new THREE.Bone();skinned.add(bone);skinned.bind(new THREE.Skeleton([bone]));warmScene.add(skinned);
  const alphaMaterial=new THREE.MeshBasicMaterial({transparent:true,side:THREE.DoubleSide});warmScene.add(new THREE.Mesh(geometry,alphaMaterial));
  const sourceRT=new THREE.WebGLRenderTarget(300,600,{type:THREE.HalfFloatType,samples:2});
  sourceRT.texture.colorSpace=THREE.NoColorSpace;
  let target=null,compiled=0,rendered=0,finished=false,atlasDisposed=0,proxyDisposed=0,targetDisposed=false,tick=0;
  const callbacks=[], canvas={dataset:{}};
  const renderer={shadowMap:{needsUpdate:false},getRenderTarget:()=>target,setRenderTarget:t=>{target=t;},setOpaqueSort(){},
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
  const warmContext=vm.createContext({THREE,INDEX_RIGID_GEOMETRY:true,scene:warmScene,sun,renderer,POST:{on:postOn},sceneRT:sourceRT,camera:new THREE.PerspectiveCamera(),canvas,
    performance:{now:()=>tick++},requestAnimationFrame:fn=>callbacks.push(fn),
    unifyFlatPropMaterials:()=>({converted:0,baked:0,cloned:0}),batchChunkFlatDetails:()=>({sources:0,batches:0}),
    batchSetPieceFlatSiblings:()=>({sources:0,batches:0}),indexRigidSceneGeometry:()=>({geometries:0}),
    compactRigidSceneAttributes:()=>({geometries:0}),installStreetFixturePools:()=>{}});
  warmContext.PROFILE_RENDER=false;vm.runInContext(shapeSource,warmContext);
  vm.runInContext(section('  function warmRemainingPrograms(done) {','  function maybeFinishPreload() {'),warmContext);
  warmContext.warmRemainingPrograms(()=>{finished=true;});
  assert.equal(warmContext.materialShapeFamilies.size,1,'shape ownership is installed before the actual warm material/object gather');
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
// The connected Kiez route must not construct its retired macro scenes. Use
// the actual factories and geometry builders; only canvas painting and global
// texture/material inputs are stand-ins, with a distinct identity per slot.
function routeFunction(name) {
  const marker='  function '+name+'(',at=html.indexOf(marker),open=html.indexOf('{',at);
  assert.ok(at>=0&&open>at,'actual route helper '+name);
  return html.slice(at,open+1)+glslBody(html,marker)+'\n}';
}
const routeMaterial=(name)=>{const m=new THREE.MeshStandardMaterial({map:new THREE.Texture()});m.name=name;return m;};
const routePalette=(name)=>new Proxy({}, {get(o,k){return o[k]||(o[k]=routeMaterial(name+'.'+String(k)));}});
const routeScope=vm.createContext({THREE,console,Math,clamp:THREE.MathUtils.clamp,mergeBoxes:merge,
  MAT:routePalette('MAT'),STATION_MAT:routePalette('STATION'),TUNNEL_MAT:routePalette('TUNNEL'),
  BRIDGE_MAT:routePalette('BRIDGE'),STREET_MAT:routePalette('STREET'),facadeMats:routePalette('facade'),
  PROP_WOOD:routeMaterial('wood'),PROP_BANNER:routeMaterial('banner'),PROP_CRATE_BLUE:routeMaterial('crate'),
  CONSTRUCTION_HOARD_MAT:routeMaterial('hoarding'),STREET_ART_MAT:routeMaterial('art'),destRollMat:routeMaterial('destination'),
  ASSETS:{streetArt:true},canvas:{dataset:{}},outlineTransparentDetails:[],outlineTransparentWasVisible:[],seqLightMarkers:[],
  OBERBAUM_MASONRY_COLUMNS:3,OBERBAUM_MASONRY_ROWS:6,oberbaumBrickTex:new THREE.Texture(),
  FACADE_TILE_W:7.2,FACADE_STOREY_BANDS:3,STOREY_H:3.6,ROAD_HALF:7.2,WALK_OUT:12.4,
  riverbankIndustrialCache:Object.create(null),canvasTexture:()=>new THREE.Texture()});
vm.runInContext(section('  var geoCache = Object.create(null);','  function icoGeo(r)'),routeScope);
vm.runInContext(section('  var staticMergeGeometryCache =','  // Merges building parts that carry different materials'),routeScope);
for(const name of ['icoGeo','box','roundedBox','scaleUV','mergedPart','streetArtCellGeo','addStreetArtBatch',
  'registerSeqLightMarker','makeStationTrain','makeStationSequence','mapOberbaumMasonry','makeOberbaumArchGeo',
  'riverbankFacadeGeometry','riverbankIndustrialGeometry','makeSpreeVessels','makeSpreeBridgeSequence',
  'tramNoseProfile','makeTunnelTrain','makeTunnelSequence','makeBvgStopStory','makeInactiveRouteSequence','setMoverLive',
  'freezeObjectTree','freezeChunkStaticMatrices'])vm.runInContext(routeFunction(name),routeScope);
vm.runInContext(section('  var bridgeCableMat =','  function makeSpreeVessels()'),routeScope);
const macroStart=html.indexOf('  function makeChunk(');
const retiredSceneCode=section('    var streetStory =','    // Dedicated crate stacks',macroStart)+
  section('    var construction = new THREE.Group();','    var transit =',macroStart)+
  section('    var station = KIEZ_DISTRICT_ENABLED','    // Cross street:',macroStart);
const routeFactoryNames=['makeBvgStopStory','makeStationSequence','makeSpreeBridgeSequence','makeTunnelSequence'];
const routeFactoryCalls=[],routeOriginals={};
for(const name of routeFactoryNames){routeOriginals[name]=routeScope[name];routeScope[name]=function(){
  const result=routeOriginals[name]();routeFactoryCalls.push({name,result});return result;
};}
function routePayload(root){
  const geometry=new Set(),materials=new Set();let nodes=0,meshes=0,lines=0,triangles=0,bytes=0;
  root.traverse(node=>{nodes++;if(!node.isMesh&&!node.isLine)return;if(node.isMesh)meshes++;else lines++;
    const geo=node.geometry;geometry.add(geo);(Array.isArray(node.material)?node.material:[node.material]).forEach(m=>materials.add(m));
    if(node.isMesh)triangles+=(geo.index?geo.index.count:geo.attributes.position.count)/3;
  });
  for(const geo of geometry){for(const attr of Object.values(geo.attributes))bytes+=attr.array.byteLength;if(geo.index)bytes+=geo.index.array.byteLength;}
  return {nodes,meshes,lines,geometries:geometry.size,materials:materials.size,triangles,bytes};
}
function buildRouteRetired(reference){
  routeScope.KIEZ_DISTRICT_ENABLED=reference;routeScope.g=new THREE.Group();routeScope.ud={transit:{train:new THREE.Object3D()}};
  vm.runInContext(retiredSceneCode,routeScope);routeScope.g.userData=routeScope.ud;
  return {root:routeScope.g,ud:routeScope.ud,payload:routePayload(routeScope.g)};
}
const kiezRetired=buildRouteRetired(true);
assert.equal(routeFactoryCalls.length,0,'Kiez calls none of the four retired factories');
assert.deepEqual(kiezRetired.payload,{nodes:10,meshes:0,lines:0,geometries:0,materials:0,triangles:0,bytes:0});
assert.equal(routeScope.seqLightMarkers.length,0,'Kiez creates no sequence light markers');
assert.equal(kiezRetired.ud.constructionSides.length,0,'Kiez allocates no scaffold side payload');
const legacyRetired=buildRouteRetired(false);
assert.deepEqual(routeFactoryCalls.map(call=>call.name),routeFactoryNames,'legacy calls every original factory once');
for(const [key,name] of [['streetStory','makeBvgStopStory'],['station','makeStationSequence'],['bridge','makeSpreeBridgeSequence'],['tunnel','makeTunnelSequence']]){
  assert.equal(legacyRetired.ud[key],routeFactoryCalls.find(call=>call.name===name).result,'legacy retains exact original factory object identity');
}
assert.equal(legacyRetired.ud.constructionSides.length,2);
assert.equal(routeScope.seqLightMarkers.length,3,'legacy retains both station lamps and the tunnel sweep marker');
assert.ok(legacyRetired.payload.nodes>100&&legacyRetired.payload.triangles>30000&&legacyRetired.payload.bytes>1000000,
  'real macro factories contain substantial constructed geometry eliminated from Kiez startup');
// The remaining references support the unchanged freeze and mover lifecycle
// across repeated rerolls; they never acquire a mesh or compile candidate.
kiezRetired.root.add(kiezRetired.ud.transit.train);
assert.equal(kiezRetired.ud.routeMovers.length,1);assert.equal(kiezRetired.ud.routeMovers[0],kiezRetired.ud.transit.train);
assert.equal(legacyRetired.ud.routeMovers.length,5,'legacy retains all five original animated objects');
const reusedRouteMovers=kiezRetired.ud.routeMovers;
for(let cycle=0;cycle<20;cycle++){
  kiezRetired.root.position.z=cycle*40;routeScope.freezeChunkStaticMatrices(kiezRetired.root);
  for(const mover of [kiezRetired.ud.station.train,kiezRetired.ud.bridge.vessels,kiezRetired.ud.tunnel.train,kiezRetired.ud.tunnel.sweep]){
    assert.equal(mover.matrixAutoUpdate,false);assert.equal(mover.matrixWorldAutoUpdate,false,'freeze never reactivates retired movers');
    routeScope.setMoverLive(mover,false);
    assert.ok(mover.parent&&mover.parent.userData.inactiveRoute,'inert mover keeps a valid owned ancestry');
  }
  assert.equal(routePayload(kiezRetired.root).meshes,0);
  assert.equal(kiezRetired.ud.routeMovers,reusedRouteMovers,'rerolls reuse the startup mover list');
}
for(const [search,expected] of [['',0],['?district=legacy',5],['?profile=1&district=legacy',5]]){
  const lightScene=new THREE.Scene(),lightScope=vm.createContext({THREE,scene:lightScene,window:{location:{search}}});
  vm.runInContext(section('  var rim = new THREE.PointLight(', '  // Fixed pool of "sequence" point lights'),lightScope);
  vm.runInContext(section('  var KIEZ_DISTRICT_ENABLED =','  // Called by makeStationSequence'),lightScope);
  assert.equal(lightScope.SEQ_LIGHT_POOL_SIZE,expected);assert.equal(lightScope.seqLightPool.length,expected);
  assert.equal(lightScene.children.filter(node=>node.isPointLight).length,expected+2,'total point lights preserve both courier sources');
}
assert.equal((html.match(/var KIEZ_DISTRICT_ENABLED =/g)||[]).length,1,'route selection has one initialization before resource allocation');
console.log('PASS: retired route construction; actual legacy payload '+JSON.stringify(legacyRetired.payload)+
  ' becomes '+JSON.stringify(kiezRetired.payload)+' in Kiez; exact legacy identities,20freeze/recycle cycles and5→0sequence lights.');
console.log('PASS: 30/60 Hz presentation at 59.94–144 Hz; stable traffic/shadow work at 30–144 Hz; allocation-free effect tier changes; single-commit rotation; Retina/4K pixel budgets; sustained pressure/recovery; context recovery; hitch/background guards; shared canopy geometry and bounds.');
