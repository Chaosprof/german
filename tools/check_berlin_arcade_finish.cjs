'use strict';
// Execute the shipped shader patch and opening sequence, including fallback
// paths. No browser or hardware-performance claim is made by this fixture.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','berlin-runner.html'),'utf8').replace(/\r\n/g,'\n');
function section(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j);}
const runtime=vm.createContext({console});
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('three.js r156 (MIT)')),runtime);
const THREE=runtime.THREE;
const originalChunk=THREE.ShaderChunk.shadowmap_pars_fragment;
const filterCode=section('  function installCrispShadowFilter() {','  installCrispShadowFilter();');
for(const query of ['', '?profile=1', '?softshadows=1', '?profile=1&softshadows=1']) {
  const shaderChunks={shadowmap_pars_fragment:originalChunk};
  const c=vm.createContext({THREE:{ShaderChunk:shaderChunks},window:{location:{search:query}}});
  vm.runInContext(filterCode+'installCrispShadowFilter();',c);
  const patched=shaderChunks.shadowmap_pars_fragment;
  if(query==='?profile=1&softshadows=1'){assert.equal(patched,originalChunk);continue;}
  const marker='#elif defined( SHADOWMAP_TYPE_PCF_SOFT )';
  const begin=patched.indexOf(marker),end=patched.indexOf('#elif',begin+8);
  const kernel=patched.slice(begin,end);
  assert.equal((kernel.match(/texture2DCompare\(/g)||[]).length,12,'bounded twelve-read soft area-shadow kernel');
  assert.match(kernel,/texelSize \* clamp\(shadowRadius, 1\.0, 4\.0\)/,'penumbra uses the existing light radius in shadow texels');
  const weights=kernel.match(/shadow = ([\d.]+) \* mix[\s\S]*?\+ ([\d.]+) \* ring/);
  assert.ok(weights,'normalized bilinear centre and eight-sample ring');
  assert.equal(Number(weights[1])+8*Number(weights[2]),1,'fully lit and fully shadowed values remain exact');
  const oldBegin=originalChunk.indexOf(marker),oldEnd=originalChunk.indexOf('#elif',oldBegin+8);
  assert.equal(patched.slice(0,begin),originalChunk.slice(0,oldBegin),'frustum rejection/bias and other shadow filters are untouched');
  assert.equal(patched.slice(end),originalChunk.slice(oldEnd),'VSM, point shadows and fallback remain intact');
}
const future={shadowmap_pars_fragment:'a future shader without our versioned branch'};
vm.runInNewContext(filterCode+'installCrispShadowFilter();',{THREE:{ShaderChunk:future},window:{location:{search:''}}});
assert.equal(future.shadowmap_pars_fragment,'a future shader without our versioned branch');

// Rounded props retain their requested envelopes and smooth normals while
// reducing the number of triangles copied into the pooled city geometry.
const clamp=THREE.MathUtils.clamp;
const c=vm.createContext({THREE,clamp});
vm.runInContext(section('  var geoCache = Object.create(null);','  function icoGeo(r)'),c);
let shapes=0,oldTriangles=0,newTriangles=0;
const old=vm.createContext({THREE,clamp});
vm.runInContext(section('  var geoCache = Object.create(null);','  function icoGeo(r)')
  .replace('clamp(Math.ceil(Math.sqrt(radius * 120)), 3, 16)','clamp(Math.round(4 + radius * 18), 5, 16)')
  .replace('bevel < 0.065 ? 1 : bevel < 0.18 ? 2 : 3','bevel >= 0.10 ? 3 : 2'),old);
for(const [w,h,d,r,b] of [[.3,.12,.48,.05,.02],[2.1,.93,4.3,.12,.035],[1.27,2.15,.46,.1,.04],
  [5.6,.34,.44,.11,.035],[8,.22,11,1.2,.06],[1.3,2.6,.8,.18,.08],[5,5,2,1.2,.2]]) {
  const geo=c.roundedBoxGeo(w,h,d,r,b),previous=old.roundedBoxGeo(w,h,d,r,b);
  assert.equal(c.roundedBoxGeo(w,h,d,r,b),geo,'recycled art reuses one buffer');
  const pos=geo.attributes.position,n=geo.attributes.normal;
  for(let i=0;i<pos.count;i++) {
    assert.ok(Math.abs(pos.getX(i))<=w/2+1e-6&&Math.abs(pos.getY(i))<=h/2+1e-6&&Math.abs(pos.getZ(i))<=d/2+1e-6,'exact authored envelope');
    assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5,'finite unit normals');
  }
  oldTriangles+=previous.attributes.position.count/3;newTriangles+=pos.count/3;shapes++;
}
assert.ok(newTriangles<oldTriangles*.73,'representative trim retains substantially less geometry');

const opening=section('    // A composed opening:', '\n  function showHeroLoadError()').replace(/\n  }\s*$/,'');
for(const speed of [13,26])for(const offset of [0,500])for(const hasSlot of [true,false]) {
  const gateZ=offset+Math.max(58,speed*2.85),trams=[],rewards=[];
  const state={player:{z:offset},gates:[{position:{z:gateZ},userData:{active:true}}],
    GATE_CLEAR_BEFORE:17,OB_KINDS:[{},{},{},{halfD:4}],HALF_D:.45,
    spawnPretzelRun:(...args)=>rewards.push(args),freeObstacleSlots:()=>hasSlot?1:0,
    spawnObstacle:(...args)=>trams.push(args),
    obstacleFitsQuizApproach:(kind,z,gate)=>z+4+.45<=gate-17};
  vm.runInNewContext(opening,state);
  // V125: the opening line runs beside the courier in the clear left lane.
  assert.deepEqual(rewards,[[0,offset+12,4,false,6]],'four spaced real rewards start in the clear left lane');
  assert.equal(trams.length,hasSlot?1:0,'full obstacle pools never steal a live hazard');
  for(const [kind,lane,z] of trams){
    assert.equal(kind,3);assert.equal(lane,2,'tram occupies the screen-right lane');
    assert.ok((z-offset-state.OB_KINDS[3].halfD-state.HALF_D)/speed>=.85,
      'opening retains at least850ms before the nearest tram collision face at fast speed');
    assert.ok(z+state.OB_KINDS[3].halfD+state.HALF_D<gateZ-state.GATE_CLEAR_BEFORE,
      'entire tram clears the quiz reaction space');
  }
}
// Execute the actual pooled spawn path. A different visual spacing must not
// steal active pickups, allocate new holders or change ordinary formations.
const pickupSource=section('  function spawnPretzelRun(', '\n  // A diagonal reward trail');
const pickupPool=Array.from({length:6},(_,i)=>({active:i<2,sprite:new THREE.Group(),z:900+i,y:1.15,lane:2,x:-3}));
const originalHolders=pickupPool.map(p=>p.sprite);
const pickupState=vm.createContext({pretzels:pickupPool,LANES:[3,0,-3]});
vm.runInContext(pickupSource,pickupState);
pickupState.spawnPretzelRun(1,8,4,false,8);
assert.deepEqual(pickupPool.slice(0,2).map(p=>p.z),[900,901],'opening never overwrites active pooled pickups');
assert.deepEqual(pickupPool.slice(2).map(p=>p.z),[8,16,24,32]);
assert.ok(pickupPool.slice(2).every(p=>p.active&&p.lane===1&&p.y===1.15&&p.sprite.visible));
assert.ok(pickupPool.every((p,i)=>p.sprite===originalHolders[i]),'opening uses the existing holders');
pickupState.spawnPretzelRun(1,40,4,false,8);
assert.deepEqual(pickupPool.slice(2).map(p=>p.z),[8,16,24,32],'exhausted pool leaves the current run intact');
pickupPool.forEach(p=>{p.active=false;});
pickupState.spawnPretzelRun(0,60,5,false);
const ordinarySpacing=pickupPool[1].z-pickupPool[0].z;
assert.ok([2.18,2.40,2.58].some(spacing=>Math.abs(ordinarySpacing-spacing)<1e-8),'ordinary formations keep their original spacing');
const attract=section('      // Hold a composed title-screen stance', '\n    var renderAlpha =').replace(/\n    }\s*$/,'');
const title={player:{z:0},prevZ:0,interpPrevRunPhase:0,runPhase:0,raw:1/30,updateChunks:z=>assert.equal(z,0)};
for(let frame=0;frame<300;frame++)vm.runInNewContext(attract,title);
assert.equal(title.player.z,0,'ten seconds on the title card preserve the fresh-page reference block');
assert.ok(Math.abs(title.runPhase-6.5)<1e-10,'authored idle animation continues while forward travel is held');
console.log(`PASS: twelve-sample soft-shadow branch/fallback; ${shapes} bounded rounded props, ${oldTriangles}→${newTriangles} triangles; both opening speeds, reset offsets, free centre and pool exhaustion.`);
