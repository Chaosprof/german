'use strict';
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),file=path.join(root,'berlin-runner.html');
let html=fs.readFileSync(file,'utf8');
const start='  // BEGIN REFERENCE INTERIOR IMAGE',end='  // END REFERENCE INTERIOR IMAGE';
const bytes=fs.readFileSync(path.join(root,'assets/img/berlin-reference-surfaces-v2.jpg'));
const rooms=fs.readFileSync(path.join(root,'assets/img/berlin-secondary-shop-rooms-v1.jpg'));
const plaster=fs.readFileSync(path.join(root,'assets/img/berlin-reference-plaster-v1.jpg'));
const block=start+'\n  var BERLIN_REFERENCE_INTERIORS = '+JSON.stringify('data:image/jpeg;base64,'+bytes.toString('base64'))+';\n'+
  '  var BERLIN_SECONDARY_ROOMS = '+JSON.stringify('data:image/jpeg;base64,'+rooms.toString('base64'))+';\n'+
  '  var BERLIN_REFERENCE_PLASTER = '+JSON.stringify('data:image/jpeg;base64,'+plaster.toString('base64'))+';\n'+end;
if(html.includes(start)) html=html.slice(0,html.indexOf(start))+block+html.slice(html.indexOf(end,html.indexOf(start))+end.length);
else html=html.replace('  var berlinKiezKit = null;',block+'\n  var berlinKiezKit = null;');
fs.writeFileSync(file,html);
console.log('Embedded generated reference surfaces, secondary rooms and smooth plaster: '+(bytes.length+rooms.length+plaster.length)+' JPEG bytes.');
