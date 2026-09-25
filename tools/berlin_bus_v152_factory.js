  function makeBus() {
    // V152 reference bus (tools/stage_berlin_bus_v152.py): a BVG double-
    // decker in the SD 202 silhouette, one lofted shell with rounded corners
    // and a rolled roof, apertures cut by an exact boolean and glazed with
    // recessed, rubber-gasketed glass over a two-deck interior, the dark BVG
    // window bands, a split lower windscreen, a lit "100 ALEXANDERPLATZ"
    // roller, folding doors on the kerb side (+x) and wheels in real wells.
    // One baked atlas (colour x occlusion, clearcoat/roughness/metalness)
    // covers coachwork and cabin; glass, lamps and tails reuse the car's
    // materials. Parked copies draw through the instanced kerb pool.
    var data=BERLIN_REFERENCE_BUS_DATA,g=new THREE.Group(),m=makeBus.materials;
    if(!m){
      var busTexture=function(uri,srgb){
        var t;
        if(typeof document==='undefined'){
          t=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);
          t.needsUpdate=true;t.userData.source=uri;
        }else{
          t=new THREE.TextureLoader(typeof assetManager!=='undefined'?assetManager:undefined).load(uri);
        }
        t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;
        t.anisotropy=Math.min(8,typeof MAX_ANISO!=='undefined'?MAX_ANISO:1);
        return t;
      };
      var env=typeof vehicleEnvTexture==='function'?vehicleEnvTexture():null;
      var albedo=busTexture(data.textures.albedo,true),surface=busTexture(data.textures.surface,false);
      albedo.name='Bus V152 baked atlas';surface.name='Bus V152 clearcoat, roughness and metalness';
      var body=new THREE.MeshPhysicalMaterial({color:0xffffff,map:albedo,roughness:1,metalness:1,
        roughnessMap:surface,metalnessMap:surface,clearcoat:1,clearcoatMap:surface,clearcoatRoughness:.10,
        envMap:env,envMapIntensity:1.12,dithering:true});
      if(typeof applyCelShading==='function')applyCelShading(body);
      if(typeof markVehicleInk==='function')markVehicleInk(body);
      var rollerTex=typeof canvasTexture==='function'&&typeof document!=='undefined'?canvasTexture(640,96,function(c,w,h){
        c.fillStyle='#0d0d0d';c.fillRect(0,0,w,h);
        c.fillStyle='rgba(255,255,255,0.06)';c.fillRect(0,0,w,h*.16);
        signText(c,'100',w*.11,h*.54,h*.62,'#ffb23c',null,w*.17);
        c.fillStyle='rgba(255,178,60,0.35)';c.fillRect(w*.215,h*.16,w*.007,h*.68);
        signText(c,'ALEXANDERPLATZ',w*.60,h*.54,h*.52,'#ffb23c',null,w*.72);
      },{wrap:false}):null;
      var roller=new THREE.MeshBasicMaterial({map:rollerTex,color:new THREE.Color(.95,.95,.95)});
      if(typeof markVehicleInk==='function')markVehicleInk(roller);
      // makeBus runs before the tram data is defined; the car materials exist.
      if(!makeCar.materials)makeCar(0xffffff);
      m=makeBus.materials={body:body,interior:body,glass:makeCar.materials.glass,lamp:makeCar.materials.lamp,
        interiorLight:makeCar.materials.lamp,tail:makeCar.materials.tail,destination:roller};
    }
    data.parts.forEach(function(part){
      var geometry=cached('reference_bus_v152_'+part.mesh,function(){
        return decodeBerlinMeshRecord(THREE,data.meshes[part.mesh]);
      });
      var mesh=new THREE.Mesh(geometry,m[part.role]);
      mesh.castShadow=part.role==='body';
      mesh.receiveShadow=part.role==='body'||part.role==='interior';
      mesh.userData.busRole=part.role;
      g.add(mesh);
    });
    freezeObjectTree(g, [], false);
    return registerProp('bus', g);
  }
