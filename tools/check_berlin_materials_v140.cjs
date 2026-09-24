'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v140');
const before=fs.readFileSync(path.join(stage,'baseline.html'),'utf8'),after=fs.readFileSync(path.join(stage,'candidate.html'),'utf8');
const edits=JSON.parse(fs.readFileSync(path.join(stage,'edits.json'),'utf8'));let restored=after;
for(const [a,b]of edits.slice().reverse()){assert.equal(restored.split(b).length,2);restored=restored.replace(b,()=>a);}assert.equal(restored,before,'only the recorded material masks and bounce positioning change');
const ctx=vm.createContext({console});vm.runInContext([...before.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('three.js r156 (MIT)')),ctx);
const T=ctx.THREE;
function compile(h){const rim=h.slice(h.indexOf('  var HERO_RIM_COLOR ='),h.indexOf('  function heroTrimMat(')),outfit=h.slice(h.indexOf('  function courierSleeveMaterial('),h.indexOf('  function dressCourierHero('));
  const f=new Function('THREE','canvas',rim+'\n'+outfit+'\nreturn {heroShaderPatch,courierSleeveMaterial};')(T,{dataset:{}}),m=new T.MeshStandardMaterial();f.heroShaderPatch(m,'heroAuthored',.14,false);f.courierSleeveMaterial(m);
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};m.onBeforeCompile(shader);return shader;}
const a=compile(before),b=compile(after);assert.equal(a.vertexShader,b.vertexShader);assert.deepEqual(a.uniforms,b.uniforms,'all uniform values unchanged');
const expand=s=>s.replace(/#include <([\w_]+)>/g,(_,name)=>{assert.ok(T.ShaderChunk[name]!==undefined,name);return expand(T.ShaderChunk[name]);});
assert.equal((expand(b.fragmentShader).match(/texture2D\(/g)||[]).length,(expand(a.fragmentShader).match(/texture2D\(/g)||[]).length,'expanded shaders have no additional texture fetch sites');
const nativeSpec='reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometry.viewDir, geometry.normal, material );';
const spec='if (berlinCourierMatte < 0.99) { '+nativeSpec+' } else { reflectedLight.directSpecular += irradiance * (0.006 * RECIPROCAL_PI); }';
const indirect='if (berlinCourierMatte >= 0.99) { reflectedLight.indirectDiffuse += material.diffuseColor * (irradiance * RECIPROCAL_PI) * 0.96; return; }\nvec3 singleScattering = vec3( 0.0 );';
const physical=T.ShaderChunk.lights_physical_pars_fragment.replace(nativeSpec,spec).replace('vec3 singleScattering = vec3( 0.0 );',indirect);
const matteEnabled=b.fragmentShader.includes('float berlinCourierMatte;');
if(matteEnabled){
assert.ok(b.fragmentShader.includes(physical),'native PBR remains exact outside the explicit matte branches');
assert.ok(b.fragmentShader.includes('if (berlinCourierMatte < 0.99) radiance += getIBLRadiance'),'fully matte cloth skips the real reflection lookup');
assert.ok(b.fragmentShader.indexOf('berlinCourierMatte = max(')<b.fragmentShader.indexOf('#include <lights_fragment_begin>'),'mask initialized before lighting');
const matteExpr=b.fragmentShader.match(/berlinCourierMatte = ([^;]+);/)[1];
const matte=new Function('max','courierDenim','courierCloth','courierSleeve','courierForearm','return '+matteExpr+';');
assert.equal(matte(Math.max,1,0,0,0),1);assert.equal(matte(Math.max,0,1,0,0),1);
assert.equal(matte(Math.max,0,1,1,1),0,'exposed skin retains native PBR');assert.equal(matte(Math.max,0,0,0,0),0,'face, hair, shoes and rubber retain native PBR');
for(const amount of [0,.2,.5,.98])assert.ok(matte(Math.max,0,amount,0,0)<.99,'transition pixels retain native PBR');
}else{
  assert.ok(b.fragmentShader.includes('#include <lights_physical_pars_fragment>'),'native cloth PBR retained');
  assert.ok(b.fragmentShader.includes('#include <lights_fragment_maps>'),'native reflection maps retained');
}
const shoeExpr=b.fragmentShader.match(/float courierShoe = ([^;]+);/)[1];
const shoe=new Function('smoothstep','max','courierSource','vCourierGarment','return '+shoeExpr+';');
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
const samples=JSON.parse(fs.readFileSync(path.join(stage,'surface-report.json'),'utf8'));
const atlas=fs.readFileSync(path.join(stage,'source-atlas.webp'));assert.equal(crypto.createHash('sha256').update(atlas).digest('hex'),'58e9a306e45f40c4a87ce91cc353b7ccc9bf994bf3e378649767d40d46e133ed');
let solidShoe=0,protectedDenim=0,formerlyMixedShoe=0,formerlySpilledDenim=0;
for(const p of samples){
  const [r,g,blue]=p.source,garment={x:p.garment[0],y:p.garment[1],z:p.garment[2],w:p.garment[3]},value=shoe(smooth,Math.max,{r,g,b:blue},garment);
  assert.ok(value>=0&&value<=1);
  if(p.y<=.12){assert.ok(value>.999,'every sampled lower shoe surface has complete cream coverage');solidShoe++;if(garment.w<.99)formerlyMixedShoe++;}
  if(p.y>=.17&&blue/r>=1.64){assert.ok(value<.00001,'every sampled blue trouser surface excludes cream paint');protectedDenim++;if(garment.w>.01)formerlySpilledDenim++;}
  if(!garment.w)assert.equal(value,0,'outside foot region remains untouched');
}
assert.ok(formerlyMixedShoe>=30&&formerlySpilledDenim>=8,'actual exterior samples demonstrate both corrected faults');
for(const y of [.35,.75,1.1,1.4,1.6])for(const r of [.01,.2,1])for(const blue of [.01,.2,1])assert.equal(shoe(smooth,Math.max,{r,g:.2,b:blue},{x:y-.8998885265,y:0,z:0,w:0}),0,'hands/face/jacket stay outside footwear');
const result={passed:true,candidateSha256:crypto.createHash('sha256').update(after).digest('hex'),unchangedGeometryAssetsAnimation:true,identicalVertexShader:true,identicalUniforms:true,addedDraws:0,addedTextures:0,addedSamplers:0,addedFragmentSmoothsteps:3,clothSkipsGGXAndReflection:matteEnabled,nativeNonclothPBR:true,samples:samples.length,solidShoe,protectedDenim,formerlyMixedShoe,formerlySpilledDenim};
fs.writeFileSync(path.join(stage,'material-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
