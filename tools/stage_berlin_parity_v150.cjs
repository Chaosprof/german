'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v150'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const dir of ['baseline','sources','frames','benchmark'])fs.mkdirSync(path.join(stage,dir),{recursive:true});
if(!fs.existsSync(path.join(stage,'baseline.html'))){
 const page=fs.readFileSync(path.join(root,'berlin-runner.html'));assert.equal(sha(page),'d12332a31c7cd9680bb5094ddae2c62257d7c0cb856a13a8e2ea059aedc72251');fs.writeFileSync(path.join(stage,'baseline.html'),page);
 for(const name of ['berlin_kiez_kit.js','berlin_facade_finish_v119.js'])fs.copyFileSync(path.join(root,'tools',name),path.join(stage,'baseline',name));
}
const old=fs.readFileSync(path.join(stage,'baseline/berlin_kiez_kit.js'),'utf8'),display=fs.readFileSync(path.join(__dirname,'berlin_shop_displays_v150.js'),'utf8');
const edits=[
 ['  box.dispose();leaf.dispose();bloom.dispose();',display+'\n  box.dispose();leaf.dispose();bloom.dispose();'],
 ['parkedBicycles:variant===0?1:0});','parkedBicycles:variant===0?1:0,shopDisplayRevision:150,shopDisplayFaces:[shopDisplayStart,shopDisplayEnd],shopDisplayBays:shopBays.map(function(b){return {min:b.min,max:b.max};}),breadCount:breadCount,spineCount:spineCount});'],
 ['    finishColor[i*4+3]=cc.normalized?Math.round(light*colorScale):light;',
  '    if(displayBackdropVertices.has(i))light=1;\n    if(i>=oldCount+shopDisplayVertexStart&&i<oldCount+shopDisplayVertexEnd){\n      var roomFacing=Math.max(0,Math.min(1,-out.attributes.normal.getX(i)*.35+out.attributes.normal.getY(i)*.75+out.attributes.normal.getZ(i)*.56));\n      light=.10+.36*roomFacing;\n    }\n    finishColor[i*4+3]=cc.normalized?Math.round(light*colorScale):light;'],
 ['extra.uv[firstUV+cv*2]=(.143+u*.139)/4;', 'extra.uv[firstUV+cv*2]=((j?.602:.374)+u*.136)/4;'],
 ['extra.uv[firstUV+cv*2+1]=.5+(.125+v*.29)/4;', 'extra.uv[firstUV+cv*2+1]=.5+(.603+v*.147)/4;'],
 ['roughnessFactor=mix(roughnessFactor,0.34,kiezGlazing);\\n', 'roughnessFactor=mix(roughnessFactor,0.34,kiezGlazing);\\nif(kiezSurface>=4.0&&kiezSurface<=5.0&&vColor.a>0.08&&vColor.a<0.49)roughnessFactor=0.84;\\n'],
 ["      'float kiezDiagonal=kiezLocal.x*0.65+kiezLocal.y;',",[
  "      // Physical focal-shop merchandise replaces the lower painted display.",
  "      // Preserve the image's upper pendant and ceiling; foreground book art",
  "      // has alpha zero and remains unchanged. No extra texture is sampled.",
  "      'if(vColor.a>0.99&&(abs(kiezPaintTile-4.0)<0.5||abs(kiezPaintTile-5.0)<0.5)){',",
  "      'float displayWall=1.0-smoothstep(0.755,0.785,kiezLocal.y);',",
  "      'vec3 woodWall=vec3(0.115,0.058,0.025)*(0.80+0.28*kiezLocal.y)*vColor.rgb;',",
  "      'diffuseColor.rgb=mix(diffuseColor.rgb,woodWall,displayWall);',",
  "      '}',",
  "      'float kiezDiagonal=kiezLocal.x*0.65+kiezLocal.y;',"
 ].join('\n')],
 ["'|kiez-facade-finish-v148-glass'","'|kiez-facade-finish-v150-displays'"]
];
const indexEdits=require('./berlin_indexed_facade_edits_v150.cjs');
fs.writeFileSync(path.join(stage,'index-edits.json'),JSON.stringify(indexEdits,null,2));
edits.push(...indexEdits);
let kit=old;for(const [from,to]of edits){assert.equal(kit.split(from).length,2,from);kit=kit.replace(from,()=>to);}
fs.writeFileSync(path.join(stage,'edits.json'),JSON.stringify(edits,null,2));fs.writeFileSync(path.join(stage,'sources/berlin_kiez_kit.js'),kit);
const a=kit.indexOf('function finishBerlinKiezFacade('),b=kit.indexOf('// Extend the single atlas material.',a);
fs.writeFileSync(path.join(stage,'sources/berlin_facade_finish_v119.js'),kit.slice(a,b)+"if (typeof module !== 'undefined') module.exports = {finishBerlinKiezFacade:finishBerlinKiezFacade};\n");
const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();let page=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
assert.equal(page.split(trim(old)).length,2);page=page.replace(trim(old),()=>trim(kit));assert.equal(page.split("'kiez-reference-v149'").length,2);page=page.replace("'kiez-reference-v149'","'kiez-reference-v150'");fs.writeFileSync(path.join(stage,'candidate.html'),page);
console.log(JSON.stringify({candidateSha256:sha(page),pageBytes:Buffer.byteLength(page),addedBytes:Buffer.byteLength(page)-fs.statSync(path.join(stage,'baseline.html')).size},null,2));
