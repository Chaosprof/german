'use strict';
// Test visible surfaces of the actual runtime model before/after material batching.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
function check(shipping=process.argv.includes('--shipping')){
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-tram-reference-v123');
const folder=shipping?path.join(root,'assets/models'):path.join(stage,'models');
const html=fs.readFileSync(shipping?path.join(root,'berlin-runner.html'):path.join(stage,'candidate.html'),'utf8');
function section(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j);}
const c=vm.createContext({console});
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('three.js r156 (MIT)'))[1],c);
const T=c.THREE;c.atob=s=>Buffer.from(s,'base64').toString('binary');c.clamp=T.MathUtils.clamp;
c.mat=(color,options)=>new T.MeshStandardMaterial({color,...options});
c.MAT={metalDark:c.mat(0x23343b),tyre:c.mat(0x18232a)};c.STATION_MAT={steel:c.mat(0x596a75)};
c.PROP_TAIL=new T.MeshBasicMaterial({color:0xff4d3d});c.destRollMat=new T.MeshBasicMaterial();
c.freezeObjectTree=g=>g.updateMatrixWorld(true);c.registerProp=(_,g)=>g;
for(const s of [section('  var geoCache = Object.create(null);','  // ------------------------------------------------- generated prop swaps'),
 section('  function mergeBoxes(specs) {','\n  // DRAW-CALL CONSOLIDATION:'),section('  var staticMergeGeometryCache = new Map();','  // Merges building parts that carry different materials'),
 fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8'),section('var BERLIN_VINTAGE_TRAM_DATA = ','  function makeRunnerTram() {'),
 section('  function makeRunnerTram() {','  function makeDeliveryMicrovan() {')])vm.runInContext(s,c);
const data=c.BERLIN_VINTAGE_TRAM_DATA,model=c.makeRunnerTram();model.updateMatrixWorld(true);
assert.equal(data.finishRevision,'rounded-reference-coach-v123');
assert.equal(JSON.stringify(data),JSON.stringify(JSON.parse(fs.readFileSync(path.join(folder,'berlin-vintage-tram-v90.json')))));
const inline=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(folder,'berlin-vintage-tram-v90.inline.js'),'utf8'),inline);
assert.equal(JSON.stringify(inline.BERLIN_VINTAGE_TRAM_DATA),JSON.stringify(data));
assert.deepEqual(JSON.parse(JSON.stringify(data.collisionContract)),{halfW:1.25,halfD:4,yMin:0,yMax:3.15});
const bounds=new T.Box3().setFromObject(model);
assert.ok(bounds.min.x>=-1.25&&bounds.max.x<=1.25&&bounds.min.y>=-.00001&&bounds.max.y<=4.52&&bounds.min.z>=-4&&bounds.max.z<=4);
assert.ok(bounds.max.y>4.3,'tall overhead pantograph');
const total=model.children.reduce((n,m)=>n+m.geometry.index.count/3,0);assert.ok(total<=8200,'no geometry cost increase over V122');
for(const m of model.children){const {position:p,normal:n,uv}=m.geometry.attributes;
 for(let i=0;i<p.count;i++){assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)+uv.getX(i)+uv.getY(i)));assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.002);}
 for(const index of m.geometry.index.array)assert.ok(index<p.count);
}
const ray=new T.Raycaster(),checks=[];
function probe(origin,direction,material,label){ray.set(new T.Vector3(...origin),new T.Vector3(...direction));const hit=ray.intersectObject(model,true)[0];
 assert.ok(hit&&hit.object.material===material,label+' got '+(hit&&hit.object.userData.tramPart));checks.push({origin,direction,material,label,point:hit.point.clone()});return hit.point;}
const glass=c.makeRunnerTram.glazingMaterial,dark=c.MAT.metalDark,cream=c.makeRunnerTram.creamMaterial,yellow=c.makeRunnerTram.yellowMaterial;
assert.equal(glass.transparent,false);assert.equal(glass.map.image.width,128);assert.equal(glass.map.image.height,128);
const pixels=glass.map.image.data;assert.ok(Array.from(pixels).filter((_,i)=>i%4===3).every(x=>x===255),'one opaque reflection/cabin map');
for(const end of [-1,1]){
 for(const x of [-.68,-.32,.32,.68])for(const y of [1.67,2,2.4])probe([x,y,end*9],[0,0,-end],glass,'clear rounded cab glazing');
 probe([0,2.08,end*9],[0,0,-end],dark,'thin dark divider');
 probe([.045,2.08,end*9],[0,0,-end],glass,'glass close to divider');
 probe([-.045,2.08,end*9],[0,0,-end],glass,'glass close to divider');
 for(const x of [-.785,.785]){
   probe([x,.81,end*9],[0,0,-end],c.makeRunnerTram.headlampMaterial,'small low ivory lamp');
   probe([x+.078,.81,end*9],[0,0,-end],dark,'dark lamp rim');
   probe([x,.97,end*9],[0,0,-end],yellow,'lamp is small, with yellow coachwork above');
 }
 probe([0,2.58,end*9],[0,0,-end],c.destRollMat,'route inside cab header');
 const centre=probe([0,1.13,end*9],[0,0,-end],yellow,'curved nose centre');
 const shoulder=probe([.93,1.13,end*9],[0,0,-end],yellow,'curved nose shoulder');
 assert.ok(end*(centre.z-shoulder.z)>.11,'coachwork rolls back at both corners');
 probe([0,2.795,end*9],[0,0,-end],cream,'thin cream roof lip');
}
for(const side of [-1,1])for(let i=0;i<9;i++){
 const z=-2.96+i*.74;
 for(const y of [1.78,2.28,2.55])probe([side*4,y,z+.13],[-side,0,0],glass,'tall side window '+i);
}
const centreRoof=probe([0,6,-2.75],[0,-1,0],c.makeRunnerTram.roofMaterial,'blue-grey barrel roof centre');
const roofShoulder=probe([.92,6,-2.75],[0,-1,0],c.makeRunnerTram.roofMaterial,'rounded barrel roof shoulder');
assert.ok(centreRoof.y-roofShoulder.y>.12,'rounded roof cross-section');
c.compactStaticPropGroup(model);model.updateMatrixWorld(true);
assert.equal(model.children.length,9);assert.ok(model.children.every(m=>!m.material.transparent&&m.castShadow));
for(const p of checks){ray.set(new T.Vector3(...p.origin),new T.Vector3(...p.direction));const hit=ray.intersectObject(model,true)[0];
 assert.ok(hit&&hit.object.material===p.material&&hit.point.distanceTo(p.point)<.00002,'batch preserves '+p.label);}
c.registerProp=(_,g)=>{c.compactStaticPropGroup(g);return g;};const second=c.makeRunnerTram(),clone=second.clone(true);
assert.ok(second.children.every((m,i)=>m.geometry===model.children[i].geometry&&m.material===model.children[i].material));
assert.ok(clone.children.every((m,i)=>m.geometry===second.children[i].geometry&&m.material===second.children[i].material));
const result={passed:true,shipping,triangles:total,draws:9,visibilityRays:checks.length,collisionContract:JSON.parse(JSON.stringify(data.collisionContract)),bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
fs.writeFileSync(path.join(stage,shipping?'shipping-check.json':'geometry-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));return result;
}
module.exports=check;if(require.main===module)check();
