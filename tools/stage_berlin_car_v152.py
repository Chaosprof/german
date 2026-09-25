"""V152 reference car: a lacquered, Pixar-grade Trabant 601 for the Kiez street.

blender -b --python tools/stage_berlin_car_v152.py -- [--preview] [--no-bake]

The old car was a procedural two-box built from rounded boxes. This build models
the Trabant as subdivision surfaces: a shaped lattice cage for the lower body
(crowned bonnet and boot, tucked sills, rounded plan corners) and a second cage
for the greenhouse (raked windscreen, upright rear window, slim pillars). Window
cells are inset into rubber seals with recessed glass, and a simple cabin
(dashboard, steering wheel, seats, headliner) shows through. Chrome bumpers,
round headlamps in pods, stacked tail lamps, lathed tyres with cream rims and
chrome caps, door shut lines, a mirror and wipers finish it.

Game coordinates: x across, y up, z along the car with the nose at +z. The
obstacle footprint stays inside |x| <= 1.0, |z| <= 2.1, y <= 1.95.
Outputs go to audit/berlin-vehicles-v152/car/:
  models/berlin-reference-car-v152.{blend,glb}
  build/parts.json, build/bake_{paint_ao,trim_albedo,trim_ao,trim_orm}.npy
  review/*.png (--preview)
Runtime roles: paint (one white clearcoat material; per-car colour comes from
the material colour or instanceColor), trim (baked atlas), glass, lamp, amber,
tail.
"""
import bpy, bmesh, math, json, base64, struct, sys, time
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit' / 'berlin-vehicles-v152' / 'car'
OUT, BUILD, REVIEW = STAGE / 'models', STAGE / 'build', STAGE / 'review'
for p in (OUT, BUILD, REVIEW):
    p.mkdir(parents=True, exist_ok=True)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW, NO_BAKE = '--preview' in ARGS, '--no-bake' in ARGS
LEVEL = 2
ENV = ROOT / 'assets' / 'img' / 'berlin-street-env-v1.jpg'
T0 = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def log(*a):
    print('[car152 %6.1fs]' % (time.time() - T0), *a, flush=True)


def lin(c):
    return ((c + .055) / 1.055) ** 2.4 if c > .04045 else c / 12.92


def hex_lin(h):
    return tuple(lin(((h >> s) & 255) / 255) for s in (16, 8, 0))


# name: (sRGB hex, roughness, metallic, clearcoat, runtime role)
PAL = {
    'paint':    (0xffffff, .38, .0, 1., 'paint'),
    'paintin':  (0xffffff, .60, .0, 0., 'paint'),     # inside of arch lips etc.
    'chrome':   (0xdfe3e6, .10, 1., 0., 'trim'),
    'rubber':   (0x1c1d1f, .78, .0, 0., 'trim'),
    'tyre':     (0x232427, .86, .0, 0., 'trim'),
    'rim':      (0xe9e3d3, .32, .1, .8, 'trim'),
    'under':    (0x26282b, .80, .1, 0., 'trim'),
    'grille':   (0x2d3033, .55, .3, 0., 'trim'),
    'plate':    (0xf2efe6, .45, .0, .5, 'trim'),
    'plateblue': (0x1f3f8f, .45, .0, .5, 'trim'),
    'dash':     (0x2a2b2e, .70, .0, 0., 'trim'),
    'seat':     (0x8b6a4d, .80, .0, 0., 'trim'),
    'seatdark': (0x5e4735, .85, .0, 0., 'trim'),
    'lining':   (0xb7b0a3, .85, .0, 0., 'trim'),
    'glass':    (0x9fb2bd, .04, .0, 0., 'glass'),
    'lamp':     (0xfdf7ea, .10, .0, 0., 'lamp'),
    'amber':    (0xffa43a, .20, .0, 0., 'amber'),
    'tail':     (0xe0301f, .20, .0, 0., 'tail'),
}
MATS = {}
for name, (hx, rough, metal, coat, role) in PAL.items():
    m = bpy.data.materials.new('car_' + name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*hex_lin(hx), 1)
    if name == 'paint':
        b.inputs['Base Color'].default_value = (*hex_lin(0x3e7faa), 1)   # review colour only
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat * .8
    b.inputs['Coat Roughness'].default_value = .05
    if name == 'lining':
        nt = m.node_tree
        geo = nt.nodes.new('ShaderNodeNewGeometry')
        mix = nt.nodes.new('ShaderNodeMixShader')
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        out = nt.nodes['Material Output']
        nt.links.new(geo.outputs['Backfacing'], mix.inputs['Fac'])
        nt.links.new(b.outputs['BSDF'], mix.inputs[1])
        nt.links.new(tr.outputs['BSDF'], mix.inputs[2])
        nt.links.new(mix.outputs['Shader'], out.inputs['Surface'])
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


OBJS = []


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


# ------------------------------------------------------------ lattice cages --
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


# ---------------------------------------------------------------- lower body --
TU = [-1, -.95, -.72, 0, .72, .95, 1]
TV = [0, .10, .50, .86, 1]
TW = [-1.985, -1.915, -1.72, -1.28, -.45, .45, 1.28, 1.72, 1.915, 1.985]
PROF = {0: .925, 1: .985, 2: 1.0, 3: .99, 4: .952}


def deck_y(z):
    if z > .80:
        return 1.00 - .115 * ((z - .80) / 1.19) ** 1.25
    if z < -1.36:
        return 1.00 - .055 * ((-z - 1.36) / .63) ** 1.4
    return 1.00


def tub_shape(i, j, k):
    u, v, z = TU[i], TV[j], TW[k]
    end = smooth01(1.55, 1.985, abs(z))
    w = .92 - .05 * end
    yb = .30 + .08 * end
    yt = deck_y(max(-1.985, min(1.985, z)))
    y = yb + (yt - yb) * v
    if j == len(TV) - 1:
        y += .032 * (1 - u * u)
    x = u * w * PROF[j]
    if k in (0, len(TW) - 1):
        z = z + math.copysign(.028 * (1 - u * u) * (1 - .5 * (1 - v)), z)
    return (x, y, z)


def tub_mat(side, a, b):
    return 'paint'


tub = lattice_box('body_tub', len(TU), len(TV), len(TW), tub_shape, tub_mat)
log('tub', len(tub.data.polygons), 'faces')

# Wheel wells: two short cylinders per axle, cut from each flank.
WHEEL_Z, WHEEL_Y, WHEEL_R = (-1.28, 1.28), .364, .362
for z0 in WHEEL_Z:
    for s in (-1, 1):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=40, radius1=.438, radius2=.438, depth=.50)
        q = Vector((0, 0, 1)).rotation_difference(Vector((1, 0, 0)))
        bmesh.ops.transform(bm, matrix=Matrix.Translation(nat((s * 1.02, WHEEL_Y + .01, z0))) @ q.to_matrix().to_4x4(), verts=bm.verts)
        cut = finish('well_cut', bm, ['under'], False, keep=False)
        mod = tub.modifiers.new('well', 'BOOLEAN')
        mod.operation, mod.solver, mod.object = 'DIFFERENCE', 'EXACT', cut
        mod.material_mode = 'TRANSFER'
        apply_mod(tub, mod)
        bpy.data.objects.remove(cut, do_unlink=True)
for f in tub.data.polygons:
    f.use_smooth = True
tub.data.set_sharp_from_angle(angle=math.radians(50))
log('wells cut', len(tub.data.polygons), 'faces')
TUB_BVH = BVHTree.FromObject(tub, bpy.context.evaluated_depsgraph_get())


def hit(origin, direction):
    loc, nrm, _, _ = TUB_BVH.ray_cast(nat(origin), nat(direction) - nat((0, 0, 0)))
    assert loc is not None, ('miss', origin, direction)
    return Vector(gam(loc)), Vector(gam(nrm))


def front_pt(x, y, end=1):
    return hit((x, y, end * 5.0), (0, 0, -end))


def side_pt(z, y, s):
    return hit((s * 5.0, y, z), (-s, 0, 0))


# The deck inside the greenhouse is cabin floor/parcel shelf, not paint.
me = tub.data
if 'car_dash' not in [m.name for m in me.materials]:
    me.materials.append(MATS['dash'])
dash_idx = [m.name for m in me.materials].index('car_dash')
for p in me.polygons:
    c = Vector(gam(p.center))
    n = Vector(gam(p.normal))
    if n.y > .7 and c.y > .97 and -1.26 < c.z < .70 and abs(c.x) < .80:
        p.material_index = dash_idx

# -------------------------------------------------------------- greenhouse ---
GU = [-1, -.93, -.45, .45, .93, 1]
GY = [.955, 1.030, 1.062, 1.528, 1.586, 1.630]


def rake(y):
    return max(0.0, min(1.0, (y - 1.030) / (1.586 - 1.030)))


def gh_shape(i, j, k):
    y = GY[j]
    t = rake(y) + (.10 if j == 5 else 0)
    zr = -1.40 + .40 * t
    zf = .84 - .58 * t
    zs = [zr, zr + .05, zr + .17, -.31, -.235, zf - .155, zf - .05, zf]
    wg = .862 - .12 * min(1, t) - (.025 if j == 5 else 0)
    x = GU[i] * wg
    if j == 5:
        y += .018 * (1 - GU[i] ** 2)
    return (x, y, zs[k])


def gh_mat(side, a, b):
    if side == 'y-':
        return 'drop'
    if side in ('x-', 'x+'):
        return 'glass' if a == 2 and b in (2, 4) else 'paint'
    if side in ('z-', 'z+'):
        return 'glass' if b == 2 and a in (1, 2, 3) else 'paint'
    return 'paint'


gh = lattice_box('greenhouse', len(GU), len(GY), 8, gh_shape, gh_mat)
log('greenhouse', len(gh.data.polygons), 'faces')
# Recess every window into a rubber seal; the glass becomes its own object.
bm = bmesh.new()
bm.from_mesh(gh.data)
names = [m.name for m in gh.data.materials]
for mn in ('car_rubber', 'car_lining'):
    if mn not in names:
        gh.data.materials.append(MATS[mn[4:]])
names = [m.name for m in gh.data.materials]
gi, ri, li = names.index('car_glass'), names.index('car_rubber'), names.index('car_lining')
glass_faces = [f for f in bm.faces if f.material_index == gi]
res = bmesh.ops.inset_region(bm, faces=glass_faces, thickness=.016, depth=-.012, use_even_offset=True)
for f in res['faces']:
    f.material_index = ri
glass_bm = bmesh.new()
glass_set = [f for f in bm.faces if f.material_index == gi]
vmap = {}
for f in glass_set:
    vs = []
    for v in f.verts:
        if v not in vmap:
            vmap[v] = glass_bm.verts.new(v.co)
        vs.append(vmap[v])
    glass_bm.faces.new(vs)
bmesh.ops.delete(bm, geom=glass_set, context='FACES')
bm.to_mesh(gh.data)
bm.free()
glass_ob = finish('car_glass_panes', glass_bm, ['glass'], True, 60)
for p in glass_ob.data.polygons:
    p.use_smooth = True
for p in gh.data.polygons:
    p.use_smooth = True
gh.data.set_sharp_from_angle(angle=math.radians(60))
log('greenhouse finished', len(gh.data.polygons), 'faces; glass', len(glass_ob.data.polygons))

# ----------------------------------------------------------------- details ---
# Chrome beltline rod hides the greenhouse/body junction.
for s in (-1, 1):
    pts = []
    for k in range(25):
        z = -1.36 + (0.80 + 1.36) * k / 24
        pts.append((s * .872, 1.036, z))
    tube('belt_chrome', pts, .012, 'chrome', 6)
# Arch lips: rolled paint flares round each well.
for z0 in WHEEL_Z:
    for s in (-1, 1):
        (px, py, pz), _ = side_pt(z0, .75, s)
        arc = []
        for k in range(25):
            ph = math.radians(-2 + 184 * k / 24)
            arc.append((s * (px * s - .004), WHEEL_Y + .01 + .452 * math.sin(ph), z0 + .452 * math.cos(ph)))
        tube('arch_lip', arc, .026, 'paint', 7)
# Wheels: lathed tyre, cream dished rim, chrome cap.
TYRE = [(.250, -.100), (.310, -.108), (.346, -.094), (.362, -.050), (.362, .050), (.346, .094), (.310, .108), (.250, .100)]
RIM = [(.252, .092), (.238, .082), (.205, .070), (.165, .064), (.120, .066), (.095, .074), (.080, .076)]
for z0 in WHEEL_Z:
    for s in (-1, 1):
        cx = s * .790
        prof = [(r, s * a) for r, a in TYRE]
        # The tyre faces away from its own section centre; the rim faces out of the car.
        lathe_x('tyre', prof, cx, WHEEL_Y, z0, 'tyre', 26,
                facing=lambda c, n, cx=cx, z0=z0: n.dot((c - Vector((cx, WHEEL_Y, z0))) -
                    Vector((0, 0, 0)) - .29 * Vector((0, c.y - WHEEL_Y, c.z - z0)).normalized()))
        lathe_x('rim', [(r, s * a) for r, a in RIM], cx, WHEEL_Y, z0, 'rim', 26,
                facing=lambda c, n, s=s: n.x * s)
        dome('hubcap', (cx + s * .074, WHEEL_Y, z0), (s, 0, 0), .086, .034, 'chrome', 20, 3)
# Bumpers: chrome bar with a rubber insert, following and wrapping the ends.
for end in (-1, 1):
    pts = []
    for k in range(29):
        x = -.86 + 1.72 * k / 28
        (fx, fy, fz), _ = front_pt(x, .47, end)
        pts.append((x, .47, fz + end * .036))
    # wrap round the corners
    for s in (-1, 1):
        (sx, _, sz), _ = side_pt(end * 1.80, .47, s)
        corner = (s * (abs(sx) + .035), .47, end * 1.80)
        if s < 0:
            pts.insert(0, corner)
        else:
            pts.append(corner)
    prof = [(p[0], p[1]) for p in rr_outline(.06, .115, .026, 3)]
    tube('bumper', pts, 0, 'chrome', profile=prof)
    tube('bumper_rubber', [(p[0], p[1] + .002, p[2] + end * .031) for p in pts[2:-2]], 0, 'rubber',
         profile=[(p[0], p[1]) for p in rr_outline(.02, .035, .008, 2)])
    for s in (-1, 1):
        (bx, by, bz), _ = front_pt(s * .55, .42, end)
        rbox('bumper_bracket', (s * .55, .42, bz + end * .01), (.05, .05, .07), 'under', .01, 1)
    (ux, uy, uz), _ = front_pt(0, .34, end)
    rbox('valance', (0, .33, uz - end * .02), (1.55, .07, .08), 'under', .02, 2)
# Front face: headlamp pods with chrome bezels, a slim intake, badge, indicators.
for s in (-1, 1):
    (x, y, z), n = front_pt(s * .60, .74, 1)
    c = Vector((x, y, z))
    dome('headlamp_pod', c + n * .004, tuple(n), .128, .03, 'paint', 24, 3)
    torus('headlamp_bezel', c + n * .026, tuple(n), .100, .017, 'chrome', 24, 6)
    dome('headlamp_lens', c + n * .03, tuple(n), .092, .03, 'lamp', 24, 4)
    (x, y, z), n = front_pt(s * .62, .565, 1)
    rbox('indicator_frame', (x, y, z + .006), (.16, .06, .016), 'chrome', .012, 2)
    rbox('indicator_lens', (x, y, z + .012), (.14, .045, .012), 'amber', .01, 2)
(x, y, z), n = front_pt(0, .64, 1)
rbox('intake', (0, .64, z + .004), (.60, .05, .02), 'grille', .02, 2)
rbox('intake_chrome', (0, .675, z + .012), (.66, .014, .012), 'chrome', .006, 1)
(x, y, z), n = front_pt(0, .80, 1)
torus('badge_ring', Vector((x, y, z)) + n * .006, tuple(n), .042, .008, 'chrome', 20, 6, sx=1.3)
dome('badge', Vector((x, y, z)) + n * .004, tuple(n), .04, .01, 'chrome', 20, 3, sx=1.3)
for end, py in ((1, .52), (-1, .60)):
    (x, y, z), n = front_pt(0, py, end)
    rbox('plate', (0, py, z + end * .012), (.44, .105, .012), 'plate', .01, 2)
    rbox('plate_band', (-.195, py, z + end * .0195), (.04, .095, .004), 'plateblue', .003, 1)
# Rear: stacked tail lamps in chrome frames, exhaust.
for s in (-1, 1):
    (x, y, z), n = front_pt(s * .66, .73, -1)
    rbox('tail_frame', (s * .66, .73, z - .006), (.18, .26, .018), 'chrome', .03, 2)
    rbox('tail_red', (s * .66, .775, z - .014), (.15, .15, .014), 'tail', .025, 2)
    rbox('tail_amber', (s * .66, .645, z - .014), (.15, .055, .014), 'amber', .015, 2)
cyl('exhaust', (.42, .29, -1.80), (.42, .29, -2.08), .026, 'under', 12)
# Door shut lines, handles, side indicator and the driver's mirror.
for s in (-1, 1):
    for z in (.76, -.36):
        pts = []
        for k in range(12):
            y = .40 + (1.0 - .40) * k / 11
            (px, py, pz), n = side_pt(z, y, s)
            pts.append(tuple(Vector((px, py, pz)) + n * .0015))
        tube('door_line', pts, .0045, 'rubber', 6)
    pts = []
    for k in range(16):
        z = -.36 + (.76 + .36) * k / 15
        (px, py, pz), n = side_pt(z, .40, s)
        pts.append(tuple(Vector((px, py, pz)) + n * .0015))
    tube('door_line_low', pts, .0045, 'rubber', 6)
    (px, py, pz), n = side_pt(-.24, .92, s)
    rbox('door_handle', (px + s * .012, .92, -.24), (.03, .03, .16), 'chrome', .012, 2)
    (px, py, pz), n = side_pt(1.62, .84, s)
    rbox('side_indicator', (px + s * .004, .84, 1.62), (.014, .035, .07), 'amber', .01, 1)
(px, py, pz), n = side_pt(.66, .97, 1)
cyl('mirror_arm', (px, 1.04, .66), (.915, 1.12, .70), .014, 'chrome', 8)
torus('mirror_rim', (.922, 1.14, .705), (0, 0, 1), .052, .012, 'chrome', 20, 6)
dome('mirror_back', (.922, 1.14, .705), (0, 0, 1), .052, .03, 'chrome', 20, 3)
dome('mirror_glass', (.922, 1.14, .69), (0, 0, -1), .046, .004, 'chrome', 20, 2)
# Wipers parked on the cowl.
for px in (-.36, .18):
    cyl('wiper', (px, 1.075, .79), (px + .40, 1.11, .74), .01, 'rubber', 6)
# Cabin: dashboard, steering wheel, seats.
rbox('dashboard', (0, 1.06, .56), (1.60, .14, .30), 'dash', .05, 3)
torus('steering_wheel', (.40, 1.17, .38), (0, .55, 1), .17, .016, 'dash', 28, 6)
cyl('steering_column', (.40, 1.10, .50), (.40, 1.17, .38), .02, 'dash', 8)
for sx in (-.40, .40):
    rbox('seat_back', (sx, 1.20, -.08), (.46, .46, .10), 'seat', .06, 2, rot=rot_game('x', -.22))
    rbox('seat_top', (sx, 1.43, -.13), (.40, .10, .11), 'seatdark', .05, 2, rot=rot_game('x', -.22))
rbox('rear_bench', (0, 1.14, -1.02), (1.36, .34, .12), 'seat', .06, 2, rot=rot_game('x', -.12))
# Dark cabin shell: the greenhouse cage shrunk 4.5 % with its faces turned
# inward, so the far side of the cabin reads as headliner, never as street.
GH_C = Vector((0.0, 1.30, -.36))


def cabin_shape(i, j, k):
    p = Vector(gh_shape(i, j, k))
    return tuple(GH_C + (p - GH_C) * .955)


cabin_ob = lattice_box('cabin_shell', len(GU), len(GY), 8, cabin_shape,
                       lambda side, a, b: 'drop' if side == 'y-' else 'lining', level=0)
for p in cabin_ob.data.polygons:
    p.flip()
    p.use_smooth = False
log('objects', len(OBJS))


# -------------------------------------------------------------- merge by role --
def role_of(ob):
    roles = {ob.data.materials[min(p.material_index, len(ob.data.materials) - 1)]['role'] for p in ob.data.polygons}
    return roles


groups = {}
for ob in list(OBJS):
    roles = role_of(ob)
    if len(roles) == 1:
        groups.setdefault(roles.pop(), []).append(ob)
        continue
    # split multi-role meshes (the tub carries paint + dash) by material role
    for role in roles:
        dup = ob.copy()
        dup.data = ob.data.copy()
        bpy.context.collection.objects.link(dup)
        bm = bmesh.new()
        bm.from_mesh(dup.data)
        mats = dup.data.materials
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
    ob.name = ob.data.name = 'car_' + role
    merged[role] = ob
log('roles', {r: len(o.data.polygons) for r, o in merged.items()})


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


uv_pack(merged['paint'])
uv_pack(merged['trim'])
for role, ob in merged.items():
    if role in ('paint', 'trim'):
        continue
    uvl = ob.data.uv_layers.new(name='UVMap')
    for l in ob.data.loops:
        p = gam(ob.data.vertices[l.vertex_index].co)
        uvl.data[l.index].uv = ((p[0] + 1) / 2, p[1] / 2)
log('uv packed')


# ------------------------------------------------------------ review render --
def review(path, cam_game, look_game, res=(1200, 800), lens=45, samples=64):
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
        if ENV.exists():
            tex = nt.nodes.new('ShaderNodeTexEnvironment')
            tex.image = bpy.data.images.load(str(ENV))
            nt.links.new(tex.outputs['Color'], nt.nodes['Background'].inputs['Color'])
        ground = bpy.data.objects.new('review_ground', bpy.data.meshes.new('review_ground'))
        bm = bmesh.new()
        for x, y in ((-40, -40), (40, -40), (40, 40), (-40, 40)):
            bm.verts.new((x, y, 0))
        bm.faces.new(bm.verts)
        bm.to_mesh(ground.data)
        bm.free()
        gm = bpy.data.materials.new('review_ground')
        gm.use_nodes = True
        gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.20, .21, .27, 1)
        ground.data.materials.append(gm)
        bpy.context.collection.objects.link(ground)
        scene.camera = cam
    cam = bpy.data.objects['review_cam']
    cam.data.lens = lens
    cam.location = nat(cam_game)
    cam.rotation_euler = (nat(look_game) - nat(cam_game)).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    log('review', path.name)


if PREVIEW:
    review(REVIEW / 'front34.png', (3.2, 1.6, 6.0), (0, .75, 0), lens=40)
    review(REVIEW / 'rear34.png', (-3.4, 1.8, -5.6), (0, .75, 0), lens=40)
    review(REVIEW / 'side.png', (6.5, 1.3, 0.3), (0, .8, 0), lens=45)

# ------------------------------------------------------------------ bakes ---
if not NO_BAKE:
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 128
    if scene.world is None:
        scene.world = bpy.data.worlds.new('bake_world')
    scene.world.light_settings.distance = .5
    if 'review_ground' not in bpy.data.objects:
        ground = bpy.data.objects.new('bake_ground', bpy.data.meshes.new('bake_ground'))
        bm = bmesh.new()
        for x, y in ((-40, -40), (40, -40), (40, 40), (-40, 40)):
            bm.verts.new((x, y, 0))
        bm.faces.new(bm.verts)
        bm.to_mesh(ground.data)
        bm.free()
        bpy.context.collection.objects.link(ground)
    merged['glass'].hide_render = True

    def bake_into(ob, key, size, kind, **kw):
        im = bpy.data.images.new('bake_' + key, size, size, float_buffer=True, alpha=False)
        im.colorspace_settings.name = 'Non-Color'
        for m in ob.data.materials:
            nt = m.node_tree
            node = nt.nodes.get('bake_target') or nt.nodes.new('ShaderNodeTexImage')
            node.name = 'bake_target'
            node.image = im
            nt.nodes.active = node
        bpy.ops.object.select_all(action='DESELECT')
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
        t = time.time()
        bpy.ops.object.bake(type=kind, margin=8, margin_type='EXTEND', use_clear=True, **kw)
        px = np.empty(size * size * 4, dtype=np.float32)
        im.pixels.foreach_get(px)
        np.save(BUILD / ('bake_%s.npy' % key), px.reshape(size, size, 4))
        log('baked', key, '%.1fs' % (time.time() - t))

    bake_into(merged['paint'], 'paint_ao', 1024, 'AO')
    bake_into(merged['trim'], 'trim_ao', 1024, 'AO')
    looks = {}
    for m in merged['trim'].data.materials:
        bsdf = m.node_tree.nodes['Principled BSDF']
        looks[m.name] = [(k, bsdf.inputs[k].default_value) for k in ('Metallic', 'Coat Weight', 'Transmission Weight')]
        for k, _ in looks[m.name]:
            bsdf.inputs[k].default_value = 0.0
    bake_into(merged['trim'], 'trim_albedo', 1024, 'DIFFUSE', pass_filter={'COLOR'})
    for m in merged['trim'].data.materials:
        bsdf = m.node_tree.nodes['Principled BSDF']
        for k, v in looks[m.name]:
            bsdf.inputs[k].default_value = v
    saved = {}
    for m in merged['trim'].data.materials:
        nt = m.node_tree
        out = nt.nodes['Material Output']
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = (m['coat'], m['rough'], m['metal'], 1)
        saved[m.name] = out.inputs['Surface'].links[0].from_socket if out.inputs['Surface'].links else None
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    bake_into(merged['trim'], 'trim_orm', 512, 'EMIT')
    for m in merged['trim'].data.materials:
        if saved.get(m.name) is not None:
            m.node_tree.links.new(saved[m.name], m.node_tree.nodes['Material Output'].inputs['Surface'])
    merged['glass'].hide_render = False


# ------------------------------------------------------------ pack meshes ---
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


for ob in merged.values():
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
parts, meshes = [], {}
for role in ('paint', 'trim', 'glass', 'lamp', 'amber', 'tail'):
    ob = merged[role]
    meshes[ob.name] = packed(ob)
    parts.append({'mesh': ob.name, 'role': role})
low = [min(m['min'][i] for m in meshes.values()) for i in range(3)]
high = [max(m['max'][i] for m in meshes.values()) for i in range(3)]
total = sum(m['triangles'] for m in meshes.values())
log('triangles', total, {k: v['triangles'] for k, v in meshes.items()}, 'bounds', low, high)
assert low[0] >= -1.0 and high[0] <= 1.0 and low[1] >= -1e-5 and high[1] <= 1.95 and low[2] >= -2.1 and high[2] <= 2.1, (low, high)
(BUILD / 'parts.json').write_text(json.dumps({'parts': parts, 'meshes': meshes, 'renderBounds': {'min': low, 'max': high},
                                              'triangles': total}, separators=(',', ':')))
for name in ('review_cam', 'review_sun', 'review_ground', 'bake_ground'):
    if name in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for ob in merged.values():
    ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / 'berlin-reference-car-v152.glb'), use_selection=True, export_format='GLB',
                          export_normals=True, export_materials='EXPORT', export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'berlin-reference-car-v152.blend'))
log('done')
