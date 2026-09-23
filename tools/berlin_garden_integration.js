// Embed berlin-kiez-garden-v1.inline.js and berlin_packed_geometry.js first.
// Lazy shared resources keep every street tree and every planter compatible
// with the existing chunk batches / world fixture instance pools.
function createBerlinGardenKit(THREE, makeMaterial, records) {
  var cache = Object.create(null);
  var atlas = null;
  if (records.atlas) {
    if (typeof document !== 'undefined') {
      // The data URI is embedded with the meshes. The game's LoadingManager
      // accounts for image decoding before its asset warm-up can complete.
      var manager = typeof assetManager !== 'undefined' ? assetManager : undefined;
      atlas = new THREE.TextureLoader(manager).load('data:' + records.atlas.mimeType + ';base64,' + records.atlas.data);
    } else {
      // Geometry-only tools have no DOM image decoder.
      atlas = new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1,THREE.RGBAFormat);
      atlas.needsUpdate = true;
    }
    atlas.name = 'Kiez linden leaf surface atlas';
    atlas.colorSpace = THREE.SRGBColorSpace;
    atlas.minFilter = THREE.LinearMipmapLinearFilter;
    atlas.magFilter = THREE.LinearFilter;
    atlas.generateMipmaps = true;
    atlas.anisotropy = 2;
  }
  var material = makeMaterial(0xffffff, {
    vertexColors:true, roughness:0.9, metalness:0,
    envMapIntensity:0.30, side:THREE.FrontSide, map:atlas
  });
  material.name = 'Kiez Blender garden';
  // Thin green foliage receives a restrained wrapped diffuse term while
  // bark, pots, flowers and specular response keep the native PBR equation.
  // directLight.color already contains the existing shadow/attenuation, so
  // leaves inside a shadow do not receive an unoccluded emissive substitute.
  if (typeof window === 'undefined' || !/(?:[?&])leaflight=0(?:&|$)/.test(window.location.search)) {
    var previousCompile=material.onBeforeCompile, previousKey=material.customProgramCacheKey;
    material.onBeforeCompile=function(shader,renderer) {
      if(previousCompile)previousCompile.call(this,shader,renderer);
      var diffuse='reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );';
      var source=THREE.ShaderChunk.lights_physical_pars_fragment;
      if(source.indexOf(diffuse)<0)return;
      source=source.replace(diffuse,[
        '#ifdef USE_COLOR',
        '  float leafMask = smoothstep(0.005, 0.055, vColor.g - vColor.r) * smoothstep(0.015, 0.07, vColor.g - vColor.b);',
        '  float leafWrap = saturate((dot(geometry.normal, directLight.direction) + 0.60) / 1.60);',
        '  float leafDiffuse = mix(dotNL, leafWrap, leafMask * 0.60);',
        '  reflectedLight.directDiffuse += leafDiffuse * directLight.color * BRDF_Lambert(material.diffuseColor);',
        // A broad backlit lobe gives thin leaves transmitted warmth. It uses
        // the already shadowed direct light, with no extra map or render pass.
        '  float leafThrough = saturate(dot(-geometry.viewDir, directLight.direction));',
        '  leafThrough *= leafThrough;',
        '  reflectedLight.directDiffuse += leafMask * leafThrough * (0.10 + 0.16 * (1.0 - dotNL)) * directLight.color * BRDF_Lambert(material.diffuseColor * vec3(1.10, 1.0, 0.48));',
        '#else',
        diffuse,
        '#endif'
      ].join('\n'));
      shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_pars_fragment>',source);
    };
    material.customProgramCacheKey=function(){return (previousKey?previousKey.call(this):'')+'|garden-leaf-light-v2';};
  }
  return {
    material:material,
    atlas:atlas,
    streetFarName:records.meshes.treeStreetFar ? 'treeStreetFar' : 'tree',
    geometry:function (name) {
      if (!cache[name]) cache[name] = decodeBerlinMeshRecord(THREE, records.meshes[name]);
      return cache[name];
    },
    // Street-only crowns can grow without resizing the background grove.
    // The exporter supplies a conservative horizontal envelope for every yaw.
    canopyRadius:records.streetCanopyRadius || 2.60
  };
}
if (typeof module !== 'undefined') module.exports = { createBerlinGardenKit:createBerlinGardenKit };
