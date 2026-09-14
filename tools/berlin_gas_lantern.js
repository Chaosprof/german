// Authored runtime geometry source, mirrored in berlin-runner.html.
function makeKiezStreetLamp() {
  var g = new THREE.Group();
  var ironGeo = cached('kiez_gas_lantern_iron_v1', function () {
    var positions = [], normals = [], uvs = [];
    function append(geometry, x, y, z, rotation) {
      if (rotation) geometry.rotateY(rotation);
      geometry.translate(x || 0, y || 0, z || 0);
      var flat = geometry.index ? geometry.toNonIndexed() : geometry;
      Array.prototype.push.apply(positions, flat.attributes.position.array);
      Array.prototype.push.apply(normals, flat.attributes.normal.array);
      Array.prototype.push.apply(uvs, flat.attributes.uv.array);
      if (flat !== geometry) flat.dispose();
      geometry.dispose();
    }
    // Continuous cast-iron profile: narrow foot flutes, raised collars and
    // long taper. Twelve radial facets keep every ring in one shared draw.
    var profile = [[.24,0],[.24,.06],[.215,.085],[.205,.14],[.155,.18],
      [.13,.72],[.15,.78],[.15,.85],[.105,.90],[.087,1.02],
      [.060,4.90],[.092,4.98],[.092,5.05],[.075,5.10],
      [.075,5.22],[.12,5.28],[.12,5.32],[.175,5.36],[.19,5.42]];
    var shaft = new THREE.LatheGeometry(profile.map(function (p) { return new THREE.Vector2(p[0], p[1]); }),12);
    var shaftPos = shaft.attributes.position;
    for (var si=0; si<shaftPos.count; si++) {
      var sy=shaftPos.getY(si), radial=Math.floor(si/profile.length);
      if (sy>=.179 && sy<=.721 && radial%2) {
        shaftPos.setX(si,shaftPos.getX(si)*.86);
        shaftPos.setZ(si,shaftPos.getZ(si)*.86);
      }
    }
    shaft.computeVertexNormals(); append(shaft,0,0,0);
    // The grounded plinth and square pane rims close the profile ends.
    append(new THREE.CylinderGeometry(.24,.24,.012,12),0,.006,0);
    append(new THREE.CylinderGeometry(.222,.222,.04,4),0,5.46,0,Math.PI/4);
    append(new THREE.CylinderGeometry(.315,.315,.035,4),0,6.08,0,Math.PI/4);
    for (var mi=0; mi<4; mi++) {
      var angle=Math.PI/4+mi*Math.PI/2;
      var lower=new THREE.Vector3(Math.sin(angle)*.211,5.465,Math.cos(angle)*.211);
      var upper=new THREE.Vector3(Math.sin(angle)*.302,6.08,Math.cos(angle)*.302);
      var direction=upper.clone().sub(lower), midpoint=upper.clone().add(lower).multiplyScalar(.5);
      var bar=new THREE.CylinderGeometry(.013,.016,direction.length(),4);
      bar.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize()));
      append(bar,midpoint.x,midpoint.y,midpoint.z);
    }
    // A shallow hipped lid, little vent and pointed finial replace the
    // globe and overhanging arm while preserving the original height budget.
    append(new THREE.CylinderGeometry(.055,.345,.205,4),0,6.195,0,Math.PI/4);
    append(new THREE.CylinderGeometry(.041,.055,.10,6),0,6.345,0);
    append(new THREE.SphereGeometry(.052,8,4),0,6.411,0);
    append(new THREE.ConeGeometry(.025,.07,6),0,6.463,0);
    var geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  });
  var iron=new THREE.Mesh(ironGeo,MAT.metalDark);
  iron.castShadow=true; iron.receiveShadow=true; g.add(iron);
  // Only street-lamp heads use this material. Retain its identity for the
  // existing daylight emissive writer, and make warm panes fully poolable.
  MAT.lampGlobe.transparent=false; MAT.lampGlobe.opacity=1; MAT.lampGlobe.depthWrite=true;
  var bulb=new THREE.Mesh(cached('kiez_gas_lantern_panes_v1',function () {
    var panes=new THREE.CylinderGeometry(.29,.20,.60,4);
    panes.rotateY(Math.PI/4); panes.translate(0,5.77,0);
    return panes;
  }),MAT.lampGlobe);
  g.add(bulb);
  var cone=new THREE.Mesh(cached('lampcone',function () {
    return new THREE.ConeGeometry(1.7,5.2,12,1,true);
  }),lampConeMat);
  cone.position.set(0,3.17,0); g.add(cone);
  var flagStub=new THREE.Mesh(cylGeo(.018,.018,.30,6),MAT.metalDark);
  flagStub.rotation.z=Math.PI/2; flagStub.position.set(.18,4.78,0);
  flagStub.userData.noStaticMerge=true; g.add(flagStub);
  var flag=new THREE.Mesh(flagGeo,FLAG_MATS[0]);
  flag.position.set(.32,4.78,0); flag.userData.noStaticMerge=true; g.add(flag);
  g.userData.bulb=bulb; g.userData.cone=cone;
  g.userData.flag=flag; g.userData.flagStub=flagStub;
  g.userData.gasLantern=true;
  return registerProp('lamp',g);
}
