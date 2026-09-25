"""Compose the V152 tram atlas and write the shipping tram data.

python tools/finish_berlin_tram_v152.py        (Python 3.11 with numpy + PIL)

Reads audit/berlin-vehicles-v152/tram/build/{parts.json,bake_*.npy} written by
tools/stage_berlin_tram_v152.py (Blender) and writes
audit/berlin-vehicles-v152/tram/models/berlin-reference-tram-v152.{json,inline.js}.
Albedo = baked colour x softened AO, encoded as an sRGB JPEG. The surface map
keeps the clearcoat mask in R, roughness in G and metalness in B, so one
texture feeds three.js' clearcoatMap (.r), roughnessMap (.g) and
metalnessMap (.b).
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
STAGE = ROOT / 'audit' / 'berlin-vehicles-v152' / 'tram'
BUILD, OUT = STAGE / 'build', STAGE / 'models'
PREFIX = 'berlin-reference-tram-v152'
OUT.mkdir(parents=True, exist_ok=True)

parts = json.loads((BUILD / 'parts.json').read_text())
albedo = np.load(BUILD / 'bake_albedo.npy')[::-1, :, :3]   # Blender rows are bottom-up
ao = np.load(BUILD / 'bake_ao.npy')[::-1, :, 0]
orm = np.load(BUILD / 'bake_orm.npy')[::-1, :, :3]

# Soft AO: panel creases, window reveals and the underbody fall to ~45 %, open
# panels stay near 100 %. The ground term darkens the skirt toward the street.
ao = soften(np.clip(ao, 0, 1))
shade = 0.44 + 0.56 * ao ** 0.85
lin = np.clip(albedo * shade[..., None], 0, 1)
srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
alb_img = Image.fromarray(np.clip(srgb * 255 + .5, 0, 255).astype(np.uint8), 'RGB')
orm_img = Image.fromarray(np.clip(orm * 255 + .5, 0, 255).astype(np.uint8), 'RGB')


def data_uri(img, fmt, **kw):
    buf = io.BytesIO()
    img.save(buf, fmt, **kw)
    mime = 'image/jpeg' if fmt == 'JPEG' else 'image/png'
    return 'data:%s;base64,%s' % (mime, base64.b64encode(buf.getvalue()).decode()), len(buf.getvalue())


alb_uri, alb_bytes = data_uri(alb_img, 'JPEG', quality=86, subsampling=2, optimize=True)
orm_uri, orm_bytes = data_uri(orm_img, 'PNG', optimize=True)
alb_img.save(STAGE / 'atlas-albedo.jpg', quality=88, subsampling=0)
orm_img.save(STAGE / 'atlas-orm.png')

sys.path.insert(0, str(Path(__file__).resolve().parent))
from berlin_mesh_quantize_v152 import quantize_meshes
QMESHES, QERR = quantize_meshes(parts['meshes'])
print('quantised positions, worst error %.6f m' % QERR)
assert QERR < 5e-4, QERR
data = {
    'source': 'Blender 5.2 / tools/stage_berlin_tram_v152.py + tools/finish_berlin_tram_v152.py',
    'finishRevision': 'reference-kt4-v152',
    'collisionContract': {'halfW': 1.25, 'halfD': 4, 'yMin': 0, 'yMax': 3.15},
    'renderBounds': parts['renderBounds'],
    'textures': {'albedo': alb_uri, 'surface': orm_uri, 'albedoSize': list(alb_img.size), 'surfaceSize': list(orm_img.size)},
    'parts': parts['parts'],
    'meshes': QMESHES,
}
raw = json.dumps(data, separators=(',', ':'))
(OUT / (PREFIX + '.json')).write_text(raw)
(OUT / (PREFIX + '.inline.js')).write_text('var BERLIN_REFERENCE_TRAM_DATA = ' + raw + ';\n')
report = {'triangles': parts['triangles'], 'meshes': {k: v['triangles'] for k, v in parts['meshes'].items()},
          'albedoJpegBytes': alb_bytes, 'surfacePngBytes': orm_bytes, 'jsonBytes': len(raw),
          'aoMean': float(ao.mean()), 'bounds': parts['renderBounds']}
(STAGE / 'build-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
