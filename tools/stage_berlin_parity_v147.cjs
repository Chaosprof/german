'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v147'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const folder of ['baseline','sources','frames','benchmark'])fs.mkdirSync(path.join(stage,folder),{recursive:true});
const basePage=path.join(stage,'baseline.html');
if(!fs.existsSync(basePage)){
 const page=fs.readFileSync(path.join(root,'berlin-runner.html'));assert.equal(sha(page),'680120e96d6c5447833285aef5eafe3ae8a3d7730734f0208acb3999f407fbd9');fs.writeFileSync(basePage,page);
 for(const name of ['berlin_kiez_kit.js','berlin_facade_finish_v119.js'])fs.copyFileSync(path.join(root,'tools',name),path.join(stage,'baseline',name));
}
const oldKit=fs.readFileSync(path.join(stage,'baseline/berlin_kiez_kit.js'),'utf8');let kit=oldKit;
const headStart=oldKit.indexOf('  // Five loose clusters of three small florets'),headEnd=oldKit.indexOf('  var geranium=',headStart);
const heads=`  // Rounded blooms retain volume when viewed along the street. Weld the
  // twenty-face sphere to twelve vertices and use a smooth radial normal field.
  var bloomSource=new THREE.IcosahedronGeometry(1,0),bloom=new THREE.BufferGeometry();
  var bp=[],bn=[],bi=[],bloomPoints=new Map(),positions=bloomSource.attributes.position;
  for(var vi=0;vi<positions.count;vi++){
    var v=new THREE.Vector3().fromBufferAttribute(positions,vi),key=v.toArray().join(',');
    if(!bloomPoints.has(key)){
      bloomPoints.set(key,bp.length/3);bp.push(v.x,v.y,v.z);v.normalize();bn.push(v.x,v.y,v.z);
    }
    bi.push(bloomPoints.get(key));
  }
  bloom.setAttribute('position',new THREE.Float32BufferAttribute(bp,3));
  bloom.setAttribute('normal',new THREE.Float32BufferAttribute(bn,3));bloom.setIndex(bi);bloomSource.dispose();
`;
assert.ok(headStart>0&&headEnd>headStart);
const oldHeads=oldKit.slice(headStart,headEnd);
const leafStart=oldKit.indexOf('  // Closed six-sided leaf'),oldLeaf=oldKit.slice(leafStart,headStart);
assert.ok(leafStart>0&&headStart>leafStart);
const leaves=`  // Small curved oval leaves: eight outline corners, a shallow front,
  // and a closed back. Independent rim normals soften the folded leaf surface.
  var leaf=new THREE.BufferGeometry(),lp=[],ln=[],li=[];
  for(var edge=0;edge<8;edge++){
    var angle=edge*Math.PI/4,x=Math.cos(angle),y=Math.sin(angle);
    lp.push(x,y,Math.abs(y)*.075);var nn=new THREE.Vector3(x*.55,y*.60,.62).normalize();ln.push(nn.x,nn.y,nn.z);
  }
  lp.push(0,0,.19,0,0,-.065);ln.push(0,0,1,0,0,-1);
  for(var edge=0;edge<8;edge++){
    var angle=edge*Math.PI/4,x=Math.cos(angle),y=Math.sin(angle);
    lp.push(x,y,Math.abs(y)*.075);var nn=new THREE.Vector3(x*.40,y*.44,-.66).normalize();ln.push(nn.x,nn.y,nn.z);
    li.push(8,edge,(edge+1)%8,9,10+(edge+1)%8,10+edge);
  }
  leaf.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));leaf.setAttribute('normal',new THREE.Float32BufferAttribute(ln,3));leaf.setIndex(li);
`;
const plantingStart=oldKit.indexOf('    for(var j=0;j<10;j++){',headEnd),plantingEnd=oldKit.indexOf('  });\n  // A small number of stepped chimney',plantingStart);
assert.ok(plantingStart>headEnd&&plantingEnd>plantingStart);
const oldPlanting=oldKit.slice(plantingStart,plantingEnd);
const planting=`    // Three overlapping, uneven rows of smaller leaves make a rounded mound.
    for(var j=0;j<24;j++){
      var t=(j%8+.5)/8,tier=Math.floor(j/8),phase=j*2.17+si*.91+variant*.43;
      var size=.88+.18*(.5+.5*Math.sin(phase*1.7));
      add(leaf,x+(t-.5)*w*.99+Math.sin(phase)*.04,y+.07+tier*.115+Math.sin(phase*.81)*.055,
        z+.04+tier*.065+Math.cos(phase)*.06,.115*size,.13*size,.18,
        j%3?0x4e7137:0x758b40,-side*.38+Math.sin(phase)*.70,Math.cos(phase*.73)*.65,Math.sin(phase*.91)*.55);
    }
    // Seven loose clusters: coherent pink/cream families per box, with one
    // pale accent cluster. Unequal heights break the horizontal flower strip.
    for(var j=0;j<21;j++){
      var cluster=Math.floor(j/3),floret=j%3,t=(cluster+.5)/7;
      var a=floret*Math.PI*2/3+cluster*.83+si*.37,r=.077+.012*((cluster+si)%3);
      var cx=x+(t-.5)*w*.96+Math.sin(cluster*2.3+si)*.038;
      var cy=y+.27+Math.sin(cluster*1.9+si*.73)*.105;
      var family=cluster===(si+2)%7?3:(si*2+variant)%geranium.length;
      add(bloom,cx+Math.cos(a)*.076,cy+Math.sin(a)*.074,z+.17+Math.cos(j*1.7+si)*.045,
        r*1.05,r,r*.88,geranium[family],Math.sin(j+si)*.42,a*.27);
    }
    // Three unequal ivy trails follow bent paths; their leaf pairs overlap
    // the container edge and taper toward each hanging tip.
    for(var j=0;j<8;j++){
      var stem=j<3?0:j<6?1:2,tier=j-(stem===0?0:stem===1?3:6);
      var t=[-.37,.04,.38][stem],phase=si*.9+stem*1.7;
      var drop=tier*(stem===1?.20:.155)+(stem===0?.03:stem===1?.12:0);
      var size=1-tier*.12;
      add(leaf,x+t*w+Math.sin(tier*1.1+phase)*.085,y-.17-drop,z+.245+tier*.012,
        .105*size,.125*size,.20,j%3?0x4d753a:0x678642,
        -side*.48+Math.sin(j+si)*.34,(tier%2?-.48:.38)+Math.cos(phase+tier*.7)*.26,Math.sin(j+si)*.35);
    }
`;
const edits=[[oldLeaf,leaves],[oldHeads,heads],[oldPlanting,planting],
 ['function add(g,x,y,z,sx,sy,sz,color,ry,rz){','function add(g,x,y,z,sx,sy,sz,color,ry,rz,rx){'],
 ['new THREE.Euler(0,ry||0,rz||0)','new THREE.Euler(rx||0,ry||0,rz||0)'],
 ['flowerClusterRevision:138,flowerHeads:slots.length*15','flowerClusterRevision:147,flowerHeads:slots.length*21']];
for(const [a,b]of edits){assert.equal(kit.split(a).length,2);kit=kit.replace(a,()=>b);}
fs.writeFileSync(path.join(stage,'source-edits.json'),JSON.stringify(edits,null,2));fs.writeFileSync(path.join(stage,'sources/berlin_kiez_kit.js'),kit);
const begin=kit.indexOf('function finishBerlinKiezFacade('),end=kit.indexOf('// Extend the single atlas material.',begin);
fs.writeFileSync(path.join(stage,'sources/berlin_facade_finish_v119.js'),kit.slice(begin,end)+"if (typeof module !== 'undefined') module.exports = {finishBerlinKiezFacade:finishBerlinKiezFacade};\n");
const trim=s=>s.replace(/\nif \(typeof module[^\n]+\n?$/,'\n').trim();
let page=fs.readFileSync(basePage,'utf8');assert.equal(page.split(trim(oldKit)).length,2);page=page.replace(trim(oldKit),()=>trim(kit));
assert.equal(page.split("'kiez-reference-v146'").length,2);page=page.replace("'kiez-reference-v146'","'kiez-reference-v147'");
fs.writeFileSync(path.join(stage,'candidate.html'),page);
console.log(JSON.stringify({candidateSha256:sha(page),pageBytes:Buffer.byteLength(page),addedPageBytes:Buffer.byteLength(page)-fs.statSync(basePage).size},null,2));
