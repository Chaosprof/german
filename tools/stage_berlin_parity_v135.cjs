'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v135');
const full=JSON.parse(fs.readFileSync(path.join(stage,'models/berlin-reference-architecture-v1.json'),'utf8'));
const packed=require('./install_reference_architecture.cjs').packReferenceArchitecture(full);
const inline='var BERLIN_REFERENCE_ARCHITECTURE = '+JSON.stringify(packed)+';\n';
let h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
const pattern=/var BERLIN_REFERENCE_ARCHITECTURE = (\{[^\r\n]*\});/;
assert.ok(pattern.test(h));h=h.replace(pattern,()=>inline.trim());
assert.ok(h.includes("'kiez-reference-v134'"));h=h.replace("'kiez-reference-v134'","'kiez-reference-v135'");
fs.writeFileSync(path.join(stage,'models/berlin-reference-architecture-runtime.inline.js'),inline);
fs.writeFileSync(path.join(stage,'candidate.html'),h);
console.log('Staged V135 baked facade contact, with unchanged render code and geometry.');
if(process.argv.includes('--install')){
  const accepted=JSON.parse(fs.readFileSync(path.join(stage,'performance-accepted.json'),'utf8'));
  const sha=b=>require('crypto').createHash('sha256').update(b).digest('hex');
  assert.equal(accepted.accepted,true);assert.equal(accepted.candidateSha256,sha(h),'only the reviewed and measured candidate can ship');
  for(const [file,digest] of Object.entries(accepted.assets))assert.equal(sha(fs.readFileSync(path.join(stage,'models',file))),digest,file);
  for(const file of Object.keys(accepted.assets))fs.copyFileSync(path.join(stage,'models',file),path.join(root,'assets/models',file));
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);
  fs.writeFileSync(path.join(root,'sw.js'),fs.readFileSync(path.join(root,'sw.js'),'utf8').replace(/artikel-blitz-v\d+/g,'artikel-blitz-v135'));
  console.log('Installed V135 facade assets, page and cache revision.');
}
