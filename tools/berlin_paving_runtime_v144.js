// Prebaked joint slopes decode through the loading manager before gameplay.
function beginReferencePavingReliefV144() {
  var resources={normal:null,shade:null,failed:false,listener:null};
  function changed(){if(resources.listener)resources.listener();}
  function loaded(key,t){if(resources.failed){t.dispose();return;}resources[key]=t;changed();}
  function failed(){resources.failed=true;changed();}
  texLoader.load(BERLIN_PAVING_NORMAL_V144,function(t){loaded('normal',t);},undefined,failed);
  texLoader.load(BERLIN_PAVING_SHADE_V144,function(t){loaded('shade',t);},undefined,failed);
  return resources;
}
function applyReferencePavingReliefV144(material,paving,roadTexture,resources) {
  var loadStart=performance.now(),finished=false;
  function fallback(){
    if(finished)return;finished=true;
    if(resources.normal)resources.normal.dispose();if(resources.shade)resources.shade.dispose();
    if(material.normalMap)material.normalMap.dispose();
    if(material.roughnessMap)material.roughnessMap.dispose();
    relief(material,paving,.45,.68,.88);
    [material.normalMap,material.roughnessMap].forEach(function(t){t.wrapS=t.wrapT=THREE.MirroredRepeatWrapping;t.repeat.copy(roadTexture.repeat);});
    canvas.dataset.pavingRelief='fallback';
  }
  function ready(){
    if(finished||!resources.normal||!resources.shade)return;finished=true;
    var normalTexture=resources.normal,shadeTexture=resources.shade;
    var started=performance.now();
    if(material.normalMap)material.normalMap.dispose();
    if(material.roughnessMap)material.roughnessMap.dispose();
    material.roughnessMap=roughMapFrom(lumaField(paving),.68,.88);
    var cv=document.createElement('canvas');cv.width=cv.height=1024;
    var g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(paving,0,0,1024,1024);
    g.drawImage(shadeTexture.image,0,0);roadTexture.image=cv;roadTexture.needsUpdate=true;
    shadeTexture.dispose();
    material.normalMap=normalTexture;
    normalTexture.colorSpace=THREE.LinearSRGBColorSpace;normalTexture.anisotropy=MAX_ANISO;
    normalTexture.wrapS=normalTexture.wrapT=THREE.RepeatWrapping;
    normalTexture.repeat.copy(roadTexture.repeat).multiplyScalar(.5);
    material.normalScale=new THREE.Vector2(1,.72);
    material.roughnessMap.wrapS=material.roughnessMap.wrapT=THREE.MirroredRepeatWrapping;
    material.roughnessMap.repeat.copy(roadTexture.repeat);
    material.roughness=1;material.needsUpdate=true;
    canvas.dataset.pavingRelief='joint-height-v144';
    canvas.dataset.pavingReliefMs=(performance.now()-started).toFixed(1);
    canvas.dataset.pavingReliefLoadMs=(performance.now()-loadStart).toFixed(1);
  }
  resources.listener=function(){if(resources.failed)fallback();else ready();};
  resources.listener();
}
