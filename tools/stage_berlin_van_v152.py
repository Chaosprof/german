"""V152 reference van: a lacquered Barkas B 1000 for the car obstacle's fourth template.

blender -b --python tools/stage_berlin_van_v152.py -- [--preview] [--no-bake]

The old delivery microvan was flat-shaded boxes. This is the East Berlin
forward-control van built as one subdivision surface: a rounded box cage with a
gently raked face, a split wrap-round windscreen and cab door windows cut as
recessed, rubber-sealed glass. Cream over Kiez teal livery with a soft sweep,
round chrome headlamps either side of a grille band, a chrome bumper, sliding
and cab door shut lines, a parcel roundel, mirrors on arms, a lit cab and a
bulkhead so the cargo bay never reads as empty, and the Trabant's wheels.

Game coordinates: x across, y up, z along with the nose at +z (the obstacle
turns it to face the runner). Footprint |x| <= 1.0, |z| <= 2.1, y <= 1.95.
Outputs: audit/berlin-vehicles-v152/van/{models,build,review}.
Runtime roles: body (one baked atlas), glass, lamp, amber, tail.
"""
import bpy, bmesh, math, sys
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import berlin_vehicle_kit_v152 as kit
from berlin_vehicle_kit_v152 import (nat, gam, finish, apply_mod, rbox, rot_game, cyl, tube, torus, dome, lathe_x,
                                     rr_outline, smooth01, lattice_box, log, MATS, OBJS)

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit' / 'berlin-vehicles-v152' / 'van'
OUT, BUILD, REVIEW = STAGE / 'models', STAGE / 'build', STAGE / 'review'
for p in (OUT, BUILD, REVIEW):
    p.mkdir(parents=True, exist_ok=True)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
PREVIEW, NO_BAKE = '--preview' in ARGS, '--no-bake' in ARGS
ENV = ROOT / 'assets' / 'img' / 'berlin-street-env-v1.jpg'
kit.TAG = 'van152'

bpy.ops.wm.read_factory_settings(use_empty=True)

kit.make_materials({
    'cream':    (0xe9dcc0, .36, .0, 1., 'body'),
    'teal':     (0x2e7470, .34, .0, 1., 'body'),
    'chrome':   (0xdfe3e6, .10, 1., 0., 'body'),
    'rubber':   (0x1c1d1f, .78, .0, 0., 'body'),
    'tyre':     (0x232427, .86, .0, 0., 'body'),
    'rim':      (0xe9e3d3, .32, .1, .8, 'body'),
    'under':    (0x26282b, .80, .1, 0., 'body'),
    'grille':   (0x2d3033, .55, .3, 0., 'body'),
    'plate':    (0xf2efe6, .45, .0, .5, 'body'),
    'plateblue': (0x1f3f8f, .45, .0, .5, 'body'),
    'dash':     (0x2a2b2e, .70, .0, 0., 'body'),
    'seat':     (0x7c5a40, .80, .0, 0., 'body'),
    'lining':   (0x6f6a62, .85, .0, 0., 'body'),
    'glass':    (0x9fb2bd, .04, .0, 0., 'glass'),
    'lamp':     (0xfdf7ea, .10, .0, 0., 'lamp'),
    'amber':    (0xffa43a, .20, .0, 0., 'amber'),
    'tail':     (0xe0301f, .20, .0, 0., 'tail'),
}, 'van_')

# --------------------------------------------------------------- body cage ---
VU = [-1, -.93, -.70, -.028, .028, .70, .93, 1]
VY = [.270, .360, .730, 1.070, 1.125, 1.690, 1.815, 1.922]
VZ = [-1.990, -1.925, -1.380, .150, .980, 1.110, 1.660, 1.905, 1.990]


def van_shape(i, j, k):
    u, y, z = VU[i], VY[j], VZ[k]
    w = .915
    lift = smooth01(1.07, 1.93, y)
    if k >= len(VZ) - 3:                       # the face rakes back toward the roof
        z -= .11 * lift * (1 if k == len(VZ) - 1 else .75 if k == len(VZ) - 2 else .45)
    if j == 0:
        w *= .95                              # tucked sill
    if j == len(VY) - 1:
        y += .020 * (1 - u * u)               # crowned roof
        w *= .975
    if k == len(VZ) - 1 or k == 0:
        z += math.copysign(.03 * (1 - u * u) * (.6 + .4 * (1 - lift)), z)   # bowed front and rear
    return (u * w, y, z)


def van_mat(side, a, b):
    if side in ('x-', 'x+'):
        row, col = a, b
        if row == 4 and col == 5:
            return 'glass'                     # cab door window
        return 'teal' if row <= 1 else 'cream'
    if side == 'z+':
        col, row = a, b
        if row == 4 and col in (1, 2, 3, 4, 5):
            return 'glass'                     # wrap-round windscreen (split by a bar)
        return 'teal' if row == 0 else 'cream'
    if side == 'z-':
        col, row = a, b
        if row == 4 and col in (2, 4):
            return 'glass'                     # rear door windows
        return 'teal' if row <= 1 else 'cream'
    if side == 'y-':
        return 'under'
    return 'cream'


shell = lattice_box('van_shell', len(VU), len(VY), len(VZ), van_shape, van_mat)
log('shell', len(shell.data.polygons), 'faces')
WHEEL_Z, WHEEL_Y = (-1.30, 1.26), .364
for z0 in WHEEL_Z:
    for s in (-1, 1):
        bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=40, radius1=.43, radius2=.43, depth=.50)
        q = Vector((0, 0, 1)).rotation_difference(Vector((1, 0, 0)))
        bmesh.ops.transform(bm, matrix=Matrix.Translation(nat((s * 1.02, WHEEL_Y + .01, z0))) @ q.to_matrix().to_4x4(), verts=bm.verts)
        cut = finish('well_cut', bm, ['under'], False, keep=False)
        mod = shell.modifiers.new('well', 'BOOLEAN')
        mod.operation, mod.solver, mod.object = 'DIFFERENCE', 'EXACT', cut
        mod.material_mode = 'TRANSFER'
        apply_mod(shell, mod)
        bpy.data.objects.remove(cut, do_unlink=True)
# Recess the glazing into rubber seals; glass becomes its own object.
names = [m.name for m in shell.data.materials]
if 'van_rubber' not in names:
    shell.data.materials.append(MATS['rubber'])
names = [m.name for m in shell.data.materials]
gi, ri = names.index('van_glass'), names.index('van_rubber')
bm = bmesh.new()
bm.from_mesh(shell.data)
res = bmesh.ops.inset_region(bm, faces=[f for f in bm.faces if f.material_index == gi], thickness=.018, depth=-.014,
                             use_even_offset=True)
for f in res['faces']:
    f.material_index = ri
glass_bm = bmesh.new()
vmap = {}
glass_set = [f for f in bm.faces if f.material_index == gi]
for f in glass_set:
    vs = []
    for v in f.verts:
        if v not in vmap:
            vmap[v] = glass_bm.verts.new(v.co)
        vs.append(vmap[v])
    glass_bm.faces.new(vs)
bmesh.ops.delete(bm, geom=glass_set, context='FACES')
bm.to_mesh(shell.data)
bm.free()
glass_ob = finish('van_glass_panes', glass_bm, ['glass'], True, 60)
for p in shell.data.polygons:
    p.use_smooth = True
shell.data.set_sharp_from_angle(angle=math.radians(55))
BVH = BVHTree.FromObject(shell, bpy.context.evaluated_depsgraph_get())


def hit(origin, direction):
    loc, nrm, _, _ = BVH.ray_cast(nat(origin), nat(direction) - nat((0, 0, 0)))
    assert loc is not None, ('miss', origin, direction)
    return Vector(gam(loc)), Vector(gam(nrm))


def front_pt(x, y, end=1):
    return hit((x, y, end * 5.0), (0, 0, -end))


def side_pt(z, y, s):
    return hit((s * 5.0, y, z), (-s, 0, 0))


# ----------------------------------------------------------------- details ---
# Cab: dashboard, flat bus-style steering wheel, two seats, bulkhead, lining.
rbox('dashboard', (0, 1.02, 1.74), (1.62, .20, .30), 'dash', .05, 3)
torus('steering_wheel', (.42, 1.22, 1.52), (0, .85, .55), .20, .018, 'dash', 28, 6)
cyl('steering_column', (.42, 1.04, 1.66), (.42, 1.22, 1.52), .025, 'dash', 8)
for sx in (-.42, .42):
    rbox('seat_back', (sx, 1.30, 1.06), (.48, .56, .12), 'seat', .06, 2, rot=rot_game('x', -.14))
    rbox('seat_base', (sx, .98, 1.26), (.48, .14, .44), 'seat', .05, 2)
rbox('bulkhead', (0, 1.25, .94), (1.72, 1.20, .04), 'lining', .01, 1)
bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
for v in bm.verts:
    v.co = Vector((v.co.x * 1.74, v.co.y * 1.02, v.co.z * .80))
bmesh.ops.transform(bm, matrix=Matrix.Translation(nat((0, 1.46, 1.46))), verts=bm.verts)
bmesh.ops.reverse_faces(bm, faces=bm.faces)
finish('cab_lining', bm, ['lining'], False)
# Bumpers.
for end in (-1, 1):
    pts = []
    for k in range(29):
        x = -.87 + 1.74 * k / 28
        (fx, fy, fz), _ = front_pt(x, .43, end)
        pts.append((x, .43, fz + end * .034))
    for s in (-1, 1):
        (sx, _, sz), _ = side_pt(end * 1.72, .43, s)
        corner = (s * (abs(sx) + .03), .43, end * 1.72)
        if s < 0:
            pts.insert(0, corner)
        else:
            pts.append(corner)
    tube('bumper', pts, 0, 'chrome', profile=[(p[0], p[1]) for p in rr_outline(.058, .12, .026, 3)])
    tube('bumper_rubber', [(p[0], p[1] + .002, p[2] + end * .029) for p in pts[2:-2]], 0, 'rubber',
         profile=[(p[0], p[1]) for p in rr_outline(.02, .035, .008, 2)])
    (ux, uy, uz), _ = front_pt(0, .31, end)
    rbox('valance', (0, .31, uz - end * .02), (1.60, .07, .08), 'under', .02, 2)
# Face: round headlamps in chrome bezels, grille band, badge, indicators.
for s in (-1, 1):
    (x, y, z), n = front_pt(s * .62, .63, 1)
    c = Vector((x, y, z))
    torus('headlamp_bezel', c + n * .018, tuple(n), .112, .02, 'chrome', 28, 6)
    cyl('headlamp_cup', tuple(c - n * .01), tuple(c + n * .02), .11, 'chrome', 24)
    dome('headlamp_lens', c + n * .022, tuple(n), .104, .034, 'lamp', 28, 4)
    (x, y, z), n = front_pt(s * .64, .83, 1)
    rbox('indicator_frame', (x, y, z + .006), (.15, .065, .016), 'chrome', .014, 2)
    rbox('indicator_lens', (x, y, z + .012), (.13, .05, .012), 'amber', .012, 2)
(x, y, z), n = front_pt(0, .64, 1)
rbox('grille_band', (0, .64, z + .006), (.74, .15, .02), 'chrome', .03, 3)
for k in range(4):
    rbox('grille_slot', (0, .595 + k * .03, z + .016), (.66, .014, .012), 'grille', .006, 1)
(x, y, z), n = front_pt(0, .90, 1)
torus('badge_ring', Vector((x, y, z)) + n * .006, tuple(n), .05, .01, 'chrome', 22, 6)
dome('badge', Vector((x, y, z)) + n * .004, tuple(n), .048, .012, 'teal', 22, 3)
for end, py in ((1, .49), (-1, .58)):
    (x, y, z), n = front_pt(0, py, end)
    rbox('plate', (0, py, z + end * .012), (.44, .105, .012), 'plate', .01, 2)
    rbox('plate_band', (-.195, py, z + end * .0195), (.04, .095, .004), 'plateblue', .003, 1)
# Rear lamps, door split and handles.
for s in (-1, 1):
    (x, y, z), n = front_pt(s * .70, .76, -1)
    rbox('tail_frame', (s * .70, .76, z - .006), (.16, .30, .018), 'chrome', .03, 2)
    rbox('tail_red', (s * .70, .81, z - .014), (.13, .17, .014), 'tail', .025, 2)
    rbox('tail_amber', (s * .70, .665, z - .014), (.13, .06, .014), 'amber', .015, 2)
    (x, y, z), n = front_pt(s * .16, 1.02, -1)
    rbox('rear_handle', (s * .16, 1.02, z - .01), (.14, .03, .03), 'chrome', .012, 2)
pts = []
for k in range(14):
    y = .40 + (1.84 - .40) * k / 13
    (px, py, pz), n = front_pt(0, y, -1)
    pts.append(tuple(Vector((px, py, pz)) + n * .002))
tube('rear_split', pts, .005, 'rubber', 6)
# Side: cab door and sliding door shut lines, handles, roundel, mirrors.
for s in (-1, 1):
    for z0, z1, y0, y1 in ((.99, 1.83, .40, 1.72), (-.62, .74, .40, 1.72)):
        loop = [(z0, y0), (z0, y1), (z1, y1), (z1, y0), (z0, y0)]
        pts = []
        for (za, ya), (zb, yb) in zip(loop[:-1], loop[1:]):
            for k in range(10):
                t = k / 10
                z, y = za + (zb - za) * t, ya + (yb - ya) * t
                (px, py, pz), n = side_pt(z, y, s)
                pts.append(tuple(Vector((px, py, pz)) + n * .0015))
        (px, py, pz), n = side_pt(z0, y0, s)
        pts.append(tuple(Vector((px, py, pz)) + n * .0015))
        tube('door_line', pts, .0045, 'rubber', 4)
    (px, py, pz), n = side_pt(1.08, 1.02, s)
    rbox('cab_handle', (px + s * .012, 1.02, 1.08), (.03, .03, .15), 'chrome', .012, 2)
    (px, py, pz), n = side_pt(-.52, 1.02, s)
    rbox('slide_handle', (px + s * .012, 1.02, -.52), (.03, .03, .18), 'chrome', .012, 2)
    tube('slide_rail', [(s * (px * s + .012), .98, -1.30), (s * (px * s + .012), .98, .74)], .009, 'chrome', 6)
    # Parcel roundel on the cargo side.
    (px, py, pz), n = side_pt(-1.02, 1.36, s)
    c = Vector((px, py, pz))
    dome('roundel', c + n * .004, tuple(n), .21, .012, 'cream', 32, 3)
    torus('roundel_ring', c + n * .008, tuple(n), .205, .012, 'teal', 32, 6)
    rbox('parcel', (px + s * .014, 1.36, -1.02), (.012, .15, .19), 'teal', .012, 2)
    rbox('parcel_string_v', (px + s * .021, 1.36, -1.02), (.006, .15, .025), 'cream', .004, 1)
    rbox('parcel_string_h', (px + s * .021, 1.36, -1.02), (.006, .025, .19), 'cream', .004, 1)
    (px, py, pz), n = side_pt(1.62, 1.55, s)
    cyl('mirror_arm', (px, 1.55, 1.62), (s * .955, 1.60, 1.66), .012, 'chrome', 8)
    cyl('mirror_arm_low', (px, 1.30, 1.64), (s * .955, 1.40, 1.66), .012, 'chrome', 8)
    rbox('mirror_head', (s * .955, 1.50, 1.66), (.04, .22, .12), 'rubber', .02, 2)
    (px, py, pz), n = side_pt(1.80, .74, s)
    rbox('side_indicator', (px + s * .004, .74, 1.80), (.014, .035, .07), 'amber', .01, 1)
# Wipers on the lower windscreen.
(x0, y0, z0), n = front_pt(0, 1.10, 1)
rbox('ws_mullion', (0, 1.405, z0 - .026), (.045, .57, .03), 'rubber', .012, 2, rot=rot_game('x', -.10))
for px in (-.60, .12):
    # The glass is a hole in the shell here, so the tip follows the rake from the pivot.
    (x0, y0, z0), n = front_pt(px, 1.10, 1)
    cyl('wiper', (px, 1.12, z0 + .012), (px + .38, 1.48, z0 - .03), .01, 'rubber', 6)
# Arch lips (teal) and wheels.
for z0 in WHEEL_Z:
    for s in (-1, 1):
        (px, py, pz), _ = side_pt(z0, .80, s)
        arc = []
        for k in range(25):
            ph = math.radians(-2 + 184 * k / 24)
            arc.append((s * (px * s - .004), WHEEL_Y + .01 + .444 * math.sin(ph), z0 + .444 * math.cos(ph)))
        tube('arch_lip', arc, .026, 'teal', 7)
TYRE = [(.250, -.100), (.310, -.108), (.346, -.094), (.362, -.050), (.362, .050), (.346, .094), (.310, .108), (.250, .100)]
RIM = [(.252, .092), (.238, .082), (.205, .070), (.165, .064), (.120, .066), (.095, .074), (.080, .076)]
for z0 in WHEEL_Z:
    for s in (-1, 1):
        cx = s * .795
        lathe_x('tyre', [(r, s * a) for r, a in TYRE], cx, WHEEL_Y, z0, 'tyre', 26,
                facing=lambda c, n, cx=cx, z0=z0: n.dot((c - Vector((cx, WHEEL_Y, z0))) -
                    .29 * Vector((0, c.y - WHEEL_Y, c.z - z0)).normalized()))
        lathe_x('rim', [(r, s * a) for r, a in RIM], cx, WHEEL_Y, z0, 'rim', 26, facing=lambda c, n, s=s: n.x * s)
        dome('hubcap', (cx + s * .074, WHEEL_Y, z0), (s, 0, 0), .086, .034, 'chrome', 20, 3)
rbox('underframe', (0, .23, 0), (1.50, .10, 3.50), 'under', .02, 1)
log('objects', len(OBJS))

merged = kit.merge_by_role(OBJS, 'van_')
log('roles', {r: len(o.data.polygons) for r, o in merged.items()})
kit.uv_pack(merged['body'], .0025, 58)
for role, ob in merged.items():
    if role != 'body':
        kit.planar_uv(ob)

if PREVIEW:
    kit.review(REVIEW / 'front34.png', (3.4, 1.8, 6.4), (0, .95, 0), ENV, lens=40)
    kit.review(REVIEW / 'side.png', (6.8, 1.4, 0.2), (0, .95, 0), ENV, lens=45)
    kit.review(REVIEW / 'rear34.png', (-3.4, 2.0, -6.0), (0, .95, 0), ENV, lens=40)
if not NO_BAKE:
    if 'review_ground' not in bpy.data.objects:
        kit.ground_plane('bake_ground')
    merged['glass'].hide_render = True
    kit.bake_surface_set([merged['body']], 'body_', BUILD, size=1024, orm_size=512, ao_distance=.5)
    merged['glass'].hide_render = False
low, high, total = kit.write_parts(merged, ('body', 'glass', 'lamp', 'amber', 'tail'), BUILD)
assert low[0] >= -1.0 and high[0] <= 1.0 and low[1] >= -1e-5 and high[1] <= 1.95 and low[2] >= -2.1 and high[2] <= 2.1, (low, high)
kit.export_native(merged, OUT / 'berlin-reference-van-v152')
log('done')
