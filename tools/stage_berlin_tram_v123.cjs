'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-tram-reference-v123');
let h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
const a=h.indexOf('  // BEGIN BLENDER VINTAGE TRAM'),b=h.indexOf('  // END BLENDER VINTAGE TRAM',a);
assert.ok(a>0&&b>a);
h=h.slice(0,a)+'  // BEGIN BLENDER VINTAGE TRAM\n'+fs.readFileSync(path.join(stage,'models/berlin-vintage-tram-v90.inline.js'),'utf8')+h.slice(b);
h=h.replace('mat(0xe5b74c,{roughness:.39','mat(data.colors.yellow,{roughness:.39').replace('mat(0xf0e2c8,{roughness:.43','mat(data.colors.cream,{roughness:.43');
h=h.replace('dark:MAT.metalDark,tyre:MAT.tyre,steel:STATION_MAT.steel,tail:PROP_TAIL,destination:destRollMat',
  'dark:MAT.metalDark,tyre:MAT.tyre,steel:makeRunnerTram.roofMaterial||(makeRunnerTram.roofMaterial=\n      mat(data.colors.steel,{roughness:.42,metalness:.10,envMapIntensity:.80})),tail:PROP_TAIL,destination:destRollMat');
h=h.replace("'kiez-reference-v122'","'kiez-reference-v123'");
for(const s of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(s[1]);
fs.writeFileSync(path.join(stage,'candidate.html'),h);
if(process.argv.includes('--install')){
  for(const ext of ['blend','glb','json','inline.js'])fs.copyFileSync(path.join(stage,'models/berlin-vintage-tram-v90.'+ext),path.join(root,'assets/models/berlin-vintage-tram-v90.'+ext));
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);
  const sw=path.join(root,'sw.js');fs.writeFileSync(sw,fs.readFileSync(sw,'utf8').replace(/artikel-blitz-v\d+/,'artikel-blitz-v123'));
}
console.log('V123 staged'+(process.argv.includes('--install')?' and installed':''));
