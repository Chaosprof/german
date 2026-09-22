'use strict';
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict');
const path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'berlin-runner.html'), 'utf8');
const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
scripts.forEach((s,i)=>new vm.Script(s,{filename:'inline-'+i}));
const scope=vm.createContext({console});
vm.runInContext(scripts.find(s=>s.includes('three.js r156 (MIT)')),scope);
const THREE=scope.THREE;
scope.atob=s=>Buffer.from(s,'base64').toString('binary');
scope.BERLIN_REFERENCE_ARCHITECTURE=JSON.parse(fs.readFileSync(path.join(root,process.env.BERLIN_ARCHITECTURE_DIR||'assets/models','berlin-reference-architecture-v1.json'),'utf8'));
vm.runInContext(fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8'),scope);
vm.runInContext(fs.readFileSync(path.join(__dirname,'berlin_kiez_kit.js'),'utf8'),scope);
const createKit=scope.createBerlinKiezKit;
const noop=()=>{};
const ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
const kit=createKit(THREE,(color,opts)=>new THREE.MeshStandardMaterial({color,...opts}),
  (width,height)=>({width,height,getContext:()=>ctx}));
// V114 adds profiled joinery to the saved masters. Prove the old meshes are
// exact protected prefixes before running their historical preservation tests.
// All normal runtime ray/bounds/material checks below still use the full mesh.
const formsBaseline=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-model-forms-v114/architecture/baseline/berlin-reference-architecture-v1.json'),'utf8'));
function protectedFormBase(key) {
  let current=scope.BERLIN_REFERENCE_ARCHITECTURE.meshes[key];
  if(current.awningRevision) {
    assert.equal(current.awningRevision,'bowed-cloth-rounded-valance-v114');
    const prior=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-model-forms-v114/architecture/flowering-balcony/models/berlin-reference-architecture-v1.json'),'utf8')).meshes[key];
    assert.equal(current.awningOldFaceStart,10402);assert.equal(current.awningOldFaceCount,1756);
    assert.equal(current.awningBaseVertices,prior.vertices);
    for(const field of ['position','normal','uv','color']){const old=Buffer.from(prior[field],'base64');assert.deepEqual(Buffer.from(current[field],'base64').subarray(0,old.length),old,'awning preserves every existing attribute');}
    const old=Buffer.from(prior.index,'base64'),index=Buffer.from(current.index,'base64');
    const retained=Buffer.concat([old.subarray(0,10402*6),old.subarray(12158*6)]);
    assert.deepEqual(index.subarray(0,retained.length),retained,'only the connected old fabric faces are replaced; balcony and all other surfaces stay exact');
    assert.equal(index.length-retained.length,4178*6);
    for(let i=retained.length;i<index.length;i+=2)assert.ok(index.readUInt16LE(i)>=prior.vertices);
    assert.deepEqual(current.min,prior.min);assert.deepEqual(current.max,prior.max);
    const cloth=scope.decodeBerlinMeshRecord(THREE,current),p=cloth.attributes.position,n=cloth.attributes.normal;
    for(let f=retained.length/6;f<current.triangles;f++){
      const ids=[0,1,2].map(k=>cloth.index.getX(f*3+k)),v=ids.map(i=>new THREE.Vector3().fromBufferAttribute(p,i));
      const face=v[1].sub(v[0]).cross(v[2].sub(v[0])),shade=ids.reduce((sum,i)=>sum.add(new THREE.Vector3().fromBufferAttribute(n,i)),new THREE.Vector3());
      assert.ok(face.length()>1e-9,'cloth shell has no collapsed triangles');
      assert.ok(face.dot(shade)>0,'cloth normals face their surface: '+JSON.stringify({f,ids,face:face.toArray(),shade:shade.toArray()}));
    }
    // Historical invariants below are checked against the independently
    // proven retained source. All runtime ray checks still use the new cloth.
    current=prior;
  }
  if(!['rounded-profile-architecture-v114','stepped-smooth-architecture-v114'].includes(current.formsRevision))return current;
  const base=formsBaseline.meshes[key];
  assert.equal(current.formsBaseVertices,base.vertices);
  assert.equal(current.formsBaseTriangles,base.triangles);
  assert.ok(current.triangles>base.triangles&&current.triangles-base.triangles<9000,'bounded visible profile additions including smooth arched curves');
  for(const field of ['position','normal','uv','color','index']) {
    const a=Buffer.from(base[field],'base64'),b=Buffer.from(current[field],'base64');
    assert.ok(b.length>a.length&&b.subarray(0,a.length).equals(a),'original '+key+' '+field+' is byte-exact');
  }
  if(current.balconyRevision) {
    assert.equal(current.balconyRevision,'sculpted-curved-balcony-v114');
    const refined=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-model-forms-v114/architecture/refined-models/berlin-reference-architecture-v1.json'),'utf8')).meshes[key];
    assert.equal(current.balconyBaseVertices,refined.vertices);
    assert.equal(current.balconyBaseTriangles,refined.triangles);
    assert.ok(current.triangles-refined.triangles<=(current.plantingRevision==='rounded-trailing-flowers-v114'?6500:2800),'bounded curved balcony with its complete supports, rail and rounded flowering mass');
    for(const field of ['position','normal','uv','color','index']) {
      const before=Buffer.from(refined[field],'base64'),after=Buffer.from(current[field],'base64');
      assert.deepEqual(after.subarray(0,before.length),before,'balcony preserves accepted profiles and all prior geometry');
    }
    const p=Buffer.from(current.position,'base64');
    for(let i=refined.vertices;i<current.vertices;i++)assert.ok(p.readFloatLE(i*12+4)>=8.26&&p.readFloatLE(i*12+8)<2.75,'balcony projection stays above head height and within its actual envelope');
  }
  const index=Buffer.from(current.index,'base64');
  for(let i=base.triangles*3;i<current.triangles*3;i++)assert.ok(index.readUInt16LE(i*2)>=base.vertices,
    'new profiles cannot replace or reconnect old structural faces');
  return base;
}
const historicalArchitecture=Object.fromEntries(Object.keys(scope.BERLIN_REFERENCE_ARCHITECTURE.meshes).map(key=>[key,protectedFormBase(key)]));
if(scope.BERLIN_REFERENCE_ARCHITECTURE.meshes['13.5:0:1'].balconyRevision) {
  const master=kit.geometry(13.5,0,1),solid=new THREE.Mesh(master,new THREE.MeshBasicMaterial()),ray=new THREE.Raycaster();
  solid.updateMatrixWorld(true);
  for(const y of [8.91,8.98,9.97]) {
    ray.set(new THREE.Vector3(4.65,y,5),new THREE.Vector3(0,0,-1));
    const hit=ray.intersectObject(solid)[0];
    assert.ok(hit&&hit.point.z>2.62&&hit.point.z<2.76,'actual projecting curved slab/rail is visible ahead of the old bay sill');
  }
  ray.set(new THREE.Vector3(4.65,8,2.35),new THREE.Vector3(0,1,0));
  const underside=ray.intersectObject(solid)[0];
  assert.ok(underside&&underside.point.y>8.25&&underside.point.y<8.84,'balcony has an outward-facing underside above the clear pavement');
}
const raw=fs.readFileSync(path.join(__dirname,'berlin_kiez_kit.js'),'utf8').replace(/\nif \(typeof module[^\n]+\n?$/, '\n').trim();
if(!process.argv.includes('--canonical-only'))assert.ok(html.includes(raw),'shipped factory matches editable source');
// Independent image decodes can complete in any order. The generated plaster
// owns just cell 1; room cells and the old plaster fallback remain available.
const loaderSource=raw.slice(raw.indexOf('  function loadPaintedCells('),raw.indexOf('  var material = makeMaterial'));
for(const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0],[0,1],[1,0]]) {
  const images=[],cells=new Map(),texture={userData:{},needsUpdate:false};
  const imageContext=vm.createContext({CELL:512,texture,
    BERLIN_REFERENCE_INTERIORS:'rooms',BERLIN_SECONDARY_ROOMS:'secondary',BERLIN_REFERENCE_PLASTER:'plaster',
    Image:class {constructor(){this.width=1024;this.height=1024;images.push(this);}},
    ctx:{fillRect:noop,drawImage(image,sx,sy,sw,sh,dx,dy,dw,dh){
      cells.set(dx/512+dy/512*4,image.src);
      assert.equal(dw,512);assert.equal(dh,512);
      assert.equal(sw,image.src==='plaster'?1024:512,'full plaster and room quadrant use their own source extents');
    }}});
  vm.runInContext(loaderSource,imageContext);
  assert.equal(images.length,3);
  order.forEach(i=>images[i].onload());
  assert.equal(cells.get(1),order.includes(2)?'plaster':'rooms');
  for(const id of [4,5])assert.equal(cells.get(id),'rooms');
  for(const id of [6,7,8,15])assert.equal(cells.get(id),'secondary');
  assert.equal(!!texture.userData.plasterLoaded,order.includes(2));
  assert.ok(texture.needsUpdate&&texture.userData.referenceLoaded&&texture.userData.secondaryLoaded);
}
console.log('PASS: six asynchronous atlas decode orders and two failed-plaster fallbacks; only plaster cell 1 changes, all shop cells remain intact.');
if(process.argv.includes('--contact')){
  const baseline=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-facade-contact-v76/baseline/berlin-reference-architecture-v1.json')));
  const decode=scope.decodeBerlinMeshRecord;
  let protectedPaint=0,changedPaint=0;
  for(const [key,record]of Object.entries(scope.BERLIN_REFERENCE_ARCHITECTURE.meshes)){
    const before=baseline.meshes[key];
    for(const attr of Object.keys(before))if(attr!=='color')assert.deepEqual(record[attr],before[attr],'contact bake preserves '+key+' '+attr);
    if(!['13.5:0:1','13.5:1:1'].includes(key)){assert.equal(record.color,before.color);continue;}
    const g=decode(THREE,record),uv=g.attributes.uv,cloth=key==='13.5:0:1'?bakeryFabricFaces(g,true):new Set();
    const protectedVertices=new Set();
    for(const face of cloth)for(let j=0;j<3;j++)protectedVertices.add(g.index.getX(face*3+j));
    const oldColor=Buffer.from(before.color,'base64'),newColor=Buffer.from(record.color,'base64');
    assert.equal(oldColor.length,newColor.length,'same GPU color buffer');
    for(let i=0;i<uv.count;i++){
      const cell=Math.floor(uv.getX(i)*4)+4*Math.floor((1-uv.getY(i))*4);
      for(let j=0;j<3;j++){
        const was=oldColor[i*3+j],now=newColor[i*3+j];
        if(cell!==1||protectedVertices.has(i)){assert.equal(now,was,'glass, rooms, signs and cloth remain exact');protectedPaint++;}
        else{assert.ok(now<=was&&now>=Math.floor(was*.5),'solid contact paint has a bounded local darkening');if(now!==was)changedPaint++;}
      }
    }
  }
  const oldScope=vm.createContext({THREE,Math});
  vm.runInContext(fs.readFileSync(path.join(root,'audit/berlin-facade-contact-v76/berlin_kiez_kit-v75.js'),'utf8'),oldScope);
  const oldKit=oldScope.createBerlinKiezKit(THREE,(color,opts)=>new THREE.MeshStandardMaterial({color,...opts}),()=>({getContext:()=>ctx}));
  let neutralChanges=0;
  for(const width of [11,13.5,16])for(const variant of [2,3,4,5])for(const side of [-1,1]){
    const before=oldKit.geometry(width,variant,side),after=kit.geometry(width,variant,side);
    for(const attr of ['position','normal','uv'])assert.deepEqual(after.attributes[attr].array,before.attributes[attr].array,'neutral contact paint leaves '+attr+' unchanged');
    const a=after.attributes.color.array,b=before.attributes.color.array;
    assert.equal(a.length,b.length);
    for(let i=0;i<a.length;i++){assert.ok(a[i]<=b[i]+1e-7&&a[i]>=b[i]*.25,'bounded neutral recess/soffit shading');if(Math.abs(a[i]-b[i])>1e-7)neutralChanges++;}
  }
  assert.ok(changedPaint>10000&&neutralChanges>1000);
  console.log(`PASS: contact paint changes ${changedPaint} focal and ${neutralChanges} neutral channels; ${protectedPaint} glass/room/cloth channels protected, exact geometry/normals/UVs and unchanged buffers.`);
}
let maximum=0,total=0,returnRays=0,turretRays=0,shopRays=0,insetRays=0,soffitRays=0,profileRays=0,preservedGroundTriangles=0;
const accepted=JSON.parse(fs.readFileSync(path.join(root,'audit/architecture-accepted-v66/berlin-reference-architecture-v1.json'),'utf8')).meshes;
function atlasCell(uv) {return Math.floor(uv.x*4)+4*Math.floor((1-uv.y)*4);}
// Identify complete textile components, so the intentional v71 fabric change
// cannot exempt the attachment rail, glazing, or nearby structural trim.
function connectedGeometry(g) {
  const p=g.attributes.position,index=g.index,parents=[],weld=[],points=new Map();
  const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  for(let i=0;i<p.count;i++) {
    const key=[p.getX(i),p.getY(i),p.getZ(i)].join(',');
    if(!points.has(key)){points.set(key,parents.length);parents.push(parents.length);}
    weld.push(points.get(key));
  }
  for(let i=0;i<index.count;i+=3) {
    const a=find(weld[index.getX(i)]);
    for(let j=1;j<3;j++)parents[find(weld[index.getX(i+j)])]=a;
  }
  const components=new Map();
  for(let i=0;i<index.count;i+=3) {
    const key=find(weld[index.getX(i)]);
    if(!components.has(key))components.set(key,{faces:[],min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]});
    const c=components.get(key);c.faces.push(i/3);
    for(let j=0;j<3;j++) {
      const k=index.getX(i+j),v=[p.getX(k),p.getY(k),p.getZ(k)];
      for(let axis=0;axis<3;axis++){c.min[axis]=Math.min(c.min[axis],v[axis]);c.max[axis]=Math.max(c.max[axis],v[axis]);}
    }
  }
  return [...components.values()];
}
function bakeryFabricFaces(g,continuous,expectedX) {
  const fabric=connectedGeometry(g).filter(({min:lo,max:hi,faces})=>{
    if(expectedX) {
      if(Math.abs(lo[0]-expectedX[0])>.00002||Math.abs(hi[0]-expectedX[1])>.00002)return false;
    } else if(!(lo[0]>-6.21&&hi[0]<.66))return false;
    if(continuous)return (faces.length===1756&&lo[1]>3.50&&lo[1]<3.52&&hi[1]>5.64&&hi[1]<5.66&&lo[2]>.18&&lo[2]<.20&&hi[2]>2.18&&hi[2]<2.19)||(faces.length===4178&&lo[1]>3.45&&lo[1]<3.49&&hi[1]>5.64&&hi[1]<5.66&&lo[2]>.17&&lo[2]<.18&&hi[2]>2.22&&hi[2]<2.23);
    const roof=3.80<lo[1]&&lo[1]<3.89&&5.60<hi[1]&&hi[1]<5.70&&.15<lo[2]&&lo[2]<.25&&2.10<hi[2]&&hi[2]<2.18;
    const hem=3.49<lo[1]&&lo[1]<3.54&&3.85<hi[1]&&hi[1]<3.90&&2.11<lo[2]&&lo[2]<2.14&&2.18<hi[2]&&hi[2]<2.20;
    return roof||hem;
  });
  assert.equal(fabric.length,continuous?1:17,'only the known connected fabric components are exempt');
  const faces=new Set(fabric.flatMap(c=>c.faces));
  assert.ok(continuous?[1756,4178].includes(faces.size):faces.size===1472,'only the complete known fabric component is exempt');
  return faces;
}
function groundFaces(g,ceiling,omit=new Set()) {
  const position=g.attributes.position,index=g.index,faces=[];
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  for(let i=0;i<(index?index.count:position.count);i+=3) {
    if(omit.has(i/3))continue;
    a.fromBufferAttribute(position,index?index.getX(i):i);
    b.fromBufferAttribute(position,index?index.getX(i+1):i+1);
    c.fromBufferAttribute(position,index?index.getX(i+2):i+2);
    if(b.sub(a).cross(c.sub(a)).lengthSq()<1e-12)continue;
    const vertices=[];let below=true;
    for(let j=0;j<3;j++) {
      const k=index?index.getX(i+j):i+j;
      below&&=position.getY(k)<ceiling;
      vertices.push([position.getX(k),position.getY(k),position.getZ(k)].map(v=>v.toFixed(4)).join(','));
    }
    if(below)faces.push(vertices.sort().join('|'));
  }
  return [...new Set(faces)].sort();
}
// v99 widens 21 display components and compresses only their two neighbouring
// piers. Independently prove that exact transform before using the immutable
// pre-v99 surface for the continuing v66 ground-storey preservation check.
function validateBakeryDisplayTransform() {
  const key='13.5:0:1',record=historicalArchitecture[key];
  if(record.displayRevision!=='wider-coherent-display-v99')return null;
  const folder=path.join(root,'audit/berlin-bakery-display-v99');
  const baseline=JSON.parse(fs.readFileSync(path.join(folder,'baseline/berlin-reference-architecture-v1.json'),'utf8'));
  const manifest=JSON.parse(fs.readFileSync(path.join(folder,'transform-manifest.json'),'utf8'));
  const prior=baseline.meshes[key],before=scope.decodeBerlinMeshRecord(THREE,prior),parts=connectedGeometry(before);
  assert.equal(parts.length,375);assert.equal(manifest.targetMaster,key);assert.equal(manifest.indexPayloadUnchanged,true);
  const display=new Set([...Array.from({length:12},(_,i)=>170+i),...Array.from({length:8},(_,i)=>205+i),226]);
  const componentIds=[...display,194,195].sort((a,b)=>a-b);
  assert.deepEqual(manifest.components.map(c=>c.id),componentIds,'manifest names only the known display and two piers');
  assert.equal(parts[170].faces.length,4);assert.equal(parts[226].faces.length,1756);
  assert.equal(parts[194].faces.length,108);assert.equal(parts[195].faces.length,108);
  const center=(parts[170].min[0]+parts[170].max[0])*.5;
  const scale=5.53/((parts[170].max[0]-parts[170].min[0])*11/13.5);
  assert.ok(Math.abs(center+2.77525)<.000001&&Math.abs(scale-1.094206858)<.00000001);
  const displayX=x=>center+(x-center)*scale;
  const left=parts[194],right=parts[195];
  const rules=new Map();
  for(const entry of manifest.components){
    const part=parts[entry.id],vertices=[...new Set(part.faces.flatMap(t=>[0,1,2].map(c=>before.index.getX(t*3+c))))].sort((a,b)=>a-b);
    assert.deepEqual(entry.faces,part.faces);assert.deepEqual(entry.vertices,vertices,'manifest vertices come from the actual connected component');
    assert.ok(part.max[1]<=5.75,'upper bay and planting never enter this transform');
    const anchor=display.has(entry.id)?center:entry.id===194?left.min[0]:right.max[0];
    const factor=display.has(entry.id)?scale:entry.id===194?(displayX(left.max[0])-left.min[0])/(left.max[0]-left.min[0]):
      (right.max[0]-displayX(right.min[0]))/(right.max[0]-right.min[0]);
    assert.ok(factor>.5&&Math.abs(entry.xScale-factor)<1e-12&&Math.abs(entry.anchorX-anchor)<1e-12);
    for(const v of vertices){assert.ok(!rules.has(v));rules.set(v,{anchor,factor});}
  }
  for(const name of ['uv','color','index','vertices','triangles','min','max'])assert.deepEqual(record[name],prior[name],'v99 retains exact '+name);
  for(const other of Object.keys(baseline.meshes))if(other!==key)assert.deepEqual(historicalArchitecture[other],baseline.meshes[other],'v99 leaves other master '+other+' exact');
  const p0=Buffer.from(prior.position,'base64'),p1=Buffer.from(record.position,'base64'),n0=Buffer.from(prior.normal,'base64'),n1=Buffer.from(record.normal,'base64');
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  assert.equal(sha(p0),manifest.sourceRecordPositionSha256);assert.equal(sha(p1),manifest.targetRecordPositionSha256);
  let protectedVertices=0;
  for(let v=0;v<prior.vertices;v++){
    const rule=rules.get(v);
    if(!rule){assert.ok(p1.subarray(v*12,v*12+12).equals(p0.subarray(v*12,v*12+12)));assert.ok(n1.subarray(v*6,v*6+6).equals(n0.subarray(v*6,v*6+6)));protectedVertices++;continue;}
    const expected=Math.fround(Math.round((rule.anchor+(p0.readFloatLE(v*12)-rule.anchor)*rule.factor)*1e5)/1e5);
    assert.ok(Math.abs(p1.readFloatLE(v*12)-expected)<.000001,'only the specified horizontal affine coordinate changes');
    assert.ok(p1.subarray(v*12+4,v*12+12).equals(p0.subarray(v*12+4,v*12+12)),'all vertical/depth coordinates stay exact');
    const old=[0,1,2].map(k=>n0.readInt16LE(v*6+k*2)),normal=[old[0]/rule.factor,old[1],old[2]],length=Math.hypot(...normal);
    for(let k=0;k<3;k++){
      const expected=old[0]&&(old[1]||old[2])?Math.round(normal[k]/length*32767):old[k];
      assert.ok(Math.abs(n1.readInt16LE(v*6+k*2)-expected)<=1,'normal follows inverse transpose without changing the paint');
    }
  }
  const range=id=>{const xs=manifest.components.find(c=>c.id===id).vertices.map(v=>p1.readFloatLE(v*12));return [Math.min(...xs),Math.max(...xs)];};
  const pane=range(170),frame=range(205),canopy=range(226),support=range(212),sill=range(206),f=11/13.5;
  assert.ok(Math.abs((pane[1]-pane[0])*f-5.53)<.00001&&Math.abs((pane[0]+pane[1])*.5-center)<.00001);
  assert.ok((frame[0]-left.min[0])*f>.37&&(right.max[0]-frame[1])*f>.45,'healthy outer/door masonry remains');
  assert.ok((support[0]+6.75)*f>.14&&(parts[220].min[0]-support[1])*f>.13&&(parts[213].min[0]-sill[1])*f>.22,'canopy, sign and lower sills do not clip');
  console.log(`PASS: exact v99 display transform; ${rules.size} selected and ${protectedVertices} protected vertices; all color/UV/index bytes and eleven other records exact; positive masonry/trim clearances.`);
  return {before,canopyXBounds:canopy};
}
const bakeryDisplayProof=validateBakeryDisplayTransform();
for(const w of [11,13.5,16]) for(let variant=0;variant<6;variant++) for(const side of [-1,1]) {
  const g=kit.geometry(w,variant,side);
  assert.equal(g,kit.geometry(w,variant,side),'shared cache owns each exact variant');
  assert.equal(g.groups.length,1); assert.equal(g.groups[0].materialIndex,0);
  const bb=g.boundingBox;
  const formProfiles=variant<2&&['rounded-profile-architecture-v114','stepped-smooth-architecture-v114'].includes(scope.BERLIN_REFERENCE_ARCHITECTURE.meshes[`13.5:${variant}:1`].formsRevision);
  assert.ok(bb.max.z<(formProfiles&&variant===0?(scope.BERLIN_REFERENCE_ARCHITECTURE.meshes['13.5:0:1'].balconyRevision?2.75:2.50):2.35)&&bb.min.z>=-8.31,
    'bounded pavement projection / rear mass, including the rounded angled-bay sill tips');
  const corniceAllowance=variant<2?.45*Math.max(1,w/13.5):.45;
  assert.ok(bb.max.x<=w/2+corniceAllowance&&bb.min.x>=-w/2-corniceAllowance,'bounded frontage width, including scaled roof cornice');
  assert.ok(bb.min.y>=-.02&&bb.max.y<22,'grounded and bounded roof silhouette');
  const pos=g.attributes.position,norm=g.attributes.normal,uv=g.attributes.uv;
  for(let i=0;i<pos.count;i++) {
    assert.ok(Number.isFinite(pos.getX(i)+pos.getY(i)+pos.getZ(i)));
    assert.ok(Math.abs(Math.hypot(norm.getX(i),norm.getY(i),norm.getZ(i))-1)<.002,'unit normals');
    assert.ok(uv.getX(i)>0&&uv.getX(i)<1&&uv.getY(i)>0&&uv.getY(i)<1,`padded atlas UVs: ${w}:${variant}:${side} vertex ${i} UV ${uv.getX(i)},${uv.getY(i)}`);
  }
  const mesh=new THREE.Mesh(g,kit.material); mesh.updateMatrixWorld(true);
  const authored=variant<2, sourceW=authored?13.5:w, xScale=authored?w/13.5:1;
  assert.equal(!!g.userData.blender,authored,'both focal storefronts use the actual Blender meshes');
  const count=variant===1?3:sourceW===16&&variant!==0?3:2,spacing=(sourceW-.9)/count;
  for(let j=0;j<count;j++) {
    let x=variant===0?-1.15+(sourceW-3.65)*(j===0?-.165:.36)+.51:(j-(count-1)/2)*spacing+.51;
    if(authored)x*=xScale*side;
    const ray=new THREE.Raycaster(new THREE.Vector3(x,1.20,6),new THREE.Vector3(0,0,-1));
    const hit=ray.intersectObject(mesh)[0];
    assert.ok(hit,'shop has real glazing');
    assert.equal(atlasCell(hit.uv),[5,4,6,8,7,15][variant],'shop identity matches its unobstructed interior');
    shopRays++;
  }
  const form=authored?scope.BERLIN_REFERENCE_ARCHITECTURE.meshes[`13.5:${variant}:1`]:{};
  const floors=form.upperFloors??[3,4,3,3,4,3][variant];
  const groundH=variant===0?6.0:4.70,roofBase=groundH+floors*3.05;
  assert.equal(g.userData.height,roofBase,'authored height metadata follows the actual storey base');
  if(authored) {
    const master=scope.BERLIN_REFERENCE_ARCHITECTURE.meshes[`13.5:${variant}:1`];
    const history=historicalArchitecture[`13.5:${variant}:1`];
    assert.ok(history.triangles-accepted[`13.5:${variant}:1`].triangles<=3000,'protected original master retains its accepted triangle budget');
    const baySpacing=(13.5-1)/3,centers=[-baySpacing,0,baySpacing].filter(x=>variant!==0||Math.abs(x-(13.5/2-2.10))>=2.1);
    for(const center of centers)for(let floor=0;floor<floors;floor++) {
      const cy=groundH+floor*3.05+3.05*.51;
      const pane=new THREE.Raycaster(new THREE.Vector3((center+.30)*xScale*side,cy-.4,4),new THREE.Vector3(0,0,-1)).intersectObject(mesh)[0];
      assert.equal(pane&&atlasCell(pane.uv),2,'real upper-wall hole exposes glazing, not the solid structural core');
      assert.ok(Math.abs(pane.point.z+.230)<.002,'upper pane sits 23cm behind the façade plane');
      const jamb=new THREE.Raycaster(new THREE.Vector3((center+.69)*xScale*side,cy-.4,-.10),new THREE.Vector3(side,0,0)).intersectObject(mesh)[0];
      assert.ok(jamb&&atlasCell(jamb.uv)===1&&Math.abs(jamb.point.x-(center+.735)*xScale*side)<.032,'a lateral ray reaches the actual shaded recess return');
      if(formProfiles)for(const offset of [-.84,.84]) {
        const shoulder=new THREE.Raycaster(new THREE.Vector3((center+offset)*xScale*side,cy-.4,4),new THREE.Vector3(0,0,-1)).intersectObject(mesh)[0];
        assert.ok(shoulder&&[0,1].includes(atlasCell(shoulder.uv))&&shoulder.point.z>.14&&shoulder.point.z<.22,
          `native profile provides substantial stone depth outside the unchanged pane: ${JSON.stringify({w,variant,side,center,cy,offset,point:shoulder&&shoulder.point})}`);
        profileRays++;
      }
      insetRays+=2;
      if(variant===1||(floor===floors-1&&form.upperTopArched!==false)) {
        const spandrel=new THREE.Raycaster(new THREE.Vector3((center+.70)*xScale*side,cy+.97,4),new THREE.Vector3(0,0,-1)).intersectObject(mesh)[0];
        assert.ok(spandrel&&atlasCell(spandrel.uv)===1&&Math.abs(spandrel.point.z)<.002,'arched opening has masonry above its curved head, not an open rectangle');
        insetRays++;
      }
    }
    for(let floor=1;floor<floors;floor++)for(const z of [.04,.25]) {
      const yy=groundH+floor*3.05-.221;
      const soffit=new THREE.Raycaster(new THREE.Vector3(-baySpacing*.5*xScale*side,yy-.10,z),new THREE.Vector3(0,1,0)).intersectObject(mesh)[0];
      assert.ok(soffit&&Math.abs(soffit.point.y-yy)<.002&&soffit.face.normal.y<-.99,`cornice exposes a broad downward-facing shaded underside: ${JSON.stringify({w,variant,side,floor,z,yy,point:soffit&&soffit.point,normal:soffit&&soffit.face.normal})}`);
      soffitRays++;
    }
    if(w===13.5&&side===1) {
      const oldGeometry=scope.decodeBerlinMeshRecord(THREE,accepted[`13.5:${variant}:1`]);
      const oldFabric=variant===0?bakeryFabricFaces(oldGeometry,false):new Set();
      const newFabric=variant===0?bakeryFabricFaces(g,true,bakeryDisplayProof?.canopyXBounds):new Set();
      const groundGeometry=variant===0&&bakeryDisplayProof?bakeryDisplayProof.before:
        formProfiles?scope.decodeBerlinMeshRecord(THREE,historicalArchitecture[`13.5:${variant}:1`]):g;
      const groundFabric=variant!==0?new Set():groundGeometry===g?newFabric:bakeryFabricFaces(groundGeometry,true);
      const oldGround=groundFaces(oldGeometry,groundH-.61,oldFabric),newGround=groundFaces(groundGeometry,groundH-.61,groundFabric);
      if(newGround.join('\n')!==oldGround.join('\n')) {
        const oldSet=new Set(oldGround),newSet=new Set(newGround);
        assert.fail(`accepted ground-storey geometry changed: ${JSON.stringify({variant,newCount:newGround.length,oldCount:oldGround.length,newOnly:newGround.filter(v=>!oldSet.has(v)).slice(0,3),oldOnly:oldGround.filter(v=>!newSet.has(v)).slice(0,3)})}`);
      }
      preservedGroundTriangles+=newGround.length;
    }
  }
  for(const edge of [-1,1]) {
    const ray=new THREE.Raycaster(new THREE.Vector3(edge*(w/2+5),roofBase+.25,-4),new THREE.Vector3(-edge,0,0));
    const hit=ray.intersectObject(mesh)[0];
    assert.ok(hit&&Math.abs(hit.point.x-edge*(w/2+.3*xScale))<.03,'masonry closes the side-wall roof spring line, including its 27mm bevel');
  }
  const rearHit=new THREE.Raycaster(new THREE.Vector3(0,roofBase+.25,-12),new THREE.Vector3(0,0,1)).intersectObject(mesh)[0];
  assert.ok(rearHit&&Math.abs(rearHit.point.z+8.30)<.001,'masonry closes the rear-wall roof spring line');
  for(const edge of [-1,1]) for(let f=0;f<floors;f++) for(const depth of [-2.05,-5.85]) {
    const ray=new THREE.Raycaster(new THREE.Vector3(edge*(w/2+5),groundH+f*3.05+3.05*.51-.4,depth+.4),new THREE.Vector3(-edge,0,0));
    const hit=ray.intersectObject(mesh)[0];
    assert.equal(hit&&atlasCell(hit.uv),2,'return-wall glass remains visible behind the rotated frame');
    assert.ok(Math.abs(hit.point.x-edge*(w/2-.230*xScale))<.002,'every side-wall pane is recessed in a real opening');
    returnRays++;
  }
  if(!authored) {
    const bays=w===16?4:3, baySpacing=(w-1)/bays;
    for(let b=0;b<bays;b++) {
      const cx=(b-(bays-1)/2)*baySpacing;
      if(variant===3&&Math.abs(cx-side*(w/2-1.5))<2.1)continue;
      for(let floor=0;floor<floors;floor++) {
        const cy=groundH+floor*3.05+3.05*.51;
        const pane=new THREE.Raycaster(new THREE.Vector3(cx+.30,cy-.4,4),new THREE.Vector3(0,0,-1)).intersectObject(mesh)[0];
        assert.ok(pane&&atlasCell(pane.uv)===2&&Math.abs(pane.point.z+.230)<.002,'neighbour panes sit behind real wall openings');
        const jamb=new THREE.Raycaster(new THREE.Vector3(cx+.69,cy-.4,-.10),new THREE.Vector3(1,0,0)).intersectObject(mesh)[0];
        assert.ok(jamb&&atlasCell(jamb.uv)===1&&Math.abs(jamb.point.x-cx-.735)<.002,'neighbour recess has a lateral masonry return');
        // Probe the visible geometry, not just the authored profile constants:
        // both raised shoulders must be real front-facing stone, and the
        // projecting sill nose must close below the pane at all module widths.
        for(const offset of [-.84,.84]) {
          const shoulder=new THREE.Raycaster(new THREE.Vector3(cx+offset,cy-.4,4),new THREE.Vector3(0,0,-1)).intersectObject(mesh)[0];
          assert.ok(shoulder&&atlasCell(shoulder.uv)===1&&shoulder.point.z>.14&&shoulder.point.z<.20,
            'rounded architrave has substantial depth on both sides of the unchanged opening');
          profileRays++;
        }
        const nose=new THREE.Raycaster(new THREE.Vector3(cx+1.00,cy-1.20,4),new THREE.Vector3(0,0,-1)).intersectObject(mesh)[0];
        assert.ok(nose&&atlasCell(nose.uv)===1&&nose.point.z>.28&&nose.point.z<.31&&nose.face.normal.z>.5,
          `bullnose sill has a closed outward-facing rounded front: ${JSON.stringify({w,variant,side,cx,cy,point:nose&&nose.point,normal:nose&&nose.face.normal})}`);
        profileRays++;
        insetRays+=2;
      }
    }
  }
  if(variant===0||variant===3) for(let f=0;f<floors;f++) for(const angle of [-.74,.28]) {
    const sa=Math.sin(angle),ca=Math.cos(angle),x=side*(w/2-(variant===0?2.10:1.5)*xScale),mirror=authored?side:1;
    const turretScale=form.upperTurretScaleX??1;
    const ray=new THREE.Raycaster(new THREE.Vector3(x+(sa*6+.30*ca)*xScale*mirror*turretScale,groundH+f*3.05+3.05*.51-.4,-.05+ca*6-.30*sa),new THREE.Vector3(-sa*xScale*mirror*turretScale,0,-ca).normalize());
    const hit=ray.intersectObject(mesh)[0];
    assert.equal(hit&&atlasCell(hit.uv),2,'curved-bay glass is outside the cylinder and inside the frame');
    turretRays++;
  }
  if(variant===0) {
    const sa=Math.sin(.10),ca=Math.cos(.10),x=side*(w/2-2.10*xScale);
    const groundRay=new THREE.Raycaster(new THREE.Vector3(x+(sa*6+.15*ca)*xScale*side,2.72,-.05+ca*6-.15*sa),
      new THREE.Vector3(-sa*xScale*side,0,-ca).normalize());
    const groundHit=groundRay.intersectObject(mesh)[0];
    assert.equal(groundHit&&atlasCell(groundHit.uv),2,'continuous ground bay preserves its curved glazing in front of the drum');
    const canopyX=(-1.15-(13.5-3.65)*.165+.13)*xScale*side;
    const canopyRay=new THREE.Raycaster(new THREE.Vector3(canopyX,8,1.175),new THREE.Vector3(0,-1,0));
    const canopyHit=canopyRay.intersectObject(mesh)[0];
    const clothSculpt=scope.BERLIN_REFERENCE_ARCHITECTURE.meshes['13.5:0:1'].awningRevision;
    assert.ok(canopyHit&&(clothSculpt?canopyHit.point.y>4.59&&canopyHit.point.y<4.69:Math.abs(canopyHit.point.y-4.705)<.003),
      'the actual baked canopy has the shallow fabric bow between its unchanged wall mount and front hem');
    assert.ok(canopyHit.face.normal.y>.70&&canopyHit.face.normal.z>.64,'pitched cloth has the intended upward/forward lighting normal');
  }
  const triangles=(g.index?g.index.count:pos.count)/3;
  maximum=Math.max(maximum,triangles);total+=triangles;
}
assert.equal(Object.keys(kit.cache).length,36);
assert.ok(maximum<(scope.BERLIN_REFERENCE_ARCHITECTURE.meshes['13.5:0:1'].awningRevision?27000:25000),'per-building triangle budget includes the authored cloth shell and rounded focal profiles');
assert.equal(kit.texture.image.width,2048); assert.equal(kit.texture.image.height,2048);
scope.IS_MOBILE=true;
const mobileKit=createKit(THREE,(color,opts)=>new THREE.MeshStandardMaterial({color,...opts}),
  (width,height)=>({width,height,getContext:()=>ctx}));
assert.equal(mobileKit.texture.image.width,1024); assert.equal(mobileKit.texture.image.height,1024);
assert.ok(!kit.material.transparent,'no glass overdraw or sorting path');
// Legacy facade LOD must not restore the replaced dressing or materials.
assert.ok(html.includes('d.coreFarMaterial = berlinKiezKit.material;'));
assert.ok(html.includes('d.proxyDetailBase.fill(0);'));
assert.ok(html.includes('if (d.kiez) { writeInstances = false; d.roofShell.visible = false; }'));
console.log(`PASS: 36 Kiez modules including twelve Blender-derived facades; padded shared atlas, cached reuse, one material per building, normalized surfaces, pavement bounds and ${maximum} maximum triangles; ${total} cached triangles total. Actual surface rays reach ${shopRays} shop panes, ${returnRays} return-wall panes, ${turretRays} curved-bay panes, ${insetRays} recessed panes/returns/arched masonry and ${soffitRays} cornice undersides; ${preservedGroundTriangles} accepted ground-storey triangles retained.`);
console.log(`PASS: ${profileRays} surface rays verify substantial native/secondary architraves and closed rounded sills.`);
