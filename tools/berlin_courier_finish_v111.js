// Reference outfit finish on the existing animated surface. No extra draw or
// texture sample: masks follow bind-space clothing through all fifteen clips.
function courierSleeveMaterial(material) {
  var previous = material.onBeforeCompile, previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = function (shader, renderer) {
    if (previous) previous.call(this, shader, renderer);
    shader.uniforms.courierSleeveColor = { value:new THREE.Color(0xc65a32) };
    shader.uniforms.courierSoleColor = { value:new THREE.Color(0xa18560) };
    shader.uniforms.courierTreadColor = { value:new THREE.Color(0xc6ab83) };
    shader.uniforms.courierHemColor = { value:new THREE.Color(0x99472e) };
    shader.uniforms.courierShoeColor = { value:new THREE.Color(0xe7ddc7) };
    shader.uniforms.courierHairColor = { value:new THREE.Color(0x352a23) };
    shader.uniforms.courierSkinColor = { value:new THREE.Color(0xe5ab84) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCourierSleeve;\nvarying float vCourierSleeve;\nattribute vec2 aCourierSole;\nvarying vec2 vCourierSole;\nattribute vec4 aCourierGarment;\nvarying vec4 vCourierGarment;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCourierSleeve = aCourierSleeve;\nvCourierSole = aCourierSole;\nvCourierGarment = aCourierGarment;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', [
        '#include <common>',
        'uniform vec3 courierSleeveColor; varying float vCourierSleeve;',
        'uniform vec3 courierSoleColor; uniform vec3 courierTreadColor; varying vec2 vCourierSole;',
        'uniform vec3 courierHemColor; uniform vec3 courierShoeColor;',
        'uniform vec3 courierHairColor; uniform vec3 courierSkinColor; varying vec4 vCourierGarment;'
      ].join('\n'))
      .replace('#include <map_fragment>', [
        '#include <map_fragment>',
        'vec3 courierSource = diffuseColor.rgb;',
        'float courierLuma = dot(courierSource, vec3(0.2126, 0.7152, 0.0722));',
        // Preserve the original UV clothing boundary, soften the donor's
        // mottled paint and let the actual sculpted folds carry the lighting.
        'float courierCloth = smoothstep(0.02, 0.10, courierSource.r - 2.4 * max(courierSource.g, courierSource.b));',
        'courierCloth *= smoothstep(-0.24, -0.19, vCourierGarment.x) * (1.0 - smoothstep(0.36, 0.45, vCourierGarment.x));',
        'float courierSleeve = smoothstep(0.12, 0.78, vCourierSleeve);',
        'vec3 courierCanvas = courierSleeveColor * clamp(courierLuma / 0.15, 0.92, 1.06);',
        'diffuseColor.rgb = mix(diffuseColor.rgb, courierCanvas, courierCloth * 0.88);',
        'diffuseColor.rgb = mix(diffuseColor.rgb, courierSleeveColor, courierSleeve);',
        // Pushed-up sleeves expose the existing forearm. Keep its authored
        // skin paint where present; the fallback handles a sleeve UV island.
        'float courierForearm = (1.0 - smoothstep(0.112, 0.126, vCourierGarment.y)) * courierSleeve;',
        'float courierSkinPaint = smoothstep(0.27, 0.40, courierSource.g / max(courierSource.r, 0.001)) * smoothstep(0.22, 0.42, courierSource.r);',
        'diffuseColor.rgb = mix(diffuseColor.rgb, mix(courierSkinColor, courierSource, courierSkinPaint), courierForearm);',
        'float courierHem = courierCloth * smoothstep(-0.180, -0.165, vCourierGarment.x) * (1.0 - smoothstep(-0.115, -0.105, vCourierGarment.x));',
        'float courierCuff = smoothstep(0.119, 0.126, vCourierGarment.y) * (1.0 - smoothstep(0.151, 0.162, vCourierGarment.y)) * courierSleeve;',
        'diffuseColor.rgb = mix(diffuseColor.rgb, courierHemColor, max(courierHem, courierCuff));',
        // The donor's patterned rear headwear becomes quiet dark hair beneath
        // the baseball cap; front facial paint and ears are outside the mask.
        'diffuseColor.rgb = mix(diffuseColor.rgb, courierHairColor * (0.94 + 0.12 * smoothstep(0.02, 0.40, courierLuma)), vCourierGarment.z);',
        'vec3 courierSneaker = courierShoeColor * (0.80 + 0.20 * smoothstep(0.025, 0.60, courierLuma));',
        'diffuseColor.rgb = mix(diffuseColor.rgb, courierSneaker, vCourierGarment.w);',
        'float courierTread = 1.0 - smoothstep(0.28, 0.40, abs(fract(vCourierSole.y * 5.0) - 0.5));',
        'vec3 courierRubber = mix(courierSoleColor, courierTreadColor, courierTread * 0.72);',
        'diffuseColor.rgb = mix(diffuseColor.rgb, courierRubber, smoothstep(0.08, 0.70, vCourierSole.x));'
      ].join('\n'));
    if (typeof canvas !== 'undefined' && canvas.dataset) canvas.dataset.courierFinish = 'reference-outfit-v111';
  };
  material.customProgramCacheKey = function () {
    return 'courierReferenceOutfitV111|' + (previousKey ? previousKey.call(material) : '');
  };
  material.needsUpdate = true;
}
