'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'assets/models/berlin-courier-forms-v114.inline.js');
const file=path.join(root,'berlin-runner.html');
let html=fs.readFileSync(file,'utf8');
const block=fs.readFileSync(source,'utf8').trimEnd();
const start='  // BEGIN COURIER_FORMS_PATCH_V114',end='  // END COURIER_FORMS_PATCH_V114';
const anchor='  function refineCourierSilhouette(mesh) {';
if(html.includes(start)) {
  const a=html.indexOf(start),b=html.indexOf(end,a);
  assert.ok(b>a);html=html.slice(0,a)+block+html.slice(b+end.length);
} else {
  assert.equal(html.split(anchor).length,2);
  html=html.replace(anchor,block+'\n\n'+anchor);
}
const call='    applyBerlinCourierClothPatchV97(geo);';
if(!html.includes('    applyBerlinCourierFormsPatchV114(geo);')) {
  assert.equal(html.split(call).length,2);
  html=html.replace(call,call+'\n    applyBerlinCourierFormsPatchV114(geo);');
}
fs.writeFileSync(file,html);
console.log('Embedded baked courier cuff and clothing forms after the V97 sculpt.');
