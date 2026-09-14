"""Rebuild both focal masters with real upper window openings and contact depth.

The accepted v66 kit is retained in audit/architecture-accepted-v66. Geometry
comes from the canonical JS factory; material/atlas and authored scene layout
come from the existing Blender asset. Run export_kiez_architecture_source.cjs
before this bounded refinement.
"""
import ast, base64, bpy, bmesh, json, os, math, struct, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'assets', 'models')
BACKUP = os.path.join(ROOT, 'audit', 'architecture-accepted-v66')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from berlin_mesh_pack import packed_geometry as packed

with open(os.path.join(ROOT, '.tmp', 'kiez-architecture-source.json')) as f:
    source = json.load(f)
with open(os.path.join(OUT, 'berlin-reference-architecture-v1.json')) as f:
    data = json.load(f)
with open(os.path.join(BACKUP, 'berlin-reference-architecture-v1.json')) as f:
    baseline = json.load(f)['meshes']
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT, 'berlin-reference-architecture-v1.blend'))
bpy.context.preferences.filepaths.save_version = 0
objects_by_key = {obj['runtime_key']: obj for obj in bpy.context.scene.objects
                  if obj.type == 'MESH' and obj.get('runtime_key')}
mat = objects_by_key['13.5:0:1'].data.materials[0]
builder_path = os.path.join(ROOT, 'tools', 'build_berlin_reference_architecture.py')
with open(builder_path, encoding='utf8') as f:
    builder_source = f.read()
    builder_tree = ast.parse(builder_source, filename=builder_path)
polish_ast = next(node for node in builder_tree.body
                  if isinstance(node, ast.FunctionDef) and node.name == 'polish')
polish_source = ast.get_source_segment(builder_source, polish_ast)
# New intersecting wall skins must not globally clamp every unrelated bevel.
# Select only edges whose adjacent faces accommodate the 27mm bevel locally;
# thinner mullions/rim sides keep their authored thickness and sharp silhouette.
polish_source = polish_source.replace(
    "if len(edge.link_faces)==2 and edge.calc_length()>.68 and edge.calc_face_angle(0)>.74:",
    "if len(edge.link_faces)==2 and edge.calc_length()>.68 and edge.calc_face_angle(0)>.74 and min(face.calc_area()/edge.calc_length() for face in edge.link_faces)>.032:")
polish_source = polish_source.replace('bevel.use_clamp_overlap=True', 'bevel.use_clamp_overlap=False')
exec(compile(polish_source, builder_path, 'exec'), globals())

def preserve_accepted_ground(obj, accepted, ceiling):
    """Keep the actual approved lower-storey triangles, normals, UVs and bake.

    The upper walls use the new Blender-polished mesh. The shared horizontal
    storey slab closes their join; no new scene object/material is retained.
    """
    current = packed(obj)
    points, normals, texcoords, colors, faces, lookup = [], [], [], [], [], {}
    def unpack(record, name, fmt):
        blob = base64.b64decode(record[name])
        return struct.unpack('<'+fmt*(len(blob)//struct.calcsize(fmt)), blob)
    retained = 0
    for record, keep_below in [(current, False), (accepted, True)]:
        p = unpack(record, 'position', 'f')
        n = unpack(record, 'normal', 'h')
        uv = unpack(record, 'uv', 'f')
        color = unpack(record, 'color', 'B')
        indices = unpack(record, 'index', 'H' if record['vertices'] < 65536 else 'I')
        for first in range(0, len(indices), 3):
            triangle = indices[first:first+3]
            below = max(p[index*3+1] for index in triangle) <= ceiling
            if below != keep_below:
                continue
            vertices = [Vector(p[index*3:index*3+3]) for index in triangle]
            if (vertices[1]-vertices[0]).cross(vertices[2]-vertices[0]).length_squared < 1e-12:
                continue
            if keep_below:
                retained += 1
            face = []
            for index in triangle:
                point = tuple(p[index*3:index*3+3])
                normal = tuple(n[index*3:index*3+3])
                paint = tuple(color[index*3:index*3+3])
                tex = tuple(uv[index*2:index*2+2])
                key = (*point, *normal, *paint, *tex)
                if key not in lookup:
                    lookup[key] = len(points)
                    points.append((point[0], -point[2], point[1]))
                    normals.append((normal[0]/32767, -normal[2]/32767, normal[1]/32767))
                    texcoords.append(tex)
                    colors.append((*[value/255 for value in paint], 1))
                face.append(lookup[key])
            faces.append(tuple(face))
    mesh = bpy.data.meshes.new(obj.data.name+' / approved shop + recessed upper walls')
    mesh.from_pydata(points, [], faces)
    mesh.update()
    # Accepted packed meshes can contain a coincident duplicate face. Remove
    # invalid duplicate topology before assigning corner attributes/normals;
    # otherwise the glTF exporter would silently clean it after record export.
    mesh.validate(clean_customdata=False)
    texture = mesh.uv_layers.new(name='UVMap')
    paint = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='CORNER')
    custom_normals = []
    for loop in mesh.loops:
        index = loop.vertex_index
        texture.data[loop.index].uv = texcoords[index]
        paint.data[loop.index].color = colors[index]
        custom_normals.append(normals[index])
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    mesh.normals_split_custom_set(custom_normals)
    mesh.materials.append(mat)
    old_mesh = obj.data
    obj.data = mesh
    bpy.data.meshes.remove(old_mesh)
    return retained

report = {'changed_modules': {}, 'recess_from_wall': .230,
          'frame_projection': .060, 'glazing_mullions_inset': True,
          'interstorey_cornice_projection': .280, 'roof_soffit_depth': .280,
          'upper_trim_linear_multiplier': .80, 'materials_added': 0,
          'triangle_budget_increase_per_master': 3000,
          'accepted_backup': 'audit/architecture-accepted-v66'}
items = list(source['modules'])
items.sort(key=lambda item: (item['width'] != 13.5, item['side'] != 1, item['variant']))
for item in items:
    key = item['name']
    old_obj = objects_by_key[key]
    old_name, old_location = old_obj.name, old_obj.location.copy()
    if '--repair-only' in sys.argv:
        obj = old_obj.copy()
        obj.data = old_obj.data.copy()
        bpy.context.collection.objects.link(obj)
    else:
        obj = polish(item)
    ground_height = 6.0 if item['variant'] == 0 else 4.70
    retained = preserve_accepted_ground(obj, baseline[key], ground_height+.29)
    record = packed(obj)
    delta = record['triangles'] - baseline[key]['triangles']
    assert delta <= 3000, (key, 'triangle increase exceeds agreed budget', delta)
    assert record['max'][2] < 2.35, (key, 'pavement projection changed', record['max'][2])
    obj['runtime_key'] = key
    obj['reference'] = 'audit/berlin-kiez-art-direction-v1.png'
    obj['contact_baked'] = True
    obj['ground_storey_height'] = 6.0 if item['variant'] == 0 else 4.70
    obj['form_revision'] = 'pierced-upper-facades-v3'
    obj.location = old_location
    bpy.data.objects.remove(old_obj, do_unlink=True)
    obj.name = old_name
    objects_by_key[key] = obj
    data['meshes'][key] = record
    report['changed_modules'][key] = {
        'before_triangles': baseline[key]['triangles'],
        'after_triangles': record['triangles'], 'triangle_delta': delta,
        'accepted_ground_triangles_retained': retained,
        'min': record['min'], 'max': record['max']}
    print('UPPER_FACADE_POLISHED', key, record['triangles'], 'delta', delta, flush=True)

data['upper_facade_revision'] = 'pierced-upper-facades-v3'
data['source'] = 'Blender 5.2 / tools/refine_berlin_upper_facades.py'
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
    use_selection=True, export_format='GLB', export_normals=True,
    export_materials='EXPORT', export_yup=True, export_vertex_color='NAME',
    export_vertex_color_name='Color', export_all_vertex_colors=False,
    export_extras=True, export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'berlin-reference-architecture-v1.blend'))
with open(os.path.join(ROOT, 'audit', 'berlin-upper-facade-validation-v68.json'), 'w') as f:
    json.dump(report, f, indent=2)
print('UPPER_FACADE_COMPLETE', json.dumps(report), flush=True)
