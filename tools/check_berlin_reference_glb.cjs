'use strict';
// Inspect actual binary GLB attributes, not a mock of the exporter.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const assets=path.join(root,process.env.BERLIN_ARCHITECTURE_DIR||'assets/models');
const buffer=fs.readFileSync(path.join(assets,'berlin-reference-architecture-v1.glb'));
assert.equal(buffer.readUInt32LE(0),0x46546c67);assert.equal(buffer.readUInt32LE(4),2);
assert.equal(buffer.readUInt32LE(8),buffer.length);
let gltf,binary;
for(let offset=12;offset<buffer.length;){
  const length=buffer.readUInt32LE(offset),type=buffer.readUInt32LE(offset+4);
  const data=buffer.subarray(offset+8,offset+8+length);
  if(type===0x4e4f534a)gltf=JSON.parse(data.toString('utf8'));
  if(type===0x004e4942)binary=data;
  offset+=8+length;
}
assert.ok(gltf&&binary);
function accessor(index){
  const a=gltf.accessors[index],view=gltf.bufferViews[a.bufferView];
  assert.equal(a.sparse,undefined,'plain reusable geometry accessors');
  const size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type];
  const format={5121:[1,'readUInt8',255],5123:[2,'readUInt16LE',65535],5125:[4,'readUInt32LE',4294967295],5126:[4,'readFloatLE',1]}[a.componentType];
  assert.ok(format,'supported GLB component type');
  const offset=(view.byteOffset||0)+(a.byteOffset||0),stride=view.byteStride||size*format[0];
  return {count:a.count,size,get:(i,j)=>binary[format[1]](offset+i*stride+j*format[0])/(a.normalized?format[2]:1)};
}
const runtime=JSON.parse(fs.readFileSync(path.join(assets,'berlin-reference-architecture-v1.json'),'utf8'));
assert.equal(gltf.meshes.length,12);assert.equal(gltf.materials.length,1);
assert.ok(gltf.materials[0].pbrMetallicRoughness.baseColorTexture,'export retains painted atlas');
let vertices=0,triangles=0,nonWhite=0,minColor=1,maxColor=0,maxNormalError=0;
for(const node of gltf.nodes.filter(n=>n.mesh!==undefined)){
  const mesh=gltf.meshes[node.mesh],key=node.extras.runtime_key,record=runtime.meshes[key];
  assert.ok(record,'GLB preserves the reusable runtime module key');
  assert.equal(mesh.primitives.length,1,'one shared material draw per building');
  const primitive=mesh.primitives[0],a=primitive.attributes;
  for(const attr of ['POSITION','NORMAL','TEXCOORD_0','COLOR_0'])assert.ok(a[attr]!==undefined,key+' exports '+attr);
  assert.equal(a.COLOR_1,undefined,'painted color is the active glTF COLOR_0, without a fake white fallback');
  const p=accessor(a.POSITION),n=accessor(a.NORMAL),uv=accessor(a.TEXCOORD_0),c=accessor(a.COLOR_0),indices=accessor(primitive.indices);
  assert.equal(n.count,p.count);assert.equal(uv.count,p.count);assert.equal(c.count,p.count);
  assert.equal(indices.count/3,record.triangles,'re-export preserves baked topology');
  const uniqueColors=new Set();
  for(let i=0;i<p.count;i++){
    for(let j=0;j<3;j++)assert.ok(Number.isFinite(p.get(i,j))&&Number.isFinite(n.get(i,j)),'finite positions and normals');
    const error=Math.abs(Math.hypot(n.get(i,0),n.get(i,1),n.get(i,2))-1);
    maxNormalError=Math.max(maxNormalError,error);assert.ok(error<.002,'unit GLB normals');
    for(let j=0;j<2;j++)assert.ok(Number.isFinite(uv.get(i,j))&&uv.get(i,j)>=0&&uv.get(i,j)<=1,'finite atlas UV');
    const rgb=[c.get(i,0),c.get(i,1),c.get(i,2)];
    rgb.forEach(value=>{assert.ok(Number.isFinite(value)&&value>=0&&value<=1);minColor=Math.min(minColor,value);maxColor=Math.max(maxColor,value);});
    if(rgb.some(value=>value<.99))nonWhite++;
    uniqueColors.add(rgb.map(value=>Math.round(value*255)).join(','));
  }
  assert.ok(uniqueColors.size>20,'baked painted colors survive export rather than all-white COLOR_0');
  for(let i=0;i<indices.count;i++)assert.ok(indices.get(i,0)<p.count,'indices stay inside the vertex buffer');
  vertices+=p.count;triangles+=indices.count/3;
}
assert.ok(nonWhite>vertices*.5,'most vertices retain their actual baked paint');
const report={ok:true,modules:gltf.meshes.length,vertices,triangles,nonWhiteVertices:nonWhite,colorRange:[minColor,maxColor],maximumNormalError:maxNormalError,bytes:buffer.length,runtimeSource:runtime.source};
fs.writeFileSync(path.join(root,'audit/berlin-reference-glb-validation.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
