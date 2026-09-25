"""Reopen the saved editable canopy source and compare both runtime LODs."""
import base64, hashlib, json, pathlib, struct, sys
import bpy

ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit/berlin-parity-v149'
sys.path.insert(0, str(ROOT / 'tools'))
from berlin_mesh_pack import packed_geometry

def unpack(record):
    result = {}
    for key, fmt in [('position','f'),('normal','h'),('uv','f'),('color','B'),('index','H')]:
        raw = base64.b64decode(record[key])
        result[key] = struct.unpack('<'+fmt*(len(raw)//struct.calcsize(fmt)),raw)
    return result

def protected_objects():
    data = {}
    for o in bpy.data.objects:
        if o.type != 'MESH' or o.name in ['Kiez_Tree_Leaves_Street','Kiez_Tree_Leaves_Street_Far']:
            continue
        m = o.data
        data[o.name] = repr((
            [tuple(v.co) for v in m.vertices], [tuple(p.vertices) for p in m.polygons],
            [tuple(n.vector) for n in m.corner_normals],
            [tuple(v.uv) for v in m.uv_layers.active.data],
            [tuple(v.color) for v in m.color_attributes['Color'].data],
            [v.name for v in m.materials], tuple(tuple(r) for r in o.matrix_world)))
    return data

bpy.ops.wm.open_mainfile(filepath=str(STAGE/'baseline/berlin-kiez-garden-v1.blend'))
before = protected_objects()
bpy.ops.wm.open_mainfile(filepath=str(STAGE/'models/berlin-kiez-garden-v1.blend'))
assert protected_objects() == before
records = json.loads((STAGE/'models/berlin-kiez-garden-v1.json').read_text())
roles = []
for role, name in [('treeNear','Kiez_Tree_Leaves_Street'),('treeStreetFar','Kiez_Tree_Leaves_Street_Far')]:
    saved = unpack(packed_geometry(bpy.data.objects[name]))
    runtime = unpack(records['meshes'][role])
    assert len(saved['index']) == len(runtime['index']) - 552*3
    errors = {}
    for key, stride, tolerance in [('position',3,1e-6),('normal',3,1),('uv',2,1e-6),('color',3,0)]:
        error = 0
        for corner, index in enumerate(saved['index']):
            destination = runtime['index'][552*3+corner]
            error = max(error, max(abs(saved[key][index*stride+k]-runtime[key][destination*stride+k]) for k in range(stride)))
        assert error <= tolerance, (role,key,error)
        errors[key] = error
    roles.append({'role':role,'corners':len(saved['index']),'maximumError':errors})
result = {'passed':True,'reopenedSource':True,'protectedObjects':len(before),'roles':roles,
          'blendSha256':hashlib.sha256((STAGE/'models/berlin-kiez-garden-v1.blend').read_bytes()).hexdigest()}
(STAGE/'native-check.json').write_text(json.dumps(result,indent=2))
print('NATIVE_CHECK',json.dumps(result),flush=True)
