'use strict';
const fs=require('fs'),vm=require('vm'),path=require('path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('three.js r156 (MIT)'))[1];
const context=vm.createContext({console});vm.runInContext(script,context);
const THREE=context.THREE,noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
const kit=require('./berlin_kiez_kit.js')(THREE,(color,opts)=>new THREE.MeshStandardMaterial({color,...opts}),(width,height)=>({width,height,getContext:()=>ctx}));
const modules=[];
for(const width of [11,13.5,16])for(const variant of [0,1])for(const side of [-1,1]) {
 const g=kit.geometry(width,variant,side),attrs={};
 for(const name of ['position','normal','uv','color'])attrs[name]=Array.from(g.attributes[name].array);
 for(const value of attrs.uv)if(!(value>0&&value<1))throw new Error(`Unpadded source UV ${width}:${variant}:${side}: ${value}`);
 for(let i=0;i<attrs.normal.length;i+=3)if(Math.abs(Math.hypot(...attrs.normal.slice(i,i+3))-1)>.002)throw new Error(`Invalid source normal ${width}:${variant}:${side}: ${i}`);
 modules.push({name:`${width}:${variant}:${side}`,width,variant,side,fabricRanges:g.userData.fabricRanges||[],...attrs});
}
fs.writeFileSync(path.join(root,'.tmp/kiez-architecture-source.json'),JSON.stringify({modules}));
console.log('Exported twelve bakery/bookstore modules for Blender.');
