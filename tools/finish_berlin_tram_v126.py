"""Compose the V126 tram atlas and write the shipping tram data.

python tools/finish_berlin_tram_v126.py        (Python with numpy + PIL)

Reads audit/berlin-tram-v126/build/{parts.json,bake_*.npy} written by
tools/stage_berlin_tram_v126.py (Blender) and writes
audit/berlin-tram-v126/models/berlin-vintage-tram-v90.{json,inline.js} plus
atlas previews. Albedo = baked colour x softened AO, encoded sRGB JPEG; the
ORM map keeps roughness in G and metalness in B (three.js channel layout).
"""
import base64, io, json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit' / 'berlin-tram-v126'
BUILD, OUT = STAGE / 'build', STAGE / 'models'
PREFIX = 'berlin-vintage-tram-v90'

parts = json.loads((BUILD / 'parts.json').read_text())
albedo = np.load(BUILD / 'bake_albedo.npy')[::-1, :, :3]   # Blender rows are bottom-up
ao = np.load(BUILD / 'bake_ao.npy')[::-1, :, 0]
orm = np.load(BUILD / 'bake_orm.npy')[::-1, :, :3]

# Soft AO: creases and the cabin fall to ~55%, open panels stay near 100%.
ao = np.clip(ao, 0, 1)
shade = 0.52 + 0.48 * ao ** 0.8
lin = np.clip(albedo * shade[..., None], 0, 1)
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
alb_img.save(STAGE / 'atlas-albedo.jpg', quality=90, subsampling=0)
orm_img.save(STAGE / 'atlas-orm.png')

old = json.loads((ROOT / 'assets/models' / (PREFIX + '.json')).read_text())
data = {
    'source': 'Blender 5.2 / tools/stage_berlin_tram_v126.py + tools/finish_berlin_tram_v126.py',
    'finishRevision': 'reference-coach-v126',
    'collisionContract': old['collisionContract'],
    'renderBounds': parts['renderBounds'],
    'textures': {'albedo': alb_uri, 'orm': orm_uri, 'albedoSize': list(alb_img.size), 'ormSize': list(orm_img.size)},
    'parts': parts['parts'],
    'meshes': parts['meshes'],
}
raw = json.dumps(data, separators=(',', ':'))
(OUT / (PREFIX + '.json')).write_text(raw)
(OUT / (PREFIX + '.inline.js')).write_text('var BERLIN_VINTAGE_TRAM_DATA = ' + raw + ';\n')
report = {'triangles': parts['triangles'], 'meshes': {k: v['triangles'] for k, v in parts['meshes'].items()},
          'albedoJpegBytes': alb_bytes, 'ormPngBytes': orm_bytes, 'jsonBytes': len(raw),
          'aoMean': float(ao.mean()), 'bounds': parts['renderBounds']}
(STAGE / 'build-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
