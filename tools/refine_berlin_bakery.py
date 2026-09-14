"""Replace only bakery forms in the editable Blender kit and shipped meshes.

The shared structural polish and contact bake come from the canonical builder.
Bookstore objects, materials, mesh records and authored edits remain intact.
Run export_kiez_architecture_source.cjs before this script.
"""
import ast, bpy, bmesh, json, os, math, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'models')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from berlin_mesh_pack import packed_geometry as packed

with open(os.path.join(ROOT, '.tmp', 'kiez-architecture-source.json')) as f:
    source = json.load(f)
with open(os.path.join(OUT, 'berlin-reference-architecture-v1.json')) as f:
    data = json.load(f)
before = dict(data['meshes'])
# Measured shipped v65 forms before this bounded rebuild. Re-running a polish
# must not reset the agreed +2,500 triangle budget to its preceding bake.
triangle_baseline = {'11': 17783, '13.5': 18087, '16': 20260}
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT, 'berlin-reference-architecture-v1.blend'))
bpy.context.preferences.filepaths.save_version = 0
objects_by_key = {obj['runtime_key']: obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.get('runtime_key')}
mat = objects_by_key['13.5:0:1'].data.materials[0]
builder_path = os.path.join(ROOT, 'tools', 'build_berlin_reference_architecture.py')
with open(builder_path, encoding='utf8') as f:
    builder_tree = ast.parse(f.read(), filename=builder_path)
polish_ast = next(node for node in builder_tree.body if isinstance(node, ast.FunctionDef) and node.name == 'polish')
exec(compile(ast.Module(body=[polish_ast], type_ignores=[]), builder_path, 'exec'), globals())

report = {'changed_modules': {}, 'bookstore_unchanged': True, 'ground_storey_height': 6.0,
          'canopy_back_height': 5.65, 'canopy_front_height': 3.85, 'canopy_projection': 2.185,
          'upper_corner_radius': 1.95, 'materials_added': 0}
items = [item for item in source['modules'] if item['variant'] == 0]
items.sort(key=lambda item: item['name'] != '13.5:0:1')
for item in items:
    key = item['name']
    old_obj = objects_by_key[key]
    old_name, old_location = old_obj.name, old_obj.location.copy()
    obj = polish(item)
    record = packed(obj)
    delta = record['triangles'] - before[key]['triangles']
    baseline_delta = record['triangles'] - triangle_baseline[key.split(':')[0]]
    assert record['triangles'] < 23000, (key, record['triangles'])
    assert baseline_delta <= 2500, (key, 'bakery triangle increase exceeds agreed budget', baseline_delta)
    obj['runtime_key'] = key
    obj['reference'] = 'audit/berlin-kiez-art-direction-v1.png'
    obj['contact_baked'] = True
    obj['ground_storey_height'] = 6.0
    obj['form_revision'] = 'broad-canopy-continuous-corner-v2'
    obj.location = old_location
    bpy.data.objects.remove(old_obj, do_unlink=True)
    obj.name = old_name
    objects_by_key[key] = obj
    data['meshes'][key] = record
    report['changed_modules'][key] = {'before_triangles': before[key]['triangles'],
                                    'after_triangles': record['triangles'], 'triangle_delta': delta,
                                    'v65_baseline_triangles': triangle_baseline[key.split(':')[0]],
                                    'v65_triangle_delta': baseline_delta,
                                    'min': record['min'], 'max': record['max']}
    print('BAKERY_FORM_POLISHED', key, record['triangles'], 'delta', delta, flush=True)

for key, record in before.items():
    if key.split(':')[1] != '0':
        assert data['meshes'][key] == record, ('Unrelated record changed', key)
        report['bookstore_unchanged'] &= data['meshes'][key] == record
data['bakery_form_revision'] = 'broad-canopy-continuous-corner-v2'
with open(os.path.join(OUT, 'berlin-reference-architecture-v1.json'), 'w') as f:
    json.dump(data, f, separators=(',', ':'))
with open(os.path.join(OUT, 'berlin-reference-architecture-v1.inline.js'), 'w', encoding='utf8') as f:
    f.write('var BERLIN_REFERENCE_ARCHITECTURE = ')
    json.dump(data, f, separators=(',', ':'))
    f.write(';\n')
bpy.ops.object.select_all(action='DESELECT')
for obj in objects_by_key.values():
    index = obj.data.color_attributes.find('Color')
    obj.data.color_attributes.active_color_index = index
    obj.data.color_attributes.render_color_index = index
    obj.select_set(True)
bpy.context.view_layer.objects.active = objects_by_key['13.5:0:1']
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'berlin-reference-architecture-v1.glb'),
    use_selection=True, export_format='GLB', export_normals=True, export_materials='EXPORT', export_yup=True,
    export_vertex_color='NAME', export_vertex_color_name='Color', export_all_vertex_colors=False,
    export_extras=True, export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'berlin-reference-architecture-v1.blend'))
with open(os.path.join(ROOT, 'audit', 'berlin-bakery-form-validation-v65.json'), 'w') as f:
    json.dump(report, f, indent=2)
print('BAKERY_FORM_COMPLETE', json.dumps(report), flush=True)
