'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v149'),name='berlin-kiez-garden-v1';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const before=read(path.join(stage,'baseline',name+'.json')),data=read(path.join(stage,'models',name+'.json'));
const shipping=process.argv.includes('--shipping');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(data.canopyRevision,'fine-rounded-linden-v149');
for(const key of ['tree','leaves','trunk','planter'])assert.deepEqual(data.meshes[key],before.meshes[key],key+' is preserved exactly');
for(const key of ['atlas','material','planterRevision'])assert.deepEqual(data[key],before[key]);
const unpack=r=>Object.fromEntries([['position',4,'readFloatLE'],['normal',2,'readInt16LE'],['color',1,'readUInt8'],['uv',4,'readFloatLE'],['index',2,'readUInt16LE']].map(([k,s,f])=>{const b=Buffer.from(r[k],'base64');return[k,Array.from({length:b.length/s},(_,i)=>b[f](i*s))];}));
const sub=(a,b)=>a.map((x,k)=>x-b[k]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
const original=unpack(before.meshes.treeNear),report={};
for(const role of ['treeNear','treeStreetFar']){
  const r=data.meshes[role],m=unpack(r);
  assert.ok(r.triangles<=(role==='treeNear'?44000:4000),'prototype triangle envelope; actual timing is a separate required gate');
  assert.ok(r.vertices<65536,'16-bit index buffer');
  assert.equal(m.index.length,r.triangles*3);assert.equal(m.position.length,r.vertices*3);
  assert.ok(m.index.every(i=>i<r.vertices));let radius=0,minFacing=1;
  for(let i=0;i<r.vertices;i++){
    const p=m.position.slice(i*3,i*3+3),n=m.normal.slice(i*3,i*3+3);
    assert.ok(p.every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...n)/32767-1)<.0001);
    radius=Math.max(radius,Math.hypot(p[0],p[2]));
  }
  assert.ok(radius<data.streetCanopyRadius,'culling envelope encloses every rotated leaf');
  for(let axis=0;axis<3;axis++){const v=m.position.filter((_,i)=>i%3===axis);assert.ok(Math.abs(Math.min(...v)-r.min[axis])<.00001&&Math.abs(Math.max(...v)-r.max[axis])<.00001);}
  for(let i=0;i<552*3;i++)for(const [attr,s]of [['position',3],['normal',3],['color',3],['uv',2]])assert.deepEqual(m[attr].slice(m.index[i]*s,m.index[i]*s+s),original[attr].slice(original.index[i]*s,original.index[i]*s+s),'original trunk corners');
  for(let f=552;f<r.triangles;f++){
    const ids=m.index.slice(f*3,f*3+3),p=ids.map(i=>m.position.slice(i*3,i*3+3));
    const face=cross(sub(p[1],p[0]),sub(p[2],p[0])),area=Math.hypot(...face);
    assert.ok(area>1e-9,'non-degenerate triangles');
    const shade=[0,1,2].map(k=>ids.reduce((s,i)=>s+m.normal[i*3+k]/32767,0));
    const facing=dot(face,shade)/(area*Math.hypot(...shade));minFacing=Math.min(minFacing,facing);
    assert.ok(facing>-.001,'smooth normals follow front-facing geometry');
  }
  const bytes=['position','normal','color','uv','index'].reduce((s,k)=>s+Buffer.from(r[k],'base64').length,0);
  assert.ok(bytes<(role==='treeNear'?2100000:220000),'prototype memory envelope; no claim of unchanged buffers');
  report[role]={triangles:r.triangles,vertices:r.vertices,bytes,radius,minFacing};
}
// Verify each intended new leaf as an independently closed eight-corner solid.
const mesh=unpack(data.meshes.treeNear),layout=read(path.join(stage,'layout.json')),parents=Array.from({length:data.meshes.treeNear.vertices},(_,i)=>i);
const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
const weld=new Map();for(let i=0;i<parents.length;i++){const key=mesh.position.slice(i*3,i*3+3).map(v=>v.toFixed(5)).join(',');if(weld.has(key))parents[i]=weld.get(key);else weld.set(key,i);}
for(let f=552;f<data.meshes.treeNear.triangles;f++){const ids=mesh.index.slice(f*3,f*3+3);for(const i of ids)parents[find(i)]=find(ids[0]);}
const groups=new Map();for(let f=552;f<data.meshes.treeNear.triangles;f++){const key=find(mesh.index[f*3]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(f);}
let leafCount=0;for(const faces of groups.values()){
 const ids=[...new Set(faces.flatMap(f=>mesh.index.slice(f*3,f*3+3)))];if(!ids.every(i=>mesh.color[i*3+1]>mesh.color[i*3]*1.1))continue;
 assert.equal(faces.length,12,'every green component is the intended twelve-triangle leaf');const keys=new Map(),edges=new Map();let volume=0;
 for(const i of ids){const p=mesh.position.slice(i*3,i*3+3);keys.set(i,p.map(v=>v.toFixed(5)).join(','));}assert.equal(new Set(keys.values()).size,8,'eight welded leaf corners');
 for(const f of faces){const vi=mesh.index.slice(f*3,f*3+3),p=vi.map(i=>mesh.position.slice(i*3,i*3+3));volume+=dot(p[0],cross(p[1],p[2]))/6;
  for(let k=0;k<3;k++){const a=keys.get(vi[k]),b=keys.get(vi[(k+1)%3]),key=[a,b].sort().join('|'),e=edges.get(key)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(key,e);}}
 assert.ok(volume>1e-9,'outward positive-volume solid');for(const edge of edges.values())assert.deepEqual(edge,[2,0],'closed consistently wound leaf');leafCount++;
}
assert.equal(leafCount,layout.leaves.length);assert.ok(leafCount>=3300&&leafCount<=3500);report.closedLeaves=leafCount;
const oldLayout=read(path.join(root,'audit/berlin-parity-v134/layout.json'));
const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
report.leafSize={beforeCount:oldLayout.leaves.length,afterCount:leafCount,meanBefore:mean(oldLayout.leaves.map(l=>l.length)),meanAfter:mean(layout.leaves.map(l=>l.length))};
assert.ok(report.leafSize.meanAfter/report.leafSize.meanBefore<.80,'leaf length is materially finer');
const oldPage=fs.readFileSync(path.join(stage,'baseline.html'),'utf8'),page=fs.readFileSync(path.join(stage,'candidate.html'),'utf8'),pattern=/var BERLIN_KIEZ_GARDEN_DATA = \{[^\r\n]*\};/;
assert.equal(page.replace(pattern,()=>oldPage.match(pattern)[0]).replace("'kiez-reference-v149'","'kiez-reference-v148'"),oldPage,'all render, shader, gameplay and placement code exact');
report.candidateSha256=crypto.createHash('sha256').update(page).digest('hex');report.pageBytes=Buffer.byteLength(page);

// Rasterize orthographic silhouettes independently of the renderer. Finer
// leaves introduce small gaps while retaining the broad crown in every view.
function coverage(record,angle){
  const m=unpack(record),N=192,mask=new Uint8Array(N*N),co=Math.cos(angle),si=Math.sin(angle);
  const p=Array.from({length:record.vertices},(_,i)=>[(m.position[i*3]*co+m.position[i*3+2]*si+3.4)/6.8*N,(10.5-m.position[i*3+1])/6*N]);
  for(let j=0;j<m.index.length;j+=3){
    const ids=m.index.slice(j,j+3);if(!ids.every(i=>m.color[i*3+1]>m.color[i*3]*1.10))continue;
    const [a,b,c]=ids.map(i=>p[i]),edge=(u,v,x,y)=>(v[0]-u[0])*(y-u[1])-(v[1]-u[1])*(x-u[0]);
    const sign=edge(a,b,...c);if(Math.abs(sign)<1e-8)continue;
    const x0=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),x1=Math.min(N-1,Math.ceil(Math.max(a[0],b[0],c[0]))),y0=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),y1=Math.min(N-1,Math.ceil(Math.max(a[1],b[1],c[1])));
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(edge(a,b,x+.5,y+.5)*sign>=0&&edge(b,c,x+.5,y+.5)*sign>=0&&edge(c,a,x+.5,y+.5)*sign>=0)mask[y*N+x]=1;
  }return mask.reduce((a,b)=>a+b,0);
}
report.coverage=[0,Math.PI/4,Math.PI/2,Math.PI*3/4].map(angle=>{
  const old=coverage(before.meshes.treeNear,angle),near=coverage(data.meshes.treeNear,angle),far=coverage(data.meshes.treeStreetFar,angle);
  console.log(JSON.stringify({angle,before:old,near,far,ratio:near/old,lodRatio:far/near}));
  assert.ok(near>old*.90&&near<old*1.15,'oval leaves retain a comparable open crown');
  assert.ok(far/near>.87&&far/near<1.10,'far silhouette preserves the close crown');return{angle,before:old,near,far,gain:near/old};
});
// Native GLB source geometry and packed runtime vertices must agree.
function glb(file){const b=fs.readFileSync(file),n=b.readUInt32LE(12);return{doc:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)};}
const a=glb(path.join(stage,'baseline',name+'.glb')),b=glb(path.join(stage,'models',name+'.glb'));
for(const key of ['nodes','materials','textures','images','scenes'])assert.deepEqual(b.doc[key],a.doc[key]);
const prim=b.doc.meshes.find(m=>m.name==='Kiez_Tree_Leaves_Street').primitives[0];
const changed=new Set([...Object.values(prim.attributes),prim.indices].map(i=>b.doc.accessors[i].bufferView));
function accessor(id){const a=b.doc.accessors[id],v=b.doc.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5121:1,5123:2,5126:4}[a.componentType],fn={5121:'readUInt8',5123:'readUInt16LE',5126:'readFloatLE'}[a.componentType];return Array.from({length:a.count*n},(_,i)=>b.bin[fn]((v.byteOffset||0)+(a.byteOffset||0)+Math.floor(i/n)*(v.byteStride||size*n)+(i%n)*size));}
const ids=accessor(prim.indices),runtime=unpack(data.meshes.treeNear);
assert.equal(ids.length,(data.meshes.treeNear.triangles-552)*3);
for(const [key,semantic,stride]of [['position','POSITION',3],['normal','NORMAL',3],['uv','TEXCOORD_0',2]]){
  const vals=accessor(prim.attributes[semantic]);
  for(let i=0;i<ids.length;i++)for(let k=0;k<stride;k++)assert.ok(Math.abs(vals[ids[i]*stride+k]-runtime[key][runtime.index[552*3+i]*stride+k]/(key==='normal'?32767:1))<.000001);
}
for(let i=0;i<a.doc.bufferViews.length;i++)if(!changed.has(i)){const x=a.doc.bufferViews[i],y=b.doc.bufferViews[i];assert.deepEqual(b.bin.subarray(y.byteOffset||0,(y.byteOffset||0)+y.byteLength),a.bin.subarray(x.byteOffset||0,(x.byteOffset||0)+x.byteLength),'untouched GLB role');}
const previous=read(path.join(root,'audit/berlin-parity-v148/shipping.json'));
const protectedFiles={...previous.protectedFiles},assets={};
for(const [source,sha] of Object.entries(previous.sources))protectedFiles['tools/'+source]=sha;
for(const suffix of ['.json','.inline.js','.blend','.glb']){
 const file='assets/models/'+name+suffix;delete protectedFiles[file];assets[file]=hash(fs.readFileSync(path.join(stage,'models',name+suffix)));
}
for(const [file,sha]of Object.entries(protectedFiles))assert.equal(hash(fs.readFileSync(path.join(root,file))),sha,file);
report.protectedFiles=protectedFiles;report.assets=assets;
report.addedGeometryBytes=report.treeNear.bytes+report.treeStreetFar.bytes-['treeNear','treeStreetFar'].reduce((total,role)=>total+['position','normal','color','uv','index'].reduce((s,k)=>s+Buffer.from(before.meshes[role][k],'base64').length,0),0);
report.addedDraws=0;report.addedTextures=0;report.addedShaders=0;
if(shipping){
  for(const suffix of ['.json','.inline.js','.glb','.blend','-atlas.jpg'])assert.deepEqual(fs.readFileSync(path.join(root,'assets/models',name+suffix)),fs.readFileSync(path.join(stage,'models',name+suffix)));
  const h=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8'),m=h.match(/var BERLIN_KIEZ_GARDEN_DATA\s*=\s*(\{[^\r\n]*\});/);assert.ok(m);assert.deepEqual(JSON.parse(m[1]),data);
  const kit=fs.readFileSync(path.join(root,'tools/berlin_garden_integration.js'),'utf8').replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();assert.ok(h.includes(kit));
}
fs.writeFileSync(path.join(stage,'geometry-check.json'),JSON.stringify({passed:true,shipping,...report},null,2));
console.log(JSON.stringify({passed:true,shipping,...report},null,2));

