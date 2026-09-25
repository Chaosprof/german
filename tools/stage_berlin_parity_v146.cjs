'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v146'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const name of ['frames','benchmark'])fs.mkdirSync(path.join(stage,name),{recursive:true});
const baselineFile=path.join(stage,'baseline.html');if(!fs.existsSync(baselineFile)){
 const page=fs.readFileSync(path.join(root,'berlin-runner.html'));assert.equal(sha(page),'cd96a16ec90c5e2f2b2492a98a9b9080e6cea3000a3b61c3a111c404de4b9f36');fs.writeFileSync(baselineFile,page);
}
let page=fs.readFileSync(baselineFile,'utf8');
const data=fs.readFileSync(path.join(stage,'models/berlin-street-containers-v146.inline.js'),'utf8').trimEnd();
const block='  // BEGIN STREET CONTAINERS V146\n'+data+`\n  var berlinStreetContainerGeometries = Object.create(null);
  function streetContainerGeometry(name) {
    if (!berlinStreetContainerGeometries[name]) berlinStreetContainerGeometries[name] =
      decodeBerlinMeshRecord(THREE, BERLIN_STREET_CONTAINERS_V146.meshes[name]);
    return berlinStreetContainerGeometries[name];
  }
  // END STREET CONTAINERS V146`;
const oldBase=`    // Tree pit: a chunky stone kerb with a dark grate inside it, not a 6 cm plate.
    g.add(roundedBox(1.84, 0.22, 1.84, 0.10, MAT.kerb, 0, 0.11, 0, 0.04));
    g.add(roundedBox(1.42, 0.10, 1.42, 0.06, MAT.metalDark, 0, 0.20, 0, 0.02));`;
const newBase=`    // A rolled stone urn frames the foreground; ordinary trees retain an
    // inset square planting pit. Stone and soil share one native opaque mesh.
    var containerRole = useUrn ? 'treeUrn' : 'treePit';
    var base = new THREE.Mesh(streetContainerGeometry(containerRole), berlinGardenKit.material);
    base.receiveShadow = true; base.userData.streetTreeContainer = containerRole;
    g.add(base);`;
const edits=[
 ["  function makeTree() {",block+"\n\n  function makeTree(useUrn) {"],
 [oldBase,newBase],
 ['var tr = makeTree(); g.add(tr); ud.trees.push(tr);','var tr = makeTree(KIEZ_DISTRICT_ENABLED && t === 2); g.add(tr); ud.trees.push(tr);'],
 ["      (ud.lamps || []).forEach(addFurniture);","      (ud.lamps || []).forEach(addFurniture);\n      // Singleton foreground urns join the same world pool across chunks.\n      (ud.trees || []).forEach(addFurniture);"],
 ["'kiez-reference-v145'","'kiez-reference-v146'"]
];
for(const [old,next]of edits){assert.equal(page.split(old).length,2,'exact edit '+old.slice(0,80));page=page.replace(old,next);}
fs.writeFileSync(path.join(stage,'source-edits.json'),JSON.stringify(edits,null,2));fs.writeFileSync(path.join(stage,'candidate.html'),page);
console.log(JSON.stringify({candidateSha256:sha(page),pageBytes:Buffer.byteLength(page),addedBytes:Buffer.byteLength(page)-fs.statSync(baselineFile).size},null,2));
