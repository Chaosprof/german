"""
Berlin Runner hero v11 -- stylized Berlin courier, silhouette and motion pass.

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
looping sprint cycle named "run", and exports berlin-runner-hero-v11.glb.

Run headless:
  blender.exe -b --python tools/build_hero.py -- [--render-only] [--out PATH]

All tunable proportions live in PROP below so iteration doesn't require
re-deriving numbers by hand.
"""
import bpy, bmesh, math, os, sys, tempfile, mathutils
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

VERSION = 'v11'
REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if os.path.dirname(os.path.abspath(__file__)) not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hero_actions import bake_gameplay_actions, set_action_linear
SCRATCH = os.environ.get('HERO_SCRATCH') or os.path.join(
    tempfile.gettempdir(), 'berlin-runner-hero-v11')
os.makedirs(SCRATCH, exist_ok=True)
if OUT_GLB is None:
    OUT_GLB = os.path.join(REPO, 'assets', 'models', 'berlin-runner-hero-v11.glb')

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
    # v10: was 0.40 -- cap fabric only existed on the top 40% of the
    # skull's latitude. The chase camera sits BEHIND and only slightly
    # ABOVE the head, so it looks almost straight at the back/upper-back of
    # the skull, not down at the crown -- from that angle 0.40 put the cap
    # edge almost entirely out of view (h-0.png: a ~6px red sliver at the
    # very top). Pushed to 0.58 (past the equator, well down the back of
    # the skull) so the cap is the dominant thing the camera actually sees.
    # build_cap's dome-height math was rewritten to compute rise from a
    # fixed crown target rather than fixed absolute deltas, specifically so
    # this latitude could move a long way without flattening the dome or
    # leaving a gap at the crown -- see build_cap.
    # v14: was 0.58 -- nudged to 0.60 so the cap eats a little more of the
    # skull latitude, shrinking the exposed "second dome" area between
    # cap edge and hair that a critic pass read as a separate pale blob.
    # head_hair_fringe_v moves with it (see below) so the main-hair band
    # width stays roughly what it was, just shifted down slightly.
    head_cap_edge_v=0.50,
    # v8: repurposed. Used to mark a thin light-hair FRINGE right under the
    # cap edge (0.47); a critic pass on the shipped v7 head called the rest
    # of the visible skull -- everything from there down to the jaw, i.e.
    # most of what the rear camera actually sees below the cap -- a "large
    # blank pale egg", because that whole region was coloured 'scalp'
    # (0.72,0.60,0.44), a value only ~20% darker than skin and too close to
    # it to read as hair once the game's own lighting/tonemap touches it.
    # Now marks the split between the main HAIR mass (v0..this) and a
    # visibly darker NAPE band (this..v1, right above the collar) -- see
    # build_head. v10: with head_cap_edge_v now at 0.58, this only leaves a
    # 0.68-0.58=0.10 sliver of hair above the nape band, which is fine --
    # a snug cap deliberately shows just a fringe of hair, not a full mass.
    # v14: shifted with head_cap_edge_v (0.58->0.60) so the main hair band
    # (cap_edge..this) stays ~0.10 wide instead of collapsing to a sliver.
    head_hair_fringe_v=0.62,
    # --- lateral / depth ---
    hip_half_w=0.075,
    # v2 spaced the legs at 0.72x hip_half_w and built them as flat 4-sided
    # sticks in near-identical dark jeans colour -- from behind they fused
    # into one column. Wider spacing (0.85x) plus round tubes plus a medial
    # shadow face (added in build_leg) is the actual fix; the flat-stick
    # look was never really about the gap.
    # Centres now clear the thigh radii, preserving a real crotch/leg negative
    # space at rear gameplay scale instead of merging into one trouser column.
    leg_spacing_mult=1.18,
    # v15 (Task A -- "torso reads as a cone"): was 0.102, only 52% of
    # chest_half_w -- torso_extent() lerps this LINEARLY up to chest width
    # across the whole hip-to-shoulder span, which is exactly what a smooth
    # cone/dress taper is. Raised to 82% of chest width so the torso body
    # carries real mass down to the hip instead of pinching to a point;
    # see torso_extent()'s eased (not linear) interpolation below, which
    # keeps this width held almost all the way up to the chest and only
    # tapers in the last stretch near the hip/hem itself.
    # v18: -7.5% (0.160->0.148) on top of torso_extent's eased curve (see
    # below) -- after softening the curve alone, the rear-view read was
    # still closer to a slab than a taper because 0.160/0.196=0.82 is a
    # shallow ratio even spread evenly across the height. A narrower waist
    # endpoint gives the eased curve more contrast to work with without
    # reverting to a full linear cone (most of the torso's height still
    # sits close to chest width; only the lower stretch actually narrows).
    # v11: another small step down (0.148->0.142, 72% of chest) for more
    # shoulder-to-waist taper contrast -- a Subway-Surfers silhouette is an
    # explicit V, not a rectangle.
    waist_half_w=0.142,
    # v2's torso depth/width ratio was ~0.6-0.7 -- a shallow box that reads
    # as a plank at a grazing rear-3/4 angle. Deepened toward a real
    # barrel-chest ratio (~0.8-0.85) so the torso has volume from every
    # angle, not just dead-on.
    # v15: torso_half_d_waist raised in step with waist_half_w (0.088->0.115,
    # same ~90% of chest ratio) for the same reason -- a wide-but-flat hip
    # cross-section would still read as a slab from the side/3-4 angle.
    torso_half_d_waist=0.115, torso_half_d_chest=0.128,
    # v7: chest widened slightly (0.172->0.183) and the deltoid cap
    # enlarged separately in build_arm -- together these push shoulder
    # width from ~1.11x head-width to ~1.24x, closer to the measured
    # ~1.3x target, without touching shoulder_socket_x (the verified-in-
    # game arm bone position).
    # v10: measured directly off in-game crops (h-0.png) that the head
    # still reads as the dominant mass -- widened further (0.183->0.205)
    # and the deltoid cap enlarged again in build_arm. Chosen over shrinking
    # head_radius because chest_half_w/deltoid size don't touch head_top_z/
    # head_low_z or head_radius at all, so total figure height and the
    # already-hard-won head/cap/neck latitude chain (head_cap_edge_v,
    # head_jaw_cutoff_v, neck taper) stay completely unaffected -- this is
    # the lower-risk lever of the two the brief allows.
    # v10b: re-measured against the rebuilt in-game frame (v11-0.png) and
    # the first pass overshot -- shoulder dark-band width came out to
    # ~290px against a ~148px head (~1.95x), well past the spec's 1.2-1.5x
    # window. Pulled back to a midpoint between the pre-pass 0.183 and the
    # overshot 0.205.
    chest_half_w=0.196,
    # v13: pulled back down from 0.205 (-7%) -- the v10/v10b passes grew
    # this to fight a wide-head-vs-narrow-shoulders read, but a critic pass
    # on the shipped v9/v12 asset still called the head/hair mass
    # oversized and featureless. Now that build_cap/build_head give the
    # head real surface detail (dome + brim + hair volume) instead of a
    # blank sphere, a slightly smaller sphere should still read as "head",
    # so this is the lower-risk lever vs. touching chest_half_w again
    # (unchanged here) and re-litigating the shoulder ratio from scratch.
    # v11 (Subway-Surfers proportion pass): bigger head, mesh-only -- the Head
    # bone's head_low_z/head_top_z are rig contract and untouched; a larger
    # skull sphere around the same bone span reads as a chunkier cartoon head
    # without moving any joint.
    # v11r2 (round-2 Subway-Surfers pass): another ~1.15x on the skull
    # sphere, mesh-only -- the Head bone's head_low_z/head_top_z stay rig
    # contract. Same established pattern as the first head bump: the sphere
    # grows around the unchanged bone span, everything downstream
    # (build_cap's dome/brim, build_ear's band, the face features) derives
    # from head_r at build time and scales with it automatically.
    head_radius=0.234,
    # Hair is now a bulge sculpted INTO the head sphere (see build_head),
    # not a ring of separate spike meshes -- it is round from every angle,
    # including straight overhead where the slide camera looks.
    # v11: scaled up in step with the bigger skull so the hair mass keeps
    # its relative read.
    hair_bulge=0.094,
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
    # v17: hand_len +25% (0.096->0.120) -- see hw_/hd_ in build_arm, which
    # get the matching width increase. Arm/forearm lengths untouched.
    upper_arm_len=0.206, forearm_len=0.185, hand_len=0.120,
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
    # v10: still read as sticks against the widened head/shoulders in-game
    # (h-2.png silhouette test) -- another ~23-25% on top of the above.
    # v14: the swinging forearm (old r1=0.036) was thinner than neck_radius
    # (0.052) -- it read as a wire with a bead on the end while the legs
    # already carried proper mass. Raised so forearm_r1 (its THINNEST
    # point, at the wrist) meets/exceeds neck diameter; upper_arm follows
    # at a smaller ~20% bump to keep the taper direction sane. See
    # build_arm: the shoulder(deltoid)->upper-arm seam is now an explicit
    # bridge_ring (it used to be an unconnected near-coincident overlap
    # that only worked because the two radii were nearly equal -- with
    # upper_arm_r0 now noticeably bigger than the deltoid's own base
    # radius, that overlap trick would show a hole).
    # v17: thickened again and given more taper contrast -- v14 left
    # upper_arm_r0 (0.070) and forearm_r0 (0.058) close enough to the
    # deltoid base and to each other that the whole arm read as one
    # near-constant-radius rod with no visible elbow. Bumped the shoulder
    # end up, pulled the wrist end down, so the taper is doing real work:
    # thick at the shoulder, visibly narrower at the wrist -- which is also
    # what makes the hand (now deliberately wider than forearm_r1, see
    # build_arm's hw_) read as a flare instead of a continuation.
    upper_arm_r0=0.078, upper_arm_r1=0.060,
    forearm_r0=0.063, forearm_r1=0.049,
    # v11r2: thighs slimmed ~12% so the enlarged head/upper body reads as
    # carrying the mass -- the previous thigh read as thick as the torso.
    thigh_r0=0.070, thigh_r1=0.055,
    shin_r0=0.059, shin_r1=0.047,
    # Oversized trainers are part of the reference silhouette and they give
    # the stride its visual beat at the bottom of the dark leg column.
    # v17: +~20% across the board -- "shoes are small dark ovals" vs a
    # reference where the shoe is a big, obviously chunky trainer.
    # v11: widened again (+15% on foot_half_w) -- the Subway-Surfers trainer
    # is wider than the ankle it sits under, a visible ledge on BOTH sides
    # of the shin. Length/height unchanged so the sole still lands on z=0.
    foot_len=0.185, foot_half_w=0.086, foot_h=0.078,
    toe_len=0.082,
    # v11r2: midsole thickened to ~30% of the shoe's under-foot stack
    # (0.030 of 0.030+0.030+trim) so the trainer reads as a real chunky
    # foam midsole band, not a thin stripe.
    shoe_sole_h=0.030, shoe_mid_h=0.030,
)

# Cross-section vertex counts -- round tubes, not flat boxes. Bumped
# 10->12 (v7): a critic pass called the whole figure "visibly assembled
# from raw primitives... you can count the individual quad panels" on the
# head, torso and limbs alike. Kept as ONE shared value across torso/limb/
# shoe/hand/neck/head-skull/cap so every join in the figure (torso-to-neck,
# neck-to-skull, skull-to-cap, thigh-to-shin-to-shoe, arm-to-hand) stays a
# simple 1:1 ring bridge with no vertex-count reduction trick anywhere.
# v13 tessellation pass: the hero measured 1,850 tris/3,576 verts in-game
# against a 445k-624k tri/frame scene budget (0.3% of frame geometry) --
# the cap read as a faceted cone, the skull/limbs as countable facets.
# Cross-sections bumped 12->28 AND ring counts along each limb/torso/skull
# length raised separately below (see N_*_RINGS) -- raising only the
# cross-section leaves visible banding ALONG the limb, so both axes move
# together. IMPORTANT: despite the 4 separate names (kept for per-region
# readability/comments), these MUST stay numerically equal -- every one of
# torso-to-neck, neck-to-skull, skull-to-cap, thigh/shin-to-shoe and
# arm-to-hand is a plain 1:1 bridge_ring() zip between rings built with two
# different N_* constants, which throws IndexError the moment they differ
# (hit this directly rebuilding this pass: forearm at N_LIMB and hand at a
# different N_HAND blew up bridge_ring's zip). No vertex-count-reduction
# transition ring exists anywhere in this file to bridge a mismatch.
N_LIMB = 40
N_TORSO = 40
N_SHOE = 40
N_HAND = 40

# Longitudinal ring counts (segments along the length, i.e. how many
# bridge steps between anatomical keyframe rings) -- these are what stop
# a taper looking like N straight cone segments end-to-end.
# First pass at these (3/3/3/3/2/3/16/8) landed 7,542 tris -- structurally
# correct but timid against the 20k-40k budget (still only ~4x the
# original 1,850). Pushed hard a second time; there is plenty of headroom
# left even at these numbers (this is a single skinned mesh drawn once
# against a 445k-624k tri/frame scene).
# Second pass (7/6/7/7/5/8/26/14 @ N_LIMB=28) landed 14,374 tris -- better
# but still under the 20k floor. Pushed once more, plus N_LIMB/N_TORSO/
# N_SHOE/N_HAND 28->32.
N_TORSO_RINGS = 13   # per flag colour band (black/red/gold) -> 39 total
N_DELTOID_RINGS = 9  # per deltoid segment (cap->belly, belly->arm root)
N_UARM_RINGS = 11    # per upper-arm segment
N_FARM_RINGS = 11    # per forearm segment
N_HAND_RINGS = 9
N_THIGH_RINGS = 15   # per leg-chain segment (thigh/knee/shin all share this)
N_HEAD_RINGS = 48    # was 7 -- latitude bands on the skull
N_CAP_RINGS = 26      # rings from skull join to crown tip -- a real dome,
# not a 2-ring-plus-tip cone.

# ==========================================================================
# ATLAS  -- hand-painted-style colour swatches, one per costume region.
# v11: 512x512 -> 1024x1024 (8x8 grid of 128px cells). Each cell is still
# one costume colour at heart, but now carries baked painterly shading:
# a soft top-light/bottom-shadow gradient, darkened border AO, subtle
# deterministic fabric noise and a diagonal rim highlight -- so surfaces
# read as painted fabric instead of flat plastic once faces sample a
# small PATCH of their swatch (see uv_patch below) rather than a single
# point. Crisp garment band edges remain built into the MESH via separate
# ring loops / per-face colour keys, exactly as before; `rects` still
# stores each swatch's CENTRE, so nothing about the layout contract moves.
# ==========================================================================
# v11r3: 1024x1024 -> 2048x2048. The swatch count outgrew the old 8x8 grid
# of 128px cells (new 'bib_back'/'bib_gold_soft' cells pushed the key count
# past 64, which wrapped late swatches over row 0 and DESTROYED the face
# swatches). 16x16 = 256 cell capacity, same 128px cell size everywhere.
ATLAS_SIZE = 2048
CELL = 128
GRID = ATLAS_SIZE // CELL

# Half-extent (in atlas UV units) of the centred patch a face samples
# v11r3 BANDING FIX: this used to be 0.30 * CELL/ATLAS -- a patch spanning
# 60% of the swatch cell -- so EVERY face stretched the cell's entire baked
# vertical two-tone gradient (and the hoodie stitch rows at v=0.26/0.74)
# across its surface. Adjacent lathe rings then alternated light/dark: the
# corduroy/coiled-rope banding on every material. The patch is now a small
# centred window (~11px of a 128px cell, rows 58-69) that lands on a single,
# near-uniform tone: flat clean toon fills, while corner AO / rim / stitches
# stay painted in the cell but simply aren't sampled.
UV_PATCH = 0.055 * CELL / ATLAS_SIZE

COLORS = {
    # Value strategy vs. Berlin Runner's bright ochre road: a DARK anchor
    # mass (torso+legs) topped by a PALE head, built from the German
    # tricolour instead of a plain vest.
    'flag_black':   (0.070, 0.065, 0.063),
    # v11r3: dedicated anti-aliased bolt panel cell (painted over by the
    # _bib painter in build_atlas; base colour matches the black band it
    # sits on so any unsampled texel still blends).
    'bib_back':     (0.070, 0.065, 0.063),
    'flag_red':     (0.720, 0.110, 0.115),
    'flag_gold':    (0.960, 0.740, 0.090),
    # v19 hero-identity pass: a coherent hoodie replaces the three equally
    # loud flag-colour torso slabs. The German palette remains in the gold hem,
    # back monogram and cuff accents, but the body now reads as clothing first.
    'hoodie_red':    (0.900, 0.105, 0.085),
    'hoodie_shadow': (0.545, 0.045, 0.050),
    'strap_navy':    (0.055, 0.090, 0.190),
    'pouch_gold':    (0.940, 0.610, 0.075),
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
    # v14: hue shifted toward a richer, more saturated chestnut brown
    # (was a fairly desaturated tan, hue too close to the skin tone it
    # needs to separate from) and value nudged down only modestly --
    # r stays well above the 0.30 floor the file's own history proved
    # necessary (0.26 fused the head into flag_black's shoulder band at
    # r=0.070; 0.62 vanished into skin). This is a HUE change first,
    # value change second, per the critic-trap note above build_head.
    # v14b: hair_dark nudged down once more (0.26->0.235, still 3.6x
    # flag_black's 0.070 average -- comfortably above the 2.3x margin that
    # the file's own history recorded as the actual failure point) so the
    # nape shelf shows a clearer step from the main hair mass instead of a
    # single continuous gradient. Re-verified in-game (v14b-collar-zoom)
    # that this does NOT reproduce the fusion-with-flag_black failure.
    # v17 (hero-quality pass): the v14 chestnut brown (0.40/0.255/0.15,
    # luminance ~0.28) made the exposed hair mass -- which is MOST of what
    # the rear camera sees below the cap edge -- read as a dark, disconnected
    # "collar" sitting under a bright red dome, not one continuous bright
    # head. Reference (Jake) keeps the whole head, cap included, as the
    # single brightest mass in the figure. True light ash-blond (high value,
    # low-mid saturation, warm-yellow hue) instead of a mid-brown: hair
    # luminance goes from ~0.28 to ~0.68, closing most of the gap to
    # cap_red's own V=0.93 so cap+hair reads as one bright unit. hair_dark
    # (the nape shelf) follows the same hue, scaled down, and still sits
    # ~7x flag_black's average (0.070) -- far past the ~2.3x margin the
    # file's own history flagged as the actual fusion threshold, so this is
    # not at risk of repeating the v8 "hair fuses with the black band" bug.
    # v19b: brighter and warmer again. At true chase-cam framing the v17 blond
    # was reading grey-tan rather than as hair, because the cel quantiser plus
    # the hero fill floor both pull toward neutral. The reference head samples
    # (255,254,231) -- a warm near-white -- and is unambiguously the brightest
    # mass in the figure; this closes most of the remaining gap without going
    # fully white, which would lose the cap's own value step.
    # v20: caramel/chestnut, clearly separated from skin. The prior near-skin
    # blond made the rear head read as a bald beige sphere under a red helmet.
    # v11r4: hair darkened -- the old values blew out to beige under the key
    # lights and read as bald skin / a tan slab, not hair.
    'hair':         (0.400, 0.220, 0.085),
    'hair_dark':    (0.240, 0.115, 0.048),
    # Near-black jeans (0.085) sat directly under the tricolour's black
    # shoulder band, so torso and legs fused and the figure's lower two
    # thirds read as one undifferentiated dark column -- only the red and
    # gold bands broke it up at all. Real mid denim keeps the legs safely
    # darker than the bright ochre road (so the dark-anchor strategy still
    # holds) while separating them from the black band above.
    # v19: raised 0.235/0.265/0.355 -> 0.415/0.455/0.590. The "dark anchor"
    # note above was an inference, never a user decision, and measuring the
    # reference disproves it: sampled off a real Subway Surfers frame the
    # runner's legs read luminance 124 against a track at 103, i.e. ABOVE the
    # surface, while this hero's legs measured 55 against a lane at 93. The
    # legs were the last part of the figure still reading as a silhouette cut
    # out of the road. Blue against a warm ochre lane keeps them separate by
    # hue as well as value, so lifting them costs no readability.
    # v11r2: shifted from grey-blue toward indigo (#4A5FA8) -- the grey
    # denim read as faded workwear; indigo is the Subway-Surfers denim read.
    'jeans':        (0.290, 0.373, 0.659),
    # Medial-face shadow band on each leg -- a deliberate value break so the
    # two legs stay two separate readable shapes even when they swing close
    # together, instead of fusing into one dark mass at chase distance.
    'jeans_shadow': (0.250, 0.280, 0.380),
    'jeans_cuff':   (0.545, 0.590, 0.720),
    'shoe_white':   (0.950, 0.948, 0.930),
    'shoe_red':     (0.720, 0.110, 0.115),
    'shoe_mid':     (0.820, 0.815, 0.790),
    # v10: was (0.20,0.13,0.12) -- R notably higher than G/B reads as
    # maroon/burgundy against the road, not dark rubber, and combined with
    # the old fan-pattern sole cap (see build_leg) produced a maroon/white
    # checkerboard the brief flagged as a graphic error. Neutralized to a
    # true dark warm-grey/charcoal so a solid sole cap reads as rubber.
    # v14: was (0.095,0.085,0.085), nearly the same value as flag_black
    # (0.070,0.065,0.063) -- whenever the swing phase angles the sole
    # toward camera the lifted foot collapsed into the torso's own dark
    # value and read as a hole. Raised to a clear dark grey, still
    # unmistakably "rubber sole" (well below shoe_mid's 0.82) but now a
    # visibly separate mass from the black flag band.
    # v17: was (0.205,0.195,0.190), a dark charcoal -- realistic rubber, but
    # the reference's shoe sole is a PALE band that catches light and reads
    # as a strong terminator against the dark shoe upper/road, not another
    # dark mass at the bottom of an already dark-anchored figure. Brightened
    # to sit close to shoe_mid so the whole lower shoe (mid+sole, below the
    # red trim) reads as one bold pale block, per the brief's "large shoes
    # with a pale sole" note.
    # v19: 0.760 was near-white and, on a shoe deliberately enlarged ~20%,
    # the sole became the single brightest object in frame -- brighter than
    # cap_red's own V=0.93, which inverts the reference's cap > everything
    # hierarchy and pulls the eye to the feet. The reference sole is a
    # mid-light band that catches light, not a white plate. Pulled back to a
    # warm bone that still steps clearly off the dark upper and the road.
    'shoe_sole':    (0.430, 0.405, 0.370),
    'wristband':    (0.720, 0.110, 0.115),
    'eye':          (0.090, 0.080, 0.075),
    'eye_white':    (0.965, 0.950, 0.900),
    'eyebrow':      (0.220, 0.165, 0.095),
    'mouth':        (0.330, 0.085, 0.070),
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
    # v15 (Task B): the back graphic bib. A bold warm gold, but deliberately
    # LESS saturated and lower-value than cap_red (S=0.898, V=0.930) --
    # this is what actually enforces "cap must stay the brightest, most
    # saturated element" while still reading as a loud, deliberate accent
    # against flag_black (S=0.767, V=0.850 here).
    'bib_gold': (0.850, 0.660, 0.190),
    # 50/50 gold/navy blend -- anti-alias step on the supersampled bolt edges.
    'bib_gold_soft': (0.490, 0.430, 0.285),
    # v11r2: cheek blush tint for the painted face cell (see build_face_eye).
    'blush':        (0.870, 0.430, 0.380),
}

# v11r2: the old dot-matrix "B" read as a yellow RECTANGLE with holes from
# the chase camera (the letter's negative space never survived face
# resolution). Replaced with a bold single-shape LIGHTNING BOLT: one
# connected zigzag, every stroke two columns thick, so it reads instantly
# at torso-face resolution. Grid semantics:
#   '1' = bolt stroke  -> bib_gold (yellow)
#   '2' = bolt outline -> strap_navy (navy), auto-dilated around the stroke
#   '0' = shirt (untouched, stays flag_black)
BACK_BIB_BITMAP = [
    "0000110",
    "0001100",
    "0111100",
    "0011100",
    "0001100",
    "0011000",
    "0110000",
]

def bib_outline_grid(rows):
    """Dilate the '1' cells by one grid step; those neighbours that are not
    themselves stroke become '2' (navy outline) cells."""
    out = [list(r) for r in rows]
    h, w = len(rows), len(rows[0])
    for r in range(h):
        for c in range(w):
            if rows[r][c] == '1':
                continue
            near = any(rows[rr][cc] == '1'
                       for rr in (r - 1, r, r + 1)
                       for cc in (c - 1, c, c + 1)
                       if 0 <= rr < h and 0 <= cc < w)
            if near:
                out[r][c] = '2'
    return [''.join(r) for r in out]

BACK_BIB_BITMAP = bib_outline_grid(BACK_BIB_BITMAP)

# v11r3 anti-aliased bolt: bilinearly upsample the binary stroke mask 4x so
# glyph edges carry fractional coverage; bib_pixel() then picks gold, a
# 50/50 gold/navy blend swatch, or navy depending on that coverage -- smooth
# edges instead of per-face staircase aliasing.
BIB_SS = 4
def _bib_stroke_coverage(rows):
    import numpy as np
    m = np.array([[1.0 if ch == '1' else 0.0 for ch in r] for r in rows],
                 dtype=np.float32)
    def _up(a, f):
        h, w = a.shape
        ys = (np.arange(h * f) + 0.5) / f - 0.5
        xs = (np.arange(w * f) + 0.5) / f - 0.5
        y0 = np.clip(np.floor(ys).astype(int), 0, h - 1)
        x0 = np.clip(np.floor(xs).astype(int), 0, w - 1)
        y1 = np.clip(y0 + 1, 0, h - 1); x1 = np.clip(x0 + 1, 0, w - 1)
        fy = ys - np.floor(ys); fx = xs - np.floor(xs)
        return (a[np.ix_(y0, x0)] * (1 - fy)[:, None] * (1 - fx)[None, :] +
                a[np.ix_(y0, x1)] * (1 - fy)[:, None] * fx[None, :] +
                a[np.ix_(y1, x0)] * fy[:, None] * (1 - fx)[None, :] +
                a[np.ix_(y1, x1)] * fy[:, None] * fx[None, :])
    return _up(m, BIB_SS)
BIB_COV = _bib_stroke_coverage(BACK_BIB_BITMAP)

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

    # ---- v11 painterly pass: shade every swatch in place -----------------
    # Deterministic RNG so rebuilds are byte-identical (the game caches the
    # GLB; a texture that changed every build would churn diffs for nothing).
    rng = np.random.default_rng(20260213)
    # Fabric noise at two scales, blurred once so it reads as woven cloth
    # rather than TV static under the game's linear filtering.
    def _blur(a, times=1):
        for _ in range(times):
            p = np.pad(a, 1, mode='edge')
            a = (p[:-2, :-2] + p[:-2, 1:-1] + p[:-2, 2:] +
                 p[1:-1, :-2] + p[1:-1, 1:-1] + p[1:-1, 2:] +
                 p[2:, :-2] + p[2:, 1:-1] + p[2:, 2:]) / 9.0
        return a
    yy, xx = np.mgrid[0:CELL, 0:CELL].astype(np.float32)
    u = yy / (CELL - 1.0)
    vgrad = 1.030 - 0.060 * u                      # lit top, shadowed bottom
    edge = np.minimum.reduce([xx, yy, CELL - 1 - xx, CELL - 1 - yy]) / (CELL * 0.5)
    ao = 0.94 + 0.06 * np.clip(edge, 0.0, 1.0)     # soft AO in the corners
    d = (xx + yy) / (2.0 * (CELL - 1.0))
    rim = 1.0 + 0.03 * np.exp(-((d - 0.32) ** 2) / (2 * 0.06 ** 2))
    for i, name in enumerate(names):
        gx, gy = i % GRID, i // GRID
        x0, y0 = gx * CELL, gy * CELL
        cell = px[y0:y0 + CELL, x0:x0 + CELL, :3]
        # Very low frequency, very LOW amplitude -- v11r4: each face now
        # samples a DIFFERENT patch of this cell (per-face UV jitter), so the
        # noise contrast directly drives a per-face mosaic. Keep it a whisper:
        # heavily blurred, ~1% amplitude.
        # v11r5 NOISE CUT: residual per-face mottling read as dirty fabric.
        # Total variation now < +-1% (was ~+-1.5%), and the low-frequency
        # layer gets two extra blur passes so what remains is a broad wash,
        # not per-face tone steps. Zero banding preserved (patches are
        # near-uniform by design).
        n_lo = _blur(rng.random((CELL, CELL)), 10)
        n_hi = _blur(rng.random((CELL, CELL)), 7)
        noise = 1.0 + (n_lo - 0.5) * 0.011 + (n_hi - 0.5) * 0.006
        f = np.clip(vgrad * ao * rim * noise, 0.80, 1.15)[..., None]
        import os as _os
        if _os.environ.get('HERO_FLAT_ATLAS'):
            f = np.ones_like(f)   # v11r4 diagnostic: pure flat cells
        px[y0:y0 + CELL, x0:x0 + CELL, :3] = np.clip(cell * f, 0.0, 1.0)

    # ---- v11r2 painted detail pass ----------------------------------------
    # Per-swatch rim/shadow TONES (absolute RGB), plus authored micro-
    # details: stitch lines on the hoodie seams, scuff blotches on the
    # jeans, tread stripes on the sole swatch, a top highlight band + button
    # dot on the cap cell. Everything stays LOW-frequency/low-contrast: each
    # mesh face stretches a ~38px patch across its whole surface (see
    # PATCH_HALF above), so anything sharper than a soft wash turns into a
    # per-face checkerboard -- the exact failure the first noise pass had
    # to be walked back from.
    def _rect(name):
        i = names.index(name)
        gx, gy = i % GRID, i // GRID
        return gx * CELL, gy * CELL

    def _paint(name, fn):
        x0d, y0d = _rect(name)
        c = px[y0d:y0d + CELL, x0d:x0d + CELL, :3]
        px[y0d:y0d + CELL, x0d:x0d + CELL, :3] = np.clip(fn(c), 0.0, 1.0)

    # hi = lit rim tone, lo = core-shadow tone; blended by the same top-lit
    # vertical gradient the generic pass uses.
    PAINT_TONES = {
        'hoodie_red':    ((1.000, 0.353, 0.235), (0.620, 0.122, 0.071)),  # #FF5A3C / #9E1F12
        'hoodie_shadow': ((0.700, 0.100, 0.095), (0.400, 0.032, 0.038)),
        'jeans':         ((0.360, 0.470, 0.790), (0.170, 0.225, 0.460)),
        'jeans_shadow':  ((0.240, 0.310, 0.560), (0.110, 0.150, 0.330)),
        'cap_red':       ((0.980, 0.230, 0.200), (0.520, 0.062, 0.058)),
        'strap_navy':    ((0.130, 0.200, 0.380), (0.028, 0.048, 0.120)),
        'shoe_white':    ((0.980, 0.965, 0.930), (0.740, 0.720, 0.690)),
        'shoe_mid':      ((0.960, 0.930, 0.850), (0.740, 0.690, 0.600)),
        'bib_gold':      ((0.980, 0.800, 0.260), (0.640, 0.450, 0.110)),
    }
    mtone = np.clip(u, 0.0, 1.0) ** 1.1          # 0 bottom -> 1 top
    for tname, (hi, lo) in PAINT_TONES.items():
        hi_a, lo_a = np.asarray(hi, np.float32), np.asarray(lo, np.float32)
        _paint(tname, lambda c, hi_a=hi_a, lo_a=lo_a: hi_a * mtone[..., None] +
               lo_a * (1.0 - mtone[..., None]))

    # Stitch lines REMOVED (v11r4): with per-face UV jitter every face
    # samples a different patch, so painted LINE details can never align
    # with geometry -- they rendered as random dark flecks. Value interest
    # now comes only from broad, soft gradients.

    # Knee/scuff wear on both jeans swatches: soft dark blotches at very low
    # density AND very low strength (jitter turns any contrast into mosaic).
    def _scuffs(c):
        blotch = _blur(rng.random((CELL, CELL)), 4)
        mask = (blotch > np.quantile(blotch, 0.86)).astype(np.float32)
        mask = _blur(mask, 2) * 0.05
        return c * (1.0 - mask)[..., None]
    _paint('jeans', _scuffs)
    _paint('jeans_shadow', _scuffs)

    # Sole tread: subtle diagonal darker stripes.
    # Sole tread REMOVED (v11r4): line detail turns to flecks under per-face
    # UV jitter; a single flat sole colour is the reference look anyway.

    # Cap cell: bright TOP highlight band (reads as a satin sheen from above,
    # exactly where the slide/overhead cameras look) + a small darker button
    # dot at the crown centre. v11r4: the "panel seams" are BROAD soft
    # vertical shading bands (sigma ~0.06 of the cell), not lines -- under
    # per-face jitter only broad gradients survive as coherent paint.
    band = np.exp(-((u - 0.18) ** 2) / (2 * 0.07 ** 2)) * 0.14
    dotm = (((xx - CELL * 0.5) ** 2 + (yy - CELL * 0.28) ** 2) < (CELL * 0.055) ** 2)
    cap_seams = (np.exp(-((xx - CELL * 0.50) ** 2) / (2 * (CELL * 0.09) ** 2)) * 0.10 +
                 np.exp(-((xx - CELL * 0.20) ** 2) / (2 * (CELL * 0.07) ** 2)) * 0.05 +
                 np.exp(-((xx - CELL * 0.80) ** 2) / (2 * (CELL * 0.07) ** 2)) * 0.05)
    def _cap(c):
        c = c * (1.0 + band)[..., None]
        c = c * (1.0 - cap_seams)[..., None]
        c[dotm] *= np.asarray((0.55, 0.42, 0.42), np.float32)
        return c
    _paint('cap_red', _cap)
    # v11r4: strap cell gets a broad horizontal sheen band instead of stitch
    # rows -- visible paint interest on the cap's back strap area.
    strap_band = np.exp(-((u - 0.5) ** 2) / (2 * 0.16 ** 2)) * 0.12
    _paint('cap_strap', lambda c: c * (1.0 + strap_band)[..., None])

    # v11r3: dedicated ANTI-ALIASED bib panel cell. The whole back panel is
    # UV-mapped continuously into this one cell (mesh-side remap below), so
    # the bolt is a real 128px painted glyph with smooth edges instead of
    # per-face colour blocks.
    def _bib_resize(a):
        h, w = a.shape
        ys = (np.arange(CELL) + 0.5) / CELL * h - 0.5
        xs = (np.arange(CELL) + 0.5) / CELL * w - 0.5
        y0 = np.clip(np.floor(ys).astype(int), 0, h - 1)
        x0 = np.clip(np.floor(xs).astype(int), 0, w - 1)
        y1 = np.clip(y0 + 1, 0, h - 1); x1 = np.clip(x0 + 1, 0, w - 1)
        fy = ys - np.floor(ys); fx = xs - np.floor(xs)
        return (a[np.ix_(y0, x0)] * (1 - fy)[:, None] * (1 - fx)[None, :] +
                a[np.ix_(y0, x1)] * (1 - fy)[:, None] * fx[None, :] +
                a[np.ix_(y1, x0)] * fy[:, None] * (1 - fx)[None, :] +
                a[np.ix_(y1, x1)] * fy[:, None] * fx[None, :])
    def _bib(c):
        cov = _bib_resize(BIB_COV)
        od = cov.copy()
        for dy in (-3, -2, -1, 0, 1, 2, 3):
            for dx in (-3, -2, -1, 0, 1, 2, 3):
                od = np.maximum(od, np.roll(np.roll(cov, dy, 0), dx, 1))
        gold = np.asarray(COLORS['bib_gold'], np.float32)
        navy = np.asarray(COLORS['strap_navy'], np.float32)
        # v11r4: background is a verbatim COPY of the already-painted
        # 'hoodie_red' cell (tone gradient + stitches), NOT flat black. The
        # panel sits on the red hoodie band now (the old black torso band is
        # gone), so a black cell background rendered as a hard dark rectangle
        # against the hoodie. Sampling the same painted red means the panel
        # boundary disappears and only the bolt reads.
        # v11r5 TONE-MATCH FIX: the old background was a verbatim copy of
        # the WHOLE hoodie_red cell -- but hoodie faces never see the whole
        # cell; uv_patch() samples only a small CENTRED window (rows ~58-69),
        # so the surrounding fabric reads as that patch's mid tone. Copying
        # the full cell baked the corner-AO darkening + gradient extremes
        # into the panel edges -> the panel rendered as a darker orange
        # rectangle sticker. Fix: flat-fill the panel background with the
        # EXACT mean texel value of the patch hoodie faces actually sample,
        # making panel and hoodie pixel-identical by construction.
        hx0, hy0 = _rect('hoodie_red')
        pr = int(round(UV_PATCH * ATLAS_SIZE))
        pcx, pcy = hx0 + CELL // 2, hy0 + CELL // 2
        patch = px[pcy - pr:pcy + pr + 1, pcx - pr:pcx + pr + 1, :3]
        bg_tone = patch.reshape(-1, 3).mean(axis=0)
        out = np.broadcast_to(bg_tone, c.shape).copy()
        m_edge = (cov > 0.28) & (cov <= 0.62)
        out[m_edge] = 0.5 * (gold + navy)
        out[cov > 0.62] = gold
        out[(cov <= 0.28) & (od > 0.30)] = navy
        c[:] = out
        bg_sel = c[(cov <= 0.28) & (od <= 0.30)].reshape(-1, 3).mean(axis=0)
        print('[atlas] bib_back panel-bg RGB = (%.4f, %.4f, %.4f)' % tuple(bg_sel))
        print('[atlas] hoodie_red sampled-patch RGB = (%.4f, %.4f, %.4f)' % tuple(bg_tone))
        return c
    _paint('bib_back', _bib)

    px = px[::-1, :, :]
    for name in rects:
        cx, cy = rects[name]
        rects[name] = (cx, 1.0 - cy)
    img.pixels = px.ravel().tolist()
    img.pack()
    # v11r3 debug: dump the painted atlas so texture-side defects can be
    # inspected directly without opening Blender.
    dbg = os.path.join(SCRATCH, 'atlas_debug.png')
    img.filepath_raw = dbg
    img.file_format = 'PNG'
    img.save()
    return img, rects

# ==========================================================================
# MESH BUILD HELPERS
# ==========================================================================
bm = bmesh.new()
uv_layer = bm.loops.layers.uv.new('UVMap')
vert_weights = []   # parallel list, index-matched to bm.verts creation order
face_color = {}     # BMFace -> color_key, used by finalize_shading() below

def V(co, weights):
    v = bm.verts.new(co)
    vert_weights.append(dict(weights))
    return v

def _hash01(a, b):
    s = math.sin(a * 12.9898 + b * 78.233) * 43758.5453
    return s - math.floor(s)

def uv_patch(rect, ox=0.5, oy=0.5):
    """v11: the four corners of a small centred patch inside a swatch cell.
    Faces used to collapse all loops onto the swatch's centre point (pure
    flat colour); sampling a patch instead lets each face carry the baked
    painterly shading (gradient/AO/noise/rim) painted into the atlas.
    v11r4: ox/oy in [0,1] re-centre the patch PER FACE -- every face used to
    sample the IDENTICAL patch, so the cell's noise pattern tiled once per
    face and read as faint diamond/horizontal striping on jeans and cuffs."""
    cx, cy = rect
    s = UV_PATCH
    # v11r4: jitter radius kept SMALL (~+-5 texels). Full-cell jitter let each
    # face sample wildly different heights of the painted tone gradients
    # (PAINT_TONES spans ~60% brightness) and read as a per-face mosaic;
    # +-5 texels still breaks up identical-patch tiling but varies tone by
    # only ~+-4%.
    rng = 10.0 / ATLAS_SIZE
    cx += (ox - 0.5) * 2.0 * rng
    cy += (oy - 0.5) * 2.0 * rng
    return (cx - s, cy - s), (cx + s, cy - s), (cx + s, cy + s), (cx - s, cy + s)

def _face_jitter(verts):
    mx = sum(v.co.x for v in verts) / len(verts)
    my = sum(v.co.y for v in verts) / len(verts)
    mz = sum(v.co.z for v in verts) / len(verts)
    return (_hash01(mx * 913.7, mz * 541.1), _hash01(my * 761.3, mz * 337.9))

def quad(a, b, c, d, color_key, rects):
    f = bm.faces.new((a, b, c, d))
    p = uv_patch(rects[color_key], *_face_jitter((a, b, c, d)))
    for loop, uv in zip(f.loops, p):
        loop[uv_layer].uv = uv
    face_color[f] = color_key
    return f

def tri(a, b, c, color_key, rects):
    f = bm.faces.new((a, b, c))
    p = uv_patch(rects[color_key], *_face_jitter((a, b, c)))
    for loop, uv in zip(f.loops, p):
        loop[uv_layer].uv = uv
    face_color[f] = color_key
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

def lerp_weights(wa, wb, t):
    """Blend two bone-weight dicts by t -- generic across whatever bone
    names appear in either, so it works for any keyframe-ring pair without
    needing to know the anatomy (shoulder blend, elbow blend, knee blend,
    ...) in advance."""
    bones = set(wa) | set(wb)
    out = {}
    for b in bones:
        w = lerp(wa.get(b, 0.0), wb.get(b, 0.0), t)
        if w > 1e-6:
            out[b] = w
    return out

def bridge_ring_subdivided(ring_lo, ring_hi, color_fn, rects, nx=3, ny=3):
    """v11r3: like bridge_ring_colored but each segment quad is split into
    an nx*ny grid of sub-quads, each coloured by color_fn(z_mid, theta) at
    its OWN centre. This supersamples per-face painted details (the bib
    lightning bolt) 3x3x beyond the torso's face resolution, killing the
    staircase aliasing on the glyph edges without a full torso retopo."""
    bm.verts.ensure_lookup_table()
    n = len(ring_lo)
    for i in range(n):
        a0, a1 = ring_lo[i], ring_lo[(i + 1) % n]
        b0, b1 = ring_hi[i], ring_hi[(i + 1) % n]
        wa0, wa1 = vert_weights[a0.index], vert_weights[a1.index]
        wb0, wb1 = vert_weights[b0.index], vert_weights[b1.index]
        grid = []
        for j in range(ny + 1):
            t = j / ny
            row = []
            for k in range(nx + 1):
                s = k / nx
                pa = a0.co.lerp(a1.co, s)
                pb = b0.co.lerp(b1.co, s)
                co = pa.lerp(pb, t)
                row.append(V(tuple(co),
                             lerp_weights(lerp_weights(wa0, wa1, s),
                                          lerp_weights(wb0, wb1, s), t)))
            grid.append(row)
        for j in range(ny):
            for k in range(nx):
                q = (grid[j][k], grid[j][k + 1], grid[j + 1][k + 1], grid[j + 1][k])
                cx = sum(v.co.x for v in q) * 0.25
                cy = sum(v.co.y for v in q) * 0.25
                czm = sum(v.co.z for v in q) * 0.25
                ck = color_fn(czm, math.atan2(cy, cx))
                quad(q[0], q[1], q[2], q[3], ck, rects)


def circ_chain(cx, cy_list, z_list, r_list, w_list, n, phase=0.0, rings_per_seg=3, bellies=None):
    """A round (circular cross-section) tube through K keyframe rings,
    with `rings_per_seg` sub-rings smoothly interpolated (z, radius, cy,
    AND bone weights all lerped together) between each consecutive pair --
    this is what turns a 2-3-ring cone-taper limb into a genuinely curved
    one without hand-authoring every intermediate ring. The exact keyframe
    z/r/cy/weights are preserved at every seam, so joints (shoulder/elbow/
    knee/ankle) land exactly where the original hand-tuned anatomy put
    them; only the SPAN between them gains resolution.
    cy_list may be a scalar (constant cy) or a per-keyframe list.
    bellies: optional list (len K-1) of extra radius fraction added as a
    sin-hump peaking at the segment midpoint (for segments that want a
    muscle/joint bulge that isn't already an explicit keyframe value).
    """
    K = len(z_list)
    cy_list = cy_list if isinstance(cy_list, (list, tuple)) else [cy_list] * K
    rings = [ellipse_ring(cx, cy_list[0], z_list[0], r_list[0], r_list[0], w_list[0], n=n, phase=phase)]
    for si in range(K - 1):
        z0, z1 = z_list[si], z_list[si + 1]
        r0, r1 = r_list[si], r_list[si + 1]
        cy0, cy1 = cy_list[si], cy_list[si + 1]
        w0, w1 = w_list[si], w_list[si + 1]
        belly = bellies[si] if bellies else 0.0
        for i in range(1, rings_per_seg + 1):
            t = i / rings_per_seg
            z = lerp(z0, z1, t)
            r = lerp(r0, r1, t)
            if belly:
                r *= 1.0 + belly * math.sin(math.pi * t)
            cy = lerp(cy0, cy1, t)
            w = lerp_weights(w0, w1, t)
            rings.append(ellipse_ring(cx, cy, z, r, r, w, n=n, phase=phase))
    return rings

def bridge_chain(rings, colors, rects, flip=False, rings_per_seg=1):
    """Bridge every consecutive ring pair in a circ_chain() result.
    `colors` has one entry per ORIGINAL keyframe segment (len == (len(rings)-1)//rings_per_seg);
    every sub-ring bridge within that segment gets that segment's colour,
    so colour boundaries stay exactly where they were authored while the
    geometry inside each band gains resolution."""
    seg = 0
    for i in range(len(rings) - 1):
        if i > 0 and i % rings_per_seg == 0:
            seg += 1
        bridge_ring(rings[i], rings[i + 1], colors[seg], rects, flip=flip)

def bridge_chain_colored(rings, color_fn, rects, flip=False, cx=0.0, cy=0.0):
    """Like bridge_chain, but every sub-bridge uses the same theta-based
    color_fn (e.g. the leg's medial-shadow rule) instead of a fixed
    per-segment colour list."""
    for i in range(len(rings) - 1):
        bridge_ring_colored(rings[i], rings[i + 1], color_fn, rects, flip=flip, cx=cx, cy=cy)

def cap(ring, color_key, rects, flip=False):
    verts = list(reversed(ring)) if flip else ring
    p = uv_patch(rects[color_key], *_face_jitter(verts))
    if len(verts) == 4:
        quad(verts[0], verts[1], verts[2], verts[3], color_key, rects)
    else:
        f = bm.faces.new(verts)
        # v11r4: assign a UV to EVERY loop -- the old range(len(p)) stopped
        # after the first 4 loops, leaving all remaining loops of n-gon caps
        # at default UV (0,0); the rasterizer then interpolated across the
        # whole atlas and rendered caps as washed-out white discs.
        for loop, i in zip(f.loops, range(len(verts))):
            loop[uv_layer].uv = p[i % 4]

def lerp(a, b, t): return a + (b - a) * t

# ==========================================================================
# SMOOTH SHADING (Task A / v14) -- the mesh was 24,246 tris but 41,517
# EXPORTED verts (confirmed: Blender's own raw bmesh only has 12,233 verts
# pre-export -- the 3.4x blowup happens entirely inside glTF export because
# every face was FLAT shaded, which forces the exporter to give each face
# its own copy of every vertex so it can carry that face's own normal).
# Fix: shade every face SMOOTH, then explicitly mark exactly the edges that
# must stay a hard break -- (a) genuine shape creases, detected generically
# by the dihedral angle between the two faces sharing an edge, and (b)
# every edge where the two faces sample a DIFFERENT atlas swatch (colour-
# region boundaries: flag bands, cap skirt/dome, shoe stack, jeans medial
# shadow, ...), regardless of angle, so a colour step never gets a
# soft/blurred lighting gradient smeared across it. Only edges that are
# BOTH low-angle AND same-colour end up smooth -- which is the vast
# majority of edges in a dense round tube, so the exported vertex count
# collapses back toward the raw ~12k topology instead of ~3.4x that.
def finalize_shading(bm, rects, angle_deg=78.0):
    thresh = math.radians(angle_deg)
    bm.normal_update()
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        linked = e.link_faces
        if len(linked) != 2:
            # mesh boundary / non-manifold edge (e.g. an open ring seam) --
            # nothing to smooth ACROSS here since only one face touches it.
            e.smooth = True
            continue
        fa, fb = linked
        ca = face_color.get(fa)
        cb = face_color.get(fb)
        if ca != cb:
            e.smooth = False
            continue
        na, nb = fa.normal, fb.normal
        if na.length < 1e-9 or nb.length < 1e-9:
            e.smooth = True
            continue
        ang = na.angle(nb, 0.0)
        e.smooth = ang <= thresh

# ==========================================================================
# BUILD
# ==========================================================================
def build_mesh_and_rig():
    atlas_img, rects = build_atlas()
    P = PROP
    torso_phase = flat_fb_phase(N_TORSO)

    # ---------------- torso: 4 rings -> 3 flag segments, 8-gon cross-
    # section with a flat front AND flat back edge (torso_phase) so the
    # back panel stays one crisp flat plane, sides now rounded instead of
    # boxy. v19 makes this read as one garment: a red hoodie body (~68%), a
    # narrow shadowed waistband (~22%) and a gold Berlin accent hem (~10%).
    # The previous 55% black block was the reason the entire torso looked like
    # a square backpack with a logo tile at actual chase-camera size.
    z_hip = P['hip_z']
    z_black_top = P['shoulder_line_z']
    total_h = z_black_top - z_hip
    z_gold_top = z_hip + 0.10 * total_h
    z_red_top = z_gold_top + 0.22 * total_h

    def torso_extent(z):
        # v15 (Task A): was a straight linear lerp of hw/hd across the WHOLE
        # hip-to-shoulder span -- a torso that tapers continuously and
        # monotonically from wide shoulders to a narrow hip is, by
        # definition, a cone/dress silhouette, regardless of how wide the
        # two endpoints are individually. Switched to an eased curve
        # (t**0.45) that reaches most of the way to chest width very
        # quickly moving up from the hip, then holds close to that width
        # for the rest of the torso's height -- combined with
        # waist_half_w/torso_half_d_waist now sitting at ~80-90% of the
        # chest values (was ~52-69%), this makes the torso read as a boxy
        # mass that keeps its width from chest down to hip, with only a
        # short flare right at the very bottom edge (see hem flare/pelvis
        # step below), not a taper spread across the whole torso.
        t = clamp01((z - z_hip) / (z_black_top - z_hip))
        # v17: was 0.45 -- that exponent reaches ~73% of the way from waist
        # to chest width by just 10% of the way up from the hip, so the
        # torso held within a few % of full chest width for nearly its
        # whole height and only tapered in a short snap right at the hem.
        # In game that read as a flat slab with the taper hidden down at
        # the hem, which is the NEW complaint replacing the old "cone/dress"
        # one 0.45 was chosen to fix. 0.68 spreads the taper across the
        # whole hip-to-shoulder span instead of hiding it at either end --
        # at t=0.5 this is ~62% of the way to chest width (vs ~78% at 0.45,
        # ~50% at a straight linear 1.0), a visible shoulder-to-waist taper
        # without reverting all the way to the old cone.
        ease = t ** 0.68
        hw = lerp(P['waist_half_w'], P['chest_half_w'], ease)
        hd = lerp(P['torso_half_d_waist'], P['torso_half_d_chest'], ease)
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

    # v13: was 4 flat rings (1 per band boundary) -- a torso this tall
    # spanning that few rings shows a visible facet at every band seam.
    # torso_extent()/torso_weights() are already smooth functions of z, so
    # subdividing is just sampling them more densely; N_TORSO_RINGS extra
    # rings per band, exact colours/boundaries unchanged.
    ring_zs = [z_hip, z_gold_top, z_red_top, z_black_top]
    seg_colors = ['flag_gold', 'hoodie_shadow', 'hoodie_red']
    hw0i, hd0i = torso_extent(ring_zs[0])
    torso_rings = [ellipse_ring(0, 0, ring_zs[0], hw0i, hd0i, torso_weights(ring_zs[0]), n=N_TORSO, phase=torso_phase)]
    torso_ring_zs = [ring_zs[0]]
    for si in range(3):
        z0, z1 = ring_zs[si], ring_zs[si + 1]
        for i in range(1, N_TORSO_RINGS + 1):
            t = i / N_TORSO_RINGS
            z = lerp(z0, z1, t)
            hw, hd = torso_extent(z)
            torso_rings.append(ellipse_ring(0, 0, z, hw, hd, torso_weights(z), n=N_TORSO, phase=torso_phase))
            torso_ring_zs.append(z)

    # ---------------- Task B: back graphic. A compact blocky "B" (Berliner)
    # mark plus an asymmetric courier strap, built entirely from per-face
    # colour selection on the torso's own back-facing rings -- the atlas
    # only gives faces one flat colour each (see build_atlas/quad), so a
    # "graphic" here is a shaped region of faces in a contrasting colour,
    # keyed off each face's (z, theta) like the leg's medial-shadow trick
    # already does. Placed on the black band (tallest, most stable single-
    # colour field, and the band the rear-3/4 chase cam sees dead centre).
    # bib_gold is deliberately LESS saturated/bright than cap_red (see
    # COLORS) so the cap stays the brightest, most saturated element.
    bib_z1 = z_black_top - 0.24 * (z_black_top - z_red_top)
    bib_z0 = z_red_top + 0.28 * (z_black_top - z_red_top)
    BIB_ROWS = len(BACK_BIB_BITMAP)
    BIB_COLS = len(BACK_BIB_BITMAP[0])
    BIB_THETA_CENTER = math.pi / 2   # dead behind, +Y
    # v19: compact enough to be a garment mark rather than a backpack panel;
    # still spans about five of the torso's 32 faces so the glyph survives.
    BIB_THETA_HALF = 0.55

    def bib_pixel(z, theta, base_color):
        if not (bib_z0 <= z <= bib_z1):
            return base_color
        dt = theta - BIB_THETA_CENTER
        if abs(dt) > BIB_THETA_HALF:
            return base_color
        row = int((bib_z1 - z) / (bib_z1 - bib_z0) * BIB_ROWS)
        row = min(BIB_ROWS - 1, max(0, row))
        col = int((dt + BIB_THETA_HALF) / (2 * BIB_THETA_HALF) * BIB_COLS)
        col = min(BIB_COLS - 1, max(0, col))
        # v16: this used to be inverted -- the letter's STROKES were left at
        # the base band colour and the surrounding bib rectangle was painted
        # gold, on the theory that the letter would read as a dark silhouette
        # cut out of a gold field. It does not, and the reason is that the
        # band the bib sits on IS flag_black: the strokes came out the same
        # colour as the shirt all around the bib, so the glyph had no edge of
        # its own and the eye only saw the leftover gold fragments between
        # the strokes. In-game that read as two blocks and a bracket, never
        # as a "B" (r4-0.png, r6-0.png).
        # Painting the strokes gold directly onto the black shirt is both
        # more legible and simpler: the letter now owns its own contrast and
        # there is no background rectangle whose edges have to survive the
        # torso's face resolution at all.
        # v16: strokes painted directly onto the black shirt (gold owns its
        # own contrast). v11r2: '2' cells are the auto-dilated navy outline,
        # so the bolt gets a hard graphic edge even where it crosses the
        # strap or band seams.
        # v11r3: supersampled stroke coverage (bilinear 4x) drives a 3-level
        # AA step: full gold inside the stroke, 'bib_gold_soft' on the edge,
        # navy outline / base elsewhere. Kills the staircase aliasing.
        cell = BACK_BIB_BITMAP[row][col]
        vf = (bib_z1 - z) / max(1e-6, bib_z1 - bib_z0)
        uf = (dt + BIB_THETA_HALF) / (2 * BIB_THETA_HALF)
        # v11r4: EVERY face inside the panel window gets ONE key --
        # 'bib_back' -- whose UVs are continuously remapped into the
        # anti-aliased painted cell below. Returning per-face gold/navy keys
        # here (the old staircase) left a jagged ring of flat-coloured
        # 'bib_gold_soft'/'strap_navy' faces around an already-smooth
        # remapped core: the AA outline exists ONLY in the painted cell.
        return 'bib_back'

    strap_z0 = z_hip + 0.10 * total_h
    strap_z1 = z_black_top - 0.035
    def back_detail(z, theta, base_color):
        # Diagonal navy courier strap: a single asymmetric line across the red
        # back breaks the old mirrored tube-toy read. The B is evaluated last
        # so its gold strokes remain crisp where the two details cross.
        detail = base_color
        if strap_z0 <= z <= strap_z1:
            t = (z - strap_z0) / max(1e-6, strap_z1 - strap_z0)
            strap_center = BIB_THETA_CENTER + lerp(-0.48, 0.40, t)
            if abs(theta - strap_center) < 0.115:
                detail = 'strap_navy'
        return bib_pixel(z, theta, detail)

    ring_idx = 0
    for si, color in enumerate(seg_colors):
        for i in range(N_TORSO_RINGS):
            z_lo, z_hi = torso_ring_zs[ring_idx], torso_ring_zs[ring_idx + 1]
            z_mid = (z_lo + z_hi) / 2.0
            if bib_z0 - 0.02 <= z_mid <= bib_z1 + 0.02:
                # v11r3: ONE continuous 'bib_back' material whose UVs are
                # remapped into the dedicated AA-painted atlas cell -- BUT the
                # torso's own faces are far too coarse to carry a painted
                # glyph (each spans ~15cm), so the panel rows are SUBDIVIDED
                # 5x4 first; the later UV remap then tracks the bolt smoothly.
                def bib_row_color(zm, theta, base=color):
                    dtc = (theta - BIB_THETA_CENTER + math.pi) % (2 * math.pi) - math.pi
                    if abs(dtc) <= BIB_THETA_HALF:
                        return 'bib_back'
                    return back_detail(zm, theta, base)
                bridge_ring_subdivided(torso_rings[ring_idx], torso_rings[ring_idx + 1],
                                       bib_row_color, rects, nx=5, ny=4)
            elif strap_z0 <= z_mid <= strap_z1:
                color_fn = (lambda theta, zm=z_mid, base=color: back_detail(zm, theta, base))
                bridge_ring_colored(torso_rings[ring_idx], torso_rings[ring_idx + 1], color_fn, rects)
            else:
                bridge_ring(torso_rings[ring_idx], torso_rings[ring_idx + 1], color, rects)
            ring_idx += 1
    cap(torso_rings[0], 'jeans', rects, flip=True)

    hw0, hd0 = torso_extent(z_hip)

    # Sculpted hood/collar shell. Three open elliptical rings rise behind the
    # neck and taper inward; the torso and neck hide the open ends. This adds a
    # garment silhouette around the head instead of another hard cylinder.
    hood_w = {'Spine02': 0.72, 'neck': 0.28}
    hood_r0 = ellipse_ring(0, 0.030, z_black_top - 0.018, 0.178, 0.132, hood_w,
                           n=N_TORSO, phase=torso_phase)
    hood_r1 = ellipse_ring(0, 0.055, z_black_top + 0.042, 0.156, 0.142, hood_w,
                           n=N_TORSO, phase=torso_phase)
    hood_r2 = ellipse_ring(0, 0.050, z_black_top + 0.096, 0.112, 0.102, hood_w,
                           n=N_TORSO, phase=torso_phase)
    bridge_ring(hood_r0, hood_r1, 'hoodie_shadow', rects)
    bridge_ring(hood_r1, hood_r2, 'hoodie_red', rects)

    # Small side-slung courier pouch at the right hip, deliberately off-centre
    # so the hero has an identifiable asymmetry in a quarter-second silhouette
    # glance. It is Hips-weighted and therefore follows the stride naturally.
    pouch_x = -hw0 * 0.98
    pouch_y = hd0 + 0.036
    pouch_w = {'Hips': 1.0}
    pouch0 = ellipse_ring(pouch_x, pouch_y, z_hip - 0.010, 0.048, 0.032,
                          pouch_w, n=16)
    pouch1 = ellipse_ring(pouch_x, pouch_y, z_hip + 0.045, 0.068, 0.040,
                          pouch_w, n=16)
    pouch2 = ellipse_ring(pouch_x, pouch_y, z_hip + 0.115, 0.070, 0.041,
                          pouch_w, n=16)
    pouch3 = ellipse_ring(pouch_x, pouch_y, z_hip + 0.170, 0.050, 0.033,
                          pouch_w, n=16)
    bridge_ring(pouch0, pouch1, 'strap_navy', rects)
    bridge_ring(pouch1, pouch2, 'strap_navy', rects)
    bridge_ring(pouch2, pouch3, 'pouch_gold', rects)
    cap(pouch0, 'strap_navy', rects, flip=True)
    cap(pouch3, 'pouch_gold', rects)

    # ---------------- pelvis saddle: connects torso bottom to both legs
    # v15 (Task A): flare/step tightened from 0.92x to 0.72x -- with the
    # torso now holding close to full width all the way down to the hip
    # (see torso_extent above), the old 0.92x taper was too gentle to read
    # as a garment hem; it just continued the same smooth taper one step
    # further. A sharper step here (plus the colour change to 'jeans')
    # reads as the tee's hem ending and the body/waistband starting --
    # a defined break instead of the taper just continuing.
    pelvis_z = z_hip - 0.05
    pelvis_ring = ellipse_ring(0, 0, pelvis_z, hw0 * 0.72, hd0 * 0.72, {'Hips': 1.0}, n=N_TORSO, phase=torso_phase)
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
    bridge_ring(torso_rings[-1], neck_lo, 'flag_black', rects)

    def build_head():
        # Only the SKULL band lives in this bespoke latitude loop now --
        # from head_cap_edge_v (where the cap takes over, see build_cap)
        # down to head_jaw_cutoff_v (where the neck taper takes over, see
        # build_neck_taper). Segment count == N_LIMB so both open ends
        # bridge into their neighbours with a plain 1:1 ring zip, no
        # vertex-count reduction trick needed anywhere in the head/neck/cap
        # chain.
        segs = N_LIMB
        # v13: was 7 -- at this latitude-ring count the skull showed
        # countable facets same as the cap did. N_HEAD_RINGS (16) plus the
        # already-doubled segs makes this a genuinely round sphere in both
        # directions.
        rings = N_HEAD_RINGS
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
                # v11r5 SEAM FIX: the skin/hair paint boundary sat at only
                # ~8.6 deg past dead-centre of each side (y < -0.15*ring_r),
                # so the pale eye/brow plates' outer columns overlaid
                # hair-painted skull -- a hard sliver seam in side view.
                # Widening the front skin mask to -0.45*ring_r (~27 deg)
                # puts the whole face plate field on skin so the plate-to-
                # band transition happens in GEOMETRY, not as a texture
                # sliver against hair.
                is_front = y < -ring_r * 0.45
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
                else:
                    ck = 'hair' if v < fringe_v else 'hair_dark'
                    # v13: hair as a real MASS with volume/edge, not a
                    # texture painted on the bare skull sphere -- a small
                    # uniform lift everywhere in the hair region (reads as
                    # "sits proud of the head"), plus a stronger shelf
                    # right at the nape (back hemisphere, bottom of the
                    # hair band, where a real head shows the hairline
                    # stepping out past the neck) so there's an actual
                    # silhouette edge back there instead of the hair
                    # blending straight into a sphere.
                    back_w = max(0.0, math.sin(theta))  # 0 at front/sides, 1 dead behind
                    nape_w = clamp01((v - fringe_v) / max(1e-6, v1 - fringe_v))
                    # v15 (Task C): back_w alone was the wrong axis to bulge
                    # on. Viewed from the rear-high chase cam (looking along
                    # -Y), the head's actual silhouette EDGE -- the outline
                    # against the sky, the thing that has to break to stop
                    # reading as "a clean arc" -- sits at max |x|, i.e.
                    # theta==0/pi (the SIDES), where cos(theta)=+-1. back_w
                    # (=sin(theta)) is exactly ZERO there: at theta=pi/2
                    # (dead behind, x=0) the old bulge only pushed y (pure
                    # depth, invisible in a near-orthographic rear view) and
                    # did nothing to the profile outline at all -- hence
                    # "still a near-perfect circle" even after two prior
                    # passes at the nape shelf alone. sil_w below is 1 across
                    # the whole side+back arc (~270 deg) and 0 only right at
                    # the face, so it actually inflates x at the sides where
                    # the outline is drawn, on top of the existing back/nape
                    # depth shelf (kept for the ear-height and nape-specific
                    # shape event).
                    front_amt = clamp01((-math.sin(theta) - 0.15) / 0.85)
                    sil_w = 1.0 - front_amt
                    # v15b: a MULTIPLICATIVE bulge (x*=1+bulge) loses this
                    # fight by construction -- ring_r itself shrinks from
                    # ~95% to ~65% of head_r across this band (v0->v1 is
                    # already well past the sphere's own equator), while
                    # the cap's own dome flares out to a FIXED absolute
                    # radius (base_rx*1.18, see build_cap) measured off the
                    # band's TOP ring. A constant fractional bulge shrinks
                    # right along with ring_r and can never catch up to
                    # that fixed absolute number by the time it matters --
                    # measured in-game (i1-head-crop.png) this produced no
                    # visible bump at all, just a smooth continuation of
                    # the cap's own curve. Switched to an ABSOLUTE offset
                    # in metres, added along the (cos,sin) direction --
                    # this is what lets the hair mass genuinely exceed the
                    # cap's own fixed edge radius instead of asymptotically
                    # approaching it from underneath.
                    # v16: the absolute offset above was applied at FULL
                    # strength across the whole hair band, including its
                    # topmost ring -- which sits immediately under the cap's
                    # rim, where the skull is still near its widest. Adding
                    # ~0.046 m of radius there pushed the hair straight out
                    # past the cap's own edge all the way around the head, so
                    # in-game (r4-0.png) the figure grew a wide flat saucer
                    # below the cap and read as a sombrero rather than hair.
                    # Real hair does the opposite: it is flush where a cap
                    # grips the skull and gains mass going DOWN toward the
                    # nape. band_w ramps the silhouette term in with depth
                    # down the band, so the top ring gets essentially nothing
                    # and the widening happens where the ears and nape are.
                    band_w = clamp01((v - v0) / max(1e-6, v1 - v0))
                    band_w *= band_w
                    # v16b: halved again. Even ramped, the sideways term was
                    # enough to leave a visible lip under the cap's own
                    # 1.18x flare, so the head still read as a bowl-cut /
                    # mushroom. The ear no longer depends on this clearing a
                    # large bulge (see build_ear), so the silhouette break
                    # can come mostly from the nape shelf, which is where a
                    # real hairline actually steps out.
                    # Unequal low-frequency lobes break the perfect sphere at
                    # the sides/nape, ramping from zero under the fitted cap.
                    tuft = (0.007 * math.sin(theta * 5.0 + 0.55) +
                            0.004 * math.sin(theta * 3.0 - 0.8)) * band_w * sil_w
                    extra_r = ((0.004 + 0.014 * sil_w) * band_w +
                               0.030 * nape_w * back_w + tuft)
                    x += extra_r * math.cos(theta)
                    y += extra_r * math.sin(theta) * 1.05
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

    # Three chunky nape locks break the cap/head egg silhouette from the chase
    # camera. They are deliberately low-frequency graphic wedges, not a noisy
    # ring of spikes, and move rigidly with the Head bone.
    def build_hair_lock(cx, cy, z_top, tip_x, tip_y, z_tip, hw, depth):
        w = {'Head': 1.0}
        mid_x, mid_y = lerp(cx, tip_x, 0.58), lerp(cy, tip_y, 0.58)
        mid_z = lerp(z_top, z_tip, 0.58)
        base = ellipse_ring(cx, cy, z_top, hw, depth, w, n=10)
        mid = ellipse_ring(mid_x, mid_y, mid_z, hw * 0.76, depth * 0.82, w, n=10)
        tip = ellipse_ring(tip_x, tip_y, z_tip, hw * 0.22, depth * 0.30, w, n=10)
        bridge_ring(base, mid, 'hair', rects)
        bridge_ring(mid, tip, 'hair_dark', rects)
        cap(base, 'hair_dark', rects, flip=True)
        cap(tip, 'hair_dark', rects)
    build_hair_lock(-0.095, 0.145, head_cz - 0.050, -0.128, 0.150,
                    head_cz - 0.190, 0.035, 0.025)
    build_hair_lock(0.000, 0.175, head_cz - 0.058, 0.018, 0.185,
                    head_cz - 0.205, 0.038, 0.026)
    build_hair_lock(0.095, 0.145, head_cz - 0.050, 0.132, 0.150,
                    head_cz - 0.180, 0.034, 0.024)

    def build_cap(top_ring, cz, r):
        # v13: replaces v8-v10's 2-ring-plus-tip "quarter circle" approx,
        # which at N_LIMB=12 read as a hard-edged faceted cone/lampshade in
        # game (measured directly off now-0/now-2.png) -- a real dome needs
        # more than 2 rings to look curved instead of like a tent over a
        # tip. Rebuilt as an N_CAP_RINGS-ring dome sampled continuously
        # along the same quarter-circle (cos/sin) profile that v10
        # introduced (true dome curvature, width falling off slowly near
        # the base and only closing up right at the tip) -- same silhouette
        # shape as before, just actually smooth now. Three pieces as
        # before: shadowed skirt w/ strap notch -> smooth dome -> forward
        # peak/brim, now WIDENED and given real thickness (top + underside
        # + front edge) so it reads as a brim breaking the silhouette from
        # a rear-3/4 angle, not just the dead-overhead slide-cam test.
        n = len(top_ring)
        v0 = P['head_cap_edge_v']
        phi0 = v0 * math.pi
        z0 = cz + r * math.cos(phi0) * 1.05
        base_rx = r * math.sin(phi0)
        base_ry = base_rx * 1.05
        join = [vtx for vtx, _ck in top_ring]   # reuse the skull's own verts -- zero seam gap

        # Base flare: 1.18x -- inside the brief's 1.15-1.25x target, enough
        # lip to read as a cap sitting ON the head rather than paint on the
        # skull.
        # v11r4: flat baseball-cap crown -- rise 0.45 -> 0.52 of the base
        # radius: low and fitted (not a tureen) but with just enough dome
        # that it doesn't pancake into a beret.
        # v11r5: crown STILL bulbous from behind (v11-rest-back: a tall
        # balloon over the skull). rise cut 0.58 -> 0.42 of base_rx and
        # base_mult trimmed 1.06 -> 1.02 so the dome hugs the skull -- fabric
        # sits ~5-8 mm proud of the hair surface at the sides instead of
        # floating on a 6% pedestal: a fitted low-profile baseball crown.
        base_mult = 1.02
        # v13: rise is now proportional to the join ring's OWN radius
        # (base_rx) instead of an absolute "crown_target_z" delta -- the
        # absolute-target version risked an elongated "coolie hat" dome if
        # head_radius ever shrank (join ring moves closer to the axis, so
        # a fixed absolute rise would have to cover relatively more height
        # for the same width, flattening the base-to-tip ratio into a
        # cone). The 1.25x ratio reproduces the old shipped proportions
        # measured at the previous head_radius (rise/base_rx worked out to
        # ~1.25 there) so this is a like-for-like carry-forward, just
        # self-scaling now.
        # v11r3: dome FLATTENED (rise 0.88 -> 0.62 of base radius) -- the old
        # near-hemisphere read as a mushroom/safari dome; 0.62 gives the low
        # snapback crown profile.
        rise = base_rx * 0.42

        # v11r5 CROWN REBUILD: the old quarter-circle-of-base-radius dome --
        # even flattened -- is a constant-curvature shell that stays WIDE too
        # long and overhangs the skull: a beret/mushroom in silhouette. A
        # fitted baseball crown instead PARALLELS THE SKULL SURFACE. The
        # dome now continues the skull ellipsoid itself (same cz/r/1.05
        # flattening build_head uses) from the join latitude up to a small
        # tip aperture, scaled 1.04x in radius and lifted +6mm -- fabric
        # hugging the skull at a constant ~4-8mm offset everywhere.
        rings_n = N_CAP_RINGS
        phi0 = v0 * math.pi
        phi_tip = 0.14          # small aperture at the crown, closed by the tip fan
        fab = 1.04              # fabric thickness (radial)
        lift = 0.006            # fabric offset along z
        dome_rings = []
        for i in range(rings_n + 1):
            t = i / rings_n
            phi = lerp(phi0, phi_tip, t)
            rr = r * math.sin(phi) * fab * base_mult
            ry = rr * 1.05
            z = cz + r * math.cos(phi) * 1.05 + lift
            dome_rings.append(ellipse_ring(0, 0, z, rr, ry, {'Head': 1.0}, n=n))
        # v11r4: slight back-down slope on the crown base ring -- a baseball
        # cap sits tilted, high over the brow and low over the occiput.
        # Ring convention: theta=pi/2 (+Y) is the BACK.
        for i in range(n):
            theta = i / n * 2 * math.pi
            dome_rings[0][i].co.z -= 0.012 * math.sin(theta)
        tip = V((0, 0, cz + r * math.cos(phi_tip) * 1.05 + lift), {'Head': 1.0})

        # Snapback strap notch: pull a small back-centred arc of the dome's
        # base ring outward (a real dimple/tab, not just a colour trick) --
        # theta == pi/2 (si == n/4) is the +Y/back direction in this ring's
        # own convention (build_head's is_front test is "y < 0" = front). A
        # small OUTWARD tab (the centre vertex pushed back, its two
        # neighbours held in) breaks the round profile the way a real
        # plastic strap adjuster actually sits proud of a cap's fabric.
        # v11r4: the geometric strap notch is REMOVED -- even softened to
        # 1.14x it broke the dome's overhead silhouette as a triangular
        # spike. The strap/snapback area stays marked by the skirt's paint
        # bands (hair opening + cap_strap swatch) and the strap cell's
        # sheen band, which read cleanly from every angle.

        def ang_dist(a, b):
            d = abs(a - b) % (2 * math.pi)
            return min(d, 2 * math.pi - d)

        def skirt_color(theta):
            back_dist = ang_dist(theta, math.pi / 2)
            # Exposed hair creates a real snapback opening and stops the crown
            # reading as an unbroken crash helmet from the chase camera.
            if back_dist < 0.32:
                return 'hair_dark'
            return 'cap_strap' if back_dist < 0.52 else 'cap_red_dark'
        bridge_ring_colored(join, dome_rings[0], skirt_color, rects)   # shadowed skirt, strap notch at back
        for i in range(rings_n):
            # first ring off the skirt stays shadowed (cap_red_dark) so the
            # skirt->dome transition reads as a shading gradient rather
            # than a flat-lit dome popping straight out of a hard seam;
            # everything above that is the bright crown fabric.
            col = 'cap_red_dark' if i == 0 else 'cap_red'
            bridge_ring(dome_rings[i], dome_rings[i + 1], col, rects)
        for i in range(n):
            a, b = dome_rings[-1][i], dome_rings[-1][(i + 1) % n]
            tri(a, b, tip, 'cap_red', rects)

        # Forward peak/brim: was a fixed 5-vert (span=2 of n=12, ~150deg
        # arc) zero-thickness flap. n has since more than doubled (N_LIMB
        # 12->26) so span now scales with n to keep the SAME angular
        # coverage, and the brim gets real thickness (top surface +
        # underside + a front edge face) instead of a single plane, so it
        # reads as a 3D peak breaking the cap's round silhouette at a
        # rear-3/4 angle -- not just dead overhead.
        front_i = 3 * n // 4
        # v11r2: brim widened to ~1.6x skull width -- span grows (6.5/28 ->
        # 9.5/28 of the crown ring) AND the tip verts flare laterally
        # (root.x * flare), so the peak's tip edge is genuinely wider than
        # the dome instead of converging toward the centreline. The z-drop
        # factor now ramps with w so the outer third of the brim curls
        # visibly DOWNWARD -- a cap silhouette break from behind, not a
        # flat plate.
        span = max(2, round(n * 9.5 / 28))
        idxs = [(front_i + d) % n for d in range(-span, span + 1)]
        peak_top, peak_bot = [], []
        # v11r4: thin stiff brim with a CRISP edge -- lateral flare cut
        # 0.60 -> 0.18 (the old 1.6x-width fan read as side flaps), curl
        # reduced to a gentle forward dip, thickness kept for the edge break.
        for d, idx in zip(range(-span, span + 1), idxs):
            w = max(0.0, 1.0 - (abs(d) / (span + 0.6)) ** 1.3)
            root = join[idx].co
            reach = 0.132 * w
            flare = 1.0 + 0.18 * w
            curl = 0.08 + 0.12 * w ** 1.5
            top_pt = Vector((root.x * flare, root.y - reach, root.z - reach * curl))
            bot_pt = Vector((top_pt.x, top_pt.y + reach * 0.05, top_pt.z - 0.007 * max(w, 0.35)))
            peak_top.append(V(tuple(top_pt), {'Head': 1.0}))
            peak_bot.append(V(tuple(bot_pt), {'Head': 1.0}))
        for i in range(len(idxs) - 1):
            a, b = join[idxs[i]], join[idxs[i + 1]]
            quad(a, b, peak_top[i + 1], peak_top[i], 'cap_red', rects)                       # brim top surface
            quad(peak_top[i], peak_top[i + 1], peak_bot[i + 1], peak_bot[i], 'cap_red_dark', rects)  # brim front edge (thickness)
            quad(a, b, peak_bot[i + 1], peak_bot[i], 'cap_red_dark', rects)                  # brim underside
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
        # v15 (Task C): the old ear sat at head latitude v~0.49 -- INSIDE
        # the cap's own coverage (the cap dome's join ring is at
        # head_cap_edge_v and the fabric covers every theta above it, not
        # just the front brim), so the ear box was built behind/under the
        # cap and read as a small cap side-panel, not an ear. Re-anchored
        # within the actually-EXPOSED skull band (head_cap_edge_v ..
        # head_jaw_cutoff_v), centred with a fixed safety margin at each
        # end so its own flared geometry can't poke back up into the cap
        # dome or down past the jaw/neck taper -- derived from the band's
        # real z-extent rather than a hand-picked v fraction, so this stays
        # correct if head_cap_edge_v/head_jaw_cutoff_v are ever retuned.
        v0e, v1e = P['head_cap_edge_v'], P['head_jaw_cutoff_v']
        z_cap_edge = head_cz + head_r * math.cos(v0e * math.pi) * 1.05
        z_jaw = head_cz + head_r * math.cos(v1e * math.pi) * 1.05
        margin = 0.014
        z_band_top, z_band_bot = z_cap_edge - margin, z_jaw + margin
        cz0 = (z_band_top + z_band_bot) / 2.0
        # v11r4: ear height clamped lower (0.032) so its top ring can never
        # poke through the cap skirt -- the old 0.045 put beige squares on
        # the red crown in the front render.
        hh = min(0.022, (z_band_top - z_band_bot) / 2.0)
        phi_ear = math.acos(max(-1.0, min(1.0, (cz0 - head_cz) / (head_r * 1.05))))
        ring_r = head_r * math.sin(phi_ear)
        cy0 = -ring_r * 0.05
        w = {'Head': 1.0}
        # v15b (Task C, round 2): the v15 ear was a flat monotonic wedge
        # (lo->hi, straight taper) -- from the actual chase-cam angle that
        # presents nearly edge-on and reads as a thin pale sliver, not an
        # ear (measured in-game: i1-head-crop-wide.png).
        # v15c: a first "fix" (3 straight rings: flush -> wide -> flush)
        # overcorrected into a sharp diamond/wing -- 3 rings bridged with
        # plain straight lofts have a hard V corner at the middle ring by
        # construction, no matter how modest the peak radius is, and it
        # rendered as a pointed elf/Spock ear (measured off
        # v3-rest-back_high.png). Rebuilt as a 5-ring stack whose radius
        # follows a sin(pi*t) bump (zero slope at both the root and the
        # tip) so consecutive short straight segments approximate a
        # genuinely rounded oval bump instead of a triangle. Peak radius
        # kept modest (1.42x, vs 1.78x before) -- just enough to clear the
        # hair mass's own new bulge at this latitude (build_head's extra_r
        # maxes out at ~0.046m at the sides, i.e. ~1.29x this ring's own
        # radius) with a real but not cartoonish margin.
        # v16: 1.42x read as a pale WING flanking the cap, not an ear -- it
        # was the second-brightest thing on the whole figure (flat 'skin'
        # against the dark hair mass) and it projected far enough past the
        # skull to break the head's outline into a shape with points on it
        # (in-game r5-0.png). Two causes, both addressed here. The peak was
        # sized to clear the hair bulge back when that bulge was applied at
        # full strength across the entire band; it now ramps in with depth
        # (see build_head's band_w), so at THIS latitude -- the middle of
        # the exposed band -- the hair only adds ~0.010 m, about 1.05x the
        # ring radius, and 1.20x clears it with room to spare. And the ear
        # takes skin_shadow rather than skin: an ear seen from directly
        # behind is a small form in its own shadow, not a highlight, so
        # this keeps it reading as anatomy without competing with the cap.
        # v11r4: the ear base ring now digs INTO the skull (inner edge at
        # ~0.95x of the local skull radius, i.e. under the hair-bulged
        # surface) instead of hovering just outside it -- the old
        # 1.02x-base/0.012-half-width ring sat entirely outside the hair
        # mass's extra_r bulge and rendered as floating beige blobs. Peak
        # kept modest (1.14x) so it stays an ear, not a wing.
        # v11r5 EAR SHRINK: even at 1.14x peak the ears still flared as wide
        # flat handles in silhouette/back view. Cut to a small cupped form:
        # peak 1.14 -> 1.05x ring radius (barely proud of the hair mass),
        # half-width/depth ~35% smaller, height clamped to 0.022 so most of
        # the ear hides under the cap skirt edge -- Jake-style, where ears
        # are a hint, not a handlebar.
        n_ear = 5
        r_base, r_peak = ring_r * 1.00, ring_r * 1.05
        w_base, w_peak = 0.018, 0.016
        d_base, d_peak = 0.015, 0.018

        def ring4(cx, hwv, hdv, z):
            return [
                V((cx - sign * hwv, cy0 - hdv, z), w), V((cx + sign * hwv, cy0 - hdv, z), w),
                V((cx + sign * hwv, cy0 + hdv, z), w), V((cx - sign * hwv, cy0 + hdv, z), w),
            ]
        ear_rings = []
        for i in range(n_ear):
            t = i / (n_ear - 1)
            bump = math.sin(math.pi * t)
            r = lerp(r_base, r_peak, bump)
            wv = lerp(w_base, w_peak, bump)
            dv = lerp(d_base, d_peak, bump)
            z = lerp(cz0 - hh, cz0 + hh, t)
            ear_rings.append(ring4(sign * r, wv, dv, z))
        for i in range(n_ear - 1):
            bridge_ring(ear_rings[i], ear_rings[i + 1], 'skin_shadow', rects, flip=(sign > 0))
        cap(ear_rings[-1], 'skin_shadow', rects, flip=(sign < 0))
    build_ear(1); build_ear(-1)

    # v11r3 FACE FIX: the old planes were placed with ABSOLUTE millimetre
    # offsets tuned for the pre-v11 head radius; after head_radius grew to
    # 0.234 they ended up INSIDE the skull (mouth/blush ~19 mm deep, eyes
    # straddling the surface -> z-fighting), so renders showed a blank head.
    # Every facial vertex is now computed ON the skull ellipsoid itself
    # (same equation build_head uses: x^2 + (y/1.05)^2 = ring_r^2) and then
    # pushed OUT along -Y by a few mm, so the art can never be buried again,
    # regardless of future head_radius changes.
    fw = {'Head': 1.0}
    def fpt(x, z, out=0.005):
        cphi = max(-1.0, min(1.0, (z - head_cz) / (head_r * 1.05)))
        rr = head_r * math.sqrt(max(0.0, 1.0 - cphi * cphi))
        # v11r5 SMEAR FIX: at 3/4 yaw the outer grid nodes sat near the
        # skull's visible horizon; a constant `out` let the plates sink
        # back INTO the ellipsoid there (the surface normal tilts away),
        # so eye/brow grids streaked as half-buried vertical slivers.
        # Two guards:
        #   1. clamp lateral position to <=0.88 of the local ring radius
        #      (~28 deg short of the horizon) -- any grid point that would
        #      fold past the visible horizon is pulled back instead of
        #      smeared;
        #   2. grow the outward offset with grazing angle (up to ~2.6x)
        #      so plates stay proud of the curving surface all the way
        #      out to that clamp -- crisp to well past +-45 deg yaw.
        frac = min(0.70, abs(x) / max(rr, 1e-6))
        x = math.copysign(frac * rr, x) if rr > 0 else 0.0
        m = math.sqrt(max(1e-6, rr * rr - x * x))
        lift = out * (1.0 + 1.6 * frac ** 3)
        return V((x, -1.05 * m - lift, z), fw)

    # v11r4 FACE WRAP: single flat quads chord across the ellipsoid and sink
    # below the surface away from dead-centre, so eyes/brows vanish at 3/4
    # yaw. Every feature is now a small GRID of surface-hugging points
    # (fpt at each grid node), so the art follows the skull curvature and
    # stays visible to +-45 deg.
    def quad_grid(pts, color_key, edge_key=None):
        # v11r5: optional edge_key paints the OUTERMOST column band with a
        # blending colour (e.g. skin) so the plate vanishes against the
        # skull at grazing yaw instead of showing an edge-on white sliver.
        n_cols = len(pts[0]) - 1
        for i in range(n_cols):
            ck = edge_key if (edge_key and (i == 0 or i == n_cols - 1)) else color_key
            for j in range(len(pts) - 1):
                quad(pts[j][i], pts[j][i + 1], pts[j + 1][i + 1], pts[j + 1][i],
                     ck, rects)

    def build_face_eye(sign):
        cx = sign * 0.078
        eye_z = head_cz - 0.128          # clear of the brim shadow line (~cz-0.117)
        ew, eh = 0.046, 0.031
        # Almond eye: 4 columns x 3 rows, each node ON the ellipsoid; column
        # height follows the almond profile sqrt(1-(dx/ew)^2).
        nx = 4
        rows_t = (-1.0, -0.45, 0.45, 1.0)
        lid_cols = []
        for i in range(nx + 1):
            x = cx - ew + 2 * ew * i / nx
            a = math.sqrt(max(0.0, 1.0 - ((x - cx) / ew) ** 2))
            lid_cols.append([fpt(x, eye_z + eh * a * t, 0.006) for t in rows_t])
        eye_rows = [[lid_cols[i][j] for i in range(nx + 1)] for j in range(len(rows_t))]
        quad_grid(eye_rows, 'eye_white', edge_key='skin_shadow')
        # Dark pupil, offset forward (deeper `out`) AND slightly inward so the
        # gaze reads front-on from the chase/rest cameras. 2x2 wrapped grid.
        px = cx - sign * 0.006
        ps = 0.011
        pz = ps * 0.8
        pup = [[fpt(px - ps, eye_z - pz, 0.012), fpt(px, eye_z - pz * 1.05, 0.012), fpt(px + ps, eye_z - pz, 0.012)],
               [fpt(px - ps, eye_z, 0.013), fpt(px, eye_z, 0.013), fpt(px + ps, eye_z, 0.013)],
               [fpt(px - ps, eye_z + pz, 0.012), fpt(px, eye_z + pz * 1.05, 0.012), fpt(px + ps, eye_z + pz, 0.012)]]
        quad_grid(pup, 'eye')

        # Determined, asymmetric brow angle -- inner end lower toward the
        # nose. 4x2 wrapped grid so it hugs the brow ridge curvature.
        bw, bh = 0.034, 0.009
        zi, zo = head_cz - 0.100, head_cz - 0.088
        xi, xo = cx - sign * bw, cx + sign * bw
        nbx = 4
        brow_rows = []
        for dz in (-bh, bh):
            row = [fpt(xi + (xo - xi) * i / nbx,
                       lerp(zi, zo, i / nbx) + dz, 0.007) for i in range(nbx + 1)]
            brow_rows.append(row)
        quad_grid(brow_rows, 'eyebrow')
    build_face_eye(1); build_face_eye(-1)

    # v11r4: dedicated temple side-shading patches were TRIED and REMOVED:
    # the skull band at that latitude is painted hair, so skin-toned patches
    # rendered as pale stuck-on squares beside the eyes. Front-vs-side value
    # separation already comes from the smooth-shaded ellipsoid under the
    # key/fill lights.

    # Wedge nose + open grin, both hugging the surface.
    nose_top = fpt(0.000, head_cz - 0.150, 0.022)
    nose_l = fpt(-0.020, head_cz - 0.130, 0.005)
    nose_r = fpt(0.021, head_cz - 0.127, 0.005)
    tri(nose_top, nose_l, nose_r, 'skin_shadow', rects)
    mouth_pts = [(-0.048, 0.007), (-0.017, -0.003), (0.016, -0.002), (0.050, 0.009)]
    for i in range(len(mouth_pts) - 1):
        x0, dz0 = mouth_pts[i]; x1, dz1 = mouth_pts[i + 1]
        thick = 0.009
        q = [fpt(x0, head_cz - 0.170 + dz0 - thick, 0.004),
             fpt(x1, head_cz - 0.170 + dz1 - thick, 0.004),
             fpt(x1, head_cz - 0.170 + dz1 + thick, 0.004),
             fpt(x0, head_cz - 0.170 + dz0 + thick, 0.004)]
        quad(q[0], q[1], q[2], q[3], 'mouth', rects)

    # v11r4: cheek blush quads REMOVED -- under per-face jitter and hard
    # colour-region shading edges they rendered as pale stuck-on squares
    # ("band-aids") on the cheeks, not a tint. The face keeps its interest
    # from eyes/brows/mouth and the new temple side-shading instead.

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
        # v10: enlarged again (0.058/0.078/0.053 -> 0.066/0.090/0.060) in
        # step with chest_half_w's widening -- measured in-game (h-0.png)
        # the head was still reading as wide as the shoulders. Cosmetic
        # mesh-only change; shoulder_socket_x (the actual bone position)
        # is untouched.
        # v10b: pulled back with chest_half_w (that pass measured ~1.95x
        # shoulder:head in-game, overshooting the 1.2-1.5x target) --
        # 0.066/0.090/0.060 -> 0.063/0.084/0.057.
        # v13: deltoid/upper-arm/forearm rebuilt on circ_chain/bridge_chain
        # (see helpers just above the module's `cap()` function) -- the
        # exact same anatomical keyframe rings, weights, colours and belly-
        # bulge ratios as before, just with N_*_RINGS extra interpolated
        # rings inserted between them so each taper curves instead of
        # reading as 2-3 straight cone segments end to end.
        # v17: belly/base enlarged (0.084/0.062 -> 0.096/0.070) in step with
        # the thickened upper arm (upper_arm_r0 0.070->0.078) so the deltoid
        # cap keeps reading as a rounded mass proud of the upper arm, not a
        # flat handoff.
        sh_z = [P['shoulder_line_z'] + 0.044, P['shoulder_line_z'] + 0.010, P['shoulder_line_z'] - 0.026]
        # v14: base radius (deltoid->upper-arm handoff) nudged 0.057->0.062
        # -- Task D thickened upper_arm_r0 to 0.070, and with an explicit
        # bridge_ring now connecting the two (see build_arm below), a
        # 23% radius jump at that seam read as a slightly abrupt flare.
        # Softened to a ~13% step, still a real taper, not a hard wall.
        # v18: top radius cut hard (0.068->0.038) -- the old top ring was
        # wide enough that its flat cap() closure read as an epaulette/
        # shoulder-pad plateau (a flat disc riding on top of the arm) rather
        # than a rounded deltoid muscle, which is exactly the "no deltoid...
        # visibly assembled from primitives" complaint applied to the
        # shoulder specifically. Belly kept wide (0.096) so the cap->belly->
        # base run over N_DELTOID_RINGS(9) rings now reads as a real rounded
        # mound tapering to a near-point at the crown, the same silhouette
        # logic build_cap already uses for the head dome.
        # Keep the outer shoulder contour rounded and human rather than the
        # old pagoda-like shelf. A smaller belly still gives a clear deltoid
        # but no longer spikes far beyond the hoodie torso in rear silhouette.
        sh_r = [0.024, 0.076, 0.066]
        sh_w = [{'Spine02': 0.4, sh_bone: 0.6}, {sh_bone: 1.0}, {sh_bone: 1.0}]
        # v18b: belly bulge added to the cap->belly segment -- v18 narrowed
        # the top ring (0.096->0.038) but circ_chain's plain lerp between
        # two keyframes is a STRAIGHT taper no matter how many sub-rings
        # it's split into, i.e. a cone, which is exactly the "shoulder pad"
        # read a close-up crop (r3close-f176/f188) still showed even after
        # the top-radius cut. A sin-hump belly on that one segment (same
        # mechanism already used for the thigh and forearm bulges just
        # below) pulls the mid-taper radius out toward the belly's own
        # width, turning the straight cone into a convex, rounded mound --
        # zero topology change, since bellies only scales existing sub-ring
        # radii, not ring count.
        sh_rings = circ_chain(sx, 0, sh_z, sh_r, sh_w, N_LIMB, rings_per_seg=N_DELTOID_RINGS, bellies=[0.22, 0.0])
        bridge_chain(sh_rings, ['hoodie_red', 'hoodie_red'], rects, flip=(sign > 0), rings_per_seg=N_DELTOID_RINGS)
        cap(sh_rings[0], 'hoodie_red', rects, flip=(sign < 0))

        arm_bone = 'LeftArm' if sign > 0 else 'RightArm'
        fore_bone = 'LeftForeArm' if sign > 0 else 'RightForeArm'
        hand_bone = 'LeftHand' if sign > 0 else 'RightHand'

        z0, z1 = P['shoulder_line_z'] - 0.024, P['shoulder_line_z'] - 0.024 - P['upper_arm_len']
        # Long hoodie sleeve. Hands remain bare and oversized below, giving a
        # clean sleeve/cuff/hand break instead of the previous orange forearm
        # cylinders dominating the rear silhouette.
        # The old belly-bump ring (r_mid = lerp*1.06 at t=0.38) is now a
        # `bellies` hump on the shoulder->sleeve segment instead of an
        # explicit extra keyframe -- same bulge, generated continuously.
        sleeve_split_z = z0 - (z0 - z1) * 0.62
        r_sleeve = lerp(P['upper_arm_r0'], P['upper_arm_r1'], 0.62)
        ua_z = [z0, sleeve_split_z, z1]
        ua_r = [P['upper_arm_r0'], r_sleeve, P['upper_arm_r1']]
        ua_w = [{'LeftShoulder' if sign > 0 else 'RightShoulder': 0.3, arm_bone: 0.7}, {arm_bone: 1.0}, {arm_bone: 1.0}]
        ua_rings = circ_chain(sx, 0, ua_z, ua_r, ua_w, N_LIMB, rings_per_seg=N_UARM_RINGS, bellies=[0.05, 0.0])
        # v14: explicit seam bridge between the deltoid's open bottom ring
        # (sh_rings[-1]) and the upper arm's own top ring (ua_rings[0]).
        # Previously these two rings were left unconnected -- it worked
        # only because their radii (0.057 vs the old upper_arm_r0=0.058)
        # were nearly identical, so the near-coincident overlap hid the
        # gap. Now that upper_arm_r0 is deliberately bigger than the
        # deltoid's own base radius (thicker-arm pass, see PROP), that
        # same gap would be wide enough to show as a hole/see-through
        # ring at the shoulder. A real bridge_ring closes it regardless of
        # how much the two radii differ.
        bridge_ring(sh_rings[-1], ua_rings[0], 'hoodie_red', rects, flip=(sign > 0))
        bridge_chain(ua_rings, ['hoodie_red', 'hoodie_red'], rects, flip=(sign > 0), rings_per_seg=N_UARM_RINGS)
        ua_hi = ua_rings[-1]

        z2 = z1 - P['forearm_len']
        fa_z = [z1, z2]
        fa_r = [P['forearm_r0'], P['forearm_r1']]
        fa_w = [{arm_bone: 0.25, fore_bone: 0.75}, {fore_bone: 1.0}]
        fa_rings = circ_chain(sx, 0, fa_z, fa_r, fa_w, N_LIMB, rings_per_seg=N_FARM_RINGS, bellies=[0.06])
        bridge_ring(ua_hi, fa_rings[0], 'hoodie_red', rects, flip=(sign > 0))
        bridge_chain(fa_rings, ['hoodie_shadow'], rects, flip=(sign > 0), rings_per_seg=N_FARM_RINGS)
        fa_lo = fa_rings[-1]

        wb_hi = ellipse_ring(sx, 0, z2 + 0.03, P['forearm_r1'] * 1.10,
                             P['forearm_r1'] * 1.10, {fore_bone: 1.0}, n=N_LIMB)
        wb_lo = ellipse_ring(sx, 0, z2 + 0.015, P['forearm_r1'] * 1.12,
                             P['forearm_r1'] * 1.12, {fore_bone: 1.0}, n=N_LIMB)
        bridge_ring(wb_hi, wb_lo, 'flag_gold' if sign > 0 else 'flag_black',
                    rects, flip=(sign > 0))

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
        # v17: +58%/+47% (0.052/0.045 -> 0.082/0.066) -- the old hand cross-
        # section was NARROWER than forearm_r1 (0.054 at the time), so the
        # "mitt" never actually flared past the wrist; it read as the
        # forearm rod just continuing to a rounded tip. Now clearly wider
        # than the (now also slimmer) forearm_r1=0.049, so the hand-flare
        # is real geometry, not just a colour change at the wrist.
        # Graphic runner hands should read as hands, not boxing gloves or
        # camera-facing discs. Retain the warm knuckle/finger break while
        # reducing the palm flare and tapering the fingertip more decisively.
        # v11r2: another ~1.3x on the cross-section (0.073/0.038 ->
        # 0.095/0.049) -- deeper AND wider fists so they read as chunky
        # cartoon mitts against the enlarged head, not flat paddles.
        hw_, hd_, hh_ = 0.095, 0.049, P['hand_len']
        z3 = z2 - hh_
        # v13: hand's cross-section is an ELLIPSE (rx != ry) with a
        # laterally-shifting centre (cy creeps forward toward the
        # fingertip), so it doesn't fit circ_chain (circular only) --
        # same keyframe-interpolation idea, inlined for the ellipse case.
        hand_kf = [
            (z2 - 0.008, hw_ * 0.86, hd_ * 0.90, 0.0, {hand_bone: 1.0}),
            (z2 - hh_ * 0.32, hw_, hd_, 0.004, {hand_bone: 1.0}),
            (z2 - hh_ * 0.68, hw_ * 0.90, hd_ * 0.94, 0.010, {hand_bone: 1.0}),
            (z3, hw_ * 0.60, hd_ * 0.64, 0.012, {hand_bone: 1.0}),
        ]
        # v11r4: one flat skin tone across the whole mitt (see hand_kf note).
        hz0, hrx0, hry0, hcy0, hw0 = hand_kf[0]
        # v11r4: BRIDGE EVERY ring pair -- the old loop only ever bridged the
        # first N_HAND_RINGS pairs (ring_idx never advanced past segment 0,
        # because hand_colors had a single entry): rings 10..27 were orphaned
        # verts (dropped at export) and the tip cap floated free as a pale
        # disc beside the wrist/jaw while the bridged stump read as an open
        # funnel. Now the whole keyframe tube is one solid skinned shell and
        # the relaxed-fist taper reads as intended.
        hand_rings = [ellipse_ring(sx, hcy0, hz0, hrx0, hry0, hw0, n=N_HAND)]
        for si in range(3):
            hz0, hrx0, hry0, hcy0, hw0 = hand_kf[si]
            hz1, hrx1, hry1, hcy1, hw1 = hand_kf[si + 1]
            for i in range(1, N_HAND_RINGS + 1):
                t = i / N_HAND_RINGS
                zz = lerp(hz0, hz1, t)
                rx = lerp(hrx0, hrx1, t)
                ry = lerp(hry0, hry1, t)
                cyy = lerp(hcy0, hcy1, t)
                w = lerp_weights(hw0, hw1, t)
                hand_rings.append(ellipse_ring(sx, cyy, zz, rx, ry, w, n=N_HAND))
        bridge_ring(fa_lo, hand_rings[0], 'hand_skin', rects, flip=(sign > 0))
        for i in range(len(hand_rings) - 1):
            bridge_ring(hand_rings[i], hand_rings[i + 1], 'hand_skin', rects, flip=(sign > 0))
        # v11r4: tip cap in the SHADOW tone -- an upward-facing cap catches
        # the key light and blew out to pure white on raised fists.
        cap(hand_rings[-1], 'hand_skin_shadow', rects, flip=(sign < 0))
        with open(os.path.join(SCRATCH, 'debug.txt'), 'a') as fh:
            fh.write(f"hand sign={sign} rings={len(hand_rings)} faces_now={len(bm.faces)}\n")

        # thumb: bigger (base radius +40%, reach +33%) to match the bigger
        # hand -- 2-segment tapered stub (base -> mid -> rounded tip)
        # angled inward/forward off the hand's inner-top, at the knuckle
        # line so it reads as branching off the hand mass rather than
        # stuck onto the wrist.
        # v17: scaled up ~1.58x in step with the enlarged hand (hw_ 0.052->
        # 0.082) so the thumb stays proportional instead of looking like a
        # small stub on a now-much-bigger mitt.
        tcx = sx - sign * 0.055
        tcy = -0.036
        tcz = z2 - hh_ * 0.30
        w = {hand_bone: 1.0}
        n = Vector((-sign * 0.55, -0.65, -0.55)).normalized()
        tangent = Vector((0, 1, 0)) if abs(n.x) < 0.9 else Vector((1, 0, 0))
        bitan = n.cross(tangent).normalized()
        tangent = bitan.cross(n).normalized()
        s0 = 0.032
        base = Vector((tcx, tcy, tcz))
        def ring4(center, size):
            return [V(tuple(center + tangent * size + bitan * 0), w),
                    V(tuple(center - tangent * size * 0.4 + bitan * size * 0.9), w),
                    V(tuple(center - tangent * size + bitan * 0), w),
                    V(tuple(center - tangent * size * 0.4 - bitan * size * 0.9), w)]
        base_ring = ring4(base, s0)
        mid = base + n * 0.040
        mid_ring = ring4(mid, s0 * 0.8)
        tip = mid + n * 0.034
        v_tip = V(tuple(tip), w)
        # v11r4: NO base cap -- the old flat quad at the thumb root floated
        # as a pale disc near the wrist/jaw once the hand tube around it
        # was missing. The base ring now sits INSIDE the solid mitt volume
        # (tcx is well within hw_), so the open root is hidden geometry and
        # the stub reads as branching off the fist.
        bridge_ring(base_ring, mid_ring, 'hand_skin', rects)
        for i in range(4):
            a, b = mid_ring[i], mid_ring[(i + 1) % 4]
            tri(a, b, v_tip, 'hand_skin', rects)

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

        # v13: thigh+knee+shin rebuilt as ONE circ_chain/bridge_chain_colored
        # run -- every original keyframe ring (hip, pre-knee, kneecap
        # bulge, post-knee, calf-cuff bulge) is preserved exactly, with
        # N_THIGH_RINGS extra interpolated rings (weights blended too)
        # between each pair so the whole thigh-to-calf taper curves
        # smoothly instead of reading as 4 straight cone segments plus a
        # sudden kneecap step. leg_color is theta-based and identical
        # across this whole span, so one bridge_chain_colored call covers
        # what used to be 5 separate bridge_ring_colored calls.
        z0, z1 = P['hip_z'] - 0.03, P['knee_z']
        z2 = P['ankle_z']
        cuff_z = z1 - (z1 - z2) * 0.68
        r_cuff = lerp(P['shin_r0'], P['shin_r1'], 0.68) * 1.12
        leg_z = [z0, z1 + 0.014, z1, z1 - 0.014, cuff_z]
        leg_r = [P['thigh_r0'], P['thigh_r1'], P['thigh_r1'] * 1.12, P['shin_r0'], r_cuff]
        leg_cy = [0.0, 0.0, 0.006, 0.0, 0.0]
        leg_w = [
            {'Hips': 0.25, up_bone: 0.75},
            {up_bone: 0.7, leg_bone: 0.3},
            {up_bone: 0.35, leg_bone: 0.65},
            {leg_bone: 1.0},
            {leg_bone: 1.0},
        ]
        # v18: added a real calf bulge on the postknee->cuff span (was 0.0,
        # i.e. no calf at all -- brief: "no deltoid, no forearm taper, no
        # calf"). This span already runs from just below the knee to 68%
        # of the way to the ankle, so its sin-hump midpoint (~34% down from
        # the knee) lands right where a real calf muscle sits, ABOVE the
        # r_cuff endpoint bump near the ankle -- two distinct events (calf
        # belly, then the ankle/jeans-cuff taper), not a double-bump at the
        # same point. Thigh belly (thigh->pre-knee) unchanged.
        leg_bellies = [0.05, 0.0, 0.0, 0.30]
        leg_rings = circ_chain(hx, leg_cy, leg_z, leg_r, leg_w, N_LIMB, rings_per_seg=N_THIGH_RINGS, bellies=leg_bellies)
        bridge_chain_colored(leg_rings, leg_color, rects, flip=(sign > 0), cx=hx, cy=0)
        sh_mid = leg_rings[-1]

        r_cuff_in = lerp(P['shin_r0'], P['shin_r1'], 0.70)
        sh_mid_in = ellipse_ring(hx, 0, cuff_z - 0.012, r_cuff_in, r_cuff_in, {leg_bone: 1.0}, n=N_LIMB)
        sh_lo = ellipse_ring(hx, 0, z2, P['shin_r1'], P['shin_r1'], {leg_bone: 1.0}, n=N_LIMB)
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
        # v8 tried a light-midsole-disc-plus-dark-bar split here (two wedges
        # of 'shoe_sole' crossing a 'shoe_mid' centre stripe) to avoid a
        # flat dark slab. v10: in game this reads as a maroon/white
        # CHECKERBOARD, not a shoe sole -- the raised trailing foot presents
        # this face to the rear-high camera at a raking angle where the
        # wedge boundaries read as a graphic error rather than tread detail
        # (h-0.png, lower centre). A single flat colour is what the
        # reference actually uses for soles (see ss-character-spec.md: cel-
        # shaded flat colour fields, no busy patterns) -- reverted to one
        # uniform 'shoe_sole' cap. The colour itself was also fixed (see
        # COLORS['shoe_sole']): the old (0.20,0.13,0.12) read as maroon
        # against the road, not dark rubber.
        cap(sole_bot, 'shoe_sole', rects, flip=(sign < 0))

        # Toe box: rounder/blunter (a real sneaker toe, not a pointed taper)
        # and re-ordered so the toe TIP is the light midsole colour (another
        # dark-oval trap, same fix as the main sole) with a distinct dark
        # rubber toe-guard band just above it.
        # v11r2: toe box BULGED -- taller and wider at the first toe ring so
        # the trainer reads as a puffy foam toe box over the thicker midsole.
        toe_hi = ellipse_ring(hx, -0.105, z_upper_bot + 0.014, P['foot_half_w'] * 1.02, 0.066, {toe_bone: 1.0}, n=N_SHOE)
        toe_trim = ellipse_ring(hx, -0.160, z_trim_bot + 0.008, P['foot_half_w'] * 0.90, 0.058, {toe_bone: 1.0}, n=N_SHOE)
        toe_lo = ellipse_ring(hx, -0.182, z_mid_bot, P['foot_half_w'] * 0.76, 0.046, {toe_bone: 1.0}, n=N_SHOE)
        bridge_ring(upper_bot, toe_hi, 'shoe_white', rects, flip=(sign > 0))
        bridge_ring(toe_hi, toe_trim, 'shoe_white', rects, flip=(sign > 0))
        bridge_ring(toe_trim, toe_lo, 'shoe_sole', rects, flip=(sign > 0))   # dark rubber toe-guard bumper
        cap(toe_lo, 'shoe_mid', rects, flip=(sign < 0))                     # light toe tip, not another dark blob

    build_leg(1); build_leg(-1)

    # ---------------- v11: hood roll collar ----------------
    # A chunky rolled hood collar arcing behind the neck, so the hoodie
    # reads as a hoodie from the rear chase camera instead of ending in a
    # flat neckline. Built as its own 12-gon tube along a hand-placed arc
    # (5 keyframe rings bridged left->right); weighted to Spine02+neck so it
    # bends with head turns without needing any new bone. Sits BEHIND the
    # torso's back panel (+Y) and BELOW the skull's south pole, so it can't
    # clip into the head or hide the flag/back graphic (which lives higher,
    # on the black band).
    def build_hood_collar():
        w_end = {'Spine02': 0.55, 'neck': 0.45}
        w_mid = {'Spine02': 0.25, 'neck': 0.75}
        slz = P['shoulder_line_z']
        pts = [(-0.105, 0.015, slz - 0.030),
               (-0.082, 0.098, slz + 0.004),
               (0.000, 0.128, slz + 0.022),
               (0.082, 0.098, slz + 0.004),
               (0.105, 0.015, slz - 0.030)]
        tubes = [0.036, 0.042, 0.046, 0.042, 0.036]
        rings = []
        for i, ((x, y, z), rt) in enumerate(zip(pts, tubes)):
            w = w_mid if 0 < i < 4 else w_end
            rings.append(ellipse_ring(x, y, z, rt, rt * 0.82, w, n=12))
        bridge_chain(rings,
                     ['hoodie_shadow', 'hoodie_red', 'hoodie_shadow', 'hoodie_red'],
                     rects)
        cap(rings[0], 'hoodie_shadow', rects)
        cap(rings[-1], 'hoodie_red', rects)
    build_hood_collar()

    # NOTE: no back accessory (bag/strap) -- the tricolour bands are the
    # mandatory back graphic and nothing may partially occlude them, even
    # from a dead-on rear angle. The wristband stays: wrist-only, never
    # over the torso.

    # ---------------- finalize mesh
    # v11r3: remap bib panel UVs continuously into the dedicated AA-painted
    # 'bib_back' atlas cell (u across the glyph window, v down the panel).
    cx_bb, cy_bb = rects['bib_back']
    span_bb = (CELL - 8) / ATLAS_SIZE
    n_remap = 0
    for f, ck in list(face_color.items()):
        if ck != 'bib_back':
            continue
        n_remap += 1
        for loop in f.loops:
            co = loop.vert.co
            th = math.atan2(co.y, co.x)
            dtc = (th - BIB_THETA_CENTER + math.pi) % (2 * math.pi) - math.pi
            uf = (dtc + BIB_THETA_HALF) / (2 * BIB_THETA_HALF)
            vf = (bib_z1 - co.z) / max(1e-6, bib_z1 - bib_z0)
            # Clamp (never skip): a skipped loop keeps its centred-patch UV,
            # sampling the middle of the glyph -> gold/black smear.
            uf = max(0.0, min(1.0, uf))
            vf = max(0.0, min(1.0, vf))
            loop[uv_layer].uv = (cx_bb + (uf - 0.5) * span_bb,
                                 cy_bb + (0.5 - vf) * span_bb)
    with open(os.path.join(SCRATCH, 'debug.txt'), 'a') as fh:
        fh.write(f"bib_back faces remapped: {n_remap}\n")
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    finalize_shading(bm, rects)
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
    # v11: was 'Closest' -- correct when every face collapsed onto one texel;
    # now that faces sample a patch of painted shading, linear keeps the
    # gradient/noise smooth instead of magnifying single texels.
    tex.interpolation = 'Linear'
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
FPS = 120
CYCLE_FRAMES = 60   # 0.5s at 120fps -- 60 keys/stride so glTF's linear-slerp
# interpolation between keys never has to cover more than a few degrees per
# key (was 15 keys/stride = up to ~29deg/key on the steepest part of
# leg_curve's thigh term, an ~26% angular-velocity discontinuity at every
# key -- limbs visibly changed direction in straight segments instead of
# arcing smoothly). Duration MUST stay CYCLE_FRAMES/FPS == 0.5s exactly --
# the game scrubs this clip's playhead from its own gait phase and any
# duration change desyncs the character.

def clamp01(v): return max(0.0, min(1.0, v))

def _keyed(p, keys):
    """Sample a keyframe list [(p0,v0),...] with cosine easing between keys."""
    for (pa, va), (pb_, vb) in zip(keys, keys[1:]):
        if pa <= p <= pb_:
            t = (p - pa) / max(1e-6, pb_ - pa)
            t = 0.5 - 0.5 * math.cos(math.pi * t)
            return va + (vb - va) * t
    return keys[-1][1]

# Knee flexion keyed explicitly (v11r3): contact hold (~63 deg) eases into
# stance, then SNAPS through toe-off into a deep ~140 deg recovery peak that is
# HELD briefly (plateau keys at 0.58/0.64) -- the old curve smeared the same
# bend across every frame, which read as dead middle frames. Retimed so the
# extremes get held and the passing poses move fast.
_KNEE_KEYS = [(0.00, 1.10), (0.05, 1.06), (0.16, 0.38), (0.38, 0.85),
              (0.58, 2.45), (0.64, 2.40), (0.84, 1.30), (1.00, 1.10)]

def leg_curve(p):
    """p in [0,1): 0 = contact, 0.5 = toe-off, 0.75 = peak recovery lift."""
    th = 2 * math.pi * p
    # v11r3 energy pass: contact thigh ~40 deg FORWARD of vertical, rear
    # thigh ~46 deg BACK at toe-off, plus a sharp tuck bump centred on the
    # passing phase (p=0.25) so BOTH feet leave the ground while the root
    # bob peaks there -> a real airborne frame each half stride.
    # -x on UpLeg = swing forward (rig sign convention, untouched).
    thigh = -0.70 * math.cos(th) + 0.08 * math.cos(2 * th)
    thigh -= 0.30 * math.exp(-(((p - 0.25) / 0.085) ** 2))
    knee = _keyed(p, _KNEE_KEYS)
    ankle = 0.32 * math.sin(th + 0.9) - 0.12
    toe = 0.42 * clamp01(math.sin(th + 0.4)) - 0.14 * clamp01(-math.sin(th - 2.4))
    return thigh, knee, ankle, toe

def arm_curve(p):
    """Same phase convention as the CONTRALATERAL leg (natural cross
    swing). v11r3: shoulder sweeps ~57 deg forward to ~66 deg back and the
    elbow drives +/-16 deg around a locked ~90 deg carry, so the fists punch
    up to CHIN height in front and past the hip behind -- a full graphic
    sprint pump, not a jog."""
    th = 2 * math.pi * p
    shoulder = 1.15 * math.cos(th) - 0.13 * math.cos(2 * th)
    elbow = 1.57 + 0.28 * math.cos(th + 0.35)
    adduct = 0.24 * math.cos(th)
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
        # v11r5 FIST CLEARANCE: frames 2-3 (heel-kick phase) had the
        # rear-swinging fist intersecting the torso panel. Add abduction on
        # each arm ONLY during its own rear swing (cos<0 half of its phase)
        # so the fist sweeps AROUND the hip instead of through it; front
        # swing geometry is untouched.
        extraL = 0.11 * max(0.0, -math.cos(2 * math.pi * pR))
        extraR = 0.11 * max(0.0, -math.cos(2 * math.pi * pL))
        pb['LeftArm'].rotation_euler = (-shL, 0, -0.15 - adL - extraL)
        pb['RightArm'].rotation_euler = (-shR, 0, 0.15 + adR + extraR)
        pb['LeftForeArm'].rotation_euler = (elL, 0, 0)
        pb['RightForeArm'].rotation_euler = (elR, 0, 0)
        # Pronate the fists so the rear camera sees a graphic side/knuckle
        # plane, never the circular end-cap that previously obscured the torso.
        pb['LeftHand'].rotation_euler = (0.08, 0.62, 0.18)
        pb['RightHand'].rotation_euler = (0.08, -0.62, -0.18)

        pb['LeftShoulder'].rotation_euler = (shL * 0.14, 0, -0.03 - adL * 0.07)
        pb['RightShoulder'].rotation_euler = (shR * 0.14, 0, 0.03 + adR * 0.07)

        # hips: vertical bob at 2x stride frequency + forward pitch +
        # counter-twist about the vertical axis -- the biggest single
        # thing separating a good run from a marionette, and (see module
        # amplitude note above) nothing downstream amplifies Hips/Spine
        # rotation for this asset either, so these are baked at the full
        # size they need to read at, not a "boosted later" fraction of it.
        # v11r3 energy pass: bob deepened to ~+/-0.09 m -- lowest at BOTH
        # contact frames, highest at the two passing frames (2x stride
        # frequency). Combined with the leg_curve passing tuck this gives a
        # genuinely airborne frame twice per stride.
        # Hips yaw cut to +/-8 deg and OPPOSED by an equal chest twist
        # (+/-8 deg summed down the spine chain), so the shoulder line
        # counterswings the hip line instead of both twisting the same
        # total amount.
        bob = -0.09 * math.cos(4 * math.pi * p) + 0.010
        twist = 0.14 * math.sin(2 * math.pi * p)
        pb['Hips'].location = (0, 0, bob)
        # Forward lean totalling ~18 deg across hips->spine02: a committed
        # sprint posture (was ~15 deg and read upright).
        pb['Hips'].rotation_euler = (0.09, twist, 0.018 * math.sin(2 * math.pi * p))

        chest_twist = -0.14 * math.sin(2 * math.pi * p)
        pb['Spine'].rotation_euler = (0.11, chest_twist * 0.4, 0)
        pb['Spine01'].rotation_euler = (0.07, chest_twist * 0.7, 0)
        pb['Spine02'].rotation_euler = (0.04, chest_twist, 0)
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
    action.use_fake_user = True
    bpy.context.scene.frame_set(0)
    return action


def bake_idle_cycle(arm_obj):
    """A genuine looping title/ready stance, not a frozen frame of `run`.

    The 2.4 s cycle has slow weight transfer, breathing, hand overlap and a
    small head scan. Authoring keys land at 30 Hz while the scene remains 120
    fps; Blender's glTF exporter may resample Euler rotation curves at scene
    rate when it converts them to quaternion tracks.
    """
    bpy.context.view_layer.objects.active = arm_obj
    arm_obj.animation_data_create()
    action = bpy.data.actions.new('idle')
    # The GLB exporter sees this action in-memory even with zero users, but a
    # saved .blend discards it unless it has a persistent user. Keeping the
    # source file reproducible matters more than relying on one export session.
    action.use_fake_user = True
    arm_obj.animation_data.action = action
    try:
        arm_obj.animation_data.action_slot = action.slots[0] if action.slots else None
    except Exception:
        pass

    pb = arm_obj.pose.bones
    idle_frames = 288
    idle_step = 4
    for frame in range(0, idle_frames + 1, idle_step):
        p = (frame % idle_frames) / idle_frames
        th = 2 * math.pi * p
        breath = math.sin(th)
        weight = math.sin(th + 0.35)
        glance = math.sin(th * 0.5) ** 3
        bpy.context.scene.frame_set(frame)

        pb['Hips'].location = (0.012 * weight, 0, 0.008 + 0.010 * breath)
        pb['Hips'].rotation_euler = (0.025, 0.045 * weight, -0.035 * weight)
        pb['Spine'].rotation_euler = (0.015 + 0.012 * breath, -0.018 * weight, 0.010 * weight)
        pb['Spine01'].rotation_euler = (-0.010 + 0.018 * breath, -0.028 * weight, 0.015 * weight)
        pb['Spine02'].rotation_euler = (-0.018 + 0.010 * breath, -0.035 * weight, 0.020 * weight)
        pb['neck'].rotation_euler = (-0.018 - 0.010 * breath, 0.035 * glance, -0.012 * weight)
        pb['Head'].rotation_euler = (-0.015 - 0.015 * breath, 0.070 * glance, 0.018 * weight)

        # Relaxed asymmetric support: the loaded leg stays long while the free
        # knee and opposite heel breathe, then the weight slowly trades sides.
        left_load = 0.5 + 0.5 * weight
        right_load = 1.0 - left_load
        pb['LeftUpLeg'].rotation_euler = (-0.055 + right_load * 0.055, 0, -0.025)
        pb['RightUpLeg'].rotation_euler = (0.035 - left_load * 0.045, 0, 0.025)
        pb['LeftLeg'].rotation_euler = (0.070 + right_load * 0.100, 0, 0)
        pb['RightLeg'].rotation_euler = (0.055 + left_load * 0.085, 0, 0)
        pb['LeftFoot'].rotation_euler = (0.025 - right_load * 0.045, 0, -0.025)
        pb['RightFoot'].rotation_euler = (0.020 - left_load * 0.040, 0, 0.025)
        pb['LeftToeBase'].rotation_euler = (0.015 * right_load, 0, 0)
        pb['RightToeBase'].rotation_euler = (0.015 * left_load, 0, 0)

        arm_sway = 0.035 * math.sin(th - 0.6)
        pb['LeftShoulder'].rotation_euler = (0.015 + arm_sway, 0, -0.030)
        pb['RightShoulder'].rotation_euler = (-0.010 - arm_sway, 0, 0.030)
        pb['LeftArm'].rotation_euler = (-0.10 + arm_sway, 0, -0.13)
        pb['RightArm'].rotation_euler = (0.08 - arm_sway, 0, 0.11)
        pb['LeftForeArm'].rotation_euler = (0.48 + 0.025 * breath, 0, 0)
        pb['RightForeArm'].rotation_euler = (0.56 - 0.020 * breath, 0, 0)
        pb['LeftHand'].rotation_euler = (0.055, 0.025, 0.045 + 0.018 * breath)
        pb['RightHand'].rotation_euler = (0.070, -0.020, -0.050 - 0.018 * breath)

        for name in ['Hips', 'Spine', 'Spine01', 'Spine02', 'neck', 'Head',
                     'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg',
                     'LeftFoot', 'RightFoot', 'LeftToeBase', 'RightToeBase',
                     'LeftArm', 'RightArm', 'LeftForeArm', 'RightForeArm',
                     'LeftHand', 'RightHand', 'LeftShoulder', 'RightShoulder']:
            bone = pb[name]
            bone.keyframe_insert('rotation_euler', frame=frame)
            if name == 'Hips':
                bone.keyframe_insert('location', frame=frame)

    action.use_cyclic = True if hasattr(action, 'use_cyclic') else None
    action.use_fake_user = True
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
        p = os.path.join(SCRATCH, f'{VERSION}-{name}.png')
        render_to(p)
        renders.append(p)

    # straight-down overhead, rest pose -- the slide-camera silhouette test
    point_cam_overhead(cam_o, (0, 0, 0.9), 3.4)
    p = os.path.join(SCRATCH, f'{VERSION}-rest-overhead.png')
    render_to(p)
    renders.append(p)

    action = bake_run_cycle(arm_obj)
    idle_action = bake_idle_cycle(arm_obj)
    # Gameplay-defining movement lives in the asset, not hand-built mixer
    # tracks in the HTML. Run is dense and explicitly linear; idle keeps its
    # authored soft Bezier breathing curve.
    set_action_linear(action)
    gameplay_actions = bake_gameplay_actions(arm_obj, FPS)
    # Verify the authored ready stance at two opposing weight-shift beats before
    # restoring the sprint for the gameplay-angle sequence below.
    arm_obj.animation_data.action = idle_action
    try:
        arm_obj.animation_data.action_slot = idle_action.slots[0] if idle_action.slots else None
    except Exception:
        pass
    point_cam(cam_o, target, 2.5, 1.55, 180)
    for i, frame in enumerate((0, 144)):
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()
        p = os.path.join(SCRATCH, f'{VERSION}-idle-{i}.png')
        render_to(p)
        renders.append(p)

    # Both actions remain datablocks for ACTIONS export.
    arm_obj.animation_data.action = action
    try:
        arm_obj.animation_data.action_slot = action.slots[0] if action.slots else None
    except Exception:
        pass

    # rear-high run cycle sequence -- the angle the player actually sees
    point_cam(cam_o, target, 2.5, 1.55, 180)
    for i, frac in enumerate([0.0, 0.15, 0.35, 0.5, 0.65, 0.85]):
        frame = frac * CYCLE_FRAMES
        bpy.context.scene.frame_set(int(frame), subframe=frame - int(frame))
        bpy.context.view_layer.update()
        p = os.path.join(SCRATCH, f'{VERSION}-run-{i}.png')
        render_to(p)
        renders.append(p)

    # overhead during a mid-stride running frame -- the hair-cap-from-
    # above test with the body actually in motion, not just standing
    frame = 0.35 * CYCLE_FRAMES
    bpy.context.scene.frame_set(int(frame), subframe=frame - int(frame))
    bpy.context.view_layer.update()
    point_cam_overhead(cam_o, (0, 0, 0.9), 3.4)
    p = os.path.join(SCRATCH, f'{VERSION}-run-overhead.png')
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
    p = os.path.join(SCRATCH, f'{VERSION}-silhouette.png')
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

    tri_count = sum(len(p.vertices) - 2 for p in mesh_obj.data.polygons)
    with open(os.path.join(SCRATCH, 'debug.txt'), 'a') as fh:
        fh.write(f"POLYS {len(mesh_obj.data.polygons)} TRIS {tri_count}\n")
    if RENDER_ONLY:
        print('TRIANGLES', tri_count)
        print('VERTS', len(mesh_obj.data.vertices))
        print('RENDERS', renders)
        return

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
        export_force_sampling=False,
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

    print('TRIANGLES', tri_count)
    print('VERTS', len(mesh_obj.data.vertices))
    print('RENDERS', renders)
    print('GLB', OUT_GLB)

main()
