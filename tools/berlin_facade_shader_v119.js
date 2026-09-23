// Extend the single atlas material. No reflection render, additional texture
// lookup, transparent surface or per-building material is introduced.
function applyBerlinFacadeFinishShader(THREE, material) {
  var previousCompile=material.onBeforeCompile,previousKey=material.customProgramCacheKey;
  material.onBeforeCompile=function(shader,renderer){
    if(previousCompile)previousCompile.call(this,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('float kiezEdge=min(',[
      // Sparse smooth modulation reads as painted plaster at building scale.
      // Two analytic bands avoid a texture lookup and noisy fine grain.
      // Each atlas region occupies whole coherent triangles. Keep glass math
      // off the much larger plaster, trim, roof and foliage surfaces.
      'if(kiezPane+kiezRoom>0.5){',
      'float kiezDiagonal=kiezLocal.x*0.65+kiezLocal.y;',
      'float kiezSheen=smoothstep(0.57,0.76,kiezDiagonal)*(1.0-smoothstep(0.94,1.14,kiezDiagonal));',
      'if(kiezPane>0.5){',
      'float kiezPaneSky=smoothstep(0.10,0.98,kiezLocal.y);',
      'vec3 kiezSkyTint=mix(vec3(0.30,0.28,0.20),vec3(0.32,0.48,0.57),kiezPaneSky);',
      'diffuseColor.rgb=mix(diffuseColor.rgb,kiezSkyTint,0.16+0.10*kiezSheen);',
      'diffuseColor.rgb+=vec3(0.075,0.050,0.022)*vColor.a*(1.0-kiezPaneSky);',
      '}else{diffuseColor.rgb+=vec3(0.045,0.061,0.064)*kiezSheen;}',
      '}',
      'float kiezEdge=min('
    ].join('\n'));
    shader.fragmentShader=shader.fragmentShader.replace('totalEmissiveRadiance+=diffuseColor.rgb*kiezShop*0.46;',[
      'if(kiezShop>0.5){',
      'totalEmissiveRadiance+=diffuseColor.rgb*vec3(0.68,0.59,0.46);',
      // Warm dark room texels without bleaching bright books and lamps.
      'vec3 kiezRoomBounce=max(vec3(0.10,0.060,0.025)-diffuseColor.rgb*0.22,vec3(0.0));',
      'totalEmissiveRadiance+=kiezRoomBounce;',
      '}',
      // Deep brown arch returns use plaster/white atlas cells. Select their
      // dark warm vertex paint; pale stone and teal exterior joinery stay out.
      'totalEmissiveRadiance+=vColor.a*(1.0-step(1.5,kiezPaintTile))*vec3(0.16,0.105,0.047);'
    ].join('\n'));
  };
  material.customProgramCacheKey=function(){return (previousKey?previousKey.call(this):'')+'|kiez-facade-finish-v119-color';};
}
if (typeof module !== 'undefined') module.exports = {applyBerlinFacadeFinishShader:applyBerlinFacadeFinishShader};
