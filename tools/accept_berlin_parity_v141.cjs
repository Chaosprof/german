'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v141');
const read=p=>JSON.parse(fs.readFileSync(path.join(stage,p),'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bench='benchmark-fixed-dpr';
const r=read(bench+'/comparison.json'),g=read('geometry-check.json'),n=read('native-check.json'),h=fs.readFileSync(path.join(stage,'candidate.html'));
assert.equal(g.passed,true);assert.equal(n.passed,true);assert.equal(g.candidateSha256,sha(h));
assert.equal(g.addedDraws,0);assert.equal(g.addedTextures,0);assert.equal(g.unchangedRenderCode,true);
assert.equal(r.runs.length,9);assert.equal(r.fixture,'split-rng-v4-chunk-fixed-step');assert.deepEqual(r.settings,{tier:0,viewport:[1600,900],buffer:[1600,900]});
for(const run of r.runs){assert.deepEqual(run.programs,[70,70]);assert.ok(run.simulationFrames>=1600);}
assert.deepEqual(h,fs.readFileSync(path.join(stage,bench,'candidate.html')));
assert.deepEqual(fs.readFileSync(path.join(stage,'baseline.html')),fs.readFileSync(path.join(stage,bench,'middle.html')));
assert.equal(sha(fs.readFileSync(path.join(stage,bench,'baseline.html'))),'f31808ed0be672f7997a52d59cd327e4a0d217f7d14aef6687f9c8161e89f3af');
const gate={fpsAtLeastOriginal:r.after.fps>=r.before.fps,p95WithinOriginalPointOneMs:r.after.p95<=r.before.p95+.1,fpsWithinPreviousOnePercent:r.after.fps>=r.middle.fps*.99,p95WithinPreviousPointOneMs:r.after.p95<=r.middle.p95+.1};
const assets=Object.fromEntries(fs.readdirSync(path.join(stage,'models')).filter(f=>!f.endsWith('.blend1')).map(f=>[f,sha(fs.readFileSync(path.join(stage,'models',f)))]));
const result={accepted:Object.values(gate).every(Boolean),candidateSha256:sha(h),gate,assets,before:r.before,previous:r.middle,after:r.after,percentChange:r.percentChange,percentFromPrevious:r.percentFromPrevious,
  caveats:['One Windows Chromium device; physical phones unmeasured.','Small differences within the declared margin are not speed improvements.','CPU and GPU tradeoffs remain explicit.','Draw/triangle counters are window-boundary snapshots, not frame averages.']};
fs.writeFileSync(path.join(stage,'performance-accepted.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));assert.equal(result.accepted,true,'predeclared frame-delivery gate');
