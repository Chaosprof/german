'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v133');
fs.mkdirSync(stage,{recursive:true});
if(!fs.existsSync(path.join(stage,'baseline.html')))fs.copyFileSync(path.join(root,'berlin-runner.html'),path.join(stage,'baseline.html'));
let h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
function change(a,b){assert.equal(h.split(a).length,2,a);h=h.replace(a,()=>b);}
change("      shader.uniforms.courierSkinColor = { value:new THREE.Color(0xe5ab84) };", "      shader.uniforms.courierSkinColor = { value:new THREE.Color(0xe5ab84) };\n      shader.uniforms.courierDenimColor = { value:new THREE.Color(0x3e5864) };");
change("'uniform vec3 courierHairColor; uniform vec3 courierSkinColor; varying vec4 vCourierGarment;'", "'uniform vec3 courierHairColor; uniform vec3 courierSkinColor; uniform vec3 courierDenimColor; varying vec4 vCourierGarment;'");
change("          'diffuseColor.rgb *= vCourierFinish;',", `          // Bind-space distances and existing limb masks keep denim on the
          // trousers through every pose. Preserve seams and dark folds while
          // reducing the donor texture's broad silver highlights.
          'float courierDenim=(1.0-max(courierSleeve,vCourierGarment.w))*(1.0-courierCloth)*(1.0-smoothstep(-0.25,-0.18,vCourierGarment.x));',
          'vec3 courierDenimPaint=courierDenimColor*clamp(courierLuma/0.16,0.68,1.30);',
          'diffuseColor.rgb=mix(diffuseColor.rgb,courierDenimPaint,courierDenim*0.68);',
          'diffuseColor.rgb *= vCourierFinish;',`);
change("          'roughnessFactor=mix(roughnessFactor,0.91,max(courierCloth,courierSleeve));',", "          'roughnessFactor=mix(roughnessFactor,0.92,courierDenim);',\n          'roughnessFactor=mix(roughnessFactor,0.91,max(courierCloth,courierSleeve));',");
change("        ].join('\\n'));\n      if (typeof canvas !== 'undefined' && canvas.dataset) canvas.dataset.courierFinish", "        ].join('\\n'))\n        .replace('hrf * heroRimStrength', 'hrf * heroRimStrength * (1.0 - courierDenim * 0.65)');\n      if (typeof canvas !== 'undefined' && canvas.dataset) canvas.dataset.courierFinish");
change("'courierReferenceOutfitV130|'", "'courierReferenceOutfitV133|'");
change("'reference-outfit-v130'", "'reference-outfit-v133'");
change("'kiez-reference-v132'", "'kiez-reference-v133'");
fs.writeFileSync(path.join(stage,'candidate.html'),h);console.log('Staged V133 matte denim finish.');
if(process.argv.includes('--install')){
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);
  fs.writeFileSync(path.join(root,'sw.js'),fs.readFileSync(path.join(root,'sw.js'),'utf8').replace(/artikel-blitz-v\d+/g,'artikel-blitz-v133'));
  console.log('Installed V133 page and cache revision.');
}
