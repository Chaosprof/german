'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v128');
let h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
let kiez=fs.readFileSync(path.join(stage,'baseline/berlin_kiez_kit.js'),'utf8');
const oldKit=kiez.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();
// A few books stand on the existing sill, ahead of the painted room. Their
// printed covers sample the existing Berlin picture in the shared atlas.
const display=`
  var displayBookStart=faces/3+extraIndex.length/3;
  if(variant===1){
    var cover=new THREE.PlaneGeometry(1,1),bookScale=width/13.5*side;
    [-4.2,0,4.2].forEach(function(bay,bi){
      [-.82,.82].forEach(function(offset,j){
        var x=(bay+offset)*bookScale,y=1.055,z=.13,tilt=(j?-.055:.065)*side;
        add(box,x,y,z,.38*Math.abs(bookScale),.58,.09,j?0x526c65:0x936850,0,tilt);
        add(box,x,y-.285,z-.025,.43*Math.abs(bookScale),.035,.18,0x71634e);
        var firstUV=extra.uv.length;
        add(cover,x,y,z+.047,.345*Math.abs(bookScale),.545,1,0xffffff,0,tilt);
        for(var cv=0;cv<cover.attributes.uv.count;cv++){
          var u=cover.attributes.uv.getX(cv),v=cover.attributes.uv.getY(cv);
          if(side<0)u=1-u;
          extra.uv[firstUV+cv*2]=(.143+u*.139)/4;
          extra.uv[firstUV+cv*2+1]=.5+(.125+v*.29)/4;
        }
      });
    });
    cover.dispose();
  }
  var displayBookEnd=faces/3+extraIndex.length/3;
`;
assert.equal(kiez.split('  box.dispose();leaf.dispose();bloom.dispose();').length,2);
kiez=kiez.replace('  box.dispose();leaf.dispose();bloom.dispose();',display+'  box.dispose();leaf.dispose();bloom.dispose();');
assert.equal(kiez.split('flowerBoxes:slots.length}').length,2);
kiez=kiez.replace('flowerBoxes:slots.length}','flowerBoxes:slots.length,displayBookFaces:[displayBookStart,displayBookEnd],displayBookCount:variant===1?6:0}');
const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();
assert.ok(h.includes(oldKit));h=h.replace(oldKit,()=>trim(kiez));
fs.mkdirSync(path.join(stage,'sources'),{recursive:true});
fs.writeFileSync(path.join(stage,'sources/berlin_kiez_kit.js'),kiez);
const architecture=JSON.parse(fs.readFileSync(path.join(stage,'models/berlin-reference-architecture-v1.json'),'utf8'));
const inline='var BERLIN_REFERENCE_ARCHITECTURE = '+JSON.stringify(require('./install_reference_architecture.cjs').packReferenceArchitecture(architecture))+';';
const data=/var BERLIN_REFERENCE_ARCHITECTURE = \{[^\r\n]*\};/;
assert.ok(data.test(h));h=h.replace(data,()=>inline);
function change(a,b){assert.equal(h.split(a).length,2,a);h=h.replace(a,()=>b);}
// A shallow real cross-section gives the rail groove a stable grazing-light
// response. It remains under 12 mm above paving and in the same shared draw.
change('var railStripGeo = new THREE.PlaneGeometry(0.19, CHUNK_LEN);\n  railStripGeo.rotateX(-Math.PI / 2);',`
var railStripGeo = new THREE.BufferGeometry(), railP=[],railN=[],railUV=[],railI=[];
  var railProfile=[[0,0],[.10,0],[.14,.001],[.18,-.004],[.30,-.004],[.36,.003],[.50,.005],[.65,.005],[.79,.001],[1,0]];
  for(var ri=0;ri<railProfile.length-1;ri++){
    var ra=railProfile[ri],rb=railProfile[ri+1],off=railP.length/3;
    var rn=new THREE.Vector3(-(rb[1]-ra[1]),(rb[0]-ra[0])*.19,0).normalize();
    [[ra,-.5],[rb,-.5],[rb,.5],[ra,.5]].forEach(function(q){
      railP.push((q[0][0]-.5)*.19,q[0][1],q[1]*CHUNK_LEN);
      railN.push(rn.x,rn.y,0);railUV.push(q[0][0],q[1]+.5);
    });
    railI.push(off,off+2,off+1,off,off+3,off+2);
  }
  railStripGeo.setAttribute('position',new THREE.Float32BufferAttribute(railP,3));
  railStripGeo.setAttribute('normal',new THREE.Float32BufferAttribute(railN,3));
  railStripGeo.setAttribute('uv',new THREE.Float32BufferAttribute(railUV,2));
  railStripGeo.setIndex(railI);railStripGeo.computeBoundingBox();railStripGeo.computeBoundingSphere();`);
change('var railStripGeoMirror = railStripGeo.clone();\n  var railStripU = railStripGeoMirror.attributes.uv;\n  for (var rsu = 0; rsu < railStripU.count; rsu++) railStripU.setX(rsu, 1 - railStripU.getX(rsu));',`
  var railStripGeoMirror = railStripGeo.clone().scale(-1,1,1);
  var railMirrorIndex=railStripGeoMirror.index.array;
  for(var rm=0;rm<railMirrorIndex.length;rm+=3){var swap=railMirrorIndex[rm+1];railMirrorIndex[rm+1]=railMirrorIndex[rm+2];railMirrorIndex[rm+2]=swap;}`);
change('MAT.road.emissive.setHex(0x403e62);','MAT.road.emissive.setHex(0x343d55);');
change('grdShadow: new THREE.Color(1.00, 0.955, 1.06)','grdShadow: new THREE.Color(1.00, 0.980, 1.045)');
// Retain some baked skin variation while removing the donor atlas's dark
// mottling on the newly exposed forearms. No new map or masked surface.
change('mix(courierSkinColor, courierSource, courierSkinPaint), courierForearm)',
  'mix(courierSkinColor, courierSource, courierSkinPaint * 0.32), courierForearm)');
h=h.replace("'kiez-reference-v127'","'kiez-reference-v128'");
fs.writeFileSync(path.join(stage,'candidate.html'),h);
console.log('V128 candidate staged; production source unchanged.');
if(process.argv.includes('--install')){
  for(const suffix of ['.json','.inline.js','.blend','.glb','-atlas.png'])fs.copyFileSync(path.join(stage,'models/berlin-reference-architecture-v1'+suffix),path.join(root,'assets/models/berlin-reference-architecture-v1'+suffix));
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);
  fs.writeFileSync(path.join(root,'tools/berlin_kiez_kit.js'),kiez);
  const a=kiez.indexOf('function finishBerlinKiezFacade('),b=kiez.indexOf('// Extend the single atlas material.',a);
  fs.writeFileSync(path.join(root,'tools/berlin_facade_finish_v119.js'),kiez.slice(a,b)+"if (typeof module !== 'undefined') module.exports = {finishBerlinKiezFacade:finishBerlinKiezFacade};\n");
  fs.writeFileSync(path.join(root,'sw.js'),fs.readFileSync(path.join(root,'sw.js'),'utf8').replace(/artikel-blitz-v\d+/g,'artikel-blitz-v128'));
  console.log('Installed V128 page, architecture, synchronized sources and cache revision.');
}
