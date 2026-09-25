'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v142'),name='berlin-reference-architecture-v1';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const oldKit=fs.readFileSync(path.join(stage,'baseline/berlin_kiez_kit.js'),'utf8');let kit=oldKit;
const edits=[
  ['[5,4,6,8,7,15][variant],variant===0?0x947451:0x30534d,0,.88);','[5,4,6,8,7,15][variant],variant===0?0x947451:0x30534d,0,.08);'],
  ['box(shopX,.77,-.22,','box(shopX,.77,.18,'],['box(shopX,1.015,-.20,','box(shopX,1.015,.20,'],
  ['box(shopX,shelfY,-.45,','box(shopX,shelfY,.15,'],
  ['shopW/13,1.10,-.15,','shopW/13,1.10,.25,'],
  ['var x=(bay+offset)*bookScale,y=1.055,z=.13,','var x=(bay+offset)*bookScale,y=1.345,z=.39,']
];
for(const [from,to] of edits){assert.equal(kit.split(from).length,2,from);kit=kit.replace(from,to);}
fs.writeFileSync(path.join(stage,'edits.json'),JSON.stringify(edits,null,2));fs.writeFileSync(path.join(stage,'sources/berlin_kiez_kit.js'),kit);
const begin=kit.indexOf('function finishBerlinKiezFacade('),end=kit.indexOf('// Extend the single atlas material.',begin);
assert.ok(begin>=0&&end>begin);fs.writeFileSync(path.join(stage,'sources/berlin_facade_finish_v119.js'),kit.slice(begin,end)+"if (typeof module !== 'undefined') module.exports = {finishBerlinKiezFacade:finishBerlinKiezFacade};\n");
const data=JSON.parse(fs.readFileSync(path.join(stage,'models',name+'.json'),'utf8'));
const packed=require('./install_reference_architecture.cjs').packReferenceArchitecture(data),inline='var BERLIN_REFERENCE_ARCHITECTURE = '+JSON.stringify(packed)+';\n';
fs.writeFileSync(path.join(stage,'models/berlin-reference-architecture-runtime.inline.js'),inline);
const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();
let h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');assert.ok(h.includes(trim(oldKit)));h=h.replace(trim(oldKit),()=>trim(kit));
const arch=/var BERLIN_REFERENCE_ARCHITECTURE = (\{[^\r\n]*\});/;assert.ok(arch.test(h));h=h.replace(arch,()=>inline.trim());
assert.equal(h.split("'kiez-reference-v141'").length,2);h=h.replace("'kiez-reference-v141'","'kiez-reference-v142'");
fs.writeFileSync(path.join(stage,'candidate.html'),h);console.log('Staged V142 visible recessed shop displays and counter-top books.');
if(process.argv.includes('--install')){
  const a=JSON.parse(fs.readFileSync(path.join(stage,'performance-accepted.json'),'utf8'));assert.equal(a.accepted,true);assert.equal(a.candidateSha256,sha(h));
  // Resume a partially completed install only when every current file is
  // exactly its captured baseline or the accepted candidate, never user edits.
  const beforeOrAfter=(actual,before,after,label)=>assert.ok(Buffer.from(actual).equals(Buffer.from(before))||Buffer.from(actual).equals(Buffer.from(after)),label);
  beforeOrAfter(fs.readFileSync(path.join(root,'berlin-runner.html')),fs.readFileSync(path.join(stage,'baseline.html')),h,'shipping page changed');
  for(const suffix of ['.json','.inline.js','.blend','.glb','-atlas.png'])beforeOrAfter(fs.readFileSync(path.join(root,'assets/models',name+suffix)),fs.readFileSync(path.join(stage,'baseline',name+suffix)),fs.readFileSync(path.join(stage,'models',name+suffix)),'asset changed '+suffix);
  const oldPacked=require('./install_reference_architecture.cjs').packReferenceArchitecture(JSON.parse(fs.readFileSync(path.join(stage,'baseline',name+'.json'),'utf8')));
  beforeOrAfter(fs.readFileSync(path.join(root,'assets/models/berlin-reference-architecture-runtime.inline.js')),'var BERLIN_REFERENCE_ARCHITECTURE = '+JSON.stringify(oldPacked)+';\n',inline,'runtime asset changed');
  for(const file of Object.keys(a.sources))beforeOrAfter(fs.readFileSync(path.join(root,'tools',file)),fs.readFileSync(path.join(stage,'baseline',file)),fs.readFileSync(path.join(stage,'sources',file)),'source changed '+file);
  for(const [folder,hashes]of [['models',a.assets],['sources',a.sources]])for(const [file,hash]of Object.entries(hashes))assert.equal(sha(fs.readFileSync(path.join(stage,folder,file))),hash,file);
  const cache=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert.match(cache,/artikel-blitz-v(?:141|142)/);
  for(const file of Object.keys(a.assets))fs.copyFileSync(path.join(stage,'models',file),path.join(root,'assets/models',file));
  for(const file of Object.keys(a.sources))fs.copyFileSync(path.join(stage,'sources',file),path.join(root,'tools',file));
  // Write complete temporary files, then replace on the same volume. An open
  // failure cannot truncate the previously installed page.
  for(const [file,text]of [['berlin-runner.html',h],['sw.js',cache.replace(/artikel-blitz-v141/g,'artikel-blitz-v142')]]){
    if(fs.readFileSync(path.join(root,file),'utf8')===text)continue;
    const pending=path.join(stage,'install-'+file);fs.writeFileSync(pending,text);fs.renameSync(pending,path.join(root,file));
  }
  fs.writeFileSync(path.join(stage,'shipping.json'),JSON.stringify({pageSha256:sha(h),pageBytes:Buffer.byteLength(h),cacheRevision:'artikel-blitz-v142',assets:a.assets,sources:a.sources},null,2));
  console.log('Installed measured V142 page, native assets and factory sources.');
}
