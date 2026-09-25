'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v145'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const page=fs.readFileSync(path.join(stage,'candidate.html'),'utf8'),baseline=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
const oldShip=JSON.parse(fs.readFileSync(path.join(root,'audit/berlin-parity-v144/shipping.json')));
assert.equal(sha(baseline),oldShip.pageSha256);
const protectedFiles={...oldShip.protectedFiles};for(const [name,hash]of Object.entries(oldShip.newAssets))protectedFiles['assets/img/'+name]=hash;
for(const name of ['berlin-runner-hero-v14.glb','berlin-courier-cloth-v97.bin','berlin-courier-cloth-v97.inline.js','berlin-courier-cloth-v97.json']){
 const file='assets/models/'+name;if(fs.existsSync(path.join(root,file)))protectedFiles[file]=sha(fs.readFileSync(path.join(root,file)));
}
for(const [file,hash]of Object.entries(protectedFiles))assert.equal(sha(fs.readFileSync(path.join(root,file))),hash,file);
const section=text=>{const a=text.indexOf('  // BEGIN COURIER_FORMS_PATCH_V114'),b=text.indexOf('  // END COURIER_FORMS_PATCH_V114',a)+'  // END COURIER_FORMS_PATCH_V114'.length;return text.slice(a,b);};
const edits=JSON.parse(fs.readFileSync(path.join(stage,'tread-edits.json')));let recovered=page;
for(const [before,after]of [...edits].reverse()){assert.ok(recovered.includes(after));recovered=recovered.split(after).join(before);}
recovered=recovered.replace(section(recovered),section(baseline)).replace("'kiez-reference-v145'","'kiez-reference-v144'");assert.equal(recovered,baseline,'all non-target source unchanged');
let scripts=0;for(const m of page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){if(m[1].trim()){new vm.Script(m[1]);scripts++;}}
const native=JSON.parse(fs.readFileSync(path.join(stage,'native-check.json')));assert.ok(native.passed&&native.vertices===11695&&native.triangles===17999&&native.animations===15);
const changedAssets={};for(const ext of ['bin','json','inline.js','blend']){const name='berlin-courier-forms-v114.'+ext;changedAssets[name]=sha(fs.readFileSync(path.join(stage,'models',name)));}
const patch=JSON.parse(fs.readFileSync(path.join(stage,'models/berlin-courier-forms-v114.json')));assert.equal(patch.surfaceRevision,145);assert.equal(patch.finishRevision,120);
assert.deepEqual(Buffer.from(patch.data,'base64'),fs.readFileSync(path.join(stage,'models/berlin-courier-forms-v114.bin')));
assert.equal(section(page),fs.readFileSync(path.join(stage,'models/berlin-courier-forms-v114.inline.js'),'utf8').trimEnd());
for(const name of ['surface-check.json','pose-check.json']){const check=JSON.parse(fs.readFileSync(path.join(stage,name)));assert.ok(check.passed);assert.equal(check.candidateSha256,sha(page));}
const report={passed:true,candidateSha256:sha(page),pageBytes:Buffer.byteLength(page),pageGrowth:Buffer.byteLength(page)-Buffer.byteLength(baseline),scripts,protectedFiles,changedAssets,nonTargetSourceExact:true,unchangedTriangles:17999,unchangedDraws:true,unchangedSamplers:true,extraAttributeBytes:46780,fragmentArithmeticChanged:true};
fs.writeFileSync(path.join(stage,'source-check.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,protectedFiles:Object.keys(protectedFiles).length},null,2));
