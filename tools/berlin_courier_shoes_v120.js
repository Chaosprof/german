'use strict';
// Sculpt the accepted sneaker in bind space. Keep topology, skinning and all
// painted masks; transform smooth normals with the deformation's Jacobian.
function sculptCourierShoesV120(T, target, original, skeleton, joints) {
  const p=target.attributes.position,n=target.attributes.normal;
  const names=skeleton.bones.map(b=>b.name),ids=[[],[]],bounds=[new T.Box3(),new T.Box3()];
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  for(let i=0;i<p.count;i++)for(let side=0;side<2;side++){
    let weight=0;
    for(let k=0;k<4;k++)if(new RegExp('^'+['Left','Right'][side]+'(Foot|ToeBase)$').test(names[original.attributes.skinIndex.getComponent(i,k)]))weight+=original.attributes.skinWeight.getComponent(i,k);
    if(weight>.45){ids[side].push(i);bounds[side].expandByPoint(new T.Vector3().fromBufferAttribute(p,i));}
  }
  for(let side=0;side<2;side++){
    const bb=bounds[side],foot=joints[names.indexOf(['Left','Right'][side]+'Foot')];
    function deform(v){
      const t=(v.z-bb.min.z)/(bb.max.z-bb.min.z),height=v.y-bb.min.y;
      const lower=1-smooth(.11,.17,height);
      const heel=Math.exp(-Math.pow((t-.06)/.20,2));
      const toe=Math.exp(-Math.pow((t-.96)/.19,2));
      const collar=Math.exp(-Math.pow((height-.133)/.018,2))*(1-smooth(.45,.68,t));
      const x=foot.x+(v.x-foot.x)*(1-lower*(.08+heel*.22+toe*.16)+collar*.045);
      // Lift the waist of the outsole between its two contact pads. The
      // heel/toe contact heights and the ankle join remain unchanged.
      const arch=Math.exp(-Math.pow((t-.40)/.17,2))*(1-smooth(.018,.055,height));
      const inner=side===0?1-smooth(-.035,.045,v.x-foot.x):smooth(-.045,.035,v.x-foot.x);
      return new T.Vector3(x,v.y+.0075*arch*(.32+.68*inner),v.z);
    }
    for(const i of ids[side]){
      const v=new T.Vector3().fromBufferAttribute(p,i),out=deform(v),eps=.00005,columns=[];
      for(const axis of ['x','y','z']){const a=v.clone(),b=v.clone();a[axis]+=eps;b[axis]-=eps;columns.push(deform(a).sub(deform(b)).multiplyScalar(.5/eps));}
      const jac=new T.Matrix3().set(columns[0].x,columns[1].x,columns[2].x,columns[0].y,columns[1].y,columns[2].y,columns[0].z,columns[1].z,columns[2].z);
      const normal=new T.Vector3().fromBufferAttribute(n,i).applyMatrix3(jac.invert().transpose()).normalize();
      p.setXYZ(i,out.x,out.y,out.z);n.setXYZ(i,normal.x,normal.y,normal.z);
    }
  }
  target.userData.courierShoesV120={roundedHeel:true,roundedToe:true,archedSole:true,paddedCollar:true,vertices:ids.map(a=>a.length)};
}
module.exports={sculptCourierShoesV120};
