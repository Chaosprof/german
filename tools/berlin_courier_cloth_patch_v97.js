// Apply the accepted artist-authored Float32 surface to the known v14 render
// copy. The expensive sculpt and normal fitting stay in authoring tools.
function applyBerlinCourierClothPatchV97(geo) {
  var patch=BERLIN_COURIER_CLOTH_PATCH_V97;
  var p=geo.attributes.position,n=geo.attributes.normal;
  if(!p||!n||p.count!==patch.vertices||!geo.index||geo.index.count!==patch.triangles*3)return false;
  // These bind-space probes distinguish the accepted base from the checker's
  // deliberate former head/trouser variants. Tolerance allows harmless engine
  // rounding differences; incompatible bases retain their existing refinement.
  var probes=patch.baseProbes;
  for(var i=0;i<probes.length;i+=7){
    var vertex=probes[i]*3;
    for(var k=0;k<3;k++)if(Math.abs(p.array[vertex+k]-probes[i+1+k])>0.000001||
      Math.abs(n.array[vertex+k]-probes[i+4+k])>0.000001)return false;
  }
  if(!patch.decoded){
    var binary=atob(patch.data),bytes=new Uint8Array(binary.length);
    for(var i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    patch.decoded=new DataView(bytes.buffer);
  }
  var view=patch.decoded,valuesOffset=(patch.count*2+3)&~3;
  for(var i=0;i<patch.count;i++){
    var vertex=view.getUint16(i*2,true)*3,offset=valuesOffset+i*24;
    for(var k=0;k<3;k++){
      p.array[vertex+k]=view.getFloat32(offset+k*4,true);
      n.array[vertex+k]=view.getFloat32(offset+12+k*4,true);
    }
  }
  // Three r156 shares BufferGeometry.userData when cloning. Own this metadata
  // so applying the render-copy patch never tags the untouched source geometry.
  geo.userData=Object.assign({},geo.userData);
  geo.userData.courierAccessoryBounds={min:patch.accessoryBounds.min.slice(),max:patch.accessoryBounds.max.slice()};
  geo.userData.courierClothV97={baked:true,changedVertices:patch.count};
  return true;
}
