'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {loadCourierSurface}=require('./load_berlin_courier_surface.cjs');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v145');
fs.mkdirSync(stage,{recursive:true});
const s=loadCourierSurface(),{T,accepted:g,geometry:raw,skeleton}=s;
const p=g.attributes.position,n=g.attributes.normal,si=raw.attributes.skinIndex,sw=raw.attributes.skinWeight,idx=g.index,names=skeleton.bones.map(b=>b.name);
const groups=new Map(),nodes=[],vertexNode=[];
for(let i=0;i<p.count;i++){
  const q=new T.Vector3().fromBufferAttribute(p,i),key=q.toArray().map(v=>v.toFixed(6)).join(',');
  if(!groups.has(key)){groups.set(key,nodes.length);nodes.push({q,ids:[],neighbours:new Set(),normals:[],weights:{LeftHand:0,RightHand:0,LeftShoe:0,RightShoe:0,LeftCalf:0,RightCalf:0}});}
  const node=nodes[groups.get(key)];node.ids.push(i);node.normals.push(new T.Vector3().fromBufferAttribute(n,i));vertexNode[i]=groups.get(key);
  for(let k=0;k<4;k++){const name=names[si.getComponent(i,k)],w=sw.getComponent(i,k);for(const side of ['Left','Right']){
    if(name===side+'Hand')node.weights[side+'Hand']=Math.max(node.weights[side+'Hand'],w);
    if(new RegExp('^'+side+'(Foot|ToeBase)$').test(name))node.weights[side+'Shoe']+=w;
    if(name===side+'Leg')node.weights[side+'Calf']=Math.max(node.weights[side+'Calf'],w);
  }}
}
const edges=new Map();
for(let i=0;i<idx.count;i+=3){const vs=[0,1,2].map(k=>vertexNode[idx.getX(i+k)]);for(let k=0;k<3;k++){
  const a=vs[k],b=vs[(k+1)%3];if(a===b)continue;nodes[a].neighbours.add(b);nodes[b].neighbours.add(a);const key=a<b?a+','+b:b+','+a;edges.set(key,(edges.get(key)||0)+1);
}}
for(const node of nodes){node.weights.LeftShoe/=node.ids.length;node.weights.RightShoe/=node.ids.length;}
const quantiles=xs=>{xs.sort((a,b)=>a-b);return{n:xs.length,min:xs[0],p50:xs[Math.floor(xs.length*.5)],p90:xs[Math.floor(xs.length*.9)],p99:xs[Math.floor(xs.length*.99)],max:xs.at(-1)};};
const regions={};
for(const name of ['LeftHand','RightHand','LeftShoe','RightShoe','LeftCalf','RightCalf']){
  const selected=nodes.map((v,i)=>v.weights[name]>.65?i:-1).filter(i=>i>=0),set=new Set(selected),box=new T.Box3(),normalDifferences=[],laplacian=[],edgeLengths=[];
  for(const id of selected){const node=nodes[id];box.expandByPoint(node.q);let avg=new T.Vector3();for(const b of node.neighbours){avg.add(nodes[b].q);if(set.has(b))edgeLengths.push(node.q.distanceTo(nodes[b].q));}avg.divideScalar(Math.max(1,node.neighbours.size));laplacian.push(avg.distanceTo(node.q));
    for(let i=1;i<node.normals.length;i++)normalDifferences.push(Math.acos(Math.min(1,Math.max(-1,node.normals[0].dot(node.normals[i]))))*180/Math.PI);
  }
  regions[name]={nodes:selected.length,vertices:selected.reduce((a,i)=>a+nodes[i].ids.length,0),bounds:{min:box.min.toArray(),max:box.max.toArray()},edgeLength:quantiles(edgeLengths),laplacian:quantiles(laplacian),duplicateNormalAngle:quantiles(normalDifferences)};
}
const report={pageSha256:crypto.createHash('sha256').update(s.html).digest('hex'),vertices:p.count,triangles:idx.count/3,weldedNodes:nodes.length,boundaryEdges:[...edges].filter(([k,n])=>n===1).length,nonManifoldEdges:[...edges].filter(([k,n])=>n>2).length,
  joints:skeleton.bones.map((b,i)=>({name:b.name,position:s.joints[i].toArray()})).filter(b=>/Hand|Foot|Toe|Leg|ForeArm/.test(b.name)),regions};
fs.writeFileSync(path.join(stage,'surface-inspection.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
