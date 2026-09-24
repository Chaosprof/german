'use strict';
// Reproducible visual candidate, always based on the preserved V126 tree.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v127');
const read=p=>fs.readFileSync(path.join(stage,p),'utf8');
const code=p=>fs.readFileSync(path.join(__dirname,p),'utf8').replace(/\nif \(typeof module[^\n]+\n?$/,'\n');
function change(s,a,b){assert.equal(s.split(a).length,2,'unique anchor: '+a.slice(0,90));return s.replace(a,()=>b);}
function block(s,a,b,replacement){const i=s.indexOf(a),j=s.indexOf(b,i);assert.ok(i>=0&&j>i,a);return s.slice(0,i)+a+'\n'+replacement+'\n'+s.slice(j);}
let h=read('baseline.html');
let garden=read('baseline/berlin_garden_integration.js');
// The old eightfold highlight washed every upward-facing leaf to yellow.
// Retain transmission and smooth wrapped diffuse, with a restrained sheen.
garden=change(garden,'dotNL * 8.00','dotNL * 3.80');
garden=change(garden,'vec3(0.85, 0.88, 0.60), 0.60','vec3(0.85, 0.88, 0.60), 0.42');
garden=garden.replace('garden-leaf-light-v4','garden-leaf-light-v127');
garden=change(garden,"      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',source);",`
      // The atlas supplies restrained vein/detail variation. Its photographed
      // inter-leaf shadows must not be multiplied over each individual mesh.
      var leafMap=THREE.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',[
        '#ifdef USE_COLOR',
        'float gardenLeafSurface=smoothstep(0.005,0.055,vColor.g-vColor.r)*smoothstep(0.015,0.07,vColor.g-vColor.b);',
        'float gardenVein=0.90+0.32*dot(sampledDiffuseColor.rgb,vec3(0.2126,0.7152,0.0722));',
        'sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,vec3(gardenVein),gardenLeafSurface);',
        '#endif',
        'diffuseColor *= sampledDiffuseColor;'
      ].join('\\n'));
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',leafMap);
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',source);`);
let kiez=read('baseline/berlin_kiez_kit.js');
kiez=change(kiez,'slots=slots.slice(0,variant===0?3:variant===1?8:10);',
  'slots=slots.filter(function(s,i){return variant===0||((i*7+variant*3)%11)<8;}).slice(0,variant===0?3:variant===1?6:8);');
kiez=change(kiez,'var bloom=new THREE.OctahedronGeometry(1,0);','var bloom=new THREE.SphereGeometry(1,5,2);');
kiez=change(kiez,'var geranium=[0xe2476f,0xf06a8e,0xd7355c,0xfbe3e8,0xef8aa4];','var geranium=[0xd56c79,0xed9a9a,0xc84e67,0xffe8cd,0xe8b1a4];');
kiez=change(kiez,'for(var j=0;j<14;j++){\n      var t=(j+.5)/14,r=.11+.02*((j*7+si)%4);',
  'for(var j=0;j<12;j++){\n      var t=(j+.5)/12,r=.085+.012*((j*7+si)%4);');
kiez=change(kiez,'r*1.2,r,r,geranium','r*1.25,r*.90,r,geranium');
// Stagger smaller leaves, leaving air between flowers and the window frame.
kiez=change(kiez,'for(var j=0;j<6;j++){\n      var t=(j%3+.5)/3,tier=j<3?0:1;',
  'for(var j=0;j<10;j++){\n      var t=(j%5+.5)/5,tier=j<5?0:1;');
kiez=change(kiez,',.34,.24,.30,j%2?0x5f8a3e:0x7c9a3f',',.21,.16,.22,j%2?0x4e7137:0x758b40');
kiez=change(kiez,'y+.18+Math.abs(Math.sin(j*1.9+si))*.26','y+.16+Math.abs(Math.sin(j*1.9+si))*.18');
// Merchandise projects in front of the painted room. It stays inside the
// measured clear openings and is merged into the existing facade draw.
// This trial remains opt-in until its shape/material finish matches the art.
if(process.argv.includes('--shops')){
kiez=change(kiez,'  box.dispose();leaf.dispose();bloom.dispose();', `
  var merchandiseStartTriangle=(variant===0||variant===1)?faces/3+extraIndex.length/3:-1;
  if(variant===1){
    var bookColors=[0x53797b,0x926154,0xc0a576,0x687b60,0xc3b39b,0x4c667e];
    var displayScale=width/13.5*side;
    [-4.2,0,4.2].forEach(function(bay,bi){
      // Continuous cabinet backs and shelves support every volume. Only the
      // pendant and upper arch retain the painted room behind the cabinet.
      add(box,bay*displayScale,1.99,-.57,3.02*Math.abs(displayScale),2.54,.08,0x72563d);
      [1.10,1.90,2.70].forEach(function(shelfY,row){
        add(box,bay*displayScale,shelfY-.032,-.37,3.02*Math.abs(displayScale),.064,.46,0x9d8058);
        for(var book=0;book<9;book++){
          var hash=(bi*7+row*11+book*3)%13;
          var bw=.24+(hash%3)*.020,bh=.47+(hash%5)*.050;
          var bx=(bay+(book-4)*.325)*displayScale;
          var bz=-.38+(hash%3)*.014;
          add(box,bx,shelfY+bh/2,bz,bw*Math.abs(displayScale),bh,.29,bookColors[hash%bookColors.length],0,(book===8?.045:0)*side);
          // A narrow warm title band gives the spine a readable highlight.
          add(box,bx,shelfY+bh*.75,bz+.149,bw*.55*Math.abs(displayScale),.012,.005,0xc5ad7e);
        }
      });
    });
  }
  if(variant===0){
    var loaf=new THREE.SphereGeometry(1,7,3),bakeryScale=width/13.5*side;
    [-4.55,-3.67,-2.78,-1.89,-1.0].forEach(function(bx,bi){
      [1.74,2.46].forEach(function(by,row){
        add(loaf,bx*bakeryScale,by,-.29,.27*Math.abs(bakeryScale),.13,.17,bi%2?0xbb8648:0xd3a567,0,.08*Math.sin(bi));
      });
    });
    loaf.dispose();
  }
  box.dispose();leaf.dispose();bloom.dispose();`);
kiez=change(kiez,'flowerBoxes:slots.length}',
  'flowerBoxes:slots.length,merchandiseStartTriangle:merchandiseStartTriangle,merchandiseEndTriangle:indices.length/3}');
}
// Curved smooth leaf normals and rounded bloom heads replace sharp diamonds.
fs.mkdirSync(path.join(stage,'sources'),{recursive:true});
fs.writeFileSync(path.join(stage,'sources/berlin_garden_integration.js'),garden);
fs.writeFileSync(path.join(stage,'sources/berlin_kiez_kit.js'),kiez);
const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n');
h=block(h,'  // BEGIN BLENDER GARDEN KIT','  // END BLENDER GARDEN KIT',
  read('models/berlin-kiez-garden-v1.inline.js')+'\n'+code('berlin_packed_geometry.js')+'\n'+trim(garden)+'\nvar berlinGardenKit = createBerlinGardenKit(THREE, mat, BERLIN_KIEZ_GARDEN_DATA);');
h=block(h,'  // BEGIN AUTHORED KIEZ KIT','  // END AUTHORED KIEZ KIT',trim(kiez));
// Small frontage setbacks break the ruler-straight street wall while keeping
// the focal opening, crossing aperture and all road clearances intact.
h=change(h,'bld.position.x = side * (streetCorner ? WALK_OUT + 0.1 : setbackBySide[side]);',
  'bld.position.x = side * (streetCorner ? WALK_OUT + 0.1 : setbackBySide[side] + (referenceBeat && b2 !== 2 ? (b2 === 1 ? 0.32 : 0.14) : 0));');
// The newly exposed bakery sightline clears the trunk at lateral chase views.
h=change(h,'treeZ = i === 0 ? -8 : i === 1 ? -2 : i === 2 ? 16 : 4;',
  'treeZ = i === 0 ? -8 : i === 1 ? -2 : i === 2 ? 15.3 : 4;');
// An offset desktop chase camera introduces the reference's parallax while
// preserving lane coordinates, input and portrait coverage.
h=change(h,'var camPos = new THREE.Vector3(0, 3.05 - initialCameraWide',
  'var camPos = new THREE.Vector3(-0.52 * initialCameraWide, 3.05 - initialCameraWide');
h=change(h,'camPos.set(0, 3.05 - startWide', 'camPos.set(-0.52 * startWide, 3.05 - startWide');
h=change(h,'bridgeReveal * 0.24 - routeCameraMix * 0.06;',
  'bridgeReveal * 0.24 - routeCameraMix * 0.06 - 0.52 * wideView;');
// Broader existing PCF kernel, with the same twelve comparison samples.
h=change(h,'sun.shadow.radius = 1.5;','sun.shadow.radius = 2.35;');
// Start highlight compression earlier, retaining a continuous shoulder and
// gently reducing chroma only in the very brightest surfaces.
h=change(h,"'  if (peak < 0.84) return c;'", "'  if (peak < 0.76) return c;'");
h=change(h,"'  float d = 1.0 - 0.84;'", "'  float d = 1.0 - 0.76;'");
h=change(h,"'  float np = 1.0 - d * d / (peak + d - 0.84);'", "'  float np = 1.0 - d * d / (peak + d - 0.76);'");
h=change(h,'grdSat: 1.09, grdVib: 0.04','grdSat: 1.045, grdVib: 0.025');
// Allow a little more source stone variation; retain the existing texture,
// resolution, normal-map sample count and seam treatment.
h=change(h,'var PAVING_SLAB_CALM = 0.40;','var PAVING_SLAB_CALM = 0.22;');
// A narrow polished running band seated in darker shoulders. All six tracks
// retain their shared material and geometry pool.
h=change(h,"[[0,'#a8a197'],[.10,'#a8a197'],[.13,'#655f5b'],[.24,'#655f5b'],\n     [.28,'#bdb6aa'],[.40,'#c8c1b5'],[.52,'#d6cfc2'],[.66,'#d6cfc2'],\n     [.80,'#c6bfb3'],[.90,'#b3aca0'],[.94,'#8a847c'],[1,'#9a948a']]",
  "[[0,'#77766f'],[.09,'#85837b'],[.14,'#4d5050'],[.31,'#4d5050'],\n     [.36,'#a5a59b'],[.43,'#c1c4b9'],[.50,'#dadace'],[.62,'#dadace'],\n     [.71,'#abaea4'],[.79,'#6b706c'],[.92,'#595e5c'],[1,'#686c67']]");
h=change(h,'MAT.streetRail.color.setRGB(1.06, 0.97, 0.84);',
  'MAT.streetRail.color.setRGB(1.05, 1.00, 0.92);');
// Warm russet canvas, with residual painted folds instead of a flat sleeve.
h=change(h,'shader.uniforms.courierSleeveColor = { value:new THREE.Color(0xc65a32) };',
  'shader.uniforms.courierSleeveColor = { value:new THREE.Color(0xb65334) };');
h=change(h,'clamp(courierLuma / 0.15, 0.92, 1.06)', 'clamp(courierLuma / 0.15, 0.78, 1.10)');
h=change(h,'diffuseColor.rgb = mix(diffuseColor.rgb, courierSleeveColor, courierSleeve);',
  'diffuseColor.rgb = mix(diffuseColor.rgb, courierCanvas, courierSleeve);');
h=change(h,'var bagTeal = heroTrimMat(0x2d7376, 0.91, 0.055);',
  'var bagTeal = heroTrimMat(0x367176, 0.83, 0.015);');
h=change(h,'var bagInk = heroTrimMat(0x244e54, 0.94, 0.045);',
  'var bagInk = heroTrimMat(0x244e54, 0.90, 0.012);');
h=change(h,"'kiez-reference-v126'","'kiez-reference-v127'");
assert.equal((h.match(/\bfunction decodeBerlinMeshRecord\s*\(/g)||[]).length,1);
fs.writeFileSync(path.join(stage,'candidate.html'),h);
console.log('V127 candidate and editable kit sources staged.');
if(process.argv.includes('--install')){
  assert.ok(!process.argv.includes('--shops'),'unaccepted shop trial cannot be installed');
  for(const suffix of ['.json','.inline.js','.blend','.glb','-atlas.jpg'])
    fs.copyFileSync(path.join(stage,'models/berlin-kiez-garden-v1'+suffix),path.join(root,'assets/models/berlin-kiez-garden-v1'+suffix));
  fs.writeFileSync(path.join(__dirname,'berlin_garden_integration.js'),garden);
  fs.writeFileSync(path.join(__dirname,'berlin_kiez_kit.js'),kiez);
  // Keep the reusable facade finisher identical to the actual embedded one.
  const fa=kiez.indexOf('function finishBerlinKiezFacade('),fb=kiez.indexOf('// Extend the single atlas material.',fa);
  fs.writeFileSync(path.join(__dirname,'berlin_facade_finish_v119.js'),kiez.slice(fa,fb)+
    "if (typeof module !== 'undefined') module.exports = {finishBerlinKiezFacade:finishBerlinKiezFacade};\n");
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);
  let sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
  sw=sw.replace(/artikel-blitz-v\d+/g,'artikel-blitz-v127');
  fs.writeFileSync(path.join(root,'sw.js'),sw);
  console.log('Installed V127 assets, sources, page and service-worker cache.');
}
