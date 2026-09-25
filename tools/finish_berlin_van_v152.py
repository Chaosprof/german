"""Compose the V152 van atlas and write the shipping van data.

python tools/finish_berlin_van_v152.py        (Python 3.11 with numpy + PIL)

Reads audit/berlin-vehicles-v152/van/build/{parts.json,bake_body_*.npy} from
tools/stage_berlin_van_v152.py (Blender) and writes
audit/berlin-vehicles-v152/van/models/berlin-reference-van-v152.{json,inline.js}.
Albedo = baked colour x softened AO (sRGB JPEG); the surface map packs
clearcoat (R), roughness (G) and metalness (B).
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
STAGE = ROOT / 'audit' / 'berlin-vehicles-v152' / 'van'
BUILD, OUT = STAGE / 'build', STAGE / 'models'
PREFIX = 'berlin-reference-van-v152'
OUT.mkdir(parents=True, exist_ok=True)
parts = json.loads((BUILD / 'parts.json').read_text())
albedo = np.load(BUILD / 'bake_body_albedo.npy')[::-1, :, :3]
ao = soften(np.clip(np.load(BUILD / 'bake_body_ao.npy')[::-1, :, 0], 0, 1))
orm = np.clip(np.load(BUILD / 'bake_body_orm.npy')[::-1, :, :3], 0, 1)
lin = np.clip(albedo * (0.42 + 0.58 * ao ** 0.85)[..., None], 0, 1)
srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
alb_img = Image.fromarray(np.clip(srgb * 255 + .5, 0, 255).astype(np.uint8), 'RGB')
orm_img = Image.fromarray(np.clip(orm * 255 + .5, 0, 255).astype(np.uint8), 'RGB')


def data_uri(img, fmt, **kw):
    buf = io.BytesIO()
    img.save(buf, fmt, **kw)
    mime = 'image/jpeg' if fmt == 'JPEG' else 'image/png'
    return 'data:%s;base64,%s' % (mime, base64.b64encode(buf.getvalue()).decode()), len(buf.getvalue())


alb_uri, alb_bytes = data_uri(alb_img, 'JPEG', quality=90, subsampling=0, optimize=True)
orm_uri, orm_bytes = data_uri(orm_img, 'PNG', optimize=True)
alb_img.save(STAGE / 'atlas-albedo.jpg', quality=90)
orm_img.save(STAGE / 'atlas-surface.png')
sys.path.insert(0, str(Path(__file__).resolve().parent))
from berlin_mesh_quantize_v152 import quantize_meshes
QMESHES, QERR = quantize_meshes(parts['meshes'])
print('quantised positions, worst error %.6f m' % QERR)
assert QERR < 5e-4, QERR
data = {
    'source': 'Blender 5.2 / tools/stage_berlin_van_v152.py + tools/finish_berlin_van_v152.py',
    'finishRevision': 'reference-barkas-v152',
    'collisionContract': {'halfW': 1.0, 'halfD': 2.1, 'yMin': 0, 'yMax': 1.95},
    'renderBounds': parts['renderBounds'],
    'textures': {'albedo': alb_uri, 'surface': orm_uri},
    'parts': parts['parts'],
    'meshes': QMESHES,
}
raw = json.dumps(data, separators=(',', ':'))
(OUT / (PREFIX + '.json')).write_text(raw)
(OUT / (PREFIX + '.inline.js')).write_text('var BERLIN_REFERENCE_VAN_DATA = ' + raw + ';\n')
report = {'triangles': parts['triangles'], 'meshes': {k: v['triangles'] for k, v in parts['meshes'].items()},
          'albedoJpegBytes': alb_bytes, 'surfacePngBytes': orm_bytes, 'jsonBytes': len(raw),
          'aoMean': float(ao.mean()), 'bounds': parts['renderBounds']}
(STAGE / 'build-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
