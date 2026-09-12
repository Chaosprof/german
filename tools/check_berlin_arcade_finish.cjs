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
  assert.equal((kernel.match(/texture2DCompare\(/g)||[]).length,4,'four shadow-map reads');
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
  assert.deepEqual(rewards,[[1,offset+8,9,false]],'nine real rewards start in the free centre lane');
  assert.equal(trams.length,hasSlot?1:0,'full obstacle pools never steal a live hazard');
  for(const [kind,lane,z] of trams){assert.equal(kind,3);assert.equal(lane,0);assert.ok(z>offset+30&&z+4+.45<gateZ-17,'entire tram clears the quiz reaction space');}
}
console.log(`PASS: four-sample shadow branch/fallback; ${shapes} bounded rounded props, ${oldTriangles}→${newTriangles} triangles; both opening speeds, reset offsets, free centre and pool exhaustion.`);
