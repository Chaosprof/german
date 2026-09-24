'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v135');
const report=JSON.parse(fs.readFileSync(path.join(stage,'benchmark/comparison.json'),'utf8'));
assert.equal(report.runs.length,6);assert.equal(report.fixture,'split-rng-v4-chunk-fixed-step');
assert.deepEqual(report.settings,{tier:0,viewport:[1600,900],buffer:[1600,900]});
assert.ok(report.runs.every(r=>r.programs[0]===70&&r.programs[1]===70));
const geometry=JSON.parse(fs.readFileSync(path.join(stage,'geometry-check.json'),'utf8'));
assert.ok(geometry.passed&&geometry.layouts===36&&geometry.unchangedRenderCode&&geometry.unchangedGeometryBuffers);
const candidate=fs.readFileSync(path.join(stage,'candidate.html'));
assert.deepEqual(candidate,fs.readFileSync(path.join(stage,'benchmark/candidate.html')));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['.json','.inline.js','.blend','.glb','-atlas.png'].map(s=>'berlin-reference-architecture-v1'+s).concat('berlin-reference-architecture-runtime.inline.js');
const assets=Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(path.join(stage,'models',file)))]));
// The frame-rate and tail-latency gate covers the user's runtime constraint.
// Do not label the +0.05 ms GPU / +0.23 ms CPU means as improvements: the
// complete-build comparison includes earlier geometry changes and noise.
// The independent V134-to-V135 proof above establishes this bake's identical
// geometry footprint, shader source and render scheduling.
assert.ok(report.after.fps>=report.before.fps&&report.after.p95<=report.before.p95,'preserve observed frame throughput and tail latency against the original goal baseline');
const accepted={accepted:true,candidateSha256:sha(candidate),assets,before:report.before,after:report.after,
  basis:'Six interleaved full-quality runs against V126. In addition, all render code and every geometry buffer except existing RGB values are exact V134 equivalents across 36 layouts.',
  gpuDeltaMs:report.after.gpuMs-report.before.gpuMs,cpuDeltaMs:report.after.cpuMs-report.before.cpuMs,
  limitations:report.limitations,report:'benchmark/comparison.json'};
fs.writeFileSync(path.join(stage,'performance-accepted.json'),JSON.stringify(accepted,null,2));
console.log('Accepted the measured V135 bake with unchanged geometry and rendering code.');
