'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v139');
fs.mkdirSync(path.join(stage,'frames'),{recursive:true});
const base=path.join(stage,'baseline.html');
if(!fs.existsSync(base))fs.copyFileSync(path.join(root,'berlin-runner.html'),base);
let h=fs.readFileSync(base,'utf8');
const before=fs.readFileSync(path.join(stage,'baseline/berlin-kiez-garden-v1.inline.js'),'utf8').trim();
const after=fs.readFileSync(path.join(stage,'models/berlin-kiez-garden-v1.inline.js'),'utf8').trim();
assert.equal(h.split(before).length,2,'one exact embedded garden source');
h=h.replace(before,()=>after);
assert.equal(h.split("'kiez-reference-v138'").length,2);
h=h.replace("'kiez-reference-v138'","'kiez-reference-v139'");
fs.writeFileSync(path.join(stage,'candidate.html'),h);
console.log('Staged V139 finer branching planter; renderer and gameplay source unchanged.');
if(process.argv.includes('--install')){
  const crypto=require('crypto'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  const current=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
  assert.ok(current===fs.readFileSync(base,'utf8')||current===h,'shipping page changed since staging');
  const cache=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert.match(cache,/artikel-blitz-v(?:138|139)/);
  const accepted=JSON.parse(fs.readFileSync(path.join(stage,'performance-accepted.json'),'utf8'));
  assert.equal(accepted.accepted,true);assert.equal(accepted.candidateSha256,sha(h));
  for(const [file,hash] of Object.entries(accepted.assets)){
    assert.equal(sha(fs.readFileSync(path.join(stage,'models',file))),hash,file);
    const live=sha(fs.readFileSync(path.join(root,'assets/models',file))),old=sha(fs.readFileSync(path.join(stage,'baseline',file)));
    assert.ok(live===hash||live===old,'shipping asset changed since staging: '+file);
  }
  for(const file of Object.keys(accepted.assets))fs.copyFileSync(path.join(stage,'models',file),path.join(root,'assets/models',file));
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);
  fs.writeFileSync(path.join(root,'sw.js'),cache.replace(/artikel-blitz-v(?:138|139)/g,'artikel-blitz-v139'));
  fs.writeFileSync(path.join(stage,'shipping.json'),JSON.stringify({pageSha256:sha(h),pageBytes:Buffer.byteLength(h),assets:accepted.assets,cacheRevision:'artikel-blitz-v139'},null,2));
  console.log('Installed measured V139 garden assets, page and cache revision.');
}
