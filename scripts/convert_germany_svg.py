#!/usr/bin/env python3
"""Convert the detailed Germany SVG into a single path for the campaign map.
Target viewBox: "40 -5 350 400" — so usable area roughly x:50..380, y:0..390
State nodes range: x:90..350, y:32..360
"""
import re

with open('C:/Users/tamas/germany.svg', 'r') as f:
    content = f.read()

paths = re.findall(r'<path d="([^"]+)"', content)

def parse_path_to_points(d):
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
        if cmd == 'M':
            x, y = float(tokens[i]), float(tokens[i+1])
            points.append((x, y))
            i += 2; cmd = 'L'
        elif cmd == 'm':
            x += float(tokens[i]); y += float(tokens[i+1])
            points.append((x, y))
            i += 2; cmd = 'l'
        elif cmd == 'L':
            x, y = float(tokens[i]), float(tokens[i+1])
            points.append((x, y)); i += 2
        elif cmd == 'l':
            x += float(tokens[i]); y += float(tokens[i+1])
            points.append((x, y)); i += 2
        elif cmd == 'H':
            x = float(tokens[i]); points.append((x, y)); i += 1
        elif cmd == 'h':
            x += float(tokens[i]); points.append((x, y)); i += 1
        elif cmd == 'V':
            y = float(tokens[i]); points.append((x, y)); i += 1
        elif cmd == 'v':
            y += float(tokens[i]); points.append((x, y)); i += 1
        elif cmd == 'c':
            x += float(tokens[i+4]); y += float(tokens[i+5])
            points.append((x, y)); i += 6
        elif cmd == 'C':
            x = float(tokens[i+4]); y = float(tokens[i+5])
            points.append((x, y)); i += 6
        elif cmd in ('z', 'Z'):
            i += 1
        else:
            i += 1
    return points

# Parse and transform all paths
all_paths_raw = []
for p in paths:
    pts = parse_path_to_points(p)
    # Apply SVG transform: scale(0.1, -0.1) translate(0, 1024)
    transformed = [(x * 0.1, 1024 - y * 0.1) for x, y in pts]
    all_paths_raw.append(transformed)

# Get bounds from main outline
main = all_paths_raw[0]
xs = [p[0] for p in main]
ys = [p[1] for p in main]
min_x, max_x = min(xs), max(xs)
min_y, max_y = min(ys), max(ys)
w = max_x - min_x
h = max_y - min_y

# Target: state nodes are at x:90..350, y:32..360
# So the outline should be slightly larger, say x:55..385, y:5..385
# That's 330 wide, 380 tall
target_w = 330
target_h = 380
margin_x = 55
margin_y = 5

scale = min(target_w / w, target_h / h)
# Center it
actual_w = w * scale
actual_h = h * scale
off_x = margin_x + (target_w - actual_w) / 2
off_y = margin_y + (target_h - actual_h) / 2

def transform_pts(pts):
    return [((x - min_x) * scale + off_x, (y - min_y) * scale + off_y) for x, y in pts]

def simplify(pts, min_dist=1.5):
    result = [pts[0]]
    for p in pts[1:]:
        dx = p[0] - result[-1][0]
        dy = p[1] - result[-1][1]
        if dx*dx + dy*dy >= min_dist*min_dist:
            result.append(p)
    return result

def make_path(pts):
    parts = []
    for i, (x, y) in enumerate(pts):
        cmd = "M" if i == 0 else "L"
        parts.append(f"{cmd}{x:.1f},{y:.1f}")
    parts.append("Z")
    return "".join(parts)

# Main outline
final_main = simplify(transform_pts(main), 1.5)
path_str = make_path(final_main)

# Islands (only ones with >4 points, i.e., visible)
island_paths = []
for i in range(1, len(all_paths_raw)):
    pts = transform_pts(all_paths_raw[i])
    if len(pts) > 4:
        simplified = simplify(pts, 1.0)
        island_paths.append(make_path(simplified))

# Combine into single path
full_path = path_str
for ip in island_paths:
    full_path += " " + ip

print(f"Main: {len(final_main)} pts, Islands: {len(island_paths)}")
print(f"Total path length: {len(full_path)} chars")

# Check bounds
all_final = transform_pts(main)
fxs = [p[0] for p in all_final]
fys = [p[1] for p in all_final]
print(f"Final bounds: x=[{min(fxs):.1f}, {max(fxs):.1f}], y=[{min(fys):.1f}, {max(fys):.1f}]")

print(f"\n{full_path}")
