const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'audit/berlin-tram-reference-v123');
const h=fs.readFileSync(path.join(dir,'candidate.html'),'utf8');
const three=[...h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].find(m=>m[1].includes('three.js r156 (MIT)'))[1];
const packed=fs.readFileSync(path.join(root,'tools/berlin_packed_geometry.js'),'utf8');
const data=fs.readFileSync(path.join(dir,'models/berlin-vintage-tram-v90.inline.js'),'utf8');
const factory=h.slice(h.indexOf('  function makeRunnerTram() {'),h.indexOf('  function makeDeliveryMicrovan() {'));
const body=`const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(1.25);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;document.body.appendChild(renderer.domElement);
const scene=new THREE.Scene();scene.background=new THREE.Color(0xb5c3c9);const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,.1,80);camera.position.set(-7,4.9,-12);camera.lookAt(0,2,0);
scene.add(new THREE.HemisphereLight(0xddeeff,0x8b7354,2));const sun=new THREE.DirectionalLight(0xffe4bc,3);sun.position.set(-6,9,-4);scene.add(sun);
const mat=(c,o)=>new THREE.MeshStandardMaterial({color:c,...o});const MAT={metalDark:mat(0x23343b),tyre:mat(0x18232a)},STATION_MAT={steel:mat(0x596a75)};const PROP_TAIL=new THREE.MeshBasicMaterial({color:0xff4d3d});
const destRollMat=new THREE.MeshBasicMaterial({color:0x263039});const cache=new Map();const cached=(k,fn)=>{if(!cache.has(k))cache.set(k,fn());return cache.get(k)};const freezeObjectTree=o=>o.updateMatrixWorld(true);const registerProp=(k,o)=>o;
${factory}
const model=makeRunnerTram();scene.add(model);const floor=new THREE.Mesh(new THREE.PlaneGeometry(30,30),mat(0x89969c));floor.rotation.x=-Math.PI/2;floor.position.y=-.01;scene.add(floor);renderer.render(scene,camera);
document.querySelector('#status').textContent='V123 · '+model.children.reduce((n,m)=>n+m.geometry.index.count/3,0)+' triangles';`;
fs.writeFileSync(path.join(dir,'model-review.html'),'<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;overflow:hidden}#status{position:absolute;left:20px;top:18px;color:#1b3440;font:16px system-ui}</style></head><body><div id="status"></div><script>'+three+'</script><script>'+packed+'\n'+data+'\n'+body+'</script></body></html>');
