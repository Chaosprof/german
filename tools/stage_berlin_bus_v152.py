"""V152 reference bus: a lacquered BVG double-decker for the parked kerbside slot.

blender -b --python tools/stage_berlin_bus_v152.py -- [--preview] [--no-bake]

The old parked double-decker was flat yellow boxes with painted glass. This is
the Berlin SD 202 silhouette built the way the V152 tram is: one lofted shell
with rounded vertical corners and a rolled roof, apertures cut by an exact
boolean, rubber-gasketed recessed glass over a two-deck interior (seats, deck
slab, light strips), the continuous dark window bands of the BVG livery, a
split lower windscreen, a lit destination display, the upper-deck front
windows, folding doors on the pavement side, wheels in real wells, rectangular
headlamps, mirrors on stalks and a rear engine grille.

Game coordinates: x across, y up, z along with the front at +z; the kerbside
doors face +x. Footprint |x| <= 1.45, |z| <= 5.56, y <= 3.95 (the parking
slot reserves a 5.5 m half-length). Outputs: audit/berlin-vehicles-v152/bus/.
Runtime roles: body, interior (one baked atlas), glass, lamp, tail,
interiorLight, destination.
"""
import bpy, bmesh, math, sys
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import berlin_vehicle_kit_v152 as kit
from berlin_vehicle_kit_v152 import (nat, gam, finish, apply_mod, rbox, rot_game, cyl, tube, torus, dome, lathe_x,
                                     rr_outline, log, MATS, OBJS)

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit' / 'berlin-vehicles-v152' / 'bus'
OUT, BUILD, REVIEW = STAGE / 'models', STAGE / 'build', STAGE / 'review'
for p in (OUT, BUILD, REVIEW):
    p.mkdir(parents=True, exist_ok=True)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW, NO_BAKE = '--preview' in ARGS, '--no-bake' in ARGS
ENV = ROOT / 'assets' / 'img' / 'berlin-street-env-v1.jpg'
kit.TAG = 'bus152'
bpy.ops.wm.read_factory_settings(use_empty=True)

kit.make_materials({
    'yellow':   (0xe9ae1c, .34, .0, 1., 'body'),
    'band':     (0x1f2226, .40, .05, .8, 'body'),
    'skirt':    (0x2a2d31, .55, .05, .4, 'body'),
    'rubber':   (0x17181a, .80, .0, 0., 'body'),
    'chrome':   (0xdfe3e6, .12, 1., 0., 'body'),
    'steel':    (0x80878c, .36, .75, 0., 'body'),
    'tyre':     (0x222326, .86, .0, 0., 'body'),
    'rim':      (0xb9bec2, .28, .8, 0., 'body'),
    'under':    (0x222528, .80, .1, 0., 'body'),
    'grille':   (0x2d3033, .55, .3, 0., 'body'),
    'plate':    (0xf2efe6, .45, .0, .5, 'body'),
    'plateblue': (0x1f3f8f, .45, .0, .5, 'body'),
    'badge':    (0xf4c21e, .30, .1, .8, 'body'),
    'floor':    (0x3f4246, .86, .0, 0., 'interior'),
    'seat':     (0x2f4f86, .75, .0, 0., 'interior'),
    'seatframe': (0xb9bdc2, .40, .6, 0., 'interior'),
    'wallin':   (0xd6d2c8, .78, .0, 0., 'interior'),
    'pole':     (0xe2b82c, .30, .5, 0., 'interior'),
    'console':  (0x2b3034, .50, .1, 0., 'interior'),
    'glass':    (0x9fb2bd, .04, .0, 0., 'glass'),
    'lamp':     (0xfdf7ea, .10, .0, 0., 'lamp'),
    'tail':     (0xe0301f, .20, .0, 0., 'tail'),
    'ilight':   (0xfff0d6, .20, .0, 0., 'interiorLight'),
    'dest':     (0x101010, .50, .0, 0., 'destination'),
}, 'bus_')


# ------------------------------------------------------------------- shell ---
def plan_ring(w, d, rx, rz, bow, ns=6, nc=8, ne=6):
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


HW, HL = 1.25, 5.47
ROWS = [
    (0.340, 1.200, 5.380, .30, .38, .05),
    (0.380, 1.235, 5.430, .31, .39, .05),
    (0.450, 1.250, 5.465, .32, .40, .05),
    (0.600, 1.250, 5.470, .32, .40, .05),
    (3.500, 1.250, 5.470, .32, .40, .05),
    (3.600, 1.243, 5.458, .32, .40, .05),
    (3.680, 1.222, 5.432, .32, .40, .045),
    (3.745, 1.180, 5.385, .31, .39, .04),
    (3.795, 1.105, 5.305, .30, .38, .035),
    (3.832, .985, 5.190, .28, .36, .03),
    (3.856, .810, 5.040, .26, .33, .02),
    (3.869, .560, 4.860, .22, .29, .012),
    (3.875, .220, 4.640, .12, .18, .006),
]
SKIRT_TOP = .60
BANDS = [(1.24, 2.26), (2.70, 3.58)]


def band_material(y):
    if y < SKIRT_TOP:
        return 'skirt'
    for a, b in BANDS:
        if a < y < b:
            return 'band'
    return 'yellow'


def insert_row(rows, y):
    for k in range(len(rows) - 1):
        a, b = rows[k], rows[k + 1]
        if a[0] < y < b[0]:
            t = (y - a[0]) / (b[0] - a[0])
            rows.insert(k + 1, tuple([y] + [a[i] + (b[i] - a[i]) * t for i in range(1, 6)]))
            return


for yy in (SKIRT_TOP, BANDS[0][0], BANDS[0][1], BANDS[1][0], BANDS[1][1], .95, 1.6, 2.0, 2.45, 3.0, 3.3):
    if all(abs(r[0] - yy) > 1e-6 for r in ROWS):
        insert_row(ROWS, yy)
ROWS.sort()


def loft(name, rows, mat_for_y, cap_bottom=None, cap_top=None):
    bm = bmesh.new()
    rings = []
    for y, w, d, rx, rz, bow in rows:
        rings.append([bm.verts.new(nat((x, y, z))) for x, z in plan_ring(w, d, rx, rz, bow)])
    n = len(rings[0])
    names = []
    for j in range(len(rings) - 1):
        mn = mat_for_y((rows[j][0] + rows[j + 1][0]) / 2)
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


shell = loft('bus_shell', ROWS, band_material, cap_bottom='under', cap_top='yellow')
BVH = BVHTree.FromObject(shell, bpy.context.evaluated_depsgraph_get())


def end_hit(x, y, end):
    loc, nrm, _, _ = BVH.ray_cast(nat((x, y, end * 12.0)), nat((0, 0, -end)) - nat((0, 0, 0)))
    assert loc is not None, ('no end surface', x, y, end)
    return gam(loc), gam(nrm)


nm = len(shell.data.materials)
for i in range(nm):
    shell.data.materials.append(MATS['wallin'])
sol = shell.modifiers.new('coachwork', 'SOLIDIFY')
sol.thickness, sol.offset, sol.use_rim, sol.use_even_offset = .045, -1, True, True
sol.material_offset = nm
apply_mod(shell, sol)
_wall = [m.name for m in shell.data.materials].index('bus_wallin')
for p in shell.data.polygons:
    if p.material_index >= nm:
        p.material_index = _wall
log('shell', len(shell.data.polygons), 'faces')

# ------------------------------------------------------------- apertures ---
LOW_Y, UP_Y, WIN_R = (1.32, 2.18), (2.78, 3.50), .09
LOW_WINS = [(-4.90, -3.80), (-3.70, -2.60), (-2.50, -1.40), (-1.30, -.20), (1.60, 2.70), (2.80, 3.90)]
LOW_EXTRA_OFFSIDE = [(-.10, 1.50), (4.00, 5.10)]          # where the kerbside has doors
UP_WINS = [(-5.00, -3.85), (-3.75, -2.60), (-2.50, -1.35), (-1.25, -.10), (.00, 1.15), (1.25, 2.40), (2.50, 3.65),
           (3.75, 4.90)]
DOORS = [(-.05, 1.45), (4.05, 5.15)]
DOOR_Y = (.46, 2.30)
WS = (2.24, .95, 2.22, .16)        # lower windscreen width, y0, y1, corner
UWS = [(-1.10, -.06), (.06, 1.10)]  # upper-deck front panes (x ranges)
UWS_Y = (2.76, 3.52)
RWIN = (1.70, 2.82, 3.44)          # rear upper window width, y0, y1
DEST = (1.90, 2.32, 2.62)          # destination width, y0, y1


def prism(outline_uv, axis, center, depth):
    bm = bmesh.new()
    cx, cy, cz = center
    layers = []
    for s in (-depth / 2, depth / 2):
        ring = []
        for u, v in outline_uv:
            p = (cx + s, cy + v, cz + u) if axis == 'x' else (cx + u, cy + v, cz + s)
            ring.append(bm.verts.new(nat(p)))
        layers.append(ring)
    n = len(outline_uv)
    bm.faces.new(layers[0])
    bm.faces.new(list(reversed(layers[1])))
    for i in range(n):
        bm.faces.new((layers[0][i], layers[0][(i + 1) % n], layers[1][(i + 1) % n], layers[1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish('cut', bm, ['band'], False, keep=False)


def side_wins(s):
    low = LOW_WINS + ([] if s > 0 else LOW_EXTRA_OFFSIDE)
    return [(z0, z1, LOW_Y) for z0, z1 in low] + [(z0, z1, UP_Y) for z0, z1 in UP_WINS]


cutters = []
for s in (-1, 1):
    for z0, z1, (y0, y1) in side_wins(s):
        cutters.append(prism(rr_outline(z1 - z0, y1 - y0, WIN_R, 3), 'x', (s * HW, (y0 + y1) / 2, (z0 + z1) / 2), .5))
for z0, z1 in DOORS:
    cutters.append(prism(rr_outline(z1 - z0, DOOR_Y[1] - DOOR_Y[0], .07, 5), 'x', (HW, sum(DOOR_Y) / 2, (z0 + z1) / 2), .5))
cutters.append(prism(rr_outline(WS[0], WS[2] - WS[1], WS[3], 8), 'z', (0, (WS[1] + WS[2]) / 2, HL - .05), .8))
for x0, x1 in UWS:
    cutters.append(prism(rr_outline(x1 - x0, UWS_Y[1] - UWS_Y[0], .10, 6), 'z', ((x0 + x1) / 2, sum(UWS_Y) / 2, HL - .05), .8))
cutters.append(prism(rr_outline(RWIN[0], RWIN[2] - RWIN[1], .10, 6), 'z', (0, (RWIN[1] + RWIN[2]) / 2, -HL + .05), .8))
cutters.append(prism(rr_outline(DEST[0], DEST[2] - DEST[1], .05, 4), 'z', (0, (DEST[1] + DEST[2]) / 2, HL - .05), .8))
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
# Wheel wells.
WHEEL_Z, WHEEL_Y, WHEEL_R = (-2.90, 3.30), .50, .50
for z0 in WHEEL_Z:
    for s in (-1, 1):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=40, radius1=.60, radius2=.60, depth=.70)
        q = Vector((0, 0, 1)).rotation_difference(Vector((1, 0, 0)))
        bmesh.ops.transform(bm, matrix=Matrix.Translation(nat((s * 1.32, WHEEL_Y + .02, z0))) @ q.to_matrix().to_4x4(), verts=bm.verts)
        cut = finish('well_cut', bm, ['under'], False, keep=False)
        mod = shell.modifiers.new('well', 'BOOLEAN')
        mod.operation, mod.solver, mod.object = 'DIFFERENCE', 'EXACT', cut
        mod.material_mode = 'TRANSFER'
        apply_mod(shell, mod)
        bpy.data.objects.remove(cut, do_unlink=True)
shell.data.set_sharp_from_angle(angle=math.radians(34))
log('apertures', len(shell.data.polygons), 'faces')
# Split the inner lining off into the interior role.
lining = shell.copy()
lining.data = shell.data.copy()
lining.name = 'bus_lining'
bpy.context.collection.objects.link(lining)
wall_idx = {i for i, m in enumerate(shell.data.materials) if m.name == 'bus_wallin'}
for ob, keep_wall in ((shell, False), (lining, True)):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.material_index in wall_idx) != keep_wall], context='FACES')
    bm.to_mesh(ob.data)
    bm.free()
OBJS.append(lining)


# ------------------------------------------------------------ glass/gaskets ---
def frame_ring(name, outer, inner, place, mat):
    bm = bmesh.new()
    n = len(outer)
    L = []
    for layer, ol in ((0, outer), (1, inner), (2, inner), (3, outer)):
        L.append([bm.verts.new(nat(place(u, v, layer))) for u, v in ol])
    for a, b in ((0, 1), (1, 2), (2, 3), (3, 0)):
        for i in range(n):
            bm.faces.new((L[a][i], L[a][(i + 1) % n], L[b][(i + 1) % n], L[b][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(name, bm, [mat], True, 50)


def pane(name, outline, place, mat, outward):
    bm = bmesh.new()
    vs = [bm.verts.new(nat(place(u, v))) for u, v in outline]
    f = bm.faces.new(vs)
    bm.normal_update()
    if f.normal.dot(nat(outward) - nat((0, 0, 0))) < 0:
        f.normal_flip()
    bmesh.ops.triangulate(bm, faces=bm.faces)
    return finish(name, bm, [mat], False)


for s in (-1, 1):
    for z0, z1, (y0, y1) in side_wins(s):
        zc, w, h, yc = (z0 + z1) / 2, z1 - z0, y1 - y0, (y0 + y1) / 2
        xo = s * HW

        def place(u, v, layer, zc=zc, yc=yc, xo=xo, s=s):
            return (xo + s * (.012, .012, -.035, -.035)[layer], yc + v, zc + u)
        frame_ring('side_gasket', rr_outline(w + .024, h + .024, WIN_R + .012, 3), rr_outline(w - .036, h - .036, WIN_R - .01, 3),
                   place, 'rubber')
        pane('side_glass', rr_outline(w - .03, h - .03, WIN_R - .01, 3),
             lambda u, v, zc=zc, yc=yc, xo=xo, s=s: (xo - s * .024, yc + v, zc + u), 'glass', (s, 0, 0))
        if h < .8:     # upper-deck hopper vent
            rbox('vent_bar', (xo - s * .012, y1 - .22, zc), (.03, .03, w - .03), 'rubber', .01, 1)
for di, (z0, z1) in enumerate(DOORS):
    zc, w = (z0 + z1) / 2, z1 - z0
    xo = HW - .035
    rbox('door_reveal', (HW - .05, sum(DOOR_Y) / 2, zc), (.02, DOOR_Y[1] - DOOR_Y[0] - .02, w - .02), 'under', .01, 1)
    for leaf in (-1, 1):
        lz = zc + leaf * w / 4
        lw = w / 2 - .014
        rbox('door_kick', (xo, .62, lz), (.032, .30, lw), 'yellow', .012, 1)
        rbox('door_rail_top', (xo + .004, DOOR_Y[1] - .07, lz), (.036, .07, lw), 'yellow', .012, 1)
        for st in (-1, 1):
            rbox('door_stile', (xo + .004, 1.38, lz + st * (lw / 2 - .026)), (.036, 1.84, .052), 'yellow', .012, 1)
        gh = DOOR_Y[1] - .12 - .80
        gy = .80 + gh / 2
        pane('door_glass', rr_outline(lw - .09, gh - .02, .045), lambda u, v, lz=lz, gy=gy: (xo, gy + v, lz + u), 'glass', (1, 0, 0))
        frame_ring('door_gasket', rr_outline(lw - .07, gh, .05), rr_outline(lw - .10, gh - .03, .038),
                   lambda u, v, layer, lz=lz, gy=gy: (xo + (.02, .02, -.006, -.006)[layer], gy + v, lz + u), 'rubber')
    rbox('door_seam', (xo + .014, 1.38, zc), (.022, DOOR_Y[1] - DOOR_Y[0] - .04, .02), 'rubber', .006, 1)


def front_glass(name, x0, x1, y0, y1, r, end, inset):
    bm = bmesh.new()
    cols, rws = 17, 9
    ww, hh = x1 - x0 - .03, y1 - y0 - .03
    xc, yc = (x0 + x1) / 2, (y0 + y1) / 2
    grid = []
    for j in range(rws):
        v = -hh / 2 + hh * j / (rws - 1)
        row = []
        for i in range(cols):
            u = -ww / 2 + ww * i / (cols - 1)
            du, dv = max(0, abs(u) - (ww / 2 - r)), max(0, abs(v) - (hh / 2 - r))
            if du * du + dv * dv > r * r and du > 0 and dv > 0:
                k = r / math.hypot(du, dv)
                u = math.copysign(ww / 2 - r + du * k, u)
                v = math.copysign(hh / 2 - r + dv * k, v)
            (x, y, z), _ = end_hit(xc + u, yc + v, end)
            row.append(bm.verts.new(nat((x, y, z - end * inset))))
        grid.append(row)
    for j in range(rws - 1):
        for i in range(cols - 1):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    ob = finish(name, bm, ['glass'], True, 80)
    want = nat((0, 0, end)) - nat((0, 0, 0))
    if sum(p.normal.dot(want) for p in ob.data.polygons) < 0:
        for p in ob.data.polygons:
            p.flip()
    return ob


def end_gasket(x0, x1, y0, y1, r, end):
    xc, yc = (x0 + x1) / 2, (y0 + y1) / 2

    def place(u, v, layer):
        (x, y, z), _ = end_hit(xc + u, yc + v, end)
        return (x, y, z + end * (.014, .014, -.04, -.04)[layer])
    frame_ring('end_gasket', rr_outline(x1 - x0 + .028, y1 - y0 + .028, r + .012, 8),
               rr_outline(x1 - x0 - .026, y1 - y0 - .026, r - .01, 8), place, 'rubber')


end_gasket(-WS[0] / 2, WS[0] / 2, WS[1], WS[2], WS[3], 1)
front_glass('windscreen', -WS[0] / 2, WS[0] / 2, WS[1], WS[2], WS[3], 1, .028)
(x, y, z), _ = end_hit(0, 1.6, 1)
rbox('ws_mullion', (0, 1.585, z - .03), (.05, WS[2] - WS[1] - .02, .035), 'rubber', .012, 2)
for x0, x1 in UWS:
    end_gasket(x0, x1, UWS_Y[0], UWS_Y[1], .10, 1)
    front_glass('upper_front', x0, x1, UWS_Y[0], UWS_Y[1], .10, 1, .028)
end_gasket(-RWIN[0] / 2, RWIN[0] / 2, RWIN[1], RWIN[2], .10, -1)
front_glass('rear_window', -RWIN[0] / 2, RWIN[0] / 2, RWIN[1], RWIN[2], .10, -1, .028)
# Destination display: a recessed dark box with the lit roller face.
(x, y, z), _ = end_hit(0, 2.47, 1)
end_gasket(-DEST[0] / 2, DEST[0] / 2, DEST[1], DEST[2], .05, 1)
rbox('dest_box', (0, 2.47, z - .12), (DEST[0] - .02, DEST[2] - DEST[1] - .02, .10), 'console', .01, 1)
bm = bmesh.new()
vs = [bm.verts.new(nat((u, 2.47 + v, z - .066))) for u, v in ((-.88, -.12), (.88, -.12), (.88, .12), (-.88, .12))]
bm.faces.new(vs)
ob = finish('destination', bm, ['dest'], False)
if ob.data.polygons[0].normal.dot(nat((0, 0, 1)) - nat((0, 0, 0))) < 0:
    ob.data.polygons[0].flip()
uvl = ob.data.uv_layers.new(name='UVMap')
for li, l in enumerate(ob.data.loops):
    p = gam(ob.data.vertices[l.vertex_index].co)
    uvl.data[li].uv = ((p[0] + .88) / 1.76, (p[1] - 2.35) / .24)
# Wipers.
for px in (-.70, .30):
    (x0, y0, z0), _ = end_hit(px, WS[1] + .03, 1)
    cyl('wiper', (px, WS[1] + .05, z0 + .045), (px + .52, WS[1] + .66, z0 + .03), .012, 'rubber', 6)
# Front and rear furniture.
for end in (-1, 1):
    pts = []
    for k in range(33):
        x = -1.16 + 2.32 * k / 32
        (_, _, zs), _ = end_hit(x, .47, end)
        pts.append((x, .47, zs + end * .036))
    tube('bumper', pts, 0, 'skirt', profile=[(p[0], p[1]) for p in rr_outline(.09, .26, .04, 3)])
    tube('bumper_strip', [(p[0], p[1] + .03, p[2] + end * .046) for p in pts[2:-2]], 0, 'rubber',
         profile=[(p[0], p[1]) for p in rr_outline(.02, .05, .008, 2)])
    for sx in (-1, 1):
        (x, y, z), n = end_hit(sx * .86, .80, end)
        if end > 0:
            rbox('lamp_housing', (sx * .86, .80, z + .006), (.44, .20, .03), 'chrome', .05, 3)
            for k, dx in enumerate((-.10, .10)):
                rbox('headlamp', (sx * .86 + dx, .80, z + .02), (.17, .14, .02), 'lamp', .04, 3)
            rbox('indicator', (sx * .86, .66, z + .01), (.30, .06, .02), 'tail' if False else 'lamp', .02, 2)
        else:
            rbox('tail_housing', (sx * .98, 1.05, z - .006), (.16, .50, .03), 'chrome', .04, 3)
            rbox('tail_lamp', (sx * .98, 1.15, z - .02), (.12, .24, .02), 'tail', .03, 2)
            rbox('rear_indicator', (sx * .98, .88, z - .02), (.12, .10, .02), 'lamp', .02, 2)
    (x, y, z), n = end_hit(0, .60 if end > 0 else .66, end)
    rbox('plate', (0, y, z + end * .012), (.50, .115, .012), 'plate', .01, 2)
    rbox('plate_band', (-.22, y, z + end * .0195), (.045, .105, .004), 'plateblue', .003, 1)
(x, y, z), n = end_hit(0, 1.05, -1)
rbox('engine_grille', (0, 1.08, z - .008), (1.70, .80, .02), 'grille', .04, 2)
for k in range(9):
    rbox('grille_slat', (0, .74 + k * .085, z - .02), (1.62, .025, .015), 'band', .006, 1)
(x, y, z), n = end_hit(0, .80, 1)
torus('bvg_ring', Vector((x, y, z)) + Vector(n) * .01, n, .085, .014, 'chrome', 24, 6)
dome('bvg_badge', Vector((x, y, z)) + Vector(n) * .006, n, .08, .016, 'badge', 24, 3)
for sx in (-1, 1):
    arm0 = (sx * 1.20, 2.30, HL - .35)
    arm1 = (sx * 1.40, 2.26, HL - .14)
    cyl('mirror_stalk', arm0, arm1, .02, 'band', 8)
    rbox('mirror_head', (sx * 1.40, 2.02, HL - .10), (.06, .40, .22), 'band', .03, 3)
    rbox('mirror_glass', (sx * 1.40, 2.02, HL - .215), (.04, .34, .01), 'chrome', .008, 1)
# Roof hatches.
for zc in (-2.6, 1.6):
    rbox('roof_hatch', (0, 3.89, zc), (.80, .06, .80), 'skirt', .025, 2)
# Wheels.
TYRE = [(.330, -.150), (.410, -.160), (.470, -.140), (.500, -.075), (.500, .075), (.470, .140), (.410, .160), (.330, .150)]
RIM = [(.335, .140), (.315, .125), (.270, .110), (.200, .100), (.140, .105), (.100, .115)]
for z0 in WHEEL_Z:
    for s in (-1, 1):
        cx = s * 1.06
        lathe_x('tyre', [(r, s * a) for r, a in TYRE], cx, WHEEL_Y, z0, 'tyre', 24,
                facing=lambda c, n, cx=cx, z0=z0: n.dot((c - Vector((cx, WHEEL_Y, z0))) -
                    .415 * Vector((0, c.y - WHEEL_Y, c.z - z0)).normalized()))
        lathe_x('rim', [(r, s * a) for r, a in RIM], cx, WHEEL_Y, z0, 'rim', 24, facing=lambda c, n, s=s: n.x * s)
        dome('hub', (cx + s * .115, WHEEL_Y, z0), (s, 0, 0), .10, .05, 'chrome', 20, 3)
rbox('chassis', (0, .28, 0), (2.10, .12, 9.8), 'under', .03, 1)
# Interior: deck floors, seats in pairs, light strips, grab poles, driver.
rbox('lower_floor', (0, .62, 0), (2.36, .04, 10.6), 'floor', .01, 1)
rbox('upper_floor', (0, 2.44, 0), (2.36, .10, 10.6), 'floor', .01, 1)
rbox('upper_ceiling', (0, 3.78, 0), (2.30, .02, 10.4), 'wallin', .005, 1)
rbox('lower_ceiling', (0, 2.38, 0), (2.30, .02, 10.4), 'wallin', .005, 1)
for sx in (-1, 1):
    for yl, ceil in ((.62, 2.36), (2.49, 3.76)):
        rbox('light_strip', (sx * .55, ceil - .012, 0), (.08, .014, 9.8), 'ilight', .004, 1)
    for zc in (-4.35, -3.15, -1.95, -.75, 2.15, 3.35):
        rbox('seat_back', (sx * .72, 1.34, zc - .18), (.86, .62, .09), 'seat', .04, 1, rot=rot_game('x', .10))
        rbox('seat_base', (sx * .72, 1.02, zc), (.86, .10, .44), 'seat', .04, 1)
        rbox('seat_frame', (sx * .72, .82, zc), (.80, .30, .06), 'seatframe', .02, 1)
    for zc in (-4.45, -3.30, -2.15, -1.00, .15, 1.30, 2.45, 3.60):
        rbox('seat_back_up', (sx * .72, 2.98, zc - .18), (.86, .58, .09), 'seat', .04, 1, rot=rot_game('x', .10))
        rbox('seat_base_up', (sx * .72, 2.70, zc), (.86, .10, .44), 'seat', .04, 1)
    for zc in (-.05, 1.45, 4.05):
        cyl('grab_pole', (sx * .62, .64, zc), (sx * .62, 2.36, zc), .02, 'pole', 10)
rbox('driver_console', (-.55, 1.05, 4.95), (.90, .60, .50), 'console', .05, 3)
rbox('driver_seat', (-.55, 1.20, 4.30), (.52, .80, .50), 'console', .05, 3)
torus('driver_wheel', (-.55, 1.45, 4.70), (0, .75, .65), .23, .02, 'console', 24, 6)
log('objects', len(OBJS))

merged = kit.merge_by_role(OBJS, 'bus_')
log('roles', {r: len(o.data.polygons) for r, o in merged.items()})
# Body and interior share one atlas (interior at half density).
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
bpy.ops.uv.smart_project(angle_limit=math.radians(56), island_margin=.002, area_weight=0.0, correct_aspect=True,
                         scale_to_bounds=False)
bpy.ops.object.mode_set(mode='OBJECT')
for l in merged['interior'].data.uv_layers.active.data:
    l.uv = l.uv * .5
bpy.context.view_layer.objects.active = atlas[0]
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.select_all(action='SELECT')
bpy.ops.uv.pack_islands(rotate=True, margin=.0025)
bpy.ops.object.mode_set(mode='OBJECT')
for role, ob in merged.items():
    if role not in ('body', 'interior', 'destination'):
        kit.planar_uv(ob)

if PREVIEW:
    kit.review(REVIEW / 'front34.png', (-5.5, 2.4, 14.0), (0, 1.9, 2.0), ENV, lens=40)
    kit.review(REVIEW / 'side.png', (12.0, 2.2, 0.3), (0, 1.9, 0), ENV, lens=40)
    kit.review(REVIEW / 'rear34.png', (5.5, 2.6, -14.0), (0, 1.9, -2.0), ENV, lens=40)
if not NO_BAKE:
    if 'review_ground' not in bpy.data.objects:
        kit.ground_plane('bake_ground')
    merged['glass'].hide_render = True
    kit.bake_surface_set(atlas, 'body_', BUILD, size=2048, orm_size=1024, ao_distance=.6)
    merged['glass'].hide_render = False
low, high, total = kit.write_parts(merged, ('body', 'interior', 'glass', 'lamp', 'tail', 'interiorLight', 'destination'), BUILD)
assert low[0] >= -1.45 and high[0] <= 1.45 and low[1] >= -1e-5 and high[1] <= 3.95 and low[2] >= -5.56 and high[2] <= 5.56, (low, high)
kit.export_native(merged, OUT / 'berlin-reference-bus-v152')
log('done')
