'use strict';
// Offline local surface fairing of the accepted V120 sculpt. UVs/topology,
// original rig, material coordinates and contact pads remain untouched.
function sculptCourierSurfaceV145(T,target,source,skeleton,joints,posePins=[]){
  const p=target.attributes.position,n=target.attributes.normal,index=target.index;
  const originalP=p.array.slice(),originalN=n.array.slice(),names=skeleton.bones.map(b=>b.name);
  const si=source.attributes.skinIndex,sw=source.attributes.skinWeight;
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const jointsByName=Object.fromEntries(names.map((name,i)=>[name,joints[i]]));
  const wristAxes=['Left','Right'].map(side=>jointsByName[side+'Hand'].clone().sub(jointsByName[side+'ForeArm']).normalize());
  const nodes=[],nodeForVertex=[],welds=new Map();
  for(let i=0;i<p.count;i++){
    const q=new T.Vector3().fromBufferAttribute(p,i),key=q.toArray().map(v=>v.toFixed(6)).join(',');
    if(!welds.has(key)){welds.set(key,nodes.length);nodes.push({original:q.clone(),q:q.clone(),ids:[],adj:new Set(),weight:0,region:'',boundary:false});}
    const id=welds.get(key),node=nodes[id];node.ids.push(i);nodeForVertex[i]=id;
    let hands=[0,0],shoe=0,leg=0;
    for(let k=0;k<4;k++){const name=names[si.getComponent(i,k)],w=sw.getComponent(i,k);for(let s=0;s<2;s++)if(name===['Left','Right'][s]+'Hand')hands[s]+=w;if(/^(Left|Right)(Foot|ToeBase)$/.test(name))shoe+=w;if(/^(Left|Right)Leg$/.test(name))leg+=w;}
    const handSide=hands[0]>=hands[1]?0:1,along=q.clone().sub(jointsByName[['Left','Right'][handSide]+'Hand']).dot(wristAxes[handSide]);
    const hand=smooth(.35,.85,Math.max(...hands))*smooth(-.012,.022,along);
    const footwear=smooth(.35,.75,shoe)*smooth(.025,.055,source.attributes.position.getY(i))*(1-smooth(.135,.185,q.y));
    const rawY=source.attributes.position.getY(i),calf=smooth(.35,.8,leg)*smooth(.19,.25,rawY)*(1-smooth(.40,.47,rawY));
    const choices=[['hand',hand],['shoe',footwear],['calf',calf*.8]].sort((a,b)=>b[1]-a[1]);
    if(choices[0][1]>node.weight){node.weight=choices[0][1];node.region=choices[0][0];}
  }
  const edges=new Map(),faces=[];
  for(let t=0;t<index.count;t+=3){
    const ids=[0,1,2].map(k=>index.getX(t+k)),ns=ids.map(i=>nodeForVertex[i]);
    const q=ns.map(i=>nodes[i].original),normal=q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0]));
    faces.push({ids,nodes:ns,normal,area:normal.length()});
    for(let k=0;k<3;k++){const a=ns[k],b=ns[(k+1)%3];if(a===b)continue;nodes[a].adj.add(b);nodes[b].adj.add(a);const key=a<b?a+','+b:b+','+a;edges.set(key,(edges.get(key)||0)+1);}
  }
  for(const [key,count]of edges)if(count!==2)for(const id of key.split(',').map(Number)){nodes[id].boundary=true;nodes[id].weight=0;}
  // These vertices were identified by the full authored pose sweep. Preserve
  // welded copies together where skinning makes a local triangle fragile.
  for(const vertex of posePins)nodes[nodeForVertex[vertex]].weight=0;
  // Twelve Taubin pairs suppress local bumps while retaining broad palm/shoe
  // volume. Weights and neighbours come from the fixed rest surface.
  for(const node of nodes){node.stencil=[...node.adj].map(id=>[id,1/Math.max(.004,node.original.distanceTo(nodes[id].original))]);}
  for(const step of Array.from({length:24},(_,i)=>i%2?-.51:.5)){
    const next=nodes.map(node=>{
      if(!node.weight)return node.q.clone();const average=new T.Vector3();let total=0;
      for(const [id,w]of node.stencil){average.addScaledVector(nodes[id].q,w);total+=w;}
      const q=node.q.clone().addScaledVector(average.divideScalar(Math.max(total,1e-8)).sub(node.q),step*node.weight);
      const move=q.clone().sub(node.original),limit=node.region==='hand'?.015:.012;
      if(move.length()>limit)q.copy(node.original).add(move.setLength(limit));return q;
    });
    nodes.forEach((node,i)=>node.q.copy(next[i]));
  }
  // Reject local deformations that collapse or invert an existing triangle.
  const pinned=new Set();let repairPasses=0;
  for(;repairPasses<8;repairPasses++){
    const bad=new Set();for(const f of faces){if(f.area<1e-9)continue;
      const q=f.nodes.map(i=>nodes[i].q),nn=q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0])),ratio=nn.length()/f.area;
      const oldNormal=f.ids.reduce((sum,i)=>sum.add(new T.Vector3().fromArray(originalN,i*3)),new T.Vector3()).normalize();
      const foldsAgainstNormal=f.normal.clone().normalize().dot(oldNormal)>.2&&nn.clone().normalize().dot(oldNormal)<.1;
      if(ratio<.20||ratio>5||nn.dot(f.normal)/(nn.length()*f.area)<.25||foldsAgainstNormal)for(const id of f.nodes)if(nodes[id].weight)bad.add(id);
    }
    if(!bad.size)break;for(const id of bad){nodes[id].q.copy(nodes[id].original);nodes[id].weight=0;pinned.add(id);}
  }
  for(const node of nodes)for(const i of node.ids){
    if(node.q.equals(node.original))p.setXYZ(i,originalP[i*3],originalP[i*3+1],originalP[i*3+2]);
    else p.setXYZ(i,node.q.x,node.q.y,node.q.z);
  }
  // Corner-angle normals are stable across UV duplicates and irregular
  // triangulation; preserve the original sharp protected contact/cuff data.
  const sums=nodes.map(()=>new T.Vector3());
  for(const f of faces){const q=f.nodes.map(i=>nodes[i].q),normal=q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0]));if(normal.length()<1e-9)continue;normal.normalize();
    for(let k=0;k<3;k++){const a=q[(k+1)%3].clone().sub(q[k]).normalize(),b=q[(k+2)%3].clone().sub(q[k]).normalize(),angle=Math.acos(Math.max(-1,Math.min(1,a.dot(b))));sums[f.nodes[k]].addScaledVector(normal,angle);}
  }
  const normalChanged=new Set();
  for(let id=0;id<nodes.length;id++){
    const node=nodes[id];if(!node.weight||sums[id].length()<1e-8)continue;const rounded=sums[id].normalize();
    for(const i of node.ids){const old=new T.Vector3().fromArray(originalN,i*3),blend=node.weight;
      if(old.dot(rounded)<.1)continue;const nn=old.lerp(rounded,blend).normalize();n.setXYZ(i,nn.x,nn.y,nn.z);normalChanged.add(id);}
  }
  const normalRepairs=new Set();
  for(let pass=0;pass<4;pass++)for(const f of faces){if(f.area<1e-9)continue;
    const old=f.ids.reduce((v,i)=>v.add(new T.Vector3().fromArray(originalN,i*3)),new T.Vector3()).normalize();
    if(f.normal.clone().normalize().dot(old)<=.2)continue;
    const q=f.nodes.map(i=>nodes[i].q),face=q[1].clone().sub(q[0]).cross(q[2].clone().sub(q[0])).normalize(),now=f.ids.reduce((v,i)=>v.add(new T.Vector3().fromBufferAttribute(n,i)),new T.Vector3()).normalize();
    if(face.dot(now)<.05)for(const id of f.nodes){for(const i of nodes[id].ids)n.setXYZ(i,originalN[i*3],originalN[i*3+1],originalN[i*3+2]);normalRepairs.add(id);}
  }
  const counts={},moves=[];let protectedVertices=0;
  for(const node of nodes){const move=node.q.distanceTo(node.original);if(move>1e-9){counts[node.region]=(counts[node.region]||0)+node.ids.length;moves.push(move);}else protectedVertices+=node.ids.length;}
  target.userData.courierSurfaceV145={regions:counts,protectedPositions:protectedVertices,maxMove:Math.max(...moves),pinnedNodes:pinned.size,normalRepairNodes:normalRepairs.size,repairPasses,unchangedTopology:true};
  return target.userData.courierSurfaceV145;
}
module.exports={sculptCourierSurfaceV145};
