"""V126 reference tram: detailed coachwork, a modelled interior and one baked atlas.

blender -b --python tools/stage_berlin_tram_v126.py -- [--preview] [--no-bake]

Everything is authored in game coordinates (x across, y up, z along the track,
the -z end faces the chase camera) and converted to Blender's Z-up frame.
Outputs go to audit/berlin-tram-v126/:
  models/berlin-vintage-tram-v90.{blend,glb}   editable/native source
  build/parts.json                             packed runtime meshes per role
  build/bake_{albedo,ao,orm}.npy               raw linear bakes (bottom-up rows)
  review/*.png                                 Cycles review renders (--preview)
tools/finish_berlin_tram_v126.py (system Python + PIL) composes the textures and
writes the shipping JSON/inline script. The obstacle contract is unchanged:
footprint 2.5 x 8 m, collider 3.15 m, render envelope y <= 4.52 m.
"""
import bpy, bmesh, math, json, base64, struct, sys, time
import numpy as np
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit' / 'berlin-tram-v126'
OUT, BUILD, REVIEW = STAGE / 'models', STAGE / 'build', STAGE / 'review'
for p in (OUT, BUILD, REVIEW):
    p.mkdir(parents=True, exist_ok=True)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW, NO_BAKE = '--preview' in ARGS, '--no-bake' in ARGS
T0 = time.time()

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.scale_length = 1.0


def log(*a):
    print('[tram126 %6.1fs]' % (time.time() - T0), *a, flush=True)


# ------------------------------------------------------------------ palette --
def lin(c):
    return ((c + .055) / 1.055) ** 2.4 if c > .04045 else c / 12.92


def hex_lin(h):
    return tuple(lin(((h >> s) & 255) / 255) for s in (16, 8, 0))


# name: (sRGB hex, roughness, metallic, runtime role)
PAL = {
    'yellow':  (0xd6a22c, .30, .0, 'body'),
    'cream':   (0xdfcfb6, .38, .0, 'body'),
    'roof':    (0xb9b8b1, .55, .0, 'body'),
    'rubber':  (0x23272a, .86, .0, 'body'),
    'bumper':  (0x8b9095, .45, .3, 'body'),
    'bronze':  (0x6a4a2a, .35, .6, 'body'),
    'chrome':  (0xd6dade, .16, 1., 'body'),
    'under':   (0x2b2e31, .72, .2, 'body'),
    'steel':   (0x7d858b, .38, .7, 'body'),
    'plate':   (0x243039, .45, .1, 'body'),
    'floor':   (0x57493e, .86, .0, 'interior'),
    'seat':    (0x8a5a32, .55, .0, 'interior'),
    'wood':    (0x9a6a3e, .50, .0, 'interior'),
    'wallin':  (0xcdb48c, .78, .0, 'interior'),
    'pole':    (0xb08a3a, .35, .3, 'interior'),
    'console': (0x2d3236, .50, .1, 'interior'),
    'glass':   (0x9fb2bd, .05, .0, 'glass'),
    'lamp':    (0xfff3dc, .20, .0, 'lamp'),
    'roofLamp': (0xffa532, .20, .0, 'roofLamp'),
    'ilight':  (0xfff0d6, .20, .0, 'interiorLight'),
    'tail':    (0xff4d3d, .30, .0, 'tail'),
    'dest':    (0x101010, .50, .0, 'destination'),
}
MATS = {}
for name, (hx, rough, metal, role) in PAL.items():
    m = bpy.data.materials.new('tram_' + name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*hex_lin(hx), 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if role in ('lamp', 'roofLamp', 'interiorLight', 'tail'):
        b.inputs['Emission Color'].default_value = (*hex_lin(hx), 1)
        b.inputs['Emission Strength'].default_value = 4.0
    if role == 'glass':
        b.inputs['Alpha'].default_value = .35
    m['role'], m['rough'], m['metal'] = role, rough, metal
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


def dome(name, c, normal_game, r, depth, mat, seg=24, rings=5):
    """Shallow spherical cap (a lens) facing normal_game."""
    bm = bmesh.new()
    top = bm.verts.new((0, 0, depth))
    prev = [top]
    for k in range(1, rings + 1):
        t = k / rings
        rr = r * math.sin(t * math.pi / 2)
        z = depth * math.cos(t * math.pi / 2)
        cur = [bm.verts.new((rr * math.cos(math.tau * i / seg), rr * math.sin(math.tau * i / seg), z)) for i in range(seg)]
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


def rr_outline(w, h, r, n=5):
    """Rounded rectangle outline (u, v) centred at 0, counter-clockwise."""
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180), (w / 2 - r, -h / 2 + r, 270)):
        for i in range(n + 1):
            a = math.radians(a0 + 90 * i / n)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


# ------------------------------------------------------------ body shell ----
def plan_ring(w, d, rx, rz, bow, ns=12, nc=10, ne=8):
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


# y, half-width, half-length, plan corner rx, rz, front bow
ROWS = [
    (0.520, 1.040, 3.800, .30, .42, .100),
    (0.560, 1.070, 3.835, .31, .44, .100),
    (0.640, 1.092, 3.858, .32, .45, .100),
    (0.800, 1.100, 3.870, .32, .46, .100),
    (1.100, 1.100, 3.872, .32, .46, .100),
    (1.490, 1.100, 3.868, .32, .46, .095),
    (1.560, 1.095, 3.862, .31, .45, .090),
    (2.000, 1.095, 3.842, .31, .45, .085),
    (2.620, 1.095, 3.812, .31, .44, .080),
    (2.740, 1.092, 3.800, .31, .44, .080),
    (2.820, 1.080, 3.780, .31, .44, .080),
    (2.880, 1.055, 3.745, .30, .43, .075),
    (2.940, 1.010, 3.690, .29, .42, .070),
    (3.000, 0.930, 3.610, .28, .40, .060),
    (3.050, 0.810, 3.510, .27, .38, .050),
    (3.090, 0.620, 3.380, .26, .35, .040),
    (3.115, 0.380, 3.240, .24, .30, .030),
    (3.125, 0.150, 3.120, .14, .20, .020),
]


def loft(name, rows, mat_for_y, cap_bottom=None, cap_top=None):
    bm = bmesh.new()
    rings = []
    for y, w, d, rx, rz, bow in rows:
        rings.append([bm.verts.new(nat((x, y, z))) for x, z in plan_ring(w, d, rx, rz, bow)])
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


def band_material(y):
    return 'yellow' if y < 1.49 else ('cream' if y < 2.86 else 'roof')


shell = loft('coach_shell', ROWS, band_material, cap_bottom='under', cap_top='roof')
# Surface queries (before apertures): exact end-face depth and side positions.
_bvh_src = shell.evaluated_get(bpy.context.evaluated_depsgraph_get())
BVH = BVHTree.FromObject(_bvh_src, bpy.context.evaluated_depsgraph_get())


def end_hit(x, y, end):
    """Front/back surface point and outward normal at lateral x, height y."""
    o = nat((x, y, end * 10.0))
    d = nat((0, 0, -end)) - nat((0, 0, 0))
    loc, nrm, _, _ = BVH.ray_cast(o, d)
    assert loc is not None, ('no end surface', x, y, end)
    return gam(loc), gam(nrm)


def side_x(y):
    return 1.095 if y >= 1.56 else 1.10


# Thin coachwork: solidify inward, inner faces use the cabin lining.
nm = len(shell.data.materials)
for i in range(nm):
    shell.data.materials.append(MATS['wallin'])
sol = shell.modifiers.new('coachwork', 'SOLIDIFY')
sol.thickness, sol.offset, sol.use_rim, sol.use_even_offset = .045, -1, True, True
sol.material_offset = nm
apply_mod(shell, sol)
# Blender keeps one slot per material, so fold every offset inner face onto it.
_wall_slot = [m.name for m in shell.data.materials].index('tram_wallin')
for p in shell.data.polygons:
    if p.material_index >= nm:
        p.material_index = _wall_slot
log('shell', len(shell.data.polygons), 'faces')

# ---------------------------------------------------------------- layout ----
WIN_Y0, WIN_Y1, WIN_R = 1.62, 2.50, .07
PASS = [(-1.74, -0.96), (-0.84, -0.06), (0.06, 0.84), (0.96, 1.74)]
CABWIN = [(-3.38, -2.92), (2.92, 3.38)]
DOORS = [(-2.84, -1.86), (1.86, 2.84)]
DOOR_Y0, DOOR_Y1 = 0.64, 2.52
WS_W, WS_Y0, WS_Y1, WS_R = 1.88, 1.60, 2.60, .11


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
        cutters.append(prism('cut', rr_outline(z1 - z0, WIN_Y1 - WIN_Y0, WIN_R), 'x',
                             (s * 1.095, (WIN_Y0 + WIN_Y1) / 2, (z0 + z1) / 2), .5, 'cream'))
    for z0, z1 in DOORS:
        cutters.append(prism('cut', rr_outline(z1 - z0, DOOR_Y1 - DOOR_Y0, .06), 'x',
                             (s * 1.095, (DOOR_Y0 + DOOR_Y1) / 2, (z0 + z1) / 2), .5, 'yellow'))
for end in (-1, 1):
    zc = end * 3.83
    cutters.append(prism('cut', rr_outline(WS_W, WS_Y1 - WS_Y0, WS_R), 'z',
                         (0, (WS_Y0 + WS_Y1) / 2, zc), .7, 'cream'))
# One joined cutter keeps the exact boolean to a single evaluation.
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
# The inner lining belongs to the cabin (interior role); split it off.
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
def ring_band(name, y0, y1, grow, mat, dz=0.0):
    """Proud horizontal moulding following the plan shape between y0 and y1."""
    rows = []
    for y, g in ((y0, 0.0), (y0 + (y1 - y0) * .2, grow), (y1 - (y1 - y0) * .2, grow), (y1, 0.0)):
        # interpolate the shell rows at this height
        for k in range(len(ROWS) - 1):
            if ROWS[k][0] <= y <= ROWS[k + 1][0]:
                t = (y - ROWS[k][0]) / (ROWS[k + 1][0] - ROWS[k][0])
                a, b = ROWS[k], ROWS[k + 1]
                w, d, rx, rz, bow = [a[i] + (b[i] - a[i]) * t for i in range(1, 6)]
                break
        rows.append((y, w + g, d + g + dz, rx + g, rz + g, bow))
    return loft(name, rows, lambda y: mat)


belt = ring_band('belt_moulding', 1.475, 1.535, .014, 'cream')
bm = bmesh.new()
bm.from_mesh(belt.data)
gone = [f for f in bm.faces if abs(f.calc_center_median().x) > .9 and
        any(z0 - .02 < -f.calc_center_median().y < z1 + .02 for z0, z1 in DOORS)]
bmesh.ops.delete(bm, geom=gone, context='FACES')
bm.to_mesh(belt.data)
bm.free()
ring_band('rain_lip', 2.80, 2.86, .016, 'cream')
# Dark skirt below the body, wheels visible beneath it.
loft('skirt', [(0.40, 1.018, 3.775, .29, .40, .10), (0.46, 1.030, 3.790, .30, .41, .10), (0.525, 1.036, 3.796, .30, .42, .10)],
     lambda y: 'bumper', cap_bottom='under')


# ------------------------------------------------------ gaskets and glass ---
def frame_ring(name, outline_outer, outline_inner, place, mat):
    """Flat rounded frame between two outlines; place(u, v, layer) -> game point."""
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
        xo = s * 1.095
        outer, inner = rr_outline(w + .03, h + .03, WIN_R + .015), rr_outline(w - .035, h - .035, WIN_R - .01)

        def place(u, v, layer, zc=zc, yc=yc, xo=xo, s=s):
            depth = (.012, .012, -.03, -.03)[layer]
            return (xo + s * depth, yc + v, zc + u)
        frame_ring('side_gasket', outer, inner, place, 'rubber')
        pane('side_glass', rr_outline(w - .03, h - .03, WIN_R - .01),
             lambda u, v, zc=zc, yc=yc, xo=xo, s=s: (xo - s * .022, yc + v, zc + u), 'glass', (s, 0, 0))
        # Top-hung transom: the reference's small upper light.
        if (z0, z1) in PASS:
            rbox('transom_bar', (xo - s * .01, 2.285, zc), (.03, .028, w - .02), 'rubber', .008, 1)
    for di, (z0, z1) in enumerate(DOORS):
        zc, w = (z0 + z1) / 2, z1 - z0
        xo = s * 1.070
        for leaf in (-1, 1):
            lz = zc + leaf * w / 4
            lw = w / 2 - .012
            # Lower panel, stiles and rails in coach yellow; glass above.
            rbox('door_panel', (xo, 0.97, lz), (.03, .62, lw), 'yellow', .012, 1)
            rbox('door_rail_mid', (xo + s * .004, 1.31, lz), (.034, .05, lw), 'yellow', .01, 1)
            rbox('door_rail_top', (xo + s * .004, 2.475, lz), (.034, .06, lw), 'yellow', .01, 1)
            for st in (-1, 1):
                rbox('door_stile', (xo + s * .004, 1.89, lz + st * (lw / 2 - .025)), (.034, 1.18, .05), 'yellow', .01, 1)
            pane('door_glass', rr_outline(lw - .09, 1.10, .04),
                 lambda u, v, lz=lz, xo=xo, s=s: (xo, 1.89 + v, lz + u), 'glass', (s, 0, 0))
            frame_ring('door_gasket', rr_outline(lw - .07, 1.12, .045), rr_outline(lw - .10, 1.09, .035),
                       lambda u, v, layer, lz=lz, xo=xo, s=s: (xo + s * (.018, .018, -.006, -.006)[layer], 1.89 + v, lz + u), 'rubber')
            # Grab handle on each leaf.
            cyl('door_handle', (xo + s * .05, 1.00, lz - leaf * .12), (xo + s * .05, 1.42, lz - leaf * .12), .012, 'chrome', 8)
        rbox('door_seam', (xo + s * .012, 1.58, zc), (.02, 1.88, .018), 'rubber', .006, 1)
        rbox('door_step', (s * 1.085, .455, zc), (.08, .05, w + .04), 'steel', .012, 1)
        rbox('door_step_riser', (s * 1.05, .40, zc), (.05, .10, w), 'under', .01, 1)

# Windscreens and the front furniture at both ends (the -z end faces the camera).
WS_OUT = rr_outline(WS_W + .03, WS_Y1 - WS_Y0 + .03, WS_R + .012, 6)
WS_IN = rr_outline(WS_W - .02, WS_Y1 - WS_Y0 - .02, WS_R - .008, 6)
WS_YC = (WS_Y0 + WS_Y1) / 2
for end in (-1, 1):
    def place_front(u, v, layer, end=end):
        (x, y, z), _ = end_hit(u, WS_YC + v, end)
        return (x, y, z + end * (.014, .014, -.035, -.035)[layer])
    frame_ring('cab_gasket', WS_OUT, WS_IN, place_front, 'rubber')
    # Curved windscreen following the bowed nose, slightly recessed.
    bm = bmesh.new()
    cols, rws = 17, 9
    grid = []
    ww, hh = WS_W - .03, WS_Y1 - WS_Y0 - .03
    for j in range(rws):
        v = -hh / 2 + hh * j / (rws - 1)
        row = []
        for i in range(cols):
            u = -ww / 2 + ww * i / (cols - 1)
            # clip the corners to the rounded outline
            du, dv = max(0, abs(u) - (ww / 2 - WS_R)), max(0, abs(v) - (hh / 2 - WS_R))
            if du * du + dv * dv > WS_R * WS_R and du > 0 and dv > 0:
                k = WS_R / math.hypot(du, dv)
                u = math.copysign(ww / 2 - WS_R + du * k, u)
                v = math.copysign(hh / 2 - WS_R + dv * k, v)
            (x, y, z), _ = end_hit(u, WS_YC + v, end)
            row.append(bm.verts.new(nat((x, y, z - end * .026))))
        grid.append(row)
    for j in range(rws - 1):
        for i in range(cols - 1):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = finish('windscreen', bm, ['glass'], True, 80)
    # Face the pane outward (open surface: fix orientation explicitly).
    want = nat((0, 0, end)) - nat((0, 0, 0))
    if sum(p.normal.dot(want) for p in ob.data.polygons) < 0:
        for p in ob.data.polygons:
            p.flip()
    # Wipers: two arms parked diagonally, pivots below the glass.
    for px, ang in ((.10, 1.22),):
        (x0, y0, z0), _ = end_hit(px, WS_Y0 - .005, end)
        L = .62
        x1, y1 = x0 - L * math.cos(ang) * (1 if px > 0 else 1), y0 + L * math.sin(ang)
        (_, _, z1), _ = end_hit(x1, y1, end)
        cyl('wiper_arm', (x0, y0, z0 - end * .03), (x1, y1, z1 - end * .03), .010, 'rubber', 6)
        cyl('wiper_pivot', (x0, y0, z0 - end * .01), (x0, y0, z0 - end * .05), .022, 'rubber', 10)
    # Headlamps: chrome bezel, dark housing and a glowing domed lens.
    for sx in (-1, 1):
        (x, y, z), n = end_hit(sx * .70, .87, end)
        c = Vector((x, y, z))
        nv = Vector(n)
        torus('headlamp_bezel', c + nv * .018, n, .108, .018, 'bronze')
        cyl('headlamp_housing', tuple(c - nv * .01), tuple(c + nv * .03), .118, 'rubber', 24)
        dome('headlamp_lens', c + nv * .031, n, .092, .022, 'lamp')
        # Small red marker low on each corner.
        (x2, y2, z2), n2 = end_hit(sx * .90, .62, end)
        dome('tail_marker', Vector((x2, y2, z2)) + Vector(n2) * .004, n2, .032, .012, 'tail', 12, 3)
    # Rubber bumper following the bow, with rounded ends.
    bm = bmesh.new()
    prof = rr_outline(.07, .095, .03, 3)
    xs = [(-.97 + 1.94 * i / 30) for i in range(31)]
    rings = []
    for x in xs:
        (_, _, zs), _ = end_hit(x, .60, end)
        rings.append([bm.verts.new(nat((x, .60 + v, zs + end * (u + .03)))) for u, v in prof])
    for i in range(len(rings) - 1):
        for k in range(len(prof)):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % len(prof)], rings[i + 1][(k + 1) % len(prof)], rings[i + 1][k]))
    bm.faces.new(rings[0])
    bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    finish('bumper', bm, ['bumper'], True, 60)
    # Emblem plate under the windscreen, chrome rim.
    (x, y, z), n = end_hit(0, 1.30, end)
    dome('emblem_badge', Vector((x, y, z)) + Vector(n) * .004, n, .055, .014, 'bronze', 18, 3)
    (x, y, z), n = end_hit(0, .70, end)
    rbox('number_plate', (0, .70, z + end * .006), (.22, .06, .016), 'cream', .012, 2)
    # Cream-framed route light on the roof dome and the interior sign box.
    (x, y, z), n = end_hit(0, 2.92, end)
    dome('route_light', Vector((x, y, z)) + Vector(n) * .006, n, .085, .03, 'roofLamp', 20, 4)
    torus('route_light_rim', Vector((x, y, z)) + Vector(n) * .008, n, .092, .012, 'cream', 22, 6)
    (x, y, z), _ = end_hit(0, 2.50, end)
    rbox('sign_box', (0, 2.50, z - end * .12), (.98, .15, .10), 'console', .015, 2)
    bm = bmesh.new()
    vs = [bm.verts.new(nat((u, 2.50 + v, z - end * .066))) for u, v in ((-.44, -.055), (.44, -.055), (.44, .055), (-.44, .055))]
    f = bm.faces.new(vs if end > 0 else list(reversed(vs)))
    ob = finish('destination', bm, ['dest'], False)
    uv = ob.data.uv_layers.new(name='UVMap')
    for li, l in enumerate(ob.data.loops):
        p = gam(ob.data.vertices[l.vertex_index].co)
        u = (p[0] + .44) / .88
        uv.data[li].uv = (u if end > 0 else (1 - u), (p[1] - (2.50 - .055)) / .11)
    # Exterior mirrors on both sides of each end.
    for sx in (-1, 1):
        a = (sx * 1.05, 2.22, end * 3.52)
        b = (sx * 1.20, 2.18, end * 3.64)
        cyl('mirror_arm', a, b, .014, 'steel', 8)
        rbox('mirror_head', (sx * 1.205, 2.04, end * 3.66), (.05, .26, .15), 'rubber', .02, 2)

# ------------------------------------------------------------- the roof -----
rbox('roof_box', (0, 3.21, 0), (1.30, .26, 5.20), 'under', .07, 3)
for z in (-2.05, -1.25, 1.25, 2.05):
    rbox('roof_grille', (0, 3.345, z), (1.00, .018, .56), 'rubber', .008, 1)
for z in (-1.9, 1.9):
    rbox('roof_vent_front', (0, 3.20, z * 1.33), (.62, .10, .02), 'rubber', .01, 1)
rbox('pantograph_base', (0, 3.37, 0), (.96, .05, 1.10), 'rubber', .015, 1)
for sx in (-1, 1):
    for z in (-.42, .42):
        cyl('roof_insulator', (sx * .34, 3.34, z), (sx * .34, 3.42, z), .045, 'cream', 12)
for sx in (-1, 1):
    x = sx * .30
    cyl('panto_lower', (x, 3.40, -.46), (x, 3.98, .30), .026, 'rubber', 8)
    cyl('panto_upper', (x, 3.98, .30), (sx * .44, 4.40, -.05), .020, 'rubber', 8)
    cyl('panto_spring', (x, 3.40, .40), (sx * .27, 4.12, -.04), .011, 'steel', 6)
cyl('panto_knee', (-.30, 3.98, .30), (.30, 3.98, .30), .022, 'rubber', 8)
cyl('contact_bar', (-.80, 4.43, -.05), (.80, 4.43, -.05), .026, 'steel', 10)
cyl('contact_strip', (-.78, 4.458, -.05), (.78, 4.458, -.05), .012, 'chrome', 8)
for sx in (-1, 1):
    cyl('contact_horn', (sx * .80, 4.43, -.05), (sx * .98, 4.32, -.05), .020, 'steel', 8)

# ---------------------------------------------------- bogies and wheels -----
for bz in (-2.45, 2.45):
    for sx in (-1, 1):
        rbox('bogie_side', (sx * .80, .34, bz), (.10, .14, 1.86), 'under', .025, 2)
        rbox('spring_nest', (sx * .80, .44, bz), (.16, .10, .38), 'under', .02, 2)
        for az in (-.58, .58):
            rbox('axle_box', (sx * .84, .30, bz + az), (.12, .15, .20), 'under', .02, 2)
            cyl('wheel', (sx * .64, .30, bz + az), (sx * .74, .30, bz + az), .30, 'steel', 22)
            cyl('wheel_web', (sx * .745, .30, bz + az), (sx * .76, .30, bz + az), .20, 'under', 18)
    rbox('bogie_bolster', (0, .40, bz), (1.50, .10, .22), 'under', .02, 2)

# ------------------------------------------------------------ the cabin -----
rbox('floor', (0, .86, 0), (2.06, .04, 7.46), 'floor', .01, 1)
rbox('ceiling', (0, 2.79, 0), (1.96, .02, 7.20), 'wallin', .005, 1)
for sx in (-1, 1):
    rbox('ceiling_light', (sx * .40, 2.772, 0), (.07, .014, 5.2), 'ilight', .004, 1)
ROWS_Z = [(-1.35, -1), (-0.45, -1), (0.45, 1), (1.35, 1)]
for sx in (-1, 1):
    for zc, facing in ROWS_Z:
        xc = sx * .63
        back_z = zc + facing * .20
        rbox('seat_base', (xc, 1.08, zc), (.70, .40, .44), 'wood', .03, 2)
        rbox('seat_cushion', (xc, 1.30, zc - facing * .02), (.70, .085, .44), 'seat', .035, 2)
        rbox('seat_back', (xc, 1.66, back_z), (.70, .62, .075), 'seat', .03, 2,
             rot=rot_game('x', facing * .12))
        rbox('seat_back_rail', (xc, 1.99, back_z + facing * .035), (.72, .05, .05), 'wood', .02, 1)
    cyl('grab_rail', (sx * .30, 2.36, -2.8), (sx * .30, 2.36, 2.8), .016, 'pole', 10)
    # Grab poles only beside the doors, so the aisle does not read as a cage.
    for dz in (-2.35, 2.35):
        cyl('door_pole', (sx * .78, .88, dz), (sx * .78, 2.77, dz), .018, 'pole', 10)
for end in (-1, 1):
    cz = end * 3.34
    rbox('driver_console', (0, 1.14, end * 3.58), (1.70, .52, .40), 'console', .04, 2)
    rbox('console_top', (0, 1.42, end * 3.55), (1.60, .05, .46), 'console', .02, 1,
         rot=rot_game('x', end * -.35))
    rbox('driver_seat_base', (0, 1.05, cz), (.46, .36, .44), 'console', .03, 2)
    rbox('driver_seat', (0, 1.25, cz), (.50, .08, .46), 'seat', .035, 2)
    rbox('driver_seat_back', (0, 1.58, cz - end * .21), (.50, .58, .08), 'seat', .03, 2)
    cyl('controller', (-.46, 1.45, end * 3.50), (-.46, 1.62, end * 3.50), .06, 'chrome', 14)
    cyl('controller_handle', (-.46, 1.63, end * 3.50), (-.30, 1.66, end * 3.44), .014, 'wood', 8)
    rbox('cab_partition', (0, 1.22, end * 2.90), (2.02, .70, .04), 'wood', .01, 1)

log('objects', len(OBJS))


# ------------------------------------------------------------- merge/pack ---
def role_of(ob):
    bad = sorted({p.material_index for p in ob.data.polygons if p.material_index >= len(ob.data.materials)})
    if bad:
        log('BAD material index', ob.name, 'slots', [m.name for m in ob.data.materials], 'bad', bad[:10])
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
bpy.ops.uv.smart_project(angle_limit=math.radians(58), island_margin=.0025, area_weight=0.0,
                         correct_aspect=True, scale_to_bounds=False)
bpy.ops.object.mode_set(mode='OBJECT')
me = merged['interior'].data
for l in me.uv_layers.active.data:
    l.uv = l.uv * .55
bpy.context.view_layer.objects.active = atlas[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.pack_islands(rotate=True, margin=.0035)
bpy.ops.object.mode_set(mode='OBJECT')
# Non-atlas roles keep simple planar UVs (runtime materials ignore them).
for role, ob in merged.items():
    if role in ('body', 'interior', 'destination'):
        continue
    if not ob.data.uv_layers:
        uvl = ob.data.uv_layers.new(name='UVMap')
        for l in ob.data.loops:
            p = gam(ob.data.vertices[l.vertex_index].co)
            uvl.data[l.index].uv = ((p[0] + 1.25) / 2.5, p[1] / 4.6)
log('uv atlas packed')


# ------------------------------------------------------------ review render --
def review(path, cam_game, look_game, res=(960, 720), lens=40, samples=48):
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'Standard'
    if 'review_cam' not in bpy.data.objects:
        cam = bpy.data.objects.new('review_cam', bpy.data.cameras.new('review_cam'))
        bpy.context.collection.objects.link(cam)
        sun = bpy.data.objects.new('review_sun', bpy.data.lights.new('review_sun', 'SUN'))
        bpy.context.collection.objects.link(sun)
        sun.data.energy = 4.0
        sun.data.color = (1.0, .82, .66)
        sun.data.angle = math.radians(1.5)
        # The game's key: el 46, az 64 from the street axis, from -x/-z.
        d = -Vector(nat((-62.6, 72.1, -30.5)) - nat((0, 0, 0))).normalized()
        sun.rotation_euler = Vector((0, 0, -1)).rotation_difference(d).to_euler()
        world = bpy.data.worlds.new('review_world')
        scene.world = world
        world.use_nodes = True
        bg = world.node_tree.nodes['Background']
        bg.inputs['Color'].default_value = (.55, .68, .85, 1)
        bg.inputs['Strength'].default_value = .9
        ground = bpy.data.objects.new('review_ground', bpy.data.meshes.new('review_ground'))
        bm = bmesh.new()
        for x, y in ((-40, -40), (40, -40), (40, 40), (-40, 40)):
            bm.verts.new((x, y, 0))
        bm.faces.new(bm.verts)
        bm.to_mesh(ground.data)
        bm.free()
        gm = bpy.data.materials.new('review_ground')
        gm.use_nodes = True
        gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (.22, .22, .30, 1)
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
    review(REVIEW / 'front_chase.png', (-1.2, 3.4, -22.0), (0, 1.7, -2.5), lens=55)
    review(REVIEW / 'front_close.png', (-2.4, 2.5, -8.5), (0, 1.6, -2.0), lens=35)
    review(REVIEW / 'side_three_quarter.png', (5.5, 3.2, -9.5), (0, 1.6, -1.0), lens=32)

# ------------------------------------------------------------------ bake -----
if not NO_BAKE:
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 64
    SIZE = 1024
    imgs = {}
    for key, size in (('albedo', SIZE), ('ao', SIZE), ('orm', 512)):
        im = bpy.data.images.new('bake_' + key, size, size, float_buffer=True, alpha=False)
        im.colorspace_settings.name = 'Non-Color'
        imgs[key] = im
    # Hide review helpers from the AO bake.
    for name in ('review_ground',):
        if name in bpy.data.objects:
            bpy.data.objects[name].hide_render = True
    if scene.world is None:
        scene.world = bpy.data.worlds.new('bake_world')
    scene.world.light_settings.distance = .55

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
        bpy.ops.object.bake(type=kind, margin=6, margin_type='EXTEND', use_clear=True, **kw)
        log('baked', key, kind, '%.1fs' % (time.time() - t))

    bake('DIFFUSE', 'albedo', pass_filter={'COLOR'})
    merged['glass'].hide_render = True
    bake('AO', 'ao')
    merged['glass'].hide_render = False
    # ORM: emission carries (1, roughness, metallic) per material.
    saved = {}
    for m in {mm for ob in atlas for mm in ob.data.materials}:
        nt = m.node_tree
        out = nt.nodes['Material Output']
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = (1.0, m['rough'], m['metal'], 1)
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
assert low[0] >= -1.25 and high[0] <= 1.25 and low[1] >= -1e-5 and high[1] <= 4.52 and low[2] >= -4 and high[2] <= 4, (low, high)
(BUILD / 'parts.json').write_text(json.dumps({'parts': parts, 'meshes': meshes, 'renderBounds': {'min': low, 'max': high},
                                              'triangles': total}, separators=(',', ':')))
for name in ('review_cam', 'review_sun', 'review_ground'):
    if name in bpy.data.objects:
        bpy.data.objects.remove(bpy.data.objects[name], do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for ob in merged.values():
    ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT / 'berlin-vintage-tram-v90.glb'), use_selection=True, export_format='GLB',
                          export_normals=True, export_materials='EXPORT', export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'berlin-vintage-tram-v90.blend'))
log('done')
