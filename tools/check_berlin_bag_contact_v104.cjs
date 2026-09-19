'use strict';
// Validate the actual baked pixels, reusable GLB and unchanged oriented surface.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-bag-contact-v104');
const dir=process.env.BERLIN_BAG_DIR?path.resolve(root,process.env.BERLIN_BAG_DIR):path.join(stage,'models');
const report=JSON.parse(fs.readFileSync(path.join(stage,'validation.json')));
for(const[name,hash]of Object.entries(report.baseline_sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(stage,'baseline',name))).digest('hex'),hash);
const file='berlin-courier-bag-v1.json',before=JSON.parse(fs.readFileSync(path.join(stage,'baseline',file))),data=JSON.parse(fs.readFileSync(path.join(dir,file)));
const array=(record,key,Type)=>{const b=Buffer.from(record[key],'base64');return new Type(b.buffer.slice(b.byteOffset,b.byteOffset+b.length));};
function surface(record){
  const p=array(record,'position',Float32Array),n=array(record,'normal',Int16Array),idx=array(record,'index',record.vertices>65535?Uint32Array:Uint16Array),out=[];
  for(let i=0;i<idx.length;i+=3){const c=[idx[i],idx[i+1],idx[i+2]].map(v=>[...p.slice(v*3,v*3+3),...n.slice(v*3,v*3+3)].join(','));out.push([c.join('|'),[c[1],c[2],c[0]].join('|'),[c[2],c[0],c[1]].join('|')].sort()[0]);}
  return out.sort();
}
let vertices=0,triangles=0;
for(const[key,r]of Object.entries(data.meshes)){
  assert.deepEqual(surface(r),surface(before.meshes[key]),key+' exact oriented geometry and normals');
  assert.deepEqual(r.min,before.meshes[key].min);assert.deepEqual(r.max,before.meshes[key].max);
  const uv=array(r,'uv',Float32Array);assert.ok([...uv].every(x=>Number.isFinite(x)&&x>0&&x<1),'padded UV islands');
  assert.ok([...array(r,'color',Uint8Array)].every(x=>x===255),'bake is not duplicated into vertex paint');
  vertices+=r.vertices;triangles+=r.triangles;
}
assert.equal(triangles,2588);assert.ok(vertices<1800);
assert.equal(data.atlas.colorSpace,'sRGB');assert.equal(data.atlas.width,256);assert.equal(data.atlas.height,256);
const png=Buffer.from(data.atlas.data,'base64');assert.deepEqual(png,fs.readFileSync(path.join(dir,'berlin-courier-bag-contact-v104.png')));
assert.equal(png.subarray(1,4).toString(),'PNG');let width,height,depth,type;const idat=[];
for(let at=8;at<png.length;){const size=png.readUInt32BE(at),name=png.subarray(at+4,at+8).toString(),p=png.subarray(at+8,at+8+size);if(name==='IHDR'){width=p.readUInt32BE(0);height=p.readUInt32BE(4);depth=p[8];type=p[9];assert.equal(p[12],0);}if(name==='IDAT')idat.push(p);at+=size+12;}
assert.equal(width,256);assert.equal(height,256);assert.equal(depth,8);assert.ok(type===2||type===6);
const bpp=type===6?4:3,stride=width*bpp,raw=zlib.inflateSync(Buffer.concat(idat)),pixels=Buffer.alloc(stride*height);
function paeth(a,b,c){const p=a+b-c,aa=Math.abs(p-a),bb=Math.abs(p-b),cc=Math.abs(p-c);return aa<=bb&&aa<=cc?a:bb<=cc?b:c;}
for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)];assert.ok(filter<=4);
  for(let x=0;x<stride;x++){const at=y*stride+x,a=x>=bpp?pixels[at-bpp]:0,b=y?pixels[at-stride]:0,c=y&&x>=bpp?pixels[at-stride-bpp]:0;
    const predictor=[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter];pixels[at]=(raw[y*(stride+1)+x+1]+predictor)&255;}
}
let min=255,max=0,shaded=0;
for(let i=0;i<pixels.length;i+=bpp){assert.equal(pixels[i],pixels[i+1]);assert.equal(pixels[i],pixels[i+2]);if(bpp===4)assert.equal(pixels[i+3],255);min=Math.min(min,pixels[i]);max=Math.max(max,pixels[i]);if(pixels[i]<245)shaded++;}
const linear=x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;};
assert.ok(linear(min)>=.745&&linear(min)<=.76,'25% maximum darkening encoded once as sRGB');assert.equal(max,255);assert.ok(shaded>1000&&shaded<60000,'localized shading and untouched broad areas');
const glb=fs.readFileSync(path.join(dir,'berlin-courier-bag-v1.glb'));assert.equal(glb.readUInt32LE(0),0x46546c67);assert.equal(glb.readUInt32LE(8),glb.length);
const size=glb.readUInt32LE(12),gltf=JSON.parse(glb.subarray(20,20+size)),binary=glb.subarray(28+size);
assert.equal(gltf.meshes.length,3);assert.equal(gltf.materials.length,1);
const mat=gltf.materials[0].pbrMetallicRoughness;const satchelFinish=process.argv.includes('--satchel-finish');
const expectedTint=satchelFinish?[0.026241221894849898,0.1714411007328226,0.18116424424986022,1]:[.03,.275,.243,1];
assert.deepEqual(mat.baseColorFactor,expectedTint);assert.ok(mat.baseColorTexture);
if(satchelFinish)assert.equal(mat.roughnessFactor,.91,'V111 canvas finish');
const image=gltf.bufferViews[gltf.images[0].bufferView];assert.deepEqual(binary.subarray(image.byteOffset||0,(image.byteOffset||0)+image.byteLength),png,'glTF uses the exact sRGB atlas');
function accessor(id,document=gltf,buffer=binary){const a=document.accessors[id],v=document.bufferViews[a.bufferView],size={VEC2:2,VEC3:3,VEC4:4,SCALAR:1}[a.type],bytes={5121:1,5123:2,5125:4,5126:4}[a.componentType],start=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||size*bytes;return {a,get(i,k=0){const at=start+i*stride+k*bytes;return a.componentType===5126?buffer.readFloatLE(at):a.componentType===5123?buffer.readUInt16LE(at):a.componentType===5125?buffer.readUInt32LE(at):buffer[at];}};}
const baselineGlb=fs.readFileSync(path.join(stage,'baseline','berlin-courier-bag-v1.glb')),baselineSize=baselineGlb.readUInt32LE(12),baselineGltf=JSON.parse(baselineGlb.subarray(20,20+baselineSize)),baselineBinary=baselineGlb.subarray(28+baselineSize);
function exportedSurface(document,buffer,node){
  const pr=document.meshes[node.mesh].primitives[0],p=accessor(pr.attributes.POSITION,document,buffer),n=accessor(pr.attributes.NORMAL,document,buffer),idx=accessor(pr.indices,document,buffer),out=[];
  for(let i=0;i<idx.a.count;i+=3){
    const c=[0,1,2].map(j=>{const v=idx.get(i+j);return [0,1,2].map(k=>p.get(v,k)).concat([0,1,2].map(k=>n.get(v,k))).join(',');});
    out.push([c.join('|'),[c[1],c[2],c[0]].join('|'),[c[2],c[0],c[1]].join('|')].sort()[0]);
  }
  return out.sort();
}
const parity={};
for(const node of gltf.nodes.filter(n=>n.mesh!==undefined)){
  const key=node.extras.runtime_key,r=data.meshes[key],pr=gltf.meshes[node.mesh].primitives[0];assert.ok(r);assert.equal(pr.material,0);
  const baselineNode=baselineGltf.nodes.find(n=>n.mesh!==undefined&&n.extras.runtime_key===key);assert.ok(baselineNode,key+' exists in immutable baseline GLB');
  assert.deepEqual(exportedSurface(gltf,binary,node),exportedSurface(baselineGltf,baselineBinary,baselineNode),key+' exact exported oriented positions and normals despite UV splits');
  for(const transform of ['matrix','translation','rotation','scale'])assert.deepEqual(node[transform],baselineNode[transform],key+' preserved GLB transform');
  const p=accessor(pr.attributes.POSITION),n=accessor(pr.attributes.NORMAL),uv=accessor(pr.attributes.TEXCOORD_0),idx=accessor(pr.indices);assert.equal(idx.a.count,r.triangles*3);
  const rp=array(r,'position',Float32Array),rn=array(r,'normal',Int16Array),ruv=array(r,'uv',Float32Array),ri=array(r,'index',Uint16Array);
  let positionError=0,normalError=0,uvError=0;
  for(let i=0;i<ri.length;i++){
    const a=ri[i],b=idx.get(i);
    for(let k=0;k<3;k++){positionError=Math.max(positionError,Math.abs(rp[a*3+k]-p.get(b,k)));normalError=Math.max(normalError,Math.abs(rn[a*3+k]/32767-n.get(b,k)));}
    uvError=Math.max(uvError,Math.abs(ruv[a*2]-uv.get(b,0)),Math.abs(1-ruv[a*2+1]-uv.get(b,1)));
  }
  assert.ok(positionError<.000006,key+' packed position precision');
  // Blender 5.2 primitive_extract.py rounds normals to ROUNDING_DIGIT=4,
  // then normalizes them. The immutable V84 GLB already differs by up to
  // 6.96e-5 from Int16 runtime normals. Exact GLB surface equality above is
  // the preservation test; this tight artifact bound also catches bad parity.
  assert.ok(normalError<.00008,key+' existing Blender export normal precision');
  assert.ok(uvError<.000002,key+' atlas UV parity with glTF V flip');
  parity[key]={positionError,normalError,uvError};
}
console.log('GLB/runtime parity:',JSON.stringify(parity));
console.log(`PASS: unchanged 2588-triangle bag; ${vertices} UV-split vertices; exact runtime and baseline GLB oriented normals/bounds; ${png.length}-byte 256px atlas, linear range ${linear(min).toFixed(4)}..1; glTF geometry/UV/tint/image parity.`);
