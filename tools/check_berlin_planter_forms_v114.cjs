'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const branchSprays=process.argv.includes('--branch-sprays')||(process.argv.includes('--shipping')&&JSON.parse(fs.readFileSync(path.join(__dirname,'../assets/models/berlin-kiez-garden-v1.json'),'utf8')).planterRevision==='twig-spray-shrub-v114');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-model-forms-v114/garden',branchSprays?'planter-sprays':'planter-forms'),name='berlin-kiez-garden-v1';
const shipping=process.argv.includes('--shipping');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const old=read(path.join(stage,'baseline',name+'.json')),data=read(path.join(stage,'models',name+'.json'));
const accepted=read(path.join(root,'audit/berlin-model-forms-v114/garden',branchSprays?'planter-forms':'lod-cores','models',name+'.json'));
assert.deepEqual(old,accepted,'plant baseline is the verified current near/far tree pack');
for(const key of Object.keys(old))if(!['meshes','planterRevision'].includes(key))assert.deepEqual(data[key],old[key],key+' unchanged');
for(const key of Object.keys(old.meshes))if(key!=='planter')assert.deepEqual(data.meshes[key],old.meshes[key],key+' exact');
assert.equal(data.planterRevision,branchSprays?'twig-spray-shrub-v114':'rounded-branching-shrub-v114');
const record=data.meshes.planter,prior=old.meshes.planter;
const decode=r=>Object.fromEntries([['position',12,'readFloatLE',3],['normal',6,'readInt16LE',3],['color',3,'readUInt8',3],['uv',8,'readFloatLE',2],['index',2,'readUInt16LE',1]].map(([k,stride,fn,n])=>{const b=Buffer.from(r[k],'base64');return[k,Array.from({length:b.length/(stride/n)},(_,i)=>b[fn](i*stride/n))];}));
const m=decode(record),before=decode(prior),potVertices=Math.max(...before.index.slice(0,180*3))+1;
assert.equal(potVertices,156);
for(const [key,stride]of [['position',12],['normal',6],['color',3],['uv',8]])assert.deepEqual(Buffer.from(record[key],'base64').subarray(0,potVertices*stride),Buffer.from(prior[key],'base64').subarray(0,potVertices*stride),'exact pot '+key);
assert.deepEqual(m.index.slice(0,180*3),before.index.slice(0,180*3),'exact original pot faces');
assert.equal(record.triangles,branchSprays?7558:7338);assert.ok(record.triangles<8000);assert.equal(m.index.length,record.triangles*3);
assert.equal(m.position.length,record.vertices*3);assert.equal(m.normal.length,record.vertices*3);assert.equal(m.uv.length,record.vertices*2);
assert.ok(m.position.every(Number.isFinite)&&m.uv.every(Number.isFinite));assert.ok(m.index.every(v=>v<record.vertices));
for(let i=0;i<record.vertices;i++)assert.ok(Math.abs(Math.hypot(...m.normal.slice(i*3,i*3+3))/32767-1)<.0001);
for(let a=0;a<3;a++){const p=m.position.filter((_,i)=>i%3===a);assert.ok(Math.abs(Math.min(...p)-record.min[a])<.00001&&Math.abs(Math.max(...p)-record.max[a])<.00001,'actual geometry remains within its declared enclosure');}
assert.deepEqual(record.min,prior.min);assert.deepEqual(record.max,prior.max);
const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
let minVolume=Infinity,minFacing=Infinity;
for(let leaf=0;leaf<240;leaf++){
  const start=(180+(branchSprays?498:278)+leaf*24)*3,ids=m.index.slice(start,start+24*3),points=ids.map(i=>m.position.slice(i*3,i*3+3));
  const unique=new Map(points.map(p=>[p.map(v=>v.toFixed(6)).join(','),p]));assert.equal(unique.size,14,'twelve-point curved outline and two surface centers');
  const center=[0,1,2].map(a=>[...unique.values()].reduce((s,p)=>s+p[a],0)/14),edges=new Map();let volume=0;
  for(let f=0;f<24;f++){
    const p=points.slice(f*3,f*3+3),q=p.map(v=>sub(v,center)),n=cross(sub(q[1],q[0]),sub(q[2],q[0])),length=Math.hypot(...n);assert.ok(length>1e-8,'non-degenerate leaf surface');
    volume+=dot(q[0],cross(q[1],q[2]))/6;
    for(let j=0;j<3;j++){
      const normal=m.normal.slice(ids[f*3+j]*3,ids[f*3+j]*3+3).map(v=>v/32767),facing=dot(normal,n)/length;
      minFacing=Math.min(minFacing,facing);assert.ok(facing>0,'artist normals follow the actual curved leaf surface');
      const a=p[j].map(v=>v.toFixed(6)).join(','),b=p[(j+1)%3].map(v=>v.toFixed(6)).join(','),k=a<b?a+'|'+b:b+'|'+a,edge=edges.get(k)||[0,0];edge[0]++;edge[1]+=a<b?1:-1;edges.set(k,edge);
    }
  }
  assert.ok([...edges.values()].every(([count,direction])=>count===2&&direction===0),'closed consistently wound leaf');assert.ok(volume>1e-8);minVolume=Math.min(minVolume,volume);
}
function glb(file){const b=fs.readFileSync(file),n=b.readUInt32LE(12);return{doc:JSON.parse(b.subarray(20,20+n)),bin:b.subarray(28+n)};}
const a=glb(path.join(stage,'baseline',name+'.glb')),b=glb(path.join(stage,'models',name+'.glb'));
for(const key of ['nodes','materials','textures','images','scenes'])assert.deepEqual(b.doc[key],a.doc[key],'unchanged native tree scene '+key);
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
if(shipping){
  const live=read(path.join(root,'assets/models',name+'.json'));
  if(live.canopyRevision==='branch-led-lobed-crown-v114') {
    assert.deepEqual(live.meshes.planter,data.meshes.planter,'combined garden retains the independently verified planter');
    require('./check_berlin_branch_canopy_v114.cjs');
  } else {
  for(const suffix of ['.json','.inline.js','.glb','.blend','-atlas.jpg'])assert.deepEqual(fs.readFileSync(path.join(root,'assets/models',name+suffix)),fs.readFileSync(path.join(stage,'models',name+suffix)),'canonical '+suffix);
  const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8'),match=html.match(/var BERLIN_KIEZ_GARDEN_DATA\s*=\s*(\{[^\r\n]*\});/);assert.ok(match);assert.deepEqual(JSON.parse(match[1]),data,'actual shipping garden object');
  assert.equal((html.match(/\bfunction decodeBerlinMeshRecord\s*\(/g)||[]).length,1,'one shared decoder');
  for(const file of ['berlin_packed_geometry.js','berlin_garden_integration.js']){const source=fs.readFileSync(path.join(root,'tools',file),'utf8').replaceAll('\r\n','\n').replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();assert.ok(html.replaceAll('\r\n','\n').includes(source),'actual shared garden source '+file);}
  }
}
// Near/far attributes are exact copies of the separately validated LOD pack.
// check_berlin_garden_forms_v114.cjs runs its detailed tree proof alongside this check.
const result={passed:true,shipping,triangles:record.triangles,leaves:240,minVolume,minFacing,protectedPotVertices:potVertices,protectedNativeBufferViews:protectedViews,exactTreeRecords:5,exactBounds:true,extraMaterials:0,extraDraws:0};
fs.writeFileSync(path.join(stage,shipping?'shipping-check.json':'independent-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
