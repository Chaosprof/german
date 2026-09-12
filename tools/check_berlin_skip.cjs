'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
const section=(a,b)=>{const start=html.indexOf(a),end=html.indexOf(b,start+a.length);assert.ok(start>=0&&end>start);return html.slice(start,end);};
const c=vm.createContext({console});
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('three.js r156 (MIT)')),c);
const T=c.THREE;c.clamp=T.MathUtils.clamp;
const material=color=>new T.MeshStandardMaterial({color,roughness:.68,metalness:.12});
c.MAT={metalDark:material(0x33465c),concrete:material(0x9ea89f),stone:material(0x737e80)};
c.PROP_SKIP_BODY=material(0xd28728);c.PROP_CAFE_CREAM=material(0xe7d6b3);c.PROP_KIOSK_RED=material(0xe0402e);
vm.runInContext(section('  var geoCache = Object.create(null);','  // ------------------------------------------------- generated prop swaps'),c);
vm.runInContext(section('  function mergeBoxes(specs) {','\n  // DRAW-CALL CONSOLIDATION:'),c);
vm.runInContext(section('  var staticMergeGeometryCache = new Map();','  // Merges building parts that carry different materials'),c);
c.registerProp=(_kind,g)=>{c.compactStaticPropGroup(g);return g;};
vm.runInContext(section('  function makeSkip(','  function makeRunnerTram() {'),c);
const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
let vertices=0,triangles=0,draws=0;
const examples=[];
for(let variant=0;variant<4;variant++){
  const skip=c.makeSkip(variant);skip.updateMatrixWorld(true);examples.push(skip);
  const bounds=new T.Box3().setFromObject(skip);
  assert.ok(bounds.min.x>=-1.2&&bounds.max.x<=1.2&&bounds.min.z>=-1.75&&bounds.max.z<=1.75&&
    bounds.min.y>=-1e-6&&bounds.max.y<=1.85,'all steelwork, reflectors and rubble fit the existing hitbox');
  for(const y of [.35,.8,1.3]){
    ray.set(new T.Vector3(0,y,-4),new T.Vector3(0,0,1));
    const hit=ray.intersectObject(skip,true)[0];
    assert.ok(hit&&hit.object.material===c.PROP_SKIP_BODY,'incoming runner sees outward-facing painted end wall');
    assert.ok(Math.abs(hit.point.z+1.25+(y-.18)*(.43/1.40))<1e-5,'front wall has the authored taper');
  }
  // The lip surrounds a genuinely open cavity, not a flat lid beneath rocks.
  for(const x of [-.44,.44]){
    ray.set(new T.Vector3(x,4,1.40),down);
    const hit=ray.intersectObject(skip,true)[0];
    assert.ok(hit&&hit.object.material===c.MAT.metalDark&&hit.point.y<1.25,'open top exposes recessed interior wall');
  }
  ray.set(new T.Vector3(1.11,4,0),down);
  assert.ok(ray.intersectObject(skip,true)[0].point.y>=1.6,'rolled lip remains above the cavity');
  let count=0,tris=0;
  skip.traverse(o=>{if(!o.isMesh)return;count++;tris+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;
    assert.ok(o.castShadow&&!o.material.transparent,'opaque geometry participates in shadows');
    for(const attr of Object.values(o.geometry.attributes))assert.ok(Array.from(attr.array).every(Number.isFinite));
    vertices+=o.geometry.attributes.position.count;
  });
  assert.ok(count<=6&&tris<2200,`bounded opaque material and geometry budget: ${count} draws / ${tris} triangles`);
  draws=Math.max(draws,count);triangles=Math.max(triangles,tris);
  const again=c.makeSkip(variant);
  assert.ok(again.children.every((m,i)=>m.geometry===skip.children[i].geometry&&m.material===skip.children[i].material),'identical variants share their buffers');
}
if(process.argv.includes('--export')){
  const data=[];
  examples[0].traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry;
    const p=geo.attributes.position,n=geo.attributes.normal,positions=[],normals=[],v=new T.Vector3();
    const normal=new T.Matrix3().getNormalMatrix(o.matrixWorld);
    for(let i=0;i<p.count;i++){
      positions.push(...v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).toArray());
      normals.push(...v.fromBufferAttribute(n,i).applyNormalMatrix(normal).toArray());
    }
    data.push({position:positions,normal:normals,color:o.material.color.toArray(),roughness:o.material.roughness});
  });
  fs.mkdirSync(path.join(root,'.tmp'),{recursive:true});
  fs.writeFileSync(path.join(root,'.tmp/berlin-skip-inspection.json'),JSON.stringify(data));
}
console.log(`PASS: 4 open skip variants; ${vertices} finite vertices, tapered exterior and open-cavity rays; unchanged 2.4×3.5×1.85m envelope; ${draws} draws / ${triangles} triangles; shared buffers.`);
