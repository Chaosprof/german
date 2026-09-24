'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const dir=path.resolve(__dirname,'../audit/berlin-tram-reference-v123'),mean=a=>a.reduce((n,v)=>n+v,0)/a.length;
const output={scope:'One paired 65-second desktop smoke comparison at fixed quality; not a statistical benchmark'};
for(const build of ['before','after']){
 const r=JSON.parse(fs.readFileSync(path.join(dir,'perf-'+build+'-0.json')));
 assert.ok(r.state==='complete'&&r.elapsed>=65&&r.programsAtStart===r.programsAtEnd);
 const w=r.profile.windows.slice(1);assert.ok(w.length>=10,'enable profile=1 to collect sustained timing windows');
 assert.ok(w.every(v=>Number.isFinite(v.gpuMs)&&v.gpuSamples>0));
 assert.ok(w.every(v=>v.tier===0&&JSON.stringify(v.buffer)===JSON.stringify(w[0].buffer)&&JSON.stringify(v.viewport)===JSON.stringify(w[0].viewport)),'fixed quality and resolution');
 output[build]={gpuMs:mean(w.map(v=>v.gpuMs)),fps:mean(w.map(v=>v.fps)),windows:w.length,programs:[r.programsAtStart,r.programsAtEnd],buffer:w[0].buffer,viewport:w[0].viewport,capturedAt:r.profile.capturedAt};
}
assert.deepEqual(output.after.buffer,output.before.buffer);assert.deepEqual(output.after.viewport,output.before.viewport);
output.deltaGpuMs=output.after.gpuMs-output.before.gpuMs;output.deltaFps=output.after.fps-output.before.fps;
const geometry=JSON.parse(fs.readFileSync(path.join(dir,'shipping-check.json')));
assert.ok(geometry.passed&&geometry.shipping);
const base=JSON.parse(fs.readFileSync(path.join(dir,'baseline/berlin-vintage-tram-v90.json')));
output.geometry={beforeTriangles:Object.values(base.meshes).reduce((n,m)=>n+m.triangles,0),afterTriangles:geometry.triangles,draws:geometry.draws};
output.gates={gpu:output.deltaGpuMs<=.5,fps:output.deltaFps>=-3,triangles:output.geometry.afterTriangles<=output.geometry.beforeTriangles,batches:geometry.draws<=9};
output.installedSha256=crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'../berlin-runner.html'))).digest('hex');
assert.deepEqual(fs.readFileSync(path.join(dir,'candidate.html')),fs.readFileSync(path.resolve(__dirname,'../berlin-runner.html')));
fs.writeFileSync(path.join(dir,'performance-summary.json'),JSON.stringify(output,null,2));console.log(JSON.stringify(output,null,2));
