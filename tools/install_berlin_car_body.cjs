'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'berlin-runner.html');
const packed=fs.readFileSync(path.join(root,'assets/models/berlin-kiez-car-body-v1.inline.js'),'utf8');
const start='  // BEGIN BLENDER KIEZ CAR BODY',end='  // END BLENDER KIEZ CAR BODY';
const block=start+'\n'+packed+end;
let html=fs.readFileSync(file,'utf8');
if(html.includes(start))html=html.slice(0,html.indexOf(start))+block+html.slice(html.indexOf(end,html.indexOf(start))+end.length);
else {
  const anchor='  // Trabant-ish two-box car; also serves as the parked-car and obstacle model.';
  if(!html.includes(anchor))throw new Error('Missing car asset insertion point');
  html=html.replace(anchor,block+'\n'+anchor);
}
fs.writeFileSync(file,html);
console.log('Embedded Blender car shells: '+packed.length+' bytes.');
