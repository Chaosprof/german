'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'berlin-runner.html');
const source=JSON.parse(fs.readFileSync(path.join(root,'assets/models/berlin-reference-architecture-v1.json'),'utf8'));
const data={version:1,source:source.source,masterWidth:13.5,meshes:{}};
for(const variant of [0,1]) {
  const key='13.5:'+variant+':1';
  if(!source.meshes[key])throw new Error('Missing Blender master '+key);
  data.meshes[key]=source.meshes[key];
}
// Authoring source keeps all twelve exact frontages; the game ships two
// cached masters to avoid downloading six redundant width/side variations.
const packed='var BERLIN_REFERENCE_ARCHITECTURE = '+JSON.stringify(data)+';\n';
fs.writeFileSync(path.join(root,'assets/models/berlin-reference-architecture-runtime.inline.js'),packed);
let html=fs.readFileSync(file,'utf8');
const start='  // BEGIN REFERENCE BLENDER ARCHITECTURE',end='  // END REFERENCE BLENDER ARCHITECTURE';
const block=start+'\n'+packed+end;
if(html.includes(start))html=html.slice(0,html.indexOf(start))+block+html.slice(html.indexOf(end,html.indexOf(start))+end.length);
else {
  if(!html.includes('  var berlinKiezKit = null;'))throw new Error('Missing architecture initialization marker');
  html=html.replace('  var berlinKiezKit = null;',block+'\n  var berlinKiezKit = null;');
}
fs.writeFileSync(file,html);
console.log('Embedded two Blender masters: '+packed.length+' bytes; twelve cached width/side variants.');
