'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),vm=require('vm');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v139'),name='berlin-kiez-garden-v1';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const old=read(path.join(stage,'baseline',name+'.json')),data=read(path.join(stage,'models',name+'.json'));
assert.deepEqual(old,read(path.join(root,'audit/berlin-parity-v137/models',name+'.json')),'immutable accepted canopy/planter baseline');
for(const [file,digest] of Object.entries(read(path.join(stage,'baseline/sha256.json'))))assert.equal(sha(fs.readFileSync(path.join(stage,'baseline',file))),digest,file);
for(const key of Object.keys(old))if(!['meshes','planterRevision','source'].includes(key))assert.deepEqual(data[key],old[key],key+' unchanged');
assert.deepEqual(Object.keys(data.meshes),Object.keys(old.meshes));
for(const key of Object.keys(old.meshes))if(key!=='planter')assert.deepEqual(data.meshes[key],old.meshes[key],key+' exact');
assert.equal(data.source,'Blender 5.2 / tools/stage_berlin_planter_v139.py');
assert.equal(data.planterRevision,'fine-layered-shrub-v139');
const record=data.meshes.planter,prior=old.meshes.planter;
const decode=r=>Object.fromEntries([['position',12,'readFloatLE',3],['normal',6,'readInt16LE',3],['color',3,'readUInt8',3],['uv',8,'readFloatLE',2],['index',2,'readUInt16LE',1]].map(([k,stride,fn,n])=>{const b=Buffer.from(r[k],'base64');return[k,Array.from({length:b.length/(stride/n)},(_,i)=>b[fn](i*stride/n))];}));
const m=decode(record),before=decode(prior),potVertices=Math.max(...before.index.slice(0,180*3))+1;
assert.equal(potVertices,156);
for(const [key,stride]of [['position',12],['normal',6],['color',3],['uv',8]])assert.deepEqual(Buffer.from(record[key],'base64').subarray(0,potVertices*stride),Buffer.from(prior[key],'base64').subarray(0,potVertices*stride),'exact pot '+key);
assert.deepEqual(m.index.slice(0,180*3),before.index.slice(0,180*3),'exact pot faces');
assert.equal(record.triangles,6754);assert.ok(record.triangles<prior.triangles);assert.equal(m.index.length,record.triangles*3);
assert.equal(m.position.length,record.vertices*3);assert.equal(m.normal.length,record.vertices*3);assert.equal(m.uv.length,record.vertices*2);assert.equal(m.color.length,record.vertices*3);
assert.ok(m.position.every(Number.isFinite)&&m.uv.every(v=>Number.isFinite(v)&&v>0&&v<1));assert.ok(m.index.every(v=>v<record.vertices));
for(let i=0;i<record.vertices;i++)assert.ok(Math.abs(Math.hypot(...m.normal.slice(i*3,i*3+3))/32767-1)<.0001);
for(let a=0;a<3;a++){const p=m.position.filter((_,i)=>i%3===a);assert.ok(Math.abs(Math.min(...p)-record.min[a])<.00001&&Math.abs(Math.max(...p)-record.max[a])<.00001);}
assert.deepEqual(record.min,prior.min);assert.deepEqual(record.max,prior.max);
const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
let minVolume=Infinity,minFacing=Infinity;
function closedBlade(start,faces,vertices,label){
  const ids=m.index.slice(start*3,(start+faces)*3),points=ids.map(i=>m.position.slice(i*3,i*3+3));
  const unique=new Map(points.map(p=>[p.map(v=>v.toFixed(6)).join(','),p]));assert.equal(unique.size,vertices,label+' corners');
  const center=[0,1,2].map(a=>[...unique.values()].reduce((s,p)=>s+p[a],0)/vertices),edges=new Map();let volume=0;
  for(let f=0;f<faces;f++){
    const p=points.slice(f*3,f*3+3),q=p.map(v=>sub(v,center)),n=cross(sub(q[1],q[0]),sub(q[2],q[0])),length=Math.hypot(...n);assert.ok(length>1e-8,label+' nondegenerate');
    volume+=dot(q[0],cross(q[1],q[2]))/6;
    for(let j=0;j<3;j++){
      const normal=m.normal.slice(ids[f*3+j]*3,ids[f*3+j]*3+3).map(v=>v/32767),facing=dot(normal,n)/length;
      minFacing=Math.min(minFacing,facing);assert.ok(facing>0,label+' outward normals');
      const a=p[j].map(v=>v.toFixed(6)).join(','),b=p[(j+1)%3].map(v=>v.toFixed(6)).join(','),k=a<b?a+'|'+b:b+'|'+a,e=edges.get(k)||[0,0];e[0]++;e[1]+=a<b?1:-1;edges.set(k,e);
    }
  }
  assert.ok([...edges.values()].every(([count,direction])=>count===2&&direction===0),label+' closed wound manifold');assert.ok(volume>1e-8,label+' volume');minVolume=Math.min(minVolume,volume);
}
for(let leaf=0;leaf<420;leaf++)closedBlade(180+654+leaf*12,12,8,'leaf '+leaf);
for(let head=0;head<20;head++)for(let floret=0;floret<3;floret++)closedBlade(180+654+420*12+head*44+8+floret*12,12,8,'floret '+head+'/'+floret);
function glb(file){const b=fs.readFileSync(file),n=b.readUInt32LE(12);assert.equal(b.readUInt32LE(8),b.length);return{doc:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)};}
const a=glb(path.join(stage,'baseline',name+'.glb')),b=glb(path.join(stage,'models',name+'.glb'));
for(const key of ['nodes','materials','textures','images','scenes','meshes'])assert.deepEqual(b.doc[key],a.doc[key],'unchanged GLB '+key);
const primitive=b.doc.meshes.find(m=>m.name==='Kiez_Flower_Planter').primitives[0],changed=new Set([...Object.values(primitive.attributes),primitive.indices].map(i=>b.doc.accessors[i].bufferView));
let protectedViews=0;
for(let i=0;i<a.doc.bufferViews.length;i++)if(!changed.has(i)){
  const x=a.doc.bufferViews[i],y=b.doc.bufferViews[i];assert.deepEqual(b.bin.subarray(y.byteOffset||0,(y.byteOffset||0)+y.byteLength),a.bin.subarray(x.byteOffset||0,(x.byteOffset||0)+x.byteLength));protectedViews++;
}
function values(id){const c=b.doc.accessors[id],v=b.doc.bufferViews[c.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[c.type],bytes={5121:1,5123:2,5126:4}[c.componentType],fn={5121:'readUInt8',5123:'readUInt16LE',5126:'readFloatLE'}[c.componentType],offset=(v.byteOffset||0)+(c.byteOffset||0);return Array.from({length:c.count*n},(_,i)=>b.bin[fn](offset+Math.floor(i/n)*(v.byteStride||bytes*n)+(i%n)*bytes));}
for(const [key,attr]of [['position','POSITION'],['uv','TEXCOORD_0']])assert.deepEqual(values(primitive.attributes[attr]),m[key],'GLB '+key+' agrees with runtime');
assert.deepEqual(values(primitive.indices),m.index);
values(primitive.attributes.NORMAL).forEach((v,i)=>assert.ok(Math.abs(v-m.normal[i]/32767)<.0000001));
values(primitive.attributes.COLOR_0).forEach((v,i)=>assert.equal(v,i%4===3?255:m.color[Math.floor(i/4)*3+i%4]));
const inline=fs.readFileSync(path.join(stage,'models',name+'.inline.js'),'utf8').trim(),baseInline=fs.readFileSync(path.join(stage,'baseline',name+'.inline.js'),'utf8').trim();
const scope={};vm.runInNewContext(inline,scope);assert.deepEqual(JSON.parse(JSON.stringify(scope.BERLIN_KIEZ_GARDEN_DATA)),data);
const html=fs.readFileSync(path.join(stage,'candidate.html'),'utf8'),baseHtml=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
assert.equal(html.split(inline).length,2);assert.equal(html.replace(inline,()=>baseInline).replace("'kiez-reference-v139'","'kiez-reference-v138'"),baseHtml,'entire renderer, gameplay, architecture and courier unchanged');
assert.deepEqual(fs.readFileSync(path.join(stage,'models',name+'-atlas.jpg')),fs.readFileSync(path.join(stage,'baseline',name+'-atlas.jpg')),'atlas unchanged');
const shipping=process.argv.includes('--shipping');
if(shipping){
  for(const suffix of ['.json','.inline.js','.glb','.blend','-atlas.jpg'])assert.deepEqual(fs.readFileSync(path.join(root,'assets/models',name+suffix)),fs.readFileSync(path.join(stage,'models',name+suffix)),suffix);
  assert.equal(fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8'),html);
  assert.match(fs.readFileSync(path.join(root,'sw.js'),'utf8'),/artikel-blitz-v139/);
}
const bytes=r=>['position','normal','uv','color','index'].reduce((n,k)=>n+Buffer.from(r[k],'base64').length,0);
const result={passed:true,shipping,triangles:record.triangles,triangleDelta:record.triangles-prior.triangles,vertices:record.vertices,vertexDelta:record.vertices-prior.vertices,packedBytes:bytes(record),packedByteDelta:bytes(record)-bytes(prior),leaves:420,florets:60,minVolume,minFacing,protectedPotVertices:potVertices,protectedNativeBufferViews:protectedViews,exactTreeRecords:5,exactBounds:true,extraMaterials:0,extraDraws:0};
fs.writeFileSync(path.join(stage,shipping?'shipping-check.json':'independent-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
