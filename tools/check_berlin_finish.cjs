'use strict';
// Validate the shipped art geometry; --export writes a Blender inspection kit.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
function section(a,b,source=html){
  const start=source.indexOf(a),end=source.indexOf(b,start+a.length);
  assert.ok(start>=0&&end>start,`source anchors: ${a}`);return source.slice(start,end);
}
const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
const runtime=vm.createContext({console});
vm.runInContext(source.find(x=>x.includes('three.js r156 (MIT)')),runtime);
const THREE=runtime.THREE;
let desktopPostShader,desktopPostConfig;
// Construct the actual post chain with real r156 targets/materials. This
// checks feature selection and shader declarations, not GPU/FPS behavior.
for(const mode of ['webgl2','webgl1-hdr','webgl1-ldr','no-depth','no-derivatives','low-precision']){
  const extensions=new Set(['WEBGL_depth_texture','OES_standard_derivatives']);
  if(mode==='webgl1-hdr')for(const e of ['EXT_color_buffer_half_float','OES_texture_half_float','OES_texture_half_float_linear'])extensions.add(e);
  if(mode==='webgl2')extensions.add('EXT_color_buffer_float');
  if(mode==='no-depth')extensions.delete('WEBGL_depth_texture');
  if(mode==='no-derivatives')extensions.delete('OES_standard_derivatives');
  const classes=new Map();
  const fixture=vm.createContext({THREE,Math,IS_MOBILE:mode!=='webgl2',renderScale:1,BASE_EXPOSURE:1.06,
    document:{body:{classList:{toggle:(name,enabled)=>classes.set(name,enabled)}}},
    renderer:{capabilities:{isWebGL2:mode==='webgl2',getMaxPrecision:()=>mode==='low-precision'?'mediump':'highp'},
      extensions:{has:name=>extensions.has(name)},getDrawingBufferSize:out=>out.set(780,1688)},
    camera:new THREE.PerspectiveCamera(69,390/844,.4,4000),canvas:{style:{},dataset:{}}});
  vm.runInContext(section('  var POST = {','  function postMakeRT('),fixture);
  vm.runInContext(section('  function postMakeRT(','  function postResize()'),fixture);
  const active=['webgl2','webgl1-hdr','webgl1-ldr'].includes(mode);
  assert.equal(fixture.POST.on,active,`${mode}: selects a usable presentation path`);
  assert.equal(classes.get('gpu-finish'),active,'CSS finishing layers remain available only for direct-render fallback');
  if(active){
    assert.ok(fixture.compositeMat.fragmentShader.includes('dFdx(P)'));
    assert.equal(fixture.compositeMat.extensions.derivatives,true,'WebGL 1 derivative functions are enabled');
    assert.equal(fixture.sceneRT.texture.type,mode==='webgl1-ldr'?THREE.UnsignedByteType:THREE.HalfFloatType);
    assert.equal(fixture.sceneRT.samples,mode==='webgl2'?2:0,'phone HDR remains single-sampled');
    assert.equal(fixture.compositeMat.uniforms.tOutlineD.value,fixture.sceneRT.depthTexture);
    assert.equal(fixture.contactAORT.width,390);
    assert.equal(fixture.contactAORT.height,844);
    assert.equal(fixture.contactAORT.texture.type,THREE.UnsignedByteType,'contact shading uses one small RGBA8 buffer');
    assert.equal(fixture.contactAORT.texture.minFilter,THREE.NearestFilter,'packed depths are never interpolated by the GPU');
    assert.equal(fixture.contactAORT.depthBuffer,false);
    assert.equal(fixture.compositeMat.uniforms.uHalfAO.value,1);
    assert.equal(fixture.compositeMat.uniforms.tContactAO.value,fixture.contactAORT.texture);
    assert.equal(fixture.contactAOMat.uniforms.uCamTanFov,fixture.compositeMat.uniforms.uCamTanFov,'animated projection stays synchronized');
    assert.ok(fixture.contactAOMat.fragmentShader.includes('uniform sampler2D tContactAO;'));
    assert.ok(fixture.contactAOMat.fragmentShader.indexOf('outlineNormalHere(vUv, dist)')<fixture.contactAOMat.fragmentShader.indexOf('dist < uAoMaxDist ?'),'derivatives execute before depth-dependent branches');
    vm.runInContext(section('  function postResize() {','  // Once the quality ladder'),fixture);
    fixture.renderer.getDrawingBufferSize=out=>out.set(1687,779);
    fixture.postResize();
    assert.equal(fixture.sceneRT.width,1687,'rotation preserves full-resolution colour');
    assert.equal(fixture.contactAORT.width,844);
    assert.equal(fixture.contactAORT.height,390);
    assert.equal(fixture.compositeMat.uniforms.uContactTexel.value.x,1/844);
    assert.equal(fixture.compositeMat.uniforms.uContactTexel.value.y,1/390);
    fixture.window={location:{search:'?profile=1&aofull=1'}};
    fixture.contactAORT=null;fixture.contactAOMat=null;
    fixture.buildContactAO();
    assert.equal(fixture.contactAORT,null,'full-resolution comparison path allocates no extra target');
    assert.equal(fixture.renderer.toneMapping,THREE.NoToneMapping);
    assert.equal(fixture.canvas.dataset.postProcessing,'depth-composite');
    if(mode==='webgl2'){
      desktopPostShader=fixture.compositeMat.fragmentShader;
      desktopPostConfig=fixture.POST;
    }
  }else{
    assert.equal(fixture.sceneRT,null,'unsupported devices allocate no unusable targets');
    assert.equal(fixture.compositeMat,null,'unsupported devices never attempt the unsupported shader');
    assert.equal(fixture.renderer.toneMapping,THREE.ACESFilmicToneMapping);
    assert.equal(fixture.canvas.style.filter,'saturate(1.09) contrast(1.035)');
    assert.equal(fixture.canvas.dataset.postProcessing,'direct');
  }
}
console.log('PASS: actual post setup across six capability profiles; WebGL 1 derivative declaration, HDR/LDR choice, phone MSAA budget, depth source, and allocation-free direct fallback.');
// Execute the shader's depth-aware sample rejection with quantized RGBA8
// storage, including a foreground character against distant scenery.
const tapSource=section('vec2 contactTap(', 'float filteredContactAO(',desktopPostShader);
const tapBody=tapSource.slice(tapSource.indexOf('{')+1,tapSource.lastIndexOf('}'))
  .replace(/\b(?:float|vec3)\s+(\w+)\s*=/g,'let $1 =')
  .replace('texture2D(tContactAO, uv).rgb','sampleRGB');
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const runContactTap=new Function('sampleRGB','dist','weight','uAoMaxDist','smoothstep','abs','vec2',tapBody);
function packedContact(dist,occ){
  const x=Math.min(dist/85,.99999),b=(x*255)%1;
  return {r:Math.round(occ*255)/255,g:Math.round((x-b/255)*255)/255,b:Math.round(b*255)/255};
}
for(let depth=.4;depth<85;depth+=.083){
  const sample=packedContact(depth,.6);
  assert.ok(Math.abs((sample.g+sample.b/255)*85-depth)<.00066,'packed contact depth stays within 0.66 mm');
  const [value,weight]=runContactTap(sample,depth,.25,85,smooth,Math.abs,(...v)=>v);
  assert.equal(weight,.25);assert.equal(value/weight,sample.r,'same-surface AO is preserved exactly');
}
for(const [foreground,background] of [[3,12],[8,40],[30,85]]){
  const [value,weight]=runContactTap(packedContact(background,1),foreground,.25,85,smooth,Math.abs,(...v)=>v);
  assert.equal(value,0);assert.equal(weight,0,'background occlusion cannot bleed across the hero/vehicle silhouette');
}
console.log('PASS: half-size contact buffer/odd-size rotation; 0.66 mm packed-depth precision and depth-separated silhouette rejection.');
// Execute the shipped scalar early-out and final blend equations. Neighbour
// depths may produce any edge confidence, so compare that whole range with
// the former unconditional fade, including the exact boundary and a nonzero
// floor. This checks shader behavior without claiming to compile GLSL here.
const outlineShader=section('float outlineEdge(', '\nvec3 aoViewPos(',desktopPostShader);
const outlinePrefix=outlineShader.slice(outlineShader.indexOf('{')+1,outlineShader.indexOf('  vec2 o ='));
const fadeStatement=outlineShader.match(/float fade = [^;]+;/)[0];
const outlineReturn=outlineShader.match(/return clamp\(edge \* uOutlineStrength[^;]+;/)[0];
assert.equal(outlineShader.match(/float fade =/g).length,1,'near and far pixels use one identical fade equation');
assert.ok(outlineShader.indexOf('if (fade == 0.0) return 0.0;')<outlineShader.indexOf('texture2D('),
  'zero contribution exits before any neighbour texture read');
assert.equal(desktopPostConfig.outlineFarFloor,0,'authored skyline floor enables the exact-zero saving');
const scalarNames=['dC','uOutlineEnable','uOutlineFarFloor','uOutlineFalloff','uOutlineFocalOnly','uCamFar',
  'edge','uOutlineStrength','mix','smoothstep','clamp'];
const earlyOutline=new Function(...scalarNames,outlinePrefix.replace(/\bfloat\b/g,'let')+'return null;');
const originalOutline=new Function(...scalarNames,fadeStatement.replace(/^float /,'let ')+'\n'+outlineReturn);
const scalarMix=(a,b,t)=>a*(1-t)+b*t,scalarClamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const scalarSmoothstep=(a,b,x)=>{const t=scalarClamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
let skippedOutlineCases=0,continuedOutlineCases=0;
for(const falloff of [85,desktopPostConfig.outlineDepthFalloff,720]){
  for(const floor of [0,0.12,0.7,1])for(const depth of [0.4,falloff*.28,falloff*.5,falloff-0.01,falloff,falloff+1,4000]){
    for(const edge of [0,0.12,0.65,1])for(const strength of [0,0.34,1.5]){
      const args=[depth,1,floor,falloff,0,4000,edge,strength,scalarMix,scalarSmoothstep,scalarClamp];
      const early=earlyOutline(...args),original=originalOutline(...args);
      assert.equal(early===null?original:early,original,'skipping neighbour depths preserves the final outline at every edge confidence');
      if(floor===0&&depth>=falloff){
        assert.equal(early,0,'fully faded skyline and sky require no neighbour samples');skippedOutlineCases++;
      }else{
        assert.equal(early,null,'near contours, partial distance fade and nonzero far floors retain their original samples');continuedOutlineCases++;
      }
    }
  }
}
for(const [enabled,focal] of [[0,0],[1,1]]){
  assert.equal(earlyOutline(4000,enabled,0.12,265,focal,4000,1,.34,scalarMix,scalarSmoothstep,scalarClamp),0,
    'existing outline-off and focal-background guards remain effective with a nonzero far floor');
}
console.log(`PASS: shipped outline fade skips ${skippedOutlineCases} zero-contribution cases before depth reads; ${continuedOutlineCases} near/nonzero-floor cases preserve the original equation.`);
const mergeBoxes=new Function('THREE',section('  function mergeBoxes(specs) {','\n  // DRAW-CALL CONSOLIDATION:')+';return mergeBoxes;')(THREE);
const windowKit=new Function('THREE','mergeBoxes','mat','cssHex','CITY','MAT','FACADE_TILE_W','STOREY_H',
  section('  var WINDOW_BAY_W =','  // Capacity: worst realistic case')+
  ';return {regular:windowBayUnitGeo,arch:windowArchUnitGeo,layout:windowBayPositions};')(
    THREE,mergeBoxes,()=>null,()=>0,{}, {facadeStone:{color:new THREE.Color(0xd3c6aa)}},7.2,3.6);
function checkGeometry(geometry,label){
  const p=geometry.attributes.position,n=geometry.attributes.normal,c=geometry.attributes.color;
  assert.equal(n.count,p.count);assert.equal(c.count,p.count);
  for(let i=0;i<p.count;i++){
    assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)),`${label}: finite positions`);
    const length=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));
    assert.ok(Math.abs(length-1)<0.002,`${label}: unit normals at ${i}: ${length}`);
    for(const v of [c.getX(i),c.getY(i),c.getZ(i)])assert.ok(v>=0&&v<=1,`${label}: linear colours in range`);
  }
  geometry.computeBoundingBox();
}
for(const [label,geometry] of [['regular',windowKit.regular],['arch',windowKit.arch]]){
  checkGeometry(geometry,label);
  assert.ok(geometry.attributes.position.count/3<=150,'window bevels have a bounded triangle cost');
  assert.ok(geometry.boundingBox.min.z>=-1e-6,'sills meet the wall without extending behind the building');
  assert.ok(geometry.boundingBox.max.z<0.47,'sills remain in the existing sidewalk envelope');
}
for(const width of [11,13.5,16])for(const floors of [3,4,5,6,7,8])for(const variant of [0,1,2,3]){
  const bays=windowKit.layout(width,floors,variant);
  assert.equal(bays,windowKit.layout(width,floors,variant),'recycled layouts do not allocate');
  const centers=variant===2?[0.3,0.7]:[0.205,0.5,0.795];
  const half=7.2*(variant===2?0.205:0.148)*0.5;
  for(const bay of bays){
    const u=(bay.x+width/2)/7.2, fraction=u-Math.floor(u);
    assert.ok(centers.some(c=>Math.abs(c-fraction)<1e-6),'trim aligns with the painted bay rhythm');
    assert.ok(bay.x-half-0.17>=-width/2-1e-6 && bay.x+half+0.17<=width/2+1e-6,'no partial frames across building corners');
    assert.ok(Math.abs((bay.y-1.872)/3.6-Math.round((bay.y-1.872)/3.6))<1e-6,'glass center aligns vertically');
  }
  assert.ok(bays.length*6<=252,'both instance pools fit the densest six-building chunk');
}
// Execute the real instance writer through broad -> narrow -> hidden reuse.
const writer=section('          if (bd.windowDepthOn) {','          if (bd.shopDepthOn) {');
const clear=section('    windowBayLocalMat.compose(WINDOW_BAY_ZERO_POS','    BUILD_WIDTHS.forEach(function (w) {',html.slice(html.indexOf('    // Unused window-bay / shopDepth slots')));
const identity=new THREE.Matrix4(),zeroPos=new THREE.Vector3(0,-50,0),zeroScale=new THREE.Vector3();
const narrow=[],wide=[];
const pool=a=>({setMatrixAt:(i,m)=>a[i]=m.clone(),needsUpdate(){}});
const write=new Function('THREE','windowBayPositions','bd','ud','bld',
  'var widths=[13.5],b2=0,WINDOW_BAY_CAP=252,windowBayIdx=0,windowArchIdx=0;'+
  'var windowBayLocalMat=new THREE.Matrix4(),windowBayInstMat=new THREE.Matrix4();'+
  'var WINDOW_BAY_ZERO_POS=new THREE.Vector3(0,-50,0),windowBayZeroQuat=new THREE.Quaternion(),WINDOW_BAY_ZERO_SCALE=new THREE.Vector3();'+
  writer+clear+';return [windowBayIdx,windowArchIdx];');
for(const [variant,on] of [[2,true],[0,true],[2,false],[2,true]]){
  const counts=write(THREE,windowKit.layout,{windowDepthOn:on,storeys:6,fallbackFacadeIndex:variant},
    {windowBayView:pool(narrow),windowArchView:pool(wide)},{matrix:identity});
  [narrow,wide].forEach((p,group)=>{
    assert.equal(p.length,252);
    p.forEach((m,i)=>assert.equal(Math.abs(m.determinant())>0,i<counts[group],'unused or previously active frames are cleared'));
  });
}
function buildTree(source){
  const cache=new Map();
  return new Function('THREE','cached','mergeBoxes',section('  function sculptedCanopyGeometry() {','  function makeTree()',source)+';return sculptedCanopyGeometry();')(
    THREE,(key,fn)=>{if(!cache.has(key))cache.set(key,fn());return cache.get(key);},mergeBoxes);
}
const canopy=buildTree(html);checkGeometry(canopy,'canopy');
const count=canopy.index.count/3;
const geometryBytes=g=>Object.values(g.attributes).reduce((sum,a)=>sum+a.array.byteLength,0)+(g.index?g.index.array.byteLength:0);
const packedBytes=geometryBytes(canopy);
assert.ok(packedBytes<50000,'indexed packed canopy keeps its GPU buffer below 50 KB');
assert.equal(canopy.attributes.normal.normalized,true,'signed normal data reaches the shader normalized');
assert.equal(canopy.attributes.color.normalized,true,'byte colours reach the shader normalized');
for(const index of canopy.index.array)assert.ok(index<canopy.attributes.position.count);
assert.ok(canopy.userData.hiddenTrianglesRemoved>700,'buried foliage removal makes a material saving');
assert.equal(count+canopy.userData.hiddenTrianglesRemoved,3456,'every original face is retained or proven buried');
const seen=new Map(),p=canopy.attributes.position,n=canopy.attributes.normal;
for(let i=0;i<p.count;i++){
  assert.ok(Math.hypot(p.getX(i),p.getZ(i))<2.05,'rotated foliage fits the shared cull/parking envelope');
  const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join('|');
  if(seen.has(key)){
    const j=seen.get(key);
    assert.ok(Math.hypot(n.getX(i)-n.getX(j),n.getY(i)-n.getY(j),n.getZ(i)-n.getZ(j))<0.002,'welded sphere seams stay smooth');
  } else seen.set(key,i);
}
console.log(`PASS: aligned regular/arched windows across 72 facade layouts; pooled variant recycling; bevel normals/bounds; ${count} crown triangles (${canopy.userData.hiddenTrianglesRemoved} hidden faces removed), ${packedBytes} geometry bytes, smooth seams and unchanged cull envelope.`);
// Construct the actual collectible; texture callbacks run against a drawing
// stub while the solid, capped rope and both instance pools use real Three.
const drawStub={createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),
  fillRect(){},save(){},restore(){},translate(){},rotate(){}};
const pickup=vm.createContext({THREE,Math,scene:new THREE.Scene(),LANES:[-2.8,0,2.8],mergeBoxes,
  mat:(color,opts)=>new THREE.MeshStandardMaterial({color,...opts}),fillRR(){},
  canvasTexture:(w,h,paint)=>{paint(drawStub,w,h);return new THREE.Texture();}});
vm.runInContext(section('  var PRETZEL_POOL =','  function spawnPretzelRun('),pickup);
const pickupSolid=pickup.pretzelSolidInst.geometry;
pickupSolid.computeBoundingBox();
assert.equal(pickup.scene.children.filter(o=>o.isInstancedMesh).length,2,'solid and halo still use exactly two shared draws');
assert.equal(pickup.pretzels.length,pickup.PRETZEL_POOL,'logical collectible pool capacity is unchanged');
assert.equal(pickupSolid.attributes.position.count/3,1304,'fuller rope reduces the former 1,688-triangle cost');
assert.equal(pickup.pretzelSolidInst.material.transparent,false,'dough remains opaque');
assert.ok(pickupSolid.boundingBox.max.x-pickupSolid.boundingBox.min.x<0.90,'fuller token stays within its compact lane footprint');
for(const key of ['position','normal','uv'])assert.ok([...pickupSolid.attributes[key].array].every(Number.isFinite),`pickup ${key} is finite`);
const pickupMesh=new THREE.Mesh(pickupSolid,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
pickupMesh.updateMatrixWorld();
const pickupRay=new THREE.Raycaster(),rayOrigin=new THREE.Vector3(),rayDirection=new THREE.Vector3(0,0,-1);
for(const [x,y] of [[-0.33,0.13],[0.33,0.13],[0,-0.30]]){
  pickupRay.set(rayOrigin.set(x*0.58,y*0.58,2),rayDirection);
  assert.equal(pickupRay.intersectObject(pickupMesh).length,0,'each of the three pretzel openings remains clear');
}
for(const [x,y] of [[-0.62,0.08],[0.62,0.08],[0,-0.57]]){
  pickupRay.set(rayOrigin.set(x*0.58,y*0.58,2),rayDirection);
  assert.ok(pickupRay.intersectObject(pickupMesh).length>0,'outer lobes and belly retain a solid silhouette');
}
// Bound the actual reduced centerline's deviation from the authored curve.
const pickupCurve=new THREE.CatmullRomCurve3(Array.from(pickup.PRETZEL_PATH,p=>new THREE.Vector3(...p)),false,'catmullrom',0.5);
const pickupSegments=Array.from({length:64},(_,i)=>new THREE.Line3(pickupCurve.getPointAt(i/64),pickupCurve.getPointAt((i+1)/64)));
const nearestPickupPoint=new THREE.Vector3();let maxPickupCurveError=0;
for(let i=0;i<=512;i++){
  const point=pickupCurve.getPointAt(i/512);let error=Infinity;
  for(const segment of pickupSegments){segment.closestPointToPoint(point,true,nearestPickupPoint);error=Math.min(error,point.distanceTo(nearestPickupPoint));}
  maxPickupCurveError=Math.max(maxPickupCurveError,error*0.58);
}
assert.ok(maxPickupCurveError<0.007,'reduced tube centerline stays within 7mm of its authored curve');
console.log(`PASS: opaque 1,304-triangle pretzel, three open loops, fixed two-draw pool and ${(maxPickupCurveError*1000).toFixed(2)}mm maximum centerline deviation.`);
// Build the actual power-up pool. The bear shield must read as a shield and
// present its paw throughout its bounded rock, with no extra opaque draw.
pickup.clamp=THREE.MathUtils.clamp;
vm.runInContext(section('  var geoCache = Object.create(null);','  // ------------------------------------------------- generated prop swaps'),pickup);
vm.runInContext(section('  var POWERUP_TYPES =','  function spawnPowerup('),pickup);
assert.equal(pickup.powerups.length,6,'power-up pool capacity is unchanged');
const shieldVisual=pickup.powerups[0].variants.shield,shieldSpin=shieldVisual.userData.spin;
assert.equal(shieldSpin.children.length,2,'gold frame and coloured face use exactly two opaque draws');
let shieldTriangles=0;
for(const mesh of shieldSpin.children){
  assert.equal(mesh.material.transparent,false);
  shieldTriangles+=(mesh.geometry.index?mesh.geometry.index.count:mesh.geometry.attributes.position.count)/3;
  for(const key of ['position','normal','uv'])assert.ok([...mesh.geometry.attributes[key].array].every(Number.isFinite));
}
assert.ok(shieldTriangles<650,'the outlined crest has a bounded triangle cost');
for(const p of pickup.powerups){
  assert.equal(p.variants.shield.userData.spin.children[0].geometry,shieldSpin.children[0].geometry,'pooled rims share geometry');
  assert.equal(p.variants.shield.userData.spin.children[1].geometry,shieldSpin.children[1].geometry,'pooled faces share geometry');
  assert.equal(p.variants.shield.userData.spin.children[1].material,shieldSpin.children[1].material,'navy and cream share one pooled material');
  assert.equal(p.variants.magnet.userData.spin.children.length,3,'magnet keeps its horseshoe and two poles');
  assert.equal(p.variants.spring.userData.spin.children.length,2,'two jump arrows retain two opaque draws');
}
shieldVisual.scale.setScalar(1);shieldVisual.parent.updateMatrixWorld(true);
const shieldRay=new THREE.Raycaster();
for(const [x,y,solid] of [[-.33,.25,true],[.33,.25,true],[0,-.54,true],[-.24,-.43,false],[.24,-.43,false]]){
  shieldRay.set(new THREE.Vector3(x,y,-3),new THREE.Vector3(0,0,1));
  assert.equal(shieldRay.intersectObject(shieldSpin,true).length>0,solid,'broad shoulders taper to a distinct lower shield point');
}
const rockPowerup=new Function('t','pup','powerVisual',
  section('      powerVisual.userData.spin.rotation.y =','      var powerPulse ='));
const pawPoints=[[0,-.10],[-.195,.092],[-.074,.19],[.074,.19],[.195,.092]];
const shieldCamera=new THREE.PerspectiveCamera(60,16/9,.1,20);
shieldCamera.position.set(0,.5,-4);shieldCamera.lookAt(0,0,0);shieldCamera.updateMatrixWorld(true);
const pawWorld=new THREE.Vector3(),pawScreen=new THREE.Vector3();let pawSamples=0;
for(const z of [12,56,130])for(let frame=0;frame<=64;frame++){
  const t=frame/8;
  rockPowerup(t,{type:'shield',z},shieldVisual);
  assert.ok(Math.abs(shieldSpin.rotation.y)<=.320001,'shield never turns its emblem away');
  shieldVisual.parent.updateMatrixWorld(true);
  for(const [x,y] of pawPoints){
    shieldSpin.localToWorld(pawWorld.set(x,y,-.081));pawScreen.copy(pawWorld).project(shieldCamera);
    shieldRay.setFromCamera(new THREE.Vector2(pawScreen.x,pawScreen.y),shieldCamera);
    const hit=shieldRay.intersectObject(shieldSpin,true)[0];
    assert.ok(hit&&hit.object===shieldSpin.children[1],'recessed face and paw stay clear of the gold frame');
    const colors=hit.object.geometry.attributes.color;
    assert.ok(colors.getX(hit.face.a)>.99&&colors.getY(hit.face.a)>.75&&colors.getZ(hit.face.a)>.35,
      'all four toes and the central pad are cream, visible ahead of the navy surface');
    pawSamples++;
  }
  for(const type of ['magnet']){
    const visual=pickup.powerups[0].variants[type];rockPowerup(t,{type,z},visual);
    assert.equal(visual.userData.spin.rotation.y,t*2.2+z*.08,'other power-ups retain their existing spin');
  }
}
const jumpVisual=pickup.powerups[0].variants.spring,jumpSpin=jumpVisual.userData.spin;
jumpVisual.scale.setScalar(1);
const jumpGeometry=jumpSpin.children[0].geometry;
let jumpTriangles=0,jumpSamples=0;
for(const mesh of jumpSpin.children){
  assert.equal(mesh.geometry,jumpGeometry,'both arrows share one rounded extrusion');
  assert.equal(mesh.material.transparent,false);
  jumpTriangles+=(mesh.geometry.index?mesh.geometry.index.count:mesh.geometry.attributes.position.count)/3;
}
assert.ok(jumpTriangles<300,'double-jump silhouette keeps a small geometry cost');
for(const p of pickup.powerups)for(const mesh of p.variants.spring.userData.spin.children){
  assert.equal(mesh.geometry,jumpGeometry,'six pooled symbols share geometry');
}
for(let frame=0;frame<=64;frame++){
  rockPowerup(frame/8,{type:'spring',z:56},jumpVisual);
  jumpVisual.parent.updateMatrixWorld(true);
  for(const [index,offset] of [[0,.24],[1,-.24]])for(const [x,y] of [[0,.18],[-.23,-.02],[.23,-.02]]){
    jumpSpin.localToWorld(pawWorld.set(x,y+offset,-.102));pawScreen.copy(pawWorld).project(shieldCamera);
    shieldRay.setFromCamera(new THREE.Vector2(pawScreen.x,pawScreen.y),shieldCamera);
    const hit=shieldRay.intersectObject(jumpSpin,true)[0];
    assert.ok(hit&&hit.object===jumpSpin.children[index],'both upward chevrons remain exposed through the complete rocking motion');
    jumpSamples++;
  }
}
console.log(`PASS: ${shieldTriangles}-triangle bear shield and ${pawSamples} visible paw rays; ${jumpTriangles}-triangle double-jump arrows and ${jumpSamples} visible surface rays; shared pools and unchanged magnet spin.`);

// Drive the real collection, recycling and visual compaction paths together.
// A hidden logical slot must not reappear as a huge missed token beside the
// lens, and retirement must never reduce a still-collectible reward.
Object.assign(pickup,{player:{x:0,y:0,z:100},visualPlayer:{x:0,y:0,z:100},prevZ:99.1,t:.37,
  camera:new THREE.PerspectiveCamera(62,16/9,.4,4000),obstacles:[],PLAY_RENDER_FAR:220,
  pretzelCount:0,quizScore:0,fxFovPunch:0,lerp:THREE.MathUtils.lerp,playerHeight:()=>1.76,
  el:{pretzels:{textContent:'0',parentElement:{classList:{remove(){},add(){}}}}},
  requestAnimationFrame:callback=>callback(),playPretzelSound(){},fxPretzelPop(){},playPowerupSound(){},
  fxPopup(){},fxScreenPulse(){},updatePowerupHUD(){}});
pickup.applyPlayFrame=(object,x,y,z)=>object.position.set(x,y,z);
vm.runInContext(section('  function collectPretzels() {','  function playPowerupSound('),pickup);
vm.runInContext(section('  function collectPowerups() {','  // Gameplay objects now EXIST'),pickup);
vm.runInContext(section('  function pickupRetireScale(','  // ============================================================= visuals'),pickup);
vm.runInContext(section('  function spawnPretzelRun(','  // A diagonal reward trail'),pickup);
vm.runInContext(section('  function spawnPowerup(','  // The tram roof route'),pickup);
const pickupVisualSource=section('    // Pretzels spin and bob.','    // Speed streaks —');
const presentPickups=()=>vm.runInContext(pickupVisualSource,pickup);
function clearPickupState(){
  for(const p of pickup.pretzels){p.active=false;p.sprite.visible=false;}
  for(const p of pickup.powerups){p.active=false;p.holder.visible=false;}
  pickup.magnetTimer=pickup.springTimer=pickup.shieldCharges=pickup.airJumps=0;
  pickup.pretzelCount=pickup.quizScore=0;pickup.player.x=0;pickup.player.y=0;pickup.player.z=100;
}
function placePretzel(index,z,x=0,y=1){
  const p=pickup.pretzels[index];Object.assign(p,{active:true,z,x,y,lane:1});p.sprite.visible=true;return p;
}
let pickupBoundaryCases=0;
for(const speed of [13,26,54]) {
  pickup.prevZ=100-speed/60;
  const directNear=pickup.prevZ-.6;
  for(const [z,magnet,x,y,collect] of [
    [directNear+.00001,0,0,1,true],[directNear-.00001,0,0,1,false],
    [100.6,0,0,1,true],[100.60001,0,0,1,false],
    [99.20001,1,3,8,true],[99.2,1,3,8,false],
    [104.2,1,3,8,true],[104.20001,1,3,8,false]
  ]) {
    clearPickupState();pickup.magnetTimer=magnet;const p=placePretzel(0,z,x,y);
    pickup.recycle();presentPickups();
    if(collect){
      assert.equal(p.sprite.visible,true,'every direct/magnetic candidate stays visible');
      assert.equal(pickup.pickupRetireScale(z,Math.min(pickup.prevZ-.6,99.2)),1,'collectible pretzels retain full base scale');
    }
    pickup.collectPretzels();presentPickups();
    assert.equal(p.active,!collect,'actual swept and magnetic collection boundaries are unchanged');
    assert.equal(pickup.pretzelCount,Number(collect));assert.equal(pickup.quizScore,collect?10:0);
    if(collect){assert.equal(pickup.pretzelSolidInst.count,0);assert.equal(pickup.pretzelHaloInst.count,0);}
    pickupBoundaryCases++;
  }
  for(const type of pickup.POWERUP_TYPES)for(const [z,collect] of [
    [pickup.prevZ-.8+.00001,true],[pickup.prevZ-.8-.00001,false],[100.8,true],[100.80001,false]
  ]) {
    clearPickupState();const p=pickup.spawnPowerup(type,1,z);pickup.recycle();presentPickups();
    if(collect){assert.equal(p.holder.visible,true);assert.equal(pickup.pickupRetireScale(z,pickup.prevZ-.8),1);}
    pickup.collectPowerups();
    assert.equal(p.active,!collect,'power-up swept collection window is unchanged');
    assert.equal(pickup.quizScore,collect?50:0);
    if(collect){
      assert.equal(p.holder.visible,false);
      if(type==='magnet')assert.equal(pickup.magnetTimer,pickup.MAGNET_TIME);
      else if(type==='shield')assert.equal(pickup.shieldCharges,1);
      else {assert.equal(pickup.springTimer,pickup.SPRING_TIME);assert.equal(pickup.airJumps,1);}
    }
    pickupBoundaryCases++;
  }
}
clearPickupState();pickup.prevZ=99.1;
const pickupNear=Math.min(pickup.prevZ-.6,pickup.player.z-.8);
const approachingPickup=placePretzel(0,110),taperedPickup=placePretzel(1,pickupNear-.5);
const retiredPickup=placePretzel(2,pickupNear-1.01),farPickup=placePretzel(3,321),hiddenPickup=placePretzel(4,112);
pickup.recycle();hiddenPickup.sprite.visible=false;presentPickups();
assert.ok(retiredPickup.active&&!retiredPickup.sprite.visible,'missed pretzel retires visually while retaining its logical slot');
assert.equal(farPickup.sprite.visible,false,'far visibility remains authoritative');
assert.equal(pickup.pretzelSolidInst.count,2,'only the two visible sources enter the solid pool');
assert.equal(pickup.pretzelHaloInst.count,2,'the same sources enter the halo pool');
const pickupInstanceMatrix=new THREE.Matrix4(),pickupInstancePos=new THREE.Vector3(),pickupInstanceRotation=new THREE.Quaternion(),pickupInstanceScale=new THREE.Vector3();
for(const [index,p,retirement] of [[0,approachingPickup,1],[1,taperedPickup,.5]]){
  const expectedScale=(1+Math.sin(pickup.t*4+p.z)*.07)*retirement;
  pickup.pretzelSolidInst.getMatrixAt(index,pickupInstanceMatrix);pickupInstanceMatrix.decompose(pickupInstancePos,pickupInstanceRotation,pickupInstanceScale);
  assert.ok(Math.abs(pickupInstanceScale.x-expectedScale)<1e-6,'solid instance preserves approach pulse and applies only the post-window taper');
  assert.ok(Math.abs(pickupInstancePos.z-p.z)<1e-5,'compaction preserves the source position');
  pickup.pretzelHaloInst.getMatrixAt(index,pickupInstanceMatrix);pickupInstanceMatrix.decompose(pickupInstancePos,pickupInstanceRotation,pickupInstanceScale);
  assert.ok(Math.abs(pickupInstanceScale.x-1.22*expectedScale)<1e-6,'halo size follows the same retirement as its solid');
}
for(const type of pickup.POWERUP_TYPES){
  clearPickupState();const p=pickup.spawnPowerup(type,1,pickup.prevZ-.8-.5);pickup.recycle();presentPickups();
  const visual=p.variants[type],pulse=1.12+Math.sin(pickup.t*5+p.z)*.06;
  assert.ok(Math.abs(visual.scale.x-pulse*.5)<1e-8,'entire power-up icon and halo taper together only after collection expires');
  assert.equal(visual.userData.halo.parent,visual);
  p.z=pickup.prevZ-.8-1.01;pickup.recycle();presentPickups();
  assert.ok(p.active&&!p.holder.visible,'power-up retirement also preserves its logical slot');
}
clearPickupState();const reusedPretzel=placePretzel(0,88),reusedPowerup=pickup.spawnPowerup('shield',1,88);
pickup.recycle();assert.ok(reusedPretzel.active&&reusedPowerup.active,'both pickup pools retain the exact 12 m boundary');
reusedPretzel.z=reusedPowerup.z=87.99;pickup.recycle();presentPickups();
assert.ok(!reusedPretzel.active&&!reusedPowerup.active);
assert.equal(pickup.pretzelSolidInst.visible,false);assert.equal(pickup.pretzelHaloInst.visible,false);
pickup.spawnPretzelRun(1,110,1,false);const newPowerup=pickup.spawnPowerup('shield',1,110);pickup.recycle();presentPickups();
assert.equal(pickup.pretzels[0],reusedPretzel);assert.equal(newPowerup,reusedPowerup);
assert.ok(reusedPretzel.sprite.scale.x>.92&&newPowerup.variants.shield.scale.x>1.05,'reused pickups restore their full approach scale');
console.log(`PASS: ${pickupBoundaryCases} actual reward-window cases; paired solid/halo visibility and taper, unchanged scores/effects, 12 m logical lifetime and full-size reused pickups.`);
// Exercise the actual pickup recipe through the existing typed particle pool
// and popup pool, including long chains and retirement/reuse.
const rewardTexture=new THREE.Texture(),pulses=[];
const pickupFx=vm.createContext({THREE,Math,scene:new THREE.Scene(),window:{innerHeight:720},
  FX_VERT:'',FX_FRAG:'',fxAtlasTex:new THREE.Texture(),speed:36,fxFovPunch:0,
  rand:(a,b)=>a+(b-a)*0.61,fxN:n=>n,playSurfaceY:()=>0,routePathY:()=>0,
  routeFramePitch:0,routeFrameYaw:0,routeFrameBank:0,
  fxPopTexture:()=>rewardTexture,FX_POP_N:10,
  camera:new THREE.PerspectiveCamera(69,16/9,0.4,4000),fxScreenPulse:(...args)=>pulses.push(args)});
pickupFx.sampleRoutePoint=(x,y,z)=>{pickupFx.routePointX=x;pickupFx.routePointY=y;pickupFx.routePointZ=z;};
pickupFx.camera.position.set(0,3,96);
pickupFx.camera.lookAt(0,3,120);pickupFx.camera.updateMatrixWorld(true);
pickupFx.fxPops=Array.from({length:10},()=>({sprite:new THREE.Sprite(),mat:new THREE.SpriteMaterial({map:rewardTexture}),life:0,max:1}));
vm.runInContext(section('  var FX_TEX =','  var fxAtlasTex ='),pickupFx);
vm.runInContext(section('  function makeFxLayer(max, blending) {','  var fxAdd = makeFxLayer('),pickupFx);
pickupFx.fxAdd=pickupFx.makeFxLayer(96,THREE.AdditiveBlending);
vm.runInContext(section('  var SP = {','  function updateParticles(dt) {'),pickupFx);
vm.runInContext(section('  var fxPopHead = 0;','  // ---- runner trail ribbon'),pickupFx);
vm.runInContext(section('  var fxChain = 0, fxChainClock = 9;','  function fxGateCorrect('),pickupFx);
const particleStorage=Object.entries(pickupFx.fxAdd).filter(([,v])=>ArrayBuffer.isView(v));
for(const lane of [-2.8,0,2.8])for(const chain of [0,4,14]){
  const layer=pickupFx.fxAdd,head=layer.head,popIndex=pickupFx.fxPopHead,pulseCount=pulses.length;
  pickupFx.fxChain=chain?chain-1:0;pickupFx.fxChainClock=chain?0.1:9;
  pickupFx.fxPretzelPop(lane,1.05,100);
  const emitted=(layer.head-head+layer.max)%layer.max,side=lane>0?1:-1;
  assert.ok(emitted<=15,'long reward chains stay within fifteen existing pooled particles');
  for(let i=0;i<emitted;i++){
    const index=(head+i)%layer.max;
    assert.ok(layer.life[index]<=0.441,'pickup particles retire before they accumulate across the courier');
    assert.ok((layer.pos[index*3]-lane)*side>0.65,'burst is outboard of the collection lane');
    if(i>=2)assert.ok(layer.vel[index*3]*side>0,'sparkles travel away from the courier');
  }
  const glow=head,ring=(head+1)%layer.max;
  assert.ok(layer.s0[glow]<0.78 && layer.life[glow]<=0.101,'collection glint is compact and brief');
  assert.ok(layer.s1[ring]<1.26 && layer.life[ring]<=0.191,'chain ring cannot expand across multiple lanes');
  const popup=pickupFx.fxPops[popIndex];
  assert.equal(popup.mat.map,rewardTexture,'reward label reuses its cached texture');
  assert.equal(popup.life,0.44);assert.ok(popup.scale<0.48,'pickup text stays subordinate to the hero');
  pickupFx.fxUpdatePops(0.06);
  const popupView=popup.sprite.position.clone().applyMatrix4(pickupFx.camera.matrixWorldInverse);
  const popupTop=popupView.clone(),popupBottom=popupView.clone();
  popupTop.y+=popup.sprite.scale.y/2;popupBottom.y-=popup.sprite.scale.y/2;
  popupTop.applyMatrix4(pickupFx.camera.projectionMatrix);popupBottom.applyMatrix4(pickupFx.camera.projectionMatrix);
  assert.ok((popupTop.y-popupBottom.y)/2<=0.045001,'actual projected pickup label stays below 4.5% of the viewport, including side lanes');
  assert.equal(pulses.length-pulseCount,chain===4?1:0,'screen pulse occurs only at reward-chain milestones');
  if(chain===4)assert.ok(pulses[pulses.length-1][3]<0.05,'chain pulse stays restrained');
  pickupFx.updateFxLayer(layer,0.5);pickupFx.fxUpdatePops(0.5);
  assert.equal(layer.alive,0);assert.equal(layer.mesh.visible,false);
  assert.equal(popup.life,0);assert.equal(popup.sprite.visible,false);
  for(const [name,array] of particleStorage)assert.equal(layer[name],array,`${name} storage is reused`);
  assert.equal(pickupFx.scene.children.length,1,'collection creates no additional render objects');
}
const ordinaryPopup=pickupFx.fxPopup(0,2,100,'+50','#ffffff',0.8);
assert.equal(ordinaryPopup.life,0.78,'other feedback recipes retain the original popup lifetime');
assert.equal(ordinaryPopup.scale,0.8);
assert.equal(ordinaryPopup.maxScreenH,0.10,'reused popup slots restore the larger verdict label allowance');
console.log('PASS: pickup bursts stay outboard, fade within 440ms, reuse particle/popup storage, and preserve other popup behavior.');
if(process.argv.includes('--export')){
  function pack(g){
    const out={position:[],normal:[],color:[]};
    for(let i=0;i<(g.index?g.index.count:g.attributes.position.count);i++){
      const id=g.index?g.index.getX(i):i;
      for(const key of Object.keys(out)){
        const a=g.attributes[key];out[key].push(a.getX(id),a.getY(id),a.getZ(id));
      }
    }
    return out;
  }
  const kit={regular:pack(windowKit.regular),arch:pack(windowKit.arch),canopy:pack(canopy)};
  const beforeArg=process.argv.indexOf('--before');
  if(beforeArg>=0){
    const original=buildTree(fs.readFileSync(process.argv[beforeArg+1],'utf8'));
    kit.beforeCanopy=pack(original);
    const oldMesh=new THREE.Mesh(original),newMesh=new THREE.Mesh(canopy);
    oldMesh.updateMatrixWorld();newMesh.updateMatrixWorld();
    const ray=new THREE.Raycaster(),center=new THREE.Vector3(0,4.1,0);
    let compared=0;
    for(let az=0;az<24;az++)for(const el of [-0.45,0.1,0.65]){
      const a=az*Math.PI/12,direction=new THREE.Vector3(Math.cos(a)*Math.cos(el),Math.sin(el),Math.sin(a)*Math.cos(el));
      const right=new THREE.Vector3().crossVectors(direction,new THREE.Vector3(0,1,0)).normalize();
      const up=new THREE.Vector3().crossVectors(right,direction).normalize();
      for(let x=-4;x<=4;x++)for(let y=-4;y<=4;y++){
        const origin=center.clone().addScaledVector(direction,8).addScaledVector(right,x*.45).addScaledVector(up,y*.38);
        ray.set(origin,direction.clone().negate());
        const oldHit=ray.intersectObject(oldMesh,false)[0],newHit=ray.intersectObject(newMesh,false)[0];
        assert.equal(!!newHit,!!oldHit,'removed faces must never open a visible hole');
        if(oldHit)assert.ok(Math.abs(oldHit.distance-newHit.distance)<0.0001,'outer surface remains exact from every sampled direction');
        compared++;
      }
    }
    console.log(`PASS: ${compared} rays across 72 viewpoints preserve the original foliage surface; geometry ${geometryBytes(original)} -> ${packedBytes} bytes.`);
  }
  fs.writeFileSync(path.join(root,'audit/berlin-finish-inspection.json'),JSON.stringify(kit));
}
