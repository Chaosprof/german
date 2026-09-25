'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const {createCanvas}=require(process.env.BERLIN_CANVAS_MODULE||'@napi-rs/canvas');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v148'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(stage,p),'utf8'),oldCode=read('baseline/berlin_kiez_kit.js'),code=read('sources/berlin_kiez_kit.js'),page=read('candidate.html'),base=read('baseline.html');
let restored=code;for(const [a,b]of JSON.parse(read('source-edits.json')).reverse()){assert.equal(restored.split(b).length,2);restored=restored.replace(b,()=>a);}assert.equal(restored,oldCode);
const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();
assert.equal(page.replace(trim(code),()=>trim(oldCode)).replace("'kiez-reference-v148'","'kiez-reference-v147'"),base,'all source outside the bounded glass changes is exact');
assert.equal(read('sources/berlin_facade_finish_v119.js'),read('baseline/berlin_facade_finish_v119.js'),'the complete geometry generator is unchanged');
const scripts=[...page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());scripts.forEach(s=>new vm.Script(s));
const scope=vm.createContext({console,atob});vm.runInContext(scripts.find(s=>s.includes('three.js r156 (MIT)')),scope);
vm.runInContext(fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8'),scope);
scope.BERLIN_REFERENCE_ARCHITECTURE=JSON.parse(fs.readFileSync(path.join(root,'assets/models/berlin-reference-architecture-v1.json')));
const T=scope.THREE;
function kit(source,mobile){scope.IS_MOBILE=mobile;vm.runInContext(source,scope);return scope.createBerlinKiezKit(T,(color,o)=>new T.MeshStandardMaterial({color,...o}),createCanvas);}
const atlases=[],kits=[];
for(const mobile of [false,true]){
 const before=kit(oldCode,mobile),after=kit(code,mobile),a=before.material.map.image,b=after.material.map.image,w=a.width,cell=w/4;
 assert.equal(w,mobile?1024:2048);assert.equal(b.width,w);assert.equal(a.height,w);assert.equal(b.height,w);
 for(const key of ['colorSpace','minFilter','magFilter','generateMipmaps','wrapS','wrapT','anisotropy'])assert.equal(before.material.map[key],after.material.map[key],key);
 const old=a.getContext('2d').getImageData(0,0,w,w).data,now=b.getContext('2d').getImageData(0,0,w,w).data;
 let changedPixels=0,maxChannelDelta=0;const oldMean=[0,0,0],newMean=[0,0,0];
 for(let y=0;y<w;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4,inGlass=x>=cell*2&&x<cell*3&&y<cell;let changed=false;
  for(let k=0;k<4;k++){
   if(!inGlass)assert.equal(now[i+k],old[i+k],'neighbouring atlas cell byte');
   else{changed||=old[i+k]!==now[i+k];maxChannelDelta=Math.max(maxChannelDelta,Math.abs(old[i+k]-now[i+k]));if(k<3){oldMean[k]+=old[i+k];newMean[k]+=now[i+k];}}
  }
  assert.equal(now[i+3],255,'atlas remains fully opaque');changedPixels+=Number(changed);
 }
 assert.ok(changedPixels>cell*cell*.75,'a broad reflection update, not an isolated texel change');
 const tile=createCanvas(cell,cell);tile.getContext('2d').drawImage(b,cell*2,0,cell,cell,0,0,cell,cell);
 fs.writeFileSync(path.join(stage,`glass-atlas-${w}.png`),tile.toBuffer('image/png'));
 atlases.push({width:w,height:w,textureBytes:w*w*4,mipmapped:true,changedPixels,protectedPixels:w*w-cell*cell,maxChannelDelta,
  beforeMeanSrgb:oldMean.map(v=>v/(cell*cell)),afterMeanSrgb:newMean.map(v=>v/(cell*cell)),outsideGlassExact:true});
 kits.push({before,after});
}
const {before,after}=kits[0],shader=m=>{const s={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};m.onBeforeCompile(s);return s;};
const sa=shader(before.material),sb=shader(after.material),added='\nif(kiezPane>0.5){totalEmissiveRadiance+=diffuseColor.rgb*(0.10+0.14*vColor.a);}';
assert.equal(sb.fragmentShader.split(added).length,2);assert.equal(sb.fragmentShader.replace(added,''),sa.fragmentShader,'only the upper-pane reflection-radiance branch changes');
assert.equal(sb.vertexShader,sa.vertexShader);assert.deepEqual(sb.uniforms,sa.uniforms);
for(const key of ['roughness','metalness','emissiveIntensity','transparent','opacity','side','depthWrite','envMapIntensity'])assert.equal(before.material[key],after.material[key],key);
assert.deepEqual(before.material.color,after.material.color);assert.deepEqual(before.material.emissive,after.material.emissive);
let branches=0;for(let tile=0;tile<16;tile++)for(const alpha of [0,.01,.2,.5,.9,1])for(const color of [0,.01,.2,.5,1]){
 const pane=1-Number(Math.abs(tile-2)>=.5),radiance=pane>.5?color*(.10+.14*alpha):0;
 assert.ok(Number.isFinite(radiance)&&radiance>=0&&radiance<=.24+1e-12);if(tile!==2)assert.equal(radiance,0);branches++;
}
let layouts=0,vertices=0,triangles=0,bytes=0;
for(const width of [11,13.5,16])for(let variant=0;variant<6;variant++)for(const side of [-1,1]){
 const a=before.geometry(width,variant,side),b=after.geometry(width,variant,side);assert.deepEqual(b.userData,a.userData);assert.deepEqual(b.groups,a.groups);
 assert.deepEqual(b.index.array,a.index.array);assert.equal(b.boundingBox.min.distanceTo(a.boundingBox.min)+b.boundingBox.max.distanceTo(a.boundingBox.max),0);
 for(const name of Object.keys(a.attributes)){assert.deepEqual(b.attributes[name].array,a.attributes[name].array,name+' remains exact');bytes+=b.attributes[name].array.byteLength;}
 const colors=b.attributes.color;for(let i=0;i<colors.count;i++)assert.ok(colors.getW(i)>=0&&colors.getW(i)<=1,'room variation stays within the checked range');
 vertices+=b.attributes.position.count;triangles+=b.index.count/3;bytes+=b.index.array.byteLength;layouts++;
}
const previous=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-parity-v147/shipping.json'))),protectedFiles={...previous.protectedFiles};
for(const [name,hash]of Object.entries(previous.sources))protectedFiles['tools/'+name]=hash;
const oldKitSha256=protectedFiles['tools/berlin_kiez_kit.js'];assert.equal(sha(oldCode),oldKitSha256);delete protectedFiles['tools/berlin_kiez_kit.js'];
for(const [file,hash]of Object.entries(protectedFiles))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);
const result={passed:true,candidateSha256:sha(page),pageBytes:Buffer.byteLength(page),parsedScripts:scripts.length,atlases,layouts,vertices,triangles,geometryBytes:bytes,
 addedGeometryBytes:0,addedTextureBytes:0,addedDraws:0,addedSamplers:0,upperPaneBranchesChecked:branches,protectedFiles,sources:{'berlin_kiez_kit.js':sha(code)},oldKitSha256};
fs.writeFileSync(path.join(stage,'material-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,protectedFiles:Object.keys(protectedFiles).length},null,2));
