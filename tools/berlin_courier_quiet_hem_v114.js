'use strict';
// Complete candidate from the same V97 base; preserves the frozen V114 cuffs.
const base=require('./berlin_courier_soft_normals_v114.js');
function sculptCourierFormsV114(T,g,source,sk,joints){
  const originalBasePositions=g.attributes.position.array.slice(),originalBaseNormals=g.attributes.normal.array.slice();
  base.sculptCourierFormsV114(T,g,source,sk,joints);
  const p=g.attributes.position,n=g.attributes.normal,si=source.attributes.skinIndex,sw=source.attributes.skinWeight;
  const prior=p.array.slice(),priorN=n.array.slice(),names=sk.bones.map(b=>b.name);
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const bell=(x,c,w)=>Math.exp(-(((x-c)/w)**2));
  const joint=name=>joints[names.indexOf(name)].toArray();
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const frames=['Left','Right'].map(s=>{const a=joint(s+'Arm'),end=joint(s+'ForeArm'),d=end.map((v,k)=>v-a[k]),length=Math.hypot(...d);return{a,axis:d.map(v=>v/length),length};});
  const meta=[],welds=new Map();
  for(let i=0;i<p.count;i++){
    const m={q:[p.getX(i),p.getY(i),p.getZ(i)],rawY:source.attributes.position.getY(i),arm:[0,0],head:0,hand:0,foot:0};
    for(let k=0;k<4;k++){
      const name=names[si.getComponent(i,k)],w=sw.getComponent(i,k),side=name.startsWith('Left')?0:1;
      if(/^(Left|Right)(Shoulder|Arm|ForeArm)$/.test(name))m.arm[side]+=w;
      if(/^(Head|head_end|headfront|neck)$/.test(name))m.head+=w;
      if(/^(Left|Right)Hand$/.test(name))m.hand+=w;
      if(/^(Left|Right)(Foot|ToeBase)$/.test(name))m.foot+=w;
    }
    m.protected=m.head>.001||m.hand>.45||m.foot>.45||m.rawY<.215||m.rawY>1.285;
    m.key=m.q.map(v=>v.toFixed(6)).join(',');if(!welds.has(m.key))welds.set(m.key,[]);welds.get(m.key).push(i);meta.push(m);
  }
  function deform(q,m){
    const out=q.slice();
    for(let s=0;s<2;s++){
      if(m.arm[s]<.001)continue;
      const f=frames[s],d=q.map((v,k)=>v-f.a[k]),along=dot(d,f.axis),r=d.map((v,k)=>v-along*f.axis[k]),radius=Math.max(.018,Math.hypot(...r));
      // Smooth shoulder/sleeve barrel. This replaces lumpy radial jumps with
      // a fuller continuous contour, while retaining the authored armpit.
      const gate=smooth(-.005,.033,along)*(1-smooth(.145,.205,along))*(1-smooth(.160,.185,radius))*m.arm[s];
      const target=.115+.014*bell(along,.066,.067)-.052*smooth(.09,.22,along);
      const displacement=(target-radius)*.60*gate;
      for(let k=0;k<3;k++)out[k]+=displacement*r[k]/radius;
    }
    // A gathered jacket edge needs actual thickness around the whole waist,
    // with a hollow above it, rather than a dark band on a flat skirt surface.
    const body=1-smooth(.015,.11,m.arm[0]+m.arm[1]);
    const y=q[1],x=q[0],z=q[2]-.018,r=Math.max(.025,Math.hypot(x,z));
    const cloth=smooth(.721,.758,m.rawY)*(1-smooth(.91,1.01,m.rawY))*body*smooth(.083,.12,r);
    const hemY=.851+.036*Math.abs(x);
    const edge=.0055*bell(y,hemY,.034)-.0020*bell(y,hemY+.046,.030);
    const swell=.006*bell(y,.930,.065)*(1-smooth(.02,.13,-z));
    out[0]+=cloth*(edge+swell)*x/r;out[2]+=cloth*(edge+swell)*z/r;
    out[1]+=.003*cloth*bell(y,.838,.045);
    return out;
  }
  const changed=new Set();let maxMove=0,minDet=Infinity,epsilon=.00001;
  for(let i=0;i<p.count;i++){
    const m=meta[i];if(m.protected)continue;const q=m.q,out=deform(q,m),move=Math.hypot(...out.map((v,k)=>v-q[k]));
    if(move<1e-10)continue;
    const columns=[];
    for(let k=0;k<3;k++){const lo=q.slice(),hi=q.slice();lo[k]-=epsilon;hi[k]+=epsilon;const a=deform(lo,m),b=deform(hi,m);columns.push(b.map((v,k)=>(v-a[k])/(2*epsilon)));}
    const c0=cross(columns[1],columns[2]),c1=cross(columns[2],columns[0]),c2=cross(columns[0],columns[1]),det=dot(columns[0],c0);
    if(!isFinite(det)||det<.12)throw Error('Invalid contour frame '+i+' '+det);
    const normal=[n.getX(i),n.getY(i),n.getZ(i)],nn=[0,1,2].map(k=>(c0[k]*normal[0]+c1[k]*normal[1]+c2[k]*normal[2])/det),len=Math.hypot(...nn);
    p.setXYZ(i,...out);n.setXYZ(i,...nn.map(v=>v/len));changed.add(i);maxMove=Math.max(maxMove,move);minDet=Math.min(minDet,det);
  }
  // Protect donor sliver orientation under this larger shoulder curvature.
  const at=i=>new T.Vector3().fromBufferAttribute(p,i),old=i=>new T.Vector3().fromArray(originalBasePositions,i*3),repairs=new Set(),idx=g.index;
  for(let pass=0;pass<16;pass++){
    let count=0;
    for(let t=0;t<idx.count;t+=3){
      const ids=[idx.getX(t),idx.getX(t+1),idx.getX(t+2)];if(!ids.some(i=>changed.has(i)))continue;
      const before=ids.map(old),after=ids.map(at),bf=before[1].clone().sub(before[0]).cross(before[2].clone().sub(before[0])),af=after[1].clone().sub(after[0]).cross(after[2].clone().sub(after[0]));
      if(bf.length()<1e-9)continue;
      const areaRatio=af.length()/bf.length();
      if(bf.clone().normalize().dot(af.clone().normalize())>.08&&areaRatio>.18&&areaRatio<7.5)continue;
      const lengths=[before[0].distanceToSquared(before[1]),before[1].distanceToSquared(before[2]),before[2].distanceToSquared(before[0])],edge=lengths.indexOf(Math.max(...lengths)),a=edge,b=(edge+1)%3,c=(edge+2)%3;
      if(meta[ids[c]].protected)throw Error('Protected contour sliver');
      const axis=after[b].clone().sub(after[a]).normalize(),offset=after[c].clone().sub(after[a]),point=after[a].clone().addScaledVector(axis,offset.dot(axis));
      point.addScaledVector(bf.clone().normalize().cross(axis).normalize(),Math.max(bf.length()/Math.sqrt(lengths[edge])*(areaRatio>7.5?4:.80),.000015));
      for(const i of welds.get(meta[ids[c]].key)){p.setXYZ(i,point.x,point.y,point.z);repairs.add(i);changed.add(i);}count++;
    }
    if(!count)break;
  }
  const normalRepairs=new Set();
  for(let pass=0;pass<8;pass++)for(let t=0;t<idx.count;t+=3){
    const ids=[idx.getX(t),idx.getX(t+1),idx.getX(t+2)];if(!ids.some(i=>changed.has(i)))continue;
    const before=ids.map(old),after=ids.map(at),bf=before[1].clone().sub(before[0]).cross(before[2].clone().sub(before[0])).normalize(),af=after[1].clone().sub(after[0]).cross(after[2].clone().sub(after[0])).normalize();
    const bn=ids.reduce((sum,i)=>sum.add(new T.Vector3().fromArray(originalBaseNormals,i*3)),new T.Vector3()).normalize();if(bf.dot(bn)<.2)continue;
    const an=ids.reduce((sum,i)=>sum.add(new T.Vector3().fromBufferAttribute(n,i)),new T.Vector3()).normalize(),alignment=af.dot(an);if(alignment>.018)continue;
    for(const i of ids)if(changed.has(i)&&!meta[i].protected){
      const normal=new T.Vector3().fromBufferAttribute(n,i).addScaledVector(af,(.023-alignment)*1.25).normalize();
      for(const v of welds.get(meta[i].key))if(changed.has(v)&&!meta[v].protected){n.setXYZ(v,normal.x,normal.y,normal.z);normalRepairs.add(v);}
    }
  }
  let unchangedCuffVertices=0,changedShoulderVertices=0,changedHemVertices=0;
  for(let i=0;i<p.count;i++){
    const m=meta[i],wrist=g.attributes.aCourierGarment.getY(i);
    if((m.arm[0]+m.arm[1])>.5&&wrist>=.103&&wrist<=.205){
      for(let k=0;k<3;k++)if(p.getComponent(i,k)!==prior[i*3+k]||n.getComponent(i,k)!==priorN[i*3+k])throw Error('Contour must preserve existing cuff '+i);
      unchangedCuffVertices++;
    }
    if(changed.has(i)){if(m.arm[0]+m.arm[1]>.1)changedShoulderVertices++;else changedHemVertices++;}
  }
  g.userData.courierFormsV114.contour={changedVertices:changed.size,changedShoulderVertices,changedHemVertices,maxMove,minDet,sliverCorrections:repairs.size,normalRepairs:normalRepairs.size,unchangedCuffVertices};
}
module.exports={sculptCourierFormsV114};
