'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v142'),name='berlin-reference-architecture-v1',keys=['13.5:0:1','13.5:1:1'];
const read=p=>JSON.parse(fs.readFileSync(path.join(stage,p),'utf8'));
const decode=r=>Object.fromEntries([['position',Float32Array],['normal',Int16Array],['color',Uint8Array],['uv',Float32Array],['index',Uint16Array]].map(([k,T])=>{const b=Buffer.from(r[k],'base64');return[k,new T(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))];}));
function validate(data,before){
  const plan=read('shop-transforms.json'),result={};
  for(const key of Object.keys(before.meshes)){
    const a=before.meshes[key],b=data.meshes[key];if(!keys.includes(key)){assert.deepEqual(b,a,'other native record '+key);continue;}
    const old=decode(a),now=decode(b),selected=new Map();
    assert.equal(b.shopDepthRevision,'visible-recessed-displays-v142');
    for(const k of Object.keys(a))if(!['position','normal'].includes(k))assert.deepEqual(b[k],a[k],k+' unchanged');
    for(const [kind,ids]of Object.entries(plan[key].vertices))for(const i of ids){assert.ok(!selected.has(i));selected.set(i,kind);}
    let changed=0;
    for(let i=0;i<a.vertices;i++){
      const kind=selected.get(i),p=Array.from(old.position.slice(i*3,i*3+3)),q=Array.from(now.position.slice(i*3,i*3+3));
      assert.equal(q[0],p[0]);assert.equal(q[1],p[1]);
      if(!kind){assert.equal(q[2],p[2]);for(let k=0;k<3;k++)assert.equal(now.normal[i*3+k],old.normal[i*3+k]);continue;}
      const tile=Math.floor(old.uv[i*2]*4)+4*Math.floor((1-old.uv[i*2+1])*4);
      let z;
      if(kind==='returns'){
        assert.equal(tile,1);assert.ok(p[1]>=.41999&&p[1]<=5.20001&&p[2]>=-.63001&&p[2]<=.41001);
        z=.41+(p[2]-.41)*(.24/1.04);
        const n=Array.from(old.normal.slice(i*3,i*3+3));n[2]/=(.24/1.04);const len=Math.hypot(...n);
        for(let k=0;k<3;k++)assert.ok(Math.abs(now.normal[i*3+k]-Math.round(n[k]/len*32767))<=1);
      }else{
        const delta={backdrops:.8,counters:.4,shelves:.6,bread:.4}[kind];assert.ok(delta);z=p[2]+delta;
        for(let k=0;k<3;k++)assert.equal(now.normal[i*3+k],old.normal[i*3+k],'translations preserve normals');
        if(kind==='backdrops'){assert.equal(tile,key===keys[0]?5:4);assert.equal(p[2],-.625);assert.ok(p[1]>.5299&&p[1]<5.1001);}
        if(kind==='counters')assert.ok([0,1].includes(tile)&&p[1]>=.5499&&p[1]<=1.0526&&p[2]>=-.5201&&p[2]<=.1201);
        if(kind==='shelves')assert.ok(tile===0&&p[1]>=1.5774&&p[1]<=2.3326&&p[2]>=-.5701&&p[2]<=-.3299);
        if(kind==='bread')assert.ok(key===keys[0]&&tile===0&&p[1]>1.02&&p[1]<1.18&&p[2]>-.23&&p[2]<-.07);
      }
      assert.ok(Math.abs(q[2]-z)<1e-6,'exact authored depth transform');
      assert.ok(q.every((x,k)=>x>=a.min[k]-1e-5&&x<=a.max[k]+1e-5),'original bounds');
      if(q[2]!==p[2])changed++;
    }
    result[key]={changedVertices:changed,protectedVertices:a.vertices-selected.size,triangles:a.triangles,vertices:a.vertices};
  }
  assert.deepEqual(data.atlas,before.atlas);return result;
}
module.exports={validate};
if(require.main===module){
  const before=read('baseline/'+name+'.json'),after=read('models/'+name+'.json'),records=validate(after,before);
  const oldKit=fs.readFileSync(path.join(stage,'baseline/berlin_kiez_kit.js'),'utf8'),newKit=fs.readFileSync(path.join(stage,'sources/berlin_kiez_kit.js'),'utf8');
  let restored=newKit;for(const [from,to]of read('edits.json').slice().reverse()){assert.equal(restored.split(to).length,2);restored=restored.replace(to,from);}assert.equal(restored,oldKit);
  const html=fs.readFileSync(path.join(stage,'candidate.html'),'utf8'),base=fs.readFileSync(path.join(stage,'baseline.html'),'utf8'),arch=/var BERLIN_REFERENCE_ARCHITECTURE = (\{[^\r\n]*\});/;
  const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();
  assert.equal(html.replace(trim(newKit),()=>trim(oldKit)).replace(arch,'ARCHITECTURE').replace("'kiez-reference-v142'","'kiez-reference-v141'"),base.replace(arch,'ARCHITECTURE'),'only bounded architecture data/factory edits');
  assert.deepEqual(JSON.parse(html.match(arch)[1]),require('./install_reference_architecture.cjs').packReferenceArchitecture(after));
  const scope=vm.createContext({console,atob:s=>Buffer.from(s,'base64').toString('binary')});
  vm.runInContext([...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('three.js r156 (MIT)')),scope);
  vm.runInContext(fs.readFileSync(path.join(root,'tools/berlin_packed_geometry.js'),'utf8'),scope);
  const T=scope.THREE,noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
  function kit(code,data){vm.runInContext(code,scope);scope.BERLIN_REFERENCE_ARCHITECTURE=data;return scope.createBerlinKiezKit(T,(color,o)=>new T.MeshStandardMaterial({color,...o}),()=>({getContext:()=>ctx}));}
  const old=kit(oldKit,before),now=kit(newKit,after);let layouts=0,bookRays=0,maxTriangles=0;
  const shader=m=>{const s={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};m.onBeforeCompile(s);return s;};
  assert.deepEqual(shader(now.material),shader(old.material),'exact assembled material shader');
  for(const w of [11,13.5,16])for(let v=0;v<6;v++)for(const side of [-1,1]){
    const a=old.geometry(w,v,side),b=now.geometry(w,v,side);assert.deepEqual(b.groups,a.groups);assert.equal(b.index.count,a.index.count);assert.equal(b.attributes.position.count,a.attributes.position.count);
    for(const name of ['uv'])assert.deepEqual(b.attributes[name].array,a.attributes[name].array,'unchanged atlas layout');
    for(const name of Object.keys(a.attributes))assert.equal(b.attributes[name].array.byteLength,a.attributes[name].array.byteLength);
    assert.ok(b.boundingBox.min.distanceTo(a.boundingBox.min)<1e-5&&b.boundingBox.max.distanceTo(a.boundingBox.max)<1e-5,'same runtime bounds');
    maxTriangles=Math.max(maxTriangles,b.index.count/3);
    if(v===1){
      assert.equal(b.userData.displayBookCount,6);const range=b.userData.displayBookFaces;assert.equal(range[1]-range[0],156);
      for(let f=range[0];f<range[1];f++)for(let j=0;j<3;j++){
        const i=b.index.getX(f*3+j);assert.ok(Math.abs(b.attributes.position.getY(i)-a.attributes.position.getY(i)-.29)<1e-6);assert.ok(Math.abs(b.attributes.position.getZ(i)-a.attributes.position.getZ(i)-.26)<1e-6);
      }
      const mesh=new T.Mesh(b,now.material);mesh.updateMatrixWorld(true);
      for(const bay of [-4.2,0,4.2])for(const offset of [-.82,.82]){
        const ray=new T.Raycaster(new T.Vector3((bay+offset)*w/13.5*side,1.345,4),new T.Vector3(0,0,-1)),hit=ray.intersectObject(mesh)[0];
        assert.ok(hit&&hit.faceIndex>=range[0]&&hit.faceIndex<range[1],'physical display cover visible above its counter');bookRays++;
      }
    }
    layouts++;
  }
  const visibility=read('shop-visibility.json');
  for(const deg of [30,45,60,70,-60,-70]){
    const a=visibility.baseline.find(r=>r.degrees===deg),b=visibility.models.find(r=>r.degrees===deg);
    assert.equal(b.misses,0);assert.ok(b.visibleMerchandise>a.visibleMerchandise);
    if(Math.abs(deg)>=60)assert.ok(b.visibleMerchandise>=144,'at least 64% visible at oblique angles');
  }
  const result={passed:true,records,layouts,bookRays,maxTriangles,unchangedMeshCounts:true,unchangedShader:true,addedDraws:0,addedTextures:0,candidateSha256:crypto.createHash('sha256').update(html).digest('hex')};
  fs.writeFileSync(path.join(stage,'geometry-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
