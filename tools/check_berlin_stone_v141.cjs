'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v141'),name='berlin-reference-architecture-v1',key='13.5:0:1';
const read=p=>JSON.parse(fs.readFileSync(path.join(stage,p),'utf8'));
const decode=r=>Object.fromEntries([['position',Float32Array],['normal',Int16Array],['color',Uint8Array],['uv',Float32Array],['index',Uint16Array]].map(([k,T])=>{const b=Buffer.from(r[k],'base64');return[k,new T(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength))];}));
function validate(data,before){
  const plan=read('stone.json'),a=before.meshes[key],b=data.meshes[key],old=decode(a),now=decode(b);
  assert.equal(b.stoneRevision,'eased-turret-cornices-v141');
  for(const k of Object.keys(before.meshes))if(k!==key)assert.deepEqual(data.meshes[k],before.meshes[k],k+' exact');
  for(const k of Object.keys(a))if(!['position','normal','uv','color','index','vertices','triangles'].includes(k))assert.deepEqual(b[k],a[k],k+' retained');
  assert.equal(b.triangles,a.triangles+704);assert.deepEqual(data.atlas,before.atlas);
  const removed=new Set(plan.removedFaces);assert.equal(removed.size,320);
  let retained=0;
  for(let f=0;f<a.triangles;f++){
    if(removed.has(f)){
      for(const v of old.index.slice(f*3,f*3+3)){
        assert.equal(Math.floor(old.uv[v*2]*4)+4*Math.floor((1-old.uv[v*2+1])*4),1,'only actual masonry tile');
        const p=Array.from(old.position.slice(v*3,v*3+3));
        assert.ok(plan.cornices.some(c=>p.every((x,k)=>x>=c.min[k]-1e-5&&x<=c.max[k]+1e-5)),'only four turret bands may change');
      }
      continue;
    }
    for(let j=0;j<3;j++)for(const [attr,size] of [['position',3],['normal',3],['color',3],['uv',2]]){
      const x=old.index[f*3+j],y=now.index[retained*3+j];
      for(let k=0;k<size;k++)assert.equal(now[attr][y*size+k],old[attr][x*size+k],'protected triangle corner '+attr);
    }
    retained++;
  }
  assert.equal(retained,a.triangles-320);
  const sub=(a,b)=>a.map((x,k)=>x-b[k]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a.reduce((s,x,k)=>s+x*b[k],0);
  let minFacing=1;
  for(let band=0;band<4;band++){
    const edges=new Map(),positions=new Map(),ys=new Set();
    for(let f=retained+band*256;f<retained+(band+1)*256;f++){
      const ids=Array.from(now.index.slice(f*3,f*3+3)),p=ids.map(v=>Array.from(now.position.slice(v*3,v*3+3))),n=ids.map(v=>Array.from(now.normal.slice(v*3,v*3+3),x=>x/32767));
      const face=cross(sub(p[1],p[0]),sub(p[2],p[0])),shade=[0,1,2].map(k=>n.reduce((s,v)=>s+v[k],0));
      const facing=dot(face,shade)/(Math.hypot(...face)*Math.hypot(...shade));minFacing=Math.min(minFacing,facing);
      assert.ok(Math.hypot(...face)>1e-9&&facing>.6,'nondegenerate outward surface');
      for(let k=0;k<3;k++){
        assert.ok(Math.abs(Math.hypot(...n[k])-1)<.0001,'unit normal');
        assert.ok(p[k].every((x,d)=>x>=a.min[d]-1e-5&&x<=a.max[d]+1e-5),'within original culling bounds');
        const v=ids[k];assert.equal(Math.floor(now.uv[v*2]*4)+4*Math.floor((1-now.uv[v*2+1])*4),1,'same atlas cell');
        const pa=p[k].join(','),pb=p[(k+1)%3].join(',');positions.set(pa,p[k]);ys.add(p[k][1]);
        const edge=[pa,pb].sort().join('|');edges.set(edge,(edges.get(edge)||0)+1);
      }
    }
    assert.equal(positions.size,130);assert.equal(ys.size,4);
    assert.ok([...edges.values()].every(n=>n===2),'closed cornice with two faces per edge');
    const c=plan.cornices[band],mid=(c.min[1]+c.max[1])/2;
    const levels=[...ys].sort((a,b)=>a-b),lower=[...positions.values()].filter(p=>p[1]===levels[1]);
    assert.equal(lower.length,32,'32 real outer ring vertices');
    const nominal=c.bottomRadius+(c.topRadius-c.bottomRadius)*(levels[1]-levels[0])/(levels[3]-levels[0]);
    for(const p of lower)assert.ok(Math.abs(Math.hypot((p[0]-4.65)/1.14,p[2]+.05)-nominal)<2e-5,'ellipse fits authored drum');
  }
  return {protectedTriangles:retained,changedCornices:4,addedTriangles:b.triangles-a.triangles,beforeVertices:a.vertices,afterVertices:b.vertices,minFacing};
}
module.exports={validate};
if(require.main===module){
  const before=read('baseline/'+name+'.json'),after=read('models/'+name+'.json'),result=validate(after,before);
  const html=fs.readFileSync(path.join(stage,'candidate.html'),'utf8'),baseline=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
  const arch=/var BERLIN_REFERENCE_ARCHITECTURE = (\{[^\r\n]*\});/;
  assert.equal(html.replace(arch,'ARCHITECTURE').replace("'kiez-reference-v141'","'kiez-reference-v140'"),baseline.replace(arch,'ARCHITECTURE'),'all code, rendering, shaders and gameplay exact');
  assert.deepEqual(JSON.parse(html.match(arch)[1]),require('./install_reference_architecture.cjs').packReferenceArchitecture(after));
  Object.assign(result,{passed:true,unchangedRenderCode:true,addedDraws:0,addedTextures:0,candidateSha256:crypto.createHash('sha256').update(html).digest('hex')});
  fs.writeFileSync(path.join(stage,'geometry-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
