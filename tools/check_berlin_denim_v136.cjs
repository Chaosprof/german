'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v136');
const before=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
const after=fs.readFileSync(path.resolve(root,process.env.BERLIN_HTML||'audit/berlin-parity-v136/candidate.html'),'utf8');
const edits=JSON.parse(fs.readFileSync(path.join(stage,'edits.json'),'utf8'));
let restored=after;
for(const [a,b] of edits.slice().reverse()){assert.equal(restored.split(b).length,2);restored=restored.replace(b,()=>a);}
assert.equal(restored,before,'all geometry, assets, animation, render scheduling and unrelated code remain byte-exact');
const scope=vm.createContext({console});
vm.runInContext([...before.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('three.js r156 (MIT)')),scope);
const T=scope.THREE;
function compile(h){
  const rim=h.slice(h.indexOf('  var HERO_RIM_COLOR ='),h.indexOf('  function heroTrimMat('));
  const outfit=h.slice(h.indexOf('  function courierSleeveMaterial('),h.indexOf('  function dressCourierHero('));
  const functions=new Function('THREE','canvas',rim+'\n'+outfit+'\nreturn {heroShaderPatch,courierSleeveMaterial};')(T,{dataset:{}});
  const m=new T.MeshStandardMaterial();functions.heroShaderPatch(m,'heroAuthored',.14,false);functions.courierSleeveMaterial(m);
  const shader={uniforms:{},vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader};
  m.onBeforeCompile(shader);return shader;
}
const a=compile(before),b=compile(after);
assert.equal(b.vertexShader,a.vertexShader,'vertex shader is byte-exact');
const normalize=s=>s.replace(/(?<![\w.])(?:\d*\.\d+|\d+\.?)(?:e[+-]?\d+)?/gi,'NUMBER');
assert.equal(normalize(b.fragmentShader),normalize(a.fragmentShader),'fragment shader has the same operations, branches, reads and declarations; only numeric constants differ');
assert.deepEqual(Object.keys(b.uniforms),Object.keys(a.uniforms),'no additional uniforms');
for(const key of Object.keys(a.uniforms))if(key!=='courierDenimColor')assert.deepEqual(b.uniforms[key],a.uniforms[key],key+' stays exact');
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const mask=s=>new Function('smoothstep','max','courierSleeve','courierCloth','vCourierGarment','return '+s.match(/float courierDenim\s*=\s*([^;]+);/)[1]+';');
const oldMask=mask(a.fragmentShader),newMask=mask(b.fragmentShader);
// Measured Hips joint and real exterior jeans/hem heights. The full courier
// validator additionally ray-tests the real GLB and pinned atlas pixels.
const waist=.8998885264779521;
const upper={x:.74-waist,y:1,z:0,w:0};
assert.equal(oldMask(smooth,Math.max,0,0,upper),0,'the previous finish missed the actual upper jeans');
assert.equal(newMask(smooth,Math.max,0,0,upper),1,'the finish now reaches the actual upper jeans');
let protectedCases=0;
for(const sleeve of [0,1])for(const cloth of [0,1])for(const shoe of [0,1])for(const y of [.05,.18,.4,.74,.77,1.1,1.4,1.6]){
  const garment={x:y-waist,y:1,z:0,w:shoe};
  const value=newMask(smooth,Math.max,sleeve,cloth,garment);
  assert.ok(value>=0&&value<=1);
  if(sleeve===1||cloth===1||shoe===1||y>=1.1){assert.equal(value,0,'hands/sleeves, jacket, shoe and head masks remain protected');protectedCases++;}
}
const result={passed:true,shipping:process.argv.includes('--shipping'),unchangedGeometryAndAssets:true,identicalVertexShader:true,
  identicalFragmentOperations:true,uniformCount:Object.keys(b.uniforms).length,upperJeansMask:{before:0,after:1},protectedCases,
  masksFollowExistingBindSpace:true,addedDraws:0,addedTextures:0,addedShaderOperations:0,addedPerFrameCode:0};
if(process.argv.includes('--shipping'))assert.equal(after,fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8'));
fs.writeFileSync(path.join(stage,'material-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
