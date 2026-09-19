'use strict';
// Parent-operated exact source installer. Default/--check is read-only.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-courier-cloth-v97/packed');
const mode=process.argv[2]||'--check';assert.ok(['--check','--apply','--revert'].includes(mode));
const normalize=s=>s.replace(/\r/g,'').trim(),sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const scope=fs.readFileSync(path.join(stage,'courier-cloth-packed-scope-v97.js'),'utf8');
const packed=fs.readFileSync(path.join(stage,'refineCourierSilhouette-packed-v97.js'),'utf8');
const artistic=fs.readFileSync(path.join(stage,'baseline/refineCourierSilhouette.js'),'utf8');
const edits=JSON.parse(fs.readFileSync(path.join(stage,'checker-patch.json')));
const htmlPath=path.join(root,'berlin-runner.html'),testPath=path.join(root,'tools/check_berlin_courier.cjs');
const html=fs.readFileSync(htmlPath,'utf8'),test=fs.readFileSync(testPath,'utf8');
const eol=html.includes('\r\n')?'\r\n':'\n',format=s=>s.replace(/\r?\n/g,eol);
const begin=html.indexOf('  function refineCourierSilhouette(mesh) {'),end=html.indexOf('\n  // Both arms share',begin);
assert.ok(begin>0&&end>begin);
const scopeBegin=html.indexOf('  // BEGIN COURIER_CLOTH_PATCH_V97'),scopeEnd=html.indexOf('  // END COURIER_CLOTH_PATCH_V97',scopeBegin);
const installed=scopeBegin>=0;
if(installed){assert.ok(scopeEnd>scopeBegin);const stop=scopeEnd+'  // END COURIER_CLOTH_PATCH_V97'.length;
  assert.equal(normalize(html.slice(scopeBegin,stop)),normalize(scope));assert.equal(normalize(html.slice(begin,end)),normalize(packed));
  assert.ok(/^\s*$/.test(html.slice(stop,begin)),'data scope immediately precedes refinement');
}else assert.equal(normalize(html.slice(begin,end)),normalize(artistic),'current refined source matches accepted corrected baseline');
const accessory='var torso = geo.userData.courierAccessoryBounds ? new THREE.Box3';
assert.ok(html.includes(accessory),'accepted accessory bounds guard must be retained');
let nextHtml=html,nextTest=test;
const revert=mode==='--revert';
if(revert&&installed)nextHtml=html.slice(0,scopeBegin)+format(artistic)+html.slice(end);
if(!revert&&!installed)nextHtml=html.slice(0,begin)+format(scope)+'\n'+format(packed)+html.slice(end);
for(const edit of edits){const before=revert?edit.after:edit.before,after=revert?edit.before:edit.after;
  if(nextTest.includes(before)&&(revert||!nextTest.includes(after))){assert.equal(nextTest.split(before).length,2);nextTest=nextTest.replace(before,after);}
  else assert.equal(nextTest.split(after).length,2,'test is exactly before or after staged scope support');
}
// All checks precede either write, preserving unrelated page/checker changes.
const changes=[{file:htmlPath,before:html,after:nextHtml},{file:testPath,before:test,after:nextTest}];
if(mode!=='--check')for(const change of changes)if(change.before!==change.after)fs.writeFileSync(change.file,change.after);
console.log(JSON.stringify({mode,installedBefore:installed,canonicalWrites:mode==='--check'?0:changes.filter(c=>c.before!==c.after).length,
  changes:changes.map(c=>({file:path.relative(root,c.file),beforeSha256:sha(c.before),afterSha256:sha(c.after),changes:c.before!==c.after}))},null,2));
