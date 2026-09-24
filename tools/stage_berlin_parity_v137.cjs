'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v137');
fs.mkdirSync(path.join(stage,'frames'),{recursive:true});
const baseline=path.join(stage,'baseline.html');
if(!fs.existsSync(baseline))fs.copyFileSync(path.join(root,'berlin-runner.html'),baseline);
let h=fs.readFileSync(baseline,'utf8');
const pattern=/var BERLIN_KIEZ_GARDEN_DATA = \{[^\r\n]*\};/;
const inline=fs.readFileSync(path.join(stage,'models/berlin-kiez-garden-v1.inline.js'),'utf8').match(pattern)[0];
assert.equal((h.match(new RegExp(pattern.source,'g'))||[]).length,1);
h=h.replace(pattern,()=>inline);
assert.equal(h.split("'kiez-reference-v136'").length,2);
h=h.replace("'kiez-reference-v136'","'kiez-reference-v137'");
fs.writeFileSync(path.join(stage,'candidate.html'),h);
console.log('Staged V137 thin-sheet leaf normals; geometry and shader stay fixed.');
if(process.argv.includes('--install')){
  const current=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
  assert.ok(current===fs.readFileSync(baseline,'utf8')||current===h,'shipping page changed since staging');
  require('./check_berlin_canopy_v137.cjs');
  for(const suffix of ['.json','.inline.js','.blend','.glb','-atlas.jpg'])
    fs.copyFileSync(path.join(stage,'models/berlin-kiez-garden-v1'+suffix),path.join(root,'assets/models/berlin-kiez-garden-v1'+suffix));
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);
  const sw=path.join(root,'sw.js'),cache=fs.readFileSync(sw,'utf8');
  assert.match(cache,/artikel-blitz-v(?:136|137)/);
  fs.writeFileSync(sw,cache.replace(/artikel-blitz-v(?:136|137)/g,'artikel-blitz-v137'));
  console.log('Installed V137 normal fields, native garden assets and cache revision.');
}
