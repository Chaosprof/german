'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v129');
let h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
let garden=fs.readFileSync(path.join(stage,'baseline/berlin_garden_integration.js'),'utf8');
const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim(),oldGarden=trim(garden);
garden=garden.replace('dotNL * 3.80','dotNL * 3.00').replace('vec3(0.85, 0.88, 0.60), 0.42','vec3(0.85, 0.88, 0.60), 0.30').replace('garden-leaf-light-v127','garden-leaf-light-v129');
assert.ok(h.includes(oldGarden));h=h.replace(oldGarden,()=>trim(garden));
const inline=fs.readFileSync(path.join(stage,'models/berlin-kiez-garden-v1.inline.js'),'utf8').match(/var BERLIN_KIEZ_GARDEN_DATA = \{[^\r\n]*\};/)[0];
assert.ok(/var BERLIN_KIEZ_GARDEN_DATA = \{[^\r\n]*\};/.test(h));h=h.replace(/var BERLIN_KIEZ_GARDEN_DATA = \{[^\r\n]*\};/,()=>inline);
h=h.replace("'kiez-reference-v128'","'kiez-reference-v129'");
// The reference keeps the tower slightly right of the vanishing point.
// Shift the existing distant plate; no second landmark or draw is added.
assert.ok(h.includes('uSkylineOffset: { value: 0.9621 }'));
h=h.replace('uSkylineOffset: { value: 0.9621 }','uSkylineOffset: { value: 0.9720 }');
fs.mkdirSync(path.join(stage,'sources'),{recursive:true});fs.writeFileSync(path.join(stage,'sources/berlin_garden_integration.js'),garden);
fs.writeFileSync(path.join(stage,'candidate.html'),h);
console.log('V129 oval-leaf candidate staged; production unchanged.');
if(process.argv.includes('--install')){
  for(const suffix of ['.json','.inline.js','.blend','.glb','-atlas.jpg'])fs.copyFileSync(path.join(stage,'models/berlin-kiez-garden-v1'+suffix),path.join(root,'assets/models/berlin-kiez-garden-v1'+suffix));
  fs.writeFileSync(path.join(root,'tools/berlin_garden_integration.js'),garden);
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);
  fs.writeFileSync(path.join(root,'sw.js'),fs.readFileSync(path.join(root,'sw.js'),'utf8').replace(/artikel-blitz-v\d+/g,'artikel-blitz-v129'));
  console.log('Installed V129 page, garden assets, source and cache revision.');
}
