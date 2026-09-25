// Deduplicate bit-identical complete vertex records once, before GPU upload.
// Triangle order, seams, hard normals, atlas UVs and baked RGBA stay exact.
function compactBerlinKiezVerticesV150(THREE,g){
  if(g.userData.verticesCompactedV150)return g;
  var names=Object.keys(g.attributes),count=g.attributes.position.count;
  var fields=names.map(function(name){var a=g.attributes[name];return {name:name,a:a,raw:a.array instanceof Float32Array?new Uint32Array(a.array.buffer,a.array.byteOffset,a.array.length):a.array};});
  var imul=Math.imul;
  var heads=new Map(),next=new Int32Array(count),representative=new Uint32Array(count),remap=new Uint32Array(count),unique=0;
  for(var i=0;i<count;i++){
    var hash=2166136261;
    for(var f=0;f<fields.length;f++){var field=fields[f],size=field.a.itemSize;for(var k=0;k<size;k++)hash=imul(hash^field.raw[i*size+k],16777619);}
    var bucket=heads.get(hash),match=-1;
    for(var candidate=bucket===undefined?-1:bucket;candidate>=0;candidate=next[candidate]){
      var old=representative[candidate],equal=true;
      for(var f=0;f<fields.length&&equal;f++){var field=fields[f],size=field.a.itemSize;for(var k=0;k<size;k++)if(field.raw[i*size+k]!==field.raw[old*size+k]){equal=false;break;}}
      if(equal){match=candidate;break;}
    }
    if(match<0){match=unique++;representative[match]=i;next[match]=bucket===undefined?-1:bucket;heads.set(hash,match);}
    remap[i]=match;
  }
  for(var f=0;f<fields.length;f++){
    var field=fields[f],a=field.a,packed=new a.array.constructor(unique*a.itemSize);
    var raw=packed instanceof Float32Array?new Uint32Array(packed.buffer):packed;
    for(var i=0;i<unique;i++)for(var k=0;k<a.itemSize;k++)raw[i*a.itemSize+k]=field.raw[representative[i]*a.itemSize+k];
    var attribute=new THREE.BufferAttribute(packed,a.itemSize,a.normalized);attribute.name=a.name;attribute.setUsage(a.usage);g.setAttribute(field.name,attribute);
  }
  var source=g.index.array,Index=unique>65535?Uint32Array:Uint16Array,indices=new Index(source.length);
  for(var i=0;i<source.length;i++)indices[i]=remap[source[i]];
  g.setIndex(new THREE.BufferAttribute(indices,1));
  g.userData.verticesCompactedV150={before:count,after:unique};
  return g;
}
