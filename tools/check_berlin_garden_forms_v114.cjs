'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),mainStage=path.join(root,'audit/berlin-model-forms-v114/garden');
const lodCores=process.argv.includes('--lod-cores'),crown=process.argv.includes('--crown'),sprays=process.argv.includes('--sprays')||crown||lodCores,stage=lodCores?path.join(mainStage,'lod-cores'):crown?path.join(mainStage,'crown'):sprays?path.join(mainStage,'sprays'):mainStage;
const prefix='berlin-kiez-garden-v1';
const shipping=process.argv.includes('--shipping');
assert(process.argv.slice(2).every(arg=>['--shipping','--sprays','--crown','--lod-cores'].includes(arg)),'unsupported argument');
const read=(file)=>JSON.parse(fs.readFileSync(file,'utf8'));
if(shipping&&['branch-led-lobed-crown-v114','dense-layered-linden-v118'].includes(read(path.join(root,'assets/models',prefix+'.json')).canopyRevision)) {
  require('./check_berlin_branch_canopy_v114.cjs');
  process.exit(0);
}
const before=read(path.join(mainStage,'baseline',prefix+'.json'));
const after=read(path.join(stage,'models',prefix+'.json'));
const hashes=read(path.join(mainStage,'baseline/sha256.json'));
for(const [name,hash] of Object.entries(hashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(mainStage,'baseline',name))).digest('hex'),hash);
for(const key of ['tree','leaves','trunk','planter'])assert.deepEqual(after.meshes[key],before.meshes[key],key+' protected');
assert.deepEqual(after.atlas,before.atlas);assert.deepEqual(after.material,before.material);
const map=read(path.join(stage,'leaf-mapping.json'));
const farLeafCount=lodCores?538:418;
assert.equal(map.near_ids.length,1120);assert.equal(map.far_ids.length,farLeafCount);
for(const id of map.far_ids)assert(map.near_ids.includes(id));
const decode=r=>{const data={};for(const [key,type,n] of [['position','FloatLE',4],['normal','Int16LE',2],['color','UInt8',1],['uv','FloatLE',4],['index',r.vertices<65536?'UInt16LE':'UInt32LE',r.vertices<65536?2:4]]){const b=Buffer.from(r[key],'base64');data[key]=Array.from({length:b.length/n},(_,i)=>b['read'+type](i*n));}return data;};
const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),length=a=>Math.hypot(...a);
const reports={},geometry={};
for(const [key,cap] of [['treeNear',14000],['treeStreetFar',lodCores?5000:4000]]){
  const record=after.meshes[key],data=decode(record);assert(record.triangles<=cap);assert.equal(data.index.length,record.triangles*3);
  assert.equal(data.position.length,record.vertices*3);assert.equal(data.normal.length,record.vertices*3);assert.equal(data.color.length,record.vertices*3);assert.equal(data.uv.length,record.vertices*2);
  assert(data.position.every(Number.isFinite));assert(data.uv.every(Number.isFinite));assert(data.index.every(i=>i>=0&&i<record.vertices));
  const points=Array.from({length:record.vertices},(_,i)=>data.position.slice(i*3,i*3+3));
  const normals=Array.from({length:record.vertices},(_,i)=>data.normal.slice(i*3,i*3+3).map(v=>v/32767));
  assert(normals.every(n=>Math.abs(length(n)-1)<.0001));
  for(let axis=0;axis<3;axis++){const values=points.map(p=>p[axis]);assert(Math.abs(Math.min(...values)-record.min[axis])<1e-5);assert(Math.abs(Math.max(...values)-record.max[axis])<1e-5);}
  const lookup=new Map(),parents=[],weld=[];
  const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  for(const p of points){const k=p.map(v=>v.toFixed(5)).join(',');if(!lookup.has(k)){lookup.set(k,parents.length);parents.push(parents.length);}weld.push(lookup.get(k));}
  const faces=[];for(let i=0;i<data.index.length;i+=3){const f=data.index.slice(i,i+3);faces.push(f);const a=find(weld[f[0]]);parents[find(weld[f[1]])]=a;parents[find(weld[f[2]])]=a;}
  const groups=new Map();faces.forEach((f,fi)=>{const k=find(weld[f[0]]);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(fi);});
  const leaves=[...groups.values()].filter(g=>{
    const unique=new Set(g.flatMap(fi=>faces[fi].map(vi=>weld[vi])));
    return (g.length===8&&unique.size===6||g.length===12&&unique.size===8)&&g.every(fi=>fi>=552);
  });
  assert.equal(leaves.length,key==='treeNear'?1120:farLeafCount);
  geometry[key]={data,points,faces,groups,leaves,weld};
  let minimumVolume=Infinity,minimumArea=Infinity,minimumNormalFacing=Infinity;
  for(const group of leaves){
    const edges=new Map();let volume=0;
    const vertexIds=[...new Set(group.flatMap(fi=>faces[fi]))],center=[0,1,2].map(axis=>vertexIds.reduce((s,vi)=>s+points[vi][axis],0)/vertexIds.length);
    for(const fi of group){
      const f=faces[fi],p=f.map(vi=>sub(points[vi],center));const faceNormal=cross(sub(p[1],p[0]),sub(p[2],p[0]));const area=length(faceNormal)*.5;
      assert(area>1e-9,'degenerate leaf');minimumArea=Math.min(minimumArea,area);volume+=dot(p[0],cross(p[1],p[2]))/6;
      for(const vi of f){const facing=dot(normals[vi],faceNormal)/length(faceNormal);minimumNormalFacing=Math.min(minimumNormalFacing,facing);assert(facing>-.001,'normal inverted: '+facing);}
      for(let e=0;e<3;e++){const a=weld[f[e]],b=weld[f[(e+1)%3]],k=a<b?a+','+b:b+','+a;const item=edges.get(k)||{count:0,direction:0};item.count++;item.direction+=a<b?1:-1;edges.set(k,item);}
    }
    assert([...edges.values()].every(v=>v.count===2&&v.direction===0),'leaf not closed or inconsistent winding');assert(volume>1e-9,'leaf volume inverted');minimumVolume=Math.min(minimumVolume,volume);
  }
  const maximumRadius=Math.max(...points.map(p=>Math.hypot(p[0],p[2])));assert(maximumRadius<=after.streetCanopyRadius);
  reports[key]={triangles:record.triangles,vertices:record.vertices,leaves:leaves.length,minimumVolume,minimumArea,minimumNormalFacing,maximumRadius,runtimeBytes:['position','normal','color','uv','index'].reduce((s,k)=>s+Buffer.from(record[k],'base64').length,0)};
}
const inline=fs.readFileSync(path.join(stage,'models',prefix+'.inline.js'),'utf8');assert.deepEqual(JSON.parse(inline.slice(inline.indexOf('=')+1).trim().replace(/;$/,'')),after);
assert.deepEqual(Buffer.from(after.atlas.data,'base64'),fs.readFileSync(path.join(stage,'models',prefix+'-atlas.jpg')),'staged JPEG equals embedded atlas');

// Compare actual unique leaf coordinates, not the authoring report's centers.
// The six/eight-corner LOD shapes share the same centroid despite their different
// contour sampling. Index identity comes from the deterministic native export
// order and is checked against every near/far entry in the authoring map.
function leafCenter(g,geo){
  const unique=new Map();for(const fi of g)for(const vi of geo.faces[fi])unique.set(geo.weld[vi],geo.points[vi]);
  const points=[...unique.values()];return [0,1,2].map(axis=>points.reduce((s,p)=>s+p[axis],0)/points.length);
}
const nearCenters=new Map(map.near_ids.map((id,i)=>[id,leafCenter(geometry.treeNear.leaves[i],geometry.treeNear)]));
let maximumCenterDifference=0;
map.far_ids.forEach((id,i)=>{
  const center=leafCenter(geometry.treeStreetFar.leaves[i],geometry.treeStreetFar);
  const distance=length(sub(center,nearCenters.get(id)));maximumCenterDifference=Math.max(maximumCenterDifference,distance);
  assert(distance<1e-5,'retained leaf '+id+' moved between near/far LODs: '+distance);
});

// Trunk and branch surfaces are the original first 552 triangles in both
// packed records. Check every indexed corner attribute, independent of vertex
// deduplication, then prove all the new leaf triangles occur after this prefix.
function cornerStream(data,from,to){
  const out=[];for(let i=from*3;i<to*3;i++){const vi=data.index[i];out.push(...data.position.slice(vi*3,vi*3+3),...data.normal.slice(vi*3,vi*3+3),...data.color.slice(vi*3,vi*3+3),...data.uv.slice(vi*2,vi*2+2));}return out;
}
for(const key of ['treeNear','treeStreetFar']){
  assert.deepEqual(cornerStream(geometry[key].data,0,552),cornerStream(decode(before.meshes[key]),0,552),key+' complete street trunk/branch corner payload exact');
  assert(geometry[key].leaves.every(g=>g.every(fi=>fi>=552)),'all changed leaves follow the protected trunk');
}
assert.deepEqual(cornerStream(geometry.treeNear.data,0,552),cornerStream(geometry.treeStreetFar.data,0,552),'near/far trunk and branches are identical');
let focusedLodReport;
if(lodCores){
  const accepted=read(path.join(mainStage,'sprays/models',prefix+'.json'));
  const oldMapping=read(path.join(mainStage,'sprays/leaf-mapping.json'));
  assert.deepEqual(after.meshes.treeNear,accepted.meshes.treeNear,'focused LOD pass preserves accepted near mesh byte-for-byte');
  assert.deepEqual(fs.readFileSync(path.join(stage,'models',prefix+'.glb')),fs.readFileSync(path.join(mainStage,'sprays/models',prefix+'.glb')),'focused LOD pass preserves accepted reusable GLB byte-for-byte');
  const oldFar=decode(accepted.meshes.treeStreetFar),farNow=geometry.treeStreetFar.data;
  for(let i=0;i<oldMapping.far_ids.length;i++){
    const newIndex=map.far_ids.indexOf(oldMapping.far_ids[i]);assert(newIndex>=0,'old retained leaf remains in LOD');
    assert.deepEqual(cornerStream(farNow,652+newIndex*8,660+newIndex*8),cornerStream(oldFar,652+i*8,660+i*8),'old retained leaf '+oldMapping.far_ids[i]+' exact attributes');
  }
  let minimumCoreNormalFacing=Infinity;
  for(let core=0;core<5;core++){
    const first=552+core*20,last=first+20;
    for(let corner=first*3;corner<last*3;corner++){
      const a=oldFar.index[corner],b=farNow.index[corner];assert.deepEqual(farNow.color.slice(b*3,b*3+3),oldFar.color.slice(a*3,a*3+3),'core paint exact');assert.deepEqual(farNow.uv.slice(b*2,b*2+2),oldFar.uv.slice(a*2,a*2+2),'core atlas UV exact');
    }
    for(let fi=first;fi<last;fi++){
      const ids=farNow.index.slice(fi*3,fi*3+3),p=ids.map(vi=>farNow.position.slice(vi*3,vi*3+3)),normal=cross(sub(p[1],p[0]),sub(p[2],p[0]));assert(length(normal)>1e-7);
      for(const vi of ids){const facing=dot(normal,farNow.normal.slice(vi*3,vi*3+3).map(v=>v/32767))/length(normal);minimumCoreNormalFacing=Math.min(minimumCoreNormalFacing,facing);assert(facing>0,'reshaped core corner remains outward');}
    }
  }
  focusedLodReport={acceptedNearExact:true,acceptedGlbExact:true,originalFarLeavesExact:oldMapping.far_ids.length,newFarLeaves:map.far_ids.length-oldMapping.far_ids.length,corePaintUvExact:true,minimumCoreNormalFacing,trianglesSavedPerFarTree:after.meshes.treeNear.triangles-after.meshes.treeStreetFar.triangles};
}

// Parse and decode the real GLB rather than accepting exporter manifest claims.
function parseGlb(file){
  const bytes=fs.readFileSync(file);assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  let json,binary;for(let offset=12;offset<bytes.length;){const size=bytes.readUInt32LE(offset),kind=bytes.readUInt32LE(offset+4);assert.equal(size%4,0);assert(offset+8+size<=bytes.length);const value=bytes.subarray(offset+8,offset+8+size);if(kind===0x4e4f534a){assert(!json);json=JSON.parse(value.toString('utf8'));}else if(kind===0x004e4942){assert(!binary);binary=value;}offset+=8+size;}
  assert(json&&binary);assert.equal(json.buffers.length,1);assert.equal(json.buffers[0].byteLength,binary.length);
  const payload=i=>{const view=json.bufferViews[i],start=view.byteOffset||0;assert.equal(view.buffer,0);assert(start+view.byteLength<=binary.length);return binary.subarray(start,start+view.byteLength);};
  const accessor=id=>{
    const a=json.accessors[id];assert(!a.sparse,'unexpected sparse foliage accessor');
    const formats={5121:['readUInt8',1],5123:['readUInt16LE',2],5125:['readUInt32LE',4],5126:['readFloatLE',4]},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
    assert(formats[a.componentType]);assert(components[a.type]);const [method,size]=formats[a.componentType],width=components[a.type],raw=payload(a.bufferView),stride=json.bufferViews[a.bufferView].byteStride||size*width,offset=a.byteOffset||0;
    assert(offset+(a.count-1)*stride+size*width<=raw.length);const values=Array.from({length:a.count},(_,i)=>Array.from({length:width},(_,c)=>raw[method](offset+i*stride+c*size)));assert(values.flat().every(Number.isFinite));return {a,values};
  };
  return {json,binary,payload,accessor};
}
const glb=parseGlb(path.join(stage,'models',prefix+'.glb')),oldGlb=parseGlb(path.join(mainStage,'baseline',prefix+'.glb'));
for(const key of ['materials','nodes','meshes','images','textures','samplers','scenes','scene'])assert.deepEqual(glb.json[key],oldGlb.json[key],'GLB '+key+' preserved');
const leafPrimitive=glb.json.meshes.find(m=>m.name==='Kiez_Tree_Leaves_Street').primitives[0];
assert.deepEqual(Object.keys(leafPrimitive.attributes).sort(),['COLOR_0','NORMAL','POSITION','TEXCOORD_0']);
assert.equal(leafPrimitive.mode??4,4);assert.equal(leafPrimitive.material,0);
const modifiedAccessors=new Set([...Object.values(leafPrimitive.attributes),leafPrimitive.indices]);
const modifiedViews=new Set([...modifiedAccessors].map(id=>glb.json.accessors[id].bufferView));
assert.equal(glb.json.bufferViews.length,oldGlb.json.bufferViews.length);assert.equal(glb.json.accessors.length,oldGlb.json.accessors.length);
let protectedViews=0;
for(let id=0;id<glb.json.bufferViews.length;id++)if(!modifiedViews.has(id)){assert.deepEqual(glb.payload(id),oldGlb.payload(id),'protected GLB buffer view '+id);protectedViews++;}
for(let id=0;id<glb.json.accessors.length;id++)if(!modifiedAccessors.has(id))assert.deepEqual(glb.json.accessors[id],oldGlb.json.accessors[id],'protected GLB accessor '+id);
const glbAttributes=Object.fromEntries(Object.entries(leafPrimitive.attributes).map(([name,id])=>[name,glb.accessor(id)]));
const glbIndex=glb.accessor(leafPrimitive.indices);assert.equal(glbIndex.a.type,'SCALAR');assert.equal(glbIndex.a.componentType,5123);assert.equal(glbIndex.a.count,1120*12*3);
const actualLeafVertices=new Set(geometry.treeNear.leaves.flatMap(g=>g.flatMap(fi=>geometry.treeNear.faces[fi])));
const vertexCount=glbAttributes.POSITION.a.count;assert.equal(vertexCount,actualLeafVertices.size);
for(const [name,attribute] of Object.entries(glbAttributes)){assert.equal(attribute.a.count,vertexCount);assert.equal(attribute.a.type,name==='COLOR_0'?'VEC4':name==='TEXCOORD_0'?'VEC2':'VEC3');assert.equal(attribute.a.componentType,name==='COLOR_0'?5123:5126);}
assert.equal(glbAttributes.COLOR_0.a.normalized,true);
const runtime=geometry.treeNear.data;
for(let corner=0;corner<glbIndex.a.count;corner++){
  const vi=glbIndex.values[corner][0],ri=runtime.index[552*3+corner];assert(vi>=0&&vi<vertexCount);
  for(let channel=0;channel<3;channel++){
    assert.equal(glbAttributes.POSITION.values[vi][channel],runtime.position[ri*3+channel],'GLB/runtime position corner '+corner);
    assert(Math.abs(glbAttributes.NORMAL.values[vi][channel]-runtime.normal[ri*3+channel]/32767)<1e-7,'GLB/runtime normal corner '+corner);
    assert.equal(glbAttributes.COLOR_0.values[vi][channel],runtime.color[ri*3+channel]*257,'GLB/runtime paint corner '+corner);
  }
  for(let channel=0;channel<2;channel++)assert.equal(glbAttributes.TEXCOORD_0.values[vi][channel],runtime.uv[ri*2+channel],'GLB/runtime UV corner '+corner);
  assert.equal(glbAttributes.COLOR_0.values[vi][3],65535,'opaque native leaf');
}
for(let axis=0;axis<3;axis++){
  const values=glbAttributes.POSITION.values.map(p=>p[axis]);assert(Math.abs(Math.min(...values)-glbAttributes.POSITION.a.min[axis])<1e-6);assert(Math.abs(Math.max(...values)-glbAttributes.POSITION.a.max[axis])<1e-6);
}

let shippingReport;
if(shipping){
  const canonical=path.join(root,'assets/models');
  const live=read(path.join(canonical,prefix+'.json'));
  if(['rounded-branching-shrub-v114','twig-spray-shrub-v114'].includes(live.planterRevision)) {
    require('./check_berlin_planter_forms_v114.cjs');
    shippingReport={canonicalFilesExact:5,embeddedPayloadExact:true,oneSharedDecoder:true,planterFormsVerified:true};
  } else {
  for(const suffix of ['.json','.inline.js','.glb','.blend','-atlas.jpg'])assert.deepEqual(fs.readFileSync(path.join(canonical,prefix+suffix)),fs.readFileSync(path.join(stage,'models',prefix+suffix)),'canonical '+suffix+' exactly matches independently verified stage');
  const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8').replaceAll('\r\n','\n');
  const start='// BEGIN BLENDER GARDEN KIT',end='// END BLENDER GARDEN KIT';
  assert.equal(html.split(start).length,2,'one garden block');assert.equal(html.split(end).length,2,'one garden block end');
  const block=html.slice(html.indexOf(start),html.indexOf(end));assert(block.includes(inline.replaceAll('\r\n','\n').trim()),'actual HTML garden block embeds exact verified inline source');
  assert.equal((html.match(/\bvar BERLIN_KIEZ_GARDEN_DATA\s*=/g)||[]).length,1,'one garden data declaration');
  const declared=block.match(/\bvar BERLIN_KIEZ_GARDEN_DATA\s*=\s*(\{[^\r\n]*\});/);assert(declared,'parse actual embedded garden object');assert.deepEqual(JSON.parse(declared[1]),after,'actual embedded runtime object agrees with native exports');
  assert.equal((html.match(/\bfunction decodeBerlinMeshRecord\s*\(/g)||[]).length,1,'one shared garden/architecture decoder');
  for(const source of ['berlin_packed_geometry.js','berlin_garden_integration.js'])assert(html.includes(fs.readFileSync(path.join(root,'tools',source),'utf8').replaceAll('\r\n','\n').replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim()),'actual runtime '+source+' matches source');
  shippingReport={canonicalFilesExact:5,embeddedPayloadExact:true,oneSharedDecoder:true};
  }
}
if(shippingReport?.planterFormsVerified&&focusedLodReport){focusedLodReport.acceptedGlbExact=false;focusedLodReport.acceptedTreeGlbBuffersExact=true;}
const result={passed:true,mode:shipping?'shipping':'staged',revision:lodCores?'focused-lod-cores':crown?'branch-masses':sprays?'drooping-sprays':'rounded-blades',protected:shippingReport?.planterFormsVerified?'V95 pot and five current tree records exact; curved planter surfaces separately verified; unchanged atlas/material':'V95 planter, V100 palette source, grove, atlas, shared material, immutable baseline; all 552 trunk triangles exact',retainedLeaves:{count:farLeafCount,maximumCenterDifference},glb:{vertices:vertexCount,triangles:glbIndex.a.count/3,verifiedCorners:glbIndex.a.count,protectedViews,materialsNodesImagesExact:true},...reports,...(focusedLodReport?{focusedLod:focusedLodReport}:{}),...(shipping?{shipping:shippingReport}:{})};
fs.writeFileSync(path.join(stage,shipping?'shipping-check.json':'independent-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
