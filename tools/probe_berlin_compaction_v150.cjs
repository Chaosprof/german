'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'audit/berlin-parity-v150/candidate.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]),c=vm.createContext({console,atob});
vm.runInContext(scripts.find(s=>s.includes('three.js r156 (MIT)')),c);vm.runInContext(fs.readFileSync(path.join(root,'tools/berlin_packed_geometry.js'),'utf8'),c);
c.BERLIN_REFERENCE_ARCHITECTURE=JSON.parse(fs.readFileSync(path.join(root,'assets/models/berlin-reference-architecture-v1.json')));
vm.runInContext(fs.readFileSync(path.join(root,'audit/berlin-parity-v150/sources/berlin_kiez_kit.js'),'utf8'),c);vm.runInContext(fs.readFileSync(path.join(root,'tools/berlin_compact_vertices_v150.js'),'utf8'),c);
const noop=()=>{},ctx=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)}),T=c.THREE;
const kit=c.createBerlinKiezKit(T,(color,o)=>new T.MeshStandardMaterial({color,...o}),()=>({getContext:()=>ctx})),rows=[];
const bytes=g=>Object.values(g.attributes).reduce((n,a)=>n+a.array.byteLength,0)+g.index.array.byteLength;
for(let variant=0;variant<6;variant++){
 const g=kit.geometry(13.5,variant,1),before=bytes(g),t=performance.now();c.compactBerlinKiezVerticesV150(T,g);rows.push({variant,...g.userData.verticesCompactedV150,beforeBytes:before,afterBytes:bytes(g),ms:performance.now()-t});
}
console.log(JSON.stringify(rows,null,2));
