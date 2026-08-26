"""Bundle the Baltic textures into a data-URI companion so the game works offline.

A double-clicked `file://` page cannot use the generated art at all. three.js
requests textures with `crossOrigin='anonymous'`, and Chrome answers:

    Access to image at 'file:///.../sand-dry.png' from origin 'null' has been
    blocked by CORS policy: Cross origin requests are only supported for
    protocol schemes: chrome, chrome-extension, chrome-untrusted, data, http,
    https, isolated-app.

So every slot silently falls back to its procedural canvas and the beach loses
its photography, its dune and its painted cliffs. Dropping `crossOrigin` is not
a fix either: the panorama is drawn into a canvas and read back, and a canvas
tainted by a file:// image throws on getImageData and on WebGL upload.

`data:` is on that allow-list, which is why berlin-runner.html ships its hero the
same way. This writes `assets/img/baltic/baltic-assets.inline.js`, which the game
pulls in via document.write on file:// only - a served build keeps the small,
separately cacheable files and pays nothing.

    py -3 tools/inline_baltic_assets.py
"""

import base64
import io
import os

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(HERE, 'assets', 'img', 'baltic')
OUT = os.path.join(IMG, 'baltic-assets.inline.js')

# slot -> (file, needs_alpha, max_width)
# Alpha cutouts must stay PNG. Everything else is photographic and goes to JPEG,
# which is what keeps the bundle at a few MB instead of twenty-five.
ASSETS = [
    ('sand',         'sand-dry.png',          False, 1024),
    ('sandWet',      'sand-wet.png',          False, 1024),
    ('sea',          'sea-surface.png',       False, 1024),
    ('dune',         'dune-grass-ground.png', False, 1024),
    ('wicker',       'wicker-weave.png',      False, 1024),
    ('wood',         'wood-weathered.png',    False, 1024),
    ('canvasStripe', 'canvas-stripe.png',     False, 1024),
    ('sky',          'sky-dome.png',          False, 2048),
    ('panorama',     'panorama-horizon.jpg',  False, 3072),
    ('foam',         'foam-strip.png',        False, 2048),
    ('cloud',        'cloud-sprites.png',     False, 1024),
    ('grass',        'marram-tufts.png',      True,   768),
    ('gull',         'gull-atlas.png',        True,   768),
    ('shell',        'shell.png',             True,   512),
]

JPEG_Q = 93


def seam_error(im):
    """Edge discontinuity vs. a typical interior one, both axes.

    Re-encoding a tiling texture is the one place lossy compression can actually
    break something: the seam repair made the last column exactly equal the
    first, and JPEG perturbs them independently. Measure it rather than hope.
    """
    a = np.asarray(im.convert('RGB'), dtype=np.float32)
    h, w = a.shape[:2]
    lr = np.abs(a[:, 0] - a[:, -1]).mean(), np.abs(a[:, w // 2] - a[:, w // 2 + 1]).mean()
    tb = np.abs(a[0, :] - a[-1, :]).mean(), np.abs(a[h // 2, :] - a[h // 2 + 1, :]).mean()
    return lr, tb


TILEABLE = {'sand', 'sandWet', 'sea', 'dune', 'wicker', 'wood', 'canvasStripe'}


def repair_seams(im):
    """Re-run the mirror blend at the FINAL resolution.

    prepare_baltic_assets.py repairs seams on the full-size source, but the
    ratio that matters - edge discontinuity against a typical interior one -
    changes when the image is downscaled, because adjacent-pixel differences
    shrink faster than the edge does. sand-wet passed at 2048 and failed at
    1024. Repairing here, on the pixels that actually ship, is what closes that.
    """
    a = np.asarray(im.convert('RGB'), dtype=np.float32)
    fixed = []
    for axis in (1, 0):
        lr, tb = seam_error(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)))
        edge, adj = (lr if axis == 1 else tb)
        if edge > adj * 1.5:
            n = max(2, int(a.shape[axis] * 0.055))
            if axis == 1:
                strip = a[:, :n][:, ::-1]
                wgt = np.linspace(0.0, 1.0, n)[None, :, None]
                a[:, -n:] = a[:, -n:] * (1 - wgt) + strip * wgt
            else:
                strip = a[:n][::-1]
                wgt = np.linspace(0.0, 1.0, n)[:, None, None]
                a[-n:] = a[-n:] * (1 - wgt) + strip * wgt
            fixed.append('L/R' if axis == 1 else 'T/B')
    if not fixed:
        return im, ''
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)), ' repaired ' + '+'.join(fixed)


def main():
    parts, total = [], 0
    for slot, name, alpha, maxw in ASSETS:
        path = os.path.join(IMG, name)
        if not os.path.exists(path):
            print('  skip %-13s (missing %s)' % (slot, name))
            continue
        im = Image.open(path)
        if im.width > maxw:
            im = im.resize((maxw, max(1, round(im.height * maxw / im.width))), Image.LANCZOS)

        repaired = ''
        if slot in TILEABLE:
            im, repaired = repair_seams(im)

        buf = io.BytesIO()
        if alpha:
            im.convert('RGBA').save(buf, format='PNG', optimize=True)
            mime = 'image/png'
        else:
            im.convert('RGB').save(buf, format='JPEG', quality=JPEG_Q,
                                   optimize=True, progressive=False)
            mime = 'image/jpeg'
        blob = buf.getvalue()
        total += len(blob)

        note = ''
        if slot in TILEABLE:
            before = seam_error(Image.open(path))
            after = seam_error(Image.open(io.BytesIO(blob)))
            note = '  seam L/R %.1f->%.1f (adj %.1f)  T/B %.1f->%.1f (adj %.1f)' % (
                before[0][0], after[0][0], after[0][1],
                before[1][0], after[1][0], after[1][1])
            bad = after[0][0] > after[0][1] * 1.6 or after[1][0] > after[1][1] * 1.6
            if bad:
                note += '   *** SEAM OPENED - drop this slot back to PNG ***'
            note += repaired

        print('  %-13s %-22s %5.0f KB%s' % (slot, mime.split('/')[1],
                                            len(blob) / 1024, note))
        parts.append("  %s: 'data:%s;base64,%s'" %
                     (slot, mime, base64.b64encode(blob).decode('ascii')))

    header = (
        "'use strict';\n"
        "// Generated by tools/inline_baltic_assets.py - do not edit.\n"
        "// Loaded only on file://, where Chrome's CORS policy blocks every local\n"
        "// image but allows data: URIs.\n"
        "globalThis.BALTIC_ASSETS = {\n"
    )
    io.open(OUT, 'w', encoding='utf-8').write(header + ',\n'.join(parts) + '\n};\n')
    print('\n  -> %s' % os.path.basename(OUT))
    print('  raw %.1f MB, file %.1f MB' % (total / 1048576, os.path.getsize(OUT) / 1048576))


if __name__ == '__main__':
    main()
