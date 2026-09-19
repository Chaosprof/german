'use strict';
// Review the staged candidate, or delegate installation to the canonical path.
const fs=require('fs'),path=require('path');
const stage=path.join(__dirname,'../audit/berlin-tram-v90');
const data=JSON.parse(fs.readFileSync(path.join(stage,'models/berlin-vintage-tram-v90.json')));
if(process.argv.includes('--apply'))require('./install_berlin_tram.cjs');
else console.log(JSON.stringify({reviewOnly:true,applyFlag:'--apply',canonicalInstaller:'tools/install_berlin_tram.cjs',replacementTriangles:Object.values(data.meshes).reduce((n,r)=>n+r.triangles,0)},null,2));
