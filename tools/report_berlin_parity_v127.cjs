'use strict';
const fs=require('fs'),path=require('path');
const stage=path.resolve(__dirname,'../audit/berlin-parity-v127');
const average=a=>a.reduce((s,v)=>s+v,0)/a.length;
const report={fixture:'split-rng-v2',viewport:[1280,720],buffer:[1600,900],qualityTier:0,
  warmup:'Discard the first five-second window of each 45-second run.',runs:[]};
for(const build of ['before','after'])for(let i=0;i<3;i++){
  const name=`accepted127-${build}-${i}.json`,file=path.join(stage,name);
  if(!fs.existsSync(file))throw new Error('Incomplete comparison: '+name);
  const data=JSON.parse(fs.readFileSync(file)),windows=data.profile.windows.slice(1);
  if(windows.some(w=>w.tier!==0||w.buffer.join(',')!=='1600,900'))throw new Error('Non-comparable settings');
  report.runs.push({file:name,build,programs:[data.programsAtStart,data.programsAtEnd],
    gpuMs:average(windows.map(w=>w.gpuMs)),fps:average(windows.map(w=>w.fps)),
    cpuMs:average(windows.map(w=>w.cpu.reduce((a,b)=>a+b,0))),p95:average(windows.map(w=>w.p95)),
    triangles:average(windows.map(w=>w.triangles)),calls:average(windows.map(w=>w.calls))});
}
for(const build of ['before','after']){
  const runs=report.runs.filter(r=>r.build===build);report[build]={};
  for(const key of ['gpuMs','fps','cpuMs','p95','triangles','calls'])report[build][key]=average(runs.map(r=>r[key]));
}
report.percentChange=Object.fromEntries(Object.keys(report.before).map(k=>[k,100*(report.after[k]/report.before[k]-1)]));
report.limitations=['One Windows Chromium session; no physical-phone thermal or battery testing.',
  'Fixed RNG separates render allocations from game RNG, but wall-clock gameplay timing can still vary content.',
  'Repeated averages measure this pass; they do not establish full visual parity.'];
fs.writeFileSync(path.join(stage,'performance-comparison.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
