// Small, synchronous decoder for Blender-exported static mesh records.
// Records use base64 little-endian arrays. Position/UV retain float32 accuracy;
// normals use normalized int16 and linear vertex colors use normalized bytes.
function decodeBerlinMeshRecord(THREE, record) {
  function unpack(encoded, Type) {
    var raw = atob(encoded), bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new Type(bytes.buffer);
  }
  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(unpack(record.position, Float32Array), 3));
  if (record.normal) geometry.setAttribute('normal', new THREE.BufferAttribute(unpack(record.normal, Int16Array), 3, true));
  if (record.color) geometry.setAttribute('color', new THREE.BufferAttribute(unpack(record.color, Uint8Array), 3, true));
  if (record.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(unpack(record.uv, Float32Array), 2));
  geometry.setIndex(new THREE.BufferAttribute(unpack(record.index, record.vertices > 65535 ? Uint32Array : Uint16Array), 1));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
if (typeof module !== 'undefined') module.exports = { decodeBerlinMeshRecord: decodeBerlinMeshRecord };
