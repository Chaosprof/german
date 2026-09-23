'use strict';
// Validate the shipped art geometry; --export writes a Blender inspection kit.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.resolve(root,process.env.BERLIN_HTML||'berlin-runner.html'),'utf8');
function section(a,b,source=html){
  const start=source.indexOf(a),end=source.indexOf(b,start+a.length);
  assert.ok(start>=0&&end>start,`source anchors: ${a}`);return source.slice(start,end);
}
const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]);
const runtime=vm.createContext({console});
vm.runInContext(source.find(x=>x.includes('three.js r156 (MIT)')),runtime);
const THREE=runtime.THREE;
const stockFogChunks=Object.fromEntries(['fog_vertex','fog_pars_vertex','fog_fragment','fog_pars_fragment']
  .map(name=>[name,THREE.ShaderChunk[name]]));
const surfaceFogSource=section('  THREE.ShaderChunk.fog_fragment =','  // Haze starts');
const syncSurfaceFog=html.match(/surfaceVistaState.enabled = surfaceVistaRequested && POST.on && surfaceVistaState.map \? 1 : 0;/)[0];
const fogLibraries=Object.keys(THREE.ShaderLib).filter(name=>THREE.ShaderLib[name].uniforms.fogColor);
function expandChunks(shader){return shader.replace(/#include <([\w\d_]+)>/g,(_,name)=>{
  assert.equal(typeof THREE.ShaderChunk[name],'string','every fog shader include resolves: '+name);
  return expandChunks(THREE.ShaderChunk[name]);
});}
let surfaceFogProfiles=0,surfaceFogCases=0;
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
    assert.equal(fixture.POST.aoOn,false,'shipped plaster uses baked/native contact shading');
    assert.equal(fixture.contactAORT,null,'disabled SSAO allocates no contact render target');
    assert.equal(fixture.contactAOMat,null,'disabled SSAO creates no kernel material');
    // Retain coverage for the optional source feature without confusing it
    // with the shipped path above. This is an explicit test-only opt-in.
    fixture.POST.aoOn=true;fixture.buildContactAO();
    assert.ok(fixture.compositeMat.fragmentShader.includes('dFdx(P)'));
    assert.equal(fixture.compositeMat.extensions.derivatives,true,'WebGL 1 derivative functions are enabled');
    assert.equal(fixture.sceneRT.texture.type,mode==='webgl1-ldr'?THREE.UnsignedByteType:THREE.HalfFloatType);
    assert.equal(fixture.sceneRT.samples,mode==='webgl2'?2:0,'phone HDR remains single-sampled');
    assert.equal(fixture.compositeMat.uniforms.tOutlineD.value,fixture.sceneRT.depthTexture);
    assert.equal(fixture.compositeMat.uniforms.uStreetVista,undefined,'distant artwork stays behind opaque and transparent foreground, outside the composite');
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
      fixture.POST.aoOn=false;
      desktopPostConfig=fixture.POST;
    }
  }else{
    assert.equal(fixture.sceneRT,null,'unsupported devices allocate no unusable targets');
    assert.equal(fixture.compositeMat,null,'unsupported devices never attempt the unsupported shader');
    assert.equal(fixture.renderer.toneMapping,THREE.ACESFilmicToneMapping);
    assert.equal(fixture.canvas.style.filter,'none','direct fallback has no extra display-space contrast or compositor pass');
    assert.equal(fixture.canvas.dataset.postProcessing,'direct');
  }
  // Build the actual global hook for every capability profile. ShaderLib was
  // assembled by Three before app startup; adding only UniformsLib.fog would
  // miss all these built-in uniform clones, including Basic/line materials.
  Object.assign(THREE.ShaderChunk,stockFogChunks);
  fixture.window={location:{search:''}};
  vm.runInContext(surfaceFogSource,fixture);
  const precision=mode==='low-precision'?'mediump':'highp';
  assert.equal(fixture.surfaceVistaPrecision,precision);
  const clonedFogUniforms=fogLibraries.map(name=>THREE.UniformsUtils.clone(THREE.ShaderLib[name].uniforms));
  for(let i=0;i<fogLibraries.length;i++){
    const name=fogLibraries[i],shader=THREE.ShaderLib[name];
    assert.equal(clonedFogUniforms[i].berlinFogVista.value,fixture.surfaceVistaState,
      name+' retains the same live plain struct, without a cloned texture');
    const vertex=expandChunks(shader.vertexShader),fragment=expandChunks(shader.fragmentShader);
    assert.ok(vertex.includes('varying '+precision+' vec3 vBerlinFogView;'));
    assert.ok(fragment.includes('varying '+precision+' vec3 vBerlinFogView;'));
    assert.ok(vertex.indexOf('vBerlinFogView = mvPosition.xyz;')>vertex.indexOf('vec4 mvPosition'),
      name+' captures the final projected vertex, after stock instancing/skinning/sprite transforms');
    assert.ok(fragment.includes('uniform BerlinFogVista berlinFogVista;'));
    assert.ok(fragment.includes('linearToOutputTexel(vec4(city, 1.0)).rgb'),
      name+' converts sampled linear color at the existing post-colorspace fog stage');
  }
  const decodedVista=new THREE.Texture();fixture.surfaceVistaState.map=decodedVista;
  vm.runInContext(syncSurfaceFog,fixture);
  assert.equal(fixture.surfaceVistaState.enabled,active?1:0,'direct/capability fallback disables this candidate');
  assert.ok(clonedFogUniforms.every(u=>u.berlinFogVista.value.map===decodedVista),'late decode reaches every original shader clone');
  fixture.surfaceVistaRequested=false;vm.runInContext(syncSurfaceFog,fixture);
  assert.equal(fixture.surfaceVistaState.enabled,0,'opt-out wins over a decoded image');
  fixture.surfaceVistaRequested=true;fixture.surfaceVistaState.map=null;vm.runInContext(syncSurfaceFog,fixture);
  assert.equal(fixture.surfaceVistaState.enabled,0,'load failure leaves the original fog active');
  fixture.skyTextures=[new THREE.Texture()];fixture.BERLIN_FERNSEHTURM_SURFACE_GLSL='';
  vm.runInContext(section('  var SKYLINE_TOP_FAR =','  var skyDome ='),fixture);
  assert.ok(fixture.skyMat.vertexShader.includes('varying '+precision+' vec3 vSkyViewPosition;'));
  assert.ok(fixture.skyMat.fragmentShader.includes('berlinStreetPicture(berlinStreetDomeUv(viewPosition))'),
    'dome and surface use exactly the same direction and image crop helper');
  const domeHazeMix=fixture.skyMat.fragmentShader.match(/mix\(\s*uHaze\s*,\s*city\s*,\s*([\d.]+)\s*\)/);
  assert.ok(domeHazeMix,'the actual dome shader declares its city/haze blend');
  assert.equal(Number(domeHazeMix[1]),fixture.surfaceVistaState.strength,
    'dome city blend and surface fog use the same authored strength');
  if(mode==='low-precision')for(const shader of [THREE.ShaderChunk.berlin_street_vista_pars,
    THREE.ShaderChunk.fog_pars_vertex,THREE.ShaderChunk.fog_pars_fragment,
    fixture.skyMat.vertexShader,fixture.skyMat.fragmentShader])assert.ok(!/\bhighp\b/.test(shader),
      'a genuine mediump-only fragment device gets no unsupported explicit highp qualifier');
  const fogBody=THREE.ShaderChunk.fog_fragment.slice(THREE.ShaderChunk.fog_fragment.indexOf('if (berlinFogVista.enabled'),
    THREE.ShaderChunk.fog_fragment.lastIndexOf('#endif')).replace(/\b(?:vec3|float) (\w+) =/g,'let $1 =');
  assert.ok(!/gl_FragDepth|gl_FragColor\.a|\bdiscard\b/.test(fogBody),'fog changes only RGB, never alpha/depth/coverage');
  const evalFog=new Function('berlinFogVista','vFogDepth','vBerlinFogView','fogColor','fogFactor','gl_FragColor',
    'berlinStreetDomeUv','berlinStreetPicture','texture2D','linearToOutputTexel','vec4','smoothstep','mix',fogBody);
  const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  for(const enabled of [0,1])for(const depth of [0,59.999,60,90,120,120.001,149,178,240])
  for(const mask of [0,.3,1])for(const alpha of [0,.17,1]){
    const state={...fixture.surfaceVistaState,enabled},base=[.21,.38,.57],haze=[.7,.75,.8],city=[.31,.5,.25];
    const color={rgb:base.slice(),a:alpha},factor=Math.pow(smooth(60,178,depth),2.4);
    let textureReads=0,directionReads=0;
    evalFog(state,depth,null,haze,factor,color,()=>{directionReads++;return [0,0];},()=>({xy:[.5,.25],z:mask}),
      ()=>{textureReads++;return {rgb:city};},v=>v,(rgb,a)=>({rgb,a}),smooth,mix);
    assert.equal(color.a,alpha);
    assert.equal(directionReads,enabled&&depth>120?1:0,'near/off pixels do no directional work');
    assert.equal(textureReads,enabled&&depth>120&&mask>0?1:0,'only distant in-cone pixels sample the existing image once');
    if(!enabled||depth<=120||mask===0)assert.deepEqual(color.rgb,mix(base,haze,factor),'original RGB expression is exact on every bypass path');
    if(enabled&&depth>=178&&mask===1)assert.deepEqual(color.rgb,mix(haze,city,state.strength),'fully fogged central surfaces match dome city/haze color');
    surfaceFogCases++;
  }
  fixture.skyMat.dispose();decodedVista.dispose();surfaceFogProfiles++;
}
console.log('PASS: actual post setup across six capability profiles; WebGL 1 derivative declaration, HDR/LDR choice, phone MSAA budget, depth source, and allocation-free direct fallback.');
console.log(`PASS: surface fog across ${surfaceFogProfiles} capability profiles/${fogLibraries.length} built-in libraries/${surfaceFogCases} RGB cases; exact near/disabled output, shared late-decode ownership, unchanged alpha/depth, one far-only texture read, identical dome helper and genuine mediump qualifier fallback. GLSL source contracts, not a driver compilation claim.`);
// Execute the shipped direction arithmetic, then compare against Three's
// independent ray/sphere intersection, including translated/banked cameras
// and points on both sides of the horizon. Both shader callers use this helper.
const directionSource=THREE.ShaderChunk.berlin_street_vista_pars;
const directionBody=directionSource.slice(directionSource.indexOf('{')+1,directionSource.indexOf('\n}') )
  .replace(/\b(?:highp|mediump) (?:vec3|float) (\w+) =/g,'let $1 =')
  .replace('viewPosition * mat3(viewMatrix)','multiplyView(viewPosition, viewMatrix)')
  .replace(/viewMatrix\[(\d)\]\.xyz/g,'viewMatrix[$1]')
  .replace('vec3(0.0, eyeY, 0.0) + ray * travel','addEye(ray, eyeY, travel)');
const evaluateDomeUv=new Function('viewPosition','viewMatrix','normalize','multiplyView','dot','sqrt','max','abs','atan','asin','clamp','fract','vec2','addEye',directionBody);
const directionHelpers=[v=>v.clone().normalize(),(v,m)=>new THREE.Vector3(v.dot(m[0]),v.dot(m[1]),v.dot(m[2])),
  (a,b)=>a.dot(b),Math.sqrt,Math.max,Math.abs,Math.atan2,Math.asin,THREE.MathUtils.clamp,x=>x-Math.floor(x),(...v)=>v,
  (ray,eyeY,travel)=>ray.clone().multiplyScalar(travel).add(new THREE.Vector3(0,eyeY,0))];
let directionCases=0,maxDirectionError=0;
for(const position of [[0,2.55,-6.5],[1.3,3.57,84],[-5,18,1024]])for(const bank of [-.12,0,.12]){
  const view=new THREE.PerspectiveCamera(40,16/9,.4,4000);view.position.fromArray(position);
  view.lookAt(position[0]+.3,position[1]-.1,position[2]+18);view.rotateZ(bank);view.updateMatrixWorld(true);
  const m=view.matrixWorldInverse.elements,columns=[0,1,2,3].map(i=>new THREE.Vector3(m[i*4],m[i*4+1],m[i*4+2]));
  const centre=new THREE.Vector3(position[0],0,position[2]),sphere=new THREE.Sphere(centre,2000);
  for(const azimuth of [-.1,-.05,0,.05,.1])for(const elevation of [-.032,-.018,-.003,.008,.03,.06])for(const distance of [130,178,500]){
    const direction=new THREE.Vector3(Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation));
    const point=view.position.clone().addScaledVector(direction,distance).applyMatrix4(view.matrixWorldInverse);
    const actual=evaluateDomeUv(point,columns,...directionHelpers);
    const hit=new THREE.Ray(view.position,direction).intersectSphere(sphere,new THREE.Vector3()).sub(centre).normalize();
    const expected=[.25+Math.atan2(hit.x,hit.z)/(2*Math.PI),Math.asin(hit.y)*2/Math.PI];
    for(let axis=0;axis<2;axis++){const error=Math.abs(actual[axis]-expected[axis]);maxDirectionError=Math.max(maxDirectionError,error);
      assert.ok(error<1e-10,'surface and exact dome rays share signed spherical UVs');}
    assert.equal(Math.sign(actual[1]),Math.sign(expected[1]),'below-horizon coordinates never mirror the sky');directionCases++;
  }
}
console.log(`PASS: ${directionCases} translated/banked/depth ray cases agree with exact dome sphere UVs; maximum error${maxDirectionError.toExponential(2)}. Projection arithmetic check, not GPU sampling precision.`);
// Execute the actual environment controller through multiple former day/night
// boundaries, rewards and overdrive. Lighting must remain identical, while
// geometric skyline approach and the existing device fallback still function.
const daylightContext=vm.createContext({THREE});
vm.runInContext(section('  var MOOD_TREATMENTS = [','  // ========================================================== world layout'),daylightContext);
assert.equal(daylightContext.MOOD_TREATMENTS.length,1,'only the fixed warm daylight palette is shipped');
const light=()=>({color:new THREE.Color(),intensity:0});
const daylightUniforms=Object.fromEntries(['mapA','mapB','uMapAScale','uMapBScale','uMix','uDayAir','uSkylineTop'].map(k=>[k,{value:0}]));
for(const key of ['uTint','uHaze','uSkylineTint'])daylightUniforms[key]={value:new THREE.Vector3()};
const daylightPost={on:true};
for(const key of ['lift','gain','gamma','shadowTint','highTint'])daylightPost[key]=new THREE.Color();
const daylightDom=Object.fromEntries(['colorgrade','colorgradeNight','colorgradeDawn','halation','halationNight','halationDawn','vig'].map(k=>[k,{style:{}}]));
Object.assign(daylightContext,{
  clamp:THREE.MathUtils.clamp,lerp:THREE.MathUtils.lerp,distance:0,answerKick:0,fxAberrKick:0,
  POST:daylightPost,scene:{background:new THREE.Color(),fog:new THREE.Fog(0,1,170)},
  skyMat:{uniforms:daylightUniforms},skyTextures:[{userData:{panoramaScale:1.4}},{},{}],
  skylineStripActive:true,SKYLINE_APPROACH_DIST:1200,SKYLINE_TOP_FAR:.158,SKYLINE_TOP_NEAR:.183,
  FOG_COLOR:new THREE.Color(),FOG_FAR_MAX:178,renderer:{},hemi:{...light(),groundColor:new THREE.Color()},
  sun:{...light(),castShadow:true},fill:light(),rim:light(),groundBounce:light(),
  shopMats:[{},{},{}],MAT:{glassLit:{},bulb:{color:new THREE.Color()},lampGlobe:{emissive:new THREE.Color()}},
  STATION_MAT:{light:{}},lampConeMat:{},skylineLayers:[0,1,2].map(()=>({material:{color:new THREE.Color()}})),
  _skylineHazeTmp:new THREE.Color(),SKYLINE_HAZE_LEAN:[.12,.25,.4],el:daylightDom
});
vm.runInContext(section('  function updateEnvironmentMood(od) {','  var lastSpeedveilOpacity = -1;'),daylightContext);
function daylightSnapshot(){
  const d=daylightContext,u=d.skyMat.uniforms;
  return JSON.stringify({
    indices:[d.moodFromIndex,d.moodToIndex,d.moodMix,d.moodDuskWeight,d.moodNightWeight,d.moodDawnWeight],
    sky:[u.uMix.value,u.uDayAir.value,u.uMapAScale.value,u.uMapBScale.value,u.uTint.value,u.uHaze.value,u.uSkylineTint.value],
    scene:[d.scene.background,d.scene.fog],lights:[d.hemi,d.sun,d.fill,d.rim,d.groundBounce],
    post:Object.fromEntries(Object.entries(d.POST).filter(([k])=>k!=='gradeDirty')),
    shop:d.shopMats,materials:d.MAT,station:d.STATION_MAT,cone:d.lampConeMat,dom:d.el
  });
}
daylightContext.updateEnvironmentMood(0);
const fixedDaylight=daylightSnapshot();
let daylightRuns=0;
for(const distance of [0,895,896,1279,1280,2560,3840,10000,50000])for(const overdrive of [0,1,4])for(const answerKick of [0,1]){
  daylightContext.distance=distance;daylightContext.answerKick=answerKick;daylightContext.fxAberrKick=.02;
  if(daylightRuns%3===0)daylightContext.lastMoodFromIndex=-1; // include a fresh apply, not just cache hits
  daylightContext.updateEnvironmentMood(overdrive);
  assert.equal(daylightSnapshot(),fixedDaylight,'route, reward and overdrive retain exactly one daylight');
  assert.deepEqual(Array.from(daylightPost.gamma.toArray()),[1,1,1],
    'the specialized composite is valid only while grading gamma remains the identity');
  assert.equal(daylightUniforms.mapA.value,daylightContext.skyTextures[0]);
  assert.equal(daylightUniforms.mapB.value,daylightContext.skyTextures[0]);
  assert.ok(daylightUniforms.uSkylineTop.value>=.158&&daylightUniforms.uSkylineTop.value<=.183);
  daylightRuns++;
}
daylightPost.gradeDirty=false;daylightContext.updateEnvironmentMood(4);
assert.equal(daylightPost.gradeDirty,false,'steady daylight avoids per-frame material and grade writes');
daylightContext.skyTextures[0]={userData:{panoramaScale:.8}};
daylightContext.updateEnvironmentMood(0);
assert.equal(daylightUniforms.mapA.value,daylightContext.skyTextures[0],'asynchronous daylight texture replacement invalidates the cache');
assert.equal(daylightUniforms.uMapAScale.value,.8);
daylightContext.skylineStripActive=false;daylightContext.updateEnvironmentMood(0);
assert.ok(daylightContext.skylineLayers.every(layer=>layer.visible),'failed skyline strip restores the fog-tinted fallback rings');
daylightContext.POST.on=false;daylightContext.updateEnvironmentMood(0);
assert.equal(daylightContext.renderer.toneMappingExposure,daylightContext.MOOD_TREATMENTS[0].exposure,'direct fallback receives the same fixed exposure');
daylightContext.sun.castShadow=false;daylightContext.updateEnvironmentMood(0);
assert.equal(daylightContext.POST.exposure,daylightContext.MOOD_TREATMENTS[0].exposure-.42,'emergency no-shadow compensation remains intact');
console.log(`PASS: ${daylightRuns} daylight runs through 50 km, former hour boundaries, rewards and overdrive; fixed radiance/fog/palette/grade, texture reload, skyline fallback and direct-render capability handling.`);
// Execute the actual compiled material's small color expressions. Only GLSL
// scalar declarations, RGB swizzles and vector/scalar compound assignments
// are adapted for JS; every coefficient and branch comes from the shader.
// This checks arithmetic invariants, not GPU compilation or mediump accuracy.
function runColorBody(body,colorName){
  let translated=body.replace(/\bfloat\s+(\w+)\s*=/g,'let $1 =');
  translated=translated.replace(new RegExp('\\b'+colorName+'\\.([rgb])','g'),(_,c)=>colorName+'['+'rgb'.indexOf(c)+']');
  translated=translated.replace(new RegExp('\\b'+colorName+'\\s*([*\\-])=\\s*([^;]+);','g'),
    (_,op,expression)=>`${colorName} = ${colorName}.map(channel => channel ${op} (${expression}));`);
  const evaluate=new Function(colorName,'min','max','mix','vec3','clamp','dot',translated);
  return rgb=>evaluate(rgb.slice(),Math.min,Math.max,(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),
    (...v)=>v.length===1?[v[0],v[0],v[0]]:v,THREE.MathUtils.clamp,(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0));
}
const toneSource=section('vec3 neutralTonemap(', 'vec3 encodeSRGB(',desktopPostShader);
const toneBody=toneSource.slice(toneSource.indexOf('{')+1,toneSource.lastIndexOf('}'));
const toneColor=runColorBody(toneBody,'c');
const peakBranch=toneBody.match(/if\s*\(peak\s*<\s*([^)]*)\)/);
assert.ok(peakBranch,'the shipped tone curve has a peak-compression boundary');
const toneKnee=new Function('return ('+peakBranch[1]+');')();
const tonePeak=runColorBody(toneBody.slice(0,peakBranch.index)+'return peak;','c');
const toeBranch=toneBody.match(/x\s*<\s*([^?]+)\?/);
assert.ok(toeBranch,'the shipped toe has an explicit continuous boundary');
const toneToe=new Function('return ('+toeBranch[1]+');')();
const colorDirections=[[1,1,1],[1,0,0],[0,1,0],[0,0,1],[1,1,0],[0,1,1],
  [1,0,1],[1,.52,.20],[.18,1,.35],[.12,.34,1]];
const intensities=[0,1e-9,1e-7,1e-5,...Array.from({length:2048},(_,i)=>(i+1)/128),32,64,256];
let toneCases=0,clarityCases=0,maxKneeJump=0;
function finiteColor(rgb,label){assert.equal(rgb.length,3);assert.ok(rgb.every(Number.isFinite),label+' stays finite');}
for(const direction of colorDirections){
  let previous=[0,0,0];
  for(const intensity of intensities){
    const input=direction.map(v=>v*intensity),output=toneColor(input);finiteColor(output,'tone ramp');
    output.forEach((v,k)=>{
      assert.ok(v>=-1e-12&&v<=1+1e-12,'nonnegative HDR inputs tone-map into display headroom');
      assert.ok(v>=previous[k]-1e-12,'every RGB channel is monotonic along a fixed-hue exposure ramp');
    });
    if(direction.every(v=>v===1))assert.ok(Math.max(...output)-Math.min(...output)<1e-12,'gray stays achromatic');
    previous=output;toneCases++;
  }
  // Solve the branch location from its actual pre-compression arithmetic;
  // colored toes do not all reach the shoulder at the gray input value.
  let lo=0,hi=16;
  assert.ok(tonePeak(direction.map(v=>v*hi))>toneKnee);
  for(let i=0;i<60;i++){const mid=(lo+hi)/2;
    if(tonePeak(direction.map(v=>v*mid))<toneKnee)lo=mid;else hi=mid;
  }
  const at=(lo+hi)/2,epsilon=1e-7;
  const lower=toneColor(direction.map(v=>v*(at-epsilon))),upper=toneColor(direction.map(v=>v*(at+epsilon)));
  for(let k=0;k<3;k++){
    const jump=upper[k]-lower[k];maxKneeJump=Math.max(maxKneeJump,Math.abs(jump));
    assert.ok(jump>=-1e-10&&jump<2e-6,'compression shoulder is continuous and never reverses brightness');
  }
}
const toeBelow=toneColor(Array(3).fill(toneToe-1e-7)),toeAbove=toneColor(Array(3).fill(toneToe+1e-7));
assert.ok(toeAbove.every((v,i)=>v>=toeBelow[i]&&v-toeBelow[i]<2e-6),'gray toe is continuous and monotonic');
assert.deepEqual(toneColor([0,0,0]),[0,0,0],'tone curve preserves true black');

const clarityBody=section('  float clarityLuma =','  col *= 1.0 - uVignette',desktopPostShader);
const clarityColor=runColorBody(clarityBody+'return col;','col');
assert.deepEqual(Array.from(daylightContext.MOOD_TREATMENTS[0].grdLift.toArray()),[0,0,0],
  'the actual daylight grade cannot lift black before the clarity arithmetic');
assert.deepEqual(clarityColor([0,0,0]),[0,0,0],'clarity preserves exact black without a divide-by-zero');
assert.deepEqual(clarityColor([1,1,1]),[1,1,1],'clarity preserves display white');
for(const direction of colorDirections){
  let previous=[0,0,0];
  for(let i=0;i<=1024;i++){
    const input=direction.map(v=>v*i/256),output=clarityColor(input);finiteColor(output,'clarity ramp');
    output.forEach((v,k)=>{
      assert.ok(v>=0&&v<=1+1e-12,'common gain respects per-channel highlight headroom before final clamp');
      assert.ok(v>=previous[k]-1e-12,'clarity gray/color ramps cannot reverse brightness');
      if(input[k]===0)assert.equal(v,0,'clarity never contaminates a zero color channel');
      for(let j=0;j<3;j++)assert.ok(Math.abs(v*input[j]-output[j]*input[k])<1e-12,
        'one shared RGB gain preserves hue instead of clipping channels independently');
    });
    previous=output;clarityCases++;
  }
}
// Saturation can briefly put channels outside gamut. The following final
// shader clamp owns negative-channel clipping; clarity must remain finite,
// preserve the common gain and cap the positive peak before that clamp.
for(const input of [[1.2,.5,.1],[.9,-.05,.04],[-.03,.2,1.1],[2,1,.01]]){
  const output=clarityColor(input);finiteColor(output,'post-saturation color');
  assert.ok(Math.max(...output)<=1+1e-12);
  for(let k=0;k<3;k++)for(let j=0;j<3;j++)assert.ok(Math.abs(output[k]*input[j]-output[j]*input[k])<1e-12);
  clarityCases++;
}
const aaSource=section('vec3 antialiasScene(', 'void main(){',desktopPostShader);
const aaClamp=aaSource.match(/dir\s*=\s*clamp\([^;]*vec2\((-[\d.]+)\),vec2\(([\d.]+)\)\)\*px;/);
assert.ok(aaClamp,'actual edge-directed AA bounds its sample direction');
const aaSpan=Math.max(Math.abs(Number(aaClamp[1])),Math.abs(Number(aaClamp[2])));
const aaTaps=[...aaSource.matchAll(/texture2D\(tScene,uv[+-]dir([/*])([\d.]+)\)/g)];
assert.equal(aaTaps.length,4,'all directional AA color taps are covered');
const maxAATap=Math.max(...aaTaps.map(m=>aaSpan*(m[1]==='/'?1/Number(m[2]):Number(m[2]))));
assert.ok(maxAATap<=2,'directional AA taps stay within two scene texels per axis');
console.log(`PASS: actual shader arithmetic across ${toneCases} monotonic HDR gray/color samples and ${clarityCases} headroom/hue samples; exact black/white, continuous toe/shoulder (max shoulder delta ${maxKneeJump.toExponential(2)}), and AA sample extent ${maxAATap} scene texels per axis. CPU arithmetic checks, not GPU precision claims.`);
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
console.log('PASS: shipped SSAO allocates no target/kernel; optional contact feature retains half-size/odd-size rotation, 0.66 mm packed-depth precision and silhouette rejection.');
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
  if(source.includes('  // BEGIN BLENDER GARDEN KIT')){
    runtime.mat=(color,options)=>new THREE.MeshStandardMaterial({color,...options});
    runtime.atob=s=>Buffer.from(s,'base64').toString('binary');
    return vm.runInContext('(function(){'+section('  // BEGIN BLENDER GARDEN KIT','  // END BLENDER GARDEN KIT',source)+';return berlinGardenKit.geometry("treeNear");})()',runtime);
  }
  const cache=new Map();
  return new Function('THREE','cached','mergeBoxes',section('  function sculptedCanopyGeometry() {','  function makeTree()',source)+';return sculptedCanopyGeometry();')(
    THREE,(key,fn)=>{if(!cache.has(key))cache.set(key,fn());return cache.get(key);},mergeBoxes);
}
const canopy=buildTree(html);checkGeometry(canopy,'canopy');
const count=canopy.index.count/3;
const geometryBytes=g=>Object.values(g.attributes).reduce((sum,a)=>sum+a.array.byteLength,0)+(g.index?g.index.array.byteLength:0);
const packedBytes=geometryBytes(canopy);
assert.ok(packedBytes<750000,'lush near canopy keeps its one shared GPU buffer below 750 KB');
assert.equal(canopy.attributes.normal.normalized,true,'signed normal data reaches the shader normalized');
assert.equal(canopy.attributes.color.normalized,true,'byte colours reach the shader normalized');
for(const index of canopy.index.array)assert.ok(index<canopy.attributes.position.count);
// The dense V118 crown replaces the shipped V114 24,160-triangle tree.
// Retain the original 750 KB memory ceiling and cap its geometry below 20k.
const canopyRecord=JSON.parse(html.match(/var BERLIN_KIEZ_GARDEN_DATA\s*=\s*(\{[^\r\n]*\});/)[1]);
assert.ok(count<=20000,'near street tree stays below the reduced 20k triangle budget');
assert.ok(canopyRecord.streetCanopyRadius<=3,'street canopy has a bounded cull envelope');
const p=canopy.attributes.position,n=canopy.attributes.normal;
for(let i=0;i<p.count;i++){
  assert.ok(Math.hypot(p.getX(i),p.getZ(i))<canopyRecord.streetCanopyRadius,'rotated foliage fits the measured cull/parking envelope');
  assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.002,'smooth leaf and branch normals remain normalized');
}
console.log(`PASS: aligned regular/arched windows across 72 facade layouts; pooled variant recycling; bevel normals/bounds; ${count} Blender tree triangles, ${packedBytes} geometry bytes, smooth normals and measured cull envelope.`);
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
// V116 knot: 78 rings x 9 sides plus two 45-triangle end caps (V115's loop was 1,304).
assert.equal(pickupSolid.attributes.position.count/3,1494,'knotted rope keeps its authored ring, side and cap counts');
assert.ok(pickupSolid.attributes.position.count/3<=1600,'knotted pretzel stays within its 1,600-triangle budget');
assert.ok(Math.max(...pickup.PRETZEL_RADIUS)>=0.145&&Math.min(...pickup.PRETZEL_RADIUS)<=0.08,'fat belly and thin arms: belly radius >= 0.145, arm ends <= 0.08');
assert.equal(pickup.PRETZEL_RADIUS.length,pickup.PRETZEL_PATH.length,'one authored radius per centreline point');
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
// The arms cross twice in the twist, one strand in front at each crossing.
const pickupCrossings=[];let pickupPrevX=null;
for(let i=0;i<=4000;i++){const p=pickupCurve.getPointAt(i/4000);
  if(p.y>-0.12&&p.y<0.22&&Math.abs(p.x)<0.2){if(pickupPrevX!==null&&Math.sign(p.x)!==Math.sign(pickupPrevX)&&p.x!==0)pickupCrossings.push(p.clone());pickupPrevX=p.x;}else pickupPrevX=null;}
assert.equal(pickupCrossings.length,4,'two strands each cross the twist axis twice');
pickupCrossings.sort((a,b)=>a.y-b.y);
for(const [a,b] of [[pickupCrossings[0],pickupCrossings[1]],[pickupCrossings[2],pickupCrossings[3]]]){
  assert.ok(Math.abs(a.y-b.y)<0.02&&a.z*b.z<0&&Math.abs(a.z-b.z)>=0.16,'at each crossing one strand passes in front of the other, clear of both radii');
}
const pickupSegments=Array.from({length:78},(_,i)=>new THREE.Line3(pickupCurve.getPointAt(i/78),pickupCurve.getPointAt((i+1)/78)));
const nearestPickupPoint=new THREE.Vector3();let maxPickupCurveError=0;
for(let i=0;i<=512;i++){
  const point=pickupCurve.getPointAt(i/512);let error=Infinity;
  for(const segment of pickupSegments){segment.closestPointToPoint(point,true,nearestPickupPoint);error=Math.min(error,point.distanceTo(nearestPickupPoint));}
  maxPickupCurveError=Math.max(maxPickupCurveError,error*0.58);
}
assert.ok(maxPickupCurveError<0.007,'reduced tube centerline stays within 7mm of its authored curve');
console.log(`PASS: opaque 1,494-triangle knotted pretzel (fat belly, two-crossing twist), three open loops, fixed two-draw pool and ${(maxPickupCurveError*1000).toFixed(2)}mm maximum centerline deviation.`);
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
    const beforeSource=fs.readFileSync(process.argv[beforeArg+1],'utf8');
    const original=buildTree(beforeSource);
    kit.beforeCanopy=pack(original);
    const oldMesh=new THREE.Mesh(original),newMesh=new THREE.Mesh(canopy);
    oldMesh.updateMatrixWorld();newMesh.updateMatrixWorld();
    const ray=new THREE.Raycaster(),center=new THREE.Vector3(0,4.1,0);
    let compared=0;
    // Exact surface equality only applies to optimization of the same asset;
    // replacing sphere crowns with individual leaves intentionally changes it.
    const sameAsset=beforeSource.includes('  // BEGIN BLENDER GARDEN KIT');
    for(let az=0;az<(sameAsset?24:0);az++)for(const el of [-0.45,0.1,0.65]){
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
    console.log(compared?`PASS: ${compared} rays across 72 viewpoints preserve the original foliage surface; geometry ${geometryBytes(original)} -> ${packedBytes} bytes.`:
      `Exported legacy/new foliage comparison: intentional asset replacement, ${geometryBytes(original)} -> ${packedBytes} bytes.`);
  }
  fs.writeFileSync(path.join(root,'audit/berlin-finish-inspection.json'),JSON.stringify(kit));
}
