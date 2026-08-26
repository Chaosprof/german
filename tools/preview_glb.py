"""Render turnaround previews of an arbitrary GLB, normalised to a fixed height.

Used to judge candidate hero assets against each other at the same apparent
size, whatever units they were authored in.
"""
import bpy
import sys
import os
import math
from mathutils import Vector

VIEWS = [('front', 0.0), ('rear34', 205.0), ('side', 90.0)]
TARGET_H = 1.6


def arg(flag, default=None):
    a = sys.argv[sys.argv.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default


def setup(res_x, res_y):
    for o in list(bpy.data.objects):
        if o.type in ('LIGHT', 'CAMERA'):
            bpy.data.objects.remove(o, do_unlink=True)

    def area(name, energy, size, loc, rot):
        d = bpy.data.lights.new(name, 'AREA')
        d.energy = energy
        d.size = size
        o = bpy.data.objects.new(name, d)
        bpy.context.collection.objects.link(o)
        o.location = loc
        o.rotation_euler = tuple(math.radians(v) for v in rot)

    area('key', 90, 2, (1.2, -2.0, 2.4), (55, 0, 28))
    area('fill', 40, 3, (-1.6, -1.0, 1.6), (70, 0, -40))
    area('rim', 55, 2, (0.2, 1.8, 1.7), (-60, 0, 10))
    area('top', 70, 2.5, (0, 0, 3.2), (0, 0, 0))

    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam'))
    bpy.context.collection.objects.link(cam)
    s = bpy.context.scene
    s.camera = cam
    s.render.resolution_x, s.render.resolution_y = res_x, res_y
    try:
        s.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception:
        s.render.engine = 'BLENDER_EEVEE'
    if hasattr(s, 'eevee'):
        s.eevee.taa_render_samples = 24
    s.view_settings.view_transform = 'Standard'
    s.render.image_settings.file_format = 'WEBP'
    s.render.image_settings.quality = 86
    s.world = bpy.data.worlds.new('w')
    s.world.use_nodes = True
    s.world.node_tree.nodes['Background'].inputs[0].default_value = (
        0.09, 0.10, 0.12, 1.0)
    return cam


def main():
    glb = arg('--glb')
    outdir = arg('--outdir')
    tag = arg('--tag', 'preview')
    frame = int(arg('--frame', '0'))
    os.makedirs(outdir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']

    # Normalise height so candidates compare at the same apparent size.
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for m in meshes:
        for c in m.bound_box:
            p = m.matrix_world @ Vector(c)
            for i in range(3):
                lo[i] = min(lo[i], p[i])
                hi[i] = max(hi[i], p[i])
    height = hi.z - lo.z
    scale = TARGET_H / height if height > 1e-6 else 1.0
    print('BOUNDS height=%.3f scale=%.4f tris=%d'
          % (height, scale, sum(len(m.data.loop_triangles)
                                for m in meshes
                                for _ in [m.data.calc_loop_triangles()])))

    roots = [o for o in bpy.context.scene.objects if o.parent is None]
    for r in roots:
        r.scale = tuple(v * scale for v in r.scale)
        r.location = (r.location.x * scale,
                      r.location.y * scale,
                      (r.location.z - lo.z) * scale)

    cam = setup(int(arg('--res', '420')), int(int(arg('--res', '420')) * 1.35))
    bpy.context.scene.frame_set(frame)

    for name, az in VIEWS:
        a = math.radians(az)
        dist = 3.2
        cam.location = (dist * math.sin(a), -dist * math.cos(a), 1.15)
        d = Vector((0, 0, 0.92)) - Vector(cam.location)
        cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        bpy.context.scene.render.filepath = os.path.join(
            outdir, '%s_%s' % (tag, name))
        bpy.ops.render.render(write_still=True)
    print('DONE %s' % tag)


main()
