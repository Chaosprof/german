"""V152 reference tram: the art-direction still's Tatra-style coach, rebuilt to match it.

blender -b --python tools/stage_berlin_tram_v152.py -- [--preview] [--no-bake]

The V126 coach read as a pale box on legs beside audit/berlin-kiez-art-direction-v1.png.
This build follows the reference's front and roof instead:
  * a tall, near-full-width windscreen (41-86 % of the body height) under a
    rounded cream roof cap carrying the amber route lamp;
  * a thin cream strip under the glass, then the yellow nose with two low
    round headlamps just above a chunky charcoal bumper;
  * a long charcoal roof equipment box and a single-arm pantograph with the
    reference's T-shaped collector head and curled horns;
  * a grey skirt that hides the bogies, a door directly behind the cab and
    tall windows with transom lights along the cream band.

Everything is authored in game coordinates (x across, y up, z along the track,
the -z end faces the chase camera) and converted to Blender's Z-up frame.
Outputs go to audit/berlin-vehicles-v152/tram/:
  models/berlin-reference-tram-v152.{blend,glb}   editable/native source
  build/parts.json                                 packed runtime meshes per role
  build/bake_{albedo,ao,orm}.npy                   raw linear bakes (bottom-up rows)
  review/*.png                                     Cycles review renders (--preview)
tools/finish_berlin_tram_v152.py composes the textures and writes the shipping
JSON/inline script. The obstacle contract is unchanged: footprint 2.5 x 8 m,
collider 3.15 m. The pantograph head rises to 4.98 m (render envelope 5.0 m).
"""
import bpy, bmesh, math, json, base64, struct, sys, time
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit' / 'berlin-vehicles-v152' / 'tram'
OUT, BUILD, REVIEW = STAGE / 'models', STAGE / 'build', STAGE / 'review'
for p in (OUT, BUILD, REVIEW):
    p.mkdir(parents=True, exist_ok=True)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW, NO_BAKE = '--preview' in ARGS, '--no-bake' in ARGS
ENV = ROOT / 'assets' / 'img' / 'berlin-street-env-v1.jpg'
T0 = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.scale_length = 1.0


def log(*a):
    print('[tram152 %6.1fs]' % (time.time() - T0), *a, flush=True)


# ------------------------------------------------------------------ palette --
def lin(c):
    return ((c + .055) / 1.055) ** 2.4 if c > .04045 else c / 12.92


def hex_lin(h):
    return tuple(lin(((h >> s) & 255) / 255) for s in (16, 8, 0))


# name: (sRGB hex, roughness, metallic, clearcoat, runtime role)
PAL = {
    'yellow':  (0xd8a234, .34, .0, 1., 'body'),
    'cream':   (0xe0d6c4, .36, .0, 1., 'body'),
    'roof':    (0xc9c2b4, .52, .0, .4, 'body'),
    'charcoal': (0x30343a, .48, .05, .3, 'body'),
    'skirt':   (0x55575c, .50, .05, .5, 'body'),
    'rubber':  (0x1b1d20, .80, .0, 0., 'body'),
    'chrome':  (0xd9dde0, .14, 1., 0., 'body'),
    'steel':   (0x80878c, .36, .75, 0., 'body'),
    'bronze':  (0x9a7a45, .30, .8, 0., 'body'),
    'under':   (0x24272b, .75, .1, 0., 'body'),
    'insul':   (0xd8d2c4, .30, .0, .6, 'body'),
    'badge':   (0x2a3a52, .30, .2, .8, 'body'),
    'floor':   (0x4b4540, .86, .0, 0., 'interior'),
    'seat':    (0x7c4f2e, .55, .0, 0., 'interior'),
    'seatfab': (0x8b3f2c, .80, .0, 0., 'interior'),
    'wood':    (0x8f6139, .50, .0, 0., 'interior'),
    'wallin':  (0xb3a083, .78, .0, 0., 'interior'),
    'pole':    (0xc7a04a, .30, .6, 0., 'interior'),
    'console': (0x2b3034, .50, .1, 0., 'interior'),
    'cabwall': (0x6e4a31, .70, .0, 0., 'interior'),
    'glass':   (0x9fb2bd, .04, .0, 0., 'glass'),
    'lamp':    (0xfff3dc, .20, .0, 0., 'lamp'),
    'roofLamp': (0xffa532, .20, .0, 0., 'roofLamp'),
    'ilight':  (0xfff0d6, .20, .0, 0., 'interiorLight'),
    'tail':    (0xff4d3d, .30, .0, 0., 'tail'),
    'dest':    (0x101010, .50, .0, 0., 'destination'),
}
MATS = {}
for name, (hx, rough, metal, coat, role) in PAL.items():
    m = bpy.data.materials.new('tram_' + name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*hex_lin(hx), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    b.inputs['Coat Weight'].default_value = coat * .8
    b.inputs['Coat Roughness'].default_value = .05
    if role in ('lamp', 'roofLamp', 'interiorLight', 'tail'):
        b.inputs['Emission Color'].default_value = (*hex_lin(hx), 1)
        b.inputs['Emission Strength'].default_value = 4.0
    if role == 'glass':
        b.inputs['Transmission Weight'].default_value = .92
        b.inputs['IOR'].default_value = 1.45
    m['role'], m['rough'], m['metal'], m['coat'] = role, rough, metal, coat
    MATS[name] = m


# --------------------------------------------------------------- geometry --
def nat(p):
    """Game (x, y up, z along) -> Blender (x, y, z up)."""
    return Vector((p[0], -p[2], p[1]))


def gam(v):
    return (v.x, v.z, -v.y)


OBJS = []


def finish(name, bm, mats, smooth=True, sharp=40):
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
    """Rounded box centred at game c with game size (sx, sy, sz)."""
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
    """Rotation about a game axis ('x','y','z') expressed in Blender space."""
    ax = {'x': Vector((1, 0, 0)), 'y': Vector((0, 0, 1)), 'z': Vector((0, -1, 0))}[axis]
    return Matrix.Rotation(ang, 4, ax)


def cyl(name, a, b, r, mat, seg=12, caps=True, smooth=True, r2=None):
    """Cylinder between game points a and b."""
    a, b = nat(a), nat(b)
    d = b - a
    L = d.length
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=seg, radius1=r,
                          radius2=r if r2 is None else r2, depth=L)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    M = Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return finish(name, bm, [mat], smooth, 50)


def tube(name, pts, r, mat, seg=10, caps=True):
    """Round tube swept along a game-space polyline (parallel-transported frame)."""
    P = [nat(p) for p in pts]
    bm = bmesh.new()
    rings = []
    prev_n = None
    for i, p in enumerate(P):
        t = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        if prev_n is None:
            ref = Vector((0, 0, 1)) if abs(t.z) < .9 else Vector((1, 0, 0))
            n = t.cross(ref).normalized()
        else:
            n = (prev_n - t * prev_n.dot(t)).normalized()
        prev_n = n
        bn = t.cross(n)
        rings.append([bm.verts.new(p + (n * math.cos(math.tau * k / seg) + bn * math.sin(math.tau * k / seg)) * r)
                      for k in range(seg)])
    for i in range(len(rings) - 1):
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % seg], rings[i + 1][(k + 1) % seg], rings[i + 1][k]))
    if caps:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, [mat], True, 60)


def torus(name, c, normal_game, R, r, mat, seg=28, rseg=8):
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = math.tau * i / seg
        ring = []
        for j in range(rseg):
            t = math.tau * j / rseg
            rr = R + r * math.cos(t)
            ring.append(bm.verts.new((rr * math.cos(a), rr * math.sin(a), r * math.sin(t))))
        rings.append(ring)
    for i in range(seg):
        for j in range(rseg):
            a0, a1 = rings[i][j], rings[i][(j + 1) % rseg]
            b0, b1 = rings[(i + 1) % seg][j], rings[(i + 1) % seg][(j + 1) % rseg]
            bm.faces.new((a0, b0, b1, a1))
    n = nat(normal_game) - nat((0, 0, 0))
    q = Vector((0, 0, 1)).rotation_difference(n.normalized())
    bmesh.ops.transform(bm, matrix=Matrix.Translation(nat(c)) @ q.to_matrix().to_4x4(), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, [mat], True, 60)


def dome(name, c, normal_game, r, depth, mat, seg=24, rings=5, sx=1.0):
    """Shallow spherical cap (a lens) facing normal_game; sx stretches it across."""
    bm = bmesh.new()
    top = bm.verts.new((0, 0, depth))
    prev = [top]
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
    # keep the stretched axis horizontal (game x) for front-facing lenses
    R = q.to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation(nat(c)) @ R, verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, [mat], True, 70)


def rr_outline(w, h, r, n=5):
    """Rounded rectangle outline (u, v) centred at 0, counter-clockwise."""
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


# ------------------------------------------------------------ body shell ----
def plan_ring(w, d, rx, rz, bow, ns=6, nc=14, ne=7):
    rx, rz = min(rx, w * .92), min(rz, d * .5)
    q = [(w, (d - rz) * i / ns) for i in range(ns)]
    q += [(w - rx + rx * math.cos(math.pi / 2 * i / nc), d - rz + rz * math.sin(math.pi / 2 * i / nc)) for i in range(nc)]
    q += [((w - rx) * (1 - i / ne), d) for i in range(ne)]
    Q2 = [(0.0, d)] + [(-x, z) for x, z in reversed(q[1:])]
    Q3 = [(-w, 0.0)] + [(-x, -z) for x, z in q[1:]]
    Q4 = [(0.0, -d)] + [(x, -z) for x, z in reversed(q[1:])]
    ring = q + Q2 + Q3 + Q4

    def bowed(x, z):
        t = max(0.0, min(1.0, (abs(z) - (d - rz)) / rz))
        t = t * t * (3 - 2 * t)
        return x, math.copysign(abs(z) - bow * (x / w) ** 2 * t, z)
    return [bowed(x, z) for x, z in ring]


HW = 1.07   # half width at the belt
# y, half-width, half-length, plan corner rx, rz, front bow
ROWS = [
    (0.300, 1.030, 3.840, .33, .40, .085),
    (0.330, 1.055, 3.872, .34, .41, .085),
    (0.380, 1.066, 3.890, .345, .42, .085),
    (0.460, 1.070, 3.900, .35, .42, .085),
    (0.900, 1.070, 3.905, .35, .42, .085),
    (1.300, 1.070, 3.905, .35, .42, .085),
    (1.420, 1.070, 3.903, .35, .42, .085),
    (2.000, 1.069, 3.882, .35, .42, .082),
    (2.600, 1.066, 3.858, .35, .42, .080),
    (2.860, 1.062, 3.842, .35, .42, .078),
    (2.950, 1.055, 3.820, .35, .42, .076),
    (3.030, 1.040, 3.785, .35, .42, .072),
    (3.100, 1.012, 3.728, .34, .41, .066),
    (3.160, 0.965, 3.650, .33, .40, .058),
    (3.210, 0.895, 3.548, .31, .38, .048),
    (3.250, 0.795, 3.425, .29, .36, .038),
    (3.280, 0.650, 3.290, .26, .33, .028),
    (3.298, 0.430, 3.160, .21, .28, .018),
    (3.305, 0.180, 3.050, .12, .18, .010),
]


def loft(name, rows, mat_for_y, cap_bottom=None, cap_top=None, ring_fn=plan_ring):
    bm = bmesh.new()
    rings = []
    for y, w, d, rx, rz, bow in rows:
        rings.append([bm.verts.new(nat((x, y, z))) for x, z in ring_fn(w, d, rx, rz, bow)])
    n = len(rings[0])
    names = []
    for j in range(len(rings) - 1):
        mid = (rows[j][0] + rows[j + 1][0]) / 2
        mn = mat_for_y(mid)
        if mn not in names:
            names.append(mn)
        for i in range(n):
            f = bm.faces.new((rings[j][i], rings[j][(i + 1) % n], rings[j + 1][(i + 1) % n], rings[j + 1][i]))
            f.material_index = names.index(mn)
    for ring, mn in ((rings[0], cap_bottom), (rings[-1], cap_top)):
        if mn:
            if mn not in names:
                names.append(mn)
            f = bm.faces.new(ring)
            f.material_index = names.index(mn)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, names, True, 34)


YELLOW_TOP, CREAM_TOP, SKIRT_TOP = 1.30, 3.03, 0.46


def band_material(y):
    if y < SKIRT_TOP:
        return 'skirt'
    if y < YELLOW_TOP:
        return 'yellow'
    return 'cream' if y < CREAM_TOP else 'roof'


# Split the rows exactly at the livery lines so every band edge is a ring.
def insert_row(rows, y):
    for k in range(len(rows) - 1):
        a, b = rows[k], rows[k + 1]
        if a[0] < y < b[0]:
            t = (y - a[0]) / (b[0] - a[0])
            rows.insert(k + 1, tuple([y] + [a[i] + (b[i] - a[i]) * t for i in range(1, 6)]))
            return


for yy in (YELLOW_TOP, CREAM_TOP, SKIRT_TOP, 0.60, 0.75, 1.10, 1.70, 2.30):
    if all(abs(r[0] - yy) > 1e-6 for r in ROWS):
        insert_row(ROWS, yy)
ROWS.sort()

shell = loft('coach_shell', ROWS, band_material, cap_bottom='under', cap_top='roof')
_bvh_src = shell.evaluated_get(bpy.context.evaluated_depsgraph_get())
BVH = BVHTree.FromObject(_bvh_src, bpy.context.evaluated_depsgraph_get())


def end_hit(x, y, end):
    """Front/back surface point and outward normal at lateral x, height y."""
    o = nat((x, y, end * 10.0))
    d = nat((0, 0, -end)) - nat((0, 0, 0))
    loc, nrm, _, _ = BVH.ray_cast(o, d)
    assert loc is not None, ('no end surface', x, y, end)
    return gam(loc), gam(nrm)


def side_hit(z, y, side):
    o = nat((side * 5.0, y, z))
    d = nat((-side, 0, 0)) - nat((0, 0, 0))
    loc, nrm, _, _ = BVH.ray_cast(o, d)
    assert loc is not None, ('no side surface', z, y, side)
    return gam(loc), gam(nrm)


# Thin coachwork: solidify inward, inner faces use the cabin lining.
nm = len(shell.data.materials)
for i in range(nm):
    shell.data.materials.append(MATS['wallin'])
sol = shell.modifiers.new('coachwork', 'SOLIDIFY')
sol.thickness, sol.offset, sol.use_rim, sol.use_even_offset = .045, -1, True, True
sol.material_offset = nm
apply_mod(shell, sol)
_wall_slot = [m.name for m in shell.data.materials].index('tram_wallin')
for p in shell.data.polygons:
    if p.material_index >= nm:
        p.material_index = _wall_slot
log('shell', len(shell.data.polygons), 'faces')

# ---------------------------------------------------------------- layout ----
WIN_Y0, WIN_Y1, WIN_R = 1.46, 2.80, .085
TRANSOM_Y = 2.53
PASS = [(-2.06, -1.00), (-0.88, 0.18), (0.30, 1.36), (2.62, 3.34)]
CABWIN = [(-3.64, -3.30)]
DOORS = [(-3.18, -2.20), (1.50, 2.48)]
DOOR_Y0, DOOR_Y1 = 0.40, 2.82
WS_W, WS_Y0, WS_Y1, WS_R = 1.86, 1.42, 2.86, .17
RW_W, RW_Y0, RW_Y1, RW_R = 1.40, 1.52, 2.74, .14   # rear window (+z end)


def prism(name, outline_uv, axis, center, depth, mat):
    """Closed prism: rounded outline (u, v) extruded along the game axis."""
    bm = bmesh.new()
    cx, cy, cz = center
    layers = []
    for s in (-depth / 2, depth / 2):
        ring = []
        for u, v in outline_uv:
            if axis == 'x':
                p = (cx + s, cy + v, cz + u)
            else:
                p = (cx + u, cy + v, cz + s)
            ring.append(bm.verts.new(nat(p)))
        layers.append(ring)
    n = len(outline_uv)
    bm.faces.new(layers[0])
    bm.faces.new(list(reversed(layers[1])))
    for i in range(n):
        bm.faces.new((layers[0][i], layers[0][(i + 1) % n], layers[1][(i + 1) % n], layers[1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    me.materials.append(MATS[mat])
    return ob


cutters = []
for s in (-1, 1):
    for z0, z1 in PASS + CABWIN:
        cutters.append(prism('cut', rr_outline(z1 - z0, WIN_Y1 - WIN_Y0, WIN_R, 6), 'x',
                             (s * HW, (WIN_Y0 + WIN_Y1) / 2, (z0 + z1) / 2), .5, 'cream'))
    for z0, z1 in DOORS:
        cutters.append(prism('cut', rr_outline(z1 - z0, DOOR_Y1 - DOOR_Y0, .07, 5), 'x',
                             (s * HW, (DOOR_Y0 + DOOR_Y1) / 2, (z0 + z1) / 2), .5, 'yellow'))
cutters.append(prism('cut', rr_outline(WS_W, WS_Y1 - WS_Y0, WS_R, 8), 'z', (0, (WS_Y0 + WS_Y1) / 2, -3.84), .8, 'cream'))
cutters.append(prism('cut', rr_outline(RW_W, RW_Y1 - RW_Y0, RW_R, 8), 'z', (0, (RW_Y0 + RW_Y1) / 2, 3.86), .7, 'cream'))
bpy.ops.object.select_all(action='DESELECT')
for c in cutters:
    c.select_set(True)
bpy.context.view_layer.objects.active = cutters[0]
bpy.ops.object.join()
cutter = bpy.context.view_layer.objects.active
boo = shell.modifiers.new('apertures', 'BOOLEAN')
boo.operation, boo.solver, boo.object = 'DIFFERENCE', 'EXACT', cutter
boo.material_mode = 'TRANSFER'
apply_mod(shell, boo)
bpy.data.objects.remove(cutter, do_unlink=True)
shell.data.set_sharp_from_angle(angle=math.radians(34))
log('apertures cut', len(shell.data.polygons), 'faces')
lining = shell.copy()
lining.data = shell.data.copy()
lining.name = 'coach_lining'
bpy.context.collection.objects.link(lining)
wall_idx = {i for i, m in enumerate(shell.data.materials) if m.name == 'tram_wallin'}
for ob, keep_wall in ((shell, False), (lining, True)):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.material_index in wall_idx) != keep_wall], context='FACES')
    bm.to_mesh(ob.data)
    bm.free()
OBJS.append(lining)


# ----------------------------------------------------------- mouldings ------
def interp_row(y):
    for k in range(len(ROWS) - 1):
        if ROWS[k][0] <= y <= ROWS[k + 1][0]:
            t = (y - ROWS[k][0]) / (ROWS[k + 1][0] - ROWS[k][0])
            a, b = ROWS[k], ROWS[k + 1]
            return [a[i] + (b[i] - a[i]) * t for i in range(1, 6)]
    raise ValueError(y)


def ring_band(name, y0, y1, grow, mat, profile=None):
    """Proud horizontal moulding following the plan shape between y0 and y1."""
    profile = profile or ((0.0, 0.0), (.2, 1.0), (.8, 1.0), (1.0, 0.0))
    rows = []
    for f, g in profile:
        y = y0 + (y1 - y0) * f
        w, d, rx, rz, bow = interp_row(y)
        rows.append((y, w + g * grow, d + g * grow, rx + g * grow, rz + g * grow, bow))
    return loft(name, rows, lambda y: mat)


def cut_at_doors(ob, include_ends=False):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    gone = [f for f in bm.faces if abs(f.calc_center_median().x) > .9 and
            any(z0 - .02 < -f.calc_center_median().y < z1 + .02 for z0, z1 in DOORS)]
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    bm.to_mesh(ob.data)
    bm.free()


# Cream belt moulding on the livery line and a rain gutter above the windows.
cut_at_doors(ring_band('belt_moulding', YELLOW_TOP - .02, YELLOW_TOP + .035, .016, 'cream',
                       ((0, 0), (.25, 1), (.75, 1), (1, .2))))
cut_at_doors(ring_band('skirt_lip', SKIRT_TOP - .018, SKIRT_TOP + .012, .012, 'skirt'))
rain = ring_band('rain_gutter', 2.925, 2.965, .018, 'cream', ((0, 0), (.3, 1), (.8, 1), (1, .3)))
# The gutter runs along the sides only: the reference's front cap is smooth.
bm = bmesh.new()
bm.from_mesh(rain.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if abs(f.calc_center_median().y) > 3.45], context='FACES')
bm.to_mesh(rain.data)
bm.free()


# ------------------------------------------------------ gaskets and glass ---
def frame_ring(name, outline_outer, outline_inner, place, mat):
    """Rounded frame between two outlines; place(u, v, layer) -> game point."""
    bm = bmesh.new()
    n = len(outline_outer)
    L = []
    for layer, ol in ((0, outline_outer), (1, outline_inner), (2, outline_inner), (3, outline_outer)):
        L.append([bm.verts.new(nat(place(u, v, layer))) for u, v in ol])
    for a, b in ((0, 1), (1, 2), (2, 3), (3, 0)):
        for i in range(n):
            bm.faces.new((L[a][i], L[a][(i + 1) % n], L[b][(i + 1) % n], L[b][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, [mat], True, 50)


def pane(name, outline, place, mat, outward):
    """Flat pane facing the game direction 'outward' (glass renders one-sided)."""
    bm = bmesh.new()
    vs = [bm.verts.new(nat(place(u, v))) for u, v in outline]
    f = bm.faces.new(vs)
    bm.normal_update()
    if f.normal.dot(nat(outward) - nat((0, 0, 0))) < 0:
        f.normal_flip()
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return finish(name, bm, [mat], False)


for s in (-1, 1):
    for z0, z1 in PASS + CABWIN:
        zc, w, h = (z0 + z1) / 2, z1 - z0, WIN_Y1 - WIN_Y0
        yc = (WIN_Y0 + WIN_Y1) / 2
        # follow the actual side surface (the cab window sits on the corner curve)
        (sx0, _, _), sn = side_hit(zc, yc, s)
        xo = sx0
        outer, inner = rr_outline(w + .024, h + .024, WIN_R + .012, 6), rr_outline(w - .036, h - .036, WIN_R - .01, 6)

        def place(u, v, layer, zc=zc, yc=yc, xo=xo, s=s):
            depth = (.014, .014, -.035, -.035)[layer]
            return (xo + s * depth, yc + v, zc + u)
        frame_ring('side_gasket', outer, inner, place, 'rubber')
        pane('side_glass', rr_outline(w - .035, h - .035, WIN_R - .01, 6),
             lambda u, v, zc=zc, yc=yc, xo=xo, s=s: (xo - s * .024, yc + v, zc + u), 'glass', (s, 0, 0))
        # Transom bar: the reference's small upper light in every tall window.
        rbox('transom_bar', (xo - s * .012, TRANSOM_Y, zc), (.034, .032, w - .03), 'rubber', .01, 1)
        if (z0, z1) != CABWIN[0] and w > .9:
            rbox('window_mullion', (xo - s * .012, (WIN_Y0 + TRANSOM_Y) / 2, zc), (.03, TRANSOM_Y - WIN_Y0 - .02, .028),
                 'rubber', .008, 1)
    for di, (z0, z1) in enumerate(DOORS):
        zc, w = (z0 + z1) / 2, z1 - z0
        xo = s * (HW - .035)
        rbox('door_reveal', (s * (HW - .05), (DOOR_Y0 + DOOR_Y1) / 2, zc), (.02, DOOR_Y1 - DOOR_Y0 - .02, w - .02), 'under', .01, 1)
        for leaf in (-1, 1):
            lz = zc + leaf * w / 4
            lw = w / 2 - .014
            # Yellow kick panel, slim stiles and rails; nearly full-height glazing.
            rbox('door_panel', (xo, 0.58, lz), (.032, .34, lw), 'yellow', .012, 1)
            rbox('door_rail_mid', (xo + s * .004, 0.77, lz), (.036, .05, lw), 'yellow', .012, 1)
            rbox('door_rail_top', (xo + s * .004, DOOR_Y1 - .07, lz), (.036, .07, lw), 'yellow', .012, 1)
            for st in (-1, 1):
                rbox('door_stile', (xo + s * .004, 1.62, lz + st * (lw / 2 - .026)), (.036, 2.30, .052), 'yellow', .012, 1)
            gh = DOOR_Y1 - .12 - 0.80
            gy = 0.80 + gh / 2
            pane('door_glass', rr_outline(lw - .09, gh - .02, .045),
                 lambda u, v, lz=lz, xo=xo, s=s, gy=gy: (xo, gy + v, lz + u), 'glass', (s, 0, 0))
            frame_ring('door_gasket', rr_outline(lw - .07, gh, .05), rr_outline(lw - .10, gh - .03, .038),
                       lambda u, v, layer, lz=lz, xo=xo, s=s, gy=gy: (xo + s * (.02, .02, -.006, -.006)[layer], gy + v, lz + u), 'rubber')
            cyl('door_handle', (xo + s * .05, 1.05, lz - leaf * .13), (xo + s * .05, 1.55, lz - leaf * .13), .013, 'chrome', 8)
        rbox('door_seam', (xo + s * .014, 1.62, zc), (.022, DOOR_Y1 - DOOR_Y0 - .04, .02), 'rubber', .006, 1)
        rbox('door_step', (s * (HW - .01), .36, zc), (.07, .045, w + .02), 'steel', .012, 1)

# ------------------------------------------------ windscreen and front end ---
WS_OUT = rr_outline(WS_W + .03, WS_Y1 - WS_Y0 + .03, WS_R + .012, 8)
WS_IN = rr_outline(WS_W - .026, WS_Y1 - WS_Y0 - .026, WS_R - .01, 8)
WS_YC = (WS_Y0 + WS_Y1) / 2


def place_front(u, v, layer, end=-1, yc=WS_YC):
    (x, y, z), _ = end_hit(u, yc + v, end)
    return (x, y, z + end * (.016, .016, -.04, -.04)[layer])


frame_ring('cab_gasket', WS_OUT, WS_IN, place_front, 'rubber')


def curved_glass(name, W, Y0, Y1, R, end, inset):
    bm = bmesh.new()
    cols, rws = 21, 11
    grid = []
    ww, hh = W - .03, Y1 - Y0 - .03
    yc = (Y0 + Y1) / 2
    for j in range(rws):
        v = -hh / 2 + hh * j / (rws - 1)
        row = []
        for i in range(cols):
            u = -ww / 2 + ww * i / (cols - 1)
            du, dv = max(0, abs(u) - (ww / 2 - R)), max(0, abs(v) - (hh / 2 - R))
            if du * du + dv * dv > R * R and du > 0 and dv > 0:
                k = R / math.hypot(du, dv)
                u = math.copysign(ww / 2 - R + du * k, u)
                v = math.copysign(hh / 2 - R + dv * k, v)
            (x, y, z), _ = end_hit(u, yc + v, end)
            row.append(bm.verts.new(nat((x, y, z - end * inset))))
        grid.append(row)
    for j in range(rws - 1):
        for i in range(cols - 1):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = finish(name, bm, ['glass'], True, 80)
    want = nat((0, 0, end)) - nat((0, 0, 0))
    if sum(p.normal.dot(want) for p in ob.data.polygons) < 0:
        for p in ob.data.polygons:
            p.flip()
    return ob


curved_glass('windscreen', WS_W, WS_Y0, WS_Y1, WS_R, -1, .028)
# Rear window with its own gasket.
RW_YC = (RW_Y0 + RW_Y1) / 2
frame_ring('rear_gasket', rr_outline(RW_W + .04, RW_Y1 - RW_Y0 + .04, RW_R + .016, 8),
           rr_outline(RW_W - .03, RW_Y1 - RW_Y0 - .03, RW_R - .012, 8),
           lambda u, v, layer: place_front(u, v, layer, 1, RW_YC), 'rubber')
curved_glass('rear_window', RW_W, RW_Y0, RW_Y1, RW_R, 1, .028)

# Wipers: the reference parks two arms in a V on the lower windscreen.
for px, ang, L in ((-.34, 1.02, .66), (.16, 1.10, .62)):
    (x0, y0, z0), _ = end_hit(px, WS_Y0 + .04, -1)
    x1, y1 = x0 + L * math.cos(ang), y0 + L * math.sin(ang)
    (_, _, z1), _ = end_hit(x1, y1, -1)
    cyl('wiper_arm', (x0, y0, z0 - .045), (x1, y1, z1 - .045), .011, 'rubber', 6)
    cyl('wiper_blade', ((x0 + x1) / 2 + .02, (y0 + y1) / 2 - .01, (z0 + z1) / 2 - .04), (x1, y1, z1 - .038), .008, 'rubber', 6)
    cyl('wiper_pivot', (x0, y0 - .03, z0 + .01), (x0, y0 - .03, z0 - .05), .024, 'charcoal', 10)

for end in (-1, 1):
    # Headlamps (front) / tail lamps (rear): chrome bezel, dark housing, domed lens.
    for sx in (-1, 1):
        (x, y, z), n = end_hit(sx * .72, .745, end)
        c, nv = Vector((x, y, z)), Vector(n)
        if end < 0:
            torus('headlamp_bezel', c + nv * .02, n, .128, .02, 'chrome', 32, 8)
            cyl('headlamp_housing', tuple(c - nv * .01), tuple(c + nv * .026), .118, 'chrome', 28)
            dome('headlamp_lens', c + nv * .028, n, .114, .034, 'lamp', 28, 6)
            # small amber indicator outboard of each headlamp
            (x2, y2, z2), n2 = end_hit(sx * .93, .745, end)
            dome('indicator', Vector((x2, y2, z2)) + Vector(n2) * .004, n2, .038, .014, 'roofLamp', 16, 3, sx=1.5)
        else:
            torus('tail_bezel', c + nv * .014, n, .085, .014, 'chrome', 24, 6)
            dome('tail_lens', c + nv * .02, n, .075, .022, 'tail', 20, 4)
    # Chunky charcoal bumper following the bow, wrapping round the corners.
    bm = bmesh.new()
    prof = rr_outline(.11, .235, .05, 4)
    xs = [(-1.02 + 2.04 * i / 40) for i in range(41)]
    rings = []
    for x in xs:
        (_, _, zs), _ = end_hit(x, .34, end)
        wrap = max(0.0, (abs(x) - .80) / .22)
        rings.append([bm.verts.new(nat((x, .335 + v, zs + end * (u + .04 - .03 * wrap * wrap)))) for u, v in prof])
    for i in range(len(rings) - 1):
        for k in range(len(prof)):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % len(prof)], rings[i + 1][(k + 1) % len(prof)], rings[i + 1][k]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    finish('bumper', bm, ['charcoal'], True, 60)
    # A rubber buffer strip along the bumper face.
    bm = bmesh.new()
    prof = rr_outline(.03, .05, .012, 2)
    rings = []
    for x in xs[3:-3]:
        (_, _, zs), _ = end_hit(x, .34, end)
        rings.append([bm.verts.new(nat((x, .345 + v, zs + end * (u + .105)))) for u, v in prof])
    for i in range(len(rings) - 1):
        for k in range(len(prof)):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % len(prof)], rings[i + 1][(k + 1) % len(prof)], rings[i + 1][k]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    finish('buffer_strip', bm, ['rubber'], True, 60)
    # Coupler pocket under the bumper and the dark under-apron.
    (x, y, z), n = end_hit(0, .40, end)
    rbox('apron', (0, .19, end * 3.78), (1.90, .16, .12), 'under', .03, 2)

# Front-only furniture.
(x, y, z), n = end_hit(0, 1.03, -1)
torus('emblem_rim', Vector((x, y, z)) + Vector(n) * .006, n, .068, .011, 'bronze', 24, 6)
dome('emblem_badge', Vector((x, y, z)) + Vector(n) * .004, n, .064, .014, 'badge', 24, 3)
(x, y, z), n = end_hit(0, .575, -1)
rbox('number_plate', (0, .575, z - .008), (.30, .075, .018), 'insul', .014, 2)
rbox('plate_rim', (0, .575, z - .002), (.33, .10, .012), 'chrome', .02, 2)
# Amber route lamp on the rounded roof cap (the reference's glowing oval).
(x, y, z), n = end_hit(0, 3.085, -1)
c, nv = Vector((x, y, z)), Vector(n)
dome('route_light', c + nv * .008, n, .075, .03, 'roofLamp', 28, 5, sx=1.55)
torus_ob = torus('route_light_rim', c + nv * .01, n, .08, .012, 'chrome', 28, 6)
for v in torus_ob.data.vertices:  # stretch the rim into the oval
    v.co.x = v.co.x * 1.5
# Destination display behind the top of the windscreen.
(x, y, z), _ = end_hit(0, 2.70, -1)
rbox('sign_box', (0, 2.705, z + .13), (1.10, .22, .12), 'console', .015, 2)
bm = bmesh.new()
vs = [bm.verts.new(nat((u, 2.705 + v, z + .068))) for u, v in ((-.50, -.075), (.50, -.075), (.50, .075), (-.50, .075))]
bm.faces.new(list(reversed(vs)))
ob = finish('destination', bm, ['dest'], False)
uv = ob.data.uv_layers.new(name='UVMap')
for li, l in enumerate(ob.data.loops):
    p = gam(ob.data.vertices[l.vertex_index].co)
    uv.data[li].uv = (1 - (p[0] + .50) / 1.0, (p[1] - (2.705 - .075)) / .15)
# Exterior mirrors at the front corners.
for sx in (-1, 1):
    (px, py, pz), _ = side_hit(-3.56, 2.34, sx)
    a = (px, 2.34, pz)
    b = (sx * (HW + .12), 2.30, -3.66)
    cyl('mirror_arm', a, b, .015, 'charcoal', 8)
    cyl('mirror_arm_low', (px, 2.08, pz + .02), (sx * (HW + .11), 2.14, -3.65), .012, 'charcoal', 8)
    rbox('mirror_head', (sx * (HW + .13), 2.18, -3.68), (.055, .30, .17), 'charcoal', .03, 3)
    rbox('mirror_glass', (sx * (HW + .13), 2.18, -3.593), (.035, .25, .01), 'chrome', .008, 1)

# ------------------------------------------------------------- the roof -----
BOX_Z0, BOX_Z1 = -3.28, 2.62
rbox('roof_box', (0, 3.41, (BOX_Z0 + BOX_Z1) / 2), (1.42, .36, BOX_Z1 - BOX_Z0), 'charcoal', .10, 4)
# Sloped front fairing of the box (the reference's rounded leading edge).
bm = bmesh.new()
prof = [(-.70, 3.24), (.70, 3.24)]
secs = []
for k in range(9):
    t = k / 8
    zz = BOX_Z0 - .02 - .30 * (1 - t)
    yy = 3.24 + (.34) * (1 - (1 - t) ** 2)
    ww = .62 + .08 * t
    secs.append((zz, yy, ww))
rings = []
for zz, yy, ww in secs:
    ring = []
    for i in range(13):
        a = math.pi * i / 12
        ring.append(bm.verts.new(nat((ww * math.cos(a) * 1.0, 3.24 + (yy - 3.24) * math.sin(a) ** .35, zz))))
    rings.append(ring)
for i in range(len(rings) - 1):
    for k in range(12):
        bm.faces.new((rings[i][k], rings[i][k + 1], rings[i + 1][k + 1], rings[i + 1][k]))
bm.faces.new(rings[0])
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
finish('roof_fairing', bm, ['charcoal'], True, 50)
# Louvre grilles along both flanks and the front vent panel.
for sx in (-1, 1):
    for zc in (-2.30, -0.90, 0.60, 1.90):
        rbox('grille_frame', (sx * .712, 3.43, zc), (.02, .22, .90), 'steel', .01, 1)
        for k in range(6):
            rbox('grille_slat', (sx * .722, 3.35 + k * .033, zc), (.02, .012, .84), 'rubber', .004, 1)
rbox('vent_panel', (0, 3.47, BOX_Z0 + .12), (.62, .14, .02), 'steel', .01, 1)
for k in range(5):
    rbox('vent_slat', (0, 3.415 + k * .027, BOX_Z0 + .108), (.58, .01, .02), 'rubber', .003, 1)
# Raised pantograph platform with a walkway edge.
rbox('panto_platform', (0, 3.615, -1.80), (1.00, .05, 1.70), 'charcoal', .02, 2)
for sx in (-1, 1):
    for z in (-2.45, -1.15):
        cyl('roof_insulator', (sx * .36, 3.64, z), (sx * .36, 3.76, z), .048, 'insul', 14)
        for k in range(3):
            torus('insulator_shed', (sx * .36, 3.665 + k * .03, z), (0, 1, 0), .052, .012, 'insul', 14, 5)
    cyl('base_rail', (sx * .36, 3.78, -2.52), (sx * .36, 3.78, -1.08), .03, 'steel', 10)
cyl('base_cross_a', (-.36, 3.78, -2.45), (.36, 3.78, -2.45), .026, 'steel', 10)
cyl('base_cross_b', (-.36, 3.78, -1.15), (.36, 3.78, -1.15), .026, 'steel', 10)

# Single-arm pantograph: lower arm up to a forward knee, upper arm back up to
# the collector. Seen from the chase camera it reads as the reference's tall
# post under a wide T-shaped head with curled horns.
HINGE, KNEE, HEAD = (0.0, 3.84, -1.22), (0.0, 4.36, -2.42), (0.0, 4.92, -1.72)
cyl('hinge_shaft', (-.30, 3.84, -1.22), (.30, 3.84, -1.22), .035, 'steel', 12)
for sx in (-1, 1):
    cyl('lower_arm', (sx * .16, 3.84, -1.22), (sx * .05, KNEE[1], KNEE[2]), .034, 'charcoal', 12, r2=.026)
cyl('knee_shaft', (-.07, KNEE[1], KNEE[2]), (.07, KNEE[1], KNEE[2]), .03, 'steel', 12)
cyl('upper_arm', KNEE, (0, HEAD[1] - .08, HEAD[2]), .022, 'charcoal', 10, r2=.018)
cyl('push_rod', (.10, 3.88, -1.10), (.04, 4.30, -2.36), .011, 'steel', 8)
cyl('damper', (-.18, 3.80, -1.05), (-.10, 4.02, -1.60), .03, 'steel', 10)
cyl('spring_box', (-.25, 3.83, -.98), (.25, 3.83, -.98), .05, 'charcoal', 12)
# Head support: a V from the arm tip to the pan bar (the reference's Y).
tip = (0, HEAD[1] - .08, HEAD[2])
for sx in (-1, 1):
    cyl('head_strut', tip, (sx * .38, HEAD[1] + .02, HEAD[2]), .014, 'charcoal', 8)
cyl('pan_bar', (-.66, HEAD[1] + .03, HEAD[2]), (.66, HEAD[1] + .03, HEAD[2]), .03, 'charcoal', 12)
cyl('pan_strip', (-.60, HEAD[1] + .062, HEAD[2]), (.60, HEAD[1] + .062, HEAD[2]), .014, 'steel', 8)
for sx in (-1, 1):
    pts = []
    for k in range(13):
        a = math.pi * .5 * k / 12
        pts.append((sx * (.66 + .16 * math.sin(a)), HEAD[1] + .03 - .10 * (1 - math.cos(a)) - .06 * (k / 12) ** 2, HEAD[2]))
    tube('pan_horn', pts, .026, 'charcoal', 10)

# ---------------------------------------------------- underframe and bogies --
rbox('underframe', (0, .24, 0), (1.94, .18, 7.30), 'under', .03, 2)
for bz in (-2.55, 2.55):
    for sx in (-1, 1):
        rbox('bogie_side', (sx * .80, .30, bz), (.10, .15, 1.90), 'under', .025, 2)
        for az in (-.62, .62):
            rbox('axle_box', (sx * .86, .30, bz + az), (.12, .15, .20), 'under', .02, 2)
            cyl('wheel', (sx * .62, .31, bz + az), (sx * .74, .31, bz + az), .31, 'steel', 24)
            cyl('wheel_web', (sx * .745, .31, bz + az), (sx * .76, .31, bz + az), .21, 'under', 18)
    rbox('bogie_bolster', (0, .40, bz), (1.50, .10, .22), 'under', .02, 2)

# ------------------------------------------------------------ the cabin -----
rbox('floor', (0, .82, 0), (2.04, .04, 7.50), 'floor', .01, 1)
rbox('ceiling', (0, 2.98, 0), (1.94, .02, 7.20), 'wallin', .005, 1)
for sx in (-1, 1):
    rbox('ceiling_light', (sx * .42, 2.962, .2), (.08, .014, 5.6), 'ilight', .004, 1)
    rbox('ceiling_cove', (sx * .78, 2.90, 0), (.30, .12, 7.0), 'wallin', .03, 2)
SEAT_Z = [(-1.55, -1), (-0.55, -1), (0.55, 1), (0.92, 1), (2.98, 1)]
for sx in (-1, 1):
    for zc, facing in ((-1.62, -1), (-0.60, -1), (0.52, 1), (0.95, 1), (2.95, 1)):
        xc = sx * .60
        back_z = zc + facing * .21
        rbox('seat_base', (xc, 1.04, zc), (.72, .40, .44), 'wood', .03, 2)
        rbox('seat_cushion', (xc, 1.27, zc - facing * .02), (.72, .09, .46), 'seatfab', .04, 2)
        rbox('seat_back', (xc, 1.64, back_z), (.72, .66, .08), 'seatfab', .035, 2, rot=rot_game('x', facing * .12))
        rbox('seat_back_rail', (xc, 2.00, back_z + facing * .04), (.74, .05, .05), 'wood', .02, 1)
        cyl('seat_grab', (xc - .30, 2.03, back_z + facing * .06), (xc + .30, 2.03, back_z + facing * .06), .013, 'pole', 8)
    cyl('grab_rail', (sx * .30, 2.40, -2.9), (sx * .30, 2.40, 3.2), .017, 'pole', 10)
    for dz in (-2.10, -1.20, 1.40, 2.60):
        cyl('grab_pole', (sx * .78, .84, dz), (sx * .78, 2.96, dz), .019, 'pole', 10)
# Driver's cab: console, seat, controller and the partition behind.
rbox('driver_console', (0, 1.10, -3.55), (1.76, .56, .42), 'console', .05, 3)
rbox('console_top', (0, 1.40, -3.50), (1.66, .06, .50), 'console', .02, 1, rot=rot_game('x', .35))
for k, xx in enumerate((-.55, -.35, .30, .52)):
    rbox('console_dial', (xx, 1.43, -3.57), (.10, .02, .08), 'pole' if k % 2 else 'badge', .01, 1)
rbox('driver_seat_base', (0, 1.02, -3.02), (.46, .36, .44), 'console', .03, 2)
rbox('driver_seat', (0, 1.24, -3.02), (.52, .09, .48), 'seat', .04, 2)
rbox('driver_seat_back', (0, 1.60, -2.80), (.52, .62, .09), 'seat', .035, 2, rot=rot_game('x', -.10))
cyl('controller', (-.52, 1.44, -3.40), (-.52, 1.62, -3.40), .065, 'chrome', 16)
cyl('controller_handle', (-.52, 1.63, -3.40), (-.34, 1.67, -3.34), .015, 'wood', 8)
rbox('cab_partition', (0, 1.20, -2.66), (2.02, .74, .04), 'console', .01, 1)
rbox('cab_partition_glass_frame', (0, 1.95, -2.66), (2.02, .06, .05), 'wood', .01, 1)
# Full-height back wall of the cab and door vestibule: the windscreen shows a
# dim, warm cab like the reference instead of the whole bright car interior.
rbox('cab_back_wall', (0, 1.90, -2.13), (2.02, 2.12, .04), 'cabwall', .01, 1)
rbox('cab_back_window', (0, 2.05, -2.155), (.62, .72, .01), 'console', .01, 1)
# Rear platform: a bench across the rear window.
rbox('rear_bench', (0, 1.06, 3.55), (1.80, .44, .40), 'wood', .03, 2)
rbox('rear_bench_cushion', (0, 1.30, 3.55), (1.80, .09, .42), 'seatfab', .04, 2)

log('objects', len(OBJS))


# ------------------------------------------------------------- merge/pack ---
def role_of(ob):
    roles = {ob.data.materials[min(p.material_index, len(ob.data.materials) - 1)]['role'] for p in ob.data.polygons}
    assert len(roles) == 1, (ob.name, roles)
    return roles.pop()


groups = {}
for ob in list(OBJS):
    groups.setdefault(role_of(ob), []).append(ob)
merged = {}
for role, obs in groups.items():
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1:
        bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = 'tram_' + role
    merged[role] = ob
log('roles', {r: len(o.data.polygons) for r, o in merged.items()})

# UV atlas for every baked surface (body at full density, cabin at half).
atlas = [merged['body'], merged['interior']]
bpy.ops.object.select_all(action='DESELECT')
for o in atlas:
    o.select_set(True)
    for uvl in list(o.data.uv_layers):
        o.data.uv_layers.remove(uvl)
    o.data.uv_layers.new(name='UVMap')
bpy.context.view_layer.objects.active = atlas[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(56), island_margin=.002, area_weight=0.0,
                         correct_aspect=True, scale_to_bounds=False)
bpy.ops.object.mode_set(mode='OBJECT')
me = merged['interior'].data
for l in me.uv_layers.active.data:
    l.uv = l.uv * .5
bpy.context.view_layer.objects.active = atlas[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.pack_islands(rotate=True, margin=.0025)
bpy.ops.object.mode_set(mode='OBJECT')
for role, ob in merged.items():
    if role in ('body', 'interior', 'destination'):
        continue
    if not ob.data.uv_layers:
        uvl = ob.data.uv_layers.new(name='UVMap')
        for l in ob.data.loops:
            p = gam(ob.data.vertices[l.vertex_index].co)
            uvl.data[l.index].uv = ((p[0] + 1.25) / 2.5, p[1] / 5.0)
log('uv atlas packed')


# ------------------------------------------------------------ review render --
def setup_world():
    world = bpy.data.worlds.new('review_world')
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes['Background']
    if ENV.exists():
        tex = nt.nodes.new('ShaderNodeTexEnvironment')
        tex.image = bpy.data.images.load(str(ENV))
        # Game +z (street ahead) is Blender -y; three's equirect centre is +x.
        mapping = nt.nodes.new('ShaderNodeMapping')
        coord = nt.nodes.new('ShaderNodeTexCoord')
        nt.links.new(coord.outputs['Generated'], mapping.inputs['Vector'])
        mapping.inputs['Rotation'].default_value = (0, 0, 0)
        nt.links.new(mapping.outputs['Vector'], tex.inputs['Vector'])
        nt.links.new(tex.outputs['Color'], bg.inputs['Color'])
        bg.inputs['Strength'].default_value = 1.0
    else:
        bg.inputs['Color'].default_value = (.55, .68, .85, 1)
        bg.inputs['Strength'].default_value = .9


def review(path, cam_game, look_game, res=(1200, 900), lens=40, samples=64):
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    if 'review_cam' not in bpy.data.objects:
        cam = bpy.data.objects.new('review_cam', bpy.data.cameras.new('review_cam'))
        bpy.context.collection.objects.link(cam)
        sun = bpy.data.objects.new('review_sun', bpy.data.lights.new('review_sun', 'SUN'))
        bpy.context.collection.objects.link(sun)
        sun.data.energy = 4.5
        sun.data.color = (1.0, .84, .68)
        sun.data.angle = math.radians(1.5)
        d = -Vector(nat((-62.6, 72.1, -30.5)) - nat((0, 0, 0))).normalized()
        sun.rotation_euler = Vector((0, 0, -1)).rotation_difference(d).to_euler()
        setup_world()
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
    dv = nat(look_game) - nat(cam_game)
    cam.rotation_euler = dv.to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    log('review', path.name)


if PREVIEW:
    review(REVIEW / 'front_chase.png', (-2.2, 2.2, -26.0), (0, 1.9, -2.5), lens=70)
    review(REVIEW / 'front_close.png', (-2.6, 2.3, -9.0), (0, 1.8, -2.0), lens=35)
    review(REVIEW / 'side_three_quarter.png', (6.0, 3.2, -10.0), (0, 1.8, -1.0), lens=32)

# ------------------------------------------------------------------ bake -----
if not NO_BAKE:
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 128
    SIZE = 2048
    imgs = {}
    for key, size in (('albedo', SIZE), ('ao', SIZE), ('orm', 1024)):
        im = bpy.data.images.new('bake_' + key, size, size, float_buffer=True, alpha=False)
        im.colorspace_settings.name = 'Non-Color'
        imgs[key] = im
    # The review ground stays for the AO bake: it darkens the skirt and nose
    # toward the street like the reference's contact shading.
    if scene.world is None:
        scene.world = bpy.data.worlds.new('bake_world')
    scene.world.light_settings.distance = .65
    if 'review_ground' not in bpy.data.objects:
        ground = bpy.data.objects.new('bake_ground', bpy.data.meshes.new('bake_ground'))
        bm = bmesh.new()
        for x, y in ((-40, -40), (40, -40), (40, 40), (-40, 40)):
            bm.verts.new((x, y, 0))
        bm.faces.new(bm.verts)
        bm.to_mesh(ground.data)
        bm.free()
        bpy.context.collection.objects.link(ground)

    def set_target(key):
        for ob in atlas:
            for m in ob.data.materials:
                nt = m.node_tree
                node = nt.nodes.get('bake_target') or nt.nodes.new('ShaderNodeTexImage')
                node.name = 'bake_target'
                node.image = imgs[key]
                nt.nodes.active = node

    def bake(kind, key, **kw):
        set_target(key)
        bpy.ops.object.select_all(action='DESELECT')
        for ob in atlas:
            ob.select_set(True)
        bpy.context.view_layer.objects.active = atlas[0]
        t = time.time()
        bpy.ops.object.bake(type=kind, margin=8, margin_type='EXTEND', use_clear=True, **kw)
        log('baked', key, kind, '%.1fs' % (time.time() - t))

    # Cycles' diffuse colour pass is black for metals (and dimmed under a
    # coat), which baked every chrome bezel and steel part as a black mirror.
    # Bake plain base colours, then restore the look-dev values.
    looks = {}
    for m in {mm for ob in atlas for mm in ob.data.materials}:
        bsdf = m.node_tree.nodes['Principled BSDF']
        looks[m.name] = [(k, bsdf.inputs[k].default_value) for k in ('Metallic', 'Coat Weight', 'Transmission Weight')]
        for k, _ in looks[m.name]:
            bsdf.inputs[k].default_value = 0.0
    bake('DIFFUSE', 'albedo', pass_filter={'COLOR'})
    for m in {mm for ob in atlas for mm in ob.data.materials}:
        bsdf = m.node_tree.nodes['Principled BSDF']
        for k, v in looks[m.name]:
            bsdf.inputs[k].default_value = v
    merged['glass'].hide_render = True
    bake('AO', 'ao')
    merged['glass'].hide_render = False
    # ORM: emission carries (clearcoat, roughness, metallic) per material.
    saved = {}
    for m in {mm for ob in atlas for mm in ob.data.materials}:
        nt = m.node_tree
        out = nt.nodes['Material Output']
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = (m['coat'], m['rough'], m['metal'], 1)
        em.inputs['Strength'].default_value = 1.0
        saved[m.name] = out.inputs['Surface'].links[0].from_socket if out.inputs['Surface'].links else None
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    bake('EMIT', 'orm')
    for key, im in imgs.items():
        px = np.empty(im.size[0] * im.size[1] * 4, dtype=np.float32)
        im.pixels.foreach_get(px)
        np.save(BUILD / ('bake_%s.npy' % key), px.reshape(im.size[1], im.size[0], 4))
    for m in {mm for ob in atlas for mm in ob.data.materials}:
        nt = m.node_tree
        if saved.get(m.name) is not None:
            nt.links.new(saved[m.name], nt.nodes['Material Output'].inputs['Surface'])
    log('bakes saved')


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
for role in ('body', 'interior', 'glass', 'lamp', 'roofLamp', 'interiorLight', 'tail', 'destination'):
    ob = merged[role]
    meshes[ob.name] = packed(ob)
    parts.append({'mesh': ob.name, 'role': role, 'translation': [0, 0, 0], 'quaternion': [0, 0, 0, 1], 'scale': [1, 1, 1]})
low = [min(m['min'][i] for m in meshes.values()) for i in range(3)]
high = [max(m['max'][i] for m in meshes.values()) for i in range(3)]
total = sum(m['triangles'] for m in meshes.values())
log('triangles', total, {k: v['triangles'] for k, v in meshes.items()}, 'bounds', low, high)
assert low[0] >= -1.25 and high[0] <= 1.25 and low[1] >= -1e-5 and high[1] <= 5.0 and low[2] >= -4 and high[2] <= 4, (low, high)
(BUILD / 'parts.json').write_text(json.dumps({'parts': parts, 'meshes': meshes, 'renderBounds': {'min': low, 'max': high},
                                              'triangles': total}, separators=(',', ':')))
for name in ('review_cam', 'review_sun', 'review_ground', 'bake_ground'):
    if name in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for ob in merged.values():
    ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / 'berlin-reference-tram-v152.glb'), use_selection=True, export_format='GLB',
                          export_normals=True, export_materials='EXPORT', export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'berlin-reference-tram-v152.blend'))
log('done')
