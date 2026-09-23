'use strict';
// Promote the reviewed bundle without rerunning historical asset installers.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-final-v122');
const h=fs.readFileSync(path.join(stage,'candidate.html'),'utf8');
assert.ok(h.includes("'kiez-reference-v122'"));
for(const s of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(s[1]);
const models=path.join(root,'assets/models');
for(const [dir,prefix]of [['berlin-parity-courier-v120/bag/models','berlin-courier-bag-v1'],['berlin-parity-tram-v121/models','berlin-vintage-tram-v90']]){
  for(const ext of ['blend','glb','json','inline.js'])fs.copyFileSync(path.join(root,'audit',dir,prefix+'.'+ext),path.join(models,prefix+'.'+ext));
}
for(const ext of ['bin','json','inline.js','blend'])fs.copyFileSync(path.join(root,'audit/berlin-parity-courier-v120/shoes','courier-forms-v114.'+ext),path.join(models,'berlin-courier-forms-v114.'+ext));
fs.copyFileSync(path.join(root,'audit/berlin-parity-facades-v119/berlin_kiez_kit.js'),path.join(root,'tools/berlin_kiez_kit.js'));
fs.writeFileSync(path.join(root,'berlin-runner.html'),h);
const sw=path.join(root,'sw.js');fs.writeFileSync(sw,fs.readFileSync(sw,'utf8').replace(/artikel-blitz-v\d+/,'artikel-blitz-v122'));
console.log('Installed reviewed V119–V122 source/assets; original hero GLB unchanged.');
