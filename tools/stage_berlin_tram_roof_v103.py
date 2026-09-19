"""Stage the accepted tram's existing roof equipment, never rebuild its body.

python tools/stage_berlin_tram_roof_v103.py --prepare
node tools/check_berlin_tram_roof_v103.cjs --preflight
Blender -b -t 2 --python tools/stage_berlin_tram_roof_v103.py
node tools/check_berlin_tram_roof_v103.cjs

The stage changes only 19 object transforms. All 120 packed mesh records and
the complete GLB BIN chunk remain byte-identical to the immutable baseline.
"""
import copy, hashlib, json, math, os, shutil, struct, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE = os.path.join(ROOT, 'audit', 'berlin-tram-roof-v103')
BASE = os.path.join(STAGE, 'baseline')
OUT = os.path.join(STAGE, 'models')
PREFIX = 'berlin-vintage-tram-v90'
TARGET_IDS = list(range(63, 73)) + list(range(75, 79)) + list(range(81, 86))
TARGETS = {'part_%03d' % i for i in TARGET_IDS}
RODS = [75, 76, 77, 78, 81, 82, 83, 84]

def sha(raw): return hashlib.sha256(raw).hexdigest()
def read(path):
    with open(path, 'rb') as f: return f.read()
def dump(path, value):
    with open(path, 'w', encoding='utf-8') as f: json.dump(value, f, indent=2)

os.makedirs(BASE, exist_ok=True)
os.makedirs(OUT, exist_ok=True)
baseline_hashes = {}
for ext in ('blend', 'glb', 'json', 'inline.js'):
    name = PREFIX + '.' + ext
    path = os.path.join(BASE, name)
    if not os.path.exists(path): shutil.copyfile(os.path.join(ROOT, 'assets', 'models', name), path)
    baseline_hashes[name] = sha(read(path))
for name in ('check_berlin_tram_v90.cjs', 'check_berlin_vehicles.cjs'):
    path = os.path.join(BASE, name)
    if not os.path.exists(path): shutil.copyfile(os.path.join(ROOT, 'tools', name), path)
    baseline_hashes[name] = sha(read(path))
hp = os.path.join(BASE, 'sha256.json')
if os.path.exists(hp): assert json.loads(read(hp)) == baseline_hashes, 'Immutable baseline changed'
else: dump(hp, baseline_hashes)

before = json.loads(read(os.path.join(BASE, PREFIX + '.json')))
after = copy.deepcopy(before)
parts = {p['mesh']: p for p in after['parts']}
assert len(parts) == 120 and sum(r['triangles'] for r in before['meshes'].values()) == 7796

# Housings grow upward from their existing seat. The shallow vent slats move
# by the same increase in housing height, retaining their exact thickness.
for i in (63, 68):
    p = parts['part_%03d' % i]
    assert p['scale'] == [1, 1, 1] and p['translation'][1] == 2.895
    p['translation'][1] = 2.845 + .275 / 2
    p['scale'][1] = 2.75
for i in list(range(64, 68)) + list(range(69, 73)):
    parts['part_%03d' % i]['translation'][1] += .175

rod_manifest = []
for x, start in ((-.27, 75), (.27, 81)):
    base_front = [x, 2.886, -.58]
    base_rear = [x, 2.886, .58]
    elbow_front = [x, 3.48, -.88]
    elbow_rear = [x, 3.48, .88]
    crown = [x, 4.077, .08]
    for offset, (a, b) in enumerate(((base_front, elbow_front), (elbow_front, crown),
                                    (base_rear, elbow_rear), (elbow_rear, crown))):
        name = 'part_%03d' % (start + offset)
        p, record = parts[name], before['meshes'][name]
        delta = [b[k] - a[k] for k in range(3)]
        length = math.sqrt(sum(v*v for v in delta))
        direction = [v / length for v in delta]
        # Quaternion rotating the local +Y rod axis to the two authored joints.
        q = [direction[2], 0, -direction[0], 1 + direction[1]]
        qlen = math.sqrt(sum(v*v for v in q)); q = [v / qlen for v in q]
        p['translation'] = [(a[k] + b[k]) / 2 for k in range(3)]
        p['quaternion'] = q
        p['scale'] = [.04 / (record['max'][0] - record['min'][0]),
                      length / (record['max'][1] - record['min'][1]),
                      .04 / (record['max'][2] - record['min'][2])]
        rod_manifest.append({'part': name, 'from': a, 'to': b, 'crossSection': .04})
parts['part_085']['translation'][1] = 4.085  # existing 3 cm contact bow, top = 4.10
after['source'] = 'Blender 5.2 / tools/stage_berlin_tram_roof_v103.py; accepted V93 body retained'
after['roofRevision'] = 'raised-equipment-v103'
after['renderBounds'] = {'min': [-1.232000000372529, .012849994897842387, -3.968454998165369],
                         'max': [1.232000000372529, 4.10, 3.968454998165369]}
after['collisionContract'] = {'halfW': 1.25, 'halfD': 4, 'yMin': 0, 'yMax': 3.15}
assert before['meshes'] == after['meshes']
assert before['colors'] == after['colors'] and before['glassTexture'] == after['glassTexture']
changed = [p['mesh'] for p, q in zip(before['parts'], after['parts']) if p != q]
assert set(changed) == TARGETS
for p in after['parts']:
    assert p['role'] == next(q['role'] for q in before['parts'] if q['mesh'] == p['mesh'])
    assert min(p['scale']) > 0

packed_text = json.dumps(after, separators=(',', ':'))
with open(os.path.join(OUT, PREFIX + '.json'), 'w') as f: f.write(packed_text)
with open(os.path.join(OUT, PREFIX + '.inline.js'), 'w') as f:
    f.write('var BERLIN_VINTAGE_TRAM_DATA = ' + packed_text + ';\n')

# glTF and native Blender store the same independent roof objects. Updating
# only node transforms keeps every accessor, image, mesh, UV and normal exact.
glb = read(os.path.join(BASE, PREFIX + '.glb'))
old_json_len = struct.unpack_from('<I', glb, 12)[0]
gltf = json.loads(glb[20:20 + old_json_len])
gltf_before = copy.deepcopy(gltf)
bin_tail = glb[20 + old_json_len:]
node_ids = []
for i, node in enumerate(gltf['nodes']):
    if node.get('name') not in TARGETS: continue
    p = parts[node['name']]
    assert 'matrix' not in node and 'children' not in node
    node['translation'] = p['translation']
    node['rotation'] = p['quaternion']
    node['scale'] = p['scale']
    node_ids.append(i)
assert len(node_ids) == 19
for i, node in enumerate(gltf['nodes']):
    if i not in node_ids: assert node == gltf_before['nodes'][i]
for key in gltf:
    if key != 'nodes': assert gltf[key] == gltf_before[key]
j = json.dumps(gltf, separators=(',', ':')).encode()
j += b' ' * ((-len(j)) % 4)
new_glb = struct.pack('<III', 0x46546c67, 2, 20 + len(j) + len(bin_tail))
new_glb += struct.pack('<II', len(j), 0x4e4f534a) + j + bin_tail
with open(os.path.join(OUT, PREFIX + '.glb'), 'wb') as f: f.write(new_glb)
manifest = {'version': 103, 'baselineSha256': baseline_hashes, 'targetParts': sorted(TARGETS),
            'parts': [{'before': p, 'after': q} for p, q in zip(before['parts'], after['parts']) if p != q],
            'rodJoints': rod_manifest, 'all120MeshRecordsExact': True,
            'protectedPartTransformsExact': 101, 'unchangedOriginalNonCabEquipment': 65,
            'mountingFeetExact': ['part_073', 'part_074', 'part_079', 'part_080'],
            'sameTriangles': 7796, 'sameMaterialRoles': 9,
            'glbBinSha256': sha(bin_tail), 'glbBinExact': True, 'changedGLBNodeIndices': node_ids,
            'housings': {'parts': ['part_063', 'part_068'], 'bottom': 2.845, 'height': .275},
            'bow': {'part': 'part_085', 'top': 4.10},
            'nativeStatus': 'pending', 'physicalWireContact': False}
dump(os.path.join(STAGE, 'transform-manifest.json'), manifest)
if '--prepare' in sys.argv:
    print('ROOF_V103_PREPARED: 19 transform edits, all 120 mesh records and GLB BIN exact', flush=True)
    sys.exit(0)

import bpy
from mathutils import Matrix, Vector, Quaternion
preflight = json.loads(read(os.path.join(STAGE, 'clearance-check.json')))
assert preflight['ok'] and preflight['sameCollisionContract'] and preflight['tramSpawnPaths'] == 2
bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE, PREFIX + '.blend'))
bpy.context.preferences.filepaths.save_version = 0
bpy.context.scene.render.threads_mode = 'FIXED'; bpy.context.scene.render.threads = 2
convert = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
def matrix_for(p):
    q = p['quaternion']
    return Matrix.LocRotScale(Vector(p['translation']), Quaternion((q[3], q[0], q[1], q[2])), Vector(p['scale']))
def mesh_digest(obj):
    me = obj.data; me.calc_loop_triangles()
    h = hashlib.sha256()
    for v in me.vertices: h.update(struct.pack('<3f', *v.co))
    for loop in me.loops: h.update(struct.pack('<I', loop.vertex_index))
    for tri in me.loop_triangles: h.update(struct.pack('<3I', *tri.loops))
    for n in me.corner_normals: h.update(struct.pack('<3f', *n.vector))
    for uv in me.uv_layers:
        for datum in uv.data: h.update(struct.pack('<2f', *datum.uv))
    for poly in me.polygons: h.update(struct.pack('<IB', poly.material_index, poly.use_smooth))
    return h.hexdigest()
mesh_objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
native_hashes = {o.name: mesh_digest(o) for o in mesh_objects}
native_matrices = {o.name: o.matrix_world.copy() for o in mesh_objects}
assert len(mesh_objects) == 119 and sum(len(o.data.loop_triangles) for o in mesh_objects) == 7796
for name in TARGETS:
    obj = bpy.data.objects[name]
    old = next(p for p in before['parts'] if p['mesh'] == name)
    wanted_old = convert @ matrix_for(old) @ convert.inverted()
    assert max(abs(obj.matrix_world[r][c] - wanted_old[r][c]) for r in range(4) for c in range(4)) < 2e-6
    obj.matrix_world = convert @ matrix_for(parts[name]) @ convert.inverted()
bpy.context.view_layer.update()
for obj in mesh_objects:
    assert mesh_digest(obj) == native_hashes[obj.name], ('Native mesh payload changed', obj.name)
    if obj.name not in TARGETS: assert obj.matrix_world == native_matrices[obj.name]
bpy.context.scene['roof_stage'] = 'v103: existing roof transforms only; collision unchanged at 3.15 m'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, PREFIX + '.blend'))
manifest['nativeStatus'] = 'saved'
manifest['nativeMeshPayloadsExact'] = len(mesh_objects)
manifest['nativeProtectedTransformsExact'] = len(mesh_objects) - len(TARGETS)
manifest['nativeMeshHashes'] = native_hashes
dump(os.path.join(STAGE, 'transform-manifest.json'), manifest)
print('ROOF_V103_NATIVE_SAVED: 119 native mesh payloads exact, 100 protected object transforms exact', flush=True)
