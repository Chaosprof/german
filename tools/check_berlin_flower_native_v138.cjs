'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.resolve(root,process.env.BERLIN_AUDIT_PHASE||'audit/berlin-parity-v138'),name='berlin-reference-architecture-v1';
function load(folder){
  const b=fs.readFileSync(path.join(stage,folder,name+'.glb'));let doc,bin;
  for(let off=12;off<b.length;){const length=b.readUInt32LE(off),type=b.readUInt32LE(off+4),value=b.subarray(off+8,off+8+length);if(type===0x4e4f534a)doc=JSON.parse(value);if(type===0x004e4942)bin=value;off+=8+length;}
  const data=JSON.parse(fs.readFileSync(path.join(stage,folder,name+'.json'),'utf8'));
  function access(id){const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],format={5121:[1,'readUInt8',255],5123:[2,'readUInt16LE',65535],5125:[4,'readUInt32LE',4294967295],5126:[4,'readFloatLE',1]}[a.componentType];return{count:a.count,get:(i,k)=>bin[format[1]]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||size*format[0])+k*format[0])/(a.normalized?format[2]:1)};}
  return {doc,data,access};
}
const a=load('baseline'),b=load('models');
for(const k of ['materials','textures','samplers'])assert.deepEqual(b.doc[k],a.doc[k],k+' exact');
const decode=r=>Object.fromEntries([['position',Float32Array],['normal',Int16Array],['color',Uint8Array],['uv',Float32Array],['index',Uint16Array]].map(([k,T])=>{const x=Buffer.from(r[k],'base64');return[k,new T(x.buffer.slice(x.byteOffset,x.byteOffset+x.byteLength))];}));
const signature=(p,uv,c)=>p.concat(uv).map(v=>Math.round(v*1e5)).join(',')+'|'+c.map(v=>Math.round(v*255)).join(',');
const triangles=(index,corner)=>{const out=[];for(let i=0;i<index.length;i+=3)out.push([0,1,2].map(k=>corner(index[i+k])).sort().join(';'));return out.sort();};
function inspect(pack,key){
  const node=pack.doc.nodes.find(n=>n.extras?.runtime_key===key),prim=pack.doc.meshes[node.mesh].primitives[0],raw=decode(pack.data.meshes[key]);
  const p=pack.access(prim.attributes.POSITION),n=pack.access(prim.attributes.NORMAL),uv=pack.access(prim.attributes.TEXCOORD_0),c=pack.access(prim.attributes.COLOR_0),index=pack.access(prim.indices);
  const runtimeCorner=i=>signature(Array.from(raw.position.slice(i*3,i*3+3)),Array.from(raw.uv.slice(i*2,i*2+2)),Array.from(raw.color.slice(i*3,i*3+3),v=>v/255));
  const nativeCorner=i=>signature([0,1,2].map(k=>p.get(i,k)),[uv.get(i,0),1-uv.get(i,1)],[0,1,2].map(k=>c.get(i,k)));
  assert.deepEqual(triangles(Array.from({length:index.count},(_,i)=>index.get(i,0)),nativeCorner),triangles(raw.index,runtimeCorner),key+' native positions, UVs, color and triangle corners');
  const lookup=new Map();
  for(let i=0;i<raw.position.length/3;i++){const k=runtimeCorner(i);if(!lookup.has(k))lookup.set(k,[]);lookup.get(k).push(Array.from(raw.normal.slice(i*3,i*3+3),v=>v/32767));}
  let max=0;
  for(let i=0;i<p.count;i++){const candidates=lookup.get(nativeCorner(i));assert.ok(candidates);max=Math.max(max,Math.min(...candidates.map(v=>Math.hypot(...v.map((x,k)=>x-n.get(i,k))))));}
  return{triangles:index.count/3,maxNormalError:max};
}
const keys=(process.env.BERLIN_NATIVE_KEYS||'13.5:0:1').split(',');
const records={};for(const key of keys){const before=inspect(a,key),after=inspect(b,key);
assert.ok(after.maxNormalError<=before.maxNormalError+1e-7,'native normal precision does not worsen');records[key]={before,after};}
assert.deepEqual(fs.readFileSync(path.join(stage,'models',name+'-atlas.png')),fs.readFileSync(path.join(stage,'baseline',name+'-atlas.png')));
const result={passed:true,...records[keys[0]],records,protectedPaintUvAndPositions:true};
fs.writeFileSync(path.join(stage,'native-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
