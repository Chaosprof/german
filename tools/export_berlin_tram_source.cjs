'use strict';
// Preserve the currently accepted rigid equipment for the Blender v90 tram.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-tram-v90');
const baseline=path.join(stage,'baseline');fs.mkdirSync(baseline,{recursive:true});
const target=path.join(baseline,'tram-source.json');
if(fs.existsSync(target)){console.log('Preserved baseline already exists: '+target);process.exit(0);}
const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
const section=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j);};
const c=vm.createContext({console});
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('three.js r156 (MIT)'))[1],c);
const THREE=c.THREE;c.clamp=THREE.MathUtils.clamp;
c.mat=(color,options)=>new THREE.MeshStandardMaterial({color,...options});
c.MAT={bvgYellow:c.mat(0xffcc00),metalDark:c.mat(0x23343b),tyre:c.mat(0x18232a)};
c.STATION_MAT={steel:c.mat(0x596a75)};c.PROP_TAIL=new THREE.MeshBasicMaterial({color:0xff4d3d});
c.destRollMat=new THREE.MeshBasicMaterial({color:0x151e23});
c.freezeObjectTree=root=>root.updateMatrixWorld(true);c.registerProp=(kind,root)=>root;
vm.runInContext(section('  var geoCache = Object.create(null);','  // ------------------------------------------------- generated prop swaps'),c);
const factory=section('  function makeRunnerTram() {','  function makeDeliveryMicrovan() {');
vm.runInContext(factory,c);const tram=c.makeRunnerTram();tram.updateMatrixWorld(true);
const roles=new Map([[c.makeRunnerTram.yellowMaterial,'yellow'],[c.makeRunnerTram.creamMaterial,'cream'],
  [c.makeRunnerTram.glazingMaterial,'glass'],[c.makeRunnerTram.headlampMaterial,'headlamp'],
  [c.MAT.metalDark,'dark'],[c.MAT.tyre,'tyre'],[c.STATION_MAT.steel,'steel'],[c.PROP_TAIL,'tail'],[c.destRollMat,'destination']]);
const parts=tram.children.map((part,i)=>{
  const g=part.geometry;assert.ok(roles.has(part.material));
  return {name:'part_'+String(i).padStart(3,'0'),role:roles.get(part.material),
    position:Array.from(g.attributes.position.array),normal:Array.from(g.attributes.normal.array),
    uv:Array.from(g.attributes.uv.array),index:g.index?Array.from(g.index.array):Array.from({length:g.attributes.position.count},(_,j)=>j),
    matrix:part.matrix.elements,translation:part.position.toArray(),quaternion:part.quaternion.toArray(),scale:part.scale.toArray()};
});
const glass=c.makeRunnerTram.glazingMaterial.map.image;
const data={source:'Accepted makeRunnerTram before v90 Blender body',parts,
  glassTexture:{width:glass.width,height:glass.height,data:Buffer.from(glass.data).toString('base64')},
  colors:Object.fromEntries([...roles].map(([mat,role])=>[role,mat.color.getHex()])),
  triangles:parts.reduce((n,p)=>n+p.index.length/3,0)};
fs.writeFileSync(target,JSON.stringify(data));fs.writeFileSync(path.join(baseline,'makeRunnerTram.js'),factory);
console.log(`Saved ${parts.length} unbatched parts, ${data.triangles} triangles; baseline is immutable on reruns.`);
