'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v138');
for(const d of ['baseline','sources','frames'])fs.mkdirSync(path.join(stage,d),{recursive:true});
for(const [from,to] of [['berlin-runner.html','baseline.html'],['tools/berlin_kiez_kit.js','baseline/berlin_kiez_kit.js'],['tools/berlin_facade_finish_v119.js','baseline/berlin_facade_finish_v119.js']])
  if(!fs.existsSync(path.join(stage,to)))fs.copyFileSync(path.join(root,from),path.join(stage,to));
const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();
const oldKit=fs.readFileSync(path.join(stage,'baseline/berlin_kiez_kit.js'),'utf8');
let kit=oldKit;
const edits=[
  [`  // Two layers of foliage, twelve rounded bloom heads and four pairs of
  // trailing ivy leaves: 288 triangles per box, including container and rail.
  var bloom=new THREE.SphereGeometry(1,5,2);`,
`  // Five loose clusters of three small florets, with smooth radial normals.
  // The shared six-vertex heads use eight triangles each: fifteen heads keep
  // the old 120-triangle flower budget and reduce duplicate vertex payloads.
  var bloom=new THREE.BufferGeometry();
  var bp=[1,0,0,-1,0,0,0,1,0,0,-1,0,0,0,1,0,0,-1];
  bloom.setAttribute('position',new THREE.Float32BufferAttribute(bp,3));
  bloom.setAttribute('normal',new THREE.Float32BufferAttribute(bp,3));
  bloom.setIndex([0,2,4,2,1,4,1,3,4,3,0,4,2,0,5,1,2,5,3,1,5,0,3,5]);
  bloom.rotateZ(.43);bloom.rotateY(.31);`],
  [`    for(var j=0;j<12;j++){
      var t=(j+.5)/12,r=.085+.012*((j*7+si)%4);
      add(bloom,x+(t-.5)*w*.95,y+.16+Math.abs(Math.sin(j*1.9+si))*.18,z+.12+Math.cos(j*1.7)*.09,r*1.25,r*.90,r,geranium[(j*3+si)%geranium.length]);
    }`,
`    for(var j=0;j<15;j++){
      var cluster=Math.floor(j/3),floret=j%3,t=(cluster+.5)/5;
      var a=floret*Math.PI*2/3+cluster*.83+si*.37,r=.069+.011*((j*7+si)%3);
      var cx=x+(t-.5)*w*.94+Math.sin(cluster*2.3+si)*.025;
      var cy=y+.235+Math.sin(cluster*1.9+si)*.045;
      add(bloom,cx+Math.cos(a)*.071,cy+Math.sin(a)*.066,z+.13+Math.cos(j*1.7)*.045,
        r*1.08,r,r*.78,geranium[(cluster*3+si+(floret===2?1:0))%geranium.length],Math.sin(j+si)*.42,a*.27);
    }`],
  ['flowerBoxes:slots.length,displayBookFaces:', 'flowerBoxes:slots.length,flowerClusterRevision:138,flowerHeads:slots.length*15,displayBookFaces:']
];
for(const [a,b] of edits){assert.equal(kit.split(a).length,2,a.slice(0,80));kit=kit.replace(a,()=>b);}
fs.writeFileSync(path.join(stage,'edits.json'),JSON.stringify(edits,null,2));
fs.writeFileSync(path.join(stage,'sources/berlin_kiez_kit.js'),kit);
const begin=kit.indexOf('function finishBerlinKiezFacade('),end=kit.indexOf('// Extend the single atlas material.',begin);
assert.ok(begin>=0&&end>begin);
fs.writeFileSync(path.join(stage,'sources/berlin_facade_finish_v119.js'),kit.slice(begin,end)+"if (typeof module !== 'undefined') module.exports = {finishBerlinKiezFacade:finishBerlinKiezFacade};\n");
const full=JSON.parse(fs.readFileSync(path.join(stage,'models/berlin-reference-architecture-v1.json'),'utf8'));
const pack=require('./install_reference_architecture.cjs').packReferenceArchitecture(full);
const inline='var BERLIN_REFERENCE_ARCHITECTURE = '+JSON.stringify(pack)+';\n';
fs.writeFileSync(path.join(stage,'models/berlin-reference-architecture-runtime.inline.js'),inline);
let h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
assert.ok(h.includes(trim(oldKit)));h=h.replace(trim(oldKit),()=>trim(kit));
const arch=/var BERLIN_REFERENCE_ARCHITECTURE = (\{[^\r\n]*\});/;
assert.ok(arch.test(h));h=h.replace(arch,()=>inline.trim());
assert.equal(h.split("'kiez-reference-v137'").length,2);
h=h.replace("'kiez-reference-v137'","'kiez-reference-v138'");
fs.writeFileSync(path.join(stage,'candidate.html'),h);
console.log('Staged V138 clustered florets in the native bakery and runtime flower boxes.');
if(process.argv.includes('--install')){
  const crypto=require('crypto'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  const current=fs.readFileSync(path.join(root,'berlin-runner.html'),'utf8');
  assert.ok(current===fs.readFileSync(path.join(stage,'baseline.html'),'utf8')||current===h,'shipping page changed since staging');
  const cache=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert.match(cache,/artikel-blitz-v(?:137|138)/);
  const accepted=JSON.parse(fs.readFileSync(path.join(stage,'performance-accepted.json'),'utf8'));
  assert.equal(accepted.accepted,true);assert.equal(accepted.candidateSha256,sha(h));
  for(const [file,hash] of Object.entries(accepted.assets))assert.equal(sha(fs.readFileSync(path.join(stage,'models',file))),hash,file);
  for(const [file,hash] of Object.entries(accepted.sources))assert.equal(sha(fs.readFileSync(path.join(stage,'sources',file))),hash,file);
  for(const file of Object.keys(accepted.assets))fs.copyFileSync(path.join(stage,'models',file),path.join(root,'assets/models',file));
  for(const file of Object.keys(accepted.sources))fs.copyFileSync(path.join(stage,'sources',file),path.join(root,'tools',file));
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);
  fs.writeFileSync(path.join(root,'sw.js'),cache.replace(/artikel-blitz-v(?:137|138)/g,'artikel-blitz-v138'));
  console.log('Installed measured V138 native assets, facade sources, page and cache revision.');
}
