'use strict';
// One coherent lighting experiment: lower only the key/probe elevation.
const fs=require('fs'),assert=require('assert/strict');
let html=fs.readFileSync('berlin-runner.html','utf8');
const edits=[
 ['sun.position.set(-62, 75, -9);','sun.position.set(-62, 55, -9);'],
 ['sun.position.set(routePointX - 62, routePointY + 75, routePointZ - 9);','sun.position.set(routePointX - 62, routePointY + 55, routePointZ - 9);'],
 ['g.createRadialGradient(w * 0.057, h * 0.23, 0, w * 0.057, h * 0.23, w * 0.30)',
  'g.createRadialGradient(w * 0.057, h * 0.28, 0, w * 0.057, h * 0.28, w * 0.30)'],
 ['kiez-reference-v88','kiez-reference-v89']
];
for(const [before,after] of edits){assert.equal(html.split(before).length,2,'expected one '+before);html=html.replace(before,after);}
fs.writeFileSync('berlin-runner.html',html);
let sw=fs.readFileSync('sw.js','utf8');assert.equal(sw.split('artikel-blitz-v88').length,2);
fs.writeFileSync('sw.js',sw.replace('artikel-blitz-v88','artikel-blitz-v89'));
