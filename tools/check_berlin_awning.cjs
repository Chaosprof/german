'use strict';
// Validate the staged candidate, or the installed canonical assets with --canonical.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-awning-v71');
const modelRoot=process.argv.includes('--canonical')?path.join(root,'assets/models'):path.join(stage,'models');
const data=JSON.parse(fs.readFileSync(path.join(modelRoot,'berlin-reference-architecture-v1.json')));
const contact=process.argv.includes('--contact');
function sameStructure(a,b){for(const key of Object.keys(a))if(key!=='color')assert.deepEqual(a[key],b[key],'approved '+key+' is preserved');}
if(process.argv.includes('--canonical')){
  const reviewed=JSON.parse(fs.readFileSync(path.join(stage,'models/berlin-reference-architecture-v1.json'))).meshes;
  for(const [key,record]of Object.entries(data.meshes)){
    if(contact&&['13.5:0:1','13.5:1:1'].includes(key))sameStructure(record,reviewed[key]);
    else assert.deepEqual(record,reviewed[key],'installed mesh matches the reviewed awning candidate');
  }
}
const before=JSON.parse(fs.readFileSync(path.join(stage,'baseline/berlin-reference-architecture-v1.json')));
const report=JSON.parse(fs.readFileSync(path.join(stage,'validation.json')));
for(const [key,record]of Object.entries(before.meshes))if(key!=='13.5:0:1'){
  if(contact&&key==='13.5:1:1')sameStructure(data.meshes[key],record);
  else assert.ok(JSON.stringify(record)===JSON.stringify(data.meshes[key]),'other master changed: '+key);
}
assert.equal(report.unchanged_nonfabric_triangles,14917);
assert.equal(report.new_cloth_triangles,1756);assert.equal(report.after_bakery_triangles,16673);
assert.equal(report.runtime_noncloth_normals_byte_identical,true);
assert.equal(report.new_draws,0);assert.equal(report.new_materials,0);
assert.deepEqual(data.meshes['13.5:0:1'].min,before.meshes['13.5:0:1'].min);
assert.deepEqual(data.meshes['13.5:0:1'].max,before.meshes['13.5:0:1'].max);
const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('three.js r156 (MIT)'))[1];
const scope=vm.createContext({console});vm.runInContext(source,scope);const THREE=scope.THREE;
scope.atob=s=>Buffer.from(s,'base64').toString('binary');scope.BERLIN_REFERENCE_ARCHITECTURE=data;
vm.runInContext(fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8'),scope);
vm.runInContext(fs.readFileSync(path.join(__dirname,'berlin_kiez_kit.js'),'utf8'),scope);
const noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
const kit=scope.createBerlinKiezKit(THREE,(color,options)=>new THREE.MeshStandardMaterial({color,...options}),()=>({getContext:()=>ctx}));
const cell=uv=>Math.floor(uv.x*4)+4*Math.floor((1-uv.y)*4);
let stripeRays=0,shopRays=0;
for(const width of [11,13.5,16])for(const side of [-1,1]){
  const g=kit.geometry(width,0,side),mesh=new THREE.Mesh(g,kit.material),scale=width/13.5;
  assert.equal(g,kit.geometry(width,0,side));assert.equal(g.groups.length,1);
  assert.equal(g.index.count/3,16673);
  for(let i=0;i<g.attributes.normal.count;i++)assert.ok(Math.abs(Math.hypot(g.attributes.normal.getX(i),g.attributes.normal.getY(i),g.attributes.normal.getZ(i))-1)<.002);
  const aw=6.8425,center=-2.77525;
  for(let band=0;band<12;band++){
    const x=(center-aw/2+(band+.5)*aw/12)*scale*side;
    const hit=new THREE.Raycaster(new THREE.Vector3(x,8,1.175),new THREE.Vector3(0,-1,0)).intersectObject(mesh)[0];
    assert.ok(hit&&Math.abs(hit.point.y-4.705)<.003,'shallow cloth bow retains the intended slope and anchors');
    assert.equal(cell(hit.uv),0,'fabric uses the existing clean white atlas cell');
    assert.ok(hit.face.normal.y>.70&&hit.face.normal.z>.64,'upward/forward cloth normals');
    const col=g.attributes.color,ratio=col.getX(hit.face.a)/col.getY(hit.face.a);
    assert.ok(band%2?ratio>1.8:ratio<1.4,'twelve broad cream/coral bands alternate');stripeRays++;
    const hem=new THREE.Raycaster(new THREE.Vector3(x,3.53,3),new THREE.Vector3(0,0,-1)).intersectObject(mesh)[0];
    assert.ok(hem&&hem.point.z>2.16,'rounded scallop hangs to its original envelope');
    const below=new THREE.Raycaster(new THREE.Vector3(x,3.49,3),new THREE.Vector3(0,0,-1)).intersectObject(mesh)[0];
    assert.ok(!below||below.point.z<2.1,'awning does not grow below the original3.51m hem');
  }
  for(const shopX of [-2.77525,2.396]){
    const hit=new THREE.Raycaster(new THREE.Vector3((shopX+.18)*scale*side,2.65,4),new THREE.Vector3(0,0,-1)).intersectObject(mesh)[0];
    assert.ok(hit&&cell(hit.uv)===5&&hit.point.z<0,'bakery openings still expose the unchanged interior');shopRays++;
  }
}
const glb=fs.readFileSync(path.join(modelRoot,'berlin-reference-architecture-v1.glb'));
const gltf=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString('utf8'));
assert.equal(gltf.materials.length,1);assert.ok(gltf.meshes.every(m=>m.primitives.length===1&&m.primitives[0].attributes.COLOR_0!==undefined));
console.log(`PASS: ${stripeRays} stripe/bow/hem rays and ${shopRays} storefront rays across six width/side variants; unchanged master bounds, one material/draw, GLB colors; bakery16673tri (+284).`);
