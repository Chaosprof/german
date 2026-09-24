"""Stage local contact shading in the existing architecture color bytes.

Use the preserved V134 baseline on every run. All runtime geometry, normals,
UVs, indices, atlas cells and byte counts stay unchanged. This bake covers the
pale stone tile omitted by the older plaster-only pass, and the newer upper
bookstore windows. Glass, shop images, fabric and planting are protected.
"""
import base64, bpy, copy, json, math, pathlib, shutil, struct
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit/berlin-parity-v135'
BASE, OUT = STAGE / 'baseline', STAGE / 'models'
NAME = 'berlin-reference-architecture-v1'
source = json.loads((BASE / (NAME + '.json')).read_text())
bpy.ops.wm.open_mainfile(filepath=str(BASE / (NAME + '.blend')))
bpy.context.preferences.filepaths.save_version = 0
objects = {o['runtime_key']: o for o in bpy.data.objects if o.type == 'MESH' and o.get('runtime_key')}

def unpack(record):
    return {name: list(struct.unpack('<' + fmt * (len(raw) // struct.calcsize(fmt)), raw))
            for name, fmt in [('position', 'f'), ('normal', 'h'), ('uv', 'f'), ('color', 'B'),
                              ('index', 'H' if record['vertices'] < 65536 else 'I')]
            for raw in [base64.b64decode(record[name])]}

def components(points, faces):
    ids, parents, weld = {}, [], []
    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    for point in points:
        key = tuple(round(v, 5) for v in point)
        if key not in ids:
            ids[key] = len(parents)
            parents.append(len(parents))
        weld.append(ids[key])
    for face in faces:
        root = find(weld[face[0]])
        for v in face[1:]: parents[find(weld[v])] = root
    groups = {}
    for face in faces: groups.setdefault(find(weld[face[0]]), set()).update(face)
    return list(groups.values())

updated = copy.deepcopy(source)
report = {}
for key in ['13.5:0:1', '13.5:1:1']:
    record = source['meshes'][key]
    raw = unpack(record)
    points = [Vector(raw['position'][i:i+3]) for i in range(0, len(raw['position']), 3)]
    normals = [Vector([v/32767 for v in raw['normal'][i:i+3]]).normalized()
               for i in range(0, len(raw['normal']), 3)]
    faces = [raw['index'][i:i+3] for i in range(0, len(raw['index']), 3)]
    structural, cloth = set(), set()
    for verts in components(points, faces):
        lo = [min(points[v][k] for v in verts) for k in range(3)]
        hi = [max(points[v][k] for v in verts) for k in range(3)]
        # The continuous bakery canopy is the only broad outboard component
        # entirely within this band. Protect its cloth shading byte-for-byte.
        if key == '13.5:0:1' and 3.4 < lo[1] < 3.6 and 5.5 < hi[1] < 5.8 and hi[0]-lo[0] > 7:
            cloth.update(verts)
        # Small individual petals/leaves and fixtures never receive this bake.
        if max(hi[k]-lo[k] for k in range(3)) > .65:
            structural.update(verts)
    if key == '13.5:0:1': assert len(cloth) > 2000, 'Protect the actual continuous awning'
    bvh = BVHTree.FromPolygons(points, faces, all_triangles=True, epsilon=.000001)
    colors = list(raw['color'])
    cache, changed, selected, samples = {}, [], [], []
    tiles = []
    for i, (point, normal) in enumerate(zip(points, normals)):
        u, v = raw['uv'][i*2:i*2+2]
        tile = math.floor(u*4)+4*math.floor((1-v)*4)
        tiles.append(tile)
        r, g, b = raw['color'][i*3:i*3+3]
        stone = tile == 0 and r >= g >= b and r > 100 and r-b < 110
        # Keep the accepted ground-storey returns and their derived warm-room
        # mask exact; this pass targets the upper windows and stone ledges.
        if point.y < 4.7 or (tile != 1 and not stone) or i not in structural or i in cloth:
            continue
        selected.append(i)
        lookup = (*[round(v, 5) for v in point], *[round(v, 4) for v in normal])
        if lookup not in cache:
            axis = normal.cross(Vector((0, 1, 0)))
            if axis.length < .1: axis = normal.cross(Vector((0, 0, 1)))
            axis.normalize()
            other = normal.cross(axis).normalized()
            occlusion = 0
            for sample in range(24):
                radius = math.sqrt((sample+.5)/24)
                azimuth = sample*2.399963229728653
                direction = normal*math.sqrt(1-radius*radius) + axis*(radius*math.cos(azimuth)) + other*(radius*math.sin(azimuth))
                hit = bvh.ray_cast(point+normal*.012, direction, .56)
                if hit[0] is not None:
                    occlusion += max(0, 1-hit[3]/.56)
            # Only nearby occluders affect the paint. Exposed fronts stay
            # unchanged; smooth interpolation softens contacts across bevels.
            local = max(0, occlusion/24-.035)
            cache[lookup] = max(.64, 1-.58*local)
        factor = cache[lookup]
        for c in range(3): colors[i*3+c] = round(raw['color'][i*3+c]*factor)
        if colors[i*3:i*3+3] != raw['color'][i*3:i*3+3]:
            changed.append(i)
            samples.append(factor)
    after = copy.deepcopy(record)
    after['color'] = base64.b64encode(bytes(colors)).decode()
    after['contactRevision'] = 'stone-and-plaster-local-v135'
    for attr in ['position', 'normal', 'uv', 'index', 'vertices', 'triangles', 'min', 'max']:
        assert after[attr] == record[attr], (key, attr)
    for i in cloth: assert colors[i*3:i*3+3] == raw['color'][i*3:i*3+3]
    assert changed and len(after['color']) == len(record['color'])
    updated['meshes'][key] = after
    # Rebuild the native object's corner data from the exact runtime arrays.
    target = objects[key]
    material = target.data.materials[0]
    mesh = bpy.data.meshes.new('Stone and plaster contact v135 / '+key)
    mesh.from_pydata([(p.x, -p.z, p.y) for p in points], [], faces)
    mesh.update()
    uv = mesh.uv_layers.new(name='UVMap')
    paint = mesh.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
    for i, c in enumerate(paint.data): c.color = (*[v/255 for v in colors[i*3:i*3+3]], 1)
    custom_normals = []
    for loop in mesh.loops:
        i = loop.vertex_index
        uv.data[loop.index].uv = raw['uv'][i*2:i*2+2]
        n = normals[i]
        custom_normals.append((n.x, -n.z, n.y))
    for face in mesh.polygons: face.use_smooth = True
    mesh.normals_split_custom_set(custom_normals)
    mesh.materials.append(material)
    target.data = mesh
    target['contact_revision'] = 'stone-and-plaster-local-v135'
    report[key] = dict(changedVertices=len(changed), selectedVertices=len(selected), protectedClothVertices=len(cloth),
                       stoneChanged=sum(tiles[i] == 0 for i in changed), plasterChanged=sum(tiles[i] == 1 for i in changed),
                       minFactor=min(samples), meanChangedFactor=sum(samples)/len(samples),
                       triangles=record['triangles'], vertices=record['vertices'], unchangedGeometryAndByteCounts=True)
    print('CONTACT_V135', key, json.dumps(report[key]), flush=True)

updated['source'] = 'Blender 5.2 / tools/stage_berlin_facade_contact_v135.py'
(OUT / (NAME+'.json')).write_text(json.dumps(updated, separators=(',', ':')))
(OUT / (NAME+'.inline.js')).write_text('var BERLIN_REFERENCE_ARCHITECTURE = '+json.dumps(updated, separators=(',', ':'))+';\n')
shutil.copyfile(BASE / (NAME+'-atlas.png'), OUT / (NAME+'-atlas.png'))
bpy.ops.object.select_all(action='DESELECT')
for obj in objects.values():
    obj.select_set(True)
    obj.data.color_attributes.active_color_index = obj.data.color_attributes.find('Color')
    obj.data.color_attributes.render_color_index = obj.data.color_attributes.find('Color')
bpy.context.view_layer.objects.active = objects['13.5:0:1']
bpy.ops.export_scene.gltf(filepath=str(OUT/(NAME+'.glb')), use_selection=True, export_format='GLB',
    export_normals=True, export_materials='EXPORT', export_yup=True, export_vertex_color='NAME',
    export_vertex_color_name='Color', export_all_vertex_colors=False, export_extras=True, export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(NAME+'.blend')))
(STAGE/'contact-bake.json').write_text(json.dumps(report, indent=2))
print('FACADE_CONTACT_V135_COMPLETE', flush=True)
