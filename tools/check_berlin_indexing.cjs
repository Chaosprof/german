'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
// Reuse the real car/bus construction fixture, stopping before its culling tests.
const vehicleFixture = fs.readFileSync(path.join(__dirname,'check_berlin_vehicles.cjs'),'utf8');
const c = new Function('require','__dirname',vehicleFixture.slice(0,vehicleFixture.indexOf('const vertex ='))+';return c;')(require,__dirname);
const THREE = c.THREE;
function raw(attribute) {
  const a=attribute.array;
  return a.BYTES_PER_ELEMENT===4 ? new Uint32Array(a.buffer,a.byteOffset,a.length) : a;
}
function checkExpanded(before,after) {
  assert.ok(after.index);
  assert.equal(after.index.count,before.attributes.position.count,'triangle stream length');
  assert.equal(after.index.array.constructor.name,'Uint16Array','portable 16-bit index buffer');
  assert.deepEqual(after.groups,before.groups,'material groups retain their triangle offsets');
  assert.deepEqual(after.drawRange,before.drawRange,'partial draw range preserved');
  assert.deepEqual(Object.keys(after.attributes),Object.keys(before.attributes));
  for(const name of Object.keys(before.attributes)) {
    const a=before.attributes[name],b=after.attributes[name];
    assert.equal(a.itemSize,b.itemSize);assert.equal(a.normalized,b.normalized);
    assert.equal(a.array.constructor,b.array.constructor);assert.equal(a.gpuType,b.gpuType);
    const original=raw(a),compact=raw(b);
    for(let i=0;i<a.count;i++) for(let component=0;component<a.itemSize;component++) {
      assert.equal(compact[after.index.getX(i)*a.itemSize+component],original[i*a.itemSize+component],
        `${name}: identical raw bits at triangle-stream vertex ${i}`);
    }
  }
}
const originals=new Map(),disposals=new Map();
c.scene.traverse(mesh=>{
  const geo=mesh.geometry;
  if(!geo||!geo.userData.rigidMerged||originals.has(geo))return;
  originals.set(geo,geo.clone());disposals.set(geo,0);
  const originalPosition=geo.attributes.position;
  geo.addEventListener('dispose',()=>{
    assert.equal(geo.attributes.position,originalPosition,'old GPU attributes are still attached during disposal');
    disposals.set(geo,disposals.get(geo)+1);
  });
});
const stats=c.indexRigidSceneGeometry();
assert.ok(c.parkedCarInst.some(m=>m.geometry.index)&&c.parkedBusInst.some(m=>m.geometry.index),
  'actual car and bus material buckets are indexed');
assert.ok(stats.bytesAfter<stats.bytesBefore*0.8,'actual resident buffers shrink materially');
let checked=0;
for(const [geo,original] of originals) {
  if(!geo.index) {assert.equal(disposals.get(geo),0);continue;}
  checkExpanded(original,geo);checked+=original.attributes.position.count;
  assert.equal(disposals.get(geo),1,'shared geometry is processed once');
}
assert.equal(c.indexRigidSceneGeometry().geometries,0,'repeat warmup does not re-index or dispose again');

// Coincident vertices with distinct hard normals, UVs, fine linear colours,
// normalized surface data or signed-zero bits must remain distinct.
const seams=new THREE.BufferGeometry(),n=180;
const positions=new Float32Array(n*3),normals=new Float32Array(n*3),uvs=new Float32Array(n*2);
const colours=new Uint16Array(n*3),surface=new Uint8Array(n*2);
for(let i=0;i<n;i++) {
  const variant=i%6;
  positions[i*3]=variant===5?-0:0;
  normals[i*3+1]=1;normals[i*3]=variant===1?1e-8:0;
  uvs[i*2]=variant===2?0.25:0;
  colours[i*3]=variant===3?1001:1000;
  surface[i*2]=variant===4?128:127;
}
seams.setAttribute('position',new THREE.BufferAttribute(positions,3));
seams.setAttribute('normal',new THREE.BufferAttribute(normals,3));
seams.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
seams.setAttribute('color',new THREE.Uint16BufferAttribute(colours,3,true));
seams.setAttribute('aSurf',new THREE.Uint8BufferAttribute(surface,2,true));
seams.userData.rigidMerged=true;seams.addGroup(0,90,0);seams.addGroup(90,90,1);seams.setDrawRange(3,171);
const seamSource=seams.clone();c.indexRigidGeometry(seams);
assert.equal(seams.attributes.position.count,6,'all attribute seams and signed zeros stay distinct');
checkExpanded(seamSource,seams);

// Two distinct finite positions deliberately share the 32-bit bucket hash.
// A collision must compare full attributes, never weld by hash alone.
const hashPrefix=x=>Math.imul(Math.imul(2166136261^x,16777619),16777619);
const collisionZ=(hashPrefix(0)^hashPrefix(0x3f800000))>>>0;
const collisionArray=new Float32Array(90),collisionBits=new Uint32Array(collisionArray.buffer);
for(let i=0;i<30;i++) if(i%2) {
  collisionBits[i*3]=0x3f800000;collisionBits[i*3+2]=collisionZ;
}
assert.ok(Number.isFinite(collisionArray[5]));
const collision=new THREE.BufferGeometry();collision.userData.rigidMerged=true;
collision.setAttribute('position',new THREE.BufferAttribute(collisionArray,3));
const collisionSource=collision.clone();c.indexRigidGeometry(collision);
assert.equal(collision.attributes.position.count,2,'hash collision preserves distinct vertices');
checkExpanded(collisionSource,collision);

// Declining a geometry leaves ownership, buffers and index mode untouched.
for(const mode of ['untagged','dynamic','morph','interleaved','instanced','too-large']) {
  const geo=mode==='instanced'?new THREE.InstancedBufferGeometry():new THREE.BufferGeometry();
  const array=new Float32Array(mode==='too-large'?70002*3:90);
  if(mode==='too-large')for(let i=0;i<70002;i++)array[i*3]=i;
  geo.setAttribute('position',new THREE.BufferAttribute(array,3));
  geo.userData.rigidMerged=mode!=='untagged';
  if(mode==='dynamic')geo.attributes.position.setUsage(THREE.DynamicDrawUsage);
  if(mode==='morph')geo.morphAttributes.position=[geo.attributes.position.clone()];
  if(mode==='interleaved')geo.setAttribute('position',new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(array,3),3,0));
  const attr=geo.attributes.position;let disposed=false;geo.addEventListener('dispose',()=>disposed=true);
  assert.equal(c.indexRigidGeometry(geo),null,mode);
  assert.equal(geo.index,null);assert.equal(geo.attributes.position,attr);assert.equal(disposed,false);
}
console.log(`PASS: ${stats.geometries} actual rigid car/bus geometries; ${checked.toLocaleString()} triangle-stream vertices match bit-for-bit across every attribute; ${(100*(1-stats.bytesAfter/stats.bytesBefore)).toFixed(1)}% fewer buffer bytes; UV/normal/colour/surface seams, groups, draw ranges, GPU disposal and WebGL 1 index limits preserved.`);
