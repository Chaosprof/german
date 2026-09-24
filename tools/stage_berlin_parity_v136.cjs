'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v136');
for(const dir of ['','frames'])fs.mkdirSync(path.join(stage,dir),{recursive:true});
const base=path.join(stage,'baseline.html');if(!fs.existsSync(base))fs.copyFileSync(path.join(root,'berlin-runner.html'),base);
let h=fs.readFileSync(base,'utf8');
const edits=[
  ['(1.0-smoothstep(-0.25,-0.18,vCourierGarment.x))','(1.0-smoothstep(-0.135,-0.115,vCourierGarment.x))'],
  ['new THREE.Color(0x3e5864)','new THREE.Color(0x4a6370)'],
  ['courierDenimColor*clamp(courierLuma/0.16,0.68,1.30)','courierDenimColor*clamp(courierLuma/0.16,0.42,1.28)'],
  ['courierDenimPaint,courierDenim*0.68','courierDenimPaint,courierDenim*0.94'],
  ['heroRimStrength * (1.0 - courierDenim * 0.65)','heroRimStrength * (1.0 - courierDenim * 0.80)'],
  ["'reference-outfit-v133'","'reference-outfit-v136'"],
  ["'courierReferenceOutfitV133|'","'courierReferenceOutfitV136|'"],
  ["'kiez-reference-v135'","'kiez-reference-v136'"]
];
for(const [before,after] of edits){assert.equal(h.split(before).length,2,before);h=h.replace(before,()=>after);}
fs.writeFileSync(path.join(stage,'candidate.html'),h);
fs.writeFileSync(path.join(stage,'edits.json'),JSON.stringify(edits,null,2));
console.log('Staged V136 woven denim response with existing shader arithmetic.');
if(process.argv.includes('--install')){
  const {execFileSync}=require('child_process');
  const target=path.join(root,'berlin-runner.html'),current=fs.readFileSync(target,'utf8');
  assert.ok(current===fs.readFileSync(base,'utf8')||current===h,'shipping page changed since this candidate was staged');
  const env={...process.env,BERLIN_HTML:path.join(stage,'candidate.html')};
  execFileSync(process.execPath,[path.join(root,'tools/check_berlin_denim_v136.cjs')],{cwd:root,env,stdio:'inherit'});
  execFileSync(process.execPath,[path.join(root,'tools/check_berlin_courier.cjs')],{cwd:root,env,stdio:'inherit'});
  fs.writeFileSync(target,h);
  const sw=path.join(root,'sw.js'),cache=fs.readFileSync(sw,'utf8');
  assert.match(cache,/artikel-blitz-v(?:135|136)/,'unexpected service-worker revision');
  fs.writeFileSync(sw,cache.replace(/artikel-blitz-v(?:135|136)/g,'artikel-blitz-v136'));
  console.log('Installed V136 material constants and cache revision.');
}
