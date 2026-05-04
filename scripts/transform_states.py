#!/usr/bin/env python3
"""Transform German state SVG paths to campaign map coordinates.
Source: MapSVG germany.svg (585x792, CC0)
Target: Campaign map viewBox, outline fits x:55..385, y:8..382
"""
import re

with open('C:/Users/tamas/germany-states.svg', 'r') as f:
    content = f.read()

pattern = r'<path\s+d="([^"]+)"\s+title="([^"]+)"\s+id="([^"]+)"'
matches = re.findall(pattern, content)

# Source bounds (from the SVG): approximately 0..585 x 0..792
# Target: we want to map to the same coordinate space as our Germany outline
# Our outline: x:55..385, y:8..382 (width=330, height=374)
# Source: x:0..585, y:0..792

src_w, src_h = 585.0, 792.0
# Target area (same as the outline transform)
dst_x, dst_y = 55.0, 8.0
dst_w, dst_h = 330.0, 374.0

# Scale uniformly
scale = min(dst_w / src_w, dst_h / src_h)
# Center the result
actual_w = src_w * scale
actual_h = src_h * scale
off_x = dst_x + (dst_w - actual_w) / 2
off_y = dst_y + (dst_h - actual_h) / 2

print(f"// Scale={scale:.4f}, offset=({off_x:.1f},{off_y:.1f})")
print(f"// Actual size: {actual_w:.1f}x{actual_h:.1f}")

# We need to transform all path coordinates
# Instead of parsing and reconstructing (complex with all SVG commands),
# we'll use SVG's transform attribute approach:
# transform="translate(off_x, off_y) scale(scale)"
# But since these paths use 'm' (relative moveto) as first command,
# we need to handle the absolute starting position

# Actually, the simpler approach: we can apply the transform as a CSS/SVG transform
# on a <g> group, which avoids having to rewrite path data at all!

# Map state IDs to our campaign state IDs
id_map = {
    'DE-BW': 'bw', 'DE-BY': 'by', 'DE-BE': 'be', 'DE-BB': 'bb',
    'DE-HB': 'hb', 'DE-HH': 'hh', 'DE-HE': 'he', 'DE-MV': 'mv',
    'DE-NI': 'ni', 'DE-NW': 'nw', 'DE-RP': 'rp', 'DE-SL': 'sl',
    'DE-SN': 'sn', 'DE-ST': 'st', 'DE-SH': 'sh', 'DE-TH': 'th',
}

print(f"\n// SVG transform to apply to the state paths group:")
print(f'// <g transform="translate({off_x:.2f},{off_y:.2f}) scale({scale:.5f})">')

# Output the state paths as a JS object
print("\nconst STATE_PATHS = {")
for d, title, sid in matches:
    cid = id_map.get(sid, sid.lower().replace('de-',''))
    # Clean up the path: remove unnecessary "0,0" segments
    clean_d = d.replace('\n', ' ').strip()
    print(f'  {cid}: "{clean_d}",')
print("};")

# Also compute label positions (centers) in target coordinates
print("\n// State label positions (centers) in target coordinates:")
print("const STATE_CENTERS = {")

def get_path_points(d):
    """Get all points from a path (approximate)."""
    tokens = re.findall(r'[MmLlHhVvCcSsQqTtAaZz]|[-+]?\d*\.?\d+', d)
    points = []
    x, y = 0, 0
    i = 0
    cmd = 'M'
    while i < len(tokens):
        if tokens[i].isalpha():
            cmd = tokens[i]
            i += 1
            continue
        try:
            if cmd == 'M':
                x, y = float(tokens[i]), float(tokens[i+1]); i += 2; cmd = 'L'
            elif cmd == 'm':
                x += float(tokens[i]); y += float(tokens[i+1]); i += 2; cmd = 'l'
            elif cmd == 'L':
                x, y = float(tokens[i]), float(tokens[i+1]); i += 2
            elif cmd == 'l':
                x += float(tokens[i]); y += float(tokens[i+1]); i += 2
            elif cmd == 'H': x = float(tokens[i]); i += 1
            elif cmd == 'h': x += float(tokens[i]); i += 1
            elif cmd == 'V': y = float(tokens[i]); i += 1
            elif cmd == 'v': y += float(tokens[i]); i += 1
            elif cmd == 'c':
                x += float(tokens[i+4]); y += float(tokens[i+5]); i += 6
            elif cmd == 'C':
                x = float(tokens[i+4]); y = float(tokens[i+5]); i += 6
            elif cmd == 's':
                x += float(tokens[i+2]); y += float(tokens[i+3]); i += 4
            elif cmd == 'S':
                x = float(tokens[i+2]); y = float(tokens[i+3]); i += 4
            elif cmd == 'q':
                x += float(tokens[i+2]); y += float(tokens[i+3]); i += 4
            elif cmd in ('z', 'Z'):
                continue
            else:
                i += 1; continue
        except (IndexError, ValueError):
            i += 1; continue
        points.append((x, y))
    return points

for d, title, sid in matches:
    cid = id_map.get(sid, sid.lower().replace('de-',''))
    pts = get_path_points(d)
    if pts:
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        # Use centroid of bounding box
        cx = (min(xs) + max(xs)) / 2
        cy = (min(ys) + max(ys)) / 2
        # Transform to target coords
        tx = cx * scale + off_x
        ty = cy * scale + off_y
        print(f'  {cid}: [{tx:.1f}, {ty:.1f}],')

print("};")

