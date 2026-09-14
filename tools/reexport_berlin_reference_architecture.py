"""Re-export artist edits from the saved architecture .blend into game + GLB.

Blender 5.2's material graph detector misses the vertex-color Multiply node.
The named-layer export makes the painted/baked Color attribute the COLOR_0
channel that glTF's base-color formula actually multiplies by the atlas.
"""
import bpy,os,json,sys,hashlib
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT=os.path.join(ROOT,'assets','models')
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from berlin_mesh_pack import packed_geometry
json_path=os.path.join(OUT,'berlin-reference-architecture-v1.json')
with open(json_path,'rb') as f: previous_bytes=f.read()
previous=json.loads(previous_bytes)
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.blend'))
bpy.context.preferences.filepaths.save_version=0
objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('runtime_key')]
objects_by_key={o['runtime_key']:o for o in objects}
assert len(objects_by_key)==len(objects),'Each architecture object needs a unique runtime_key'
missing=set(previous['meshes'])-set(objects_by_key)
assert not missing,('Missing authored runtime modules',sorted(missing))
# Keep the stable existing module order, followed by any intentionally added
# modules. Editable object transforms are only the Blender asset-sheet layout.
keys=list(previous['meshes'])+sorted(set(objects_by_key)-set(previous['meshes']))
objects=[objects_by_key[key] for key in keys]
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    assert 'Color' in obj.data.color_attributes,obj.name
    index=obj.data.color_attributes.find('Color')
    obj.data.color_attributes.active_color_index=index
    obj.data.color_attributes.render_color_index=index
    obj.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
# Evaluate modifiers on temporary meshes. Manual mesh edits, UV changes,
# painted colors and modifiers now reach the game without the JS rebuild
# overwriting the artist's work or rebaking existing contact shading.
depsgraph=bpy.context.evaluated_depsgraph_get()
records={}
for key in keys:
    obj=objects_by_key[key];evaluated=obj.evaluated_get(depsgraph)
    mesh=evaluated.to_mesh(preserve_all_data_layers=True,depsgraph=depsgraph)
    try: records[key]=packed_geometry(obj,mesh)
    finally: evaluated.to_mesh_clear()
updated=dict(previous);updated['meshes']=records
updated_bytes=json.dumps(updated,separators=(',',':')).encode('utf8')
with open(json_path,'wb') as f:f.write(updated_bytes)
with open(os.path.join(OUT,'berlin-reference-architecture-v1.inline.js'),'w',encoding='utf8') as f:
    f.write('var BERLIN_REFERENCE_ARCHITECTURE = '+updated_bytes.decode('utf8')+';\n')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.glb'),
    use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True,
    export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=False,export_extras=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.blend'))
changes={key:{'before_triangles':previous['meshes'].get(key,{}).get('triangles'),
    'after_triangles':records[key]['triangles'],'before_vertices':previous['meshes'].get(key,{}).get('vertices'),
    'after_vertices':records[key]['vertices'],'changed':previous['meshes'].get(key)!=records[key]} for key in keys}
report={'objects':len(objects),'vertex_color':'Color -> COLOR_0','rebaked':False,
    'runtime_json_identical':previous_bytes==updated_bytes,'before_sha256':hashlib.sha256(previous_bytes).hexdigest(),
    'after_sha256':hashlib.sha256(updated_bytes).hexdigest(),'modules':changes}
with open(os.path.join(ROOT,'audit','berlin-reference-roundtrip-validation.json'),'w') as f:json.dump(report,f,indent=2)
print('REFERENCE_ARCHITECTURE_REEXPORT_COMPLETE',json.dumps(report),flush=True)
