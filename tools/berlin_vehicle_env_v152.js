  // V152 vehicle reflections. Paint, chrome and glass on the tram and cars
  // mirror a panorama of the Kiez street captured from the game itself
  // (assets/img/berlin-street-env-v1.jpg; tools/capture_berlin_street_env.mjs):
  // real facades, awnings, trees and sky instead of the synthetic daylight
  // probe above, which is what gives the reference's lacquer its depth.
  // The PMREM target is allocated once from a same-sized placeholder, so every
  // vehicle program compiles against it at load; the decoded JPEG is filtered
  // into that same target by the same generator (which owns the blur targets)
  // and no program ever recompiles mid-run.
  var VEHICLE_ENV_URL = 'assets/img/berlin-street-env-v1.jpg';
  var vehicleEnvTarget = null;
  function vehicleEnvTexture() {
    if (vehicleEnvTarget) return vehicleEnvTarget.texture;
    if (typeof document === 'undefined' || typeof renderer === 'undefined') return null;
    var pmrem = null;
    try {
      // Same 1024 x 512 size as the panorama: PMREM sizes its cube from the
      // source width, and the refill must land in an identical layout.
      var w = 1024, h = 512, px = new Uint8Array(w * h * 4);
      for (var y = 0; y < h; y++) {
        var t = y / (h - 1), sky = t > 0.5, k = sky ? (t - 0.5) * 2 : (0.5 - t) * 2;
        var r = sky ? 190 - 70 * k : 150 - 40 * k, gg = sky ? 205 - 45 * k : 146 - 38 * k, b = sky ? 222 - 10 * k : 150 - 30 * k;
        for (var x = 0; x < w; x++) { var o = (y * w + x) * 4; px[o] = r; px[o + 1] = gg; px[o + 2] = b; px[o + 3] = 255; }
      }
      var seed = new THREE.DataTexture(px, w, h, THREE.RGBAFormat);
      seed.colorSpace = THREE.SRGBColorSpace; seed.mapping = THREE.EquirectangularReflectionMapping;
      seed.needsUpdate = true;
      pmrem = new THREE.PMREMGenerator(renderer);
      vehicleEnvTarget = pmrem.fromEquirectangular(seed);
      vehicleEnvTarget.texture.name = 'Kiez street reflection (vehicles)';
      seed.dispose();
    } catch (e) {
      if (pmrem) pmrem.dispose();
      vehicleEnvTarget = null;
      return null;
    }
    new THREE.TextureLoader(assetManager).load(VEHICLE_ENV_URL, function (tex) {
      try {
        tex.colorSpace = THREE.SRGBColorSpace; tex.mapping = THREE.EquirectangularReflectionMapping;
        if (tex.image && tex.image.width === 1024) pmrem.fromEquirectangular(tex, vehicleEnvTarget);
      } catch (e) { /* the placeholder sky remains a valid reflection */ }
      tex.dispose(); pmrem.dispose();
    }, undefined, function () { pmrem.dispose(); });
    return vehicleEnvTarget.texture;
  }
  // The reference renders its tram as a smooth lacquered model: soft shading,
  // no ink. Vehicle materials write alpha 0 into the scene target (nothing
  // else reads that channel) and the composite drops the ink line on and
  // around those pixels; see vehicleInkMask in the composite shader.
  function markVehicleInk(material) {
    var prev = material.onBeforeCompile;
    material.onBeforeCompile = function (shader, r) {
      if (prev) prev.call(this, shader, r);
      shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\n\tgl_FragColor.a = 0.0;');
    };
    var prevKey = material.customProgramCacheKey;
    material.customProgramCacheKey = function () {
      return 'vehicle-ink-mask|' + (prevKey ? prevKey.call(material) : '');
    };
    return material;
  }
  // Shared helpers keep the vehicles on as few shader programs as possible:
  // every lamp is a MeshBasicMaterial with a (white) map, like the destination
  // rollers, and every pane uses one street-glass program with its own
  // transparency uniform.
  var vehicleWhiteTex = null;
  function vehicleWhiteMap() {
    if (!vehicleWhiteTex) {
      vehicleWhiteTex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
      vehicleWhiteTex.colorSpace = THREE.SRGBColorSpace; vehicleWhiteTex.needsUpdate = true;
      vehicleWhiteTex.name = 'Vehicle lamp white';
    }
    return vehicleWhiteTex;
  }
  function vehicleLamp(r, g, b) {
    return markVehicleInk(new THREE.MeshBasicMaterial({ map: vehicleWhiteMap(), color: new THREE.Color(r, g, b) }));
  }
  function vehicleSurfaceMap(clearcoat, roughness, metalness) {
    var t = new THREE.DataTexture(new Uint8Array([Math.round(clearcoat * 255), Math.round(roughness * 255),
      Math.round(metalness * 255), 255]), 1, 1, THREE.RGBAFormat);
    t.colorSpace = THREE.NoColorSpace; t.needsUpdate = true;
    return t;
  }
  function vehicleGlass(tint, base, env) {
    // The cabin shows through head-on while the street reflection is added at
    // full strength (premultiplied blend), strongest at grazing angles. The
    // alpha blend keeps the scene target's vehicle mask intact.
    var glass = new THREE.MeshStandardMaterial({ color: tint, roughness: .035, metalness: 0,
      envMap: env, envMapIntensity: 1.6, transparent: true, opacity: 1, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
    glass.userData.glassBase = { value: base };
    glass.onBeforeCompile = function (shader) {
      shader.uniforms.uGlassBase = glass.userData.glassBase;
      shader.fragmentShader = 'uniform float uGlassBase;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', [
        'vec3 glassN=normalize(normal),glassV=normalize(vViewPosition);',
        'float glassFacing=clamp(abs(dot(glassN,glassV)),0.0,1.0);',
        'float glassA=mix(uGlassBase,0.94,pow(1.0-glassFacing,1.6));',
        'vec3 glassSpec=reflectedLight.directSpecular+reflectedLight.indirectSpecular;',
        'vec3 glassBody=reflectedLight.directDiffuse+reflectedLight.indirectDiffuse;',
        'gl_FragColor=vec4(glassBody*glassA+glassSpec*2.2,glassA);'].join('\n'));
    };
    glass.customProgramCacheKey = function () { return 'vehicle-street-glass-v152'; };
    return glass;
  }
