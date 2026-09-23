const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),phase=path.join(root,'audit/berlin-parity-trees-v118');
let h=fs.readFileSync(path.join(phase,'baseline.html'),'utf8');
const start=h.indexOf('  // BEGIN BLENDER GARDEN KIT'),end=h.indexOf('  // END BLENDER GARDEN KIT',start);
assert.ok(start>0&&end>start);
const old=h.slice(start,end),hasDecoder=/function decodeBerlinMeshRecord/.test(old);
const decoder=hasDecoder?fs.readFileSync(path.join(__dirname,'berlin_packed_geometry.js'),'utf8').replace(/\nif \(typeof module[^\n]+\n?$/,'\n'):'';
const data=fs.readFileSync(path.join(phase,'models/berlin-kiez-garden-v1.inline.js'),'utf8');
const kit=fs.readFileSync(path.join(__dirname,'berlin_garden_integration.js'),'utf8').replace(/\nif \(typeof module[^\n]+\n?$/,'\n');
h=h.slice(0,start)+'  // BEGIN BLENDER GARDEN KIT\n'+data+'\n'+decoder+kit+'\nvar berlinGardenKit = createBerlinGardenKit(THREE, mat, BERLIN_KIEZ_GARDEN_DATA);\n'+h.slice(end);
h=h.replace("'kiez-reference-v117'","'kiez-reference-v118'");
h=h.replace('treeZ = i === 0 ? -8 : i === 1 ? -2 : i === 2 ? 10.5 : 4;',
  'treeZ = i === 0 ? -8 : i === 1 ? -2 : i === 2 ? 16 : 4;');
fs.writeFileSync(path.join(phase,'candidate.html'),h);
console.log('Candidate staged; live build remains available for comparison.');
