"""Bring a Meshy image-to-3D character down to a web game budget.

Meshy ships ~376k triangles across ~98 disconnected shells with a 2048 albedo.
The game's current procedural hero is 47k triangles; a stylised runner wants
far less than that. This strips the snowboard, joins the shells and decimates
to a target triangle count, keeping UVs so the painted texture survives.
"""
import bpy
import sys
import os
from mathutils import Vector


def arg(flag, default=None):
    a = sys.argv[sys.argv.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default


def part_bounds(o):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for v in o.data.vertices:
        p = o.matrix_world @ v.co
        for i in range(3):
            lo[i] = min(lo[i], p[i])
            hi[i] = max(hi[i], p[i])
    return lo, hi


def main():
    glb = arg('--glb')
    out = arg('--out')
    target = int(arg('--target', '18000'))
    drop_board = arg('--keep-board') is None

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']

    bpy.ops.object.select_all(action='DESELECT')
    for m in meshes:
        m.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active

    # Split into shells so the board can be identified geometrically.
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.separate(type='LOOSE')
    bpy.ops.object.mode_set(mode='OBJECT')
    parts = [o for o in bpy.context.scene.objects if o.type == 'MESH']

    all_lo = Vector((1e9, 1e9, 1e9))
    all_hi = Vector((-1e9, -1e9, -1e9))
    for p in parts:
        lo, hi = part_bounds(p)
        for i in range(3):
            all_lo[i] = min(all_lo[i], lo[i])
            all_hi[i] = max(all_hi[i], hi[i])
    height = all_hi.z - all_lo.z

    removed = 0
    if drop_board:
        for p in list(parts):
            lo, hi = part_bounds(p)
            # The board reads as a thin plate sitting under the boots. A boot
            # shell rises to mid-calf, so its z-extent is far too large to
            # match `flat` -- the width test the first version also required
            # was what let the board's mid-section survive and then deform
            # with the feet.
            flat = (hi.z - lo.z) < 0.14 * height
            low = hi.z < all_lo.z + 0.16 * height
            if flat and low:
                p.data.calc_loop_triangles()
                removed += len(p.data.loop_triangles)
                bpy.data.objects.remove(p, do_unlink=True)
                parts.remove(p)
        print('BOARD removed %d tris across shells' % removed)

    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = 'MeshyHero'

    obj.data.calc_loop_triangles()
    before = len(obj.data.loop_triangles)

    # Weld before decimating. This matters far more than the triangle saving:
    # a mesh left as ~98 free-floating shells skins badly, because bone heat
    # treats each shell independently and neighbouring sleeve fragments end up
    # on different bones -- which tears the arms apart the moment they swing.
    # The threshold is a fraction of body height, not an absolute, so it
    # travels to characters exported at other scales.
    weld = float(arg('--weld', '0.004')) * height
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=weld)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.data.calc_loop_triangles()
    welded = len(obj.data.loop_triangles)

    mod = obj.modifiers.new('dec', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.use_collapse_triangulate = True
    mod.ratio = min(1.0, target / max(1, welded))
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.calc_loop_triangles()
    after = len(obj.data.loop_triangles)
    print('TRIS %d -> welded %d -> %d (ratio %.4f)'
          % (before, welded, after, mod.ratio))

    bpy.ops.object.shade_smooth()

    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB', use_selection=True,
        export_animations=False, export_apply=False, export_yup=True,
        export_materials='EXPORT', export_image_format='AUTO',
    )
    print('GLB %s  %.2f MB' % (out, os.path.getsize(out) / 1e6))


main()
