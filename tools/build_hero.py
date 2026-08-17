"""
Berlin Runner hero v3 -- "Berliner in a German-flag T-shirt", round-volume pass.

v2 spent 674 tris and read as a flat paper cutout: bladed 4-sided limbs,
a faceted head, spike-ring hair (a sea urchin from above), a plank torso,
and legs that merge into one dark column. v3 fixes the SHAPE (round n-gon
tubes, a real head sphere, a solid bulged hair cap, a deep torso, separated
legs) while preserving everything that already worked: the 23-bone rig,
the flag-on-the-back identity, proportions, and the bone-axis sign
convention the game's own procedural jump/land/slide/amplifier code
depends on (verified in berlin-runner.html: HERO_AMP amplifies the
*swing amplitude* of LeftArm/RightArm/ForeArm/Shoulder/UpLeg/Leg/Spine01/
neck/Head by up to +58% at full speed, but leaves the mean pose alone --
so rest-pose geometry errors, like v2's shoulder socket sitting outside
the torso's own silhouette, are NOT an animation artifact and don't get
fixed by retuning curves; they have to be fixed in the rest pose itself).

Reproducible generator: builds a low-poly, flat-cel, one-mesh/one-material/
one-texture skinned character matching the game's 23-bone rig, bakes a
looping sprint cycle named "run", and exports berlin-runner-hero-v3.glb.

Run headless:
  blender.exe -b --python tools/build_hero.py -- [--render-only] [--out PATH]

All tunable proportions live in PROP below so iteration doesn't require
re-deriving numbers by hand.
"""
import bpy, bmesh, math, os, sys, mathutils
from mathutils import Vector, Euler

# --------------------------------------------------------------------------
# CLI (blender passes its own args before "--")
# --------------------------------------------------------------------------
argv = sys.argv
argv = argv[argv.index('--') + 1:] if '--' in argv else []
RENDER_ONLY = '--render-only' in argv
OUT_GLB = None
if '--out' in argv:
    OUT_GLB = argv[argv.index('--out') + 1]

REPO = r'C:\Users\tamas\src\german'
SCRATCH = r'C:\Users\tamas\AppData\Local\Temp\claude\C--Users-tamas-src-german\3cc3ec42-f791-4823-acb4-980711ec9f9e\scratchpad\hero'
os.makedirs(SCRATCH, exist_ok=True)
if OUT_GLB is None:
    OUT_GLB = os.path.join(REPO, 'assets', 'models', 'berlin-runner-hero-v3.glb')

# ==========================================================================
# PROPORTIONS  (meters, Z-up, character FRONT faces -Y -- matches v1/v2's
# rig convention: toes/knuckles point -Y = forward. Camera sits at +Y
# looking at -Y, i.e. at the character's BACK.)
# ==========================================================================
PROP = dict(
    # --- skeleton heights (z) -- overall crown-to-toe height and head
    # radius/position are UNCHANGED from v2/v3 (~4.0 head-heights, shoulders
    # ~1.3x head width verified correct in-game -- see head_low_z/
    # head_top_z, both untouched below).
    #
    # v7: shoulder_line_z (and therefore neck_z, since neck attaches at the
    # collar) pulled DOWN from 1.193 to 1.145. This is the fix for "there is
    # no neck": the head sphere's own south pole (chin) hangs r*1.05 below
    # head_low_z by construction (see build_head) -- with the OLD
    # shoulder_line_z==neck_z==1.193 and neck_top_z==head_low_z==1.241, the
    # neck's opening sat entirely INSIDE the head sphere's own volume
    # (the head's chin-pole already dips to ~1.196, below the neck's own
    # top), so the neck was never visible at all -- a balloon head resting
    # directly on a flat shoulder disc. Shortening the torso by 0.048 frees
    # that room; head_low_z/top_z/end_z stay exactly as measured, so overall
    # figure height and head size/position are untouched -- only the torso
    # gives up a little height to a neck that actually exists now.
    toe_tip_z=0.036, toe_base_z=0.068, ankle_z=0.099,
    knee_z=0.432, hip_z=0.765,
    hips_tail_z=0.844,
    spine_z=0.844, spine01_z=0.971, spine02_z=1.082, shoulder_line_z=1.145,
    neck_z=1.145, neck_top_z=1.205,
    head_low_z=1.241, head_top_z=1.581, head_end_z=1.681,
    # Latitude (0=crown pole, 1=chin pole) where the head sphere is
    # truncated instead of continuing down to the chin -- everything below
    # this is now the neck-taper bridge (see build_head/build_mesh_and_rig),
    # not more head mesh. Keeps the actual overlap-with-neck bug from
    # recurring regardless of how neck_z/neck_top_z get tuned later.
    head_jaw_cutoff_v=0.775,
    # Latitude where the cap dome starts (see build_cap) -- everything
    # above this v is red cap fabric.
    head_cap_edge_v=0.40,
    # v8: repurposed. Used to mark a thin light-hair FRINGE right under the
    # cap edge (0.47); a critic pass on the shipped v7 head called the rest
    # of the visible skull -- everything from there down to the jaw, i.e.
    # most of what the rear camera actually sees below the cap -- a "large
    # blank pale egg", because that whole region was coloured 'scalp'
    # (0.72,0.60,0.44), a value only ~20% darker than skin and too close to
    # it to read as hair once the game's own lighting/tonemap touches it.
    # Now marks the split between the main HAIR mass (v0..this) and a
    # visibly darker NAPE band (this..v1, right above the collar) -- see
    # build_head. Moved from 0.47 to 0.68 so hair actually covers most of
    # the back of the skull instead of a thin strip under the cap rim.
    head_hair_fringe_v=0.68,
    # --- lateral / depth ---
    hip_half_w=0.075,
    # v2 spaced the legs at 0.72x hip_half_w and built them as flat 4-sided
    # sticks in near-identical dark jeans colour -- from behind they fused
    # into one column. Wider spacing (0.85x) plus round tubes plus a medial
    # shadow face (added in build_leg) is the actual fix; the flat-stick
    # look was never really about the gap.
    leg_spacing_mult=0.85,
    waist_half_w=0.102,
    # v2's torso depth/width ratio was ~0.6-0.7 -- a shallow box that reads
    # as a plank at a grazing rear-3/4 angle. Deepened toward a real
    # barrel-chest ratio (~0.8-0.85) so the torso has volume from every
    # angle, not just dead-on.
    torso_half_d_waist=0.088, torso_half_d_chest=0.128,
    # v7: chest widened slightly (0.172->0.183) and the deltoid cap
    # enlarged separately in build_arm -- together these push shoulder
    # width from ~1.11x head-width to ~1.24x, closer to the measured
    # ~1.3x target, without touching shoulder_socket_x (the verified-in-
    # game arm bone position).
    chest_half_w=0.183,
    head_radius=0.205,
    # Hair is now a bulge sculpted INTO the head sphere (see build_head),
    # not a ring of separate spike meshes -- it is round from every angle,
    # including straight overhead where the slide camera looks.
    hair_bulge=0.075,
    neck_radius=0.052,
    # v2's shoulder socket (0.225) sat OUTSIDE the chest silhouette (half-
    # width 0.155) by 45% -- a REST-POSE offset, not an animation problem,
    # and the single biggest reason the arms read as held out to the side
    # even mid-swing (see module docstring). Pulled in to just past the
    # chest edge, where a real shoulder cap actually sits.
    shoulder_socket_x=0.186,
    # v7: arms lengthened (+10%/+8%) and hands enlarged separately in
    # build_arm -- a critic pass on the shipped asset called the arms
    # short/thin and the hands "featureless capsule blobs, no thumb, no
    # finger break."
    upper_arm_len=0.206, forearm_len=0.185, hand_len=0.096,
    # Same numeric radii as v2, but now the CROSS-SECTION is an 8-gon
    # (round tube) instead of a 4-gon (square prism) -- see N_LIMB below.
    # A 4-gon tube shows a full flat face dead-on to the rear-3/4 camera at
    # some point in every swing; an 8-gon never presents a face wider than
    # ~40% of the diameter, so it can't read as a blade.
    # v3 kept v2's radii while only rounding the cross-section, so the figure
    # stopped being a blade and became a stick instead -- in game it read as
    # a skinny mannequin, not the chunky-cute toy the reference is. At ~4.0
    # head-heights the limbs have to carry real mass to balance a head this
    # large; "thin" in the reference means thin RELATIVE TO A BIG HEAD, not
    # literally spindly. Radii up ~27%.
    upper_arm_r0=0.047, upper_arm_r1=0.038,
    forearm_r0=0.036, forearm_r1=0.029,
    thigh_r0=0.066, thigh_r1=0.052,
    shin_r0=0.049, shin_r1=0.039,
    # Oversized trainers are part of the reference silhouette and they give
    # the stride its visual beat at the bottom of the dark leg column.
    foot_len=0.158, foot_half_w=0.056, foot_h=0.066,
    toe_len=0.072,
    shoe_sole_h=0.024, shoe_mid_h=0.016,
)

# Cross-section vertex counts -- round tubes, not flat boxes. Bumped
# 10->12 (v7): a critic pass called the whole figure "visibly assembled
# from raw primitives... you can count the individual quad panels" on the
# head, torso and limbs alike. Kept as ONE shared value across torso/limb/
# shoe/hand/neck/head-skull/cap so every join in the figure (torso-to-neck,
# neck-to-skull, skull-to-cap, thigh-to-shin-to-shoe, arm-to-hand) stays a
# simple 1:1 ring bridge with no vertex-count reduction trick anywhere.
N_LIMB = 12
N_TORSO = 12
N_SHOE = 12
N_HAND = 12

# ==========================================================================
# ATLAS  -- flat colour swatches, one per costume region. 512x512, 8x8 grid
# of 64px cells, each filled with one solid colour (crisp band edges are
# built into the MESH via separate ring loops, not into the texture).
# ==========================================================================
ATLAS_SIZE = 512
CELL = 64
GRID = ATLAS_SIZE // CELL

COLORS = {
    # Value strategy vs. Berlin Runner's bright ochre road: a DARK anchor
    # mass (torso+legs) topped by a PALE head, built from the German
    # tricolour instead of a plain vest.
    'flag_black':   (0.070, 0.065, 0.063),
    'flag_red':     (0.720, 0.110, 0.115),
    'flag_gold':    (0.960, 0.740, 0.090),
    'skin':         (0.930, 0.800, 0.670),
    'skin_shadow':  (0.780, 0.620, 0.500),
    # v8: the "keep the head light" rule from earlier passes was protecting
    # the right thing (a dark ash-blond, 0.26/0.20/0.13, fused the head into
    # the tee's black band and killed the light-head-over-dark-body read)
    # but got applied too literally -- "don't make the head DARK" was
    # misread as "don't have hair", so the whole back of the skull got
    # painted 'scalp', a near-skin tone barely a step off the face itself.
    # From the rear camera almost the whole visible head is this region, so
    # it read as one featureless pale egg with a hat balanced on top. hair/
    # hair_dark below are a warm ash-blond that IS clearly a step or two
    # darker than skin (so it reads as hair, not more face) while staying
    # far lighter than flag_black (0.07) -- the head stays the lightest
    # mass in the figure, it just isn't uniformly bald-pale anymore.
    # v9: 0.62 was still close enough to skin that the head read as one big
    # smooth sphere in game -- and a big smooth sphere is exactly what the
    # cel quantiser turns into a hard light/dark terminator across the
    # crown. That terminator is what a critic pass read as "a hard diagonal
    # seam splitting the head into a gold zone and an olive-grey zone" and
    # scored as a shading glitch; it was never a texture seam. Pulling the
    # hair to a mid warm brown gives the skull an actual material boundary
    # of its own, so the eye reads hair-under-a-cap instead of a lit sphere.
    # This sits deliberately between the two failed extremes: far lighter
    # than the 0.26 that fused the head into the tee's black band, clearly
    # darker than the 0.62 that vanished into the skin.
    'hair':         (0.420, 0.330, 0.205),
    'hair_dark':    (0.290, 0.225, 0.135),
    # Near-black jeans (0.085) sat directly under the tricolour's black
    # shoulder band, so torso and legs fused and the figure's lower two
    # thirds read as one undifferentiated dark column -- only the red and
    # gold bands broke it up at all. Real mid denim keeps the legs safely
    # darker than the bright ochre road (so the dark-anchor strategy still
    # holds) while separating them from the black band above.
    'jeans':        (0.235, 0.265, 0.355),
    # Medial-face shadow band on each leg -- a deliberate value break so the
    # two legs stay two separate readable shapes even when they swing close
    # together, instead of fusing into one dark mass at chase distance.
    'jeans_shadow': (0.135, 0.155, 0.215),
    'jeans_cuff':   (0.330, 0.365, 0.470),
    'shoe_white':   (0.950, 0.948, 0.930),
    'shoe_red':     (0.720, 0.110, 0.115),
    'shoe_mid':     (0.820, 0.815, 0.790),
    'shoe_sole':    (0.200, 0.130, 0.120),
    'wristband':    (0.720, 0.110, 0.115),
    'eye':          (0.090, 0.080, 0.075),
    'eyebrow':      (0.220, 0.165, 0.095),
    # v7 cap. A harsh independent critique of the shipped hero scored the
    # head 2/10: "a hard diagonal seam splitting it into a gold zone and an
    # olive-grey zone with no brim, hood edge, or hair silhouette -- reads
    # as a shading glitch, not headwear" and separately flagged the head's
    # muddy olive/gold as sitting too close in value+saturation to the
    # game's ochre road, defeating the reference's cap>lane>body value
    # hierarchy. A real cap (flag-red, brighter/more saturated than the
    # torso's own flag_red) fixes both at once: the boundary becomes a
    # deliberate hard garment edge instead of an unreadable seam, AND it's
    # a beacon-bright saturated colour the road can never compete with.
    'cap_red':      (0.930, 0.105, 0.095),
    'cap_red_dark': (0.620, 0.075, 0.070),
    # v8: dark plastic snapback-strap adjuster at the back of the cap (see
    # build_cap) -- a distinct neutral charcoal, not another shade of cap
    # fabric, so the notch reads as a hardware detail rather than a shading
    # error.
    'cap_strap':    (0.110, 0.100, 0.105),
    # v8: hands read as "grey metallic cylinders" in game -- plain 'skin'
    # (0.93/0.80/0.67, a fairly desaturated pale peach) survives fine on the
    # big torso/head masses but the small hand volumes apparently don't hold
    # onto enough saturation once the game's own lighting/tonemap gets to
    # them. A separate, more saturated/warmer tone JUST for the hands (as if
    # the hands are a touch more flushed/tanned than the covered forearm --
    # a defensible read for a sprinting figure) is cheap insurance against
    # that regardless of the exact cause.
    'hand_skin':        (0.860, 0.560, 0.380),
    'hand_skin_shadow': (0.690, 0.400, 0.250),
}

def build_atlas():
    img = bpy.data.images.new('HeroAtlas', ATLAS_SIZE, ATLAS_SIZE, alpha=False)
    import numpy as np
    px = np.ones((ATLAS_SIZE, ATLAS_SIZE, 4), dtype=np.float32)
    names = list(COLORS.keys())
    rects = {}
    for i, name in enumerate(names):
        gx, gy = i % GRID, i // GRID
        x0, y0 = gx * CELL, gy * CELL
        r, g, b = COLORS[name]
        px[y0:y0 + CELL, x0:x0 + CELL, 0] = r
        px[y0:y0 + CELL, x0:x0 + CELL, 1] = g
        px[y0:y0 + CELL, x0:x0 + CELL, 2] = b
        px[y0:y0 + CELL, x0:x0 + CELL, 3] = 1.0
        cx = (x0 + CELL / 2) / ATLAS_SIZE
        cy = (y0 + CELL / 2) / ATLAS_SIZE
        rects[name] = (cx, cy)
    px = px[::-1, :, :]
    for name in rects:
        cx, cy = rects[name]
        rects[name] = (cx, 1.0 - cy)
    img.pixels = px.ravel().tolist()
    img.pack()
    return img, rects

# ==========================================================================
# MESH BUILD HELPERS
# ==========================================================================
bm = bmesh.new()
uv_layer = bm.loops.layers.uv.new('UVMap')
vert_weights = []   # parallel list, index-matched to bm.verts creation order

def V(co, weights):
    v = bm.verts.new(co)
    vert_weights.append(dict(weights))
    return v

def quad(a, b, c, d, color_key, rects):
    f = bm.faces.new((a, b, c, d))
    uv = rects[color_key]
    for loop in f.loops:
        loop[uv_layer].uv = uv
    return f

def tri(a, b, c, color_key, rects):
    f = bm.faces.new((a, b, c))
    uv = rects[color_key]
    for loop in f.loops:
        loop[uv_layer].uv = uv
    return f

def rect_ring(cx, cy, z, hw, hd, weights):
    """4 verts forming a rectangle cross-section (used only where a hard
    box edge is wanted, e.g. the flat shoe sole plate)."""
    return [
        V((cx - hw, cy - hd, z), weights),
        V((cx + hw, cy - hd, z), weights),
        V((cx + hw, cy + hd, z), weights),
        V((cx - hw, cy + hd, z), weights),
    ]

def ellipse_ring(cx, cy, z, rx, ry, weights, n=8, phase=0.0):
    """n verts evenly spaced around an ellipse -- a round tube cross-
    section. Winding direction doesn't matter: recalc_face_normals fixes
    outward-facing normals once at the very end of the build."""
    pts = []
    for i in range(n):
        theta = phase + i * (2 * math.pi / n)
        x = rx * math.cos(theta)
        y = ry * math.sin(theta)
        pts.append(V((cx + x, cy + y, z), weights))
    return pts

def flat_fb_phase(n):
    """Phase offset so an n-gon (n even) has one flat EDGE dead ahead
    (theta=-90, -Y/front) and one flat EDGE dead behind (theta=+90, +Y/
    back) instead of a lone vertex there. That gives the torso a crisp
    flat back panel for the flag graphic (no facet seam through the
    middle of it) while the sides stay rounded."""
    return math.pi / n - math.pi / 2

def bridge_ring(ring_lo, ring_hi, color_key, rects, flip=False):
    n = len(ring_lo)
    for i in range(n):
        a, b = ring_lo[i], ring_lo[(i + 1) % n]
        c, d = ring_hi[(i + 1) % n], ring_hi[i]
        if flip:
            quad(b, a, d, c, color_key, rects)
        else:
            quad(a, b, c, d, color_key, rects)

def bridge_ring_colored(ring_lo, ring_hi, color_fn, rects, flip=False, cx=0.0, cy=0.0):
    """Like bridge_ring, but color_fn(theta) picks the swatch per face from
    the face's mid-angle around (cx, cy) -- used to put a medial shadow
    band on the inner-facing side of each leg."""
    n = len(ring_lo)
    for i in range(n):
        a, b = ring_lo[i], ring_lo[(i + 1) % n]
        c, d = ring_hi[(i + 1) % n], ring_hi[i]
        mx = (a.co.x + b.co.x) / 2.0 - cx
        my = (a.co.y + b.co.y) / 2.0 - cy
        theta = math.atan2(my, mx)
        ck = color_fn(theta)
        if flip:
            quad(b, a, d, c, ck, rects)
        else:
            quad(a, b, c, d, ck, rects)

def cap(ring, color_key, rects, flip=False):
    verts = list(reversed(ring)) if flip else ring
    if len(verts) == 4:
        quad(verts[0], verts[1], verts[2], verts[3], color_key, rects)
    else:
        f = bm.faces.new(verts)
        uv = rects[color_key]
        for loop in f.loops:
            loop[uv_layer].uv = uv

def lerp(a, b, t): return a + (b - a) * t

# ==========================================================================
# BUILD
# ==========================================================================
def build_mesh_and_rig():
    atlas_img, rects = build_atlas()
    P = PROP
    torso_phase = flat_fb_phase(N_TORSO)

    # ---------------- torso: 4 rings -> 3 flag segments, 8-gon cross-
    # section with a flat front AND flat back edge (torso_phase) so the
    # flag panel stays one crisp flat plane, sides now rounded instead of
    # boxy. Weighted, NOT equal thirds: black dominates (~55%) as the dark
    # anchor mass against the game's bright ochre road; red is a strong
    # middle (~30%); gold stays a narrow hem accent (~15%).
    z_hip = P['hip_z']
    z_black_top = P['shoulder_line_z']
    total_h = z_black_top - z_hip
    z_gold_top = z_hip + 0.15 * total_h
    z_red_top = z_gold_top + 0.30 * total_h

    def torso_extent(z):
        t = (z - z_hip) / (z_black_top - z_hip)
        hw = lerp(P['waist_half_w'], P['chest_half_w'], t)
        hd = lerp(P['torso_half_d_waist'], P['torso_half_d_chest'], t)
        return hw, hd

    def torso_weights(z):
        zs = [P['hip_z'], P['spine_z'], P['spine01_z'], P['spine02_z'], P['shoulder_line_z']]
        names = ['Hips', 'Spine', 'Spine01', 'Spine02', 'Spine02']
        if z <= zs[0]: return {names[0]: 1.0}
        for i in range(len(zs) - 1):
            if zs[i] <= z <= zs[i + 1]:
                t = (z - zs[i]) / max(1e-6, zs[i + 1] - zs[i])
                a, b = names[i], names[i + 1]
                if a == b: return {a: 1.0}
                return {a: 1 - t, b: t}
        return {names[-1]: 1.0}

    ring_zs = [z_hip, z_gold_top, z_red_top, z_black_top]
    torso_rings = []
    for z in ring_zs:
        hw, hd = torso_extent(z)
        w = torso_weights(z)
        torso_rings.append(ellipse_ring(0, 0, z, hw, hd, w, n=N_TORSO, phase=torso_phase))

    bridge_ring(torso_rings[0], torso_rings[1], 'flag_gold', rects)
    bridge_ring(torso_rings[1], torso_rings[2], 'flag_red', rects)
    bridge_ring(torso_rings[2], torso_rings[3], 'flag_black', rects)
    cap(torso_rings[0], 'jeans', rects, flip=True)

    hw0, hd0 = torso_extent(z_hip)

    # ---------------- pelvis saddle: connects torso bottom to both legs
    pelvis_z = z_hip - 0.05
    pelvis_ring = ellipse_ring(0, 0, pelvis_z, hw0 * 0.92, hd0 * 0.92, {'Hips': 1.0}, n=N_TORSO, phase=torso_phase)
    bridge_ring(pelvis_ring, torso_rings[0], 'jeans', rects)

    # ---------------- neck + head
    # v7: the neck is now a REAL, visible column between the collar and the
    # jaw. Previously neck_top_z sat almost exactly where the head sphere's
    # OWN unclipped underside already reached (the sphere's south pole hangs
    # r*1.05 below its own "head_low_z" reference by construction -- a pure
    # side-effect of that *1.05 z-stretch, not a deliberate jaw shape), so
    # the neck's top opening sat entirely inside the head's own solid
    # volume and was never visible at all: a head balloon resting straight
    # on the shoulders. build_head() below now stops at head_jaw_cutoff_v
    # instead of continuing down to that pole, returning an OPEN jaw ring
    # that build_neck_taper (further below) bridges explicitly into the
    # neck, so the two pieces meet at a real, visible seam instead of one
    # swallowing the other.
    neck_lo = ellipse_ring(0, 0, P['neck_z'], P['neck_radius'], P['neck_radius'], {'Spine02': 0.35, 'neck': 0.65}, n=N_LIMB)
    neck_hi = ellipse_ring(0, 0, P['neck_top_z'], P['neck_radius'] * 0.95, P['neck_radius'] * 0.95, {'neck': 0.85, 'Head': 0.15}, n=N_LIMB)
    bridge_ring(neck_lo, neck_hi, 'skin', rects)
    bridge_ring(torso_rings[3], neck_lo, 'flag_black', rects)

    def build_head():
        # Only the SKULL band lives in this bespoke latitude loop now --
        # from head_cap_edge_v (where the cap takes over, see build_cap)
        # down to head_jaw_cutoff_v (where the neck taper takes over, see
        # build_neck_taper). Segment count == N_LIMB so both open ends
        # bridge into their neighbours with a plain 1:1 ring zip, no
        # vertex-count reduction trick needed anywhere in the head/neck/cap
        # chain.
        segs = N_LIMB
        rings = 7
        cz = (P['head_low_z'] + P['head_top_z']) / 2.0
        r = P['head_radius']
        v0, v1 = P['head_cap_edge_v'], P['head_jaw_cutoff_v']
        fringe_v = P['head_hair_fringe_v']
        verts = {}   # (ri, si) -> (vertex, color_key)
        for ri in range(rings + 1):
            v = v0 + (v1 - v0) * ri / rings
            phi = v * math.pi
            z = cz + r * math.cos(phi) * 1.05
            ring_r = r * math.sin(phi)
            for si in range(segs):
                theta = si / segs * 2 * math.pi
                x = ring_r * math.cos(theta)
                y = ring_r * math.sin(theta) * 1.05
                is_front = y < -ring_r * 0.15
                # v8: is_front now checked FIRST and unconditionally gets
                # skin -- v7 checked "v < fringe_v" first, which painted a
                # full-face hair mask down to fringe_v regardless of front/
                # back; that was harmless while fringe_v sat at 0.47 (still
                # above the eyeline) but would paint hair straight across
                # the face now that fringe_v marks the much-lower hair/nape
                # split (0.68). Everywhere else (sides + back -- the great
                # majority of what the rear camera sees): 'hair' from the
                # cap edge down to fringe_v, then 'hair_dark' the rest of
                # the way to the jaw/nape, so the back of the skull is a
                # real two-tone hair mass instead of the old near-skin
                # 'scalp' egg.
                if is_front:
                    ck = 'skin' if v < 0.85 else 'skin_shadow'
                elif v < fringe_v:
                    ck = 'hair'
                else:
                    ck = 'hair_dark'
                verts[(ri, si)] = (V((x, y, z), {'Head': 1.0}), ck)
        for ri in range(rings):
            for si in range(segs):
                a, cka = verts[(ri, si)]
                b, ckb = verts[(ri, (si + 1) % segs)]
                c, _ = verts[(ri + 1, (si + 1) % segs)]
                d, _ = verts[(ri + 1, si)]
                quad(a, b, c, d, cka, rects)
        top_ring = [verts[(0, si)] for si in range(segs)]          # -> cap
        bottom_ring = [verts[(rings, si)] for si in range(segs)]   # -> neck
        return cz, r, top_ring, bottom_ring

    head_cz, head_r, head_top_ring, head_jaw_ring = build_head()

    def build_cap(top_ring, cz, r):
        # v8: replaces the v7 all-around flared brim. That flare fixed v6's
        # "shading-glitch head" complaint but overcorrected into a new one:
        # a uniform conical flare in every direction reads as a fireman's
        # helmet / coolie hat, not a baseball cap, from the ONE angle that
        # matters (dead behind). A real ballcap seen from behind is a round,
        # fairly SNUG dome with the peak hidden in front and often a strap
        # notch visible at the back. Rebuilt as three pieces: a snug dome
        # (no all-around flare), a peak confined to a front arc the rear
        # camera can never see (but the overhead slide-cam correctly can),
        # and a snapback strap notch on the back arc the rear camera stares
        # straight at.
        n = len(top_ring)
        v0 = P['head_cap_edge_v']
        phi0 = v0 * math.pi
        z0 = cz + r * math.cos(phi0) * 1.05
        base_rx = r * math.sin(phi0)
        base_ry = base_rx * 1.05
        join = [vtx for vtx, _ck in top_ring]   # reuse the skull's own verts -- zero seam gap

        # Snug dome: barely wider than the skull at its own base (1.04x, vs
        # v7's 1.24x brim flare) and topping out much lower -- tip sits only
        # ~0.02 above head_top_z instead of v7's ~0.08, so it reads as a cap
        # resting close to the head, not a tall pointed hat.
        dome_base = ellipse_ring(0, 0, z0 + 0.006, base_rx * 1.04, base_ry * 1.04, {'Head': 1.0}, n=n)
        dome_mid = ellipse_ring(0, 0, z0 + 0.072, base_rx * 0.64, base_ry * 0.64, {'Head': 1.0}, n=n)
        tip = V((0, 0, z0 + 0.118), {'Head': 1.0})

        # Snapback strap notch: pull a small back-centred arc of the dome's
        # base ring inward (a real dimple, not just a colour trick) and
        # colour that skirt band 'cap_strap' -- a neutral dark plastic tone,
        # not another shade of cap fabric -- so it reads as hardware sitting
        # right where the chase camera looks, not a shading error. theta ==
        # pi/2 (si == n/4) is the +Y/back direction in this ring's own
        # convention (build_head's is_front test is "y < 0" = front).
        # Pulling the notch INWARD read as basically invisible from the
        # rear-high chase camera -- viewed nearly edge-on, an inward dimple
        # barely changes the silhouette. A small OUTWARD tab (the centre
        # vertex pushed back, its two neighbours held in) breaks the round
        # profile instead, the way a real plastic strap adjuster actually
        # sits proud of a cap's fabric.
        back_i = n // 4
        for di in (-1, 0, 1):
            idx = (back_i + di) % n
            push = 1.16 if di == 0 else 0.94
            dome_base[idx].co.x *= push
            dome_base[idx].co.y *= push

        def ang_dist(a, b):
            d = abs(a - b) % (2 * math.pi)
            return min(d, 2 * math.pi - d)

        def skirt_color(theta):
            return 'cap_strap' if ang_dist(theta, math.pi / 2) < 0.42 else 'cap_red_dark'
        bridge_ring_colored(join, dome_base, skirt_color, rects)   # shadowed skirt, strap notch at back
        bridge_ring(dome_base, dome_mid, 'cap_red', rects)
        for i in range(n):
            a, b = dome_mid[i], dome_mid[(i + 1) % n]
            tri(a, b, tip, 'cap_red', rects)

        # Forward peak: the only flare left, confined to a ~120deg arc dead
        # ahead (theta == 3pi/2 == -pi/2, the -Y/front direction). From
        # directly behind -- the only angle the player ever actually sees --
        # the skull itself hides this completely; from straight overhead
        # (the slide-cam test) it correctly reads as a peak breaking an
        # otherwise round cap silhouette, exactly like a real ballcap does.
        front_i = 3 * n // 4
        span = 2   # +/- 2 segments either side of centre = 5 verts, ~120deg
        idxs = [(front_i + d) % n for d in range(-span, span + 1)]
        peak_top, peak_edge = [], []
        for d, idx in zip(range(-span, span + 1), idxs):
            w = max(0.0, 1.0 - abs(d) / (span + 0.6))
            root = join[idx].co
            reach = 0.095 * w
            pt = Vector((root.x, root.y - reach, root.z - reach * 0.30))
            peak_top.append(V(tuple(pt), {'Head': 1.0}))
            pe = Vector((pt.x, pt.y + reach * 0.10, pt.z - 0.010))
            peak_edge.append(V(tuple(pe), {'Head': 1.0}))
        for i in range(len(idxs) - 1):
            a, b = join[idxs[i]], join[idxs[i + 1]]
            quad(a, b, peak_top[i + 1], peak_top[i], 'cap_red', rects)               # peak top surface
            quad(peak_top[i], peak_top[i + 1], peak_edge[i + 1], peak_edge[i], 'cap_red_dark', rects)  # peak's own thin bound edge
    build_cap(head_top_ring, head_cz, head_r)

    def build_neck_taper(jaw_ring, cz, r):
        # Bridges the skull's open jaw ring down into the neck cylinder's
        # own top ring through one eased mid ring. Each face is coloured
        # from its SOURCE (jaw-side) vertex, the same convention the
        # skull's own latitude bands use, so the taper reads as a
        # continuation of the jaw/nape hair, not a seam.
        n = len(jaw_ring)
        v1 = P['head_jaw_cutoff_v']
        phi1 = v1 * math.pi
        z1 = cz + r * math.cos(phi1) * 1.05
        rx1 = r * math.sin(phi1)
        ry1 = rx1 * 1.05
        z_mid = lerp(z1, P['neck_top_z'], 0.5)
        rx_mid = lerp(rx1, P['neck_radius'] * 0.95, 0.55)
        ry_mid = lerp(ry1, P['neck_radius'] * 0.95, 0.55)
        mid = ellipse_ring(0, 0, z_mid, rx_mid, ry_mid, {'neck': 0.55, 'Head': 0.45}, n=n)
        for i in range(n):
            a, cka = jaw_ring[i]
            b, ckb = jaw_ring[(i + 1) % n]
            c, d = mid[(i + 1) % n], mid[i]
            quad(a, b, c, d, cka, rects)
        bridge_ring(mid, neck_hi, 'skin', rects)
    build_neck_taper(head_jaw_ring, head_cz, head_r)

    def build_ear(sign):
        cx = sign * head_r * 0.92
        cz = head_cz + head_r * 0.02
        cy = -head_r * 0.05
        hw, hh, hd = 0.018, 0.045, 0.028
        w = {'Head': 1.0}
        pts = [
            V((cx - sign * hw, cy - hd, cz - hh), w), V((cx + sign * hw, cy - hd, cz - hh), w),
            V((cx + sign * hw, cy + hd, cz - hh), w), V((cx - sign * hw, cy + hd, cz - hh), w),
            V((cx - sign * hw, cy - hd, cz + hh), w), V((cx + sign * hw, cy - hd, cz + hh), w),
            V((cx + sign * hw, cy + hd, cz + hh), w), V((cx - sign * hw, cy + hd, cz + hh), w),
        ]
        lo, hi = pts[0:4], pts[4:8]
        bridge_ring(lo, hi, 'skin', rects, flip=(sign > 0))
        cap(hi, 'skin', rects, flip=(sign < 0))
    build_ear(1); build_ear(-1)

    def build_brow_dot(sign):
        cx = sign * head_r * 0.32
        cz = head_cz + head_r * 0.12
        cy = -head_r * 0.92
        w = {'Head': 1.0}
        s = 0.028
        pts = [V((cx - s, cy, cz - s * 0.4), w), V((cx + s, cy, cz - s * 0.4), w),
               V((cx + s, cy, cz + s * 0.4), w), V((cx - s, cy, cz + s * 0.4), w)]
        quad(pts[0], pts[1], pts[2], pts[3], 'eyebrow', rects)
    build_brow_dot(1); build_brow_dot(-1)

    # ---------------- arms
    def build_arm(sign):
        sx = sign * P['shoulder_socket_x']
        sh_bone = 'LeftShoulder' if sign > 0 else 'RightShoulder'
        # v7 deltoid: was a flat 2-ring disc (0.042 -> 0.039 radius over
        # 0.03 of height) that read as a thin tab, not a shoulder muscle --
        # "shoulders slope too steeply and have no deltoid mass" in the
        # brief, and independently "visibly assembled from raw primitives"
        # from the critic. Rebuilt as a 3-ring rounded CAP (cap -> belly
        # bulge -> taper into the upper arm) that actually rises above the
        # torso's own shoulder line and bulges wider than either ring end,
        # the way a real deltoid does, instead of just being the torso's
        # taper continuing in a straight line to a point.
        # v8: cap raised/enlarged again (0.032/0.052 -> 0.044/0.058 top,
        # 0.066 -> 0.078 belly, 0.049 -> 0.053 base) -- the brief's secondary
        # note called the shoulders still steep-sloped with modest deltoid
        # mass even after v7's disc->cap rebuild; there was budget headroom
        # (~1882/6000 tris) to just spend more on it.
        sh_top = ellipse_ring(sx, 0, P['shoulder_line_z'] + 0.044, 0.058, 0.058, {'Spine02': 0.4, sh_bone: 0.6}, n=N_LIMB)
        sh_belly = ellipse_ring(sx, 0, P['shoulder_line_z'] + 0.010, 0.078, 0.078, {sh_bone: 1.0}, n=N_LIMB)
        sh_lo = ellipse_ring(sx, 0, P['shoulder_line_z'] - 0.026, 0.053, 0.053, {sh_bone: 1.0}, n=N_LIMB)
        bridge_ring(sh_top, sh_belly, 'flag_black', rects, flip=(sign > 0))
        bridge_ring(sh_belly, sh_lo, 'flag_black', rects, flip=(sign > 0))
        cap(sh_top, 'flag_black', rects, flip=(sign < 0))

        arm_bone = 'LeftArm' if sign > 0 else 'RightArm'
        fore_bone = 'LeftForeArm' if sign > 0 else 'RightForeArm'
        hand_bone = 'LeftHand' if sign > 0 else 'RightHand'

        z0, z1 = P['shoulder_line_z'] - 0.024, P['shoulder_line_z'] - 0.024 - P['upper_arm_len']
        # 3-point taper (shoulder -> mid-bicep -> elbow) instead of a
        # straight linear taper -- a slight belly gives the tube a real
        # muscle-like profile instead of a perfect cone.
        z_mid = z0 - (z0 - z1) * 0.45
        r_mid = lerp(P['upper_arm_r0'], P['upper_arm_r1'], 0.38) * 1.06
        ua_lo = ellipse_ring(sx, 0, z0, P['upper_arm_r0'], P['upper_arm_r0'], {'LeftShoulder' if sign > 0 else 'RightShoulder': 0.3, arm_bone: 0.7}, n=N_LIMB)
        ua_belly = ellipse_ring(sx, 0, z_mid, r_mid, r_mid, {arm_bone: 1.0}, n=N_LIMB)
        ua_hi = ellipse_ring(sx, 0, z1, P['upper_arm_r1'], P['upper_arm_r1'], {arm_bone: 1.0}, n=N_LIMB)
        # sleeve cuff: bottom third of upper arm is skin (short sleeve)
        sleeve_split_z = z0 - (z0 - z1) * 0.62
        r_sleeve = lerp(P['upper_arm_r0'], P['upper_arm_r1'], 0.62)
        ua_sleeve = ellipse_ring(sx, 0, sleeve_split_z, r_sleeve, r_sleeve, {arm_bone: 1.0}, n=N_LIMB)
        bridge_ring(ua_lo, ua_belly, 'flag_black', rects, flip=(sign > 0))
        bridge_ring(ua_belly, ua_sleeve, 'flag_black', rects, flip=(sign > 0))
        bridge_ring(ua_sleeve, ua_hi, 'skin', rects, flip=(sign > 0))

        z2 = z1 - P['forearm_len']
        z_fmid = z1 - (z1 - z2) * 0.42
        r_fmid = lerp(P['forearm_r0'], P['forearm_r1'], 0.35) * 1.05
        fa_hi = ellipse_ring(sx, 0, z1, P['forearm_r0'], P['forearm_r0'], {arm_bone: 0.25, fore_bone: 0.75}, n=N_LIMB)
        fa_belly = ellipse_ring(sx, 0, z_fmid, r_fmid, r_fmid, {fore_bone: 1.0}, n=N_LIMB)
        fa_lo = ellipse_ring(sx, 0, z2, P['forearm_r1'], P['forearm_r1'], {fore_bone: 1.0}, n=N_LIMB)
        bridge_ring(ua_hi, fa_hi, 'skin', rects, flip=(sign > 0))
        bridge_ring(fa_hi, fa_belly, 'skin', rects, flip=(sign > 0))
        bridge_ring(fa_belly, fa_lo, 'skin', rects, flip=(sign > 0))

        if sign > 0:
            wb_hi = ellipse_ring(sx, 0, z2 + 0.03, P['forearm_r1'] * 1.10, P['forearm_r1'] * 1.10, {fore_bone: 1.0}, n=N_LIMB)
            wb_lo = ellipse_ring(sx, 0, z2 + 0.015, P['forearm_r1'] * 1.12, P['forearm_r1'] * 1.12, {fore_bone: 1.0}, n=N_LIMB)
            bridge_ring(wb_hi, wb_lo, 'wristband', rects, flip=(sign > 0))

        # hand: v7 -- a critic pass called the fist "featureless pale
        # capsule blobs (no thumb, no finger break)". Enlarged
        # (hw/hd +30%, hand_len +12% via PROP), the taper eased so it stays
        # a chunky mitt instead of narrowing to a point, and a shadow-
        # coloured KNUCKLE GROOVE band added between the widest "back of
        # hand" ring and the finger mass below it -- exactly the "finger
        # break" the critic asked for, done as a value break rather than
        # extra geometry so it still reads at chase-cam distance.
        # v8: the whole hand/thumb switched from plain 'skin'/'skin_shadow'
        # to dedicated 'hand_skin'/'hand_skin_shadow' -- a more saturated,
        # warmer version of the same tone (see COLORS) -- because the
        # shipped hands read as grey metallic cylinders in game, not
        # skin-toned; the small hand volumes weren't holding onto enough
        # saturation under the game's own lighting, so this bakes extra
        # saturation in as insurance regardless of the exact cause.
        hw_, hd_, hh_ = 0.052, 0.045, P['hand_len']
        z3 = z2 - hh_
        hand_wrist = ellipse_ring(sx, 0, z2 - 0.008, hw_ * 0.86, hd_ * 0.90, {hand_bone: 1.0}, n=N_HAND)
        hand_knuckle = ellipse_ring(sx, 0.004, z2 - hh_ * 0.32, hw_, hd_, {hand_bone: 1.0}, n=N_HAND)
        hand_finger = ellipse_ring(sx, 0.010, z2 - hh_ * 0.68, hw_ * 0.90, hd_ * 0.94, {hand_bone: 1.0}, n=N_HAND)
        hand_bot = ellipse_ring(sx, 0.014, z3, hw_ * 0.62, hd_ * 0.64, {hand_bone: 1.0}, n=N_HAND)
        bridge_ring(fa_lo, hand_wrist, 'hand_skin', rects, flip=(sign > 0))
        bridge_ring(hand_wrist, hand_knuckle, 'hand_skin', rects, flip=(sign > 0))
        bridge_ring(hand_knuckle, hand_finger, 'hand_skin_shadow', rects, flip=(sign > 0))
        bridge_ring(hand_finger, hand_bot, 'hand_skin', rects, flip=(sign > 0))
        cap(hand_bot, 'hand_skin', rects, flip=(sign < 0))

        # thumb: bigger (base radius +40%, reach +33%) to match the bigger
        # hand -- 2-segment tapered stub (base -> mid -> rounded tip)
        # angled inward/forward off the hand's inner-top, at the knuckle
        # line so it reads as branching off the hand mass rather than
        # stuck onto the wrist.
        tcx = sx - sign * 0.044
        tcy = -0.030
        tcz = z2 - hh_ * 0.30
        w = {hand_bone: 1.0}
        n = Vector((-sign * 0.55, -0.65, -0.55)).normalized()
        tangent = Vector((0, 1, 0)) if abs(n.x) < 0.9 else Vector((1, 0, 0))
        bitan = n.cross(tangent).normalized()
        tangent = bitan.cross(n).normalized()
        s0 = 0.027
        base = Vector((tcx, tcy, tcz))
        def ring4(center, size):
            return [V(tuple(center + tangent * size + bitan * 0), w),
                    V(tuple(center - tangent * size * 0.4 + bitan * size * 0.9), w),
                    V(tuple(center - tangent * size + bitan * 0), w),
                    V(tuple(center - tangent * size * 0.4 - bitan * size * 0.9), w)]
        base_ring = ring4(base, s0)
        mid = base + n * 0.032
        mid_ring = ring4(mid, s0 * 0.8)
        tip = mid + n * 0.027
        v_tip = V(tuple(tip), w)
        bridge_ring(base_ring, mid_ring, 'hand_skin', rects)
        for i in range(4):
            a, b = mid_ring[i], mid_ring[(i + 1) % 4]
            tri(a, b, v_tip, 'hand_skin', rects)
        cap(base_ring, 'hand_skin', rects, flip=True)

    build_arm(1); build_arm(-1)

    # ---------------- legs
    def build_leg(sign):
        hx = sign * P['hip_half_w'] * P['leg_spacing_mult']
        up_bone = 'LeftUpLeg' if sign > 0 else 'RightUpLeg'
        leg_bone = 'LeftLeg' if sign > 0 else 'RightLeg'
        foot_bone = 'LeftFoot' if sign > 0 else 'RightFoot'
        toe_bone = 'LeftToeBase' if sign > 0 else 'RightToeBase'

        def leg_color(theta):
            # medial faces (the side facing the OTHER leg / centreline) get
            # a darker swatch -- a value break so both legs stay two
            # readable shapes instead of fusing into one dark mass.
            return 'jeans_shadow' if sign * math.cos(theta) < -0.25 else 'jeans'

        z0, z1 = P['hip_z'] - 0.03, P['knee_z']
        z_tmid = z0 - (z0 - z1) * 0.45
        r_tmid = lerp(P['thigh_r0'], P['thigh_r1'], 0.38) * 1.05
        th_hi = ellipse_ring(hx, 0, z0, P['thigh_r0'], P['thigh_r0'], {'Hips': 0.25, up_bone: 0.75}, n=N_LIMB)
        th_belly = ellipse_ring(hx, 0, z_tmid, r_tmid, r_tmid, {up_bone: 1.0}, n=N_LIMB)
        th_lo = ellipse_ring(hx, 0, z1 + 0.014, P['thigh_r1'], P['thigh_r1'], {up_bone: 0.7, leg_bone: 0.3}, n=N_LIMB)
        bridge_ring_colored(th_hi, th_belly, leg_color, rects, flip=(sign > 0), cx=hx, cy=0)
        bridge_ring_colored(th_belly, th_lo, leg_color, rects, flip=(sign > 0), cx=hx, cy=0)

        # v7 knee: thigh and shin used to meet at the exact same z with
        # barely different radii (0.052 -> 0.049) -- a near-seamless taper
        # that read as one straight tube with no joint. A small kneecap
        # bulge -- wider than either neighbour -- right at knee_z gives the
        # leg an actual joint to bend at, echoing the elbow/shoulder belly
        # treatment already used elsewhere on the limbs.
        knee_cap_ring = ellipse_ring(hx, 0.006, z1, P['thigh_r1'] * 1.12, P['thigh_r1'] * 1.12, {up_bone: 0.35, leg_bone: 0.65}, n=N_LIMB)
        bridge_ring_colored(th_lo, knee_cap_ring, leg_color, rects, flip=(sign > 0), cx=hx, cy=0)

        z2 = P['ankle_z']
        sh_hi = ellipse_ring(hx, 0, z1 - 0.014, P['shin_r0'], P['shin_r0'], {leg_bone: 1.0}, n=N_LIMB)
        bridge_ring_colored(knee_cap_ring, sh_hi, leg_color, rects, flip=(sign > 0), cx=hx, cy=0)
        cuff_z = z1 - (z1 - z2) * 0.68
        r_cuff = lerp(P['shin_r0'], P['shin_r1'], 0.68) * 1.12
        sh_mid = ellipse_ring(hx, 0, cuff_z, r_cuff, r_cuff, {leg_bone: 1.0}, n=N_LIMB)
        r_cuff_in = lerp(P['shin_r0'], P['shin_r1'], 0.70)
        sh_mid_in = ellipse_ring(hx, 0, cuff_z - 0.012, r_cuff_in, r_cuff_in, {leg_bone: 1.0}, n=N_LIMB)
        sh_lo = ellipse_ring(hx, 0, z2, P['shin_r1'], P['shin_r1'], {leg_bone: 1.0}, n=N_LIMB)
        bridge_ring_colored(sh_hi, sh_mid, leg_color, rects, flip=(sign > 0), cx=hx, cy=0)
        bridge_ring(sh_mid, sh_mid_in, 'jeans_cuff', rects, flip=(sign > 0))
        bridge_ring(sh_mid_in, sh_lo, 'skin', rects, flip=(sign > 0))

        # Shoe stack, TOP -> BOTTOM: collar -> white upper -> red trim ->
        # light midsole -> dark outsole bar. Octagonal horizontal cross-
        # section (chunky rounded sneaker, not a flat-sided slab).
        z_upper_bot = z2 - 0.05
        z_trim_bot = z_upper_bot - 0.014
        z_mid_bot = z_trim_bot - P['shoe_mid_h']
        z_sole_bot = z_mid_bot - P['shoe_sole_h']

        upper_bot = ellipse_ring(hx, -0.03, z_upper_bot, P['foot_half_w'] * 1.05, 0.115, {foot_bone: 1.0}, n=N_SHOE)
        bridge_ring(sh_lo, upper_bot, 'shoe_white', rects, flip=(sign > 0))

        trim_bot = ellipse_ring(hx, -0.03, z_trim_bot, P['foot_half_w'] * 1.08, 0.119, {foot_bone: 1.0}, n=N_SHOE)
        bridge_ring(upper_bot, trim_bot, 'shoe_red', rects, flip=(sign > 0))

        mid_bot = ellipse_ring(hx, -0.03, z_mid_bot, P['foot_half_w'] * 1.10, 0.122, {foot_bone: 1.0}, n=N_SHOE)
        bridge_ring(trim_bot, mid_bot, 'shoe_mid', rects, flip=(sign > 0))

        sole_bot = ellipse_ring(hx, -0.03, z_sole_bot, P['foot_half_w'] * 1.04, 0.116, {foot_bone: 1.0}, n=N_SHOE)
        bridge_ring(mid_bot, sole_bot, 'shoe_sole', rects, flip=(sign > 0))
        # v8: this bottom cap was a single flat 'shoe_sole' n-gon -- exactly
        # the "flat dark slab" the brief calls out. The trailing foot
        # presents this whole face to the rear-high camera for part of every
        # stride (dorsiflexed during recovery), so it's one of the largest
        # single faces the player ever sees. Split into a light midsole disc
        # (most of the area, front and back) with a distinct darker outsole
        # BAR crossing it side-to-side (the two wedges nearest the left/right
        # extremes, meeting at the centre hub) -- a light stripe AND a bar,
        # not a uniform dark oval.
        sole_center = V((hx, -0.03, z_sole_bot), {foot_bone: 1.0})
        n_sole = len(sole_bot)
        bar_half_x = P['foot_half_w'] * 1.04 * 0.55
        for i in range(n_sole):
            a, b = sole_bot[i], sole_bot[(i + 1) % n_sole]
            mx = (a.co.x + b.co.x) / 2.0
            ck = 'shoe_sole' if abs(mx - hx) > bar_half_x else 'shoe_mid'
            verts3 = (b, a, sole_center) if sign > 0 else (a, b, sole_center)
            f = bm.faces.new(verts3)
            uv = rects[ck]
            for loop in f.loops:
                loop[uv_layer].uv = uv

        # Toe box: rounder/blunter (a real sneaker toe, not a pointed taper)
        # and re-ordered so the toe TIP is the light midsole colour (another
        # dark-oval trap, same fix as the main sole) with a distinct dark
        # rubber toe-guard band just above it instead.
        toe_hi = ellipse_ring(hx, -0.10, z_upper_bot + 0.01, P['foot_half_w'] * 0.98, 0.055, {toe_bone: 1.0}, n=N_SHOE)
        toe_trim = ellipse_ring(hx, -0.155, z_trim_bot + 0.005, P['foot_half_w'] * 0.85, 0.050, {toe_bone: 1.0}, n=N_SHOE)
        toe_lo = ellipse_ring(hx, -0.175, z_mid_bot, P['foot_half_w'] * 0.72, 0.040, {toe_bone: 1.0}, n=N_SHOE)
        bridge_ring(upper_bot, toe_hi, 'shoe_white', rects, flip=(sign > 0))
        bridge_ring(toe_hi, toe_trim, 'shoe_white', rects, flip=(sign > 0))
        bridge_ring(toe_trim, toe_lo, 'shoe_sole', rects, flip=(sign > 0))   # dark rubber toe-guard bumper
        cap(toe_lo, 'shoe_mid', rects, flip=(sign < 0))                     # light toe tip, not another dark blob

    build_leg(1); build_leg(-1)

    # NOTE: no back accessory (bag/strap) -- the tricolour bands are the
    # mandatory back graphic and nothing may partially occlude them, even
    # from a dead-on rear angle. The wristband stays: wrist-only, never
    # over the torso.

    # ---------------- finalize mesh
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new('BerlinRunnerHeroMesh')
    bm.to_mesh(me)
    bm.free()

    mesh_obj = bpy.data.objects.new('BerlinRunnerHeroMesh', me)
    bpy.context.collection.objects.link(mesh_obj)

    bone_names = ['Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'Head', 'head_end',
                  'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand',
                  'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand',
                  'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase',
                  'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']
    vgs = {n: mesh_obj.vertex_groups.new(name=n) for n in bone_names}
    for i, w in enumerate(vert_weights):
        for bone, weight in w.items():
            if bone in vgs and weight > 0:
                vgs[bone].add([i], weight, 'REPLACE')

    # material
    mat = bpy.data.materials.new('HeroAtlasMat')
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = atlas_img
    tex.interpolation = 'Closest'
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if 'Roughness' in bsdf.inputs:
        bsdf.inputs['Roughness'].default_value = 0.85
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = 0.1
    me.materials.append(mat)

    return mesh_obj, rects, atlas_img

# ==========================================================================
# ARMATURE -- identical bone hierarchy/heads/tails to v2 (verified working
# rig contract: 23 bones, same names, same rest orientation). Only the mesh
# around it changed.
# ==========================================================================
def build_armature():
    P = PROP
    arm_data = bpy.data.armatures.new('BerlinRunnerHeroRigData')
    arm_obj = bpy.data.objects.new('BerlinRunnerHeroRig', arm_data)
    bpy.context.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm_data.edit_bones

    def mk(name, head, tail, parent=None):
        b = eb.new(name)
        b.head = head
        b.tail = tail
        if parent:
            b.parent = eb[parent]
        return b

    sx = P['shoulder_socket_x']
    hx = P['hip_half_w'] * P['leg_spacing_mult']

    mk('Hips', (0, 0, P['hip_z']), (0, 0, P['hips_tail_z']))
    mk('Spine', (0, 0, P['spine_z']), (0, 0, P['spine01_z']), 'Hips')
    mk('Spine01', (0, 0, P['spine01_z']), (0, 0, P['spine02_z']), 'Spine')
    mk('Spine02', (0, 0, P['spine02_z']), (0, 0, P['shoulder_line_z']), 'Spine01')
    mk('neck', (0, 0, P['neck_z']), (0, 0, P['neck_top_z']), 'Spine02')
    mk('Head', (0, 0, P['head_low_z']), (0, 0, P['head_top_z']), 'neck')
    mk('head_end', (0, 0, P['head_top_z']), (0, 0, P['head_end_z']), 'Head')

    mk('LeftShoulder', (sx, 0, P['shoulder_line_z'] + 0.01), (sx, 0, P['shoulder_line_z'] - 0.02), 'Spine02')
    mk('LeftArm', (sx, 0, P['shoulder_line_z'] - 0.02), (sx, 0, P['shoulder_line_z'] - 0.02 - P['upper_arm_len']), 'LeftShoulder')
    z1 = P['shoulder_line_z'] - 0.02 - P['upper_arm_len']
    mk('LeftForeArm', (sx, 0, z1), (sx, 0.01, z1 - P['forearm_len']), 'LeftArm')
    z2 = z1 - P['forearm_len']
    mk('LeftHand', (sx, 0.01, z2), (sx, -0.04, z2 - P['hand_len']), 'LeftForeArm')

    mk('RightShoulder', (-sx, 0, P['shoulder_line_z'] + 0.01), (-sx, 0, P['shoulder_line_z'] - 0.02), 'Spine02')
    mk('RightArm', (-sx, 0, P['shoulder_line_z'] - 0.02), (-sx, 0, z1), 'RightShoulder')
    mk('RightForeArm', (-sx, 0, z1), (-sx, 0.01, z2), 'RightArm')
    mk('RightHand', (-sx, 0.01, z2), (-sx, -0.04, z2 - P['hand_len']), 'RightForeArm')

    mk('LeftUpLeg', (hx, 0, P['hip_z'] - 0.03), (hx, 0, P['knee_z']), 'Hips')
    mk('LeftLeg', (hx, 0, P['knee_z']), (hx, 0, P['ankle_z']), 'LeftUpLeg')
    mk('LeftFoot', (hx, 0, P['ankle_z']), (hx, -0.16, P['toe_base_z']), 'LeftLeg')
    mk('LeftToeBase', (hx, -0.16, P['toe_base_z']), (hx, -0.24, P['toe_tip_z']), 'LeftFoot')

    mk('RightUpLeg', (-hx, 0, P['hip_z'] - 0.03), (-hx, 0, P['knee_z']), 'Hips')
    mk('RightLeg', (-hx, 0, P['knee_z']), (-hx, 0, P['ankle_z']), 'RightUpLeg')
    mk('RightFoot', (-hx, 0, P['ankle_z']), (-hx, -0.16, P['toe_base_z']), 'RightLeg')
    mk('RightToeBase', (-hx, -0.16, P['toe_base_z']), (-hx, -0.24, P['toe_tip_z']), 'RightFoot')

    bpy.ops.object.mode_set(mode='OBJECT')
    for b in arm_obj.pose.bones:
        b.rotation_mode = 'XYZ'
    return arm_obj

# ==========================================================================
# ANIMATION -- a full sprint cycle, baked frame-by-frame.
# Sign convention verified against the game's authored additive clips AND
# preserved exactly (both jump/land/slide's own hand-authored curves in
# berlin-runner.html and this baked "run" clip must agree on what each
# axis means, because the game blends them):
#   +x on Leg/ForeArm (shin/forearm)  = bend
#   -x on UpLeg/Arm (thigh/upper arm) = swing forward
#   +x on Spine chain                 = pitch forward
#   +y on Hips/Spine chain            = twist about vertical (world Z)
#
# Amplitude tuning note (v7 correction): earlier passes assumed
# berlin-runner.html's heroAmplify()/HERO_AMP list would stretch these
# curves' swing amplitude by up to +58% at full running speed, and baked
# amplitudes deliberately small to compensate. That assumption was WRONG --
# read directly from berlin-runner.html: buildHeroAmplifier() (which
# populates the bone list heroAmplify() walks) is only ever called when
# `!charAssetComplete`, i.e. only for the legacy procedural-fallback donor.
# isCompleteAuthoredHero() returns true for this asset (root object named
# `BerlinRunnerHero`), so heroAmplify() runs, finds its bone list still
# null, and returns immediately every frame -- ZERO amplification ever
# reaches this clip in game. heroScaleBones() (HERO_HAND_SCALE etc.) is
# gated the exact same way and also never fires here.
#
# Confirmed empirically, not just by reading the branch: re-importing our
# own exported GLB and sampling pose-bone rotation_quaternion across the
# baked action showed the swing WAS present in the file (this rules out an
# export bug), but sampling 8 real in-game frames across a stride via
# swap.mjs/stride.mjs showed the character's arms and legs barely moving
# frame to frame -- consistent with a modest baked swing (this file's old
# ~0.62 rad shoulder amplitude, tuned for a since-nonexistent +58% boost)
# simply not being large enough to read at normal chase-camera distance
# once nothing downstream is stretching it. Amplitudes below are baked
# large enough to look like a full sprint on their own.
# ==========================================================================
FPS = 30
CYCLE_FRAMES = 15   # 0.5s at 30fps

def clamp01(v): return max(0.0, min(1.0, v))

def leg_curve(p):
    """p in [0,1): 0 = contact, 0.5 = toe-off, 0.75 = peak recovery lift."""
    th = 2 * math.pi * p
    thigh = -0.92 * math.cos(th) + 0.14 * math.cos(2 * th) + 0.34
    swing_amt = clamp01(-math.sin(p * 2 * math.pi - 0.55))
    knee = 0.14 + 1.60 * (swing_amt ** 1.3)
    ankle = 0.30 * math.sin(th + 0.9) - 0.12
    toe = 0.42 * clamp01(math.sin(th + 0.4)) - 0.14 * clamp01(-math.sin(th - 2.4))
    return thigh, knee, ankle, toe

def arm_curve(p):
    """Same phase convention as the CONTRALATERAL leg (natural cross
    swing). Large swing (see module-level amplitude note above -- nothing
    downstream amplifies this clip, so it has to look right baked as-is)."""
    th = 2 * math.pi * p
    shoulder = 1.05 * math.cos(th) - 0.09 * math.cos(2 * th)
    elbow = 1.05 + 0.55 * math.cos(th + 0.35)
    adduct = 0.09 * clamp01(math.cos(th))
    return shoulder, elbow, adduct

def bake_run_cycle(arm_obj):
    bpy.context.view_layer.objects.active = arm_obj
    if arm_obj.animation_data:
        arm_obj.animation_data_clear()
    arm_obj.animation_data_create()
    action = bpy.data.actions.new('run')
    arm_obj.animation_data.action = action
    try:
        arm_obj.animation_data.action_slot = action.slots[0] if action.slots else None
    except Exception:
        pass

    pb = arm_obj.pose.bones
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = CYCLE_FRAMES
    bpy.context.scene.render.fps = FPS

    for i in range(CYCLE_FRAMES + 1):
        frame = i
        p = (i % CYCLE_FRAMES) / CYCLE_FRAMES
        bpy.context.scene.frame_set(frame)

        pR = p
        pL = (p + 0.5) % 1.0

        thighR, kneeR, ankleR, toeR = leg_curve(pR)
        thighL, kneeL, ankleL, toeL = leg_curve(pL)

        pb['RightUpLeg'].rotation_euler = (thighR, 0, 0.05)
        pb['LeftUpLeg'].rotation_euler = (thighL, 0, -0.05)
        pb['RightLeg'].rotation_euler = (kneeR, 0, 0)
        pb['LeftLeg'].rotation_euler = (kneeL, 0, 0)
        pb['RightFoot'].rotation_euler = (ankleR, 0, 0.045)
        pb['LeftFoot'].rotation_euler = (ankleL, 0, -0.045)
        pb['RightToeBase'].rotation_euler = (toeR, 0, 0)
        pb['LeftToeBase'].rotation_euler = (toeL, 0, 0)

        # arms: LEFT arm follows RIGHT leg's phase (contralateral swing).
        # Base lateral hold cut hard vs v2 (-0.18 -> -0.06 constant) so the
        # rest-of-cycle mean keeps the (now geometrically tucked-in) arm
        # close to the torso instead of held out.
        shL, elL, adL = arm_curve(pR)
        shR, elR, adR = arm_curve(pL)
        pb['LeftArm'].rotation_euler = (-shL, 0, -0.06 - adL)
        pb['RightArm'].rotation_euler = (-shR, 0, 0.06 + adR)
        pb['LeftForeArm'].rotation_euler = (elL, 0, 0)
        pb['RightForeArm'].rotation_euler = (elR, 0, 0)
        pb['LeftHand'].rotation_euler = (0.08, 0.02, 0.05)
        pb['RightHand'].rotation_euler = (0.08, -0.02, -0.05)

        pb['LeftShoulder'].rotation_euler = (shL * 0.14, 0, -0.03 - adL * 0.07)
        pb['RightShoulder'].rotation_euler = (shR * 0.14, 0, 0.03 + adR * 0.07)

        # hips: vertical bob at 2x stride frequency + forward pitch +
        # counter-twist about the vertical axis -- the biggest single
        # thing separating a good run from a marionette, and (see module
        # amplitude note above) nothing downstream amplifies Hips/Spine
        # rotation for this asset either, so these are baked at the full
        # size they need to read at, not a "boosted later" fraction of it.
        bob = -0.030 * math.cos(4 * math.pi * p) + 0.008
        twist = 0.22 * math.sin(2 * math.pi * p)
        pb['Hips'].location = (0, 0, bob)
        pb['Hips'].rotation_euler = (0.07, twist, 0.018 * math.sin(2 * math.pi * p))

        chest_twist = -0.17 * math.sin(2 * math.pi * p)
        pb['Spine'].rotation_euler = (0.09, chest_twist * 0.4, 0)
        pb['Spine01'].rotation_euler = (0.06, chest_twist * 0.7, 0)
        pb['Spine02'].rotation_euler = (0.035, chest_twist, 0)
        # Head stays comparatively STABLE while the chest bobs/twists under
        # it (real sprinters fix their gaze) -- counter-rotated against the
        # chest at a small fraction of chest_twist, same ratio as before.
        head_counter = -0.03 * math.sin(2 * math.pi * p)
        pb['Head'].rotation_euler = (0.0, head_counter, 0)
        pb['neck'].rotation_euler = (-0.02, 0, 0)

        for name in ['Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'Head',
                     'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg',
                     'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase',
                     'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm',
                     'LeftHand', 'RightHand', 'LeftShoulder', 'RightShoulder']:
            b = pb[name]
            b.keyframe_insert('rotation_euler', frame=frame)
            if name == 'Hips':
                b.keyframe_insert('location', frame=frame)

    action.use_cyclic = True if hasattr(action, 'use_cyclic') else None
    bpy.context.scene.frame_set(0)
    return action

# ==========================================================================
# PREVIEW SCENE (lights + camera) and render helper
# ==========================================================================
def setup_preview_scene():
    for o in list(bpy.data.objects):
        if o.type in ('LIGHT', 'CAMERA'):
            bpy.data.objects.remove(o, do_unlink=True)

    # Energies cut hard vs the first pass (400/140/220/260 -> 90/40/55/70):
    # at the old intensities every albedo (0.5-0.9 range) clipped to white
    # under 'Standard' view transform, erasing the hair-vs-skin value
    # separation this whole pass depends on being able to SEE in a render.
    key = bpy.data.lights.new('key', 'AREA'); key.energy = 90; key.size = 2
    key_o = bpy.data.objects.new('key', key); bpy.context.collection.objects.link(key_o)
    key_o.location = (1.2, -2.0, 2.4); key_o.rotation_euler = (math.radians(55), 0, math.radians(28))

    fill = bpy.data.lights.new('fill', 'AREA'); fill.energy = 40; fill.size = 3
    fill_o = bpy.data.objects.new('fill', fill); bpy.context.collection.objects.link(fill_o)
    fill_o.location = (-1.6, -1.0, 1.6); fill_o.rotation_euler = (math.radians(70), 0, math.radians(-40))

    rim = bpy.data.lights.new('rim', 'AREA'); rim.energy = 55; rim.size = 2
    rim_o = bpy.data.objects.new('rim', rim); bpy.context.collection.objects.link(rim_o)
    rim_o.location = (0.2, 1.8, 1.7); rim_o.rotation_euler = (math.radians(-60), 0, math.radians(10))

    # Straight-overhead light so the top-down silhouette test isn't lit
    # entirely from the side.
    top = bpy.data.lights.new('top', 'AREA'); top.energy = 70; top.size = 2.5
    top_o = bpy.data.objects.new('top', top); bpy.context.collection.objects.link(top_o)
    top_o.location = (0, 0, 3.2); top_o.rotation_euler = (0, 0, 0)

    cam_data = bpy.data.cameras.new('cam')
    cam_o = bpy.data.objects.new('cam', cam_data)
    bpy.context.collection.objects.link(cam_o)
    bpy.context.scene.camera = cam_o
    bpy.context.scene.render.resolution_x = 640
    bpy.context.scene.render.resolution_y = 900
    try:
        bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception:
        bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    bpy.context.scene.eevee.taa_render_samples = 32 if hasattr(bpy.context.scene, 'eevee') else None
    bpy.context.scene.view_settings.view_transform = 'Standard'
    return cam_o

def point_cam(cam_o, target, dist, height, azimuth_deg):
    az = math.radians(azimuth_deg)
    cam_o.location = (dist * math.sin(az), -dist * math.cos(az), height)
    direction = Vector(target) - cam_o.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam_o.rotation_euler = rot_quat.to_euler()

def point_cam_overhead(cam_o, target, height):
    cam_o.location = (target[0], target[1], height)
    direction = Vector(target) - cam_o.location
    rot_quat = direction.to_track_quat('-Z', 'Y')
    cam_o.rotation_euler = rot_quat.to_euler()

def render_to(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

# ==========================================================================
# MAIN
# ==========================================================================
def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.frame_set(0)

    mesh_obj, rects, atlas_img = build_mesh_and_rig()
    arm_obj = build_armature()

    root = bpy.data.objects.new('BerlinRunnerHero', None)
    bpy.context.collection.objects.link(root)
    root['artikelExpressHero'] = 'complete'
    arm_obj.parent = root
    mesh_obj.parent = arm_obj

    mod = mesh_obj.modifiers.new('Armature', 'ARMATURE')
    mod.object = arm_obj
    mesh_obj.parent_type = 'OBJECT'

    cam_o = setup_preview_scene()
    target = (0, 0, 0.82)

    renders = []
    # Rest-pose structural renders FIRST, before any animation is baked --
    # these judge the mesh/rig geometry itself (shoulder tuck, torso depth,
    # hair cap, leg separation) with zero pose confound. Frame 0 of a baked
    # action is NOT a neutral pose (it's p=0 of the run cycle, already
    # mid-swing) so this order matters.
    for name, az, dist, h in [
        ('rest-back', 180, 2.5, 0.90),
        ('rest-back_high', 180, 2.5, 1.55),   # rear, slightly above -- the real chase-cam angle
        ('rest-side', 90, 2.5, 0.90),
        ('rest-threeq', 135, 2.5, 0.90),
        ('rest-front', 0, 2.5, 0.90),
    ]:
        point_cam(cam_o, target, dist, h, az)
        p = os.path.join(SCRATCH, f'v3-{name}.png')
        render_to(p)
        renders.append(p)

    # straight-down overhead, rest pose -- the slide-camera silhouette test
    point_cam_overhead(cam_o, (0, 0, 0.9), 3.4)
    p = os.path.join(SCRATCH, 'v3-rest-overhead.png')
    render_to(p)
    renders.append(p)

    action = bake_run_cycle(arm_obj)

    # rear-high run cycle sequence -- the angle the player actually sees
    point_cam(cam_o, target, 2.5, 1.55, 180)
    for i, frac in enumerate([0.0, 0.15, 0.35, 0.5, 0.65, 0.85]):
        frame = frac * CYCLE_FRAMES
        bpy.context.scene.frame_set(int(frame), subframe=frame - int(frame))
        bpy.context.view_layer.update()
        p = os.path.join(SCRATCH, f'v3-run-{i}.png')
        render_to(p)
        renders.append(p)

    # overhead during a mid-stride running frame -- the hair-cap-from-
    # above test with the body actually in motion, not just standing
    frame = 0.35 * CYCLE_FRAMES
    bpy.context.scene.frame_set(int(frame), subframe=frame - int(frame))
    bpy.context.view_layer.update()
    point_cam_overhead(cam_o, (0, 0, 0.9), 3.4)
    p = os.path.join(SCRATCH, 'v3-run-overhead.png')
    render_to(p)
    renders.append(p)

    # blackout silhouette test, rear-high angle -- swap in a pure-black
    # material for one render so only the OUTLINE is judged (no colour to
    # lean on). Restored immediately after so the export keeps the real
    # atlas material.
    point_cam(cam_o, target, 2.5, 1.55, 180)
    real_mat = mesh_obj.data.materials[0]
    silhouette_mat = bpy.data.materials.new('SilhouetteMat')
    silhouette_mat.use_nodes = False
    silhouette_mat.diffuse_color = (0, 0, 0, 1)
    mesh_obj.data.materials[0] = silhouette_mat
    world = bpy.data.worlds.new('SilhouetteWorld')
    bpy.context.scene.world = world
    world.use_nodes = False
    world.color = (0.55, 0.7, 0.85)
    for o in bpy.data.objects:
        if o.type == 'LIGHT':
            o.hide_render = True
    try:
        bpy.context.scene.render.engine = 'BLENDER_WORKBENCH'
        shading = bpy.context.scene.display.shading
        shading.light = 'FLAT'
        shading.color_type = 'SINGLE'
        shading.single_color = (0, 0, 0)
        bpy.context.scene.display.render_aa = 'FXAA'
    except Exception:
        pass
    p = os.path.join(SCRATCH, 'v3-silhouette.png')
    render_to(p)
    renders.append(p)
    mesh_obj.data.materials[0] = real_mat
    for o in bpy.data.objects:
        if o.type == 'LIGHT':
            o.hide_render = False
    try:
        bpy.context.scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception:
        bpy.context.scene.render.engine = 'BLENDER_EEVEE'

    bpy.context.scene.frame_set(0)

    blend_path = os.path.splitext(OUT_GLB)[0] + '.blend'
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)

    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for c in root.children_recursive:
        c.select_set(True)

    export_kwargs = dict(
        filepath=OUT_GLB,
        export_format='GLB',
        use_selection=True,
        export_animations=True,
        export_animation_mode='ACTIONS',
        # export_apply=True ("Apply Modifiers") applies the Armature
        # modifier's CURRENT pose into the mesh at export time, which is
        # meaningless/wasteful for a skinned+animated export (glTF skinning
        # already carries the armature deform without it) and is the kind
        # of flag that has caused real animation-export breakage in other
        # Blender versions. Verified via re-import + reading pose bone
        # rotation_quaternion (NOT rotation_euler -- the glTF importer sets
        # pose bones to QUATERNION mode, so rotation_euler reads as a stale
        # (0,0,0) regardless of the actual baked motion) that rotation data
        # survives export either way on this Blender 5.2 export path; left
        # at False anyway since it is the correct/intended setting for a
        # skinned mesh and carries no known benefit here.
        export_apply=False,
        export_yup=True,
        export_extras=True,
        export_skins=True,
        export_cameras=False,
        export_lights=False,
        export_materials='EXPORT',
        export_image_format='AUTO',
    )
    try:
        bpy.ops.export_scene.gltf(**export_kwargs, export_optimize_animation_size=True)
    except TypeError:
        bpy.ops.export_scene.gltf(**export_kwargs)

    tri_count = sum(len(p.vertices) - 2 for p in mesh_obj.data.polygons)
    print('TRIANGLES', tri_count)
    print('VERTS', len(mesh_obj.data.vertices))
    print('RENDERS', renders)
    print('GLB', OUT_GLB)

main()
