'use strict';
// Stage the V126 reference tram into a candidate page (and optionally install it).
// node tools/stage_berlin_tram_v126.cjs [--install]
// Inputs: audit/berlin-tram-v126/models/berlin-vintage-tram-v90.{json,inline.js,glb,blend}
// from tools/stage_berlin_tram_v126.py (Blender) + tools/finish_berlin_tram_v126.py.
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), vm = require('vm');
const root = path.resolve(__dirname, '..'), stage = path.join(root, 'audit/berlin-tram-v126');
const source = fs.existsSync(path.join(stage, 'baseline.html')) ? path.join(stage, 'baseline.html') : path.join(root, 'berlin-runner.html');
if (!fs.existsSync(path.join(stage, 'baseline.html'))) fs.copyFileSync(path.join(root, 'berlin-runner.html'), path.join(stage, 'baseline.html'));
let h = fs.readFileSync(source, 'utf8');

const a = h.indexOf('  // BEGIN BLENDER VINTAGE TRAM'), b = h.indexOf('  // END BLENDER VINTAGE TRAM', a);
assert.ok(a > 0 && b > a, 'tram data markers');
h = h.slice(0, a) + '  // BEGIN BLENDER VINTAGE TRAM\n' + fs.readFileSync(path.join(stage, 'models/berlin-vintage-tram-v90.inline.js'), 'utf8') + h.slice(b);

const f0 = h.indexOf('  function makeRunnerTram() {'), f1 = h.indexOf('  function makeDeliveryMicrovan() {', f0);
assert.ok(f0 > 0 && f1 > f0, 'makeRunnerTram markers');
const factory = `  function makeRunnerTram() {
    // V126 reference coach (tools/stage_berlin_tram_v126.py). One baked atlas
    // carries paint, trim, rubber and chrome (colour x ambient occlusion, with
    // roughness in G and metalness in B of a second map). A modelled cabin
    // glows warm behind Fresnel glass and the lamps burn above the bloom
    // threshold. The root keeps the obstacle placement/pooling contract: the
    // 2.5 x 8 m footprint and the 3.15 m collider are unchanged.
    var data=BERLIN_VINTAGE_TRAM_DATA,g=new THREE.Group(),m=makeRunnerTram.materials;
    if(!m){
      // Geometry-only tools have no DOM image decoder; they get a 1 px stand-in.
      var tramTexture=function(uri){
        if(typeof document==='undefined'){
          var stub=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);
          stub.needsUpdate=true;stub.userData.source=uri;return stub;
        }
        return new THREE.TextureLoader(typeof assetManager!=='undefined'?assetManager:undefined).load(uri);
      };
      var albedo=tramTexture(data.textures.albedo),orm=tramTexture(data.textures.orm);
      albedo.colorSpace=THREE.SRGBColorSpace;albedo.anisotropy=Math.min(8,typeof MAX_ANISO!=='undefined'?MAX_ANISO:1);
      albedo.name='Tram V126 baked atlas';
      orm.colorSpace=THREE.NoColorSpace;orm.name='Tram V126 roughness and metalness';
      var body=mat(0xffffff,{map:albedo,roughness:1,metalness:1,envMapIntensity:.72});
      body.roughnessMap=orm;body.metalnessMap=orm;
      // The cabin is lit from within: its own colours, warmed, as emission.
      var cabin=mat(0xffffff,{map:albedo,roughness:.82,metalness:0,envMapIntensity:.15,
        emissive:0xffd3a0,emissiveIntensity:.34});
      cabin.emissiveMap=albedo;
      // Glass shows the cab head-on and turns into a mirror of the street at
      // grazing angles: a Fresnel opacity plus a painted sky/street reflection
      // (reflected view ray: blue above the horizon, warm facades below).
      var glass=new THREE.MeshStandardMaterial({color:0x5f7380,roughness:.05,metalness:0,
        envMapIntensity:1.0,transparent:true,opacity:.35,depthWrite:false});
      glass.onBeforeCompile=function(shader){
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',[
          'vec3 tramN=normalize(normal),tramV=normalize(vViewPosition);',
          'float tramFacing=clamp(dot(tramN,tramV),0.0,1.0),tramF=pow(1.0-tramFacing,2.0);',
          'vec3 tramR=reflect(-tramV,tramN);',
          'vec3 tramSky=mix(vec3(0.46,0.38,0.29),vec3(0.55,0.70,0.86),smoothstep(-0.15,0.35,tramR.y));',
          'outgoingLight=mix(outgoingLight,tramSky,0.25+0.45*tramF);',
          'diffuseColor.a=mix(0.38,0.90,tramF);',
          '#include <opaque_fragment>'].join('\\n'));
      };
      glass.customProgramCacheKey=function(){return 'tram-fresnel-glass-v126';};
      m=makeRunnerTram.materials={body:body,interior:cabin,glass:glass,
        lamp:new THREE.MeshBasicMaterial({color:new THREE.Color(1.9,1.45,.85)}),
        roofLamp:new THREE.MeshBasicMaterial({color:new THREE.Color(3.2,1.6,.35)}),
        interiorLight:new THREE.MeshBasicMaterial({color:new THREE.Color(2.3,2.0,1.5)}),
        tail:PROP_TAIL,destination:destRollMat};
      makeRunnerTram.bodyMaterial=body;makeRunnerTram.cabinMaterial=cabin;
      makeRunnerTram.glazingMaterial=glass;makeRunnerTram.headlampMaterial=m.lamp;
    }
    data.parts.forEach(function(part){
      var geometry=cached('runner_tram_v126_'+part.mesh,function(){
        return decodeBerlinMeshRecord(THREE,data.meshes[part.mesh]);
      });
      var mesh=new THREE.Mesh(geometry,m[part.role]);
      mesh.position.fromArray(part.translation);mesh.quaternion.fromArray(part.quaternion);mesh.scale.fromArray(part.scale);
      mesh.castShadow=part.role==='body';
      mesh.receiveShadow=part.role==='body'||part.role==='interior';
      mesh.userData.tramPart=part.mesh;mesh.userData.tramRole=part.role;g.add(mesh);
    });
    g.userData.blenderTram=true;
    freezeObjectTree(g,[],false);return registerProp('runnerTram',g);
  }

`;
h = h.slice(0, f0) + factory + h.slice(f1);
h = h.replace(/canvas\.dataset\.graphicsRevision = 'kiez-reference-v\d+';/, "canvas.dataset.graphicsRevision = 'kiez-reference-v126';");
for (const s of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) new vm.Script(s[1]);
fs.writeFileSync(path.join(stage, 'candidate.html'), h);
if (process.argv.includes('--install')) {
  for (const ext of ['blend', 'glb', 'json', 'inline.js'])
    fs.copyFileSync(path.join(stage, 'models/berlin-vintage-tram-v90.' + ext), path.join(root, 'assets/models/berlin-vintage-tram-v90.' + ext));
  fs.writeFileSync(path.join(root, 'berlin-runner.html'), h);
  const sw = path.join(root, 'sw.js');
  fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(/artikel-blitz-v\d+/, 'artikel-blitz-v126'));
}
console.log('V126 tram staged' + (process.argv.includes('--install') ? ' and installed' : ''));
