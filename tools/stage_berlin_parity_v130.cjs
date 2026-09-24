'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v130');
let h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
function change(a,b){assert.equal(h.split(a).length,2,a);h=h.replace(a,()=>b);}
// Extend the existing arm paint mask through the hands. Geometry, weights,
// cloth patches and accessory anchors remain unchanged.
change('shoe:shoe, sleeve:isSleeve, head:/^(Head|head_end|headfront)$/.test(name),',
  'shoe:shoe, sleeve:isSleeve, hand:/^(Left|Right)Hand$/.test(name), head:/^(Head|head_end|headfront)$/.test(name),');
change('if (spec.sleeve) sleeveWeight += weight;','if (spec.sleeve || spec.hand) sleeveWeight += weight;');
const start=h.indexOf('  function courierSleeveMaterial(material) {'),end=h.indexOf('\n  // Dress the authored rig',start);
let shader=h.slice(start,end);
const tail="        ].join('\\n'));";
assert.equal(shader.split(tail).length,2);
shader=shader.replace(tail,`        ].join('\\n'))
        .replace('#include <roughnessmap_fragment>',[
          '#include <roughnessmap_fragment>',
          // Reuse the established skin/clothing masks. These finishes share
          // the original body draw, sampler count and geometry attributes.
          'roughnessFactor=mix(roughnessFactor,0.91,max(courierCloth,courierSleeve));',
          'roughnessFactor=mix(roughnessFactor,0.66,courierForearm);',
          'roughnessFactor=mix(roughnessFactor,0.78,vCourierGarment.w);',
          'roughnessFactor=mix(roughnessFactor,0.97,smoothstep(0.08,0.70,vCourierSole.x));'
        ].join('\\n'));`);
shader=shader.replace("'courierReferenceOutfitV120|'","'courierReferenceOutfitV130|'").replace("'reference-outfit-v120'","'reference-outfit-v130'");
h=h.slice(0,start)+shader+h.slice(end);
change("'kiez-reference-v129'","'kiez-reference-v130'");
fs.writeFileSync(path.join(stage,'candidate.html'),h);
console.log('V130 courier material candidate staged.');
if(process.argv.includes('--install')){
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);
  fs.writeFileSync(path.join(root,'sw.js'),fs.readFileSync(path.join(root,'sw.js'),'utf8').replace(/artikel-blitz-v\d+/g,'artikel-blitz-v130'));
  console.log('Installed V130 page and cache revision.');
}
