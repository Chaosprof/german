const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-facades-v119');
const html=fs.readFileSync(path.join(stage,'candidate.html'),'utf8'),scope=vm.createContext({console});
vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('three.js r156 (MIT)')),scope);
const THREE=scope.THREE;scope.atob=s=>Buffer.from(s,'base64').toString('binary');
scope.BERLIN_REFERENCE_ARCHITECTURE=JSON.parse(fs.readFileSync(path.join(root,'assets/models/berlin-reference-architecture-v1.json')));
vm.runInContext(fs.readFileSync(path.join(root,'tools/berlin_packed_geometry.js'),'utf8'),scope);
const noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
function kit(file){vm.runInContext(fs.readFileSync(file,'utf8'),scope);return scope.createBerlinKiezKit(THREE,(c,o)=>new THREE.MeshStandardMaterial({color:c,...o}),()=>({getContext:()=>ctx}));}
const old=kit(path.join(stage,'baseline/berlin_kiez_kit.js')),candidate=kit(path.join(stage,'berlin_kiez_kit.js'));
const report=[];
for(const width of [11,13.5,16])for(let variant=0;variant<6;variant++)for(const side of [-1,1]){
  const g=candidate.geometry(width,variant,side),p=g.attributes.position;
  assert.equal(candidate.geometry(width,variant,side),g,'cached shared geometry');
  assert.equal(g.groups.length,1);assert.equal(g.groups[0].materialIndex,0,'one existing material batch');
  assert.ok(g.userData.flowerBoxes>=1&&g.userData.flowerBoxes<=4);
  const added=g.index.count/3-g.userData.finishBaseTriangles;assert.ok(added<=760,'bounded added planting per frontage');
  for(let i=0;i<p.count;i++){
    assert.ok(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
    const n=g.attributes.normal;assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.002);
    if(i>=g.userData.finishBaseVertices)assert.ok(p.getY(i)>4.4&&p.getZ(i)<3.1,'planting stays above shops and out of the road');
  }
  for(const i of g.index.array)assert.ok(i<p.count);
  if(variant<2){
    const b=old.geometry(width,variant,side);
    for(const attr of Object.keys(b.attributes))if(attr!=='color')assert.deepEqual(g.attributes[attr].array.subarray(0,b.attributes[attr].array.length),b.attributes[attr].array,'focal authored mesh preserved exactly');
    for(let i=0;i<b.attributes.position.count;i++){
      const u=b.attributes.uv,cell=Math.floor(u.getX(i)*4)+Math.floor((1-u.getY(i))*4)*4;
      for(let k=0;k<3;k++){
        const from=b.attributes.color.getComponent(i,k),to=g.attributes.color.getComponent(i,k);
        if(cell!==1)assert.equal(to,from,'only plaster receives bounded baked paint variation');
        else assert.ok(Math.abs(to-from)<=.0331*from+(b.attributes.color.normalized?1/255:.00001),'plaster RGB changes by at most 3.3% plus packing precision');
      }
    }
  }
  assert.equal(g.attributes.color.itemSize,4);
  assert.equal(g.attributes.color.count,p.count);
  report.push({width,variant,side,boxes:g.userData.flowerBoxes,addedTriangles:added,finishBytes:g.attributes.color.count*g.attributes.color.array.BYTES_PER_ELEMENT});
}
const shader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};
candidate.material.onBeforeCompile(shader);
const oldShader={vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader,uniforms:{}};old.material.onBeforeCompile(oldShader);
assert.equal(shader.vertexShader,oldShader.vertexShader,'no new custom attribute or varying');
assert.ok(!shader.fragmentShader.includes('sin('),'static facade variation is baked, not evaluated per pixel');
assert.ok(shader.fragmentShader.includes('if(kiezShop>0.5){')&&shader.fragmentShader.includes('totalEmissiveRadiance+=kiezRoomBounce;'));
assert.ok(!shader.fragmentShader.includes('kiezShop*0.46'));
assert.ok(!shader.fragmentShader.includes('texture2D('),'finish adds no texture lookup');
assert.equal(candidate.material.transparent,false);
const book=candidate.geometry(13.5,1,1);let litReturns=0;
for(let i=0;i<book.attributes.position.count;i++){
  const c=book.attributes.color,p=book.attributes.position,u=book.attributes.uv;
  const tile=Math.floor(u.getX(i)*4)+Math.floor((1-u.getY(i))*4)*4;
  const bounce=tile<2?c.getW(i):0;
  assert.ok(c.getW(i)>=0&&c.getW(i)<=1,'bounded normalized finish fields');
  if(c.getX(i)<=c.getY(i)+.019||c.getX(i)>=.46)assert.equal(bounce,0,'teal joinery and pale stone receive no brown-room bounce');
  if(p.getY(i)>=4.5||tile>=2)assert.equal(bounce,0,'upper storeys and glazed room images remain outside the brown-return mask');
  if(bounce>.8)litReturns++;
}
assert.ok(litReturns>100,'warm reveal mask reaches actual bookstore geometry');
assert.ok(THREE.ShaderChunk.opaque_fragment.includes('diffuseColor.a = 1.0;'),'opaque shader output discards the packed light mask from output opacity');
fs.writeFileSync(path.join(stage,'geometry-check.json'),JSON.stringify({passed:true,layouts:report,shaderSourceOnly:true},null,2));
console.log(JSON.stringify({passed:true,layouts:report.length,addedTriangles:[Math.min(...report.map(r=>r.addedTriangles)),Math.max(...report.map(r=>r.addedTriangles))],boxes:[Math.min(...report.map(r=>r.boxes)),Math.max(...report.map(r=>r.boxes))]}));
