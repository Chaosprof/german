'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const dir=path.resolve(process.argv[2]),mean=a=>a.reduce((s,v)=>s+v,0)/a.length,output={};
for(const build of ['before','after']){
  const runs=[0,1,2].map(i=>JSON.parse(fs.readFileSync(path.join(dir,'perf-'+build+'-'+i+'.json'))));
  assert.ok(runs.every(r=>r.state==='complete'&&r.elapsed>=60&&r.programsAtStart===r.programsAtEnd));
  const windows=runs.flatMap(r=>r.profile.windows.slice(1));
  assert.ok(windows.length>=30&&windows.every(w=>Number.isFinite(w.gpuMs)&&w.gpuSamples>0));
  const rows=JSON.parse(fs.readFileSync(path.join(dir,'counts-'+build+'.json'))).rows;
  output[build]={gpuMs:mean(windows.map(w=>w.gpuMs)),fps:mean(windows.map(w=>w.fps)),
    capturedAt:runs.map(r=>r.profile.capturedAt),programs:runs.map(r=>[r.programsAtStart,r.programsAtEnd]),
    calls:mean(rows.map(r=>r.beautyCalls+r.shadowCalls/6)),tris:mean(rows.map(r=>r.beautyTris+r.shadowTris/6))};
}
output.deltaGpuMs=output.after.gpuMs-output.before.gpuMs;
output.deltaTrisPercent=100*(output.after.tris/output.before.tris-1);
output.gates={gpu:output.deltaGpuMs<=.5,fps:output.after.fps>=output.before.fps-3,triangles:output.deltaTrisPercent<=5&&output.after.tris<=1160000,draws:output.after.calls<=output.before.calls+2&&output.after.calls<=214};
fs.writeFileSync(path.join(dir,'performance-summary.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify(output,null,2));
