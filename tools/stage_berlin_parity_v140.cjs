'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v140');
for(const d of ['','frames'])fs.mkdirSync(path.join(stage,d),{recursive:true});
const baseline=path.join(stage,'baseline.html');if(!fs.existsSync(baseline))fs.copyFileSync(path.join(root,'berlin-runner.html'),baseline);
let h=fs.readFileSync(baseline,'utf8');
const edits=[
  ["          'vec3 courierSneaker = courierShoeColor * (0.80 + 0.20 * smoothstep(0.025, 0.60, courierLuma));',",
   "          // Bone weights locate the foot region; the existing atlas blue boundary\n          // separates denim from cream footwear at the actual ankle. The lower\n          // shoe remains solid even where the donor atlas contains dark marks.\n          'float courierShoe = smoothstep(0.08,0.45,vCourierGarment.w) * (1.0-smoothstep(1.28,1.64,courierSource.b/max(courierSource.r,0.001))*smoothstep(-0.7749,-0.7499,vCourierGarment.x));',\n          'vec3 courierSneaker = courierShoeColor * (0.80 + 0.20 * smoothstep(0.025, 0.60, courierLuma));',"],
  ['courierSneaker, vCourierGarment.w','courierSneaker, courierShoe'],
  ['max(courierSleeve,vCourierGarment.w)','max(courierSleeve,courierShoe)'],
  ['mix(roughnessFactor,0.78,vCourierGarment.w)','mix(roughnessFactor,0.78,courierShoe)'],
  ['new THREE.PointLight(0xc6cccf, 0.22, 18, 2)','new THREE.PointLight(0xc6cccf, 0.22, 8, 2)'],
  ["      if (typeof canvas !== 'undefined' && canvas.dataset) canvas.dataset.courierFinish = 'reference-outfit-v136';",
   `      // Matte woven cloth needs only a broad, restrained sheen. Coherent
      // fully-clothed regions skip GGX and the cubemap reflection fetch;
      // skin, hair, rubber, footwear and transition pixels keep native PBR.
      var courierPhysical=THREE.ShaderChunk.lights_physical_pars_fragment;
      var courierSpecular='reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometry.viewDir, geometry.normal, material );';
      courierPhysical=courierPhysical.replace(courierSpecular,
        'if (berlinCourierMatte < 0.99) { '+courierSpecular+' } else { reflectedLight.directSpecular += irradiance * (0.006 * RECIPROCAL_PI); }');
      courierPhysical=courierPhysical.replace('vec3 singleScattering = vec3( 0.0 );',
        'if (berlinCourierMatte >= 0.99) { reflectedLight.indirectDiffuse += material.diffuseColor * (irradiance * RECIPROCAL_PI) * 0.96; return; }\\nvec3 singleScattering = vec3( 0.0 );');
      var courierMaps=THREE.ShaderChunk.lights_fragment_maps.replace(
        'radiance += getIBLRadiance( geometry.viewDir, geometry.normal, material.roughness );',
        'if (berlinCourierMatte < 0.99) radiance += getIBLRadiance( geometry.viewDir, geometry.normal, material.roughness );');
      shader.fragmentShader=shader.fragmentShader
        .replace('#include <common>','#include <common>\\nfloat berlinCourierMatte;')
        .replace('diffuseColor.rgb *= vCourierFinish;', 'berlinCourierMatte = max(courierDenim,max(courierCloth,courierSleeve)*(1.0-courierForearm));\\ndiffuseColor.rgb *= vCourierFinish;')
        .replace('#include <lights_physical_pars_fragment>',courierPhysical)
        .replace('#include <lights_fragment_maps>',courierMaps);
      if (typeof canvas !== 'undefined' && canvas.dataset) canvas.dataset.courierFinish = 'reference-outfit-v136';`],
  [`    var bounceBlend = damp(10, dt);
    sampleRoutePoint(player.x, 0.65 + player.y * 0.12 + playerSurfaceY(player.z + 1.8), player.z + 1.8);
    bounceFollow.x += (routePointX - bounceFollow.x) * bounceBlend;
    bounceFollow.y += (routePointY - bounceFollow.y) * bounceBlend;
    bounceFollow.z += (routePointZ - bounceFollow.z) * bounceBlend;
    groundBounce.position.copy(bounceFollow);`,
   `    // Keep the bounce source at its authored route-relative offset. Easing
    // world positions makes it drift into the runner as forward speed rises.
    sampleRoutePoint(player.x, 0.65 + player.y * 0.12 + playerSurfaceY(player.z + 1.8), player.z + 1.8);
    bounceFollow.set(routePointX, routePointY, routePointZ);
    groundBounce.position.copy(bounceFollow);`],
  ["'reference-outfit-v136'","'reference-outfit-v140'"],
  ["'courierReferenceOutfitV136|'","'courierReferenceOutfitV140|'"],
  ["'kiez-reference-v139'","'kiez-reference-v140'"]
];
// The matte-cloth trial failed its measured frame-delivery gate. Retain it
// only as an explicit authoring option; the default keeps native cloth PBR.
if(!process.argv.includes('--matte-cloth'))edits.splice(edits.findIndex(([,after])=>after.includes('var courierPhysical=')),1);
for(const [before,after]of edits){assert.equal(h.split(before).length,2,before);h=h.replace(before,()=>after);}
fs.writeFileSync(path.join(stage,'candidate.html'),h);fs.writeFileSync(path.join(stage,'edits.json'),JSON.stringify(edits,null,2));
// Diagnostic only, never installed or used as a performance candidate.
const mode=process.argv.find(a=>a.startsWith('--diagnostic='))?.split('=')[1]||'denim-mask';
const expression=mode==='albedo'?'sqrt(diffuseColor.rgb)':mode==='diffuse'?'sqrt(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse)':'vec3(courierDenim)';
const diagnostic=mode==='bounce-off'?h.replace('groundBounce.intensity = daylight.bounceI','groundBounce.intensity = 0'):
  h.replace("        .replace('hrf * heroRimStrength',", "        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\\ngl_FragColor.rgb="+expression+";')\n        .replace('hrf * heroRimStrength',");
fs.writeFileSync(path.join(stage,'middle.html'),diagnostic);
console.log('Staged V140 texture-aware shoe/denim boundary; diagnostic '+mode+'.');
if(process.argv.includes('--install')){
  const crypto=require('crypto'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  const accepted=JSON.parse(fs.readFileSync(path.join(stage,'performance-accepted.json'),'utf8'));
  assert.equal(accepted.accepted,true);assert.equal(accepted.candidateSha256,sha(h));
  const current=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
  assert.ok(current===fs.readFileSync(baseline,'utf8')||current===h,'shipping page changed since staging');
  for(const file of ['material-check.json','bounce-check.json']){const result=JSON.parse(fs.readFileSync(path.join(stage,file),'utf8'));assert.equal(result.passed,true);assert.equal(result.candidateSha256,sha(h));}
  const cache=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert.match(cache,/artikel-blitz-v(?:139|140)/);
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);fs.writeFileSync(path.join(root,'sw.js'),cache.replace(/artikel-blitz-v(?:139|140)/g,'artikel-blitz-v140'));
  fs.writeFileSync(path.join(stage,'shipping.json'),JSON.stringify({pageSha256:sha(h),pageBytes:Buffer.byteLength(h),cacheRevision:'artikel-blitz-v140',unchangedAssets:true},null,2));
  console.log('Installed measured V140 material boundary and stable bounce light.');
}
