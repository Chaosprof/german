'use strict';
const fs=require('fs'),path=require('path');
const stage=path.resolve(__dirname,'..',process.env.REVIEW_PHASE||'audit/berlin-parity-v128/benchmark');
const series=process.env.REVIEW_SERIES||'quiet128';
const builds=(process.env.REVIEW_BUILDS||'before,after').split(',');
const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;
const weighted=(windows,get,weight=w=>w.frames)=>windows.reduce((s,w)=>s+get(w)*weight(w),0)/windows.reduce((s,w)=>s+weight(w),0);
const report={fixture:'split-rng-v3-fixed-step',warmup:'First five-second sample excluded; frame-weighted CPU means; GPU weighted by samples. Draw counters are window-boundary snapshots.',runs:[]};
report.counterMeaning='Calls and triangles are snapshots at each profile-window boundary, not per-frame means. Their weighted summaries can vary with shadow cadence and must not be used to claim average geometry savings.';
for(const build of builds)for(let i=0;i<3;i++){
  const name=`${series}-${build}-${i}.json`,file=path.join(stage,name);
  if(!fs.existsSync(file))throw new Error('Incomplete: '+name);
  const d=JSON.parse(fs.readFileSync(file)),w=d.profile.windows.slice(1);
  report.fixture=d.fixture;
  if(!w.length)throw new Error('No post-warmup samples');
  const settings=v=>({tier:v.tier,viewport:v.viewport,buffer:v.buffer});
  if(!report.settings)report.settings=settings(w[0]);
  if(w.some(v=>v.tier!==0||JSON.stringify(settings(v))!==JSON.stringify(report.settings)))throw new Error('Settings differ');
  report.runs.push({file:name,build,programs:[d.programsAtStart,d.programsAtEnd],simulationFrames:d.simulationFrames,
    gpuMs:weighted(w,v=>v.gpuMs,v=>v.gpuSamples),cpuMs:weighted(w,v=>v.cpu.reduce((a,b)=>a+b,0)),
    fps:w.reduce((s,v)=>s+v.frames,0)/w.reduce((s,v)=>s+v.seconds,0),
    p95:mean(w.map(v=>v.p95)),triangles:weighted(w,v=>v.triangles),calls:weighted(w,v=>v.calls)});
}
for(const build of builds){
  const runs=report.runs.filter(r=>r.build===build);
  report[build]=Object.fromEntries(['gpuMs','cpuMs','fps','p95','triangles','calls'].map(k=>[k,mean(runs.map(r=>r[k]))]));
}
report.percentChange=Object.fromEntries(Object.keys(report.before).map(k=>[k,100*(report.after[k]/report.before[k]-1)]));
if(report.middle)report.percentFromPrevious=Object.fromEntries(Object.keys(report.middle).map(k=>[k,100*(report.after[k]/report.middle[k]-1)]));
report.limitations=[`One Windows Chromium device, ${report.settings.viewport.join('×')} viewport / ${report.settings.buffer.join('×')} buffer, full quality.`,
  'Physical mobile thermal behavior remains unmeasured.','Fixed simulation steps compare the same progression. V4 seeds street chunks independently; other gameplay effects are not guaranteed identical. Draw/triangle snapshots also vary with shadow cadence.',
  'This is a controlled performance fixture, not a gameplay timing change.'];
fs.writeFileSync(path.join(stage,'comparison.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
