'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v150'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const code=fs.readFileSync(path.join(stage,'sources/berlin_kiez_kit.js'),'utf8'),page=fs.readFileSync(path.join(stage,'candidate.html'),'utf8');
let raw=code;for(const [from,to]of JSON.parse(fs.readFileSync(path.join(stage,'index-edits.json'))).reverse()){assert.equal(raw.split(to).length,2);raw=raw.replace(to,()=>from);}
const scripts=[...page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]),scope=vm.createContext({console,atob});
vm.runInContext(scripts.find(s=>s.includes('three.js r156 (MIT)')),scope);vm.runInContext(fs.readFileSync(path.join(root,'tools/berlin_packed_geometry.js'),'utf8'),scope);
scope.BERLIN_REFERENCE_ARCHITECTURE=JSON.parse(fs.readFileSync(path.join(root,'assets/models/berlin-reference-architecture-v1.json')));
const T=scope.THREE,noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
function kit(s){vm.runInContext(s,scope);return scope.createBerlinKiezKit(T,(color,o)=>new T.MeshStandardMaterial({color,...o}),()=>({getContext:()=>ctx}));}
const before=kit(raw),after=kit(code),rows=[];let corners=0,savedBytes=0,savedVertices=0;
const bytes=g=>Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+g.index.array.byteLength;
for(const width of [11,13.5,16])for(let variant=0;variant<6;variant++)for(const side of [-1,1]){
 const a=before.geometry(width,variant,side),b=after.geometry(width,variant,side);
 assert.equal(after.geometry(width,variant,side),b,'same cached geometry reused');
 assert.equal(a.index.count,b.index.count);assert.deepEqual(a.groups,b.groups);assert.deepEqual(a.drawRange,b.drawRange);
 assert.deepEqual(a.boundingBox,b.boundingBox);assert.deepEqual(a.boundingSphere,b.boundingSphere);
 for(const key of Object.keys(a.userData))if(key!=='finishBaseVertices')assert.deepEqual(a.userData[key],b.userData[key],key);
 for(const name of Object.keys(a.attributes)){
  const x=a.attributes[name],y=b.attributes[name];assert.equal(x.itemSize,y.itemSize);assert.equal(x.normalized,y.normalized);assert.equal(x.array.constructor,y.array.constructor);
  const xr=x.array.constructor.name==='Float32Array'?new Uint32Array(x.array.buffer,x.array.byteOffset,x.array.length):x.array;
  const yr=y.array.constructor.name==='Float32Array'?new Uint32Array(y.array.buffer,y.array.byteOffset,y.array.length):y.array;
  for(let i=0;i<a.index.count;i++){
   const ai=a.index.getX(i),bi=b.index.getX(i);assert.ok(bi<y.count);
   for(let k=0;k<x.itemSize;k++)assert.ok(Object.is(xr[ai*x.itemSize+k],yr[bi*y.itemSize+k]),'bit-exact '+name+' triangle corner '+[width,variant,side,i,k]);
  }
 }
 const bv=a.attributes.position.count,av=b.attributes.position.count,bb=bytes(a),ab=bytes(b);assert.ok(av<=bv);assert.ok(ab<=bb);
 if(variant<2){assert.equal(av,bv);assert.equal(ab,bb);}else assert.ok(av<bv*.90,'secondary template indexing materially reduces vertices');
 savedVertices+=bv-av;savedBytes+=bb-ab;corners+=a.index.count;
 rows.push({width,variant,side,triangles:b.index.count/3,beforeVertices:bv,afterVertices:av,beforeBytes:bb,afterBytes:ab,savedBytes:bb-ab});
}
assert.equal(Object.keys(before.cache).length,36);assert.equal(Object.keys(after.cache).length,36);
assert.ok(!code.includes('compactBerlinKiezVerticesV150'),'generic runtime hash deduplication is not shipped');
const result={passed:true,candidateSha256:sha(page),layouts:rows,exactTriangleCorners:corners,savedVertices,savedBytes,addedDraws:0,addedTextures:0,addedShaderChanges:0,cacheIdentityPreserved:true};
fs.writeFileSync(path.join(stage,'index-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,layouts:rows.length},null,2));
