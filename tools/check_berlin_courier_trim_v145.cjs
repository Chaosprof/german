'use strict';
const fs=require('fs'),assert=require('assert/strict'),path=require('path'),crypto=require('crypto');
const {T}=require('./load_berlin_courier_surface.cjs').loadCourierSurface('audit/berlin-parity-v145/candidate.html');
const stage=path.resolve(__dirname,'../audit/berlin-parity-v145'),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
function factory(page){
 const patch=page.slice(page.indexOf('  function heroShaderPatch('),page.indexOf('  var HERO_CAP_MAT ='));
 return new Function('mat','HERO_RIM_COLOR','HERO_FILL_STRENGTH',patch+'\nreturn heroTrimMat;')((color,opts)=>{
 const m=new T.MeshStandardMaterial({color,...opts});m.customProgramCacheKey=()=> 'unchangedPriorCelShader';
 m.onBeforeCompile=shader=>{shader.vertexShader+='\n// retained prior vertex shader';shader.fragmentShader+='\n// retained prior fragment shader';};return m;
 },new T.Color(0xffffff),.18);
}
const baseline=fs.readFileSync(path.join(stage,'baseline.html'),'utf8'),page=fs.readFileSync(path.join(stage,'candidate.html'),'utf8'),old=factory(baseline),next=factory(page);
const definitions=[[0x3f8b88,.90,.08],[0x243f43,.92,.06],[0xe7cfaa,.78,.20],[0x6eaaa0,.90,.06],[0x367176,.83,.015],[0x244e54,.90,.012],[0xb68b57,.88,.07]];
const oldKeys=new Set(),newKeys=new Set(),shaders=[];
for(const d of definitions){
 const a=old(...d),b=next(...d);oldKeys.add(a.customProgramCacheKey());newKeys.add(b.customProgramCacheKey());
 for(const prop of ['roughness','metalness','envMapIntensity','transparent','opacity','side','vertexColors','depthWrite'])assert.equal(a[prop],b[prop]);assert.deepEqual(a.color,b.color);
 const source=()=>({uniforms:T.UniformsUtils.clone(T.ShaderLib.standard.uniforms),vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader});
 const x=source(),y=source();a.onBeforeCompile(x);b.onBeforeCompile(y);
 assert.equal(x.vertexShader,y.vertexShader);assert.equal(x.fragmentShader,y.fragmentShader);assert.equal(x.uniforms.heroRimStrength.value,y.uniforms.heroRimStrength.value);assert.equal(y.uniforms.heroRimStrength.value,d[2]);
 for(const previous of shaders)assert.notEqual(previous.uniforms.heroRimStrength,y.uniforms.heroRimStrength,'rim uniforms belong to each material');
 shaders.push(y);
}
assert.equal(oldKeys.size,7);assert.equal(newKeys.size,1);for(const shader of shaders){assert.equal(shader.vertexShader,shaders[0].vertexShader);assert.equal(shader.fragmentShader,shaders[0].fragmentShader);}
const report={passed:true,candidateSha256:sha(page),materials:definitions.length,oldCustomKeys:oldKeys.size,newCustomKeys:newKeys.size,materialPropertiesExact:true,shaderSourceExact:true,independentRimUniforms:true,note:'Textured canvas still has a separate standard program variant; only redundant color-based custom keys are consolidated.'};
fs.writeFileSync(path.join(stage,'trim-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
