  function makeDeliveryMicrovan() {
    // V152 reference van (tools/stage_berlin_van_v152.py): a lacquered
    // Barkas B 1000 in cream over Kiez teal, one subdivision-surface body
    // with a split wrap-round windscreen and cab door windows recessed into
    // rubber seals, round chrome headlamps either side of a grille band, a
    // chrome bumper, shut lines, a parcel roundel and a lit cab. One baked
    // atlas (colour x occlusion) plus clearcoat/roughness/metalness; paint,
    // chrome and glass reflect the captured Kiez street. It keeps the car
    // obstacle's footprint (|x| <= 1, |z| <= 2.1, y <= 1.95).
    var data=BERLIN_REFERENCE_VAN_DATA,g=new THREE.Group(),m=makeDeliveryMicrovan.materials;
    if(!m){
      var vanTexture=function(uri,srgb){
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
      var albedo=vanTexture(data.textures.albedo,true),surface=vanTexture(data.textures.surface,false);
      albedo.name='Van V152 baked atlas';surface.name='Van V152 clearcoat, roughness and metalness';
      var body=new THREE.MeshPhysicalMaterial({color:0xffffff,map:albedo,roughness:1,metalness:1,
        roughnessMap:surface,metalnessMap:surface,clearcoat:1,clearcoatMap:surface,clearcoatRoughness:.10,
        envMap:env,envMapIntensity:1.12,dithering:true});
      if(typeof applyCelShading==='function')applyCelShading(body);
      // The van shares the car's glass, lamp and tail programs and materials.
      if(!makeCar.materials)makeCar(0xffffff);
      var car=makeCar.materials;
      m=makeDeliveryMicrovan.materials={body:body,glass:car.glass,lamp:car.lamp,amber:car.amber,tail:car.tail};
      if(typeof markVehicleInk==='function')markVehicleInk(body);
    }
    data.parts.forEach(function(part){
      var geometry=cached('reference_van_v152_'+part.mesh,function(){
        return decodeBerlinMeshRecord(THREE,data.meshes[part.mesh]);
      });
      var mesh=new THREE.Mesh(geometry,m[part.role]);
      mesh.castShadow=mesh.receiveShadow=part.role==='body';
      mesh.userData.vanRole=part.role;
      g.add(mesh);
    });
    freezeObjectTree(g,[],false);return registerProp('deliveryMicrovan',g);
  }

