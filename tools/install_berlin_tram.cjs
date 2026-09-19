'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),file=path.join(root,'berlin-runner.html');
// Read the canonical artist files by default so reinstalling cannot undo a
// later Blender pass. An explicit stage is useful for a reviewable candidate.
const stageArg=process.argv.indexOf('--stage');
const stage=stageArg>=0?path.resolve(root,process.argv[stageArg+1]):null;
const modelDir=stage?path.join(stage,'models'):path.join(root,'assets/models');
const prefix='berlin-vintage-tram-v90';
let html=fs.readFileSync(file,'utf8');
const factory=fs.readFileSync(path.join(stage||path.join(root,'audit/berlin-tram-v90'),'makeRunnerTram.js'),'utf8').trimEnd();
const data=fs.readFileSync(path.join(modelDir,prefix+'.inline.js'),'utf8').trim();
const packed=JSON.parse(fs.readFileSync(path.join(modelDir,prefix+'.json'),'utf8'));
assert.ok(html.includes('function decodeBerlinMeshRecord('),'existing shared mesh decoder is required');
assert.ok(Object.values(packed.meshes).reduce((sum,mesh)=>sum+mesh.triangles,0)<=8000,'tram stays within approved geometry budget');
new vm.Script(data+'\n'+factory);
const start=html.indexOf('  function makeRunnerTram() {');
const end=html.indexOf('  function makeDeliveryMicrovan() {',start);
assert.ok(start>0&&end>start,'existing runner tram factory found');
if(stage)for(const ext of ['blend','glb','json','inline.js'])fs.copyFileSync(path.join(modelDir,prefix+'.'+ext),path.join(root,'assets/models',prefix+'.'+ext));
const begin='  // BEGIN BLENDER VINTAGE TRAM',finish='  // END BLENDER VINTAGE TRAM';
const oldBegin=html.lastIndexOf(begin,start),a=oldBegin>=0?oldBegin:start;
html=html.slice(0,a)+begin+'\n'+data+'\n'+finish+'\n'+factory+'\n\n'+html.slice(end);
fs.writeFileSync(file,html);
console.log('Embedded Blender vintage tram and its shared opaque factory.');
