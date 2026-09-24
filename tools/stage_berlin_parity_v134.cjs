'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v134');
let h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
const archPattern=/var BERLIN_REFERENCE_ARCHITECTURE = (\{[^\r\n]*\});/;
const fullArchitecture=JSON.parse(h.match(archPattern)[1]);
const runtimeArchitecture=require('./install_reference_architecture.cjs').packReferenceArchitecture(fullArchitecture);
const runtimeArchitectureInline='var BERLIN_REFERENCE_ARCHITECTURE = '+JSON.stringify(runtimeArchitecture)+';\n';
h=h.replace(archPattern,()=>runtimeArchitectureInline.trim());
fs.mkdirSync(path.join(stage,'models'),{recursive:true});
fs.writeFileSync(path.join(stage,'models/berlin-reference-architecture-runtime.inline.js'),runtimeArchitectureInline);
const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();
const gardenBefore=fs.readFileSync(path.join(stage,'baseline/berlin_garden_integration.js'),'utf8');
let garden=gardenBefore;
const finishMarker="      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',leafMap);";
assert.equal(garden.split(finishMarker).length,2);
garden=garden.replace(finishMarker,()=>`      // The authored leaf sheen supplies the broad waxy response. Fully green
      // foliage is matte here; keep native PBR on bark, pots and flowers.
      // A coherent per-leaf branch avoids GGX and its cube-UV reflection read.
      source=[
        'float berlinLeafMatte() {',
        '#ifdef USE_COLOR',
        '  return smoothstep(0.005,0.055,vColor.g-vColor.r)*smoothstep(0.015,0.07,vColor.g-vColor.b);',
        '#else',
        '  return 0.0;',
        '#endif',
        '}',source
      ].join('\\n');
      var directSpecular='reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometry.viewDir, geometry.normal, material );';
      source=source.replace(directSpecular,'if (berlinLeafMatte() < 0.99) { '+directSpecular+' }');
      source=source.replace('vec3 singleScattering = vec3( 0.0 );',[
        'if (berlinLeafMatte() >= 0.99) {',
        '  reflectedLight.indirectDiffuse += material.diffuseColor * (irradiance * RECIPROCAL_PI) * 0.96;',
        '  return;',
        '}',
        'vec3 singleScattering = vec3( 0.0 );'
      ].join('\\n'));
      var indirectMaps=THREE.ShaderChunk.lights_fragment_maps.replace(
        'radiance += getIBLRadiance( geometry.viewDir, geometry.normal, material.roughness );',
        'if (berlinLeafMatte() < 0.99) radiance += getIBLRadiance( geometry.viewDir, geometry.normal, material.roughness );');
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_maps>',indirectMaps);
${finishMarker}`);
garden=garden.replace('garden-leaf-light-v129','garden-leaf-light-v134');
assert.ok(h.includes(trim(gardenBefore)));h=h.replace(trim(gardenBefore),()=>trim(garden));
fs.mkdirSync(path.join(stage,'sources'),{recursive:true});fs.writeFileSync(path.join(stage,'sources/berlin_garden_integration.js'),garden);
const inline=fs.readFileSync(path.join(stage,'models/berlin-kiez-garden-v1.inline.js'),'utf8').match(/var BERLIN_KIEZ_GARDEN_DATA = \{[^\r\n]*\};/)[0];
assert.ok(/var BERLIN_KIEZ_GARDEN_DATA = \{[^\r\n]*\};/.test(h));
h=h.replace(/var BERLIN_KIEZ_GARDEN_DATA = \{[^\r\n]*\};/,()=>inline);
assert.ok(h.includes("'kiez-reference-v133'"));h=h.replace("'kiez-reference-v133'","'kiez-reference-v134'");
fs.writeFileSync(path.join(stage,'candidate.html'),h);console.log('Staged V134 irregular shoot foliage.');
if(process.argv.includes('--install')){
  assert.ok(fs.existsSync(path.join(stage,'performance-accepted.json')),'Candidate needs measured performance acceptance before shipping.');
  const accepted=JSON.parse(fs.readFileSync(path.join(stage,'performance-accepted.json'),'utf8'));
  const sha=b=>require('crypto').createHash('sha256').update(b).digest('hex');
  assert.equal(accepted.accepted,true);assert.equal(accepted.candidateSha256,sha(h),'only the measured candidate can ship');
  for(const [suffix,digest] of Object.entries(accepted.assets))assert.equal(sha(fs.readFileSync(path.join(stage,'models/berlin-kiez-garden-v1'+suffix))),digest,'measured asset '+suffix);
  for(const suffix of ['.json','.inline.js','.blend','.glb','-atlas.jpg'])fs.copyFileSync(path.join(stage,'models/berlin-kiez-garden-v1'+suffix),path.join(root,'assets/models/berlin-kiez-garden-v1'+suffix));
  fs.writeFileSync(path.join(root,'tools/berlin_garden_integration.js'),garden);
  fs.copyFileSync(path.join(stage,'models/berlin-reference-architecture-runtime.inline.js'),path.join(root,'assets/models/berlin-reference-architecture-runtime.inline.js'));
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);
  fs.writeFileSync(path.join(root,'sw.js'),fs.readFileSync(path.join(root,'sw.js'),'utf8').replace(/artikel-blitz-v\d+/g,'artikel-blitz-v134'));
  console.log('Installed V134 page, garden assets and cache revision.');
}
