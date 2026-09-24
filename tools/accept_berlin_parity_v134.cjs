'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v134');
const read=p=>JSON.parse(fs.readFileSync(path.join(stage,p),'utf8'));
const report=read('benchmark-matte/comparison.json');
assert.equal(report.runs.length,6);assert.equal(report.fixture,'split-rng-v4-chunk-fixed-step');
assert.deepEqual(report.settings,{tier:0,viewport:[1600,900],buffer:[1600,900]});
assert.ok(report.after.fps>report.before.fps&&report.after.gpuMs<report.before.gpuMs&&report.after.p95<=report.before.p95,'frame throughput, GPU and tail latency must preserve original performance');
assert.ok(report.runs.every(r=>r.programs[0]===70&&r.programs[1]===70));
assert.equal(read('runtime-pack-check.json').passed,true);assert.equal(read('geometry-check.json').passed,true);
const measured=fs.readFileSync(path.join(stage,'benchmark-matte/candidate.html'),'utf8');
const candidate=fs.readFileSync(path.join(stage,'candidate.html'),'utf8');
const pattern=/var BERLIN_REFERENCE_ARCHITECTURE = (\{[^\r\n]*\});/;
assert.equal(candidate.replace(pattern,'REFERENCE_MASTERS'),measured.replace(pattern,'REFERENCE_MASTERS'),'packaging is the only change after measurement');
assert.deepEqual(JSON.parse(candidate.match(pattern)[1]),require('./install_reference_architecture.cjs').packReferenceArchitecture(JSON.parse(measured.match(pattern)[1])),'the exact measured master buffers remain in the final package');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const assets=Object.fromEntries(['.json','.inline.js','.blend','.glb','-atlas.jpg'].map(suffix=>[suffix,sha(fs.readFileSync(path.join(stage,'models/berlin-kiez-garden-v1'+suffix)))]));
const accepted={accepted:true,candidateSha256:sha(candidate),measuredSha256:sha(measured),assets,
  basis:'Six measured runs; final package only removes unused authoring variants, with twelve byte-identical runtime layouts independently verified.',
  report:'benchmark-matte/comparison.json',before:report.before,after:report.after,
  cpuTradeoffMs:report.after.cpuMs-report.before.cpuMs,
  scope:'Preserved frame rate/tail latency and lower GPU time on the measured Windows browser. CPU +0.40 ms is retained explicitly; physical mobile performance remains unmeasured.'};
fs.writeFileSync(path.join(stage,'performance-accepted.json'),JSON.stringify(accepted,null,2));
console.log('Accepted measured rendering plus byte-identical compact architecture; CPU tradeoff '+accepted.cpuTradeoffMs.toFixed(3)+' ms.');
