'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v131');
let h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8'),kit=fs.readFileSync(path.join(stage,'baseline/berlin_kiez_kit.js'),'utf8');
const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim(),before=trim(kit);
function change(a,b){assert.equal(kit.split(a).length,2,a);kit=kit.replace(a,()=>b);}
// Trade one of the extra window boxes for a parked bicycle. The existing
// native balcony stays lush; the bakery remains below its 27k triangle cap.
change('slice(0,variant===0?3:variant===1?6:8);','slice(0,variant===0?2:variant===1?6:8);');
change('  box.dispose();leaf.dispose();bloom.dispose();',`
  var bicycleStart=faces/3+extraIndex.length/3;
  var bicycleVertexStart=extra.position.length/3;
  if(variant===0){
    var bikeX=side*(-width/2+1.10),bikeZ=1.10;
    var wheel=new THREE.TorusGeometry(1,.072,3,12),tube=new THREE.CylinderGeometry(1,1,1,3,1),spoke=new THREE.PlaneGeometry(1,1);
    [-.63,.63].forEach(function(wx){
      add(wheel,bikeX+wx,.37,bikeZ,.35,.35,.35,0x343e3c);
      for(var s=0;s<3;s++)add(spoke,bikeX+wx,.37,bikeZ+.002,.62,.009,1,0x9caba4,0,s*Math.PI/3);
    });
    function bar(a,b,r,color){
      var dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      add(tube,bikeX+(a[0]+b[0])/2,(a[1]+b[1])/2,bikeZ+.02,r,length,r,color,0,-Math.atan2(dx,dy));
    }
    var A=[-.63,.37],B=[-.09,.34],C=[-.30,.88],D=[.44,.88],E=[.63,.37],H=[.49,1.08];
    [[A,B],[B,C],[C,A],[C,D],[D,B],[D,E]].forEach(function(pair){bar(pair[0],pair[1],.018,0x43695f);});
    bar(D,H,.014,0x87978f);bar(H,[.72,1.06],.016,0x394644);
    add(box,bikeX-.30,.935,bikeZ+.02,.29,.058,.16,0x55463a);
    add(box,bikeX-.04,.31,bikeZ+.10,.29,.034,.08,0x777e73);
    bar([-.12,.35],[-.30,.022],.009,0x4f5b55);
    wheel.dispose();tube.dispose();spoke.dispose();
  }
  // The pavement surface is 16 cm above the road/building origin.
  for(var bv=bicycleVertexStart;bv<extra.position.length/3;bv++)extra.position[bv*3+1]+=.17;
  var bicycleEnd=faces/3+extraIndex.length/3;
  box.dispose();leaf.dispose();bloom.dispose();`);
change('displayBookCount:variant===1?6:0}', 'displayBookCount:variant===1?6:0,bicycleFaces:[bicycleStart,bicycleEnd],parkedBicycles:variant===0?1:0}');
assert.ok(h.includes(before));h=h.replace(before,()=>trim(kit));h=h.replace("'kiez-reference-v130'","'kiez-reference-v131'");
fs.mkdirSync(path.join(stage,'sources'),{recursive:true});fs.writeFileSync(path.join(stage,'sources/berlin_kiez_kit.js'),kit);
fs.writeFileSync(path.join(stage,'candidate.html'),h);
console.log('V131 parked-bicycle candidate staged.');
if(process.argv.includes('--install')){
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);fs.writeFileSync(path.join(root,'tools/berlin_kiez_kit.js'),kit);
  const a=kit.indexOf('function finishBerlinKiezFacade('),b=kit.indexOf('// Extend the single atlas material.',a);
  fs.writeFileSync(path.join(root,'tools/berlin_facade_finish_v119.js'),kit.slice(a,b)+"if (typeof module !== 'undefined') module.exports = {finishBerlinKiezFacade:finishBerlinKiezFacade};\n");
  fs.writeFileSync(path.join(root,'sw.js'),fs.readFileSync(path.join(root,'sw.js'),'utf8').replace(/artikel-blitz-v\d+/g,'artikel-blitz-v131'));
  console.log('Installed V131 page, kit, source and cache revision.');
}
