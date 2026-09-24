'use strict';
// Build only a candidate. Native ground-storey art is preserved by the
// Blender splice; the replacement upper storeys use the current kit source.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v128');
fs.mkdirSync(path.join(stage,'baseline'),{recursive:true});
fs.mkdirSync(path.join(stage,'models'),{recursive:true});
for(const suffix of ['.json','.inline.js','.blend','.glb','-atlas.png']){
  const name='berlin-reference-architecture-v1'+suffix,target=path.join(stage,'baseline',name);
  if(!fs.existsSync(target))fs.copyFileSync(path.join(root,'assets/models',name),target);
}
const baseline=path.join(stage,'baseline.html');
if(!fs.existsSync(baseline))fs.copyFileSync(path.join(root,'berlin-runner.html'),baseline);
const kitPath=path.join(stage,'baseline/berlin_kiez_kit.js');
if(!fs.existsSync(kitPath))fs.copyFileSync(path.join(__dirname,'berlin_kiez_kit.js'),kitPath);
let kit=fs.readFileSync(kitPath,'utf8');
function replace(a,b){assert.equal(kit.split(a).length,2,a);kit=kit.replace(a,b);}
replace('piercedUpperWall(w,0,0,frontCenters,0,variant===1);','piercedUpperWall(w,0,0,frontCenters,0,false);');
replace('if(allArches||floor===floors-1) {','if(allArches||(variant!==1&&floor===floors-1)) {');
replace('variant===1||floor===floors-1,2,upperTrim','variant!==1&&floor===floors-1,2,upperTrim');
replace('out=finishBerlinKiezFacade(THREE,out,variant,w,side);','// Final small planting is added once by the runtime finisher.');
replace('if((col+floor+variant)%3===0) flowers(xx,yy-1.13,.43,1.54);','if(variant!==1&&(col+floor+variant)%3===0) flowers(xx,yy-1.13,.43,1.54);');
// Keep the return walls arched at their roof storey; only the street-facing
// wall changes. The corresponding source wall therefore stays consistent.
replace('if(allArches||(variant!==1&&floor===floors-1)) {','if(allArches||((variant!==1||angle!==0)&&floor===floors-1)) {');
const html=fs.readFileSync(baseline,'utf8');
const three=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('three.js r156 (MIT)'))[1];
const scope=vm.createContext({console});vm.runInContext(three,scope);vm.runInContext(kit,scope);
const T=scope.THREE,noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
const factory=scope.createBerlinKiezKit(T,(color,opts)=>new T.MeshStandardMaterial({color,...opts}),(width,height)=>({width,height,getContext:()=>ctx}));
let geo=factory.geometry(13.5,1,1);if(geo.index)geo=geo.toNonIndexed();
const item={name:'Rectangular bookstore upper storeys v128',variant:1,position:[],normal:[],uv:[],color:[]};
for(let f=0;f<geo.attributes.position.count;f+=3){
  if(Math.max(...[0,1,2].map(j=>geo.attributes.position.getY(f+j)))<=4.70001)continue;
  const attributes=[['position',3],['normal',3],['uv',2],['color',3]];
  const triangle=[0,1,2].map(j=>Object.fromEntries(attributes.map(([name,size])=>[name,Array.from({length:size},(_,k)=>geo.attributes[name].getComponent(f+j,k))])));
  const clipped=[];
  for(let j=0;j<3;j++){
    const a=triangle[j],b=triangle[(j+1)%3],insideA=a.position[1]>=4.7,insideB=b.position[1]>=4.7;
    if(insideA)clipped.push(a);
    if(insideA!==insideB){
      const t=(4.7-a.position[1])/(b.position[1]-a.position[1]);
      clipped.push(Object.fromEntries(attributes.map(([name])=>[name,a[name].map((v,k)=>v+(b[name][k]-v)*t)])));
    }
  }
  for(let j=1;j<clipped.length-1;j++)for(const point of [clipped[0],clipped[j],clipped[j+1]])
    for(const [name] of attributes)item[name].push(...point[name]);
}
fs.writeFileSync(path.join(stage,'bookstore-upper-source.json'),JSON.stringify(item));
console.log('Staged upper-storey source',item.position.length/9,'triangles; no production assets changed.');
