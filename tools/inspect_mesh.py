"""Report a GLB's loose parts, bounds and texture set.

Meshy exports one fused mesh, so "is the snowboard removable" is really
"is it a separate loose shell". Answer that before planning any surgery.
"""
import bpy
import sys
from mathutils import Vector


def arg(flag, default=None):
    a = sys.argv[sys.argv.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default


def bounds(o):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for c in o.bound_box:
        p = o.matrix_world @ Vector(c)
        for i in range(3):
            lo[i] = min(lo[i], p[i])
            hi[i] = max(hi[i], p[i])
    return lo, hi


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=arg('--glb'))
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']

    for m in meshes:
        for slot in m.material_slots:
            mat = slot.material
            if not mat or not mat.use_nodes:
                continue
            print('MATERIAL %s' % mat.name)
            for node in mat.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image:
                    outs = [l.to_socket.name
                            for o in node.outputs for l in o.links]
                    print('   tex %-22s %dx%d -> %s'
                          % (node.image.name, node.image.size[0],
                             node.image.size[1], ','.join(outs) or '?'))

    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE')
    bpy.ops.object.mode_set(mode='OBJECT')

    parts = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    print('LOOSE PARTS: %d' % len(parts))
    rows = []
    for p in parts:
        p.data.calc_loop_triangles()
        lo, hi = bounds(p)
        rows.append((len(p.data.loop_triangles), lo, hi, p.name))
    rows.sort(reverse=True, key=lambda r: r[0])
    for tris, lo, hi, name in rows[:14]:
        print('  %7d tris  z=%6.3f..%6.3f  x=%6.3f..%6.3f  y=%6.3f..%6.3f  %s'
              % (tris, lo.z, hi.z, lo.x, hi.x, lo.y, hi.y, name))


main()
