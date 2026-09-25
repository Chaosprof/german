"""Quantise packed Blender mesh records for the page (V152 vehicles).

Positions become int16 about a per-record centre/half-extent (0.15 mm steps on a
10 m tram) and UVs become uint16 over their own range (0.03 texel on a 2048
atlas). decodeBerlinMeshRecord expands both back to float32 at load, so the
GPU data is unchanged; only the page's base64 shrinks.
"""
import base64
import numpy as np


def _b64(arr):
    return base64.b64encode(np.ascontiguousarray(arr).tobytes()).decode()


def quantize_record(rec):
    pos = np.frombuffer(base64.b64decode(rec['position']), dtype='<f4').reshape(-1, 3).astype(np.float64)
    lo, hi = pos.min(0), pos.max(0)
    center = (lo + hi) / 2
    half = np.maximum((hi - lo) / 2, 1e-6)
    q = np.clip(np.round((pos - center) / half * 32767), -32767, 32767).astype('<i2')
    out = {k: v for k, v in rec.items() if k not in ('position', 'uv')}
    out['positionQ'] = _b64(q)
    out['qCenter'] = [float(round(v, 6)) for v in center]
    out['qHalf'] = [float(round(v, 6)) for v in half]
    # Store the rounded constants back so decode(err) is measured against them.
    c = np.array(out['qCenter']); hlf = np.array(out['qHalf'])
    err = np.abs(c + q.astype(np.float64) * hlf / 32767 - pos).max()
    if 'uv' in rec:
        uv = np.frombuffer(base64.b64decode(rec['uv']), dtype='<f4').reshape(-1, 2).astype(np.float64)
        ulo, uhi = uv.min(0), uv.max(0)
        rng = np.maximum(uhi - ulo, 1e-9)
        uq = np.clip(np.round((uv - ulo) / rng * 65535), 0, 65535).astype('<u2')
        out['uvQ'] = _b64(uq)
        out['uvMin'] = [float(v) for v in ulo]
        out['uvRange'] = [float(v) for v in rng]
    return out, float(err)


def quantize_meshes(meshes):
    worst = 0.0
    out = {}
    for name, rec in meshes.items():
        out[name], err = quantize_record(rec)
        worst = max(worst, err)
    return out, worst
