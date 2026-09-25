"""Native editable scene for the accepted surface; never used as the runtime donor."""
import bpy, json, struct, math
from pathlib import Path
root=Path(__file__).resolve().parents[1]
stage=root/'audit/berlin-parity-v145'
source=stage/'courier-surface-v145-authoring.glb'
raw=source.read_bytes(); length=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+length]); binary=raw[28+length:]
primitive=doc['meshes'][0]['primitives'][0]
acc=doc['accessors'][primitive['attributes']['POSITION']]; view=doc['bufferViews'][acc['bufferView']]
offset=view.get('byteOffset',0)+acc.get('byteOffset',0)
positions=list(struct.iter_unpack('<fff',binary[offset:offset+acc['count']*12]))
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(source),merge_vertices=False)
meshes=[o for o in bpy.data.objects if o.type=='MESH' and len(o.data.vertices)==len(positions)]; assert len(meshes)==1, [(o.name,len(o.data.vertices)) for o in bpy.data.objects if o.type=='MESH']
obj=meshes[0]; assert len(obj.data.vertices)==len(positions)
# Blender imports glTF Y-up into Z-up and retains the donor's 0.01 object
# scale. Compare world-space mesh coordinates, without applying animation.
max_error=max(math.dist(tuple(obj.matrix_world @ v.co),(p[0],-p[2],p[1])) for v,p in zip(obj.data.vertices,positions))
assert max_error<2e-6, max_error
triangles=sum(len(p.vertices)-2 for p in obj.data.polygons); assert triangles==17999
rigs=[o for o in bpy.data.objects if o.type=='ARMATURE']; assert len(rigs)==1
assert len(bpy.data.actions)==len(doc['animations'])==15
for o in bpy.data.objects:
 o['surface_revision']='courier-surface-v145'
 if o.type=='MESH': o['runtime_source']='original hero + V97 + complete V114-format patch; do not apply patches again to this refined authoring mesh'
bpy.context.scene['source']='tools/stage_berlin_courier_native_v145.py'
target=stage/'models/berlin-courier-forms-v114.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(target))
report=dict(passed=True,vertices=len(positions),triangles=triangles,animations=len(bpy.data.actions),bones=len(rigs[0].data.bones),maxImportPositionError=max_error,source=str(source),target=str(target))
(stage/'native-check.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
