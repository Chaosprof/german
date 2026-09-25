'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v148'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const dir of ['baseline','sources','frames','benchmark'])fs.mkdirSync(path.join(stage,dir),{recursive:true});
if(!fs.existsSync(path.join(stage,'baseline.html'))){
 const page=fs.readFileSync(path.join(root,'berlin-runner.html'));assert.equal(sha(page),'96735f26213afd4dd96d6b6de0fd36c9032ad6281cedfcabf2522886d4108b1f');fs.writeFileSync(path.join(stage,'baseline.html'),page);
 for(const name of ['berlin_kiez_kit.js','berlin_facade_finish_v119.js'])fs.copyFileSync(path.join(root,'tools',name),path.join(stage,'baseline',name));
}
const oldKit=fs.readFileSync(path.join(stage,'baseline/berlin_kiez_kit.js'),'utf8');let kit=oldKit;
const start=oldKit.indexOf('  tile(2, function (g) {'),end=oldKit.indexOf('  tile(3, function (g) {',start);assert.ok(start>0&&end>start);
const glass=`  tile(2, function (g) {
    // The upper sky stays cool; broad reflected opposite-wall planes give
    // the lower glass a warm, layered response without fine repeated noise.
    var sky=g.createLinearGradient(0,0,0,256);
    sky.addColorStop(0,'#819caa');sky.addColorStop(.39,'#627980');
    sky.addColorStop(.70,'#62665a');sky.addColorStop(1,'#3c433d');
    g.fillStyle=sky;g.fillRect(0,0,256,256);
    var wall=g.createLinearGradient(0,36,0,248);
    wall.addColorStop(0,'rgba(207,166,113,0)');
    wall.addColorStop(.30,'rgba(211,175,126,.31)');
    wall.addColorStop(.76,'rgba(192,151,103,.39)');
    wall.addColorStop(1,'rgba(179,143,102,.12)');
    g.fillStyle=wall;g.beginPath();g.moveTo(26,52);g.lineTo(207,27);
    g.lineTo(239,211);g.lineTo(49,244);g.closePath();g.fill();
    // Soft vertical returns and two distant cornice reflections keep the
    // reflection architectural without painting tiny windows into every pane.
    var returnLight=g.createLinearGradient(0,0,256,0);
    returnLight.addColorStop(0,'rgba(225,194,146,0)');
    returnLight.addColorStop(.23,'rgba(225,194,146,.17)');
    returnLight.addColorStop(.37,'rgba(225,194,146,.04)');
    returnLight.addColorStop(.77,'rgba(209,186,148,.11)');
    returnLight.addColorStop(1,'rgba(209,186,148,0)');
    g.fillStyle=returnLight;g.fillRect(0,32,256,224);
    g.fillStyle='rgba(224,199,155,.12)';
    [[92,76,7],[167,148,9]].forEach(function(b){
      g.beginPath();g.moveTo(17,b[0]);g.lineTo(239,b[1]);g.lineTo(239,b[1]+b[2]);g.lineTo(17,b[0]+b[2]);g.closePath();g.fill();
    });
    g.fillStyle='rgba(229,234,215,.10)';g.fillRect(18,6,4,242);
    g.fillStyle='rgba(25,34,35,.24)';g.fillRect(0,0,256,11);
  });
`;
const emission="      'totalEmissiveRadiance+=vColor.a*(1.0-step(1.5,kiezPaintTile))*vec3(0.16,0.105,0.047);'";
const newEmission=`      'totalEmissiveRadiance+=vColor.a*(1.0-step(1.5,kiezPaintTile))*vec3(0.16,0.105,0.047);',
      // The painted reflection carries a little of the opposite wall's light
      // even when the glass itself lies in facade shade. Room/shop light is unchanged.
      'if(kiezPane>0.5){totalEmissiveRadiance+=diffuseColor.rgb*(0.10+0.14*vColor.a);}'`;
const edits=[[oldKit.slice(start,end),glass],[emission,newEmission],["'|kiez-facade-finish-v125-lamps'","'|kiez-facade-finish-v148-glass'"]];
for(const [a,b]of edits){assert.equal(kit.split(a).length,2);kit=kit.replace(a,()=>b);}
fs.writeFileSync(path.join(stage,'source-edits.json'),JSON.stringify(edits,null,2));fs.writeFileSync(path.join(stage,'sources/berlin_kiez_kit.js'),kit);
const first=kit.indexOf('function finishBerlinKiezFacade('),last=kit.indexOf('// Extend the single atlas material.',first);
fs.writeFileSync(path.join(stage,'sources/berlin_facade_finish_v119.js'),kit.slice(first,last)+"if (typeof module !== 'undefined') module.exports = {finishBerlinKiezFacade:finishBerlinKiezFacade};\n");
const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();let page=fs.readFileSync(path.join(stage,'baseline.html'),'utf8');
assert.equal(page.split(trim(oldKit)).length,2);page=page.replace(trim(oldKit),()=>trim(kit));assert.equal(page.split("'kiez-reference-v147'").length,2);page=page.replace("'kiez-reference-v147'","'kiez-reference-v148'");
fs.writeFileSync(path.join(stage,'candidate.html'),page);console.log(JSON.stringify({candidateSha256:sha(page),pageBytes:Buffer.byteLength(page),addedPageBytes:Buffer.byteLength(page)-fs.statSync(path.join(stage,'baseline.html')).size},null,2));
