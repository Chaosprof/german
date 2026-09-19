'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),file=path.join(root,'berlin-runner.html');
let html=fs.readFileSync(file,'utf8');
const begin=html.indexOf('  function makeTransitSpectacle(chunkSlot) {');
const end=html.indexOf('\n  // A second authored transit beat',begin);
assert.ok(begin>0&&end>begin);
let body=html.slice(begin,end);
const backup=path.join(root,'audit/berlin-viaduct-v84-baseline.js');
assert.ok(!fs.existsSync(backup),'preserve the first baseline');fs.writeFileSync(backup,body);
function replaceOne(a,b){assert.equal(body.split(a).length,2,'expected one '+a);body=body.replace(a,b);}
replaceOne('    var root = new THREE.Group();',`    // Taller spandrels and a broad radial ring give the masonry its weight.
    // The barrel radius and spring line remain fixed; only the deck rises.
    var deckLift = 1.10;
    var root = new THREE.Group();`);
for(const [a,b] of [
 ['side * 9.05, 8.88, 0','side * 9.05, 8.88 + deckLift, 0'],
 ['[1.35, 8.12]','[1.35, 8.12 + deckLift]'],
 ["cached('viaduct_masonry_arch_v3'","cached('viaduct_masonry_arch_v4'"],
 ['topY = 9.05, halfWidth','topY = 9.05 + deckLift, halfWidth'],
 ['{ w:15.675, h:1.80, x:side * 18.1625, y:8.15 }','{ w:15.675, h:1.80 + deckLift, x:side * 18.1625, y:8.15 + deckLift / 2 }'],
 ['outer=radius+(key?.57:.51)','outer=radius+(key?1.04:.94)'],
 ['var depthOut=key?.063:.052,bevel=.007','var depthOut=key?.092:.075,bevel=.010'],
 ["cached('viaduct_brick_fascia_v2'","cached('viaduct_brick_fascia_v3'"],
 ['(pos.getY(i) + 9.44) / 2.16','(pos.getY(i) + 9.44 + deckLift) / 2.16'],
 ['brickFascia.position.set(0, 9.44,','brickFascia.position.set(0, 9.44 + deckLift,'],
 ['0, 9.88, face * 2.46','0, 9.88 + deckLift, face * 2.46'],
 ['0, 9.51, 0, 0.025','0, 9.51 + deckLift, 0, 0.025'],
 ['y: 8.66, z: 0','y: 8.66 + deckLift, z: 0'],
 ['y: 8.92, z: 0','y: 8.92 + deckLift, z: 0'],
 ['y:10.0, z:side','y:10.0 + deckLift, z:side'],
 ['y:11.02, z:side','y:11.02 + deckLift, z:side'],
 ['y:10.19, z:side','y:10.19 + deckLift, z:side'],
 ['y:10.55, z:side','y:10.55 + deckLift, z:side'],
 ['y:10.60, z:side','y:10.60 + deckLift, z:side'],
 ['0, 10.04, z, 0.012','0, 10.04 + deckLift, z, 0.012'],
 ['train.position.y = 10.04;','train.position.y = 10.04 + deckLift;'],
 ['// Individual voussoirs reuse the existing half-metre lip footprint.','// Individual deep voussoirs frame the unchanged inner opening.'],
 ['// in its original place. Brick facing hides the central steel kick plate.','// on the taller masonry. Brick facing hides the central steel kick plate.'],
 ['// not floated. The underside is 9.05 m: well above runner, obstacles and','// not floated. The lifted underside is 10.15 m, above the runner, obstacles and']
])replaceOne(a,b);
html=html.slice(0,begin)+body+html.slice(end);
const old="var brickTones = ['#b77b61', '#b98268', '#b37c64', '#bc8065', '#b67e67', '#ba836b'];";
assert.equal(html.split(old).length,2);html=html.replace(old,
  "var brickTones = ['#ba8d7b', '#c39886', '#b98978', '#bc9382', '#b59080', '#c08f7f'];");
assert.equal(html.split('kiez-reference-v84').length,2);html=html.replace('kiez-reference-v84','kiez-reference-v85');
fs.writeFileSync(file,html);
console.log('Staged taller brick viaduct: unchanged aperture, footprint, mesh topology and material count.');
