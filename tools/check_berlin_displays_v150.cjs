'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v150'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(path.join(stage,p),'utf8'),base=read('baseline.html'),page=read('candidate.html'),oldCode=read('baseline/berlin_kiez_kit.js'),code=read('sources/berlin_kiez_kit.js');
let restored=code;for(const [a,b]of JSON.parse(read('edits.json')).reverse()){assert.equal(restored.split(b).length,2);restored=restored.replace(b,()=>a);}assert.equal(restored,oldCode);
const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();assert.equal(page.replace(trim(code),()=>trim(oldCode)).replace("'kiez-reference-v150'","'kiez-reference-v149'"),base);
assert.equal(code.slice(code.indexOf('function finishBerlinKiezFacade('),code.indexOf('// Extend the single atlas material.'))+"if (typeof module !== 'undefined') module.exports = {finishBerlinKiezFacade:finishBerlinKiezFacade};\n",read('sources/berlin_facade_finish_v119.js'));
const scripts=[...page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.trim());scripts.forEach(s=>new vm.Script(s));
const scope=vm.createContext({console,atob});vm.runInContext(scripts.find(s=>s.includes('three.js r156 (MIT)')),scope);vm.runInContext(fs.readFileSync(path.join(root,'tools/berlin_packed_geometry.js'),'utf8'),scope);
scope.BERLIN_REFERENCE_ARCHITECTURE=JSON.parse(fs.readFileSync(path.join(root,'assets/models/berlin-reference-architecture-v1.json')));
const T=scope.THREE,noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
function kit(source){vm.runInContext(source,scope);return scope.createBerlinKiezKit(T,(color,o)=>new T.MeshStandardMaterial({color,...o}),()=>({getContext:()=>ctx}));}
// Isolate the new merchandise from the separately checked exact indexing
// transformation. check_berlin_indexed_facades_v150 verifies every actual
// candidate triangle corner against this unoptimized merchandise geometry.
let displayCode=code;for(const [from,to]of JSON.parse(read('index-edits.json')).reverse()){assert.equal(displayCode.split(to).length,2);displayCode=displayCode.replace(to,()=>from);}
const before=kit(oldCode),after=kit(displayCode),layouts=[],expected={0:{bays:1,bread:45,spines:0},1:{bays:3,bread:0,spines:198}};
const vec=(p,i)=>new T.Vector3().fromBufferAttribute(p,i),bytes=g=>Object.values(g.attributes).reduce((s,a)=>s+a.array.byteLength,0)+g.index.array.byteLength;
let alphaChanges=0,coverUVChanges=0,totalAddedBytes=0,totalAddedTriangles=0,rays=0,closedComponents=0,printedBands=0,minFacing=1;
for(const width of [11,13.5,16])for(let variant=0;variant<6;variant++)for(const side of [-1,1]){
 const a=before.geometry(width,variant,side),b=after.geometry(width,variant,side),start=a.index.count/3,end=b.index.count/3;
 assert.equal(b.userData.shopDisplayFaces[0],start);assert.equal(b.userData.shopDisplayFaces[1],end);
 for(const key of Object.keys(a.userData))if(key!=='triangles')assert.deepEqual(b.userData[key],a.userData[key],key);
 assert.equal(b.groups.length,1);assert.equal(b.groups[0].materialIndex,a.groups[0].materialIndex);
 for(const key of ['position','normal'])assert.deepEqual(b.attributes[key].array.subarray(0,a.attributes[key].array.length),a.attributes[key].array,'protected '+key+' exact');
 const coverVertices=new Set();if(variant===1)for(let f=a.userData.displayBookFaces[0];f<a.userData.displayBookFaces[1];f++)for(let k=0;k<3;k++)coverVertices.add(a.index.getX(f*3+k));
 for(let i=0;i<a.attributes.uv.count;i++){
  const old=a.attributes.uv,next=b.attributes.uv;if(old.getX(i)===next.getX(i)&&old.getY(i)===next.getY(i))continue;
  assert.ok(variant===1&&coverVertices.has(i));assert.equal(Math.floor(old.getX(i)*4)+4*Math.floor((1-old.getY(i))*4),4);
  const u=next.getX(i)*4,v=next.getY(i)*4-2;assert.ok((u>.3739&&u<.5101||u>.6019&&u<.7381)&&v>.6029&&v<.7501,'front covers use framed illustrations from the existing atlas');coverUVChanges++;
 }
 assert.deepEqual(b.index.array.subarray(0,a.index.count),a.index.array,'all previous topology exact');
 const ca=a.attributes.color,cb=b.attributes.color,p=b.attributes.position,n=b.attributes.normal,uv=b.attributes.uv;
 for(let i=0;i<ca.count;i++){
  for(let k=0;k<3;k++)assert.equal(cb.array[i*4+k],ca.array[i*4+k],'all previous RGB exact');
  if(cb.getW(i)!==ca.getW(i)){
   assert.equal(cb.getW(i),1);const cell=Math.floor(uv.getX(i)*4)+4*Math.floor((1-uv.getY(i))*4);assert.equal(cell,variant===0?5:4);
   assert.ok(b.userData.shopDisplayBays.some(bay=>Math.abs(p.getZ(i)-bay.min[2])<1e-5&&p.getX(i)>=bay.min[0]-1e-5&&p.getX(i)<=bay.max[0]+1e-5));alphaChanges++;
  }
 }
 assert.ok(b.boundingBox.min.distanceTo(a.boundingBox.min)+b.boundingBox.max.distanceTo(a.boundingBox.max)<1e-5,'whole-building culling bounds exact');
 const plan=expected[variant]||{bays:0,bread:0,spines:0};assert.equal(b.userData.shopDisplayBays.length,plan.bays);assert.equal(b.userData.breadCount,plan.bread);assert.equal(b.userData.spineCount,plan.spines);
 if(variant>1)assert.equal(end,start,'secondary frontages unchanged');
 const positions=new Map(),parent=[],weld=[];
 function find(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
 for(let i=ca.count;i<p.count;i++){
  const v=vec(p,i),nn=vec(n,i);assert.ok(v.toArray().every(Number.isFinite));assert.ok(Math.abs(nn.length()-1)<.0001);
  assert.ok(v.y>.99&&v.y<3.5&&v.z>.029&&v.z<.65,'new merchandise and wall-anchored shelves stay within the actual display depth and height: '+v.toArray());
  assert.ok(cb.getW(i)>=.095&&cb.getW(i)<=.465,'physical merchandise uses a restrained directional warm room-light factor');
  const key=v.toArray().map(x=>x.toFixed(6)).join(',');if(!positions.has(key)){positions.set(key,parent.length);parent.push(parent.length);}weld[i]=positions.get(key);
 }
 for(let f=start;f<end;f++){
  const ids=[0,1,2].map(k=>b.index.getX(f*3+k));for(const i of ids)parent[find(weld[i])]=find(weld[ids[0]]);
  const q=ids.map(i=>vec(p,i)),face=q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0]));assert.ok(face.length()>1e-9);
  const nn=ids.reduce((s,i)=>s.add(vec(n,i)),new T.Vector3());const facing=face.clone().normalize().dot(nn.normalize());minFacing=Math.min(minFacing,facing);assert.ok(facing>-.001,'outward smooth normals');
 }
 const components=new Map();for(let f=start;f<end;f++){const r=find(weld[b.index.getX(f*3)]);if(!components.has(r))components.set(r,[]);components.get(r).push(f);}
 for(const faces of components.values()){
  if(faces.length===2){assert.equal(variant,1,'only printed spine bands are open surfaces');printedBands++;continue;}
  const edges=new Map();let volume=0;
  for(const f of faces){const ids=[0,1,2].map(k=>b.index.getX(f*3+k)),q=ids.map(i=>vec(p,i));volume+=q[0].dot(q[1].clone().cross(q[2]))/6;
   for(let k=0;k<3;k++){const x=weld[ids[k]],y=weld[ids[(k+1)%3]],key=[Math.min(x,y),Math.max(x,y)].join(','),v=edges.get(key)||[0,0];v[0]++;v[1]+=x<y?1:-1;edges.set(key,v);}}
  assert.ok(volume>1e-10,'closed merchandise has positive volume');for(const value of edges.values())assert.deepEqual(value,[2,0]);closedComponents++;
 }
 // Sample centres on all four bakery rows and three book rows through the
 // actual full facade, ensuring real merchandise is the first visible hit.
 if(variant<2){const mesh=new T.Mesh(b,after.material);mesh.updateMatrixWorld(true);
  for(const bay of b.userData.shopDisplayBays)for(const y of variant===0?[1.17,1.755,2.465,3.175]:[1.28,1.865,2.575]){
   let found=0;for(let sample=0;sample<13;sample++){
    const x=bay.min[0]+.25+(bay.max[0]-bay.min[0]-.50)*(sample+.5)/13;
    const hit=new T.Raycaster(new T.Vector3(x,y,4),new T.Vector3(0,0,-1)).intersectObject(mesh)[0];
    if(hit&&hit.faceIndex>=start&&hit.faceIndex<end)found++;
   }assert.ok(found>=4,'a substantial row of real merchandise is exposed');rays+=13;
  }
 }
 totalAddedBytes+=bytes(b)-bytes(a);totalAddedTriangles+=end-start;layouts.push({width,variant,side,bays:plan.bays,addedTriangles:end-start,totalTriangles:end,addedBytes:bytes(b)-bytes(a)});
}
const shader=m=>{const s={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};m.onBeforeCompile(s);return s;};
const sa=shader(before.material),sb=shader(after.material),added=["if(vColor.a>0.99&&(abs(kiezPaintTile-4.0)<0.5||abs(kiezPaintTile-5.0)<0.5)){","float displayWall=1.0-smoothstep(0.755,0.785,kiezLocal.y);","vec3 woodWall=vec3(0.115,0.058,0.025)*(0.80+0.28*kiezLocal.y)*vColor.rgb;","diffuseColor.rgb=mix(diffuseColor.rgb,woodWall,displayWall);","}",""].join('\n');
const roughness='if(kiezSurface>=4.0&&kiezSurface<=5.0&&vColor.a>0.08&&vColor.a<0.49)roughnessFactor=0.84;\n';
assert.equal(sb.fragmentShader.split(added).length,2);assert.equal(sb.fragmentShader.split(roughness).length,2);assert.equal(sb.fragmentShader.replace(added,'').replace(roughness,''),sa.fragmentShader);assert.equal(sb.vertexShader,sa.vertexShader);assert.deepEqual(sb.uniforms,sa.uniforms);
const previous=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-parity-v149/shipping.json'))),protectedFiles={...previous.protectedFiles};
for(const name of ['berlin_kiez_kit.js','berlin_facade_finish_v119.js'])delete protectedFiles['tools/'+name];
for(const [file,hash]of Object.entries(protectedFiles))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);
const sources=Object.fromEntries(['berlin_kiez_kit.js','berlin_facade_finish_v119.js'].map(name=>[name,sha(read('sources/'+name))]));
assert.equal(coverUVChanges,144);assert.equal(printedBands,0);
const result={passed:true,candidateSha256:sha(page),pageBytes:Buffer.byteLength(page),parsedScripts:scripts.length,layouts,alphaChanges,coverUVChanges,totalAddedBytes,totalAddedTriangles,rays,closedComponents,printedBands,minFacing,protectedFiles,sources,addedDraws:0,addedTextures:0,addedSamplers:0};
fs.writeFileSync(path.join(stage,'geometry-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({...result,protectedFiles:Object.keys(protectedFiles).length},null,2));
