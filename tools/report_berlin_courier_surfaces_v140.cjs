'use strict';
const fs=require('fs'),path=require('path');
const stage=path.resolve(__dirname,'../audit/berlin-parity-v140'),h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
const samples=JSON.parse(fs.readFileSync(path.join(stage,'surface-pixels.json'),'utf8'));
let rgba;const document={createElement:()=>({getContext:()=>({drawImage:()=>{},getImageData:()=>({data:rgba}),putImageData:()=>{}})})};
const a=h.indexOf('  var HERO_GARMENT_SAT ='),b=h.indexOf('  function buildHeroCostume',a);
const recolor=new Function('document',h.slice(a,b)+'\nreturn recolourHeroGarment;')(document);
const linear=v=>(v/=255)<=.04045?v/12.92:((v+.055)/1.055)**2.4;
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
for(const p of samples){
  p.source=[0,0,0];
  for(const pixel of p.pixels){rgba=new Uint8ClampedArray([...pixel.rgb,255]);recolor({image:{width:1,height:1}});for(let k=0;k<3;k++)p.source[k]+=linear(rgba[k])*pixel.weight;}
  const [r,g,b]=p.source,y=p.garment[0];
  p.cloth=smooth(.02,.10,r-2.4*Math.max(g,b))*smooth(-.24,-.19,y)*(1-smooth(.36,.45,y));
  p.denim=(1-Math.max(smooth(.12,.78,p.sleeve),p.garment[3]))*(1-p.cloth)*(1-smooth(-.135,-.115,y));
}
fs.writeFileSync(path.join(stage,'surface-report.json'),JSON.stringify(samples,null,2));
const rows=[];for(const y of [...new Set(samples.map(p=>p.y))]){
  const row=samples.filter(p=>p.y===y),span=fn=>[Math.min(...row.map(fn)),Math.max(...row.map(fn))].map(v=>+v.toFixed(3));
  rows.push({y,samples:row.length,shoe:span(p=>p.garment[3]),footWeight:span(p=>p.footWeight),cloth:span(p=>p.cloth),denim:span(p=>p.denim)});
}
console.log(JSON.stringify(rows,null,2));
