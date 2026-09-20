'use strict';
// Optional shape-preview experiment, separate from the accepted staged patch.
const base=require('./berlin_courier_forms_v114.js');
function sculptCourierFormsV114(T,g,source,skeleton,joints){
  base.sculptCourierFormsV114(T,g,source,skeleton,joints);
  const p=g.attributes.position,n=g.attributes.normal,idx=g.index,si=source.attributes.skinIndex,sw=source.attributes.skinWeight;
  const original=n.array.slice();
  const groups=new Map(),ids=[],cloth=[];
  for(let i=0;i<p.count;i++){
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(6)).join(',');
    if(!groups.has(key))groups.set(key,{ids:[],neighbours:new Set(),normal:new T.Vector3()});
    const group=groups.get(key);group.ids.push(i);group.normal.add(new T.Vector3(n.getX(i),n.getY(i),n.getZ(i)));ids.push(group);
    let protect=0,arm=0;for(let k=0;k<4;k++){
      const name=skeleton.bones[si.getComponent(i,k)].name,w=sw.getComponent(i,k);
      if(/^(Head|head_end|headfront|neck|LeftHand|RightHand|LeftFoot|RightFoot|LeftToeBase|RightToeBase)$/.test(name))protect+=w;
      if(/^(Left|Right)(Arm|ForeArm)$/.test(name))arm+=w;
    }
    const y=source.attributes.position.getY(i),wrist=g.attributes.aCourierGarment.getY(i);
    cloth.push(protect<.001&&y>.245&&y<1.265&&!(arm>.1&&wrist<.119));
  }
  for(const group of groups.values()){group.normal.normalize();group.cloth=group.ids.every(i=>cloth[i]);}
  for(let t=0;t<idx.count;t+=3){const a=ids[idx.getX(t)],b=ids[idx.getX(t+1)],c=ids[idx.getX(t+2)];a.neighbours.add(b);a.neighbours.add(c);b.neighbours.add(a);b.neighbours.add(c);c.neighbours.add(a);c.neighbours.add(b);}
  for(let pass=0;pass<2;pass++){
    const next=new Map();
    for(const group of groups.values()){
      if(!group.cloth)continue;
      const sum=group.normal.clone().multiplyScalar(2);let total=2;
      for(const neighbour of group.neighbours){
        const dot=group.normal.dot(neighbour.normal);if(!neighbour.cloth||dot<.5)continue;
        const weight=(dot-.5)*2;sum.addScaledVector(neighbour.normal,weight);total+=weight;
      }
      next.set(group,group.normal.clone().lerp(sum.multiplyScalar(1/total).normalize(),.68).normalize());
    }
    for(const [group,normal]of next)group.normal.copy(normal);
  }
  let count=0;
  for(const group of groups.values())if(group.cloth)for(const i of group.ids){n.setXYZ(i,group.normal.x,group.normal.y,group.normal.z);count++;}
  for(let pass=0;pass<4;pass++)for(let t=0;t<idx.count;t+=3){
    const vertices=[idx.getX(t),idx.getX(t+1),idx.getX(t+2)],q=vertices.map(i=>new T.Vector3(p.getX(i),p.getY(i),p.getZ(i)));
    const face=q[1].sub(q[0]).cross(q[2].sub(q[0])).normalize();
    const old=vertices.reduce((sum,i)=>sum.add(new T.Vector3().fromArray(original,i*3)),new T.Vector3()).normalize();
    const next=vertices.reduce((sum,i)=>sum.add(new T.Vector3(n.getX(i),n.getY(i),n.getZ(i))),new T.Vector3()).normalize();
    if(face.dot(old)>.1&&face.dot(next)<.08)for(const i of vertices)for(const vertex of ids[i].ids)n.setXYZ(vertex,original[vertex*3],original[vertex*3+1],original[vertex*3+2]);
  }
  g.userData.courierFormsV114.softClothNormals=count;
}
module.exports={sculptCourierFormsV114};
