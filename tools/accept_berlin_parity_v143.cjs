'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v143');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>JSON.parse(fs.readFileSync(path.join(stage,p)));
const c=read('source-check.json'),r=read('benchmark/comparison.json'),page=fs.readFileSync(path.join(stage,'candidate.html'));
assert.equal(c.passed,true);assert.equal(c.candidateSha256,sha(page));
assert.equal(c.unchangedGeometry,true);assert.equal(c.unchangedShaderFeatures,true);
assert.deepEqual(page,fs.readFileSync(path.join(stage,'benchmark/candidate.html')));
assert.deepEqual(fs.readFileSync(path.join(stage,'baseline.html')),fs.readFileSync(path.join(stage,'benchmark/middle.html')));
assert.equal(sha(fs.readFileSync(path.join(stage,'benchmark/baseline.html'))),'f31808ed0be672f7997a52d59cd327e4a0d217f7d14aef6687f9c8161e89f3af');
assert.equal(r.fixture,'split-rng-v4-chunk-fixed-step');assert.equal(r.runs.length,9);
assert.deepEqual(r.settings,{tier:0,viewport:[1600,900],buffer:[1600,900]});
for(const run of r.runs){assert.deepEqual(run.programs,[70,70]);assert.ok(run.simulationFrames>=1600);}
const gate={fpsAtLeastOriginal:r.after.fps>=r.before.fps,p95WithinOriginalPointOneMs:r.after.p95<=r.before.p95+.1,
  fpsWithinPreviousOnePercent:r.after.fps>=r.middle.fps*.99,p95WithinPreviousPointOneMs:r.after.p95<=r.middle.p95+.1};
const result={accepted:Object.values(gate).every(Boolean),candidateSha256:sha(page),gate,before:r.before,previous:r.middle,after:r.after,
  percentChange:r.percentChange,percentFromPrevious:r.percentFromPrevious,
  caveats:['One Windows Chromium device; physical phones unmeasured.','Small differences are not speed improvements.','CPU and GPU tradeoffs remain explicit.','Draw/triangle snapshots are not frame averages.']};
fs.writeFileSync(path.join(stage,'performance-accepted.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
assert.equal(result.accepted,true,'predeclared frame-delivery gate');
