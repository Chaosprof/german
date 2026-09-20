'use strict';
// Exercise the shipped input, simulation, gate and obstacle code at fixed steps.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'berlin-runner.html'), 'utf8');
function section(a, b) {
  const start = html.indexOf(a), end = html.indexOf(b, start + a.length);
  assert.ok(start >= 0 && end > start, a); return html.slice(start, end);
}
for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(match[1]);
const three = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x => x[1])
  .find(s => s.includes('three.js r156 (MIT)'));
const lib = vm.createContext({console}); vm.runInContext(three, lib);
const T = lib.THREE;
const noop = () => {};
function fresh(lane = 1, scale = 1) {
  const c = vm.createContext({console, Math, THREE:T, LANES:[3,0,-3],
    clamp:T.MathUtils.clamp, lerp:T.MathUtils.lerp, damp:(k,t)=>1-Math.exp(-k*t),
    bufLeft:0, bufRight:0, bufJump:0, bufSlide:0, BUFFER:.16,
    springTimer:0, airJumps:0, magnetTimer:0, shieldCharges:0,
    quizStreak:0, heroFootCacheReady:false, charModel:null,
    gameAudio:null, obstacles:[], gates:[], PLAY_RENDER_FAR:210,
    gateChevronTex:{offset:{y:0}}, hits:0, answers:[],
    body:new T.Group(), camera:{aspect:16/9}, baseCameraFov:()=>55,
    playLaneSound:noop, playJumpSound:noop, playSlideSound:noop, playLandSound:noop,
    playStepSound:noop, playPowerupSound:noop, primeSpeech:noop, fxTakeoff:noop, fxLand:noop,
    fxFootstep:noop, fxSlideSpray:noop, fxPopup:noop, fxScreenPulse:noop,
    clearStumbleUI:noop, updatePowerupHUD:noop, ensureGatesAhead:noop,
    collectPretzels:noop, collectPowerups:noop, recycle:noop,
    updateChunks:noop, updateWorldPlayFrames:noop});
  c.stumble = () => { c.hits++; c.stumbleTimer = .85; };
  c.answerArticle = article => c.answers.push(article);
  vm.runInContext(section('  var player = { x:', '  var initialCameraWide ='), c);
  vm.runInContext(section('  function phaseEase(', '  function advanceHeroActionClock('), c);
  vm.runInContext(section('  function pressAction(', '  (function wireMusicButton()'), c);
  vm.runInContext(section('  // Outer-lane shortcuts', '  function collectPretzels()'), c);
  c.targetLane = c.lane = lane; c.player.x = c.LANES[lane];
  c.BASE_SPEED = 26*scale; c.MAX_SPEED = 54*scale; c.speedScale=scale; c.speed=c.BASE_SPEED;
  c.prevZ=0;
  return c;
}
const dt = 1/60;
const tick = (c, n=1) => {for(let i=0;i<n;i++) c.simulate(dt);};
let cases = 0;
for (const scale of [1,.5]) for (const [from,input,to] of [[2,'right',0],[0,'left',2]]) {
  const c = fresh(from,scale);
  // Input on the exact fixed step that crosses a gate must never answer die.
  c.gates.push({visible:true,userData:{active:true,resolved:false,z:c.speed*dt*.5,
    portals:['der','die','das'].map(article=>({userData:{article}}))}});
  c.pressAction(input); tick(c);
  assert.equal(c.targetLane,to); assert.equal(c.laneWrapCount,1);
  assert.deepEqual(c.answers,[to===0?'der':'das']);
  assert.ok(!c.grounded && c.player.y>0,'grounded wrap takes off');
  const samples=[];
  for(let i=0;i<50;i++) {
    tick(c); samples.push({x:c.player.x,y:c.player.y,p:c.laneFlipProgress});
    assert.ok([c.player.x,c.player.y,c.player.vy,c.laneGlideVelocity].every(Number.isFinite));
    assert.ok(Math.abs(c.player.x)<=3.001 && c.player.y>=0);
  }
  assert.ok(Math.abs(samples[14].x-c.LANES[to])<.06,'opposite lane reached within 267ms');
  assert.ok(c.grounded && c.player.y===0 && c.laneFlipProgress===1,'upright landing');
  assert.ok(Math.max(...samples.map(s=>s.y))>1 && Math.max(...samples.map(s=>s.y))<1.3,'compact hop');
  assert.equal(c.laneWrapCount,1,'one input is consumed only once');
  cases++;
}
for(const [from,input,to] of [[1,'left',0],[1,'right',2],[0,'right',1],[2,'left',1]]) {
  const c=fresh(from); c.pressAction(input); tick(c,30);
  assert.equal(c.targetLane,to); assert.equal(c.laneWrapCount,0);
  assert.ok(c.grounded && c.laneFlipProgress===1,'ordinary cuts do not jump'); cases++;
}
for(const input of ['left','right']) {
  const c=fresh(input==='left'?0:2);
  c.grounded=false; c.player.y=1.2; c.player.vy=4;
  c.pressAction(input); tick(c);
  assert.ok(Math.abs(c.player.vy-(4-46*dt))<1e-8,'air wrap preserves ballistic velocity');
  assert.equal(c.laneFlipProgress,1,'no new midair flip or jump recharge');
  const d=fresh(input==='left'?0:2);
  d.slideTimer=.5; d.slideActionAge=.12; d.pressAction(input); tick(d);
  assert.ok(d.grounded && d.slideTimer>0 && d.playerHeight()===d.SLIDE_H,'roll wrap retains low collider');
  assert.equal(d.laneFlipProgress,1); cases+=2;
}
for(const delay of [1,4,8,12,18]) {
  const c=fresh(2); c.pressAction('right'); tick(c,delay); c.pressAction('slide');
  let previous=c.laneFlipProgress;
  for(let i=0;i<35;i++) {tick(c); assert.ok(c.laneFlipProgress>=previous); previous=c.laneFlipProgress;}
  assert.equal(c.laneFlipProgress,1); assert.ok(c.grounded,'down input completes flip and lands'); cases++;
}
for(const delay of [1,3,6,12]) {
  const c=fresh(2); c.pressAction('right'); tick(c,delay);
  const before=c.laneFlipProgress; c.pressAction('left'); tick(c);
  assert.equal(c.targetLane,2); assert.ok(c.laneFlipProgress>=before,'rapid wrap cannot rewind rotation');
  c.pressAction('left'); tick(c,35);
  assert.equal(c.targetLane,1); assert.ok(Math.abs(c.player.x)<.05,'steering remains available'); cases++;
}
// Run the real touch handlers: one swipe fires at threshold, never again at
// touchend; a fast flick with no move sample also wraps in either direction.
for(const dir of [-1,1]) for(const flick of [false,true]) {
  const c=fresh(dir<0?0:2), listeners={};
  c.canvas={addEventListener:(name,fn)=>listeners[name]=fn};
  c.performance={now:()=>100}; c.photoMode=false; c.started=true;
  vm.runInContext(section('  var touchX = 0,', '  // ========================================================== game state'),c);
  const event=(x,y=200)=>({changedTouches:[{identifier:7,clientX:x,clientY:y}]});
  listeners.touchstart(event(190));
  if(!flick) {listeners.touchmove(event(190+dir*40)); tick(c); listeners.touchmove(event(190+dir*70));}
  listeners.touchend(event(190+dir*90)); tick(c,40);
  assert.equal(c.targetLane,dir<0?2:0); assert.equal(c.laneWrapCount,1);
  assert.equal(c.bufJump,0,'swipe never also becomes a tap jump'); cases++;
}
// A tall obstacle at the actual crossing position still collides during a wrap.
const blocked=fresh(2); blocked.pressAction('right'); tick(blocked,4);
blocked.obstacles.push({active:true,hit:false,lane:blocked.laneOf(blocked.player.x),z:blocked.player.z+.3,
  spec:{halfD:2,halfW:3,yMin:0,yMax:5}});
tick(blocked); assert.equal(blocked.hits,1,'wrap grants no hidden immunity'); cases++;
// The wrapped input is repeat-safe even at 120 Hz presentation (fixed 60Hz physics).
const spam=fresh(1);
for(let i=0;i<600;i++) { if(i%4===0) spam.pressAction(i%12?'right':'left'); tick(spam);
  assert.ok(spam.targetLane>=0 && spam.targetLane<=2 && Math.abs(spam.player.x)<=3.001);
  assert.ok(spam.player.y<2,'rapid input does not accumulate altitude'); }
spam.resetLaneWrap(); assert.equal(spam.laneWrapCount,0); assert.equal(spam.laneFlipProgress,1);
// Pelvis pivot is stationary under the flip and both endpoints match upright.
for(const dir of [-1,1]) for(let i=0;i<=120;i++) {
  const c=spam; c.visualLaneFlip=i/120; c.laneFlipDir=dir;
  c.body.position.set(0,0,0); c.body.rotation.set(0,0,0); c.applyLaneWrapPose();
  c.body.updateMatrix();
  const pelvis=new T.Vector3(0,.94,0).applyMatrix4(c.body.matrix);
  assert.ok(pelvis.distanceTo(new T.Vector3(0,.94,0))<1e-6);
  assert.ok(c.body.matrix.elements.every(Number.isFinite));
}
console.log(`PASS: ${cases} bidirectional/tempo/late-gate/jump/roll/fast-fall/redirect/collision cases; 600 rapid-input steps; 242 pivot samples; all inline scripts parse.`);
