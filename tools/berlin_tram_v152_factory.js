  function makeRunnerTram() {
    // V152 reference tram (tools/stage_berlin_tram_v152.py), rebuilt to the
    // art-direction still: a near-full-width windscreen under a rounded cream
    // cap with the amber route lamp, low headlamps over a chunky charcoal
    // bumper, a long charcoal roof box and a single-arm pantograph with a
    // T-shaped head. One baked atlas carries the livery x ambient occlusion;
    // a second map packs clearcoat (R), roughness (G) and metalness (B). The
    // paint is a clearcoated physical material reflecting the captured Kiez
    // street; the glass adds that reflection on top of a see-through cabin.
    // The root keeps the obstacle placement/pooling contract: the 2.5 x 8 m
    // footprint and the 3.15 m collider are unchanged.
    var data=BERLIN_REFERENCE_TRAM_DATA,g=new THREE.Group(),m=makeRunnerTram.materials;
    if(!m){
      // Geometry-only tools have no DOM image decoder; they get a 1 px stand-in.
      var tramTexture=function(uri){
        if(typeof document==='undefined'){
          var stub=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);
          stub.needsUpdate=true;stub.userData.source=uri;return stub;
        }
        return new THREE.TextureLoader(typeof assetManager!=='undefined'?assetManager:undefined).load(uri);
      };
      var albedo=tramTexture(data.textures.albedo),surface=tramTexture(data.textures.surface);
      albedo.colorSpace=THREE.SRGBColorSpace;albedo.anisotropy=Math.min(8,typeof MAX_ANISO!=='undefined'?MAX_ANISO:1);
      albedo.name='Tram V152 baked atlas';
      surface.colorSpace=THREE.NoColorSpace;surface.name='Tram V152 clearcoat, roughness and metalness';
      var env=typeof vehicleEnvTexture==='function'?vehicleEnvTexture():null;
      var body=new THREE.MeshPhysicalMaterial({color:0xffffff,map:albedo,roughness:1,metalness:1,
        roughnessMap:surface,metalnessMap:surface,clearcoat:1,clearcoatMap:surface,clearcoatRoughness:.10,
        envMap:env,envMapIntensity:1.15,dithering:true});
      applyCelShading(body);
      // The cabin is lit from within: its own colours, warmed, as emission.
      var cabin=mat(0xffffff,{map:albedo,roughness:.82,metalness:0,envMapIntensity:.15,
        emissive:0xffcf98,emissiveIntensity:.15});
      cabin.emissiveMap=albedo;
      m=makeRunnerTram.materials={body:body,interior:cabin,glass:vehicleGlass(0x1d262c,.46,env),
        lamp:vehicleLamp(2.6,2.15,1.45),roofLamp:vehicleLamp(3.4,1.55,.30),interiorLight:vehicleLamp(1.45,1.25,.95),
        tail:vehicleLamp(2.2,.28,.16),
        destination:markVehicleInk(new THREE.MeshBasicMaterial({map:destRollMat.map,color:new THREE.Color(.82,.82,.82)}))};
      markVehicleInk(body);markVehicleInk(cabin);
      makeRunnerTram.bodyMaterial=body;makeRunnerTram.cabinMaterial=cabin;
      makeRunnerTram.glazingMaterial=m.glass;makeRunnerTram.headlampMaterial=m.lamp;
    }
    data.parts.forEach(function(part){
      var geometry=cached('runner_tram_v152_'+part.mesh,function(){
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

