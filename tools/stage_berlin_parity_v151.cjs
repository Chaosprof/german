'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v151'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const dir of ['','frames','benchmark'])fs.mkdirSync(path.join(stage,dir),{recursive:true});
if(!fs.existsSync(path.join(stage,'baseline.html'))){const b=fs.readFileSync(path.join(root,'berlin-runner.html'));assert.equal(sha(b),'781044ed68665c00d699a9929f2295a475134f0644edd0983171e3d642936e2f');fs.writeFileSync(path.join(stage,'baseline.html'),b);}
const edits=[
 ['var hemi = new THREE.HemisphereLight(0xbdd3f3, 0xa9a4a1, 0.72);','var hemi = new THREE.HemisphereLight(0xb1ccff, 0xa09b98, 0.82);'],
 ['var sun = new THREE.DirectionalLight(0xffcea4, 4.0);','var sun = new THREE.DirectionalLight(0xffcea4, 4.6);'],
 ['var fill = new THREE.DirectionalLight(0xffcfc0, 1.1);','var fill = new THREE.DirectionalLight(0xe8dfd1, 1.35);'],
 ['hemiSky: new THREE.Color(0xbdd3f3), hemiGround: new THREE.Color(0xa9a4a1), hemi: 0.72,','hemiSky: new THREE.Color(0xb1ccff), hemiGround: new THREE.Color(0xa09b98), hemi: 0.82,'],
 ['sun: new THREE.Color(0xffcea4), sunI: 4.0,','sun: new THREE.Color(0xffcea4), sunI: 4.6,'],
 ['fill: new THREE.Color(0xffcfc0), fillI: 1.1,','fill: new THREE.Color(0xe8dfd1), fillI: 1.35,'],
 ['grdShadow: new THREE.Color(1.00, 0.980, 1.045),','grdShadow: new THREE.Color(0.99, 0.985, 1.07),'],
 ["'kiez-reference-v150'","'kiez-reference-v151'"]
];
let page=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');for(const [from,to]of edits){assert.equal(page.split(from).length,2,from);page=page.replace(from,()=>to);}
fs.writeFileSync(path.join(stage,'candidate.html'),page);fs.writeFileSync(path.join(stage,'edits.json'),JSON.stringify(edits,null,2));
console.log(JSON.stringify({candidateSha256:sha(page),bytes:Buffer.byteLength(page),edits:edits.length},null,2));
