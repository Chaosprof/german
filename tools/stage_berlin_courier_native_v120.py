"""Save the independently validated complete courier sculpt as an editable scene.

The gameplay GLB stays untouched. Runtime still applies V97 and the complete
V114-format patch once; importing this authoring scene is not a runtime step.
"""
import bpy
from pathlib import Path
root=Path(__file__).resolve().parents[1]
stage=root/'audit/berlin-parity-courier-v120/shoes'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(stage/'courier-forms-v114-authoring.glb'),merge_vertices=False)
for obj in bpy.data.objects:
    obj['finish_revision']='courier-sneaker-v120'
    if obj.type=='MESH':obj['runtime_source']='original hero + V97 cloth + complete V114-format patch; do not apply patches to this already refined authoring mesh'
bpy.context.scene['source']='tools/stage_berlin_courier_native_v120.py'
bpy.ops.wm.save_as_mainfile(filepath=str(stage/'courier-forms-v114.blend'))
print('Saved editable V120 courier scene with imported original rig and animations.')
