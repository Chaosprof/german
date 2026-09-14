'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),htmlPath=path.join(root,'berlin-runner.html');
let html=fs.readFileSync(htmlPath,'utf8');
const start='  // BEGIN BLENDER GARDEN KIT',end='  // END BLENDER GARDEN KIT';
let before=html,after='',found=html.indexOf(start);
if(found>=0){
  const finish=html.indexOf(end,found);assert.ok(finish>found,'garden end marker exists');
  before=html.slice(0,found);after=html.slice(finish+end.length);
}else{
  found=html.indexOf('  function makeTree() {');assert.ok(found>=0,'tree insertion anchor exists');
  before=html.slice(0,found);after='\n\n'+html.slice(found);
}
const externalDecoders=((before+after).match(/\bfunction decodeBerlinMeshRecord\s*\(/g)||[]).length;
assert.ok(externalDecoders<=1,'only one shared static-mesh decoder may exist');
const code=name=>fs.readFileSync(path.join(__dirname,name),'utf8').replace(/\nif \(typeof module[^\n]+\n?$/,'\n');
const parts=[start,fs.readFileSync(path.join(root,'assets/models/berlin-kiez-garden-v1.inline.js'),'utf8')];
if(!externalDecoders)parts.push(code('berlin_packed_geometry.js'));
parts.push(code('berlin_garden_integration.js'),'var berlinGardenKit = createBerlinGardenKit(THREE, mat, BERLIN_KIEZ_GARDEN_DATA);',end);
html=before+parts.join('\n')+after;
assert.equal((html.match(/\bfunction decodeBerlinMeshRecord\s*\(/g)||[]).length,1,'exactly one shared decoder');
fs.writeFileSync(htmlPath,html);
console.log('Embedded Blender garden data, shared decoder and cached kit.');
