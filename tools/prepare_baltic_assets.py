"""Turn raw Gemini downloads into the textures baltic-runner.html actually wants.

The generator gives us photographs. The game needs tiling textures, alpha
cutouts and clean 2x2 atlases, and Gemini reliably misses all three of those
requirements even when the prompt is explicit about them. This script closes the
gap, and it is idempotent: re-run it after regenerating any single image.

    py -3 tools/prepare_baltic_assets.py

Four transformations, each applied only where it is needed:

1. SEAM REPAIR. A texture that does not wrap shows as a hard line marching down
   the beach at 25 m/s - the single most visible defect this game can have. Each
   tileable is measured (edge discontinuity vs. a typical interior one) and, on
   whichever axis fails, a mirrored copy of the leading edge is ramped over the
   trailing edge. That makes the last row/column exactly equal the first.

2. CHROMA KEY. Cutouts are prompted on solid magenta because prompting for
   transparency makes the model bake a checkerboard. Magenta is keyed out here
   with a despill pass, so no external matting tool is needed.

3. ATLAS RE-GRIDDING. The game samples cutout sheets as an exact 2x2. Gemini
   produced a 2x3 for the clouds and put the four gulls at four different scales.
   Every sprite is segmented, cropped to its own bounding box and re-laid into a
   clean grid at a consistent size.

4. CROP. The foam sheet came back with two stacked surf lips separated by a dead
   band; only the upper one is wanted.
"""

import os

import cv2
import numpy as np
from PIL import Image

DOWNLOADS = os.path.join(os.path.expanduser('~'), 'Downloads')
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   'assets', 'img', 'baltic')

# Gemini's web UI names files by hash, so the mapping has to be recorded by hand
# once. Re-generating an image means updating its hash here.
SOURCE = {
    'sand-dry':          'e2o9dfe2o9dfe2o9',
    'sand-wet':          'dd6d22dd6d22dd6d',
    'sea-surface':       'lpnky3lpnky3lpnk',
    'dune-grass-ground': 'jghqovjghqovjghq',
    'wicker-weave':      'x63r26x63r26x63r',
    'wood-weathered':    'p0qlxkp0qlxkp0ql',
    'canvas-stripe':     'bmy0wabmy0wabmy0',
    'marram-tufts':      'jwuk1ajwuk1ajwuk',
    'gull-atlas':        's47or9s47or9s47o',
    'shell':             'oua938oua938oua9',
    'cloud-sprites':     'u84dztu84dztu84d',
    'panorama-horizon':  '7ghx9g7ghx9g7ghx',
    'foam-strip':        '2ai1x92ai1x92ai1',
    'sky-dome':          'hg0yaghg0yaghg0y',
}


def load(slot):
    for ext in ('.jfif', '.jpg', '.jpeg', '.png', '.webp'):
        p = os.path.join(DOWNLOADS, 'Gemini_Generated_Image_%s%s' % (SOURCE[slot], ext))
        if os.path.exists(p):
            return np.asarray(Image.open(p).convert('RGB'), dtype=np.float32)
    raise SystemExit('missing source for %s (%s)' % (slot, SOURCE[slot]))


# --------------------------------------------------------------- seams ----
def seam_scores(a):
    """(edge discontinuity, typical interior discontinuity) for each axis."""
    h, w = a.shape[:2]
    lr = (np.abs(a[:, 0] - a[:, -1]).mean(), np.abs(a[:, w // 2] - a[:, w // 2 + 1]).mean())
    tb = (np.abs(a[0, :] - a[-1, :]).mean(), np.abs(a[h // 2, :] - a[h // 2 + 1, :]).mean())
    return lr, tb


def wrap_blend(a, axis, frac=0.055):
    """Ramp a mirrored copy of the leading edge over the trailing one.

    The mirror is what guarantees the result: the reversed first N columns end
    on column 0, so after a linear cross-fade the final column *is* column 0 and
    the wrap is exact. Costs a soft mirrored band frac wide, which is invisible
    on organic texture and acceptable even on a regular weave.
    """
    n = max(2, int(a.shape[axis] * frac))
    if axis == 1:
        strip = a[:, :n][:, ::-1]
        w = np.linspace(0.0, 1.0, n)[None, :, None]
        a[:, -n:] = a[:, -n:] * (1 - w) + strip * w
    else:
        strip = a[:n][::-1]
        w = np.linspace(0.0, 1.0, n)[:, None, None]
        a[-n:] = a[-n:] * (1 - w) + strip * w
    return a


def make_tileable(a, both=True):
    lr, tb = seam_scores(a)
    fixed = []
    # 1.6x an interior discontinuity is about where a seam starts being visible
    # in motion; below that, leave the pixels alone.
    if lr[0] > lr[1] * 1.6:
        a = wrap_blend(a, 1); fixed.append('L/R')
    if both and tb[0] > tb[1] * 1.6:
        a = wrap_blend(a, 0); fixed.append('T/B')
    lr2, tb2 = seam_scores(a)
    print('   seams  L/R %5.1f->%5.1f (adj %4.1f)   T/B %5.1f->%5.1f (adj %4.1f)  %s'
          % (lr[0], lr2[0], lr[1], tb[0], tb2[0], tb[1],
             ('repaired ' + '+'.join(fixed)) if fixed else 'already clean'))
    return a


# ----------------------------------------------------------- chroma key ----
def key_magenta(a, soft=70.0):
    """Magenta screen -> RGBA, with despill.

    `min(r, b) - g` is large only where both magenta channels beat green, which
    is true of the backdrop and of nothing in grass, gulls or an amber shell.
    """
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = np.minimum(r, b) - g
    alpha = np.clip(1.0 - (spill - 8.0) / soft, 0.0, 1.0)
    rgb = a.copy()
    # Pull the magenta fringe off kept pixels, or every cutout wears a pink halo.
    excess = np.maximum(0.0, spill) * 0.92
    rgb[..., 0] = np.maximum(0.0, rgb[..., 0] - excess)
    rgb[..., 2] = np.maximum(0.0, rgb[..., 2] - excess)
    out = np.dstack([rgb, alpha * 255.0])
    print('   keyed  opaque coverage %.3f' % (alpha > 0.5).mean())
    return out


# --------------------------------------------------------------- atlas ----
def regrid(img, mask, cells=4, cols=2, align='center', pad=0.06, size=1024, equalise=False):
    """Segment sprites, then re-lay the biggest `cells` of them into a clean grid.

    The game samples these sheets as an exact 2x2. Gemini produced six clouds in
    three rows and four gulls at four different scales, neither of which survives
    that assumption - so the layout is rebuilt here rather than trusted.
    """
    m = (mask > 0.4).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
    n, _lab, stats, _ = cv2.connectedComponentsWithStats(m, 8)
    order = sorted(range(1, n), key=lambda i: -stats[i, cv2.CC_STAT_AREA])[:cells]
    if len(order) < cells:
        print('   regrid SKIPPED - found only %d blobs' % len(order))
        return None
    rows = (cells + cols - 1) // cols
    # Reading order, so the sheet stays predictable between runs. The row key
    # has to bucket by ROW height, not by cell count - dividing by `cells` put
    # four sprites into buckets 0,1,3,3 and scrambled the grid.
    boxes = [tuple(stats[i, :4]) for i in order]
    boxes.sort(key=lambda bb: (int(bb[1] // (img.shape[0] / rows)), bb[0]))

    cw, ch = size // cols, size // rows
    out = np.zeros((size, size, img.shape[2]), np.float32)
    inner_w, inner_h = int(cw * (1 - 2 * pad)), int(ch * (1 - 2 * pad))
    # Frames of one animation must not change size between cells, or the bird
    # pulses as the game cycles the atlas. Gemini returned wingspans from 387 to
    # 986 px, so equalise on sprite AREA - the best available proxy for 'the
    # same bird' when the bounding box changes shape every frame - then apply
    # one global factor so the biggest result still fits its cell.
    scales = [1.0] * len(boxes)
    if equalise:
        areas = [stats[i, cv2.CC_STAT_AREA] for i in order]
        target = float(np.median(areas))
        scales = [(target / a) ** 0.5 for a in areas]
        worst = max(max(w * sc / inner_w, h * sc / inner_h)
                    for (x, y, w, h), sc in zip(boxes, scales))
        if worst > 1.0:
            scales = [sc / worst for sc in scales]
    for k, (x, y, w, h) in enumerate(boxes):
        crop = img[y:y + h, x:x + w]
        s = scales[k] if equalise else min(inner_w / w, inner_h / h)
        nw, nh = max(1, int(w * s)), max(1, int(h * s))
        crop = cv2.resize(crop, (nw, nh), interpolation=cv2.INTER_AREA)
        cx, cy = (k % cols) * cw, (k // cols) * ch
        ox = cx + (cw - nw) // 2
        # Grass tufts grow from the bottom edge of their quad, so they are
        # bottom-aligned; a gull or a cloud is centred in open air.
        oy = cy + (ch - nh - int(ch * pad)) if align == 'bottom' else cy + (ch - nh) // 2
        out[oy:oy + nh, ox:ox + nw] = crop
    print('   regrid %d sprites -> %dx%d grid at %d px' % (len(boxes), cols, rows, size))
    return out


# ----------------------------------------------------- panorama framing ----
def recentre_panorama(a):
    """Roll the strip so its subject faces the runner.

    Only about 19% of a 360-degree ring is on screen at once, dead ahead, so
    whatever the panorama is *about* has to be put there or it is never seen.

    Centring on "green pixels near the horizon" was the obvious idea and it is
    wrong: on a chalk-cliff panorama that finds the low green headlands at the
    far edges rather than the white cliff in the middle, and rolls the subject
    straight out of view. Centre on STRUCTURE instead - the busiest part of the
    image is the part worth looking at, whatever colour it happens to be.
    """
    h, w = a.shape[:2]
    lum = a.mean(axis=2)
    # Vertical detail per column, over the sky-and-land band only: open water
    # has its own texture and would otherwise vote.
    band = lum[int(h * 0.05):int(h * 0.66)]
    col = np.abs(np.diff(band, axis=0)).mean(axis=0)
    col = np.maximum(0.0, col - np.percentile(col, 35))
    if col.max() <= 1e-6:
        print('   framing: no subject found, left as generated')
        return a
    ang = np.arange(w) / w * 2 * np.pi
    wgt = col ** 2
    centre = (np.arctan2((wgt * np.sin(ang)).sum(),
                         (wgt * np.cos(ang)).sum()) % (2 * np.pi)) / (2 * np.pi)
    shift = int(round((0.5 - centre) * w))
    print('   framing: subject at u=%.3f -> rolled %+d px to centre it' % (centre, shift))
    return np.roll(a, shift, axis=1)


def trim_foreground(a):
    """Cut the near beach off the bottom of a panorama.

    The backdrop is a distant cylinder, so any foreground the generator paints
    into it lands on top of the real beach and reads as a second shoreline
    hanging in mid-air. Find the waterline by walking up from the bottom until
    the row stops being warm sand and starts being cool water, and cut there.
    """
    h = a.shape[0]
    warm = (a[..., 0] - a[..., 2]).mean(axis=1)      # sand is red>blue, sea is blue>red
    cut = h
    for r in range(h - 1, int(h * 0.55), -1):
        if warm[r] < 0:                               # first cool row from the bottom
            cut = r
            break
    cut = max(int(h * 0.60), min(h, cut))
    print('   foreground: kept top %.0f%% (cut %d of %d rows)' % (100 * cut / h, h - cut, h))
    return a[:cut]


def save(slot, a, size=None, wide=None, jpeg=False, quality=92):
    a = np.clip(a, 0, 255).astype(np.uint8)
    im = Image.fromarray(a, 'RGBA' if a.shape[2] == 4 else 'RGB')
    if wide:
        im = im.resize(wide, Image.LANCZOS)
    elif size:
        im = im.resize((size, size), Image.LANCZOS)
    if jpeg:
        p = os.path.join(OUT, slot + '.jpg')
        im.convert('RGB').save(p, quality=quality, optimize=True, progressive=True)
    else:
        p = os.path.join(OUT, slot + '.png')
        im.save(p, optimize=True)
    print('   -> %s  %dx%d  %.1f MB' % (os.path.basename(p), im.width, im.height,
                                        os.path.getsize(p) / 1048576))


def main():
    os.makedirs(OUT, exist_ok=True)

    # --- tiling ground and prop textures -----------------------------------
    for slot in ['sand-dry', 'sand-wet', 'sea-surface', 'dune-grass-ground',
                 'wicker-weave', 'wood-weathered', 'canvas-stripe']:
        print(slot)
        save(slot, make_tileable(load(slot)), size=1024)

    # --- the painted far field ---------------------------------------------
    print('panorama-horizon')
    # Left and right edges are open sea by construction and the game force-blends
    # the seam anyway, so this one only needs its foreground trimmed, its subject
    # centred, and a resample that PRESERVES ASPECT - squashing a 21:9 panorama
    # into an 8:1 strip was the whole reason the first one fell flat.
    pano = trim_foreground(recentre_panorama(load('panorama-horizon')))
    ph, pw = pano.shape[0], pano.shape[1]
    tw = 3072
    save('panorama-horizon', pano, wide=(tw, max(2, int(round(tw * ph / pw)))), jpeg=True)

    print('sky-dome')
    save('sky-dome', load('sky-dome'), wide=(2048, 1144))

    # --- the surf line ------------------------------------------------------
    print('foam-strip')
    f = load('foam-strip')
    # Two surf lips came back stacked with a dead band between them; taking the
    # upper 56% leaves exactly one lip dissolving landward, which is the shape
    # the shoreline ribbon maps.
    f = f[:int(f.shape[0] * 0.56)]
    f = make_tileable(f, both=False)
    save('foam-strip', f, wide=(2048, max(2, int(2048 * f.shape[0] / f.shape[1]))))

    # --- alpha cutouts ------------------------------------------------------
    print('marram-tufts')
    a = key_magenta(load('marram-tufts'))
    save('marram-tufts', regrid(a, a[..., 3] / 255.0, align='bottom'), None)

    print('gull-atlas')
    a = key_magenta(load('gull-atlas'))
    save('gull-atlas', regrid(a, a[..., 3] / 255.0, align='center', equalise=True), None)

    print('shell')
    save('shell', key_magenta(load('shell')), size=512)

    # --- luminance-keyed clouds --------------------------------------------
    print('cloud-sprites')
    c = load('cloud-sprites')
    # Six clouds in three rows; the game samples a 2x2, so take the four largest
    # and re-lay them. Stays RGB - the game keys these by luminance in lumaKey().
    save('cloud-sprites', regrid(c, c.mean(axis=2) / 255.0, align='center'), None)

    print('\ndone -> %s' % OUT)


if __name__ == '__main__':
    main()
