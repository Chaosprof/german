'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v138');
const read=p=>JSON.parse(fs.readFileSync(path.join(stage,p),'utf8'));
const r=read('benchmark/comparison.json'),g=read('geometry-check.json'),n=read('native-check.json'),p=read('runtime-pack-check.json');
assert.equal(g.passed,true);assert.equal(n.passed,true);assert.equal(p.passed,true);
assert.equal(g.layouts,36);assert.equal(p.layouts,12);assert.equal(g.addedDraws,0);assert.equal(g.addedTextures,0);
assert.equal(r.runs.length,6);assert.equal(r.fixture,'split-rng-v4-chunk-fixed-step');
assert.deepEqual(r.settings,{tier:0,viewport:[1600,900],buffer:[1600,900]});
for(const run of r.runs){assert.deepEqual(run.programs,[70,70]);assert.ok(run.simulationFrames>=1600);}
// Frame delivery is the acceptance measure. 0.10ms is below timer/window
// quantization at the observed 33ms p95; CPU/GPU changes remain explicit.
const gate={fpsAtLeastBaseline:r.after.fps>=r.before.fps,p95WithinPointOneMs:r.after.p95<=r.before.p95+.10};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const h=fs.readFileSync(path.join(stage,'candidate.html'));
assert.deepEqual(h,fs.readFileSync(path.join(stage,'benchmark/candidate.html')),'reviewed page is measured page');
const assets={},sources={};
for(const file of fs.readdirSync(path.join(stage,'models')))assets[file]=sha(fs.readFileSync(path.join(stage,'models',file)));
for(const file of ['berlin_kiez_kit.js','berlin_facade_finish_v119.js'])sources[file]=sha(fs.readFileSync(path.join(stage,'sources',file)));
const report={accepted:Object.values(gate).every(Boolean),gate,candidateSha256:sha(h),assets,sources,before:r.before,after:r.after,percentChange:r.percentChange,
  caveats:['One Windows Chromium device; physical phones remain unmeasured.','Frame rate must meet baseline; window-mean p95 allows 0.10ms timing tolerance.','CPU/GPU changes are reported independently, not hidden by the frame-delivery gate.','Counters are window-boundary snapshots, not average draw or triangle savings.']};
fs.writeFileSync(path.join(stage,'performance-accepted.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));assert.equal(report.accepted,true,'frame-delivery gate must pass before installation');
