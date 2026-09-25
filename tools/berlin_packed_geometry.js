// Small, synchronous decoder for Blender-exported static mesh records.
// Records use base64 little-endian arrays. Position/UV retain float32 accuracy;
// normals use normalized int16 and linear vertex colors use normalized bytes.
// V152 records may instead carry quantised positionQ (int16 about qCenter with
// qHalf extents) and uvQ (uint16 over uvMin + uvRange); both expand to float32.
function decodeBerlinMeshRecord(THREE, record) {
  function unpack(encoded, Type) {
    var raw = atob(encoded), bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new Type(bytes.buffer);
  }
  function expand(q, size, base, span, one) {
    var out = new Float32Array(q.length);
    for (var i = 0; i < q.length; i++) out[i] = base[i % size] + q[i] * span[i % size] / one;
    return out;
  }
  var geometry = new THREE.BufferGeometry();
  var position = record.positionQ ? expand(unpack(record.positionQ, Int16Array), 3, record.qCenter, record.qHalf, 32767) :
    unpack(record.position, Float32Array);
  geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
  if (record.normal) geometry.setAttribute('normal', new THREE.BufferAttribute(unpack(record.normal, Int16Array), 3, true));
  if (record.color) geometry.setAttribute('color', new THREE.BufferAttribute(unpack(record.color, Uint8Array), 3, true));
  if (record.uvQ) geometry.setAttribute('uv', new THREE.BufferAttribute(expand(unpack(record.uvQ, Uint16Array), 2, record.uvMin, record.uvRange, 65535), 2));
  else if (record.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(unpack(record.uv, Float32Array), 2));
  geometry.setIndex(new THREE.BufferAttribute(unpack(record.index, record.vertices > 65535 ? Uint32Array : Uint16Array), 1));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
if (typeof module !== 'undefined') module.exports = { decodeBerlinMeshRecord: decodeBerlinMeshRecord };
