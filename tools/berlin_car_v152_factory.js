  function makeCar(colorHex) {
    // V152 reference car (tools/stage_berlin_car_v152.py): a subdivision-
    // surface Trabant with a crowned bonnet, slim-pillared greenhouse,
    // recessed rubber-sealed glass over a simple cabin, chrome bumpers, pod
    // headlamps, stacked tail lamps and cream rims with chrome caps.
    // The paint is a clearcoated physical material over a baked occlusion
    // map; its colour is this call's colorHex (obstacles, recycled parked
    // cars) or, for the white pooled templates, each instance's colour.
    // Trim shares one baked atlas (clearcoat R, roughness G, metalness B).
    // Paint, chrome and glass reflect the captured Kiez street.
    var data=BERLIN_REFERENCE_CAR_DATA,g=new THREE.Group(),m=makeCar.materials;
    var env=typeof vehicleEnvTexture==='function'?vehicleEnvTexture():null;
    if(!m){
      var carTexture=function(uri,srgb){
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
      var paintShade=carTexture(data.textures.paint,true),trimAtlas=carTexture(data.textures.trim,true),
        trimSurface=carTexture(data.textures.surface,false);
      paintShade.name='Car V152 paint occlusion';trimAtlas.name='Car V152 trim atlas';
      trimSurface.name='Car V152 clearcoat, roughness and metalness';
      var trim=new THREE.MeshPhysicalMaterial({color:0xffffff,map:trimAtlas,roughness:1,metalness:1,
        roughnessMap:trimSurface,metalnessMap:trimSurface,clearcoat:1,clearcoatMap:trimSurface,
        clearcoatRoughness:.10,envMap:env,envMapIntensity:1.15,dithering:true});
      m=makeCar.materials={trim:trim,glass:vehicleGlass(0x1b2328,.55,env),
        lamp:vehicleLamp(1.18,1.14,1.05),amber:vehicleLamp(1.35,.62,.12),tail:vehicleLamp(1.1,.10,.06)};
      applyCelShading(trim);markVehicleInk(trim);
      // Paint shares the clearcoat/roughness/metalness-mapped program of the
      // trim, tram and van bodies through a uniform 1 px surface map.
      makeCar.paintSurface=vehicleSurfaceMap(1,.36,0);
      makeCar.paintShade=paintShade;
    }
    // Each car owns its paint so recycling can recolour it in place.
    var body=new THREE.MeshPhysicalMaterial({color:colorHex,map:makeCar.paintShade,roughness:1,metalness:1,
      roughnessMap:makeCar.paintSurface,metalnessMap:makeCar.paintSurface,clearcoat:1,clearcoatMap:makeCar.paintSurface,
      clearcoatRoughness:.10,envMap:env,envMapIntensity:1.1,dithering:true});
    applyCelShading(body);markVehicleInk(body);
    data.parts.forEach(function(part){
      var geometry=cached('reference_car_v152_'+part.mesh,function(){
        return decodeBerlinMeshRecord(THREE,data.meshes[part.mesh]);
      });
      var mesh=new THREE.Mesh(geometry,part.role==='paint'?body:m[part.role]);
      // The paint shell carries the car's shadow; trim (cabin, wheels, bumpers)
      // sits inside it, so skipping it halves the shadow-pass triangles.
      mesh.castShadow=part.role==='paint';
      mesh.receiveShadow=part.role==='paint'||part.role==='trim';
      mesh.userData.carRole=part.role;
      g.add(mesh);
    });
    // Material handles stay off JSON: Object3D.copy deep-copies userData with
    // JSON.stringify, which would serialise every texture on each pooled clone.
    [['bodyMat', body], ['glazingMat', m.glass], ['headlampMat', m.lamp], ['trimMat', m.trim]].forEach(function (e) {
      Object.defineProperty(g.userData, e[0], { value: e[1], writable: true, configurable: true, enumerable: false });
    });   // bodyMat is recoloured on recycle instead of rebuilt
    freezeObjectTree(g, [], false);
    return registerProp('trabant', g);
  }
