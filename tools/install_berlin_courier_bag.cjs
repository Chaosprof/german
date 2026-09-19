'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),file=path.join(root,'berlin-runner.html');
const packed=fs.readFileSync(path.join(root,'assets/models/berlin-courier-bag-v1.inline.js'),'utf8');
const start='  // BEGIN BLENDER COURIER BAG',end='  // END BLENDER COURIER BAG';
const block=start+'\n'+packed+end;
let html=fs.readFileSync(file,'utf8');
if(html.includes(start))html=html.slice(0,html.indexOf(start))+block+html.slice(html.indexOf(end,html.indexOf(start))+end.length);
else {
  const anchor='  function dressCourierHero(mesh) {';assert.ok(html.includes(anchor));
  html=html.replace(anchor,block+'\n\n'+anchor);
}
fs.writeFileSync(file,html);console.log('Embedded soft courier bag: '+packed.length+' bytes.');
