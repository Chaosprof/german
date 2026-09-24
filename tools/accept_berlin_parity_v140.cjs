'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v140');
const read=p=>JSON.parse(fs.readFileSync(path.join(stage,p),'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bench='benchmark-matte';
const r=read(bench+'/comparison.json'),m=read('material-check.json'),b=read('bounce-check.json'),h=fs.readFileSync(path.join(stage,'candidate.html'));
assert.equal(m.passed,true);assert.equal(b.passed,true);assert.equal(m.candidateSha256,sha(h));assert.equal(b.candidateSha256,sha(h));
assert.equal(m.addedDraws,0);assert.equal(m.addedTextures,0);assert.equal(b.addedLights,0);assert.equal(b.maximumNewOffsetError,0);
assert.equal(r.runs.length,9);assert.equal(r.fixture,'split-rng-v4-chunk-fixed-step');assert.deepEqual(r.settings,{tier:0,viewport:[1600,900],buffer:[1600,900]});
for(const run of r.runs){assert.deepEqual(run.programs,[70,70]);assert.ok(run.simulationFrames>=1600);}
assert.deepEqual(h,fs.readFileSync(path.join(stage,bench,'candidate.html')));
assert.deepEqual(fs.readFileSync(path.join(stage,'baseline.html')),fs.readFileSync(path.join(stage,bench,'middle.html')));
assert.equal(sha(fs.readFileSync(path.join(stage,bench,'baseline.html'))),'f31808ed0be672f7997a52d59cd327e4a0d217f7d14aef6687f9c8161e89f3af');
const gate={fpsAtLeastOriginal:r.after.fps>=r.before.fps,p95WithinOriginalPointOneMs:r.after.p95<=r.before.p95+.1,fpsWithinPreviousOnePercent:r.after.fps>=r.middle.fps*.99,p95WithinPreviousPointOneMs:r.after.p95<=r.middle.p95+.1};
const report={accepted:Object.values(gate).every(Boolean),gate,candidateSha256:sha(h),baselineSha256:sha(fs.readFileSync(path.join(stage,'baseline.html'))),before:r.before,previous:r.middle,after:r.after,percentChange:r.percentChange,percentFromPrevious:r.percentFromPrevious,
  caveats:['One Windows Chromium device; physical phones remain unmeasured.','Small differences inside the predeclared variance margin are not speed improvements.','CPU/GPU changes remain explicit; frame delivery is the acceptance gate.','Draw counters are window-boundary snapshots, not per-frame averages.']};
fs.writeFileSync(path.join(stage,'performance-accepted.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));assert.equal(report.accepted,true,'declared frame-delivery gate');
