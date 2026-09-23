'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-final-v122');
fs.mkdirSync(stage,{recursive:true});
let h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
function replace(a,b){assert.ok(h.includes(a),'missing sky source anchor');h=h.replace(a,b);}
// Extend the existing cylindrical shaft sample to the horizon. The previous
// 387px alpha cut became a floating bottom whenever the bridge moved away.
// The mast/sphere mapping, texture fetch count and near street fog are exact.
replace("'  else { sy = 180.0 + (p.y - 199.2) * 1.061381; k = 0.62; }',",
  "'  else { sy = min(350.0, 180.0 + (p.y - 199.2) * 1.061381); k = 0.50; }',");
replace("'      sk.a *= keep;',","'      keep *= 1.0 - smoothstep(465.0, 510.0, dp.y);',\n      '      sk.a *= keep;',");
replace("'kiez-reference-v121'","'kiez-reference-v122'");
for(const s of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))new vm.Script(s[1]);
fs.writeFileSync(path.join(stage,'candidate.html'),h);
console.log('Staged continuous, slimmer distant tower shaft with the existing sky sample.');
