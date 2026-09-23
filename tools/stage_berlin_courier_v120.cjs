'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-courier-v120');
fs.mkdirSync(stage,{recursive:true});
let h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
function replace(a,b){assert.ok(h.includes(a),'source anchor '+a.slice(0,80));h=h.replace(a,b);}
const forms=fs.readFileSync(path.join(stage,'shoes/courier-forms-v114.inline.js'),'utf8');
const a=h.indexOf('  // BEGIN COURIER_FORMS_PATCH_V114'),b=h.indexOf('  // END COURIER_FORMS_PATCH_V114',a);
assert.ok(a>0&&b>a);h=h.slice(0,a)+forms.trimEnd()+h.slice(b+'  // END COURIER_FORMS_PATCH_V114'.length);
const bag=fs.readFileSync(path.join(stage,'bag/models/berlin-courier-bag-v1.inline.js'),'utf8');
const ba=h.indexOf('  // BEGIN BLENDER COURIER BAG'),bb=h.indexOf('  // END BLENDER COURIER BAG',ba);
assert.ok(ba>0&&bb>ba);h=h.slice(0,ba)+'  // BEGIN BLENDER COURIER BAG\n'+bag+h.slice(bb);
// Bake broad fold shade into one scalar per existing vertex, once at preload.
// The lighting travels with the skinned mesh and needs no new texture fetch.
replace('    applyBerlinCourierFormsPatchV114(geo);',`    applyBerlinCourierFormsPatchV114(geo);
    var finishShade=new Float32Array(pos.count);
    function foldBell(value,centre,width){return Math.exp(-Math.pow((value-centre)/width,2));}
    for(var v=0;v<pos.count;v++){
      var gx=garment[v*4],gy=garment[v*4+1],px=pos.getX(v),py=pos.getY(v);
      var body=(1-THREE.MathUtils.smoothstep(Math.abs(px),.17,.26))*
        THREE.MathUtils.smoothstep(gx,-.19,-.13)*(1-THREE.MathUtils.smoothstep(gx,.27,.38));
      var backFold=-.13*foldBell(gx+.18*Math.abs(px),-.068,.019)+.045*foldBell(gx+.18*Math.abs(px),-.038,.024);
      var elbowFold=-.09*foldBell(gy,.205,.026)+.035*foldBell(gy,.244,.022);
      var kneeFold=-.075*foldBell(py+.10*Math.abs(px),.425,.022)+.035*foldBell(py+.10*Math.abs(px),.455,.025);
      var denim=(1-THREE.MathUtils.smoothstep(py,.65,.73))*THREE.MathUtils.smoothstep(py,.25,.31);
      finishShade[v]=1+body*backFold+sleeve[v]*elbowFold+denim*kneeFold;
    }
    geo.setAttribute('aCourierFinish',new THREE.BufferAttribute(finishShade,1));`);
replace('new THREE.Color(0xa18560)','new THREE.Color(0x705b43)');
replace('new THREE.Color(0xc6ab83)','new THREE.Color(0x9b8564)');
replace('vCourierSole.y * 5.0','vCourierSole.y * 7.0');
replace('courierTread * 0.72','courierTread * 0.48');
replace('      shader.uniforms.courierHemColor =',"      shader.uniforms.courierShirtColor = { value:new THREE.Color(0xf0e3cf) };\n      shader.uniforms.courierHemColor =");
replace('varying vec4 vCourierGarment;\'','varying vec4 vCourierGarment;\\nattribute float aCourierFinish;\\nvarying float vCourierFinish;\'');
replace('vCourierGarment = aCourierGarment;\'','vCourierGarment = aCourierGarment;\\nvCourierFinish = aCourierFinish;\'');
replace("'uniform vec3 courierHemColor; uniform vec3 courierShoeColor;'","'uniform vec3 courierHemColor; uniform vec3 courierShoeColor; uniform vec3 courierShirtColor; varying float vCourierFinish;'");
replace("'diffuseColor.rgb = mix(diffuseColor.rgb, courierRubber, smoothstep(0.08, 0.70, vCourierSole.x));'",[
  "'diffuseColor.rgb = mix(diffuseColor.rgb, courierRubber, smoothstep(0.08, 0.70, vCourierSole.x));',",
  "          'diffuseColor.rgb *= vCourierFinish;',",
  "          'float courierShirt=courierCloth*smoothstep(-0.183,-0.178,vCourierGarment.x)*(1.0-smoothstep(-0.167,-0.161,vCourierGarment.x));',",
  "          'diffuseColor.rgb=mix(diffuseColor.rgb,courierShirtColor,courierShirt);'"
].join('\n'));
replace('var armOpen = 0.10 * completeRunWeight','var armOpen = 0.17 * completeRunWeight');
replace('roundedBox(bagRadius*0.24,bagRadius*0.72','roundedBox(bagRadius*0.31,bagRadius*0.72');
replace('roundedBox(bagRadius*0.17,bagRadius*0.10','roundedBox(bagRadius*0.21,bagRadius*0.10');
replace("'reference-outfit-v111'","'reference-outfit-v120'");
replace("'courierReferenceOutfitV111|'","'courierReferenceOutfitV120|'");
replace("'kiez-reference-v119'","'kiez-reference-v120'");
fs.writeFileSync(path.join(stage,'candidate.html'),h);
for(const s of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new (require('vm').Script)(s[1]);
console.log('Staged courier v120 with zero added vertices, triangles or draws.');
