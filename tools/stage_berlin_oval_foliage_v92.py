"""Stage eight-point, thin street leaves from the accepted v87 painted meshes.

Blender -b -t 2 --python tools/stage_berlin_oval_foliage_v92.py
Only audit/berlin-oval-foliage-v92 is written. The first baseline is immutable.
No procedural tree regeneration or lighting/color rebake is performed.
"""
import base64
import collections
import copy
import hashlib
import json
import math
import os
import shutil
import struct
import sys

import bpy
import numpy as np
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'tools'))
from berlin_mesh_pack import packed_geometry

STAGE = os.path.join(ROOT, 'audit', 'berlin-oval-foliage-v92')
BASE = os.path.join(STAGE, 'baseline')
OUT = os.path.join(STAGE, 'models')
PREFIX = 'berlin-kiez-garden-v1'
NAMES = [PREFIX+'.'+s for s in ('blend', 'glb', 'json', 'inline.js')] + [PREFIX+'-atlas.jpg']
FORMATS = {'position': 'f', 'normal': 'h', 'color': 'B', 'uv': 'f', 'index': 'H'}
SIZES = {'position': 3, 'normal': 3, 'color': 3, 'uv': 2}
TARGETS = {'treeNear': 'Kiez_Tree_Leaves_Street', 'treeStreetFar': 'Kiez_Tree_Leaves_Street_Far'}


def sha(path):
    with open(path, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def enc(fmt, values):
    return base64.b64encode(struct.pack('<'+fmt*len(values), *values)).decode('ascii')


def unpack(record):
    result = {}
    for key, fmt in FORMATS.items():
        if key == 'index' and record['vertices'] >= 65536:
            fmt = 'I'
        raw = base64.b64decode(record[key])
        result[key] = struct.unpack('<'+fmt*(len(raw)//struct.calcsize(fmt)), raw)
    return result


def point_key(p):
    return tuple(round(float(v), 5) for v in p)


def runtime_point(p):
    return (p[0], p[2], -p[1])


def components(points, faces):
    lookup, parents, weld = {}, [], []

    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    for p in points:
        key = point_key(p)
        if key not in lookup:
            lookup[key] = len(parents)
            parents.append(len(parents))
        weld.append(lookup[key])
    for face in faces:
        root = find(weld[face[0]])
        for v in face[1:]:
            parents[find(weld[v])] = root
    groups = {}
    for fi, face in enumerate(faces):
        g = groups.setdefault(find(weld[face[0]]), {'faces': [], 'vertices': set()})
        g['faces'].append(fi)
        g['vertices'].update(face)
    for g in groups.values():
        g['vertices'] = sorted(g['vertices'])
        unique = sorted({point_key(points[i]) for i in g['vertices']})
        g['signature'] = tuple(unique)
        g['unique'] = unique
        g['center'] = np.mean(unique, axis=0)
    return list(groups.values())


def record_components(record):
    data = unpack(record)
    points = [data['position'][i:i+3] for i in range(0, len(data['position']), 3)]
    faces = [data['index'][i:i+3] for i in range(0, len(data['index']), 3)]
    return data, components(points, faces)


def is_leaf(g):
    return len(g['faces']) == 8 and len(g['unique']) == 6 and g['center'][1] > 4.4


def corner(data, i):
    return tuple(data[k][i*n:(i+1)*n] for k, n in SIZES.items())


def triangle_counter(data, faces=None):
    if faces is None:
        faces = range(len(data['index'])//3)
    return collections.Counter(tuple(corner(data, i) for i in data['index'][fi*3:fi*3+3]) for fi in faces)


def counter_hash(counter):
    return hashlib.sha256(repr(sorted(counter.items())).encode()).hexdigest()


def splice(source, protected, added):
    """Copy protected runtime corners verbatim; pack only the new native leaves."""
    arrays = {key: [] for key in FORMATS}
    lookup = {}
    for data, faces in ((source, protected), (added, range(len(added['index'])//3))):
        for fi in faces:
            for index in data['index'][fi*3:fi*3+3]:
                key = corner(data, index)
                if key not in lookup:
                    lookup[key] = len(lookup)
                    for attr, values in zip(SIZES, key):
                        arrays[attr].extend(values)
                arrays['index'].append(lookup[key])
    count = len(lookup)
    result = {key: enc('I' if key == 'index' and count >= 65536 else fmt, arrays[key]) for key, fmt in FORMATS.items()}
    result.update(vertices=count, triangles=len(arrays['index'])//3,
                  min=[min(arrays['position'][i::3]) for i in range(3)],
                  max=[max(arrays['position'][i::3]) for i in range(3)])
    return result


def native_snapshot(obj):
    me = obj.data
    return ([tuple(v.co) for v in me.vertices], [tuple(p.vertices) for p in me.polygons],
            [tuple(n.vector) for n in me.corner_normals],
            [tuple(u.uv) for u in me.uv_layers.active.data],
            [tuple(c.color) for c in me.color_attributes['Color'].data],
            tuple(me.materials), tuple(tuple(row) for row in obj.matrix_world))


def native_components(obj):
    return components([runtime_point(v.co) for v in obj.data.vertices], [tuple(p.vertices) for p in obj.data.polygons])


OLD_OUTLINE = np.array([(1, 0), (.45, 1), (-.48, .85), (-.94, 0), (-.48, -.85), (.45, -1)])
OLD_BEND = np.array([.10*x*x+.06*y*y+(1 if i % 2 == 0 else -1)*.13 for i, (x, y) in enumerate(OLD_OUTLINE)])
DESIGN = np.column_stack([np.ones(6), OLD_OUTLINE, OLD_BEND])
FIT = np.linalg.pinv(DESIGN)


def colors_for_outline(old_colors, xy):
    angles = np.mod(np.arctan2(OLD_OUTLINE[:, 1], OLD_OUTLINE[:, 0]), math.tau)
    order = np.argsort(angles)
    angles, source = angles[order], old_colors[order]
    angles = np.r_[angles[-1]-math.tau, angles, angles[0]+math.tau]
    source = np.vstack([source[-1], source, source[0]])
    ring_angles = np.mod(np.arctan2(xy[:, 1], xy[:, 0]), math.tau)
    colors = np.array([[np.interp(a, angles, source[:, k]) for k in range(3)] for a in ring_angles])
    colors = np.vstack([colors, old_colors.mean(axis=0), old_colors.mean(axis=0)])
    # Keep the baked mean to the closest representable 10-point byte average.
    # All samples stay inside this leaf's original RGB range. No new shading.
    for k in range(3):
        low, high = old_colors[:, k].min(), old_colors[:, k].max()
        target = round(float(old_colors[:, k].mean()*10))
        values = np.clip(np.rint(colors[:, k]), low, high).astype(int)
        while sum(values) != target:
            sign = 1 if sum(values) < target else -1
            candidates = [i for i in range(10) if low <= values[i]+sign <= high]
            assert candidates
            i = min(candidates, key=lambda i: abs(values[i]+sign-colors[i, k])-abs(values[i]-colors[i, k]))
            values[i] += sign
        colors[:, k] = values
    return colors.astype(int)


def make_leaf(old_points, old_colors, extreme_points):
    """Recover the accepted affine frame, then close an eight-point oval rim."""
    coefficients = FIT @ old_points
    assert np.max(np.abs(DESIGN @ coefficients-old_points)) < 2e-6
    _, u, v, n = coefficients
    center = old_points.mean(axis=0)
    angles = np.arange(8)*math.tau/8
    xy = np.column_stack([.97*np.cos(angles)+.03, np.sin(angles)*(.94+.06*np.cos(angles))])
    # A shallow common bend and a 0.08-width total ridge make a thin closed leaf.
    height = .045*xy[:, 0]**2+.025*xy[:, 1]**2
    local = np.vstack([np.column_stack([xy, height]), [0, 0, .055], [0, 0, -.025]])
    local -= local.mean(axis=0)
    basis = np.column_stack([u, v, n])
    points = local @ basis.T
    lo, hi = old_points.min(axis=0)-center, old_points.max(axis=0)-center
    scale = 1.0
    for p in points:
        for k in range(3):
            if p[k] > 0:
                scale = min(scale, hi[k]/p[k])
            elif p[k] < 0:
                scale = min(scale, lo[k]/p[k])
    points *= scale
    points += center
    # Keep the six measured crown extrema. Only their owning leaves need this
    # small boundary correction; both interior face centres balance the mean.
    anchors = 0
    for old in old_points:
        if point_key(runtime_point(old)) in extreme_points:
            i = int(np.argmin(np.linalg.norm(points[:8]-old, axis=1)))
            delta = old-points[i]
            points[i] = old
            points[8:] -= delta/2
            anchors += 1
    assert np.max(np.abs(points.mean(axis=0)-center)) < 1e-10
    assert np.all(points >= old_points.min(axis=0)-2e-6)
    assert np.all(points <= old_points.max(axis=0)+2e-6)
    faces, normals = [], []
    inverse_transpose = np.linalg.inv(basis).T
    for side, apex in ((1, 8), (-1, 9)):
        for i in range(8):
            face = (apex, i, (i+1) % 8) if side == 1 else (apex, (i+1) % 8, i)
            # Independent front/back corner normals follow the broad plane.
            # Rim normals never point sideways, avoiding an inflated pebble.
            corner_normals = []
            for vertex in face:
                x, y = xy[vertex] if vertex < 8 else (0, 0)
                gradient = np.array([-.09*x, -.05*y, 1])*side
                normal = inverse_transpose @ gradient
                normal /= np.linalg.norm(normal)
                corner_normals.append(normal.tolist())
            faces.append(face)
            normals.append(corner_normals)
    volume = sum(np.dot(points[a]-center, np.cross(points[b]-center, points[c]-center)) for a, b, c in faces)/6
    assert volume > 0
    return {'points': points.tolist(), 'faces': faces, 'normals': normals,
            'colors': colors_for_outline(old_colors, xy).tolist(),
            'center': center.tolist(), 'scale': float(scale), 'anchors': anchors,
            'basis': basis.tolist(), 'volume': float(volume)}


def create_mesh(name, leaves, material, old_obj=None, protected_groups=()):
    vertices, faces, colors, uvs, normals = [], [], [], [], []
    protected_snapshot = []
    # Native far cores retain all source positions, corners, UVs and RGB.
    if old_obj is not None:
        old = old_obj.data
        attr = old.color_attributes['Color']
        assert attr.domain == 'POINT'
        for g in protected_groups:
            remap = {}
            for vi in g['vertices']:
                remap[vi] = len(vertices)
                vertices.append(tuple(old.vertices[vi].co))
                colors.append(tuple(attr.data[vi].color[:3]))
            for fi in g['faces']:
                poly = old.polygons[fi]
                faces.append(tuple(remap[vi] for vi in poly.vertices))
                for li in poly.loop_indices:
                    uvs.append(tuple(old.uv_layers.active.data[li].uv))
                    normals.append(tuple(old.corner_normals[li].vector))
                    protected_snapshot.append((vertices[faces[-1][li-poly.loop_start]], uvs[-1], colors[faces[-1][li-poly.loop_start]], normals[-1]))
    protected_loops = len(normals)
    for leaf in leaves:
        offset = len(vertices)
        vertices.extend(leaf['points'])
        colors.extend(tuple(c/255 for c in rgb) for rgb in leaf['colors'])
        for face, corner_normals in zip(leaf['faces'], leaf['normals']):
            faces.append(tuple(offset+i for i in face))
            uvs.extend([(.015625, .015625)]*3)
            normals.extend(corner_normals)
    me = bpy.data.meshes.new(name)
    me.from_pydata(vertices, [], faces)
    me.update()
    color = me.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
    for dst, rgb in zip(color.data, colors):
        dst.color = (*rgb, 1)
    uv = me.uv_layers.new(name='UVMap')
    for dst, value in zip(uv.data, uvs):
        dst.uv = value
    for polygon in me.polygons:
        polygon.use_smooth = True
    me.normals_split_custom_set(normals)
    me.materials.append(material)
    max_core_normal_delta = 0.0
    for li, (p, tex, rgb, normal) in enumerate(protected_snapshot):
        loop = me.loops[li]
        assert tuple(me.vertices[loop.vertex_index].co) == p
        assert tuple(me.uv_layers.active.data[li].uv) == tex
        assert tuple(me.color_attributes['Color'].data[loop.vertex_index].color[:3]) == rgb
        max_core_normal_delta = max(max_core_normal_delta, max(abs(a-b) for a, b in zip(normal, me.corner_normals[li].vector)))
    return me, protected_loops, max_core_normal_delta


def write_glb(leaf_record):
    """Replace only the near-leaf GLB buffer views; keep every other view exact."""
    with open(os.path.join(BASE, PREFIX+'.glb'), 'rb') as f:
        old = f.read()
    length = struct.unpack_from('<I', old, 12)[0]
    gltf = json.loads(old[20:20+length])
    original = copy.deepcopy(gltf)
    binary = old[28+length:]
    primitive = next(m for m in gltf['meshes'] if m.get('name') == TARGETS['treeNear'])['primitives'][0]
    attrs = primitive['attributes']
    data = unpack(leaf_record)
    replacements = {}
    payloads = {'POSITION': ('f', data['position']),
                'NORMAL': ('f', [v/32767 for v in data['normal']]),
                'TEXCOORD_0': ('f', data['uv']),
                'COLOR_0': ('H', [c for i in range(leaf_record['vertices']) for c in (*[v*257 for v in data['color'][i*3:i*3+3]], 65535)]),
                'INDEX': ('H', data['index'])}
    for name, (fmt, values) in payloads.items():
        index = primitive['indices'] if name == 'INDEX' else attrs[name]
        accessor = gltf['accessors'][index]
        accessor['count'] = len(values) if name == 'INDEX' else leaf_record['vertices']
        assert accessor.get('byteOffset', 0) == 0
        if name == 'POSITION':
            accessor['min'], accessor['max'] = leaf_record['min'], leaf_record['max']
        view_index = accessor['bufferView']
        replacements[view_index] = struct.pack('<'+fmt*len(values), *values)
    new_binary = bytearray()
    protected_views = 0
    for vi, view in enumerate(gltf['bufferViews']):
        while len(new_binary) % 4:
            new_binary.append(0)
        raw = binary[view.get('byteOffset', 0):view.get('byteOffset', 0)+view['byteLength']]
        value = replacements.get(vi, raw)
        view['byteOffset'], view['byteLength'] = len(new_binary), len(value)
        new_binary.extend(value)
        if vi not in replacements:
            assert new_binary[view['byteOffset']:view['byteOffset']+view['byteLength']] == raw
            protected_views += 1
    while len(new_binary) % 4:
        new_binary.append(0)
    gltf['buffers'][0]['byteLength'] = len(new_binary)
    for key in original:
        if key not in ('buffers', 'bufferViews', 'accessors'):
            assert gltf[key] == original[key]
    modified_accessors = set(attrs.values()) | {primitive['indices']}
    for i, accessor in enumerate(original['accessors']):
        if i not in modified_accessors:
            assert gltf['accessors'][i] == accessor
    encoded = json.dumps(gltf, separators=(',', ':')).encode()
    encoded += b' '*((-len(encoded)) % 4)
    output = struct.pack('<4sII', b'glTF', 2, 28+len(encoded)+len(new_binary))
    output += struct.pack('<I4s', len(encoded), b'JSON')+encoded
    output += struct.pack('<I4s', len(new_binary), b'BIN\0')+new_binary
    with open(os.path.join(OUT, PREFIX+'.glb'), 'wb') as f:
        f.write(output)
    return {'protected_buffer_views_exact': protected_views, 'materials_nodes_textures_images_exact': True,
            'near_leaf_payload_matches_runtime': True, 'bytes_before': len(old), 'bytes_after': len(output)}


def validate_geometry(record, expected_leaves):
    data, groups = record_components(record)
    leaves = [g for g in groups if len(g['faces']) == 16 and len(g['unique']) == 10]
    assert len(leaves) == expected_leaves, (len(leaves), expected_leaves, collections.Counter((len(g['faces']), len(g['unique'])) for g in groups))
    assert all(math.isfinite(x) for key in ('position', 'uv') for x in data[key])
    normal_errors = [abs(math.sqrt(sum(n*n for n in data['normal'][i:i+3]))/32767-1) for i in range(0, len(data['normal']), 3)]
    assert max(normal_errors) < .00007
    assert min(data['uv']) >= 0 and max(data['uv']) <= 1
    for g in leaves:
        edges, volume = collections.Counter(), 0.0
        c = g['center']
        for fi in g['faces']:
            vertices = data['index'][fi*3:fi*3+3]
            points = [np.array(data['position'][vi*3:vi*3+3]) for vi in vertices]
            assert np.linalg.norm(np.cross(points[1]-points[0], points[2]-points[0])) > 1e-9
            volume += np.dot(points[0]-c, np.cross(points[1]-c, points[2]-c))/6
            for a, b in ((0, 1), (1, 2), (2, 0)):
                edges[tuple(sorted((point_key(points[a]), point_key(points[b]))))] += 1
        assert set(edges.values()) == {2}, 'Leaf must be a closed manifold'
        assert volume > 0, 'Leaf must face outward'
    return {'leaves': len(leaves), 'all_leaves_closed_positive_volume': True,
            'max_normal_length_error': max(normal_errors), 'triangles': record['triangles'], 'vertices': record['vertices']}


def main():
    os.makedirs(BASE, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    for name in NAMES:
        target = os.path.join(BASE, name)
        if not os.path.exists(target):
            shutil.copyfile(os.path.join(ROOT, 'assets', 'models', name), target)
    hashes = {name: sha(os.path.join(BASE, name)) for name in NAMES}
    hash_path = os.path.join(BASE, 'sha256.json')
    if os.path.exists(hash_path):
        with open(hash_path) as f:
            assert hashes == json.load(f), 'Immutable baseline changed'
    else:
        with open(hash_path, 'w') as f:
            json.dump(hashes, f, indent=2)
    with open(os.path.join(BASE, PREFIX+'.json')) as f:
        baseline = json.load(f)
    data_groups = {key: record_components(baseline['meshes'][key]) for key in TARGETS}
    near_data, near_groups = data_groups['treeNear']
    far_data, far_groups = data_groups['treeStreetFar']
    near_leaves, far_leaves = [g for g in near_groups if is_leaf(g)], [g for g in far_groups if is_leaf(g)]
    assert len(near_leaves) == 1680 and len(far_leaves) == 418
    color_lookup = {}
    for g in near_leaves:
        for vi in g['vertices']:
            key = point_key(near_data['position'][vi*3:vi*3+3])
            rgb = near_data['color'][vi*3:vi*3+3]
            assert key not in color_lookup or color_lookup[key] == rgb
            color_lookup[key] = rgb
    all_points = np.array([p for g in near_leaves for p in g['unique']])
    extreme_points = {point_key(all_points[np.argmin(all_points[:, k])]) for k in range(3)} | {point_key(all_points[np.argmax(all_points[:, k])]) for k in range(3)}
    bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE, PREFIX+'.blend'))
    bpy.context.preferences.filepaths.save_version = 0
    snapshots = {o.name: native_snapshot(o) for o in bpy.data.objects if o.type == 'MESH' and o.name not in TARGETS.values()}
    obj = bpy.data.objects[TARGETS['treeNear']]
    native_near = native_components(obj)
    assert len(native_near) == 1680 and all(is_leaf(g) for g in native_near)
    authored, mean_errors, source_centers = {}, [], {}
    for g in native_near:
        assert len(g['vertices']) == 6
        old_points = np.array([tuple(obj.data.vertices[i].co) for i in g['vertices']])
        colors = np.array([color_lookup[point_key(runtime_point(p))] for p in old_points])
        leaf = make_leaf(old_points, colors, extreme_points)
        mean_errors.append(np.max(np.abs(np.mean(leaf['colors'], axis=0)-colors.mean(axis=0))))
        authored[g['signature']] = leaf
        source_centers[g['signature']] = np.mean([runtime_point(p) for p in old_points], axis=0)
    assert set(authored) == {g['signature'] for g in near_leaves}
    assert max(mean_errors) <= .034
    updated = copy.deepcopy(baseline)
    records, core_normal_delta, native_packed = {}, 0.0, {}
    for key, name in TARGETS.items():
        obj = bpy.data.objects[name]
        old_mesh = obj.data
        native_groups = native_components(obj)
        leaf_groups = [g for g in native_groups if is_leaf(g)]
        protected_native = [g for g in native_groups if not is_leaf(g)]
        assert len(protected_native) == (0 if key == 'treeNear' else 5)
        leaves = [authored[g['signature']] for g in leaf_groups]
        me, core_loops, delta = create_mesh(name+'_v92', leaves, old_mesh.materials[0], obj, protected_native)
        core_normal_delta = max(core_normal_delta, delta)
        obj.data = me
        obj['leaf_form_v92'] = '1680 fixed anchors; 8-point thin oval rim; split front/back normals; existing v87 RGB only'
        whole = packed_geometry(obj)
        whole_data = unpack(whole)
        # New native cores are excluded here: exact packed originals are spliced.
        new_record = splice(whole_data, range(core_loops//3, whole['triangles']), {**{k: [] for k in FORMATS}})
        native_packed[key] = new_record
        source, groups = data_groups[key]
        protected = [fi for g in groups if not is_leaf(g) for fi in g['faces']]
        added = unpack(new_record)
        combined = splice(source, protected, added)
        after_data = unpack(combined)
        before_counter = triangle_counter(source, protected)
        after_counter = triangle_counter(after_data, range(len(protected)))
        assert before_counter == after_counter
        # Keep every existing record metadata field, including precise bounds.
        after = dict(baseline['meshes'][key])
        for attr in (*FORMATS, 'vertices', 'triangles'):
            after[attr] = combined[attr]
        assert np.max(np.abs(np.array(combined['min'])-after['min'])) < .000012
        assert np.max(np.abs(np.array(combined['max'])-after['max'])) < .000012
        assert after['triangles'] <= (28000 if key == 'treeNear' else 7500)
        updated['meshes'][key] = after
        records[key] = validate_geometry(new_record, 1680 if key == 'treeNear' else 418)
        records[key].update(triangles=after['triangles'], vertices=after['vertices'],
                            protected_triangles=len(protected), protected_triangle_sha256=counter_hash(before_counter),
                            protected_all_attributes_exact=True, bounds_metadata_exact=True,
                            actual_min=combined['min'], actual_max=combined['max'])
    # Every shared leaf must have identical full runtime triangle payloads.
    near_counter = triangle_counter(unpack(native_packed['treeNear']))
    far_counter = triangle_counter(unpack(native_packed['treeStreetFar']))
    assert all(near_counter[tri] >= count for tri, count in far_counter.items())
    untouched = [k for k in baseline['meshes'] if k not in TARGETS]
    assert all(updated['meshes'][key] == baseline['meshes'][key] for key in untouched)
    assert {k: v for k, v in updated.items() if k != 'meshes'} == {k: v for k, v in baseline.items() if k != 'meshes'}
    for name, snapshot in snapshots.items():
        assert native_snapshot(bpy.data.objects[name]) == snapshot, name+' changed'
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, PREFIX+'.blend'))
    glb_report = write_glb(native_packed['treeNear'])
    with open(os.path.join(OUT, PREFIX+'.json'), 'w') as f:
        json.dump(updated, f, separators=(',', ':'))
    with open(os.path.join(OUT, PREFIX+'.inline.js'), 'w') as f:
        f.write('/* Blender-authored opaque garden meshes; v92 oval leaf hypothesis. */\nvar BERLIN_KIEZ_GARDEN_DATA = ')
        json.dump(updated, f, separators=(',', ':'))
        f.write(';\n')
    shutil.copyfile(os.path.join(BASE, PREFIX+'-atlas.jpg'), os.path.join(OUT, PREFIX+'-atlas.jpg'))
    # Quantized runtime centre evidence, keyed by stable original leaf anchors.
    center_errors = []
    for signature, leaf in authored.items():
        quantized = np.array([point_key(runtime_point(p)) for p in leaf['points']])
        center_errors.append(float(np.max(np.abs(quantized.mean(axis=0)-source_centers[signature]))))
    assert max(center_errors) < .000006
    report = {'source': 'tools/stage_berlin_oval_foliage_v92.py', 'baseline_sha256': hashes,
              'candidate_only': True, 'method': {'boundary_points': 8, 'faces_per_leaf': 16,
              'new_leaves': 0, 'frame_source': 'Least-squares inversion of each accepted six-point affine frame',
              'normals': 'Separate front/back plane normals with shallow bend', 'new_ao_or_color_bake': False},
              'records': records, 'near_far_exact_shared_leaves': 418, 'near_far_all_attributes_exact': True,
              'maximum_leaf_center_error_m': max(center_errors),
              'maximum_inherited_leaf_mean_rgb_error_bytes': float(max(mean_errors)),
              'inherited_leaf_rgb_ranges_preserved': True,
              'shape_uniform_fit_scale': {'min': min(p['scale'] for p in authored.values()),
                                          'mean': sum(p['scale'] for p in authored.values())/1680,
                                          'max': max(p['scale'] for p in authored.values())},
              'crown_extrema_preserved': sum(p['anchors'] for p in authored.values()),
              'other_records_exact': untouched, 'other_native_meshes_exact': list(snapshots),
              'far_native_core_positions_uv_rgb_exact': True,
              'far_native_core_max_normal_codec_delta': core_normal_delta,
              'far_runtime_cores_and_branch_normals_exact': True,
              'atlas_and_metadata_exact': True, 'same_material_and_draw_count': True,
              'glb': glb_report,
              'runtime_bytes_before': sum(len(base64.b64decode(r[k])) for r in baseline['meshes'].values() for k in FORMATS),
              'runtime_bytes_after': sum(len(base64.b64decode(r[k])) for r in updated['meshes'].values() for k in FORMATS)}
    with open(os.path.join(STAGE, 'validation.json'), 'w') as f:
        json.dump(report, f, indent=2)
    with open(os.path.join(STAGE, 'leaf-correspondence.json'), 'w') as f:
        json.dump([{'source_center': source_centers[sig].tolist(), 'points': leaf['points'],
                    'colors': leaf['colors'], 'retained_far': sig in {g['signature'] for g in far_leaves}}
                   for sig, leaf in authored.items()], f, separators=(',', ':'))
    assert hashes == {name: sha(os.path.join(BASE, name)) for name in NAMES}
    print('OVAL_FOLIAGE_COMPLETE', json.dumps(report), flush=True)


if __name__ == '__main__':
    main()
