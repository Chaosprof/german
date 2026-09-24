'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),file=path.resolve(root,process.env.BERLIN_HTML||'berlin-runner.html');
const html=fs.readFileSync(file,'utf8');
const full=JSON.parse(fs.readFileSync(path.join(root,process.env.BERLIN_ARCHITECTURE_DIR||'assets/models','berlin-reference-architecture-v1.json'),'utf8'));
const runtime=JSON.parse(html.match(/var BERLIN_REFERENCE_ARCHITECTURE = (\{[^\r\n]*\});/)[1]);
assert.deepEqual(Object.keys(runtime.meshes).sort(),['13.5:0:1','13.5:1:1']);
for(const [key,record] of Object.entries(runtime.meshes))assert.deepEqual(record,full.meshes[key]);
const ctx=vm.createContext({console,atob:s=>Buffer.from(s,'base64').toString('binary')});
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
vm.runInContext(scripts.find(s=>s.includes('three.js r156 (MIT)')),ctx);
for(const name of ['berlin_packed_geometry.js','berlin_kiez_kit.js'])vm.runInContext(fs.readFileSync(name==='berlin_kiez_kit.js'&&process.env.BERLIN_KIEZ_KIT?path.resolve(root,process.env.BERLIN_KIEZ_KIT):path.join(__dirname,name),'utf8'),ctx);
const T=ctx.THREE,noop=()=>{},canvasContext=new Proxy({createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>o[k]||noop,set:(o,k,v)=>(o[k]=v,true)});
function geometry(data){
  ctx.BERLIN_REFERENCE_ARCHITECTURE=data;
  const kit=ctx.createBerlinKiezKit(T,(color,options)=>new T.MeshStandardMaterial({color,...options}),(width,height)=>({width,height,getContext:()=>canvasContext}));
  const result={};
  for(const w of [11,13.5,16])for(const v of [0,1])for(const side of [-1,1]){
    const g=kit.geometry(w,v,side);result[[w,v,side].join(':')]={
      attributes:Object.fromEntries([...Object.entries(g.attributes),['index',g.index]].map(([k,a])=>[k,Buffer.from(a.array.buffer,a.array.byteOffset,a.array.byteLength)])),
      groups:g.groups,metadata:g.userData,min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()
    };
  }
  return result;
}
assert.deepEqual(geometry(runtime),geometry(full),'all twelve actual runtime layouts have exact buffers, groups, bounds and metadata');
const originalBytes=fs.statSync(path.join(root,'audit/berlin-parity-v127/baseline.html')).size;
assert.ok(Buffer.byteLength(html)<originalBytes,'complete HTML stays smaller than the pre-goal V126 page');
const result={passed:true,layouts:12,fullAuthoringBytes:Buffer.byteLength(JSON.stringify(full)),runtimeBytes:Buffer.byteLength(JSON.stringify(runtime)),htmlBytes:Buffer.byteLength(html),originalHtmlBytes:originalBytes};
const revision=html.match(/'kiez-reference-v(\d+)'/)[1];
const auditDir=path.resolve(root,process.env.BERLIN_AUDIT_DIR||('audit/berlin-parity-v'+revision));
fs.writeFileSync(path.join(auditDir,'runtime-pack-check.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
