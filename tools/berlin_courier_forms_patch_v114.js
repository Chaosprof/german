function applyBerlinCourierFormsPatchV114(geo) {
  var patch=BERLIN_COURIER_FORMS_PATCH_V114,p=geo.attributes.position,n=geo.attributes.normal;
  if(!p||!n||p.count!==patch.vertices||!geo.userData.courierClothV97||!geo.userData.courierClothV97.baked)return false;
  for(var k=0;k<patch.baseProbes.length;k+=7){
    var i=patch.baseProbes[k];
    for(var c=0;c<3;c++)if(Math.abs(p.getComponent(i,c)-patch.baseProbes[k+1+c])>1e-7||Math.abs(n.getComponent(i,c)-patch.baseProbes[k+4+c])>1e-7)return false;
  }
  if(!patch.decoded){
    var raw=atob(patch.data),bytes=new Uint8Array(raw.length);
    for(var k=0;k<raw.length;k++)bytes[k]=raw.charCodeAt(k);
    patch.decoded={ids:new Uint16Array(bytes.buffer,0,patch.count),values:new Float32Array(bytes.buffer,(patch.count*2+3)&~3)};
  }
  var ids=patch.decoded.ids,v=patch.decoded.values;
  for(var k=0;k<patch.count;k++){
    var i=ids[k],at=k*6;p.setXYZ(i,v[at],v[at+1],v[at+2]);n.setXYZ(i,v[at+3],v[at+4],v[at+5]);
  }
  p.needsUpdate=true;n.needsUpdate=true;geo.userData.courierFormsV114={baked:true,vertices:patch.count};
  return true;
}
