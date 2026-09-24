'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v135'),name='berlin-reference-architecture-v1';
const targetKeys=['13.5:0:1','13.5:1:1'];
function decode(record){return Object.fromEntries([['position',Float32Array],['normal',Int16Array],['uv',Float32Array],['color',Uint8Array],['index',Uint16Array]].map(([key,Type])=>{const b=Buffer.from(record[key],'base64');return[key,new Type(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))];}));}
function validate(data,before){
  const report={};assert.deepEqual(Object.keys(data.meshes),Object.keys(before.meshes));
  for(const [key,record] of Object.entries(data.meshes)){
    const original=before.meshes[key];
    if(!targetKeys.includes(key)){assert.deepEqual(record,original,key+' remains exact');continue;}
    assert.equal(record.contactRevision,'stone-and-plaster-local-v135');
    const normalized={...record,color:original.color};delete normalized.contactRevision;
    assert.deepEqual(normalized,original,'only existing color bytes and bake metadata may change');
    assert.equal(record.color.length,original.color.length,'no added geometry memory');
    const a=decode(original),b=decode(record);let changed=0,protectedGround=0,protectedCloth=0,stone=0,plaster=0;
    for(let i=0;i<record.vertices;i++){
      const tile=Math.floor(a.uv[i*2]*4)+4*Math.floor((1-a.uv[i*2+1])*4),y=a.position[i*3+1];
      const untouched=Buffer.from(a.color.slice(i*3,i*3+3)).equals(Buffer.from(b.color.slice(i*3,i*3+3)));
      if(y<4.7){assert.ok(untouched,'accepted ground-storey paint stays exact');protectedGround++;}
      if(key==='13.5:0:1'&&i>=original.awningBaseVertices){assert.ok(untouched,'continuous awning stays exact');protectedCloth++;}
      if(untouched)continue;
      assert.ok(tile===0||tile===1,'glass, shop images, roof tiles and lettering protected');
      if(tile===0){assert.ok(a.color[i*3]>=a.color[i*3+1]&&a.color[i*3+1]>=a.color[i*3+2]&&a.color[i*3]>100&&a.color[i*3]-a.color[i*3+2]<110,'only pale warm stone receives neutral-tile contact');stone++;}else plaster++;
      for(let c=0;c<3;c++){const from=a.color[i*3+c],to=b.color[i*3+c];assert.ok(to<=from&&to>=from*.64-.51,'bounded occlusion without new highlights');}
      changed++;
    }
    assert.ok(changed>5000&&stone>1000&&plaster>1000,'both stone and upper plaster have a substantive bake');
    report[key]={changed,stone,plaster,protectedGround,protectedCloth,triangles:record.triangles,vertices:record.vertices};
  }
  return report;
}
module.exports={validate};
if(require.main===module){
  const before=JSON.parse(fs.readFileSync(path.join(stage,'baseline',name+'.json'),'utf8'));
  const dir=path.resolve(root,process.env.BERLIN_ARCHITECTURE_DIR||'audit/berlin-parity-v135/models');
  const data=JSON.parse(fs.readFileSync(path.join(dir,name+'.json'),'utf8')),report=validate(data,before);
  const html=fs.readFileSync(path.resolve(root,process.env.BERLIN_HTML||'audit/berlin-parity-v135/candidate.html'),'utf8');
  const baselineHtml=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
  const pattern=/var BERLIN_REFERENCE_ARCHITECTURE = (\{[^\r\n]*\});/;
  assert.equal(html.replace(pattern,'ARCHITECTURE').replace("'kiez-reference-v135'","'kiez-reference-v134'"),baselineHtml.replace(pattern,'ARCHITECTURE'),'all rendering, shaders, gameplay and scheduling code stays byte-exact');
  const packed=JSON.parse(html.match(pattern)[1]);
  assert.deepEqual(packed,require('./install_reference_architecture.cjs').packReferenceArchitecture(data));
  const ctx=vm.createContext({console,atob:s=>Buffer.from(s,'base64').toString('binary')});
  vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('three.js r156 (MIT)')),ctx);
  for(const file of ['berlin_packed_geometry.js','berlin_kiez_kit.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),ctx);
  const T=ctx.THREE,noop=()=>{},canvasContext=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
  function make(data){ctx.BERLIN_REFERENCE_ARCHITECTURE=data;const kit=ctx.createBerlinKiezKit(T,(c,o)=>new T.MeshStandardMaterial({color:c,...o}),()=>({getContext:()=>canvasContext}));const records={};for(const w of [11,13.5,16])for(let v=0;v<6;v++)for(const s of [-1,1])records[[w,v,s]]=kit.geometry(w,v,s);return records;}
  const a=make(before),b=make(packed);let layouts=0,alphaSamples=0;
  for(const key of Object.keys(a)){
    const ga=a[key],gb=b[key];assert.deepEqual(gb.groups,ga.groups);assert.deepEqual(gb.userData,ga.userData);
    for(const attr of Object.keys(ga.attributes)){
      const aa=ga.attributes[attr],bb=gb.attributes[attr];assert.equal(bb.array.byteLength,aa.array.byteLength);
      if(attr!=='color')assert.deepEqual(bb.array,aa.array,key+' exact '+attr);
      else for(let i=0;i<aa.count;i++){assert.equal(bb.getW(i),aa.getW(i),'existing room-light alpha mask stays exact');alphaSamples++;}
    }
    assert.deepEqual(gb.index.array,ga.index.array);assert.deepEqual(gb.boundingBox,ga.boundingBox);assert.deepEqual(gb.boundingSphere,ga.boundingSphere);layouts++;
  }
  // Read the actual GLB and compare triangle-corner paint/UV/position to the
  // runtime. Exporter splits hard normals, so indices themselves may differ.
  const glb=fs.readFileSync(path.join(dir,name+'.glb'));let gltf,binary;
  for(let off=12;off<glb.length;){const len=glb.readUInt32LE(off),type=glb.readUInt32LE(off+4),chunk=glb.subarray(off+8,off+8+len);if(type===0x4e4f534a)gltf=JSON.parse(chunk);if(type===0x004e4942)binary=chunk;off+=8+len;}
  function access(id,doc=gltf,bin=binary){const a=doc.accessors[id],v=doc.bufferViews[a.bufferView],size={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],fmt={5121:[1,'readUInt8',255],5123:[2,'readUInt16LE',65535],5125:[4,'readUInt32LE',4294967295],5126:[4,'readFloatLE',1]}[a.componentType];return {count:a.count,get:(i,k)=>bin[fmt[1]]((v.byteOffset||0)+(a.byteOffset||0)+i*(v.byteStride||size*fmt[0])+k*fmt[0])/(a.normalized?fmt[2]:1)};}
  const signature=(p,uv,c)=>p.concat(uv).map(v=>Math.round(v*1e5)).join(',')+'|'+c.map(v=>Math.round(v*255)).join(',');
  const triangles=(index,corner)=>{const out=[];for(let f=0;f<index.length;f+=3)out.push([0,1,2].map(k=>corner(index[f+k])).sort().join(';'));return out.sort();};
  const baselineGlb=fs.readFileSync(path.join(stage,'baseline',name+'.glb'));let baselineDoc,baselineBin;
  for(let off=12;off<baselineGlb.length;){const len=baselineGlb.readUInt32LE(off),type=baselineGlb.readUInt32LE(off+4),chunk=baselineGlb.subarray(off+8,off+8+len);if(type===0x4e4f534a)baselineDoc=JSON.parse(chunk);if(type===0x004e4942)baselineBin=chunk;off+=8+len;}
  function normalError(raw,p,n,uv,c){
    const normalsByCorner=new Map();
    for(let i=0;i<raw.position.length/3;i++){
      const s=signature(Array.from(raw.position.slice(i*3,i*3+3)),Array.from(raw.uv.slice(i*2,i*2+2)),Array.from(raw.color.slice(i*3,i*3+3),v=>v/255));
      if(!normalsByCorner.has(s))normalsByCorner.set(s,[]);
      normalsByCorner.get(s).push(Array.from(raw.normal.slice(i*3,i*3+3),v=>v/32767));
    }
    let maximum=0;
    for(let i=0;i<p.count;i++){
      const s=signature([0,1,2].map(k=>p.get(i,k)),[uv.get(i,0),1-uv.get(i,1)],[0,1,2].map(k=>c.get(i,k)));
      const candidates=normalsByCorner.get(s);assert.ok(candidates,'native normal has a matching painted runtime corner');
      maximum=Math.max(maximum,Math.min(...candidates.map(v=>Math.hypot(...v.map((x,k)=>x-n.get(i,k))))));
    }
    return maximum;
  }
  let glbTriangles=0;const nativeNormalPrecision={};
  for(const key of targetKeys){
    const node=gltf.nodes.find(n=>n.extras?.runtime_key===key),mesh=gltf.meshes[node.mesh];assert.equal(mesh.primitives.length,1);
    const prim=mesh.primitives[0],p=access(prim.attributes.POSITION),n=access(prim.attributes.NORMAL),uv=access(prim.attributes.TEXCOORD_0),c=access(prim.attributes.COLOR_0),index=access(prim.indices),raw=decode(data.meshes[key]);
    const baselineNode=baselineDoc.nodes.find(n=>n.extras?.runtime_key===key),baselineAttrs=baselineDoc.meshes[baselineNode.mesh].primitives[0].attributes;
    const baselineError=normalError(decode(before.meshes[key]),...['POSITION','NORMAL','TEXCOORD_0','COLOR_0'].map(a=>access(baselineAttrs[a],baselineDoc,baselineBin)));
    const currentError=normalError(raw,p,n,uv,c);
    // The native export already differs from packed runtime normals by up to
    // 0.157 degrees in V134. Preserve that measured source
    // precision instead of treating its pre-existing quantization as a new bug.
    assert.ok(currentError<=baselineError+1e-7,'native shading precision must not worsen from the accepted source');
    nativeNormalPrecision[key]={baselineMaximumVectorError:baselineError,currentMaximumVectorError:currentError};
    const native=triangles(Array.from({length:index.count},(_,i)=>index.get(i,0)),i=>signature([0,1,2].map(k=>p.get(i,k)),[uv.get(i,0),1-uv.get(i,1)],[0,1,2].map(k=>c.get(i,k))));
    const runtime=triangles(raw.index,i=>signature(Array.from(raw.position.slice(i*3,i*3+3)),Array.from(raw.uv.slice(i*2,i*2+2)),Array.from(raw.color.slice(i*3,i*3+3),v=>v/255)));
    assert.deepEqual(native,runtime,key+' GLB contains the exact baked triangle-corner paint, UVs and positions');glbTriangles+=runtime.length;
  }
  assert.deepEqual(fs.readFileSync(path.join(dir,name+'-atlas.png')),fs.readFileSync(path.join(stage,'baseline',name+'-atlas.png')));
  if(process.argv.includes('--shipping'))for(const suffix of ['.json','.inline.js','.blend','.glb','-atlas.png'])assert.deepEqual(fs.readFileSync(path.join(root,'assets/models',name+suffix)),fs.readFileSync(path.join(stage,'models',name+suffix)));
  const result={passed:true,shipping:process.argv.includes('--shipping'),layouts,alphaSamples,glbTriangles,nativeNormalPrecision,unchangedRenderCode:true,unchangedGeometryBuffers:true,records:report};
  fs.writeFileSync(path.join(stage,'geometry-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
