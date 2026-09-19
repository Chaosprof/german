'use strict';
// Stage-only geometry, overhead and actual scheduler verification. No capture.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-tram-roof-v103'),base=path.join(stage,'baseline'),out=path.join(stage,'models');
const prefix='berlin-vintage-tram-v90',html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
const before=JSON.parse(fs.readFileSync(path.join(base,prefix+'.json'))),data=JSON.parse(fs.readFileSync(path.join(out,prefix+'.json')));
const manifest=JSON.parse(fs.readFileSync(path.join(stage,'transform-manifest.json')));
const ids=[63,64,65,66,67,68,69,70,71,72,75,76,77,78,81,82,83,84,85],targets=new Set(ids.map(i=>'part_'+String(i).padStart(3,'0')));
const section=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,a);return html.slice(i,j);};
const c=vm.createContext({console});
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('three.js r156 (MIT)'))[1],c);
const T=c.THREE;c.atob=s=>Buffer.from(s,'base64').toString('binary');c.clamp=T.MathUtils.clamp;
c.mat=(color,opts)=>new T.MeshStandardMaterial({color,...opts});
c.MAT={metalDark:c.mat(0x23343b),tyre:c.mat(0x18232a)};c.STATION_MAT={steel:c.mat(0x596a75)};
c.PROP_TAIL=new T.MeshBasicMaterial({color:0xff4d3d});c.destRollMat=new T.MeshBasicMaterial();
c.freezeObjectTree=g=>g.updateMatrixWorld(true);c.registerProp=(kind,g)=>g;
for(const s of [section('  var geoCache = Object.create(null);','  // ------------------------------------------------- generated prop swaps'),
  section('  function mergeBoxes(specs) {','\n  // DRAW-CALL CONSOLIDATION:'),
  section('  var staticMergeGeometryCache = new Map();','  // Merges building parts that carry different materials'),
  fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8'),
  fs.readFileSync(path.join(out,prefix+'.inline.js'),'utf8'),
  section('  function makeRunnerTram() {','  function makeDeliveryMicrovan() {')])vm.runInContext(s,c);
assert.deepEqual(data.meshes,before.meshes,'every packed position, normal, UV, index and mesh bound is byte-identical');
assert.deepEqual(data.colors,before.colors);assert.deepEqual(data.glassTexture,before.glassTexture);
assert.deepEqual(manifest.targetParts,[...targets].sort());
let protectedParts=0;
data.parts.forEach((p,i)=>{assert.equal(p.mesh,before.parts[i].mesh);assert.equal(p.role,before.parts[i].role);
  if(!targets.has(p.mesh)){assert.deepEqual(p,before.parts[i]);protectedParts++;}
});assert.equal(protectedParts,101);
const tram=c.makeRunnerTram();tram.updateMatrixWorld(true);
const meshes=new Map(tram.children.map(m=>[m.userData.tramPart,m]));
const bounds=new T.Box3().setFromObject(tram),close=(a,b,e=2e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
assert.ok(bounds.min.x>=-1.25&&bounds.max.x<=1.25&&bounds.min.z>=-4&&bounds.max.z<=4&&bounds.min.y>=0);
close(bounds.max.y,4.10,2e-7);
assert.deepEqual(data.collisionContract,{halfW:1.25,halfD:4,yMin:0,yMax:3.15});
for(const id of [63,68]){const name='part_'+String(id).padStart(3,'0'),b=new T.Box3().setFromObject(meshes.get(name));close(b.min.y,2.845);close(b.max.y,3.12);
  const expected=JSON.parse(JSON.stringify(before.parts.find(p=>p.mesh===name)));expected.translation[1]=2.845+.275/2;expected.scale[1]=2.75;
  assert.deepEqual(data.parts.find(p=>p.mesh===name),expected);
}
for(const id of [64,65,66,67,69,70,71,72]){const name='part_'+String(id).padStart(3,'0');
  const expected=JSON.parse(JSON.stringify(before.parts.find(p=>p.mesh===name)));expected.translation[1]+=.175;
  assert.deepEqual(data.parts.find(p=>p.mesh===name),expected);
}
const expectedBow=JSON.parse(JSON.stringify(before.parts.find(p=>p.mesh==='part_085')));expectedBow.translation[1]=4.085;
assert.deepEqual(data.parts.find(p=>p.mesh==='part_085'),expectedBow);
for(const row of manifest.rodJoints){const m=meshes.get(row.part),r=data.meshes[row.part],mid=new T.Vector3();
  close((r.max[0]-r.min[0])*m.scale.x,.04);close((r.max[2]-r.min[2])*m.scale.z,.04);
  const lo=new T.Vector3(0,r.min[1],0).applyMatrix4(m.matrixWorld),hi=new T.Vector3(0,r.max[1],0).applyMatrix4(m.matrixWorld);
  assert.ok(lo.distanceTo(new T.Vector3().fromArray(row.from))<2e-6);assert.ok(hi.distanceTo(new T.Vector3().fromArray(row.to))<2e-6);
}
const triangles=tram.children.reduce((n,m)=>n+m.geometry.index.count/3,0);assert.equal(triangles,7796);
assert.equal(new Set(tram.children.map(m=>m.material)).size,9);
for(const name of ['makeScaffold','makeCafeCanopy','makeSkip','makeLuggageTrolley','makeMaintenanceCluster','makeRoadworksCar'])c[name]=()=>new T.Group();
c.LANE_W=3;c.LANES=[3,0,-3];c.ROAD_HALF=7.2;
vm.runInContext(section('  var OB_KINDS = [','  function registerObstacleTemplateClone(root) {'),c);
assert.deepEqual(JSON.parse(JSON.stringify(c.OB_KINDS[3],(k,v)=>typeof v==='function'?undefined:v)),{name:'tram',kind:'block',halfW:1.25,halfD:4,yMin:0,yMax:3.15});

// Execute the shipped gate and arch geometry, including actual bevels/rings.
c.gatePostX=c.ROAD_HALF+.42;c.kiezGateFrame=null;
vm.runInContext(section('  function getKiezGateFrame() {','  // ---------------------------------------------------- gate frame variants'),c);
const frame=c.getKiezGateFrame(),gate=new T.Group();
gate.add(new T.Mesh(frame.beam,frame.beamMat),new T.Mesh(frame.accent,frame.accentMat));gate.updateMatrixWorld(true);
const gateBounds=new T.Box3().setFromObject(gate),ray=new T.Raycaster();
let signBottom=Infinity;
for(const x of c.LANES){ray.set(new T.Vector3(x,0,.16),new T.Vector3(0,1,0));const hit=ray.intersectObject(gate,true)[0];assert.ok(hit);signBottom=Math.min(signBottom,hit.point.y);}
close(signBottom,3.95,.00001);
// The gate lintel is independent of its hanging answer backing.
ray.set(new T.Vector3(0,5.10,0),new T.Vector3(0,1,0));const beamBottom=ray.intersectObject(gate,true)[0].point.y;close(beamBottom,5.40,.00001);
c.deckLift=1.10;
vm.runInContext(section("    var archGeo = cached('viaduct_masonry_arch_v4'",'    // One shared opaque material retains'),c);
const arch=new T.Mesh(c.archGeo,new T.MeshBasicMaterial());arch.updateMatrixWorld(true);
let minArchClearance=Infinity,archRays=0;
for(const lane of c.LANES)for(const mesh of tram.children.filter(m=>targets.has(m.userData.tramPart))){
  const p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);v.x+=lane;v.y+=.02;
    // Sweep every authored roof vertex through both faces and the barrel.
    for(const z of [-2.45,-2.30,0,2.30,2.45]){
      ray.set(new T.Vector3(v.x,v.y,z),new T.Vector3(0,1,0));const hit=ray.intersectObject(arch)[0];
      if(hit){minArchClearance=Math.min(minArchClearance,hit.distance);archRays++;}
    }
  }
}
assert.ok(archRays>1000&&minArchClearance>3.3);
vm.runInContext(section('  var catenaryWireGeo = (function () {','  var outlineWireDetails ='),c);
const wireMinY=c.catenaryWireGeo.attributes.position.array.filter((v,i)=>i%3===1).reduce((a,b)=>Math.min(a,b),Infinity);
const wireClearance=wireMinY-(bounds.max.y+.02);assert.ok(wireClearance>2.7);

// Audit all production call sites, not just the opening screenshot placement.
const calls=[...html.matchAll(/\bspawnObstacle\(([^,()]+),/g)].map(m=>m[1].trim()).filter(a=>a!=='specIdx');
assert.deepEqual(calls,['0','0','3','blockKind','companionKind','3'],'all production spawn paths are accounted for');
const recurring=section('        var tramPadding =','        lastVerb = \'block\';');
assert.ok(recurring.includes('var tramFits = obstacleFitsQuizApproach(3, z + tramPadding, gateZ);'));
assert.ok(/if \(Math\.random\(\) < 0\.45 && tramFits && freePretzelSlots\(\) >= 5 && freeObstacleSlots\(\) > 0\) \{\s*z \+= tramPadding;\s*spawnObstacle\(3, blocked, z\);/.test(recurring));
assert.ok(recurring.includes('var blockKind = randInt(1, 2);')&&recurring.includes('var companionKind = randInt(1, 2)'));
const opening=section('    // A composed opening:','\n  function showHeroLoadError()').replace(/\r\n/g,'\n').replace(/\n  }\s*$/,'');
assert.ok(/openingTramZ > player\.z \+ 24 && obstacleFitsQuizApproach\(3, openingTramZ, openingGate\.position\.z\)/.test(opening));
assert.ok(opening.includes('openingGate.position.z - GATE_CLEAR_BEFORE - OB_KINDS[3].halfD - HALF_D - 1'));
const halfD=Number(html.match(/var HALF_D = ([\d.]+);/)[1]);assert.equal(halfD,.42);
const course=vm.createContext({OB_KINDS:c.OB_KINDS,LANES:c.LANES,HALF_D:halfD,Math:Object.create(Math),
  clamp:T.MathUtils.clamp,lerp:T.MathUtils.lerp,player:{z:0},POWERUP_TYPES:['magnet','spring','shield'],spawnPowerup(){}});
let seed=1;course.Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
course.rand=(a,b)=>a+(b-a)*course.Math.random();course.randInt=(a,b)=>Math.floor(course.rand(a,b+1));
vm.runInContext(section('  function freeObstacleSlots() {','  // ========================================================= collectibles'),course);
vm.runInContext(section('  function freePretzelSlots() {','  // A diagonal reward trail'),course);
vm.runInContext(section('  var GATE_CLEAR_BEFORE = 17;','  function answerArticle('),course);
const slots=()=>Array.from({length:48},()=>({active:false,holder:{visible:false,position:new T.Vector3(),updateMatrix(){}},variants:c.OB_VISUAL_TEMPLATES.map(a=>a.map(()=>({visible:false})))}));
const rewards=()=>Array.from({length:80},()=>({active:false,sprite:{visible:false,position:new T.Vector3()}}));
let checkedCourses=0,checkedTrams=0,minScheduledGap=Infinity;
for(const speed of [13,18,26,42,54])for(const distance of [0,1400,12000])for(let s=1;s<=64;s++){
  seed=s;Object.assign(course,{speed,distance,overdriveTier:0,lastObstacleZ:9,powerupCorridorIndex:0,obstacles:slots(),pretzels:rewards()});
  const gateZ=Math.max(58,speed*2.85);course.scheduleCorridor(gateZ);checkedCourses++;
  for(const o of course.obstacles.filter(o=>o.active&&o.spec.name==='tram')){
    const gap=gateZ+gateBounds.min.z-(o.z+bounds.max.z);
    assert.ok(o.z+4+halfD<=gateZ-17+1e-9);assert.ok(gap>=17);minScheduledGap=Math.min(minScheduledGap,gap);checkedTrams++;
  }
}
assert.ok(checkedTrams>50);
let openingTrials=0,minOpeningGap=Infinity;
for(const offset of [0,500])for(const gateDistance of [49.43,50,58,74.1,120]){
  course.player.z=offset;Object.assign(course,{obstacles:slots(),pretzels:rewards(),gates:[{userData:{active:true},position:{z:offset+gateDistance}}]});
  vm.runInContext(opening,course);for(const o of course.obstacles.filter(o=>o.active)){
    const gap=offset+gateDistance+gateBounds.min.z-(o.z+bounds.max.z);assert.ok(gap>=18);minOpeningGap=Math.min(minOpeningGap,gap);openingTrials++;
  }
}
// Algebraic bound applies to every random outcome admitted by both guards.
const minimumGuardedGeometryGap=17+halfD+4-bounds.max.z+gateBounds.min.z;
assert.ok(minimumGuardedGeometryGap>17);
const clearance={ok:true,sameCollisionContract:true,tramSpawnPaths:2,allSpawnArguments:calls,
  algebra:'z + 4 + HALF_D <= gateZ - 17; actual tail <= z + 3.968455; gate front >= gateZ - 0.235',
  minimumGuardedGeometryGap,checkedCourses,checkedTrams,minScheduledGap,openingTrials,minOpeningGap,
  tramWorldTop:bounds.max.y+.02,gateBeamBottom:beamBottom,gateBeamVerticalClearance:beamBottom-bounds.max.y-.02,
  gateBackingBottom:signBottom,coLocatedGateWouldOverlap:true,archRays,minArchClearance,wireMinY,wireClearance,
  physicalWireContact:false,renderBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
fs.writeFileSync(path.join(stage,'clearance-check.json'),JSON.stringify(clearance,null,2));
console.log('ROOF PREFLIGHT PASS: '+JSON.stringify(clearance));
if(process.argv.includes('--preflight'))process.exit(0);

assert.equal(manifest.nativeStatus,'saved');assert.equal(manifest.nativeMeshPayloadsExact,119);
const oldGLB=fs.readFileSync(path.join(base,prefix+'.glb')),newGLB=fs.readFileSync(path.join(out,prefix+'.glb'));
const split=b=>({json:JSON.parse(b.subarray(20,20+b.readUInt32LE(12))),bin:b.subarray(20+b.readUInt32LE(12))});
const old=split(oldGLB),next=split(newGLB);assert.ok(old.bin.equals(next.bin));
assert.equal(crypto.createHash('sha256').update(next.bin).digest('hex'),manifest.glbBinSha256);
for(const k of Object.keys(old.json))if(k!=='nodes')assert.deepEqual(next.json[k],old.json[k]);
next.json.nodes.forEach((n,i)=>{if(!targets.has(n.name))assert.deepEqual(n,old.json.nodes[i]);else{
  const p=data.parts.find(p=>p.mesh===n.name);assert.deepEqual(n.translation,p.translation);assert.deepEqual(n.rotation,p.quaternion);assert.deepEqual(n.scale,p.scale);
}});

// Narrow, installable existing-checker updates. All original collision, trim,
// pooling, scheduler and unrelated vehicle assertions still run unchanged.
const checks=path.join(stage,'checks');fs.mkdirSync(checks,{recursive:true});
let vehicle=fs.readFileSync(path.join(base,'check_berlin_vehicles.cjs'),'utf8');
const oldInlineCheck="const tramInline='var BERLIN_VINTAGE_TRAM_DATA = '+JSON.stringify(tramData)+';';\nassert.ok(html.includes(tramInline),'the playable build contains the validated Blender tram');";
const newInlineCheck=String.raw`const tramBlock=section('  // BEGIN BLENDER VINTAGE TRAM','  // END BLENDER VINTAGE TRAM');
const tramAssignment=tramBlock.match(/^\s*\/\/ BEGIN BLENDER VINTAGE TRAM\s+var BERLIN_VINTAGE_TRAM_DATA\s*=\s*([\s\S]*);\s*$/);
assert.ok(tramAssignment,'the playable build contains one marked Blender tram data assignment');
assert.deepEqual(JSON.parse(tramAssignment[1]),tramData,'the embedded Blender tram data exactly matches the validated asset');
const tramInline=tramAssignment[0];`;
vehicle=vehicle.replace(/\r\n/g,'\n');
assert.ok(vehicle.includes(oldInlineCheck));vehicle=vehicle.replace(oldInlineCheck,newInlineCheck);
const oldBounds="  tramBounds.min.y>=0&&tramBounds.max.y<=3.15,'whole tram fits the exact lane obstacle envelope');";
assert.ok(vehicle.includes(oldBounds));
vehicle=vehicle.replace(oldBounds,"  tramBounds.min.y>=0&&Math.abs(tramBounds.max.y-4.10)<.000002,'tram decoration fits its exact 4.10 m render envelope');\nassert.equal(c.OB_KINDS[3].yMax,3.15,'roof decoration leaves the original gameplay collider unchanged');\nassert.equal(tramData.roofRevision,'raised-equipment-v103');\nconst roofBaseline=JSON.parse(fs.readFileSync(path.join(__dirname,'../audit/berlin-tram-roof-v103/baseline/berlin-vintage-tram-v90.json'),'utf8'));\nassert.deepEqual(tramData.meshes,roofBaseline.meshes,'roof pass changes no mesh vertex attributes or topology');\nconst roofEdits=new Set([63,64,65,66,67,68,69,70,71,72,75,76,77,78,81,82,83,84,85].map(i=>'part_'+String(i).padStart(3,'0')));\ntramData.parts.forEach((p,i)=>{if(!roofEdits.has(p.mesh))assert.deepEqual(p,roofBaseline.parts[i],'all non-roof transforms remain exact');});");
// These crown tests target clear roof points. Equipment is verified separately;
// changing the sample Z preserves the original full-scene occlusion assertion.
vehicle=vehicle.replace('new THREE.Vector3(x,4,0),carDown','new THREE.Vector3(x,4.5,2.5),carDown');
vehicle=vehicle.replace('exact 2.5×8×3.15 m envelope','exact 2.5×8 m footprint, 4.10 m roof render height / unchanged 3.15 m collision height');
fs.writeFileSync(path.join(checks,'check_berlin_vehicles.cjs'),vehicle);
let oldCheck=fs.readFileSync(path.join(base,'check_berlin_tram_v90.cjs'),'utf8');
oldCheck=oldCheck.replace("stage=path.join(root,'audit/berlin-tram-v90')","stage=path.join(root,'audit/berlin-tram-roof-v103')");
oldCheck=oldCheck.replace("path.join(stage,'baseline/tram-source.json')","path.join(root,'audit/berlin-tram-v90/baseline/tram-source.json')");
oldCheck=oldCheck.replace("path.join(stage,'initial/models/berlin-vintage-tram-v90.json')","path.join(stage,'baseline/berlin-vintage-tram-v90.json')");
oldCheck=oldCheck.replace("const refitted=new Set(['part_086','part_091','part_103','part_108']);","const refitted=new Set();\nconst roofEdits=new Set([63,64,65,66,67,68,69,70,71,72,75,76,77,78,81,82,83,84,85].map(i=>'part_'+String(i).padStart(3,'0')));\nassert.equal(data.roofRevision,'raised-equipment-v103');\ndata.parts.forEach((p,i)=>{if(!roofEdits.has(p.mesh))assert.equal(JSON.stringify(p),JSON.stringify(initial.parts[i]),'non-roof object transform exact');});");
oldCheck=oldCheck.replace('bounds.max.y<=3.15001','Math.abs(bounds.max.y-4.10)<.000002');
oldCheck=oldCheck.replace('  assert.equal(JSON.stringify(part.translation),JSON.stringify(before.translation));','  if(roofEdits.has(part.mesh))continue;\n  assert.equal(JSON.stringify(part.translation),JSON.stringify(before.translation));');
oldCheck=oldCheck.replace('new THREE.Vector3(x,4,.65)','new THREE.Vector3(x,4.5,2.5)');
oldCheck=oldCheck.replace('assert.ok(total<=8000)','assert.equal(total,7796)');
oldCheck=oldCheck.replace('const ray=new THREE.Raycaster()','assert.equal(preserved,65);\nconst ray=new THREE.Raycaster()');
fs.writeFileSync(path.join(checks,'check_berlin_tram_v90.cjs'),oldCheck);
fs.writeFileSync(path.join(stage,'makeRunnerTram.js'),section('  function makeRunnerTram() {','  function makeDeliveryMicrovan() {'));
const canonicalJSON=JSON.parse(fs.readFileSync(path.join(root,'assets/models',prefix+'.json')));
const canonicalBlock=section('  // BEGIN BLENDER VINTAGE TRAM','  // END BLENDER VINTAGE TRAM');
const canonicalAssignment=canonicalBlock.match(/^\s*\/\/ BEGIN BLENDER VINTAGE TRAM\s+var BERLIN_VINTAGE_TRAM_DATA\s*=\s*([\s\S]*);\s*$/);
assert.ok(canonicalAssignment);assert.deepEqual(JSON.parse(canonicalAssignment[1]),canonicalJSON);
const stageHTML=html.replace(canonicalBlock,'  // BEGIN BLENDER VINTAGE TRAM\nvar BERLIN_VINTAGE_TRAM_DATA = '+JSON.stringify(data)+';\n');
const virtualFS=Object.create(fs);
virtualFS.readFileSync=(file,...args)=>{
  const resolved=path.resolve(file);
  if(resolved===path.join(root,'berlin-runner.html'))return args[0]?stageHTML:Buffer.from(stageHTML);
  if(resolved===path.join(root,'assets/models',prefix+'.json'))return fs.readFileSync(path.join(out,prefix+'.json'),...args);
  return fs.readFileSync(file,...args);
};
for(const [name,source]of [['check_berlin_tram_v90.cjs',oldCheck],['check_berlin_vehicles.cjs',vehicle]]){
  const log=[];const fixture=vm.createContext({require:n=>n==='fs'?virtualFS:require(n),__dirname:path.join(root,'tools'),
    console:{log:(...a)=>{log.push(a.join(' '));console.log(...a);}},Buffer,process,performance});
  vm.runInContext(source,fixture,{filename:name});
  fs.writeFileSync(path.join(stage,name+'.log'),log.join('\n')+'\n');
}
fs.writeFileSync(path.join(stage,'validation.json'),JSON.stringify({ok:true,triangles,draws:9,packedRecordsExact:120,
  protectedPartTransforms:101,unchangedOriginalNonCabEquipment:65,glbBinExact:true,nativeMeshPayloadsExact:119,
  nativeProtectedTransformsExact:100,collisionHeight:3.15,renderTop:bounds.max.y,clearanceChecks:'clearance-check.json',
  existingTramCheckerPassed:true,existingVehicleCheckerPassed:true,noCanonicalWrites:true},null,2));
console.log('ROOF V103 VALIDATED; staged checker copies are ready for parent review.');
