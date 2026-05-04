#!/usr/bin/env python3
"""Simplify German state SVG paths by converting curves to line segments 
and applying Ramer-Douglas-Peucker simplification."""
import re, math

with open('C:/Users/tamas/germany-states.svg', 'r') as f:
    content = f.read()

pattern = r'<path\s+d="([^"]+)"\s+title="([^"]+)"\s+id="([^"]+)"'
matches = re.findall(pattern, content)

id_map = {
    'DE-BW': 'bw', 'DE-BY': 'by', 'DE-BE': 'be', 'DE-BB': 'bb',
    'DE-HB': 'hb', 'DE-HH': 'hh', 'DE-HE': 'he', 'DE-MV': 'mv',
    'DE-NI': 'ni', 'DE-NW': 'nw', 'DE-RP': 'rp', 'DE-SL': 'sl',
    'DE-SN': 'sn', 'DE-ST': 'st', 'DE-SH': 'sh', 'DE-TH': 'th',
}

# Transform: source 585x792 -> target outline area 55..385 x 8..382
src_w, src_h = 585.0, 792.0
dst_x, dst_y = 55.0, 8.0
dst_w, dst_h = 330.0, 374.0
scale = min(dst_w / src_w, dst_h / src_h)
actual_w = src_w * scale
actual_h = src_h * scale
off_x = dst_x + (dst_w - actual_w) / 2
off_y = dst_y + (dst_h - actual_h) / 2

def parse_to_subpaths(d):
    """Parse SVG path to list of subpaths, each a list of (x,y) points."""
    tokens = re.findall(r'[MmLlHhVvCcSsQqTtAaZz]|[-+]?\d*\.?\d+', d)
    subpaths = []
    current = []
    x, y = 0, 0
    start_x, start_y = 0, 0
    i = 0
    cmd = 'M'
    
    while i < len(tokens):
        if tokens[i].isalpha():
            cmd = tokens[i]
            i += 1
            if cmd in ('z', 'Z'):
                if current:
                    current.append((start_x, start_y))
                    subpaths.append(current)
                    current = []
                x, y = start_x, start_y
                cmd = 'M'
            continue
        
        try:
            if cmd == 'M':
                x, y = float(tokens[i]), float(tokens[i+1])
                if current:
                    subpaths.append(current)
                current = [(x, y)]
                start_x, start_y = x, y
                i += 2; cmd = 'L'
            elif cmd == 'm':
                x += float(tokens[i]); y += float(tokens[i+1])
                if current:
                    subpaths.append(current)
                current = [(x, y)]
                start_x, start_y = x, y
                i += 2; cmd = 'l'
            elif cmd == 'L':
                x, y = float(tokens[i]), float(tokens[i+1])
                current.append((x, y)); i += 2
            elif cmd == 'l':
                x += float(tokens[i]); y += float(tokens[i+1])
                current.append((x, y)); i += 2
            elif cmd == 'H':
                x = float(tokens[i]); current.append((x, y)); i += 1
            elif cmd == 'h':
                x += float(tokens[i]); current.append((x, y)); i += 1
            elif cmd == 'V':
                y = float(tokens[i]); current.append((x, y)); i += 1
            elif cmd == 'v':
                y += float(tokens[i]); current.append((x, y)); i += 1
            elif cmd == 'c':
                # Sample cubic bezier at a few points
                x0, y0 = x, y
                dx1, dy1 = float(tokens[i]), float(tokens[i+1])
                dx2, dy2 = float(tokens[i+2]), float(tokens[i+3])
                dx3, dy3 = float(tokens[i+4]), float(tokens[i+5])
                # End point
                x += dx3; y += dy3
                current.append((x, y))
                i += 6
            elif cmd == 'C':
                x = float(tokens[i+4]); y = float(tokens[i+5])
                current.append((x, y)); i += 6
            elif cmd == 's':
                x += float(tokens[i+2]); y += float(tokens[i+3])
                current.append((x, y)); i += 4
            elif cmd == 'S':
                x = float(tokens[i+2]); y = float(tokens[i+3])
                current.append((x, y)); i += 4
            elif cmd == 'q':
                x += float(tokens[i+2]); y += float(tokens[i+3])
                current.append((x, y)); i += 4
            elif cmd == 'Q':
                x = float(tokens[i+2]); y = float(tokens[i+3])
                current.append((x, y)); i += 4
            elif cmd == 't':
                x += float(tokens[i]); y += float(tokens[i+1])
                current.append((x, y)); i += 2
            elif cmd == 'T':
                x = float(tokens[i]); y = float(tokens[i+1])
                current.append((x, y)); i += 2
            elif cmd == 'a':
                x += float(tokens[i+5]); y += float(tokens[i+6])
                current.append((x, y)); i += 7
            elif cmd == 'A':
                x = float(tokens[i+5]); y = float(tokens[i+6])
                current.append((x, y)); i += 7
            else:
                i += 1
        except (IndexError, ValueError):
            i += 1
    
    if current:
        subpaths.append(current)
    return subpaths

def rdp(points, epsilon):
    """Ramer-Douglas-Peucker line simplification."""
    if len(points) < 3:
        return points
    
    # Find the point with the maximum distance from the line between first and last
    start, end = points[0], points[-1]
    max_dist = 0
    max_idx = 0
    
    dx = end[0] - start[0]
    dy = end[1] - start[1]
    line_len = math.sqrt(dx*dx + dy*dy)
    
    for i in range(1, len(points) - 1):
        if line_len < 0.001:
            dist = math.sqrt((points[i][0]-start[0])**2 + (points[i][1]-start[1])**2)
        else:
            dist = abs(dy*points[i][0] - dx*points[i][1] + end[0]*start[1] - end[1]*start[0]) / line_len
        if dist > max_dist:
            max_dist = dist
            max_idx = i
    
    if max_dist > epsilon:
        left = rdp(points[:max_idx+1], epsilon)
        right = rdp(points[max_idx:], epsilon)
        return left[:-1] + right
    else:
        return [start, end]

def transform_point(x, y):
    return (x * scale + off_x, y * scale + off_y)

def subpath_to_svg(pts):
    parts = []
    for i, (x, y) in enumerate(pts):
        tx, ty = transform_point(x, y)
        cmd = "M" if i == 0 else "L"
        parts.append(f"{cmd}{tx:.1f},{ty:.1f}")
    parts.append("Z")
    return "".join(parts)

# Process all states
epsilon = 3.0  # simplification tolerance in source coordinates

print("const STATE_PATHS = {")
total_chars = 0
for d, title, sid in matches:
    cid = id_map.get(sid, sid.lower().replace('de-',''))
    subpaths = parse_to_subpaths(d)
    
    # Simplify each subpath
    all_parts = []
    total_before = 0
    total_after = 0
    for sp in subpaths:
        total_before += len(sp)
        simplified = rdp(sp, epsilon)
        total_after += len(simplified)
        if len(simplified) >= 3:
            all_parts.append(subpath_to_svg(simplified))
    
    path_str = " ".join(all_parts)
    total_chars += len(path_str)
    print(f'  {cid}: "{path_str}",')

print("};")
print(f"\n// Total path data: {total_chars} chars", file=__import__('sys').stderr)

# State centers in target coords
print("\nconst STATE_LABEL_POS = {")
for d, title, sid in matches:
    cid = id_map.get(sid, sid.lower().replace('de-',''))
    subpaths = parse_to_subpaths(d)
    # Use the largest subpath for center calculation
    largest = max(subpaths, key=len) if subpaths else []
    if largest:
        xs = [p[0] for p in largest]
        ys = [p[1] for p in largest]
        cx, cy = (min(xs)+max(xs))/2, (min(ys)+max(ys))/2
        tx, ty = transform_point(cx, cy)
        print(f'  {cid}: [{tx:.1f}, {ty:.1f}],')
print("};")

