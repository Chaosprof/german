'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v149'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(path.join(stage,p))),page=fs.readFileSync(path.join(stage,'candidate.html'));
const geometry=read('geometry-check.json'),native=read('native-check.json'),visual=read('visual-check.json'),verification=read('verification.json'),plan=read('benchmark-plan.json'),r=read('benchmark/comparison.json');
for(const check of [geometry,visual]){assert.equal(check.passed,true);assert.equal(check.candidateSha256,sha(page));}
assert.equal(native.passed,true);assert.equal(native.reopenedSource,true);assert.equal(native.blendSha256,geometry.assets['assets/models/berlin-kiez-garden-v1.blend']);
assert.equal(verification.candidateSha256,sha(page));assert.equal(plan.candidateSha256,sha(page));
assert.equal(verification.performanceFixtureLogSha256,sha(fs.readFileSync(path.join(stage,'performance-check.log'))));
assert.equal(verification.performanceFixtureSourceSha256,sha(fs.readFileSync(path.join(root,'tools/check_berlin_performance.cjs'))));
assert.equal(verification.nativeCheckSha256,sha(fs.readFileSync(path.join(stage,'native-check.json'))));
for(const kind of ['garden','finish'])assert.equal(verification[kind+'CheckLogSha256'],sha(fs.readFileSync(path.join(stage,kind+'-check.log'))));
assert.equal(geometry.closedLeaves,3372);assert.equal(geometry.addedDraws,0);assert.equal(geometry.addedShaders,0);assert.equal(geometry.addedTextures,0);
assert.deepEqual(page,fs.readFileSync(path.join(stage,'benchmark/candidate.html')));
assert.deepEqual(fs.readFileSync(path.join(stage,'baseline.html')),fs.readFileSync(path.join(stage,'benchmark/middle.html')));
assert.equal(sha(fs.readFileSync(path.join(stage,'benchmark/baseline.html'))),'f31808ed0be672f7997a52d59cd327e4a0d217f7d14aef6687f9c8161e89f3af');
assert.equal(r.fixture,'split-rng-v4-chunk-fixed-step');assert.equal(r.runs.length,9);assert.deepEqual(r.settings,{tier:0,viewport:[1600,900],buffer:[1600,900]});
for(const run of r.runs){const programs=run.build==='before'?70:65;assert.deepEqual(run.programs,[programs,programs]);assert.ok(run.simulationFrames>=1600);}
const gate={fpsAtLeastOriginal:r.after.fps>=r.before.fps,p95WithinOriginalPointOneMs:r.after.p95<=r.before.p95+.1,
 fpsWithinPreviousOnePercent:r.after.fps>=r.middle.fps*.99,p95WithinPreviousPointOneMs:r.after.p95<=r.middle.p95+.1};
const result={accepted:Object.values(gate).every(Boolean),candidateSha256:sha(page),gate,before:r.before,previous:r.middle,after:r.after,
 percentChange:r.percentChange,percentFromPrevious:r.percentFromPrevious,caveats:r.limitations};
fs.writeFileSync(path.join(stage,'performance-accepted.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
assert.equal(result.accepted,true,'predeclared frame-delivery gates');
if(process.argv.includes('--install')){
 assert.deepEqual(fs.readFileSync(path.join(root,'berlin-runner.html')),fs.readFileSync(path.join(stage,'baseline.html')),'shipping page unchanged during review');
 for(const [file,hash]of Object.entries(geometry.protectedFiles))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);
 for(const [file,hash]of Object.entries(geometry.assets)){
  const name=path.basename(file);assert.equal(sha(fs.readFileSync(path.join(stage,'models',name))),hash,name);
  assert.deepEqual(fs.readFileSync(path.join(root,file)),fs.readFileSync(path.join(stage,'baseline',name)),'native asset unchanged during review');
 }
 let worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert.ok(worker.includes('"artikel-blitz-v148"'));worker=worker.replace('"artikel-blitz-v148"','"artikel-blitz-v149"');
 for(const file of Object.keys(geometry.assets))fs.copyFileSync(path.join(stage,'models',path.basename(file)),path.join(root,file));
 const temp=path.join(root,'berlin-runner.v149.tmp.html');fs.writeFileSync(temp,page);fs.renameSync(temp,path.join(root,'berlin-runner.html'));fs.writeFileSync(path.join(root,'sw.js'),worker);
 assert.equal(sha(fs.readFileSync(path.join(root,'berlin-runner.html'))),sha(page));
 for(const [file,hash]of Object.entries({...geometry.protectedFiles,...geometry.assets}))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);
 fs.writeFileSync(path.join(stage,'shipping.json'),JSON.stringify({pageSha256:sha(page),pageBytes:page.length,cacheRevision:'artikel-blitz-v149',protectedFiles:{...geometry.protectedFiles,...geometry.assets},sources:{}},null,2));
 console.log('Installed and verified V149 page, four native garden assets and cache revision.');
}
