'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v131');
const h=fs.readFileSync(path.join(stage,'candidate.html'),'utf8'),scope=vm.createContext({console});
vm.runInContext([...h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('three.js r156 (MIT)'))[1],scope);
scope.atob=s=>Buffer.from(s,'base64').toString('binary');scope.BERLIN_REFERENCE_ARCHITECTURE=JSON.parse(fs.readFileSync(path.join(root,'assets/models/berlin-reference-architecture-v1.json')));
vm.runInContext(fs.readFileSync(path.join(root,'tools/berlin_packed_geometry.js'),'utf8'),scope);
vm.runInContext(fs.readFileSync(path.join(stage,'sources/berlin_kiez_kit.js'),'utf8'),scope);
const T=scope.THREE,noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
const kit=scope.createBerlinKiezKit(T,(color,opts)=>new T.MeshStandardMaterial({color,...opts}),(width,height)=>({width,height,getContext:()=>ctx}));
let rays=0;
for(const width of [11,13.5,16])for(const side of [-1,1]){
  const g=kit.geometry(width,0,side),range=g.userData.bicycleFaces;
  assert.equal(g.userData.parkedBicycles,1);assert.equal(range[1]-range[0],288);
  assert.ok(g.index.count/3<27000);assert.equal(g.groups.length,1,'bicycle remains in the existing facade draw');
  const indices=Array.from(g.index.array.slice(range[0]*3,range[1]*3)),bike=new T.BufferGeometry();
  bike.setAttribute('position',g.attributes.position);bike.setIndex(indices);
  const p=g.attributes.position;
  const ys=indices.map(i=>p.getY(i)),xs=indices.map(i=>p.getX(i)),zs=indices.map(i=>p.getZ(i));
  assert.ok(Math.min(...ys)>=.159&&Math.min(...ys)<.17,'tyres meet the 16 cm sidewalk');
  assert.ok(Math.max(...ys)<1.30&&Math.min(...xs)>-width/2&&Math.max(...xs)<width/2,'realistic bicycle fits the lot');
  assert.ok(Math.min(...zs)>.9&&Math.max(...zs)<1.3,'clear of masonry and road');
  const mesh=new T.Mesh(bike,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld(true);
  const bx=side*(-width/2+1.10);
  for(const wx of [-.63,.63]){
    const hole=new T.Raycaster(new T.Vector3(bx+wx+.12,.64,3),new T.Vector3(0,0,-1)).intersectObject(mesh);
    assert.equal(hole.length,0,'tyre remains an open ring between spokes');
    const tyre=new T.Raycaster(new T.Vector3(bx+wx,.884,3),new T.Vector3(0,0,-1)).intersectObject(mesh);
    assert.ok(tyre.length>0,'visible rubber surface surrounds each wheel');rays+=2;
  }
}
console.log(`PASS: six facade layouts, ${rays} wheel surface/hole rays, sidewalk contact, one shared draw and original 27k building budget.`);
