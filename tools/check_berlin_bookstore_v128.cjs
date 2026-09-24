'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v128'),name='berlin-reference-architecture-v1';
const before=JSON.parse(fs.readFileSync(path.join(stage,'baseline',name+'.json'))),data=JSON.parse(fs.readFileSync(path.join(stage,'models',name+'.json')));
const key='13.5:1:1',a=before.meshes[key],b=data.meshes[key];
assert.equal(b.upperWindowRevision,'rectangular-street-windows-v128');
assert.ok(b.triangles<a.triangles);assert.ok(b.vertices<65536);
for(const k of Object.keys(before.meshes))if(k!==key)assert.deepEqual(data.meshes[k],before.meshes[k],k+' preserved');
function decode(r){return Object.fromEntries([['position',4,'readFloatLE'],['normal',2,'readInt16LE'],['color',1,'readUInt8'],['uv',4,'readFloatLE'],['index',2,'readUInt16LE']].map(([key,size,read])=>{const bytes=Buffer.from(r[key],'base64');return[key,Array.from({length:bytes.length/size},(_,i)=>bytes[read](i*size))];}));}
function ground(r){const d=decode(r),result=[];for(let f=0;f<d.index.length;f+=3){const ids=d.index.slice(f,f+3);if(ids.some(i=>d.position[i*3+1]>4.70001))continue;result.push(ids.map(i=>['position','normal','uv','color'].map(k=>d[k].slice(i*(k==='uv'?2:3),(i+1)*(k==='uv'?2:3)).join(',')).join('|')).join(';'));}return result.sort();}
assert.deepEqual(ground(b),ground(a),'every ground-storey position, normal, UV, color and triangle corner preserved');
const html=fs.readFileSync(path.join(stage,'candidate.html'),'utf8'),scope=vm.createContext({console});
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('three.js r156 (MIT)'))[1],scope);
scope.atob=s=>Buffer.from(s,'base64').toString('binary');scope.BERLIN_REFERENCE_ARCHITECTURE=data;
vm.runInContext(fs.readFileSync(path.join(root,'tools/berlin_packed_geometry.js'),'utf8'),scope);
vm.runInContext(fs.readFileSync(path.join(stage,'sources/berlin_kiez_kit.js'),'utf8'),scope);
const T=scope.THREE,noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
const railStart=html.indexOf('var railStripGeo = new THREE.BufferGeometry()'),railEnd=html.indexOf('  var railStripGeoMirror',railStart);
assert.ok(railStart>0&&railEnd>railStart);
const rails=new Function('THREE','CHUNK_LEN',html.slice(railStart,railEnd)+'return railStripGeo;')(T,40);
assert.equal(rails.index.count/3,18,'shallow profile uses eighteen triangles per rail');
assert.ok(rails.boundingBox.min.y+.006>=.0019&&rails.boundingBox.max.y+.006<.012,'groove clears the ground and crown remains below 12 mm');
for(let f=0;f<rails.index.count;f+=3){
  const ids=[0,1,2].map(j=>rails.index.getX(f+j)),p=ids.map(i=>new T.Vector3().fromBufferAttribute(rails.attributes.position,i));
  const face=p[1].sub(p[0]).cross(p[2].sub(p[0]));
  assert.ok(face.length()>0&&face.dot(new T.Vector3().fromBufferAttribute(rails.attributes.normal,ids[0]))>0,'rail faces and normals agree');
}
const kit=scope.createBerlinKiezKit(T,(color,opts)=>new T.MeshStandardMaterial({color,...opts}),(width,height)=>({width,height,getContext:()=>ctx}));
let rays=0;
for(const w of [11,13.5,16])for(const side of [-1,1]){
  const g=kit.geometry(w,1,side),mesh=new T.Mesh(g,kit.material);mesh.updateMatrixWorld(true);
  assert.equal(g.userData.displayBookCount,6,'six physical books, merged into the facade');
  const bookFaces=g.userData.displayBookFaces;
  assert.ok(bookFaces&&bookFaces[1]-bookFaces[0]===156,'book geometry range covers exactly six books and their stands');
  for(const center of [-12.5/3,0,12.5/3])for(let floor=0;floor<4;floor++)for(const dx of [-.60,.60]){
    const cy=4.7+floor*3.05+3.05*.51;
    const hit=new T.Raycaster(new T.Vector3((center+dx)*w/13.5*side,cy+.85,4),new T.Vector3(0,0,-1)).intersectObject(mesh)[0];
    assert.ok(hit,'rectangular corner has a visible surface');
    assert.equal(Math.floor(hit.uv.x*4)+4*Math.floor((1-hit.uv.y)*4),2,'upper corners expose glazing');
    assert.ok(Math.abs(hit.point.z+.230)<.002,'glazing remains 23 cm inside the facade');rays++;
  }
}
if(process.argv.includes('--shipping'))for(const suffix of ['.json','.inline.js','.blend','.glb','-atlas.png'])assert.deepEqual(fs.readFileSync(path.join(root,'assets/models',name+suffix)),fs.readFileSync(path.join(stage,'models',name+suffix)));
console.log(`PASS: ${rays} actual rectangular-window corner rays, ${ground(a).length} exact ground triangles, eleven unchanged records, ${a.triangles-b.triangles} fewer bookstore triangles.`);
