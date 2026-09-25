'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v143');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(stage,{recursive:true});fs.mkdirSync(path.join(stage,'frames'),{recursive:true});
const current=fs.readFileSync(path.join(root,'berlin-runner.html'));
const baselinePath=path.join(stage,'baseline.html');
if(!fs.existsSync(baselinePath)){
  assert.equal(sha(current),'8e830de20e582d4963a09f9fc569557eb60f68c04645e78c2f1fafdd3ff8298c');
  fs.writeFileSync(baselinePath,current);
}
const before=fs.readFileSync(baselinePath,'utf8');let after=before;
const edits=[
  ["[[0,'#77766f'],[.09,'#85837b'],[.14,'#4d5050'],[.31,'#4d5050'],\n     [.36,'#a5a59b'],[.43,'#c1c4b9'],[.50,'#dadace'],[.62,'#dadace'],\n     [.71,'#abaea4'],[.79,'#6b706c'],[.92,'#595e5c'],[1,'#686c67']]",
   "[[0,'#77736d'],[.09,'#81796f'],[.14,'#41474a'],[.31,'#41474a'],\n     [.36,'#80796e'],[.46,'#a6967f'],[.52,'#c0b29e'],[.60,'#c0b29e'],\n     [.68,'#948c80'],[.79,'#626762'],[.92,'#555b59'],[1,'#666962']]"],
  ['// Less metal and far less sky: the old 0.62 metal at 0.75 env mirrored\n    // blue sky, so the heads read cold grey. Diffuse heads take the warm key.',
   '// A narrow warm running band sits beside the recessed graphite groove.\n    // Restrained sky reflection keeps shaded steel from becoming cyan stripes.'],
  ['streetRail: mat(0xffffff, { map: streetRailTex, roughness: 0.30, metalness: 0.50, envMapIntensity: 0.90 })',
   'streetRail: mat(0xffffff, { map: streetRailTex, roughness: 0.36, metalness: 0.50, envMapIntensity: 0.60 })'],
  ["'kiez-reference-v142'","'kiez-reference-v143'"]
];
for(const [from,to]of edits){assert.equal(after.split(from).length,2,from);after=after.replace(from,to);}
fs.writeFileSync(path.join(stage,'candidate.html'),after);fs.writeFileSync(path.join(stage,'edits.json'),JSON.stringify(edits,null,2));
const previous=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-parity-v142/shipping.json')));
const garden=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-parity-v139/shipping.json')));
const files={...Object.fromEntries(Object.entries({...previous.assets,...garden.assets}).map(([f,h])=>['assets/models/'+f,h])),...Object.fromEntries(Object.entries(previous.sources).map(([f,h])=>['tools/'+f,h]))};
for(const [file,hash]of Object.entries(files))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);
fs.writeFileSync(path.join(stage,'protected-files.json'),JSON.stringify(files,null,2));
const check={passed:true,baselineSha256:sha(before),candidateSha256:sha(after),allowedEdits:edits.length,
  textureSize:[128,8],gradientStops:12,unchangedGeometry:true,unchangedShaderFeatures:true,preservedFiles:Object.keys(files).length};
fs.writeFileSync(path.join(stage,'source-check.json'),JSON.stringify(check,null,2));
if(process.argv.includes('--install')){
  const accepted=JSON.parse(fs.readFileSync(path.join(stage,'performance-accepted.json')));
  assert.equal(accepted.accepted,true);assert.equal(accepted.candidateSha256,sha(after));
  assert.ok(current.equals(Buffer.from(before))||current.equals(Buffer.from(after)),'page changed after capture');
  const cache=fs.readFileSync(path.join(root,'sw.js'),'utf8');assert.match(cache,/artikel-blitz-v(?:142|143)/);
  for(const [file,text]of [['berlin-runner.html',after],['sw.js',cache.replace(/artikel-blitz-v142/g,'artikel-blitz-v143')]]){
    if(fs.readFileSync(path.join(root,file),'utf8')===text)continue;
    const temp=path.join(stage,'install-'+file);fs.writeFileSync(temp,text);fs.renameSync(temp,path.join(root,file));
  }
  fs.writeFileSync(path.join(stage,'shipping.json'),JSON.stringify({pageSha256:sha(after),pageBytes:Buffer.byteLength(after),cacheRevision:'artikel-blitz-v143',protectedFiles:files},null,2));
  console.log('Installed accepted V143 rail material.');
}
console.log(JSON.stringify(check));
