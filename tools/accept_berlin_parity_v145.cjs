'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v145'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(stage,p))),page=fs.readFileSync(path.join(stage,'candidate.html')),source=read('source-check.json'),surface=read('surface-check.json'),poses=read('pose-check.json'),native=read('native-check.json'),r=read('benchmark/comparison.json');
for(const check of [source,surface,poses,read('trim-check.json')]){assert.equal(check.passed,true);assert.equal(check.candidateSha256,sha(page));}
assert.equal(native.passed,true);assert.equal(poses.poseSamples,255);assert.equal(poses.trianglePoseSamples,75);assert.ok(poses.maxFloorLowering<.004&&poses.bad.length===0);
assert.deepEqual(page,fs.readFileSync(path.join(stage,'benchmark/candidate.html')));
assert.deepEqual(fs.readFileSync(path.join(stage,'baseline.html')),fs.readFileSync(path.join(stage,'benchmark/middle.html')));
assert.equal(sha(fs.readFileSync(path.join(stage,'benchmark/baseline.html'))),'f31808ed0be672f7997a52d59cd327e4a0d217f7d14aef6687f9c8161e89f3af');
assert.equal(r.fixture,'split-rng-v4-chunk-fixed-step');assert.equal(r.runs.length,9);assert.deepEqual(r.settings,{tier:0,viewport:[1600,900],buffer:[1600,900]});
for(const run of r.runs){const programs=run.build==='after'?65:70;assert.deepEqual(run.programs,[programs,programs]);assert.ok(run.simulationFrames>=1600);}
const gate={fpsAtLeastOriginal:r.after.fps>=r.before.fps,p95WithinOriginalPointOneMs:r.after.p95<=r.before.p95+.1,fpsWithinPreviousOnePercent:r.after.fps>=r.middle.fps*.99,p95WithinPreviousPointOneMs:r.after.p95<=r.middle.p95+.1};
const result={accepted:Object.values(gate).every(Boolean),candidateSha256:sha(page),gate,before:r.before,previous:r.middle,after:r.after,percentChange:r.percentChange,percentFromPrevious:r.percentFromPrevious,caveats:r.limitations};
fs.writeFileSync(path.join(stage,'performance-accepted.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));assert.equal(result.accepted,true,'predeclared frame-delivery gates');
if(process.argv.includes('--install')){
 const visual=read('visual-check.json');assert.ok(visual.passed&&visual.candidateSha256===sha(page));
 assert.deepEqual(fs.readFileSync(path.join(root,'berlin-runner.html')),fs.readFileSync(path.join(stage,'baseline.html')),'shipping source unchanged while candidate tested');
 for(const [file,hash]of Object.entries(source.protectedFiles))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);
 for(const [name,hash]of Object.entries(source.changedAssets)){
  assert.equal(sha(fs.readFileSync(path.join(stage,'models',name))),hash,name);
  assert.deepEqual(fs.readFileSync(path.join(root,'assets/models',name)),fs.readFileSync(path.join(stage,'baseline',name)),'prior forms file unchanged '+name);
 }
 let worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert.ok(worker.includes('"artikel-blitz-v144"'));worker=worker.replace('"artikel-blitz-v144"','"artikel-blitz-v145"');
 for(const name of Object.keys(source.changedAssets))fs.copyFileSync(path.join(stage,'models',name),path.join(root,'assets/models',name));
 const temp=path.join(root,'berlin-runner.v145.tmp.html');fs.writeFileSync(temp,page);fs.renameSync(temp,path.join(root,'berlin-runner.html'));fs.writeFileSync(path.join(root,'sw.js'),worker);
 assert.equal(sha(fs.readFileSync(path.join(root,'berlin-runner.html'))),sha(page));
 for(const [name,hash]of Object.entries(source.changedAssets))assert.equal(sha(fs.readFileSync(path.join(root,'assets/models',name))),hash);
 for(const [file,hash]of Object.entries(source.protectedFiles))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash);
 fs.writeFileSync(path.join(stage,'shipping.json'),JSON.stringify({pageSha256:sha(page),pageBytes:page.length,cacheRevision:'artikel-blitz-v145',protectedFiles:source.protectedFiles,changedAssets:source.changedAssets},null,2));
 console.log('Installed and verified V145 page, four native/packed courier assets and cache revision.');
}
