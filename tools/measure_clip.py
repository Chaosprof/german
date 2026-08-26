"""Measure per-joint range of motion for each clip in a GLB.

Eyeballing a single frame cannot distinguish "wrong phase" from "no motion",
so report the world-space travel of the diagnostic joints over a full cycle.
"""
import bpy
import sys

JOINTS = ['LeftFoot', 'RightFoot', 'LeftHand', 'RightHand',
          'LeftLeg', 'LeftArm', 'Spine02', 'Head', 'Hips']
STEPS = 24


def arg(flag, default=None):
    a = sys.argv[sys.argv.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 120
    bpy.ops.import_scene.gltf(filepath=arg('--glb'))
    arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    arm.animation_data_create()

    for clip in (arg('--clips') or 'run,run_authored').split(','):
        act = bpy.data.actions.get(clip)
        if act is None:
            print('MISSING %s' % clip)
            continue
        arm.animation_data.action = act
        try:
            arm.animation_data.action_slot = act.slots[0] if act.slots else None
        except Exception:
            pass
        f0, f1 = act.frame_range
        lo = {j: [1e9] * 3 for j in JOINTS}
        hi = {j: [-1e9] * 3 for j in JOINTS}
        for i in range(STEPS):
            f = f0 + (f1 - f0) * i / STEPS
            bpy.context.scene.frame_set(int(f), subframe=f - int(f))
            for j in JOINTS:
                p = arm.matrix_world @ arm.pose.bones[j].tail
                for c in range(3):
                    lo[j][c] = min(lo[j][c], p[c])
                    hi[j][c] = max(hi[j][c], p[c])
        print('CLIP %s  (%.0f..%.0f)' % (clip, f0, f1))
        for j in JOINTS:
            span = [hi[j][c] - lo[j][c] for c in range(3)]
            print('   %-12s travel x=%.3f y=%.3f z=%.3f' % (j, *span))


main()
