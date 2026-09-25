"""Shared Blender helpers for the V152 reference vehicles (car, van).

Import from a stage script run inside Blender:
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from berlin_vehicle_kit_v152 import *
Game coordinates throughout: x across, y up, z along the vehicle (nose +z).
"""
import bpy, bmesh, math, json, base64, struct, time
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

LEVEL = 2
MATS = {}
OBJS = []
T0 = time.time()
TAG = 'kit152'


def log(*a):
    print('[%s %6.1fs]' % (TAG, time.time() - T0), *a, flush=True)


def lin(c):
    return ((c + .055) / 1.055) ** 2.4 if c > .04045 else c / 12.92


def hex_lin(h):
    return tuple(lin(((h >> s) & 255) / 255) for s in (16, 8, 0))


def make_materials(pal, prefix):
    """pal: name -> (sRGB hex, roughness, metallic, clearcoat, runtime role)."""
    for name, (hx, rough, metal, coat, role) in pal.items():
        m = bpy.data.materials.new(prefix + name)
        m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*hex_lin(hx), 1)
        b.inputs['Roughness'].default_value = rough
        b.inputs['Metallic'].default_value = metal
        b.inputs['Coat Weight'].default_value = coat * .8
        b.inputs['Coat Roughness'].default_value = .05
        if name == 'lining':
            nt = m.node_tree
            geo = nt.nodes.new('ShaderNodeNewGeometry')
            mix = nt.nodes.new('ShaderNodeMixShader')
            tr = nt.nodes.new('ShaderNodeBsdfTransparent')
            nt.links.new(geo.outputs['Backfacing'], mix.inputs['Fac'])
            nt.links.new(b.outputs['BSDF'], mix.inputs[1])
            nt.links.new(tr.outputs['BSDF'], mix.inputs[2])
            nt.links.new(mix.outputs['Shader'], nt.nodes['Material Output'].inputs['Surface'])
        if role in ('lamp', 'amber', 'tail'):
            b.inputs['Emission Color'].default_value = (*hex_lin(hx), 1)
            b.inputs['Emission Strength'].default_value = 1.5
        if role == 'glass':
            b.inputs['Transmission Weight'].default_value = .9
        m['role'], m['rough'], m['metal'], m['coat'] = role, rough, metal, coat
        MATS[name] = m


def nat(p):
    return Vector((p[0], -p[2], p[1]))


def gam(v):
    return (v.x, v.z, -v.y)


def finish(name, bm, mats, smooth=True, sharp=45, keep=True):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    for mn in mats:
        me.materials.append(MATS[mn])
    for f in me.polygons:
        f.use_smooth = smooth
    if smooth:
        me.set_sharp_from_angle(angle=math.radians(sharp))
    if keep:
        OBJS.append(ob)
    return ob


def apply_mod(ob, mod):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    ob.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.select_set(False)


def rbox(name, c, size, mat, r=0.0, seg=2, rot=None, smooth=True):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = size
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sz, v.co.z * sy))
    if r > 0:
        r = min(r, sx / 2 - 1e-4, sy / 2 - 1e-4, sz / 2 - 1e-4)
        bmesh.ops.bevel(bm, geom=list(bm.edges) + list(bm.verts), offset=r, segments=seg,
                        profile=0.5, affect='EDGES', clamp_overlap=True)
    M = Matrix.Translation(nat(c))
    if rot is not None:
        M = M @ rot
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return finish(name, bm, [mat], smooth)


def rot_game(axis, ang):
    ax = {'x': Vector((1, 0, 0)), 'y': Vector((0, 0, 1)), 'z': Vector((0, -1, 0))}[axis]
    return Matrix.Rotation(ang, 4, ax)


def cyl(name, a, b, r, mat, seg=12, caps=True, smooth=True, r2=None):
    a, b = nat(a), nat(b)
    d = b - a
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=r,
                          radius2=r if r2 is None else r2, depth=d.length)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4(), verts=bm.verts)
    return finish(name, bm, [mat], smooth, 50)


def tube(name, pts, r, mat, seg=10, caps=True, profile=None):
    """Tube (or swept 2D profile [(n,b),...]) along a game-space polyline."""
    P = [nat(p) for p in pts]
    bm = bmesh.new()
    rings, prev_n = [], None
    prof = profile or [(math.cos(math.tau * k / seg) * r, math.sin(math.tau * k / seg) * r) for k in range(seg)]
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        if prev_n is None:
            ref = Vector((0, 0, 1)) if abs(t.z) < .9 else Vector((1, 0, 0))
            n = t.cross(ref).normalized()
        else:
            n = (prev_n - t * prev_n.dot(t)).normalized()
        prev_n = n
        bn = t.cross(n)
        rings.append([bm.verts.new(p + n * a + bn * b) for a, b in prof])
    k = len(prof)
    for i in range(len(rings) - 1):
        for j in range(k):
            bm.faces.new((rings[i][j], rings[i][(j + 1) % k], rings[i + 1][(j + 1) % k], rings[i + 1][j]))
    if caps:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, [mat], True, 60)


def torus(name, c, normal_game, R, r, mat, seg=28, rseg=8, a0=0.0, a1=math.tau, sx=1.0):
    bm = bmesh.new()
    closed = abs(a1 - a0 - math.tau) < 1e-6
    n_ring = seg if closed else seg + 1
    rings = []
    for i in range(n_ring):
        a = a0 + (a1 - a0) * i / seg
        ring = []
        for j in range(rseg):
            t = math.tau * j / rseg
            rr = R + r * math.cos(t)
            ring.append(bm.verts.new((rr * math.cos(a) * sx, rr * math.sin(a), r * math.sin(t))))
        rings.append(ring)
    for i in range(n_ring if closed else n_ring - 1):
        for j in range(rseg):
            a_0, a_1 = rings[i][j], rings[i][(j + 1) % rseg]
            b0, b1 = rings[(i + 1) % n_ring][j], rings[(i + 1) % n_ring][(j + 1) % rseg]
            bm.faces.new((a_0, b0, b1, a_1))
    if not closed:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    n = nat(normal_game) - nat((0, 0, 0))
    q = Vector((0, 0, 1)).rotation_difference(n.normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation(nat(c)) @ q.to_matrix().to_4x4(), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, [mat], True, 60)


def dome(name, c, normal_game, r, depth, mat, seg=24, rings=5, sx=1.0):
    bm = bmesh.new()
    prev = [bm.verts.new((0, 0, depth))]
    for k in range(1, rings + 1):
        t = k / rings
        rr = r * math.sin(t * math.pi / 2)
        z = depth * math.cos(t * math.pi / 2)
        cur = [bm.verts.new((rr * sx * math.cos(math.tau * i / seg), rr * math.sin(math.tau * i / seg), z)) for i in range(seg)]
        for i in range(seg):
            if len(prev) == 1:
                bm.faces.new((prev[0], cur[i], cur[(i + 1) % seg]))
            else:
                bm.faces.new((prev[i], cur[i], cur[(i + 1) % seg], prev[(i + 1) % seg]))
        prev = cur
    bm.faces.new(list(reversed(prev)))
    n = nat(normal_game) - nat((0, 0, 0))
    q = Vector((0, 0, 1)).rotation_difference(n.normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation(nat(c)) @ q.to_matrix().to_4x4(), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, [mat], True, 70)


def lathe_x(name, profile, cx, cy, cz, mat, seg=28, sharp=50, facing=None):
    """Revolve an open (radius, axial) profile about the game x axis.
    Open surfaces cannot be oriented by recalc; facing(center, normal) says
    which side is visible (three.js culls back faces, Cycles does not)."""
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = math.tau * i / seg
        rings.append([bm.verts.new(nat((cx + ax, cy + r * math.cos(a), cz + r * math.sin(a)))) for r, ax in profile])
    k = len(profile)
    for i in range(seg):
        for j in range(k - 1):
            bm.faces.new((rings[i][j], rings[(i + 1) % seg][j], rings[(i + 1) % seg][j + 1], rings[i][j + 1]))
    bm.normal_update()
    if facing is not None:
        score = sum(facing(Vector(gam(f.calc_center_median())), Vector(gam(f.normal))) * f.calc_area() for f in bm.faces)
        if score < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
    else:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, [mat], True, sharp)


def rr_outline(w, h, r, n=5):
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def smooth01(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lattice_box(name, nu, nv, nw, shape, face_mat, level=LEVEL, drop=()):
    """Quad cage on the surface of an nu x nv x nw lattice; shape(i,j,k) -> game xyz.
    face_mat(side, a, b) names the material per boundary cell ('drop' removes it)."""
    bm = bmesh.new()
    verts = {}

    def V(i, j, k):
        key = (i, j, k)
        if key not in verts:
            verts[key] = bm.verts.new(nat(shape(i, j, k)))
        return verts[key]
    cells = []
    for i, side in ((0, 'x-'), (nu - 1, 'x+')):
        for j in range(nv - 1):
            for k in range(nw - 1):
                cells.append(([V(i, j, k), V(i, j + 1, k), V(i, j + 1, k + 1), V(i, j, k + 1)], side, j, k))
    for j, side in ((0, 'y-'), (nv - 1, 'y+')):
        for i in range(nu - 1):
            for k in range(nw - 1):
                cells.append(([V(i, j, k), V(i + 1, j, k), V(i + 1, j, k + 1), V(i, j, k + 1)], side, i, k))
    for k, side in ((0, 'z-'), (nw - 1, 'z+')):
        for i in range(nu - 1):
            for j in range(nv - 1):
                cells.append(([V(i, j, k), V(i + 1, j, k), V(i + 1, j + 1, k), V(i, j + 1, k)], side, i, j))
    names = []
    dropped = []
    for q, side, a, b in cells:
        mn = face_mat(side, a, b)
        f = bm.faces.new(q)
        if mn == 'drop':
            dropped.append(f)
            continue
        if mn not in names:
            names.append(mn)
        f.material_index = names.index(mn)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # recalc works on the closed cage; drop cells only afterwards
    for f in dropped:
        bm.faces.remove(f)
    for v in [v for v in bm.verts if not v.link_faces]:
        bm.verts.remove(v)
    ob = finish(name, bm, names, True, 89)
    if level:
        sub = ob.modifiers.new('subdivision', 'SUBSURF')
        sub.levels = sub.render_levels = level
        sub.boundary_smooth = 'PRESERVE_CORNERS'
        apply_mod(ob, sub)
    for f in ob.data.polygons:
        f.use_smooth = True
    return ob


# ------------------------------------------------------------ merge, UV, bake --
def merge_by_role(objs, prefix):
    """Join objects per runtime role; multi-role meshes are split by material."""
    groups = {}
    for ob in list(objs):
        mats = ob.data.materials
        roles = {mats[min(p.material_index, len(mats) - 1)]['role'] for p in ob.data.polygons}
        if len(roles) == 1:
            groups.setdefault(roles.pop(), []).append(ob)
            continue
        for role in roles:
            dup = ob.copy()
            dup.data = ob.data.copy()
            bpy.context.collection.objects.link(dup)
            bm = bmesh.new()
            bm.from_mesh(dup.data)
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if mats[f.material_index]['role'] != role], context='FACES')
            bm.to_mesh(dup.data)
            bm.free()
            groups.setdefault(role, []).append(dup)
        bpy.data.objects.remove(ob, do_unlink=True)
    merged = {}
    for role, obs in groups.items():
        bpy.ops.object.select_all(action='DESELECT')
        for o in obs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = obs[0]
        if len(obs) > 1:
            bpy.ops.object.join()
        ob = bpy.context.view_layer.objects.active
        ob.name = ob.data.name = prefix + role
        merged[role] = ob
    return merged


def uv_pack(ob, margin=.003, angle=60):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    for uvl in list(ob.data.uv_layers):
        ob.data.uv_layers.remove(uvl)
    ob.data.uv_layers.new(name='UVMap')
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(angle), island_margin=margin, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, margin=margin)
    bpy.ops.object.mode_set(mode='OBJECT')


def planar_uv(ob):
    uvl = ob.data.uv_layers.new(name='UVMap')
    for l in ob.data.loops:
        p = gam(ob.data.vertices[l.vertex_index].co)
        uvl.data[l.index].uv = ((p[0] + 1) / 2, p[1] / 2)


def ground_plane(name, mat=None):
    ob = bpy.data.objects.new(name, bpy.data.meshes.new(name))
    bm = bmesh.new()
    for x, y in ((-40, -40), (40, -40), (40, 40), (-40, 40)):
        bm.verts.new((x, y, 0))
    bm.faces.new(bm.verts)
    bm.to_mesh(ob.data)
    bm.free()
    if mat is not None:
        ob.data.materials.append(mat)
    bpy.context.collection.objects.link(ob)
    return ob


def review(path, cam_game, look_game, env=None, res=(1200, 800), lens=45, samples=64):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.view_settings.view_transform = 'AgX'
    if 'review_cam' not in bpy.data.objects:
        cam = bpy.data.objects.new('review_cam', bpy.data.cameras.new('review_cam'))
        bpy.context.collection.objects.link(cam)
        sun = bpy.data.objects.new('review_sun', bpy.data.lights.new('review_sun', 'SUN'))
        bpy.context.collection.objects.link(sun)
        sun.data.energy, sun.data.color, sun.data.angle = 4.5, (1.0, .84, .68), math.radians(1.5)
        d = -Vector(nat((-62.6, 72.1, -30.5)) - nat((0, 0, 0))).normalized()
        sun.rotation_euler = Vector((0, 0, -1)).rotation_difference(d).to_euler()
        world = bpy.data.worlds.new('review_world')
        scene.world = world
        world.use_nodes = True
        nt = world.node_tree
        if env is not None and Path(env).exists():
            tex = nt.nodes.new('ShaderNodeTexEnvironment')
            tex.image = bpy.data.images.load(str(env))
            nt.links.new(tex.outputs['Color'], nt.nodes['Background'].inputs['Color'])
        gm = bpy.data.materials.new('review_ground')
        gm.use_nodes = True
        gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.20, .21, .27, 1)
        ground_plane('review_ground', gm)
        scene.camera = cam
    cam = bpy.data.objects['review_cam']
    cam.data.lens = lens
    cam.location = nat(cam_game)
    cam.rotation_euler = (nat(look_game) - nat(cam_game)).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    log('review', Path(path).name)


def bake_into(obs, key, size, kind, build_dir, **kw):
    """Bake one image shared by every material of obs (their UVs must not overlap)."""
    im = bpy.data.images.new('bake_' + key, size, size, float_buffer=True, alpha=False)
    im.colorspace_settings.name = 'Non-Color'
    for ob in obs:
        for m in ob.data.materials:
            nt = m.node_tree
            node = nt.nodes.get('bake_target') or nt.nodes.new('ShaderNodeTexImage')
            node.name = 'bake_target'
            node.image = im
            nt.nodes.active = node
    bpy.ops.object.select_all(action='DESELECT')
    for ob in obs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    t = time.time()
    bpy.ops.object.bake(type=kind, margin=8, margin_type='EXTEND', use_clear=True, **kw)
    px = np.empty(size * size * 4, dtype=np.float32)
    im.pixels.foreach_get(px)
    np.save(Path(build_dir) / ('bake_%s.npy' % key), px.reshape(size, size, 4))
    log('baked', key, '%.1fs' % (time.time() - t))


def bake_surface_set(obs, prefix, build_dir, size=1024, orm_size=512, ao_distance=.5):
    """Albedo (metals/coats neutralised: Cycles bakes them black), AO and the
    clearcoat/roughness/metalness surface map for one atlas."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 128
    if scene.world is None:
        scene.world = bpy.data.worlds.new('bake_world')
    scene.world.light_settings.distance = ao_distance
    mats = {m for ob in obs for m in ob.data.materials}
    bake_into(obs, prefix + 'ao', size, 'AO', build_dir)
    looks = {}
    for m in mats:
        bsdf = m.node_tree.nodes['Principled BSDF']
        looks[m.name] = [(k, bsdf.inputs[k].default_value) for k in ('Metallic', 'Coat Weight', 'Transmission Weight')]
        for k, _ in looks[m.name]:
            bsdf.inputs[k].default_value = 0.0
    bake_into(obs, prefix + 'albedo', size, 'DIFFUSE', build_dir, pass_filter={'COLOR'})
    for m in mats:
        bsdf = m.node_tree.nodes['Principled BSDF']
        for k, v in looks[m.name]:
            bsdf.inputs[k].default_value = v
    saved = {}
    for m in mats:
        nt = m.node_tree
        out = nt.nodes['Material Output']
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = (m['coat'], m['rough'], m['metal'], 1)
        saved[m.name] = out.inputs['Surface'].links[0].from_socket if out.inputs['Surface'].links else None
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    bake_into(obs, prefix + 'orm', orm_size, 'EMIT', build_dir)
    for m in mats:
        if saved.get(m.name) is not None:
            m.node_tree.links.new(saved[m.name], m.node_tree.nodes['Material Output'].inputs['Surface'])


def packed(ob):
    me = ob.data
    me.calc_loop_triangles()
    arr = {k: [] for k in ('position', 'normal', 'uv', 'index')}
    lookup = {}
    uvl = me.uv_layers.active.data if me.uv_layers else None
    for t in me.loop_triangles:
        if t.area < 1e-11:
            continue
        for li in t.loops:
            l = me.loops[li]
            p = gam(me.vertices[l.vertex_index].co)
            n = gam(me.corner_normals[li].vector)
            uv = tuple(uvl[li].uv) if uvl else (0.0, 0.0)
            key = (tuple(round(v, 5) for v in p), tuple(max(-32767, min(32767, round(v * 32767))) for v in n),
                   tuple(round(v, 6) for v in uv))
            if key not in lookup:
                lookup[key] = len(arr['position']) // 3
                for k, v in zip(('position', 'normal', 'uv'), key):
                    arr[k].extend(v)
            arr['index'].append(lookup[key])
    nv = len(arr['position']) // 3
    fmt = {'position': 'f', 'normal': 'h', 'uv': 'f', 'index': 'I' if nv > 65535 else 'H'}
    r = {k: base64.b64encode(struct.pack('<' + fmt[k] * len(arr[k]), *arr[k])).decode() for k in arr}
    r.update(vertices=nv, triangles=len(arr['index']) // 3,
             min=[min(arr['position'][i::3]) for i in range(3)], max=[max(arr['position'][i::3]) for i in range(3)])
    return r


def write_parts(merged, roles, build_dir):
    for ob in merged.values():
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.triangulate(bm, faces=list(bm.faces))
        bm.to_mesh(ob.data)
        bm.free()
        ob.data.update()
    parts, meshes = [], {}
    for role in roles:
        ob = merged[role]
        meshes[ob.name] = packed(ob)
        parts.append({'mesh': ob.name, 'role': role})
    low = [min(m['min'][i] for m in meshes.values()) for i in range(3)]
    high = [max(m['max'][i] for m in meshes.values()) for i in range(3)]
    total = sum(m['triangles'] for m in meshes.values())
    (Path(build_dir) / 'parts.json').write_text(json.dumps({'parts': parts, 'meshes': meshes,
        'renderBounds': {'min': low, 'max': high}, 'triangles': total}, separators=(',', ':')))
    log('triangles', total, {k: v['triangles'] for k, v in meshes.items()}, 'bounds', low, high)
    return low, high, total


def export_native(merged, out_path_stem):
    for name in ('review_cam', 'review_sun', 'review_ground', 'bake_ground'):
        if name in bpy.data.objects:
            bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in merged.values():
        ob.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(out_path_stem) + '.glb', use_selection=True, export_format='GLB',
                              export_normals=True, export_materials='EXPORT', export_yup=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out_path_stem) + '.blend')
