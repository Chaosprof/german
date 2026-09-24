'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v139');
const read=p=>JSON.parse(fs.readFileSync(path.join(stage,p),'utf8'));
const r=read('benchmark/comparison.json'),g=read('independent-check.json');
assert.equal(g.passed,true);assert.equal(g.extraDraws,0);assert.equal(g.extraMaterials,0);assert.equal(g.triangleDelta,-804);
assert.equal(r.runs.length,9);assert.equal(r.fixture,'split-rng-v4-chunk-fixed-step');
assert.deepEqual(r.settings,{tier:0,viewport:[1600,900],buffer:[1600,900]});
for(const run of r.runs){assert.deepEqual(run.programs,[70,70]);assert.ok(run.simulationFrames>=1600);}
const gate={fpsAtLeastOriginal:r.after.fps>=r.before.fps,p95WithinOriginalPointOneMs:r.after.p95<=r.before.p95+.10,
  fpsWithinPreviousOnePercent:r.after.fps>=r.middle.fps*.99,p95WithinPreviousPointOneMs:r.after.p95<=r.middle.p95+.10};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),h=fs.readFileSync(path.join(stage,'candidate.html'));
assert.deepEqual(h,fs.readFileSync(path.join(stage,'benchmark/candidate.html')));
assert.deepEqual(fs.readFileSync(path.join(stage,'baseline.html')),fs.readFileSync(path.join(stage,'benchmark/middle.html')));
assert.equal(sha(fs.readFileSync(path.join(stage,'benchmark/baseline.html'))),'f31808ed0be672f7997a52d59cd327e4a0d217f7d14aef6687f9c8161e89f3af');
const assets={};for(const file of fs.readdirSync(path.join(stage,'models')))assets[file]=sha(fs.readFileSync(path.join(stage,'models',file)));
const report={accepted:Object.values(gate).every(Boolean),gate,candidateSha256:sha(h),assets,before:r.before,previous:r.middle,after:r.after,percentChange:r.percentChange,percentFromPrevious:r.percentFromPrevious,
  caveats:['One Windows Chromium device; physical phones remain unmeasured.','Previous-build FPS tolerance is 1%; p95 tolerance is 0.10ms, declared before measurement.','CPU/GPU changes remain explicit; small differences are not evidence of speed improvements.','Draw counters are window-boundary snapshots, not average geometry savings.']};
fs.writeFileSync(path.join(stage,'performance-accepted.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
assert.equal(report.accepted,true,'declared frame-delivery gate must pass before installation');
