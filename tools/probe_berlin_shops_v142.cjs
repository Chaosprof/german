'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'audit/berlin-parity-v142');
const h=fs.readFileSync(path.join(stage,'baseline.html'),'utf8'),scope=vm.createContext({console,atob:s=>Buffer.from(s,'base64').toString('binary')});
vm.runInContext([...h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('three.js r156 (MIT)')),scope);
vm.runInContext(fs.readFileSync(path.join(root,'tools/berlin_packed_geometry.js'),'utf8'),scope);
const T=scope.THREE,folders=process.argv.includes('--before-only')?['baseline']:['baseline','models'];
const result={};
for(const folder of folders){
  const data=JSON.parse(fs.readFileSync(path.join(stage,folder,'berlin-reference-architecture-v1.json'),'utf8'));
  const g=scope.decodeBerlinMeshRecord(T,data.meshes['13.5:1:1']),mesh=new T.Mesh(g,new T.MeshBasicMaterial());
  mesh.updateMatrixWorld(true);const rows=[];
  for(const degrees of [0,30,45,60,70,-60,-70]){
    let visible=0,blocked=0,misses=0;const tiles={};const angle=degrees*Math.PI/180;
    for(const cx of [-4.2,0,4.2])for(const y of [1.25,1.85,2.55])for(let xi=0;xi<25;xi++){
      const x=cx-1.6+3.2*(xi+.5)/25;
      const ray=new T.Raycaster(new T.Vector3(x+4*Math.tan(angle),y,4.566),new T.Vector3(-Math.sin(angle),0,-Math.cos(angle)));
      const hit=ray.intersectObject(mesh)[0];
      if(!hit){misses++;continue;}
      const tile=Math.floor(hit.uv.x*4)+4*Math.floor((1-hit.uv.y)*4);tiles[tile]=(tiles[tile]||0)+1;
      if(tile===4)visible++;else blocked++;
    }
    rows.push({degrees,samples:225,visibleMerchandise:visible,blocked,misses,tiles});
  }
  result[folder]=rows;
}
fs.writeFileSync(path.join(stage,'shop-visibility.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
