"""Retarget a Mixamo-skeleton mocap clip onto the Berlin Runner hero rig.

The hero rig (build_hero.py:build_armature) already uses Mixamo bone names,
so the mapping is a rename table. What it does NOT share is the rest pose:
Mixamo binds in a T-pose (arms along +/-X) while the hero binds with arms
straight down (-Z). A plain delta-from-rest transfer therefore drives the
hero's arms a further 90 degrees past "down", i.e. backwards through the
torso. This script corrects for that by aligning the two rest poses first:

  A(b)     = minimal world rotation taking the source rest bone direction
             onto the target rest bone direction  (T-pose -> arms-down)
  vrest    = A(b) @ src_rest       # source rest re-expressed in target pose
  D(b)     = src_pose @ vrest^-1   # true world rotation the bone underwent
  tgt_pose = D(b) @ tgt_rest

At the source's own rest (T-pose) this yields a T-posed target; with the
source's arms hanging (as in a run cycle) it yields the target's rest. Both
ends check out, which is the property a naive transfer lacks.

Source bone DIRECTIONS come from joint head positions, not bone tails: glTF
has no tails, so the importer synthesises them and gets Mixamo exports badly
wrong (every bone arrives pointing +Z with lengths in the thousands). Head
positions are exact. Rest/pose MATRICES are still read straight off the
importer, because D is a difference of two matrices in the same arbitrary
local frame and so is independent of whichever convention it picked.
"""
import bpy
import sys
import math
from mathutils import Vector, Matrix

FPS = 120
PREFIX = 'mixamorig:'

# target bone -> source bone (sans the "mixamorig:" prefix)
BONE_MAP = {
    'Hips': 'Hips', 'Spine': 'Spine', 'Spine01': 'Spine1', 'Spine02': 'Spine2',
    'neck': 'Neck', 'Head': 'Head',
    'LeftShoulder': 'LeftShoulder', 'LeftArm': 'LeftArm',
    'LeftForeArm': 'LeftForeArm', 'LeftHand': 'LeftHand',
    'RightShoulder': 'RightShoulder', 'RightArm': 'RightArm',
    'RightForeArm': 'RightForeArm', 'RightHand': 'RightHand',
    'LeftUpLeg': 'LeftUpLeg', 'LeftLeg': 'LeftLeg',
    'LeftFoot': 'LeftFoot', 'LeftToeBase': 'LeftToeBase',
    'RightUpLeg': 'RightUpLeg', 'RightLeg': 'RightLeg',
    'RightFoot': 'RightFoot', 'RightToeBase': 'RightToeBase',
}

# which child defines a source bone's rest direction (several bones fork)
SRC_CHILD = {
    'Hips': 'Spine', 'Spine': 'Spine1', 'Spine1': 'Spine2', 'Spine2': 'Neck',
    'Neck': 'Head', 'Head': 'HeadTop_End',
    'LeftShoulder': 'LeftArm', 'LeftArm': 'LeftForeArm',
    'LeftForeArm': 'LeftHand', 'LeftHand': 'LeftHandMiddle1',
    'RightShoulder': 'RightArm', 'RightArm': 'RightForeArm',
    'RightForeArm': 'RightHand', 'RightHand': 'RightHandMiddle1',
    'LeftUpLeg': 'LeftLeg', 'LeftLeg': 'LeftFoot',
    'LeftFoot': 'LeftToeBase', 'LeftToeBase': 'LeftToe_End',
    'RightUpLeg': 'RightLeg', 'RightLeg': 'RightFoot',
    'RightFoot': 'RightToeBase', 'RightToeBase': 'RightToe_End',
}


def arg(flag, default=None):
    a = sys.argv[sys.argv.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default


def rot3(m):
    """Orthonormal rotation part of a matrix (drops scale/shear)."""
    return m.to_quaternion().to_matrix()


def import_glb(path):
    before = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    arm = next(o for o in new if o.type == 'ARMATURE')
    return arm, new, [a for a in bpy.data.actions if a not in before_actions]


def pick_action(actions, want):
    """Find an action by name WITHIN one import's actions.

    Both GLBs ship a clip called "run", and bpy.data.actions names are
    unique: the second import lands as "run.001". A global
    bpy.data.actions.get("run") therefore returns the target's authored
    clip, which references no mixamorig bones -- the donor then never
    leaves its rest pose and the whole bake comes out constant.
    """
    for a in actions:
        if a.name == want:
            return a
    for a in actions:
        if a.name.rsplit('.', 1)[0] == want:
            return a
    return None


def assign_action(obj, action):
    obj.animation_data_create()
    obj.animation_data.action = action
    try:
        slots = list(action.slots)
        if slots:
            obj.animation_data.action_slot = slots[0]
    except Exception:
        pass


def src_dir_world(arm, name):
    """Rest direction of a source bone, from joint head positions."""
    b = arm.data.bones[PREFIX + name]
    child = SRC_CHILD.get(name)
    if child and (PREFIX + child) in arm.data.bones:
        d = arm.data.bones[PREFIX + child].head_local - b.head_local
    else:
        d = b.tail_local - b.head_local
    d = rot3(arm.matrix_world) @ d
    return d.normalized() if d.length > 1e-9 else Vector((0, 0, 1))


def tgt_dir_world(arm, name):
    b = arm.data.bones[name]
    d = rot3(arm.matrix_world) @ (b.tail_local - b.head_local)
    return d.normalized() if d.length > 1e-9 else Vector((0, 0, 1))


def main():
    target_glb = arg('--target')
    source_glb = arg('--source')
    src_action = arg('--src-action', 'run')
    out_action = arg('--out-action', 'run')
    rename_old = arg('--rename-old', 'run_authored')
    out_glb = arg('--out')

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS

    tgt_arm, tgt_objs, tgt_actions = import_glb(target_glb)
    src_arm, src_objs, src_actions = import_glb(source_glb)
    print('TARGET rig %s %d bones' % (tgt_arm.name, len(tgt_arm.data.bones)))
    print('SOURCE rig %s %d bones' % (src_arm.name, len(src_arm.data.bones)))

    action = pick_action(src_actions, src_action)
    if action is None:
        raise SystemExit('no source action %r; have %s'
                         % (src_action, [a.name for a in src_actions]))
    print('SOURCE action %r (frames %.1f..%.1f)'
          % (action.name, action.frame_range[0], action.frame_range[1]))

    # Match the duration of the clip being replaced so the A/B is
    # apples-to-apples and nothing downstream re-times.
    old = pick_action(tgt_actions, out_action)
    if old is not None:
        f0o, f1o = old.frame_range
        duration = (f1o - f0o) / FPS
        old.name = rename_old
        old.use_fake_user = True
        print('RENAMED existing %r -> %r (duration %.4fs)'
              % (out_action, rename_old, duration))
    else:
        duration = 0.7
    steps = max(2, int(round(duration * FPS)))

    # ---- rest-pose alignment ------------------------------------------
    TRi = rot3(tgt_arm.matrix_world).inverted()
    align = {}
    for t_name, s_name in BONE_MAP.items():
        sd = src_dir_world(src_arm, s_name)
        td = tgt_dir_world(tgt_arm, t_name)
        align[t_name] = sd.rotation_difference(td).to_matrix()
        print('  align %-14s src(%5.2f,%5.2f,%5.2f) -> tgt(%5.2f,%5.2f,%5.2f) %6.1f deg'
              % (t_name, sd.x, sd.y, sd.z, td.x, td.y, td.z,
                 math.degrees(sd.angle(td))))

    src_rest_w = {t: rot3(src_arm.matrix_world
                          @ src_arm.data.bones[PREFIX + s].matrix_local)
                  for t, s in BONE_MAP.items()}
    tgt_rest_w = {t: rot3(tgt_arm.matrix_world
                          @ tgt_arm.data.bones[t].matrix_local)
                  for t in BONE_MAP}
    vrest_inv = {t: (align[t] @ src_rest_w[t]).inverted() for t in BONE_MAP}

    sw = src_arm.matrix_world
    tw = tgt_arm.matrix_world
    s_hip = (sw @ src_arm.data.bones[PREFIX + 'Hips'].head_local).z
    t_hip = (tw @ tgt_arm.data.bones['Hips'].head_local).z
    hip_scale = (t_hip / s_hip) if abs(s_hip) > 1e-6 else 1.0
    print('HIP HEIGHT src=%.3f tgt=%.3f scale=%.4f' % (s_hip, t_hip, hip_scale))

    # parents before children, so pose_bone.matrix reads a settled head
    order = sorted(BONE_MAP,
                   key=lambda n: len(tgt_arm.data.bones[n].parent_recursive))

    assign_action(src_arm, action)

    for pb in tgt_arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'

    new_action = bpy.data.actions.new(out_action)
    new_action.use_fake_user = True
    assign_action(tgt_arm, new_action)

    f0, f1 = action.frame_range
    src_hips_rest_w = sw @ src_arm.data.bones[PREFIX + 'Hips'].head_local
    tgt_hips_rest = tgt_arm.data.bones['Hips'].head_local.copy()

    for i in range(steps + 1):
        u = i / steps
        sf = f0 + (f1 - f0) * u
        bpy.context.scene.frame_set(int(sf), subframe=sf - int(sf))
        frame = u * duration * FPS

        for pb in tgt_arm.pose.bones:
            pb.matrix_basis.identity()
        bpy.context.view_layer.update()

        for t_name in order:
            s_pb = src_arm.pose.bones[PREFIX + BONE_MAP[t_name]]
            D = rot3(sw @ s_pb.matrix) @ vrest_inv[t_name]
            arm_rot = TRi @ (D @ tgt_rest_w[t_name])

            t_pb = tgt_arm.pose.bones[t_name]
            head = t_pb.matrix.translation.copy()
            if t_name == 'Hips':
                # Vertical bob only. Gameplay owns the collision root, so
                # forward/lateral drift must never enter the clip.
                off = (sw @ s_pb.matrix.translation) - src_hips_rest_w
                head = tgt_hips_rest + Vector((0, 0, off.z * hip_scale))
            t_pb.matrix = Matrix.Translation(head) @ arm_rot.to_4x4()
            bpy.context.view_layer.update()

        # Key every bone, including the unmapped head_end leaf: the mixer
        # drops constant tracks, and a missing Head-chain track is what
        # detaches the head at runtime.
        for pb in tgt_arm.pose.bones:
            pb.keyframe_insert('rotation_quaternion', frame=frame)
        tgt_arm.pose.bones['Hips'].keyframe_insert('location', frame=frame)

        if i % 10 == 0:
            # .head, not .tail: the importer's synthesised source tails are
            # metres long and carry no anatomical meaning.
            sfoot = sw @ src_arm.pose.bones[PREFIX + 'LeftFoot'].head
            tfoot = tw @ tgt_arm.pose.bones['LeftFoot'].tail
            print('  DBG i=%2d srcframe=%6.2f tgtframe=%6.1f '
                  'src_foot=(%.3f,%.3f,%.3f) tgt_foot=(%.3f,%.3f,%.3f)'
                  % (i, sf, frame, sfoot.x, sfoot.y, sfoot.z,
                     tfoot.x, tfoot.y, tfoot.z))

    # LINEAR keys: the glTF exporter would otherwise bake cubic tangents.
    for layer in new_action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                for fc in bag.fcurves:
                    for k in fc.keyframe_points:
                        k.interpolation = 'LINEAR'
    print('BAKED %r %d frames %.4fs' % (out_action, steps + 1, duration))

    # drop the donor before export
    for a in src_actions:
        bpy.data.actions.remove(a)
    for o in src_objs:
        bpy.data.objects.remove(o, do_unlink=True)

    bpy.context.scene.frame_set(0)
    bpy.ops.object.select_all(action='DESELECT')
    for o in tgt_objs:
        if o.name in bpy.data.objects:
            o.select_set(True)
    bpy.context.view_layer.objects.active = tgt_arm

    bpy.ops.export_scene.gltf(
        filepath=out_glb, export_format='GLB', use_selection=True,
        export_animations=True, export_animation_mode='ACTIONS',
        export_force_sampling=False, export_apply=False, export_yup=True,
        export_extras=True, export_skins=True, export_cameras=False,
        export_lights=False, export_materials='EXPORT',
        export_image_format='AUTO',
    )
    print('GLB %s' % out_glb)


main()
