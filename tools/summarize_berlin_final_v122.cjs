'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'audit/berlin-parity-final-v122/benchmark'),mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const report={method:'Three interleaved 65-second runs per build; first 5-second profile window omitted; tier 0; separate Three.js UUID and gameplay RNG streams.',builds:{}};
for(const name of ['before','middle','after']){
  const runs=[0,1,2].map(i=>JSON.parse(fs.readFileSync(path.join(dir,'perf-'+name+'-'+i+'.json'))));
  assert.ok(runs.every(r=>r.state==='complete'&&r.elapsed>=65&&r.fixture==='split-rng-v2'&&r.programsAtStart===r.programsAtEnd));
  const windows=runs.flatMap(r=>r.profile.windows.slice(1));
  assert.ok(windows.length>=30&&windows.every(w=>Number.isFinite(w.gpuMs)&&w.gpuSamples>0&&w.tier===0&&w.buffer[0]===1600&&w.buffer[1]===900));
  const counts=JSON.parse(fs.readFileSync(path.join(dir,'counts-'+name+'.json')));assert.equal(counts.rows.length,10);
  assert.equal(counts.programsAtStart,counts.programsAtEnd);
  report.builds[name]={revision:runs[0].revision,gpuMs:mean(windows.map(w=>w.gpuMs)),fps:mean(windows.map(w=>w.fps)),
    perRunGpuMs:runs.map(r=>mean(r.profile.windows.slice(1).map(w=>w.gpuMs))),capturedAt:runs.map(r=>r.profile.capturedAt),
    programs:runs.map(r=>[r.programsAtStart,r.programsAtEnd]),triangles:mean(counts.rows.map(r=>r.beautyTris+r.shadowTris/6)),draws:mean(counts.rows.map(r=>r.beautyCalls+r.shadowCalls/6))};
}
const {before,middle,after}=report.builds;
report.deltaGpuMs=after.gpuMs-before.gpuMs;report.deltaFps=after.fps-before.fps;report.deltaTrianglesPercent=100*(after.triangles/before.triangles-1);report.deltaDraws=after.draws-before.draws;
report.finishDeltaGpuMs=after.gpuMs-middle.gpuMs;
report.gates={cumulativeGpu:report.deltaGpuMs<=.5,finishGpu:report.finishDeltaGpuMs<=.5,fps:report.deltaFps>=-3,
  triangles:after.triangles<=1160000&&report.deltaTrianglesPercent<=10,draws:after.draws<=214&&report.deltaDraws<=4,
  shaderPrograms:Math.max(...after.programs.flat())<=Math.max(...before.programs.flat())+2};
const candidate=fs.readFileSync(path.join(dir,'candidate.html'));assert.deepEqual(candidate,fs.readFileSync(path.join(root,'berlin-runner.html')),'benchmark is the installed build');
report.htmlSha256=crypto.createHash('sha256').update(candidate).digest('hex');
if(['before','after'].every(k=>fs.existsSync(path.join(dir,'unpinned-'+k+'-0.json')))){
  report.adaptive={};
  for(const k of ['before','after']){
    const r=JSON.parse(fs.readFileSync(path.join(dir,'unpinned-'+k+'-0.json'))),w=r.profile.windows.slice(1),late=w.slice(-6);
    assert.ok(r.state==='complete'&&r.elapsed>=90&&r.programsAtStart===r.programsAtEnd);
    report.adaptive[k]={capturedAt:r.profile.capturedAt,fps:mean(w.map(v=>v.fps)),last30SecondsFps:mean(late.map(v=>v.fps)),
      tiers:w.map(v=>v.tier),finalBuffer:w.at(-1).buffer,programs:[r.programsAtStart,r.programsAtEnd]};
  }
}
fs.writeFileSync(path.join(dir,'performance-summary.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
