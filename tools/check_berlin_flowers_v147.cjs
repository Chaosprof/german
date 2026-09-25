'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v147'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(stage,p),'utf8'),oldCode=read('baseline/berlin_kiez_kit.js'),code=read('sources/berlin_kiez_kit.js');
const page=read('candidate.html'),base=read('baseline.html'),trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();
let restored=code;for(const [a,b]of JSON.parse(read('source-edits.json')).reverse()){assert.equal(restored.split(b).length,2);restored=restored.replace(b,()=>a);}assert.equal(restored,oldCode);
assert.equal(page.replace(trim(code),()=>trim(oldCode)).replace("'kiez-reference-v147'","'kiez-reference-v146'"),base,'only the bounded facade-flower generator changes');
const begin=code.indexOf('function finishBerlinKiezFacade('),end=code.indexOf('// Extend the single atlas material.',begin);
assert.equal(read('sources/berlin_facade_finish_v119.js'),code.slice(begin,end)+"if (typeof module !== 'undefined') module.exports = {finishBerlinKiezFacade:finishBerlinKiezFacade};\n");
const scripts=[...page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());scripts.forEach(s=>new vm.Script(s));
const scope=vm.createContext({console,atob});vm.runInContext(scripts.find(s=>s.includes('three.js r156 (MIT)')),scope);
vm.runInContext(fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8'),scope);
scope.BERLIN_REFERENCE_ARCHITECTURE=JSON.parse(fs.readFileSync(path.join(root,'assets/models/berlin-reference-architecture-v1.json')));
const T=scope.THREE,noop=()=>{},canvas=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
function make(source){vm.runInContext(source,scope);return scope.createBerlinKiezKit(T,(color,o)=>new T.MeshStandardMaterial({color,...o}),()=>({getContext:()=>canvas}));}
const before=make(oldCode),after=make(code);
const shader=m=>{const s={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};m.onBeforeCompile(s);return s;};
assert.deepEqual(shader(before.material),shader(after.material),'no shader change, uniforms or sampler additions');
const vec=(g,i,name='position')=>new T.Vector3().fromBufferAttribute(g.attributes[name],i);
function sameFaces(a,b,firstA,firstB,count){
 for(let f=0;f<count*3;f++)for(const name of Object.keys(a.attributes)){
  const x=a.index.getX(firstA*3+f),y=b.index.getX(firstB*3+f),aa=a.attributes[name],bb=b.attributes[name];
  for(let k=0;k<aa.itemSize;k++)assert.equal(bb.array[y*bb.itemSize+k],aa.array[x*aa.itemSize+k],'protected '+name+' triangle corner');
 }
}
function closedSurface(g,first,count){
 const edges=new Map(),points=new Set(),centre=new T.Vector3();let volume=0,minFacing=1;
 const ids=new Set();for(let f=first*3;f<(first+count)*3;f++)ids.add(g.index.getX(f));
 for(const id of ids)centre.add(vec(g,id));centre.divideScalar(ids.size);
 for(let f=first;f<first+count;f++){
  const indices=[0,1,2].map(k=>g.index.getX(f*3+k)),p=indices.map(i=>vec(g,i)),n=indices.map(i=>vec(g,i,'normal'));
  const face=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])),shade=n[0].clone().add(n[1]).add(n[2]);
  assert.ok(face.length()>1e-10,'nondegenerate plant face');
  minFacing=Math.min(minFacing,face.clone().normalize().dot(shade.normalize()));
  volume+=p[0].clone().sub(centre).dot(p[1].clone().sub(centre).cross(p[2].clone().sub(centre)))/6;
  for(let k=0;k<3;k++){
   assert.ok(Math.abs(n[k].length()-1)<.0001,'unit plant normal');
   const a=p[k].toArray().map(v=>Math.round(v*1e6)).join(','),b=p[(k+1)%3].toArray().map(v=>Math.round(v*1e6)).join(',');points.add(a);
   const key=[a,b].sort().join('|'),edge=edges.get(key)||{count:0,dir:0};edge.count++;edge.dir+=a<b?1:-1;edges.set(key,edge);
  }
 }
 assert.ok(volume>0&&minFacing>.1,'positive volume and outward shading');
 assert.ok([...edges.values()].every(e=>e.count===2&&e.dir===0),'closed plant, with two oppositely directed faces per welded edge');
 return{volume,minFacing,points:points.size};
}
const layouts=[];let protectedTriangles=0,leaves=0,blooms=0,minFacing=1,bytesAdded=0,bookRays=0;
for(const width of [11,13.5,16])for(let variant=0;variant<6;variant++)for(const side of [-1,1]){
 const a=before.geometry(width,variant,side),b=after.geometry(width,variant,side),boxes=a.userData.flowerBoxes,baseFaces=a.userData.finishBaseTriangles;
 assert.equal(b.userData.flowerBoxes,boxes);assert.equal(b.userData.flowerHeads,boxes*21);assert.equal(b.userData.flowerClusterRevision,147);
 assert.equal(b.userData.finishBaseTriangles,baseFaces);assert.equal(b.userData.finishBaseVertices,a.userData.finishBaseVertices);
 assert.equal(b.index.count/3-a.index.count/3,boxes*(956-288),'explicit additional flower geometry budget');
 assert.equal(b.groups.length,a.groups.length);assert.deepEqual(b.groups.map(g=>g.materialIndex),a.groups.map(g=>g.materialIndex));
 assert.ok(b.boundingBox.min.distanceTo(a.boundingBox.min)<1e-5&&b.boundingBox.max.distanceTo(a.boundingBox.max)<1e-5,'same whole-building bounds');
 sameFaces(a,b,0,0,baseFaces);protectedTriangles+=baseFaces;
 for(let box=0;box<boxes;box++){
  const startA=baseFaces+box*288,startB=baseFaces+box*956;
  sameFaces(a,b,startA,startB,24);protectedTriangles+=24;
  for(let leaf=0;leaf<32;leaf++){
   const first=startB+(leaf<24?24+leaf*16:24+24*16+21*20+(leaf-24)*16),v=closedSurface(b,first,16);
   assert.equal(v.points,10);minFacing=Math.min(minFacing,v.minFacing);leaves++;
  }
  for(let bloom=0;bloom<21;bloom++){
   const v=closedSurface(b,startB+24+24*16+bloom*20,20);assert.equal(v.points,12);minFacing=Math.min(minFacing,v.minFacing);blooms++;
  }
 }
 const tail=a.index.count/3-baseFaces-boxes*288;sameFaces(a,b,baseFaces+boxes*288,baseFaces+boxes*956,tail);protectedTriangles+=tail;
 if(variant===1){
  const range=b.userData.displayBookFaces,mesh=new T.Mesh(b,after.material);mesh.updateMatrixWorld();
  for(const bay of [-4.2,0,4.2])for(const offset of [-.82,.82]){
   const hit=new T.Raycaster(new T.Vector3((bay+offset)*width/13.5*side,1.345,4),new T.Vector3(0,0,-1)).intersectObject(mesh)[0];
   assert.ok(hit&&hit.faceIndex>=range[0]&&hit.faceIndex<range[1],'existing counter-top display books remain visible');bookRays++;
  }
 }
 const bytes=g=>g.index.array.byteLength+Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0),delta=bytes(b)-bytes(a);bytesAdded+=delta;
 layouts.push({width,variant,side,boxes,beforeTriangles:a.index.count/3,afterTriangles:b.index.count/3,addedVertexBytes:delta});
}
const previous=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-parity-v146/shipping.json'))),protectedFiles={...previous.protectedFiles};
for(const [name,hash]of Object.entries(previous.addedAssets))protectedFiles['assets/models/'+name]=hash;
for(const name of ['berlin_kiez_kit.js','berlin_facade_finish_v119.js']){
 assert.equal(sha(fs.readFileSync(path.join(root,'tools',name))),protectedFiles['tools/'+name]);delete protectedFiles['tools/'+name];
}
for(const [file,hash]of Object.entries(protectedFiles))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);
const sources=Object.fromEntries(['berlin_kiez_kit.js','berlin_facade_finish_v119.js'].map(name=>[name,sha(fs.readFileSync(path.join(stage,'sources',name)))]));
const result={passed:true,candidateSha256:sha(page),pageBytes:Buffer.byteLength(page),parsedScripts:scripts.length,layouts,leaves,blooms,minFacing,protectedTriangles,bookRays,
 totalExtraGeometryBytesAcross36Layouts:bytesAdded,maxTriangles:Math.max(...layouts.map(l=>l.afterTriangles)),addedDraws:0,addedShaders:0,addedTextures:0,protectedFiles,sources};
fs.writeFileSync(path.join(stage,'geometry-check.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,layouts:layouts.length,protectedFiles:Object.keys(protectedFiles).length},null,2));
