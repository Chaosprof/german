'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v132');
fs.mkdirSync(path.join(stage,'baseline'),{recursive:true});
for(const [src,dst] of [['berlin-runner.html','baseline.html'],['tools/berlin_kiez_kit.js','baseline/berlin_kiez_kit.js']]){
  if(!fs.existsSync(path.join(stage,dst)))fs.copyFileSync(path.join(root,src),path.join(stage,dst));
}
let h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8'),kit=fs.readFileSync(path.join(stage,'baseline/berlin_kiez_kit.js'),'utf8');
const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim(),before=trim(kit);
function change(a,b){assert.equal(kit.split(a).length,2,a);kit=kit.replace(a,()=>b);}
// An alternating shallow rim closes the leaf with eight triangles. Smaller,
// staggered pairs can then replace the four large hanging leaves at lower cost.
change(`  for(var face=0;face<2;face++){
    var sign=face?-1:1;
    for(var edge=0;edge<6;edge++){
      var a=edge*Math.PI/3,x=Math.cos(a),y=Math.sin(a);
      lp.push(x,y,.035*(x*x-y*y));var nn=new THREE.Vector3(x*.35,y*.35,sign).normalize();ln.push(nn.x,nn.y,nn.z);
    }
    lp.push(0,0,sign*.12);ln.push(0,0,sign);
    for(var edge=0;edge<6;edge++)li.push(face*7+6,face*7+(face?(edge+1)%6:edge),face*7+(face?edge:(edge+1)%6));
  }`, `  var leafRim=[];
  for(var edge=0;edge<6;edge++){
    var angle=edge*Math.PI/3;
    leafRim.push([Math.cos(angle),Math.sin(angle),edge%2?-.09:.09]);
  }
  var leafFaces=[[0,2,4],[5,3,1]];
  for(var edge=0;edge<6;edge++)leafFaces.push([edge,(edge+2)%6,(edge+1)%6]);
  leafFaces.forEach(function(face){
    var a=new THREE.Vector3().fromArray(leafRim[face[0]]),b=new THREE.Vector3().fromArray(leafRim[face[1]]),c=new THREE.Vector3().fromArray(leafRim[face[2]]);
    var centre=a.clone().add(b).add(c),normal=b.clone().sub(a).cross(c.clone().sub(a));
    if(normal.dot(centre)<0)face.reverse();
    face.forEach(function(edge){
      var v=leafRim[edge],sign=centre.z<0?-1:1,nn=new THREE.Vector3(v[0]*.35,v[1]*.45,sign).normalize();
      li.push(lp.length/3);lp.push(v[0],v[1],v[2]);ln.push(nn.x,nn.y,nn.z);
    });
  });`);
change(`    for(var j=0;j<4;j++)add(leaf,x+(j/3-.5)*w*.8,y-.33-(j%2)*.09,z+.23,.17,.28,.30,0x4d753a,0,.2*Math.cos(j+si));`, `    for(var j=0;j<8;j++){
      var stem=Math.floor(j/2),tier=j%2;
      add(leaf,x+(stem/3-.5)*w*.77+(tier?-.055:.05),y-.23-tier*.17-(stem%2)*.07,z+.23+tier*.02,
        .10,.145,.24,j%3?0x4d753a:0x678642,Math.sin(j+si)*.20,(tier?-.36:.32)+Math.cos(stem+si)*.20);
    }`);
change(`  // V125: sills overflow with geraniums, as in the art direction: a two-tier
  // leaf mound crowned by fourteen octahedral bloom heads (8 triangles each)
  // with ivy trailing over the rail, 256 triangles per box.`, `  // Two layers of foliage, twelve rounded bloom heads and four pairs of
  // trailing ivy leaves: 288 triangles per box, including container and rail.`);
assert.ok(h.includes(before));h=h.replace(before,()=>trim(kit));
const rhythm='b2 === 1 ? (frontageBeat % 2 === 1 ? 3 : 2)';
assert.equal(h.split(rhythm).length,2);h=h.replace(rhythm,'b2 === 1 ? (frontageBeat === 3 ? 3 : 2)');
h=h.replace("'kiez-reference-v131'","'kiez-reference-v132'");
fs.mkdirSync(path.join(stage,'sources'),{recursive:true});
fs.writeFileSync(path.join(stage,'sources/berlin_kiez_kit.js'),kit);fs.writeFileSync(path.join(stage,'candidate.html'),h);
console.log('Staged V132 facade rhythm and finer trailing ivy.');
if(process.argv.includes('--install')){
  fs.writeFileSync(path.join(root,'berlin-runner.html'),h);fs.writeFileSync(path.join(root,'tools/berlin_kiez_kit.js'),kit);
  const a=kit.indexOf('function finishBerlinKiezFacade('),b=kit.indexOf('// Extend the single atlas material.',a);
  fs.writeFileSync(path.join(root,'tools/berlin_facade_finish_v119.js'),kit.slice(a,b)+"if (typeof module !== 'undefined') module.exports = {finishBerlinKiezFacade:finishBerlinKiezFacade};\n");
  fs.writeFileSync(path.join(root,'sw.js'),fs.readFileSync(path.join(root,'sw.js'),'utf8').replace(/artikel-blitz-v\d+/g,'artikel-blitz-v132'));
  console.log('Installed V132 page, facade source and cache revision.');
}
