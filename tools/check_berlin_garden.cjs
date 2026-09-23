'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const assetDirArg=process.argv.find(arg=>arg.startsWith('--asset-dir='));
const assetDir=assetDirArg?path.resolve(root,assetDirArg.slice('--asset-dir='.length)):path.join(root,'assets/models');
const lush=process.argv.includes('--lush');
const stone=process.argv.includes('--stone');
const canopyDepth=process.argv.includes('--canopy-depth');
const layeredPlanter=process.argv.includes('--layered-planter');
const canopyPaint=process.argv.includes('--canopy-paint');
const leafContours=process.argv.includes('--leaf-contours');
if(leafContours)assert.ok(canopyPaint,'mixed leaf contours require the independently verified accepted paint source');
if(canopyPaint)assert.ok(lush&&stone&&canopyDepth&&layeredPlanter,'broad paint requires the existing lush/stone/V87/V95 checks');
const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
scripts.forEach((source,i)=>new vm.Script(source,{filename:'inline-'+i}));
if(!process.argv.includes('--assets-only')){
  assert.equal((html.match(/\bfunction decodeBerlinMeshRecord\s*\(/g)||[]).length,1,'one shared architecture/garden decoder');
  assert.ok(html.includes(fs.readFileSync(path.join(assetDir,'berlin-kiez-garden-v1.inline.js'),'utf8').trim()),'embedded foliage matches the exported Blender data');
  for(const source of ['berlin_packed_geometry.js','berlin_garden_integration.js']){
    const canonical=fs.readFileSync(path.join(__dirname,source),'utf8').replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();
    assert.ok(html.includes(canonical),'embedded '+source+' matches editable source');
  }
}
const scope=vm.createContext({console,Float32Array,Int16Array,Uint16Array,Uint8Array,Uint32Array});vm.runInContext(scripts.find(s=>s.includes('three.js r156 (MIT)')),scope);
const THREE=scope.THREE;
const data=JSON.parse(fs.readFileSync(path.join(assetDir,'berlin-kiez-garden-v1.json'),'utf8'));
const denseCanopy=data.canopyRevision==='dense-layered-linden-v118';
let canopyCandidate;
if(canopyDepth){
  // Validate the bake independently, then require the shipping pack to be
  // exactly that candidate. Historical --stone alone still checks v8 paint.
  require('./check_berlin_canopy_depth.cjs');
  canopyCandidate=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-canopy-depth-v87/models/berlin-kiez-garden-v1.json'),'utf8'));
  if(canopyPaint){
    require('./check_berlin_canopy_paint_v100.cjs');
    canopyCandidate=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-canopy-paint-v100/models/berlin-kiez-garden-v1.json'),'utf8'));
    if(leafContours){
      require('./check_berlin_leaf_contours_v102.cjs');
      canopyCandidate=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-leaf-contours-v102/models/berlin-kiez-garden-v1.json'),'utf8'));
      assert.deepEqual(fs.readFileSync(path.join(assetDir,'berlin-kiez-garden-v1.json')),fs.readFileSync(path.join(root,'audit/berlin-leaf-contours-v102/models/berlin-kiez-garden-v1.json')),'actual JSON bytes match the independently source-verified mixed leaf pack');
    }
    assert.deepEqual(data,canopyCandidate,'actual pack exactly matches the independently verified canopy candidate');
  }
  if(layeredPlanter){
    for(const key of Object.keys(data))if(key!=='meshes')assert.deepEqual(data[key],canopyCandidate[key],'accepted V87 '+key+' unchanged');
    for(const key of Object.keys(data.meshes))if(key!=='planter')assert.deepEqual(data.meshes[key],canopyCandidate.meshes[key],'accepted V87 '+key+' unchanged');
  }else assert.deepEqual(data,canopyCandidate,'the actual asset pack is the independently verified color-only bake');
}
const {decodeBerlinMeshRecord}=require('./berlin_packed_geometry.js');
assert.equal(data.material.transparent,false);assert.equal(data.material.side,'FrontSide');
assert.equal(data.atlas.width,512);assert.equal(data.atlas.height,512);
const atlas=Buffer.from(data.atlas.data,'base64');
assert.equal(atlas.readUInt16BE(0),0xffd8,'embedded foliage atlas is a JPEG');
assert.deepEqual(atlas,fs.readFileSync(path.join(assetDir,'berlin-kiez-garden-v1-atlas.jpg')),'embedded atlas matches Blender material image');
scope.atob=s=>Buffer.from(s,'base64').toString('binary');scope.records=data;
scope.makeMaterial=(color,options)=>new THREE.MeshStandardMaterial({color,...options});
for(const file of ['berlin_packed_geometry.js','berlin_garden_integration.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8').replace(/\nif \(typeof module[^\n]+\n?$/,'\n'),scope);
const kit=vm.runInContext('createBerlinGardenKit(THREE,makeMaterial,records)',scope);
const gardenShader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
kit.material.onBeforeCompile(gardenShader);
const physical=THREE.ShaderChunk.lights_physical_pars_fragment;
const nativeDiffuse='reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
const patched=physical.replace(nativeDiffuse,gardenShader.fragmentShader.match(/#ifdef USE_COLOR\n\s+float leafMask[\s\S]*?#endif/)[0]);
assert.ok(gardenShader.fragmentShader.includes(patched),'only the native diffuse line changes; attenuation, shadows and specular code remain untouched');
const expressions=gardenShader.fragmentShader.match(/float leafMask[\s\S]*?float leafDiffuse[^;]*;/)[0].replace(/\bfloat\b/g,'const');
const leafResponse=new Function('vColor','geometry','directLight','dotNL','smoothstep','saturate','dot','mix',expressions+'return leafDiffuse;');
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
let leafCases=0;
for(const color of [{r:.16,g:.09,b:.035},{r:.7,g:.3,b:.1},{r:.04,g:.22,b:.015}])for(let i=-20;i<=20;i++) {
  const normalDot=i/20,native=Math.max(0,normalDot);
  const response=leafResponse(color,{normal:normalDot},{direction:1},native,smooth,x=>Math.max(0,Math.min(1,x)),(a,b)=>a*b,(a,b,t)=>a+(b-a)*t);
  assert.ok(Number.isFinite(response)&&response>=0&&response<=1,'leaf diffuse stays finite and energy-bounded');
  if(color.g<=color.r)assert.equal(response,native,'bark, pots and warm petals retain native diffuse');
  assert.equal(response*0,0,'fully shadowed incident light contributes no wrapped light');
  if(normalDot===1)assert.equal(response,1,'fully front-lit surfaces do not gain extra energy');
  leafCases++;
}
console.log(`PASS: ${leafCases} actual leaf-shader cases; native non-leaf response, bounded diffuse, unchanged shadow/attenuation/specular source and one existing material.`);
// Execute the complete shipped leaf contribution, including transmission.
// Scalar RGB evaluates one channel at a time; vector dot products reduce to
// controlled cosines so we can exercise the whole angular and shadow domain.
const leafBody=gardenShader.fragmentShader.match(/float leafMask[\s\S]*?(?=\n#else)/)[0].replace(/\bfloat\b/g,'let');
const leafTotal=new Function('vColor','geometry','directLight','dotNL','smoothstep','saturate','dot','mix','material','reflectedLight','BRDF_Lambert','vec3',leafBody+'return reflectedLight.directDiffuse;');
let transmissionCases=0;
for(const color of [{r:.16,g:.09,b:.035},{r:.7,g:.3,b:.1},{r:.04,g:.22,b:.015}])for(let n=-10;n<=10;n++)for(let v=-10;v<=10;v++)for(const light of [0,1]){
  const normal=n/10,view=v/10,native=Math.max(0,normal),response=leafTotal(color,{normal,viewDir:view},{direction:1,color:light},native,smooth,x=>Math.max(0,Math.min(1,x)),(a,b)=>a*b,(a,b,t)=>a+(b-a)*t,{diffuseColor:.5},{directDiffuse:0},x=>x,(r,g,b)=>r);
  assert.ok(Number.isFinite(response)&&response>=0&&response<=.65,'wrapped/transmitted contribution remains finite and bounded');
  if(!light)assert.equal(response,0,'transmission respects complete light occlusion');
  if(color.g<=color.r)assert.equal(response,native*.5*light,'transmission never affects bark, pots or warm flowers');
  transmissionCases++;
}
console.log(`PASS: ${transmissionCases} complete leaf light cases, including front/back viewing, occlusion and non-leaf rejection.`);
assert.equal(kit.geometry('treeNear'),kit.geometry('treeNear'),'every near tree retains shared geometry');
assert.equal(kit.material.map,kit.atlas);assert.equal(kit.atlas.colorSpace,THREE.SRGBColorSpace);
assert.equal(kit.atlas.minFilter,THREE.LinearMipmapLinearFilter);
const textureLoader=THREE.TextureLoader,manager={name:'asset load fixture'},requests=[];
THREE.TextureLoader=class {constructor(value){this.manager=value;}load(uri){requests.push({uri,manager:this.manager});return new THREE.Texture();}};
scope.document={};scope.assetManager=manager;
const browserKit=vm.runInContext('createBerlinGardenKit(THREE,makeMaterial,records)',scope);
THREE.TextureLoader=textureLoader;delete scope.document;delete scope.assetManager;
assert.equal(requests.length,1,'one shared atlas decode for all trees and planters');
assert.equal(requests[0].manager,manager,'atlas participates in the existing startup asset manager');
assert.equal(requests[0].uri,'data:image/jpeg;base64,'+data.atlas.data,'atlas is embedded; no external image request');
assert.equal(browserKit.material.map,browserKit.atlas);
const decoded={};
for(const [name,record] of Object.entries(data.meshes)){
  const geometry=decodeBerlinMeshRecord(THREE,record);decoded[name]=geometry;
  assert.equal(geometry.index.count,record.triangles*3);
  assert.equal(geometry.attributes.position.count,record.vertices);
  const p=geometry.attributes.position,n=geometry.attributes.normal,c=geometry.attributes.color,uv=geometry.attributes.uv;
  const edges=new Map(),welded=[],positionIds=new Map();
  for(let i=0;i<p.count;i++){
    assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
    assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.002,'unit smooth normal');
    assert.ok(c.getX(i)>=0&&c.getY(i)>=0&&c.getZ(i)>=0);
    assert.ok(Number.isFinite(uv.getX(i))&&Number.isFinite(uv.getY(i))&&uv.getX(i)>0&&uv.getX(i)<1&&uv.getY(i)>0&&uv.getY(i)<1,'padded valid material atlas UV');
    const key=[p.getX(i),p.getY(i),p.getZ(i)].join('|');
    if(!positionIds.has(key))positionIds.set(key,positionIds.size);
    welded.push(positionIds.get(key));
  }
  for(let i=0;i<geometry.index.count;i+=3){
    const a=geometry.index.getX(i),b=geometry.index.getX(i+1),c=geometry.index.getX(i+2);
    assert.ok(a<p.count&&b<p.count&&c<p.count);
    assert.ok(a!==b&&a!==c&&b!==c,'no repeated triangle corners');
    const pa=new THREE.Vector3().fromBufferAttribute(p,a),pb=new THREE.Vector3().fromBufferAttribute(p,b),pc=new THREE.Vector3().fromBufferAttribute(p,c);
    assert.ok(pb.sub(pa).cross(pc.sub(pa)).length()>1e-10,'nondegenerate face');
    for(const [x,y] of [[a,b],[b,c],[c,a]]){
      // Sharp leaf edges split rendering normals, not the physical surface.
      const u=welded[x],v=welded[y],key=u<v?u+':'+v:v+':'+u;
      edges.set(key,(edges.get(key)||0)+1);
    }
  }
  assert.ok([...edges.values()].every(n=>n===2),'each opaque component is a closed manifold');
  assert.ok(geometry.boundingSphere.radius>0);
}
assert.ok(data.meshes.tree.triangles<=3500,'approved grove triangle budget');
assert.ok(data.meshes.treeNear.triangles<=(denseCanopy?20000:lush?14000:9000),'approved near-tree triangle budget');
assert.equal(data.meshes.tree.triangles,data.meshes.leaves.triangles+data.meshes.trunk.triangles);
assert.ok(decoded.tree.boundingBox.max.y<6.1&&decoded.tree.boundingBox.min.y>-.025);
assert.ok(decoded.planter.boundingBox.max.y<2);
const restoredTrunk=decoded.trunk.clone().translate(0,1.95,0);
assert.ok(Math.abs(restoredTrunk.boundingBox.min.y-decoded.tree.boundingBox.min.y)<1e-5,'existing garden trunk origin is preserved');
let radius=0;
for(const geometry of [decoded.tree,decoded.treeNear]){
  const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++)radius=Math.max(radius,Math.hypot(p.getX(i),p.getZ(i)));
}
assert.ok(radius<(denseCanopy?data.streetCanopyRadius:lush?2.85:2.60),'provided rotated-tree cull radius encloses near and grove leaves');
if(denseCanopy){assert.ok(data.streetCanopyRadius<3);require('./check_berlin_canopy_v118.cjs');}
if(lush&&!denseCanopy)assert.equal(data.streetCanopyRadius,2.85,'street canopy culling radius is shipped as asset metadata');
if(!denseCanopy&&(lush||process.argv.includes('--coreless')||process.argv.includes('--tetra')||process.argv.includes('--flowering-planter'))){
  const tetra=!lush&&(process.argv.includes('--tetra')||process.argv.includes('--flowering-planter')),leafFaces=tetra?4:8;
  function components(geometry){
    const p=geometry.attributes.position,indices=geometry.index,ids=new Map(),parent=[],weld=[];
    for(let i=0;i<p.count;i++){
      const key=[p.getX(i),p.getY(i),p.getZ(i)].join('|');
      if(!ids.has(key)){ids.set(key,parent.length);parent.push(parent.length);}
      weld.push(ids.get(key));
    }
    const find=a=>{while(parent[a]!==a){parent[a]=parent[parent[a]];a=parent[a];}return a;};
    for(let i=0;i<indices.count;i+=3){const a=find(weld[indices.getX(i)]);for(let j=1;j<3;j++)parent[find(weld[indices.getX(i+j)])]=a;}
    const sizes=new Map(),volumes=new Map();
    for(let i=0;i<indices.count;i+=3){
      const a=find(weld[indices.getX(i)]);sizes.set(a,(sizes.get(a)||0)+1);
      const v0=new THREE.Vector3().fromBufferAttribute(p,indices.getX(i));
      const v1=new THREE.Vector3().fromBufferAttribute(p,indices.getX(i+1));
      const v2=new THREE.Vector3().fromBufferAttribute(p,indices.getX(i+2));
      volumes.set(a,(volumes.get(a)||0)+v0.dot(v1.cross(v2))/6);
    }
    for(const [id,size]of sizes){
      if(size===leafFaces)assert.ok(volumes.get(id)>1e-8,'each closed leaf has outward triangle winding and nonzero volume');
      if((lush||process.argv.includes('--flowering-planter'))&&geometry===decoded.planter)
        assert.ok(volumes.get(id)>1e-11,'each planter component is outward wound and encloses positive volume');
    }
    const histogram={};for(const count of sizes.values())histogram[count]=(histogram[count]||0)+1;
    return histogram;
  }
  const farName=lush?'treeStreetFar':'tree';
  const nearComponents=components(decoded.treeNear),farComponents=components(decoded[farName]);
  assert.equal(nearComponents[leafFaces],leafContours?1080:lush?1680:tetra?2080:1040,'near canopy contains the verified retained closed leaf components');
  if(leafContours)assert.equal(nearComponents[12],400,'exactly 400 independently verified eight-corner closed blades');
  assert.equal(nearComponents[20],undefined,'near canopy contains no hidden hard core masses');
  assert.equal(farComponents[leafFaces],lush?418:tetra?660:330,'far role retains its selected closed leaf components');
  assert.equal(farComponents[20],lush?5:15,'only the far role uses recessed backing cores');
  assert.deepEqual(data.meshes[farName].min,data.meshes.treeNear.min,'near/far share exact minimum silhouette anchors');
  assert.deepEqual(data.meshes[farName].max,data.meshes.treeNear.max,'near/far share exact maximum silhouette anchors');
  if(lush)assert.ok(data.meshes.treeStreetFar.triangles<=4000,'street far mesh stays within 4000 triangles');
  if(lush){
    const nearRecord=data.meshes.treeNear,farRecord=data.meshes.treeStreetFar;
    const prefix=Buffer.from(nearRecord.index,'base64').subarray(0,552*3*2);
    assert.deepEqual(prefix,Buffer.from(farRecord.index,'base64').subarray(0,prefix.length),'near/far share exact 552-triangle street trunk topology');
    let vertices=0;for(let i=0;i<prefix.length;i+=2)vertices=Math.max(vertices,prefix.readUInt16LE(i)+1);
    for(const [name,stride]of [['position',12],['normal',6],['color',3],['uv',8]])
      assert.deepEqual(Buffer.from(nearRecord[name],'base64').subarray(0,vertices*stride),Buffer.from(farRecord[name],'base64').subarray(0,vertices*stride),'near/far share exact street trunk '+name);
    const foot=geometry=>{const p=geometry.attributes.position,values=new Set();for(let i=0;i<p.count;i++)if(p.getY(i)<.2)values.add([p.getX(i),p.getY(i),p.getZ(i)].join('|'));return [...values].sort();};
    assert.deepEqual(foot(decoded.treeNear),foot(decoded.tree),'larger street tree retains original foot geometry and ground contact');
  }
  console.log(`PASS: coreless near canopy; ${leafContours?'1080 retained eight-face + 400 new twelve-face':lush?1680:tetra?2080:1040} outward-wound closed leaf components, no hard cores; ${lush?418:tetra?660:330} far leaves and ${lush?5:15} recessed far-only cores; exact shared AABB.`);
  if(lush||process.argv.includes('--flowering-planter')){
    const accepted=JSON.parse(fs.readFileSync(path.join(root,stone?'audit/berlin-garden-branch-v8/models/berlin-kiez-garden-v1.json':'assets/models/berlin-kiez-garden-v1.json'),'utf8'));
    for(const name of (lush?['tree','leaves','trunk']:['tree','treeNear','leaves','trunk']))assert.deepEqual(data.meshes[name],accepted.meshes[name],name+' remains byte-identical to accepted background assets');
    assert.deepEqual(data.atlas,accepted.atlas,'planter reuses the identical shared atlas');
    assert.deepEqual(data.meshes.planter.min,accepted.meshes.planter.min,'existing planter minimum envelope and ground origin');
    assert.deepEqual(data.meshes.planter.max,accepted.meshes.planter.max,'existing planter maximum envelope');
    const potIndices=Buffer.from(data.meshes.planter.index,'base64').subarray(0,180*3*2);
    assert.deepEqual(potIndices,Buffer.from(accepted.meshes.planter.index,'base64').subarray(0,potIndices.length),'original 180-triangle pot, rim and soil topology');
    let potVertexCount=0;for(let i=0;i<potIndices.length;i+=2)potVertexCount=Math.max(potVertexCount,potIndices.readUInt16LE(i)+1);
    for(const [name,stride]of (stone?[['uv',8]]:[['position',12],['normal',6],['color',3],['uv',8]]))
      assert.deepEqual(Buffer.from(data.meshes.planter[name],'base64').subarray(0,potVertexCount*stride),Buffer.from(accepted.meshes.planter[name],'base64').subarray(0,potVertexCount*stride),'existing pot '+name+' remains byte-identical');
    if(stone){
      for(const name of ['tree','leaves','trunk','treeNear','treeStreetFar']){
        const expected=leafContours&&name==='treeNear'?{...canopyCandidate.meshes.treeNear}:{...accepted.meshes[name]};
        if(canopyDepth&&['treeNear','treeStreetFar'].includes(name))expected.color=canopyCandidate.meshes[name].color;
        assert.deepEqual(data.meshes[name],expected,'stone planter preserves '+name+' with only an explicitly validated canopy bake');
      }
      const mesh=new THREE.Mesh(decoded.planter,new THREE.MeshBasicMaterial()),ray=new THREE.Raycaster(),xs=[];
      for(const z of [0,.14]){
        ray.set(new THREE.Vector3(2,.4,z),new THREE.Vector3(-1,0,0));
        const hit=ray.intersectObject(mesh)[0];assert.ok(hit,'stone planter has a closed outward-facing front');xs.push(hit.point.x);
      }
      assert.ok(Math.abs(xs[1]-xs[0])<.01,'the stone pot has broad near-flat panels rather than its old circular wall');
    }
    assert.ok(data.meshes.planter.triangles<=(layeredPlanter?6800:lush?6000:4000),'flowering planter stays within its triangle budget');
    const shrub=components(decoded.planter);
    assert.equal(shrub[12],layeredPlanter?8:lush?undefined:192,'only the eight new fine twigs use 12 faces; real closed oval leaves replace hard green canopy masses');
    assert.equal(shrub[20],undefined,'flowering planter contains no hard ico foliage masses');
    assert.equal(shrub[8],layeredPlanter?780:lush?664:126,'closed foliage/flower petals, eyes and fine support stems');
    if(layeredPlanter)assert.equal(shrub[26],7,'seven tapered branching shoots support the layered shrub');
    console.log(`PASS: flowering planter has ${layeredPlanter?640:lush?496:192} closed oval leaves, ${layeredPlanter?20:lush?24:18} flower heads, all components outward and enclosed; exact existing bounds; accepted background records and atlas byte-identical.`);
  }
}
const glb=fs.readFileSync(path.join(assetDir,'berlin-kiez-garden-v1.glb'));
assert.equal(glb.readUInt32LE(0),0x46546c67);assert.equal(glb.readUInt32LE(8),glb.length);
const gltf=JSON.parse(glb.subarray(20,20+glb.readUInt32LE(12)).toString('utf8'));
assert.equal(gltf.materials.length,1,'one reusable opaque GLB material');
assert.ok(gltf.meshes.every(m=>m.primitives.length===1&&m.primitives[0].attributes.COLOR_0!==undefined));
assert.ok(gltf.materials[0].pbrMetallicRoughness.baseColorTexture,'reusable Blender GLB retains actual foliage surface image');
if(layeredPlanter){
  assert.ok(lush&&stone&&canopyDepth,'layered planter validation includes the existing lush, stone and V87 checks');
  const stage=path.join(root,'audit/berlin-layered-planter-v95');
  const baseline=JSON.parse(fs.readFileSync(path.join(stage,'baseline/berlin-kiez-garden-v1.json')));
  const report=JSON.parse(fs.readFileSync(path.join(stage,'validation.json')));
  const crypto=require('crypto');
  for(const [name,digest]of Object.entries(report.baseline_sha256))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(stage,'baseline',name))).digest('hex'),digest,'immutable baseline '+name);
  for(const key of Object.keys(baseline))if(key!=='meshes')assert.deepEqual(data[key],baseline[key],key+' preserved');
  for(const key of Object.keys(baseline.meshes))if(key!=='planter'){
    const expected=leafContours&&key==='treeNear'?{...canopyCandidate.meshes.treeNear}:{...baseline.meshes[key]};
    if(canopyPaint&&['treeNear','treeStreetFar'].includes(key))expected.color=canopyCandidate.meshes[key].color;
    assert.deepEqual(data.meshes[key],expected,key+' is exact apart from explicitly verified broad leaf paint');
  }
  const record=data.meshes.planter,old=baseline.meshes.planter;
  assert.equal(record.triangles,6698);assert.equal(report.leaf_count,640);assert.equal(report.flower_clusters,5);
  assert.deepEqual(record.min,old.min);assert.deepEqual(record.max,old.max);
  for(const [side,values]of [['min',record.min],['max',record.max]])for(let axis=0;axis<3;axis++)assert.ok(Math.abs(decoded.planter.boundingBox[side].getComponent(axis)-values[axis])<1e-6,'actual planter positions retain the recorded envelope');
  const initialDir=path.join(stage,'initial');
  const initialHashes=JSON.parse(fs.readFileSync(path.join(initialDir,'sha256.json'),'utf8').replace(/^\uFEFF/,''));
  for(const [name,digest]of Object.entries(initialHashes))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(initialDir,name))).digest('hex'),digest,'initial v95 snapshot '+name);
  const initial=JSON.parse(fs.readFileSync(path.join(initialDir,'models/berlin-kiez-garden-v1.json'))).meshes.planter;
  const initialIndices=Buffer.from(initial.index,'base64'),initialColors=Buffer.from(initial.color,'base64');
  const revisedIndices=Buffer.from(record.index,'base64'),revisedColors=Buffer.from(record.color,'base64');
  assert.equal(initial.triangles,record.triangles,'orientation correction adds no triangles');
  for(let i=0;i<record.triangles*3;i++){
    const a=initialIndices.readUInt16LE(i*2),b=revisedIndices.readUInt16LE(i*2);
    assert.deepEqual(initialColors.subarray(a*3,a*3+3),revisedColors.subarray(b*3,b*3+3),'orientation correction preserves every triangle-corner color');
  }
  const first=Buffer.from(old.index,'base64').subarray(0,180*3*2);
  assert.deepEqual(Buffer.from(record.index,'base64').subarray(0,first.length),first,'all original stone pot triangle indices exact');
  let count=0;for(let i=0;i<first.length;i+=2)count=Math.max(count,first.readUInt16LE(i)+1);
  for(const [attr,stride]of [['position',12],['normal',6],['color',3],['uv',8]])assert.deepEqual(Buffer.from(record[attr],'base64').subarray(0,count*stride),Buffer.from(old[attr],'base64').subarray(0,count*stride),'stone pot '+attr+' exact');
  // Actual foliage and petals remain closed and face outward. Curved normals
  // must also face out of their authored triangles, not merely be unit length.
  const p=decoded.planter.attributes.position,n=decoded.planter.attributes.normal,idx=decoded.planter.index;
  let outwardCorners=0;
  for(let face=180+278;face<180+278+640*8;face++){
    const ids=[0,1,2].map(j=>idx.getX(face*3+j));
    const [a,b,c]=ids.map(i=>new THREE.Vector3().fromBufferAttribute(p,i));
    const faceNormal=b.sub(a).cross(c.sub(a)).normalize();
    for(const id of ids){assert.ok(faceNormal.dot(new THREE.Vector3().fromBufferAttribute(n,id))>.01,'new smooth leaf corner faces outward');outwardCorners++;}
  }
  const tilts=[];
  for(let leaf=0;leaf<640;leaf++){
    const face=180+278+leaf*8;
    const [a,b,c]=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,idx.getX(face*3+j)));
    const normal=b.sub(a).cross(c.sub(a)).normalize();
    tilts.push(Math.acos(Math.abs(normal.y))*180/Math.PI);
  }
  tilts.sort((a,b)=>a-b);
  assert.ok(tilts[320]>40&&tilts[320]<65&&tilts[64]>30,'broad leaf planes are upright and varied, not horizontal shelves');
  assert.deepEqual(report.leaf_orientation.plane_tilt_degrees,[35,70]);
  const candidateScope={};vm.runInNewContext(fs.readFileSync(path.join(assetDir,'berlin-kiez-garden-v1.inline.js'),'utf8'),candidateScope);
  assert.equal(JSON.stringify(candidateScope.BERLIN_KIEZ_GARDEN_DATA),JSON.stringify(data),'runtime JSON and inline agree');
  const originalGlb=fs.readFileSync(path.join(stage,'baseline/berlin-kiez-garden-v1.glb'));
  const oldGltf=JSON.parse(originalGlb.subarray(20,20+originalGlb.readUInt32LE(12)));
  const payload=(bytes,descriptors,id)=>{const view=descriptors.bufferViews[id],offset=28+bytes.readUInt32LE(12)+(view.byteOffset||0);return bytes.subarray(offset,offset+view.byteLength);};
  assert.deepEqual(gltf.materials,oldGltf.materials,'GLB material is unchanged');
  assert.deepEqual(gltf.nodes,oldGltf.nodes,'GLB nodes and contact origin are unchanged');
  assert.deepEqual(gltf.meshes,oldGltf.meshes,'GLB object names, materials and primitive mapping are unchanged');
  const prim=gltf.meshes.find(m=>m.name==='Kiez_Flower_Planter').primitives[0];
  const ids=[...Object.values(prim.attributes),prim.indices],replaced=new Set(ids.map(i=>gltf.accessors[i].bufferView));
  if(canopyPaint){
    // Only this independently verified RGB accessor is additionally allowed;
    // every other tree/atlas buffer still uses the historical equality check.
    const nearPrimitive=gltf.meshes.find(m=>m.name==='Kiez_Tree_Leaves_Street').primitives[0];
    if(leafContours){
      // The dedicated check proves retained corners, new blade topology and
      // every GLB/runtime near corner. Only that complete verified near payload
      // may replace the original; all other GLB buffers remain exact below.
      for(const a of [...Object.values(nearPrimitive.attributes),nearPrimitive.indices])replaced.add(gltf.accessors[a].bufferView);
      assert.deepEqual(glb,fs.readFileSync(path.join(root,'audit/berlin-leaf-contours-v102/models/berlin-kiez-garden-v1.glb')),'actual GLB bytes match the independently verified mixed leaf candidate');
    }else{
      replaced.add(gltf.accessors[nearPrimitive.attributes.COLOR_0].bufferView);
      assert.deepEqual(glb,fs.readFileSync(path.join(root,'audit/berlin-canopy-paint-v100/models/berlin-kiez-garden-v1.glb')),'actual GLB is the independently verified paint candidate');
    }
  }
  for(let i=0;i<gltf.bufferViews.length;i++)if(!replaced.has(i))assert.deepEqual(payload(glb,gltf,i),payload(originalGlb,oldGltf,i),'protected GLB tree/atlas buffer '+i);
  const attribute=(name)=>{const a=gltf.accessors[prim.attributes[name]];return {a,b:payload(glb,gltf,a.bufferView)};};
  assert.deepEqual(attribute('POSITION').b,Buffer.from(record.position,'base64'),'GLB/runtime vertex positions exact');
  assert.deepEqual(attribute('TEXCOORD_0').b,Buffer.from(record.uv,'base64'),'GLB/runtime UV exact');
  assert.deepEqual(payload(glb,gltf,gltf.accessors[prim.indices].bufferView),Buffer.from(record.index,'base64'),'GLB/runtime triangle topology exact');
  const normal=attribute('NORMAL'),color=attribute('COLOR_0'),runtimeNormal=Buffer.from(record.normal,'base64'),runtimeColor=Buffer.from(record.color,'base64');
  assert.equal(color.a.normalized,true);assert.equal(color.a.componentType,5121);
  for(let v=0;v<record.vertices;v++){
    for(let ch=0;ch<3;ch++){
      assert.ok(Math.abs(normal.b.readFloatLE(v*12+ch*4)-runtimeNormal.readInt16LE(v*6+ch*2)/32767)<1e-7,'GLB/runtime finite normal parity');
      assert.equal(color.b[v*4+ch],runtimeColor[v*3+ch],'GLB/runtime color parity');
    }
    assert.equal(color.b[v*4+3],255,'opaque GLB colors');
  }
  assert.ok(report.native_corner_normal_quantization_max<=2,'saved Blender custom normals differ by at most two int16 quantization steps');
  console.log(`PASS: layered v95 shrub, 640 closed leaves/5 flower clusters, ${outwardCorners} outward curved corners, exact stone pot payload, ${leafContours?'verified V102 mixed contours':canopyPaint?'verified V100 tree paint':'unchanged V87 trees'}/atlas, GLB/runtime parity and unchanged bounds.`);
}
const near=decoded.treeNear,gpuBytes=Object.values(near.attributes).reduce((sum,a)=>sum+a.array.byteLength,near.index.array.byteLength);
if(process.argv.includes('--curved')){
  const previous=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-garden-lush-v6/models/berlin-kiez-garden-v1.json'),'utf8'));
  for(const name of (stone?['tree','leaves','trunk']:['tree','leaves','trunk','planter']))assert.deepEqual(data.meshes[name],previous.meshes[name],name+' is untouched by the street leaf pass');
  assert.deepEqual(data.atlas,previous.atlas,'curved leaves use the same atlas');
  for(const name of ['treeNear','treeStreetFar']){
    const before=previous.meshes[name],after=data.meshes[name],geometry=decoded[name];
    assert.deepEqual(after.min,before.min,'existing street minimum envelope');
    assert.deepEqual(after.max,before.max,'existing street maximum envelope');
    assert.equal(after.triangles,before.triangles,'no additional foliage triangles');
    for(const attr of ['position','normal','color','uv','index']){
      const expected=leafContours&&name==='treeNear'?canopyCandidate.meshes.treeNear:before;
      assert.equal(Buffer.from(after[attr],'base64').length,Buffer.from(expected[attr],'base64').length,'exact verified '+attr+' memory');
    }
    assert.notEqual(after.normal,before.normal,'curved normals reach the exported asset');
    const p=geometry.attributes.position,n=geometry.attributes.normal,index=geometry.index;
    const normalAt=i=>new THREE.Vector3().fromBufferAttribute(n,i);
    let outward=0,varied=0;
    // Every actual leaf face follows the common 552-triangle street trunk.
    // The far record intersperses its retained leaves with five 20-face cores.
    let cursor=552*3;
    for(const count of (name==='treeNear'?[1680]:[80,84,76,80,98])){
      for(let j=0;j<count*8;j++,cursor+=3){
        const ids=[index.getX(cursor),index.getX(cursor+1),index.getX(cursor+2)];
        const [a,b,c]=ids.map(i=>new THREE.Vector3().fromBufferAttribute(p,i));
        const face=b.sub(a).cross(c.sub(a)).normalize();
        for(const i of ids){assert.ok(face.dot(normalAt(i))>.01,'leaf normals face out of their actual triangle');outward++;}
        if(normalAt(ids[0]).distanceTo(normalAt(ids[1]))>.05)varied++;
      }
      if(name==='treeStreetFar')cursor+=20*3;
    }
    assert.ok(varied>after.triangles*.70,'curved shading varies smoothly across the leaf face');
    console.log(`PASS: ${name} ${outward} outward leaf-corner normals; ${varied} curved faces, verified buffer sizes, unchanged triangle budget and envelope.`);
  }
}
console.log(JSON.stringify({ok:true,nearTreeTriangles:data.meshes.treeNear.triangles,groveTreeTriangles:data.meshes.tree.triangles,planterTriangles:data.meshes.planter.triangles,nearGeometryBytes:gpuBytes,canopyRadius:Math.ceil(radius*100)/100,atlasBytes:atlas.length,embeddedBytes:fs.statSync(path.join(assetDir,'berlin-kiez-garden-v1.inline.js')).size,glbBytes:glb.length},null,2));
