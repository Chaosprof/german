'use strict';
// Stage only. The parent applies the bounded bag fragment after live review.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-courier-v111'),base=path.join(stage,'baseline'),out=path.join(stage,'models');
fs.mkdirSync(base,{recursive:true});fs.mkdirSync(out,{recursive:true});
const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
const start=html.indexOf('  function dressCourierHero(mesh) {'),end=html.indexOf('\n  function findHeroRunClip',start);
assert.ok(start>0&&end>start);
const sourcePath=path.join(base,'dressCourierHero.js');
if(!fs.existsSync(sourcePath))fs.writeFileSync(sourcePath,html.slice(start,end));
const original=fs.readFileSync(sourcePath,'utf8');
for(const ext of ['blend','glb','json','inline.js']){
  const name='berlin-courier-bag-v1.'+ext,target=path.join(base,name);
  if(!fs.existsSync(target))fs.copyFileSync(path.join(root,'assets/models',name),target);
}
const beforeStart=original.indexOf('    var packGeometry = '),beforeEnd=original.indexOf('    bag.scale.setScalar(0.74);',beforeStart);
assert.ok(beforeStart>0&&beforeEnd>beforeStart);
let finish=original.slice(beforeStart,beforeEnd);
const replace=(from,to)=>{assert.ok(finish.includes(from),'known bag source: '+from);finish=finish.replace(from,to);};
replace('    var bagTeal = teal;',`    // Satchel colors are independent of the cap. Keep three bag batches.
    var bagTeal = heroTrimMat(0x2d7376, 0.91, 0.055);
    var bagInk = heroTrimMat(0x244e54, 0.94, 0.045);
    var bagLeather = heroTrimMat(0xb68b57, 0.88, 0.07);`);
replace('      bagTeal = heroTrimMat(0x318f87, 0.88, 0.12);\n','');
replace('[side*0.90,1.48,1.02],[side*0.59,1.62,0.53],[side*0.59,1.03,0.26]],0.115,navy);','[side*0.90,1.48,1.02],[side*0.59,1.62,0.53],[side*0.59,1.03,0.26]],0.115,bagInk);');
replace(`    tiltPackDetail(roundedBox(bagRadius*0.23,bagRadius*0.62,bagRadius*0.09,bagRadius*0.04,
      cream,bagRadius*0.68,bagRadius*0.38,-front*bagRadius*0.94,bagRadius*0.025));
    tiltPackDetail(roundedBox(bagRadius*0.29,bagRadius*0.12,bagRadius*0.035,bagRadius*0.02,
      navy,bagRadius*0.68,bagRadius*0.40,-front*bagRadius*1.005,bagRadius*0.012));
    bagCord([[-0.92,0.35,-0.899],[0.0,0.292,-0.915],[0.96,0.35,-0.899]],0.009,navy).rotation.z=-0.12;`,
`    // The rear chase view mirrors bind-space X: negative X is the visible
    // right side. A tan leather tongue crosses the flap hem toward the pocket.
    tiltPackDetail(roundedBox(bagRadius*0.24,bagRadius*0.72,bagRadius*0.09,bagRadius*0.055,
      bagLeather,-bagRadius*0.60,-bagRadius*0.04,-front*bagRadius*0.94,bagRadius*0.025));
    tiltPackDetail(roundedBox(bagRadius*0.17,bagRadius*0.10,bagRadius*0.035,bagRadius*0.02,
      bagInk,-bagRadius*0.60,-bagRadius*0.14,-front*bagRadius*1.005,bagRadius*0.012));
    bagCord([[-1.13,0.395,-0.868],[-0.86,0.321,-0.903],[0.035,0.291,-0.924],
      [0.92,0.321,-0.903],[1.20,0.395,-0.868]],0.016,bagInk).rotation.z=-0.12;
    // A single restrained pocket seam resolves at chase distance; no stitches
    // or texture noise that would flicker as the runner moves.
    bagCord([[-0.79,-0.49,-0.874],[0.025,-0.49,-0.896],[0.84,-0.49,-0.874]],
      0.011,bagInk).rotation.z=-0.12;`);
fs.writeFileSync(path.join(stage,'bag-finish.js'),finish);
fs.writeFileSync(path.join(stage,'dressCourierHero.js'),original.slice(0,beforeStart)+finish+original.slice(beforeEnd));
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const metadata={revision:'satchel-finish-v111',baselineSha256:Object.fromEntries(fs.readdirSync(base).map(n=>[n,hash(path.join(base,n))])),
  bagColor:0x2d7376,inkColor:0x244e54,leatherColor:0xb68b57,roughness:.91,rim:.055,
  hardware:{bindSpaceX:-.60,leatherCenterY:-.04,leatherSize:[.24,.72,.09],claspCenterY:-.14},
  geometry:'All three native shell records and the V104 contact atlas stay exact; one additional 160-triangle pocket seam.',
  integration:{start:'    var packGeometry = ',end:'    bag.scale.setScalar(0.74);',fragment:'bag-finish.js',preserveOutside:true}};
fs.writeFileSync(path.join(stage,'candidate.json'),JSON.stringify(metadata,null,2)+'\n');
console.log('Staged bag-only finish; canonical files unchanged.');
