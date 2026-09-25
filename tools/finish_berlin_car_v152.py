"""Compose the V152 car textures and write the shipping car data.

python tools/finish_berlin_car_v152.py        (Python 3.11 with numpy + PIL)

Reads audit/berlin-vehicles-v152/car/build/{parts.json,bake_*.npy} written by
tools/stage_berlin_car_v152.py (Blender) and writes
audit/berlin-vehicles-v152/car/models/berlin-reference-car-v152.{json,inline.js}.
  paint:   white x softened AO (sRGB JPEG). The runtime multiplies it by the
           car colour (material colour, or instanceColor for pooled traffic).
  trim:    baked colour x softened AO (sRGB JPEG).
  surface: clearcoat (R), roughness (G), metalness (B) for the trim atlas.
"""
import base64, io, json, sys
from pathlib import Path
import numpy as np
from PIL import Image


def soften(a, sigma=1.1):
    """Separable Gaussian on a baked AO map: removes Cycles grain (it read as
    streaks on the paint) and helps the JPEG; UV islands carry 8 px padding."""
    r = int(3 * sigma + .5)
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k /= k.sum()
    p = np.pad(a, r, mode='edge')
    p = sum(k[i] * p[:, i:i + a.shape[1]] for i in range(2 * r + 1))
    return sum(k[i] * p[i:i + a.shape[0], :] for i in range(2 * r + 1))

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit' / 'berlin-vehicles-v152' / 'car'
BUILD, OUT = STAGE / 'build', STAGE / 'models'
PREFIX = 'berlin-reference-car-v152'
OUT.mkdir(parents=True, exist_ok=True)
parts = json.loads((BUILD / 'parts.json').read_text())


def load(key):
    return np.load(BUILD / ('bake_%s.npy' % key))[::-1]   # Blender rows are bottom-up


def to_srgb(lin):
    lin = np.clip(lin, 0, 1)
    return np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)


def img(arr):
    return Image.fromarray(np.clip(arr * 255 + .5, 0, 255).astype(np.uint8), 'RGB')


def data_uri(im, fmt, **kw):
    buf = io.BytesIO()
    im.save(buf, fmt, **kw)
    mime = 'image/jpeg' if fmt == 'JPEG' else 'image/png'
    return 'data:%s;base64,%s' % (mime, base64.b64encode(buf.getvalue()).decode()), len(buf.getvalue())


paint_ao = soften(np.clip(load('paint_ao')[:, :, 0], 0, 1))
paint_shade = 0.40 + 0.60 * paint_ao ** 0.85
paint_img = img(np.repeat(to_srgb(paint_shade)[..., None], 3, axis=2))
trim_ao = soften(np.clip(load('trim_ao')[:, :, 0], 0, 1))
trim_alb = load('trim_albedo')[:, :, :3]
trim_img = img(to_srgb(trim_alb * (0.42 + 0.58 * trim_ao ** 0.85)[..., None]))
surf_img = img(np.clip(load('trim_orm')[:, :, :3], 0, 1))

paint_uri, paint_bytes = data_uri(paint_img, 'JPEG', quality=90, subsampling=0, optimize=True)
trim_uri, trim_bytes = data_uri(trim_img, 'JPEG', quality=90, subsampling=0, optimize=True)
surf_uri, surf_bytes = data_uri(surf_img, 'PNG', optimize=True)
paint_img.save(STAGE / 'atlas-paint.jpg', quality=90)
trim_img.save(STAGE / 'atlas-trim.jpg', quality=90)
surf_img.save(STAGE / 'atlas-surface.png')

sys.path.insert(0, str(Path(__file__).resolve().parent))
from berlin_mesh_quantize_v152 import quantize_meshes
QMESHES, QERR = quantize_meshes(parts['meshes'])
print('quantised positions, worst error %.6f m' % QERR)
assert QERR < 5e-4, QERR
data = {
    'source': 'Blender 5.2 / tools/stage_berlin_car_v152.py + tools/finish_berlin_car_v152.py',
    'finishRevision': 'reference-trabant-v152',
    'collisionContract': {'halfW': 1.0, 'halfD': 2.1, 'yMin': 0, 'yMax': 1.95},
    'renderBounds': parts['renderBounds'],
    'textures': {'paint': paint_uri, 'trim': trim_uri, 'surface': surf_uri},
    'parts': parts['parts'],
    'meshes': QMESHES,
}
raw = json.dumps(data, separators=(',', ':'))
(OUT / (PREFIX + '.json')).write_text(raw)
(OUT / (PREFIX + '.inline.js')).write_text('var BERLIN_REFERENCE_CAR_DATA = ' + raw + ';\n')
report = {'triangles': parts['triangles'], 'meshes': {k: v['triangles'] for k, v in parts['meshes'].items()},
          'paintJpegBytes': paint_bytes, 'trimJpegBytes': trim_bytes, 'surfacePngBytes': surf_bytes,
          'jsonBytes': len(raw), 'paintAoMean': float(paint_ao.mean()), 'bounds': parts['renderBounds']}
(STAGE / 'build-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
