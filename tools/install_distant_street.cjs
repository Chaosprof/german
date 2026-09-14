'use strict';
// Keep the generated background available in the restricted preview and file:// builds.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),htmlPath=path.join(root,'berlin-runner.html');
let html=fs.readFileSync(htmlPath,'utf8');
const data='data:image/jpeg;base64,'+fs.readFileSync(path.join(root,'assets/img/berlin-distant-street-v1.jpg')).toString('base64');
const marker='  // BEGIN DISTANT STREET IMAGE';
const block=marker+'\n  var BERLIN_DISTANT_STREET_IMAGE = '+JSON.stringify(data)+';\n  // END DISTANT STREET IMAGE';
if(html.includes(marker))html=html.replace(/  \/\/ BEGIN DISTANT STREET IMAGE[\s\S]*?  \/\/ END DISTANT STREET IMAGE/,()=>block);
else {
  const anchor='  // A small painted continuation lives behind all real geometry in the dome.';
  assert.ok(html.includes(anchor));html=html.replace(anchor,()=>block+'\n'+anchor);
}
html=html.replace("texLoader.load('assets/img/berlin-distant-street-v1.jpg',",'texLoader.load(BERLIN_DISTANT_STREET_IMAGE,');
assert.equal((html.match(/texLoader.load\(BERLIN_DISTANT_STREET_IMAGE,/g)||[]).length,1);
fs.writeFileSync(htmlPath,html);console.log('Embedded distant street JPEG: '+Buffer.byteLength(data)+' bytes.');
