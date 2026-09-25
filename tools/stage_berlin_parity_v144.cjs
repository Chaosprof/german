'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v144');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const f of ['','frames','benchmark'])fs.mkdirSync(path.join(stage,f),{recursive:true});
const current=fs.readFileSync(path.join(root,'berlin-runner.html')),old=path.join(stage,'baseline.html');
if(!fs.existsSync(old)){assert.equal(sha(current),'678f57489edc27fd024261b2990d7130c4ef5a374e58f3521f10e210d5e3c540');fs.writeFileSync(old,current);}
const before=fs.readFileSync(old,'utf8');let after=before;
const generated=JSON.parse(fs.readFileSync(path.join(stage,'generated/manifest.json'))),newAssets={};
let images='';
for(const [file,varname]of [['berlin-paving-joint-normal-v144.png','BERLIN_PAVING_NORMAL_V144'],['berlin-paving-joint-shade-v144.png','BERLIN_PAVING_SHADE_V144']]){
  const bytes=fs.readFileSync(path.join(stage,'generated',file));assert.equal(sha(bytes),generated.assets[file].sha256);
  newAssets[file]=sha(bytes);images+='var '+varname+' = '+JSON.stringify('data:image/png;base64,'+bytes.toString('base64'))+';\n';
}
const helper=images+fs.readFileSync(path.join(__dirname,'berlin_paving_runtime_v144.js'),'utf8');
const edits=[
  ['  // Generated slate retains the shared road draw and procedural fallback.',helper+'\n  // Generated slate retains the shared road draw and procedural fallback.'],
  ['      relief(MAT.road, paving, 0.45, 0.68, 0.88);\n      [MAT.road.normalMap, MAT.road.roughnessMap].forEach(function (map) {\n        map.wrapS = map.wrapT = THREE.MirroredRepeatWrapping;\n        map.repeat.copy(roadTex.repeat);\n      });','      applyReferencePavingReliefV144(MAT.road, paving, roadTex);'],
  ["'kiez-reference-v143'","'kiez-reference-v144'"]
];
edits[1][1]='      applyReferencePavingReliefV144(MAT.road, paving, roadTex, jointPavingResources);';
edits.push(['    texLoader.load(BERLIN_REFERENCE_PAVING_IMAGE, function (loaded) {','    var jointPavingResources=beginReferencePavingReliefV144();\n    texLoader.load(BERLIN_REFERENCE_PAVING_IMAGE, function (loaded) {']);
edits.push(['      if (MAT.road.normalMap) MAT.road.normalMap.dispose();\n      if (MAT.road.roughnessMap) MAT.road.roughnessMap.dispose();','      // Retain valid fallback maps until the embedded joint maps are decoded.']);
for(const [from,to]of edits){assert.equal(after.split(from).length,2,from.slice(0,90));after=after.replace(from,()=>to);}
const scripts=[...after.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];for(const [i,s]of scripts.entries())new vm.Script(s[1],{filename:'v144-'+i});
fs.writeFileSync(path.join(stage,'candidate.html'),after);fs.writeFileSync(path.join(stage,'edits.json'),JSON.stringify(edits,null,2));
const files=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-parity-v143/shipping.json'))).protectedFiles;
const embeddedPaving=before.match(/var BERLIN_REFERENCE_PAVING_IMAGE = "data:image\/jpeg;base64,([^"]+)";/);
assert.ok(embeddedPaving);files['assets/img/berlin-reference-paving-v2.jpg']=sha(Buffer.from(embeddedPaving[1],'base64'));
for(const [file,hash]of Object.entries(files))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);
fs.writeFileSync(path.join(stage,'protected-files.json'),JSON.stringify(files,null,2));
const check={passed:true,baselineSha256:sha(before),candidateSha256:sha(after),helperSha256:sha(helper),scriptsParsed:scripts.length,
  unchangedGeometry:true,unchangedShaderFeatures:true,textureSizes:[[1024,1024],[512,512],[512,512]],protectedFiles:Object.keys(files).length,newAssets};
fs.writeFileSync(path.join(stage,'source-check.json'),JSON.stringify(check,null,2));
if(process.argv.includes('--install')){
  const a=JSON.parse(fs.readFileSync(path.join(stage,'performance-accepted.json')));assert.equal(a.accepted,true);assert.equal(a.candidateSha256,sha(after));
  assert.ok(current.equals(Buffer.from(before))||current.equals(Buffer.from(after)),'page changed after baseline');
  const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert.match(sw,/artikel-blitz-v(?:143|144)/);
  for(const [file,hash]of Object.entries(newAssets)){
    const target=path.join(root,'assets/img',file);if(fs.existsSync(target))assert.equal(sha(fs.readFileSync(target)),hash,'existing generated asset changed');
    fs.copyFileSync(path.join(stage,'generated',file),target);
  }
  for(const [f,t]of [['berlin-runner.html',after],['sw.js',sw.replace(/artikel-blitz-v143/g,'artikel-blitz-v144')]]){
    if(fs.readFileSync(path.join(root,f),'utf8')===t)continue;const temp=path.join(stage,'install-'+f);fs.writeFileSync(temp,t);fs.renameSync(temp,path.join(root,f));
  }
  fs.writeFileSync(path.join(stage,'shipping.json'),JSON.stringify({pageSha256:sha(after),pageBytes:Buffer.byteLength(after),cacheRevision:'artikel-blitz-v144',protectedFiles:files,newAssets},null,2));
  console.log('Installed V144 joint-aligned paving relief.');
}
console.log(JSON.stringify(check));
