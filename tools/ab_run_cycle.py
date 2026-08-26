"""Render a phase-matched A/B of two run clips on the same hero rig.

Both clips live in one GLB and share a duration, so frame i of each is the
same point in the cycle. Renders every frame from a rear-3/4 chase angle
(what the game shows) and a side angle (where a run cycle actually reads).
Lighting/camera follow build_hero.py's preview scene so the comparison is
against the same reference the mesh was tuned in.
"""
import bpy
import sys
import math
import os
from mathutils import Vector

CLIPS = ['run_authored', 'run']
VIEWS = [('rear', 195.0), ('side', 90.0)]
STEPS = 20
RES_X, RES_Y = 320, 440


def arg(flag, default=None):
    a = sys.argv[sys.argv.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default


def setup_scene():
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

    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    bpy.context.collection.objects.link(cam)
    scene = bpy.context.scene
    scene.camera = cam
    scene.render.resolution_x = RES_X
    scene.render.resolution_y = RES_Y
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except Exception:
        scene.render.engine = 'BLENDER_EEVEE'
    if hasattr(scene, 'eevee'):
        scene.eevee.taa_render_samples = 16
    scene.view_settings.view_transform = 'Standard'
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.quality = 82
    scene.render.film_transparent = False
    scene.world = bpy.data.worlds.new('w')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs[0].default_value = (0.09, 0.10, 0.12, 1.0)
    return cam


def point_cam(cam, target, dist, height, azimuth_deg):
    az = math.radians(azimuth_deg)
    cam.location = (dist * math.sin(az), -dist * math.cos(az), height)
    d = Vector(target) - Vector(cam.location)
    cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def main():
    glb = arg('--glb')
    outdir = arg('--outdir')
    os.makedirs(outdir, exist_ok=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 120
    bpy.ops.import_scene.gltf(filepath=glb)
    arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    arm.animation_data_create()

    cam = setup_scene()

    for clip in CLIPS:
        act = bpy.data.actions.get(clip)
        if act is None:
            raise SystemExit('missing clip %r; have %s'
                             % (clip, [a.name for a in bpy.data.actions]))
        arm.animation_data.action = act
        try:
            arm.animation_data.action_slot = act.slots[0] if act.slots else None
        except Exception:
            pass
        f0, f1 = act.frame_range
        print('CLIP %s frames %.1f..%.1f' % (clip, f0, f1))

        for view, az in VIEWS:
            point_cam(cam, (0, 0, 0.92), 3.1, 1.15, az)
            for i in range(STEPS):
                # exclusive of the final frame: a loop's last frame repeats
                # the first, which would stall the playback for one tick.
                f = f0 + (f1 - f0) * i / STEPS
                bpy.context.scene.frame_set(int(f), subframe=f - int(f))
                path = os.path.join(outdir, '%s_%s_%02d' % (clip, view, i))
                bpy.context.scene.render.filepath = path
                bpy.ops.render.render(write_still=True)
    print('DONE')


main()
