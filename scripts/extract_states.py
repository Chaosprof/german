#!/usr/bin/env python3
"""Extract German state paths from MapSVG SVG and transform to campaign map coords."""
import re
import sys

with open('C:/Users/tamas/germany-states.svg', 'r') as f:
    content = f.read()

# Extract path elements with their id and d attributes
# Format: <path d="..." title="..." id="DE-XX" .../>
pattern = r'<path\s+d="([^"]+)"\s+title="([^"]+)"\s+id="([^"]+)"'
matches = re.findall(pattern, content)

print(f"Found {len(matches)} states")

# Source SVG viewBox: width=585.5141, height=792.66785
# We need to transform these to our campaign map coordinate system
# Campaign map viewBox: "35 -5 370 400" => x: 35..405, y: -5..395
# Our outline fits in roughly x: 55..385, y: 7.6..382.4

# Let's find the bounding box of all state paths first
# We need a simple approach - parse the starting M coordinates and relative moves

def get_path_bounds(d):
    """Get approximate bounding box by parsing path commands."""
    tokens = re.findall(r'[MmLlHhVvCcSsQqTtAaZz]|[-+]?\d*\.?\d+', d)
    x, y = 0, 0
    min_x, min_y = float('inf'), float('inf')
    max_x, max_y = float('-inf'), float('-inf')
    i = 0
    cmd = 'M'
    start_x, start_y = 0, 0
    
    while i < len(tokens):
        if tokens[i].isalpha():
            cmd = tokens[i]
            i += 1
            continue
        try:
            if cmd == 'M':
                x, y = float(tokens[i]), float(tokens[i+1])
                start_x, start_y = x, y
                i += 2; cmd = 'L'
            elif cmd == 'm':
                x += float(tokens[i]); y += float(tokens[i+1])
                start_x, start_y = x, y
                i += 2; cmd = 'l'
            elif cmd == 'L':
                x, y = float(tokens[i]), float(tokens[i+1]); i += 2
            elif cmd == 'l':
                x += float(tokens[i]); y += float(tokens[i+1]); i += 2
            elif cmd == 'H':
                x = float(tokens[i]); i += 1
            elif cmd == 'h':
                x += float(tokens[i]); i += 1
            elif cmd == 'V':
                y = float(tokens[i]); i += 1
            elif cmd == 'v':
                y += float(tokens[i]); i += 1
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
            elif cmd == 'Q':
                x = float(tokens[i+2]); y = float(tokens[i+3]); i += 4
            elif cmd == 't':
                x += float(tokens[i]); y += float(tokens[i+1]); i += 2
            elif cmd == 'T':
                x = float(tokens[i]); y = float(tokens[i+1]); i += 2
            elif cmd == 'a':
                x += float(tokens[i+5]); y += float(tokens[i+6]); i += 7
            elif cmd == 'A':
                x = float(tokens[i+5]); y = float(tokens[i+6]); i += 7
            elif cmd in ('z', 'Z'):
                x, y = start_x, start_y; i += 0
                # don't increment - z doesn't consume tokens
                # but we need to avoid infinite loop if next token isn't a command
                break  # just break on z for simplicity
            else:
                i += 1
                continue
        except (IndexError, ValueError):
            i += 1
            continue
            
        min_x = min(min_x, x); max_x = max(max_x, x)
        min_y = min(min_y, y); max_y = max(max_y, y)
    
    return min_x, min_y, max_x, max_y

# Find overall bounds
all_min_x, all_min_y = float('inf'), float('inf')
all_max_x, all_max_y = float('-inf'), float('-inf')

for d, title, sid in matches:
    bx1, by1, bx2, by2 = get_path_bounds(d)
    all_min_x = min(all_min_x, bx1)
    all_min_y = min(all_min_y, by1)
    all_max_x = max(all_max_x, bx2)
    all_max_y = max(all_max_y, by2)
    cx = (bx1+bx2)/2
    cy = (by1+by2)/2
    print(f"  {sid:6s} {title:30s} bounds=({bx1:.0f},{by1:.0f})-({bx2:.0f},{by2:.0f}) center=({cx:.0f},{cy:.0f})")

print(f"\nOverall bounds: ({all_min_x:.1f},{all_min_y:.1f})-({all_max_x:.1f},{all_max_y:.1f})")
print(f"Size: {all_max_x-all_min_x:.1f} x {all_max_y-all_min_y:.1f}")

