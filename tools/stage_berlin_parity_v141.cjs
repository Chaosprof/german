'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v141'),name='berlin-reference-architecture-v1';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=JSON.parse(fs.readFileSync(path.join(stage,'models',name+'.json'),'utf8'));
const packed=require('./install_reference_architecture.cjs').packReferenceArchitecture(source);
const inline='var BERLIN_REFERENCE_ARCHITECTURE = '+JSON.stringify(packed)+';\n';
fs.writeFileSync(path.join(stage,'models/berlin-reference-architecture-runtime.inline.js'),inline);
let h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
const arch=/var BERLIN_REFERENCE_ARCHITECTURE = (\{[^\r\n]*\});/;
assert.ok(arch.test(h));h=h.replace(arch,()=>inline.trim());
assert.equal(h.split("'kiez-reference-v140'").length,2);h=h.replace("'kiez-reference-v140'","'kiez-reference-v141'");
fs.writeFileSync(path.join(stage,'candidate.html'),h);
console.log('Staged V141 eased bakery turret cornices.');
if(process.argv.includes('--install')){
  const accepted=JSON.parse(fs.readFileSync(path.join(stage,'performance-accepted.json'),'utf8'));
  assert.equal(accepted.accepted,true);assert.equal(accepted.candidateSha256,sha(h));
  assert.equal(fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8'),fs.readFileSync(path.join(stage,'baseline.html'),'utf8'),'shipping page changed since staging');
  for(const suffix of ['.json','.inline.js','.blend','.glb','-atlas.png'])assert.deepEqual(
    fs.readFileSync(path.join(root,'assets/models',name+suffix)),fs.readFileSync(path.join(stage,'baseline',name+suffix)),
    'shipping asset changed since staging: '+suffix);
  const oldPacked=require('./install_reference_architecture.cjs').packReferenceArchitecture(JSON.parse(fs.readFileSync(path.join(stage,'baseline',name+'.json'),'utf8')));
  assert.equal(fs.readFileSync(path.join(root,'assets/models/berlin-reference-architecture-runtime.inline.js'),'utf8'),
    'var BERLIN_REFERENCE_ARCHITECTURE = '+JSON.stringify(oldPacked)+';\n','shipping runtime asset changed since staging');
  for(const [file,hash] of Object.entries(accepted.assets))assert.equal(sha(fs.readFileSync(path.join(stage,'models',file))),hash,file);
  for(const file of Object.keys(accepted.assets))fs.copyFileSync(path.join(stage,'models',file),path.join(root,'assets/models',file));
  const cache=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert.match(cache,/artikel-blitz-v140/);
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);fs.writeFileSync(path.join(root,'sw.js'),cache.replace(/artikel-blitz-v140/g,'artikel-blitz-v141'));
  fs.writeFileSync(path.join(stage,'shipping.json'),JSON.stringify({pageSha256:sha(h),pageBytes:Buffer.byteLength(h),cacheRevision:'artikel-blitz-v141',assets:accepted.assets},null,2));
  console.log('Installed exact measured V141 candidate and native assets.');
}
