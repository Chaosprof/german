"""Move every clip from the Berlin Runner hero rig onto a Meshy-rigged mesh.

Meshy's auto-rig emits the same 23 bone names the game keys off, but two
things stop this being a copy:

  * The spine chain is numbered the other way round. On the hero rig it runs
    Hips -> Spine -> Spine01 -> Spine02 -> shoulders; on Meshy's it runs
    Hips -> Spine02 -> Spine01 -> Spine -> shoulders. Matching on name alone
    would drive the upper spine with the lower spine's curve. The chain is
    therefore walked from the shoulder parent down to Hips on each rig and
    mapped positionally.

  * The rest poses differ -- Meshy binds a true A-pose (arms ~45 degrees out
    and down), the hero binds arms straight down. So clips are retargeted
    through the same rest-alignment used for the mocap import, not copied.

Bone directions come from joint head positions on BOTH rigs here: glTF has no
tails, so the Meshy rig arrives with synthesised ones (lengths in the
thousands). Leaf bones -- hands, toes, head_end -- have no child to point at
and inherit their parent's alignment instead.
"""
import bpy
import sys
import os
from mathutils import Vector, Matrix

FPS = 120
LIMBS = [
    ['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand'],
    ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'],
    ['LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase'],
    ['RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'],
]


def arg(flag, default=None):
    a = sys.argv[sys.argv.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default


def rot3(m):
    return m.to_quaternion().to_matrix()


def import_glb(path):
    before = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    return new, [a for a in bpy.data.actions if a not in before_actions]


def spine_chain(arm):
    """Spine bones from the one parented to Hips up to the shoulder parent."""
    chain = []
    b = arm.data.bones['LeftShoulder'].parent
    while b is not None and b.name != 'Hips':
        chain.append(b.name)
        b = b.parent
    chain.reverse()
    return chain


def build_maps(src, tgt):
    """target bone -> source bone, plus each rig's primary-child chain."""
    s_chain, t_chain = spine_chain(src), spine_chain(tgt)
    if len(s_chain) != len(t_chain):
        raise SystemExit('spine chains differ in length: %s vs %s'
                         % (s_chain, t_chain))
    print('SPINE src %s' % ' -> '.join(['Hips'] + s_chain))
    print('SPINE tgt %s' % ' -> '.join(['Hips'] + t_chain))

    bone_map = {'Hips': 'Hips', 'neck': 'neck', 'Head': 'Head',
                'head_end': 'head_end'}
    for t, s in zip(t_chain, s_chain):
        bone_map[t] = s
    for limb in LIMBS:
        for name in limb:
            bone_map[name] = name

    def child_of(chain):
        c = {'Hips': chain[0], 'neck': 'Head', 'Head': 'head_end'}
        for i, n in enumerate(chain):
            c[n] = chain[i + 1] if i + 1 < len(chain) else 'neck'
        for limb in LIMBS:
            for i, n in enumerate(limb[:-1]):
                c[n] = limb[i + 1]
        return c

    return bone_map, child_of(s_chain), child_of(t_chain)


def bone_dir(arm, name, child):
    """World-space rest direction, from the child's head where one exists."""
    b = arm.data.bones[name]
    if child and child in arm.data.bones:
        d = arm.data.bones[child].head_local - b.head_local
    else:
        d = b.tail_local - b.head_local
    d = rot3(arm.matrix_world) @ d
    return d.normalized() if d.length > 1e-9 else None


def decimate(obj, target, weld_frac=0.004):
    zs = [(obj.matrix_world @ v.co).z for v in obj.data.vertices]
    height = max(zs) - min(zs)
    obj.data.calc_loop_triangles()
    before = len(obj.data.loop_triangles)

    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=weld_frac * height)
    bpy.ops.object.mode_set(mode='OBJECT')
    obj.data.calc_loop_triangles()
    welded = len(obj.data.loop_triangles)

    mod = obj.modifiers.new('dec', 'DECIMATE')
    mod.decimate_type = 'COLLAPSE'
    mod.use_collapse_triangulate = True
    mod.ratio = min(1.0, target / max(1, welded))
    # Decimate must run before the armature deform, or applying it bakes the
    # current pose. Vertex groups survive a collapse, so the skin is kept.
    bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.calc_loop_triangles()
    print('TRIS %d -> welded %d -> %d' % (before, welded,
                                          len(obj.data.loop_triangles)))


def main():
    src_glb = arg('--source')
    tgt_glb = arg('--target')
    out = arg('--out')
    target_tris = int(arg('--tris', '18000'))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = FPS

    tgt_objs, tgt_actions = import_glb(tgt_glb)
    tgt = next(o for o in tgt_objs if o.type == 'ARMATURE')
    mesh = next(o for o in tgt_objs if o.type == 'MESH')
    for a in tgt_actions:          # Meshy's own walk/run clips
        bpy.data.actions.remove(a)

    decimate(mesh, target_tris)

    src_objs, src_actions = import_glb(src_glb)
    src = next(o for o in src_objs if o.type == 'ARMATURE')
    for o in list(src_objs):
        if o.type == 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
            src_objs.remove(o)

    bone_map, s_child, t_child = build_maps(src, tgt)
    bone_map = {t: s for t, s in bone_map.items()
                if t in tgt.data.bones and s in src.data.bones}
    print('MAPPED %d bones' % len(bone_map))

    # Rest alignment, parents first so leaves can inherit.
    order = sorted(bone_map,
                   key=lambda n: len(tgt.data.bones[n].parent_recursive))
    align, inherited = {}, []
    for t_name in order:
        sd = bone_dir(src, bone_map[t_name], s_child.get(bone_map[t_name]))
        td = bone_dir(tgt, t_name, t_child.get(t_name))
        if sd is None or td is None:
            parent = tgt.data.bones[t_name].parent
            align[t_name] = align.get(parent.name if parent else '',
                                      Matrix.Identity(3))
            inherited.append(t_name)
        else:
            align[t_name] = sd.rotation_difference(td).to_matrix()
    if inherited:
        print('ALIGN inherited from parent: %s' % ', '.join(inherited))

    s_rest = {t: rot3(src.matrix_world
                      @ src.data.bones[bone_map[t]].matrix_local)
              for t in bone_map}
    t_rest = {t: rot3(tgt.matrix_world @ tgt.data.bones[t].matrix_local)
              for t in bone_map}
    vrest_inv = {t: (align[t] @ s_rest[t]).inverted() for t in bone_map}

    sw, tw = src.matrix_world, tgt.matrix_world
    TRi = rot3(tw).inverted()
    s_hip = (sw @ src.data.bones['Hips'].head_local)
    t_hip = (tw @ tgt.data.bones['Hips'].head_local)
    hip_scale = (t_hip.z / s_hip.z) if abs(s_hip.z) > 1e-6 else 1.0
    print('HIP src=%.3f tgt=%.3f scale=%.4f' % (s_hip.z, t_hip.z, hip_scale))

    for pb in tgt.pose.bones:
        pb.rotation_mode = 'QUATERNION'
    src.animation_data_create()
    tgt.animation_data_create()

    made = []
    for act in sorted(src_actions, key=lambda a: a.name):
        src.animation_data.action = act
        try:
            if act.slots:
                src.animation_data.action_slot = act.slots[0]
        except Exception:
            pass
        f0, f1 = act.frame_range
        steps = max(2, int(round(f1 - f0)))

        # Named later: while the source action of the same name is still
        # loaded, bpy.data.actions.new() uniquifies to "run.001", and the
        # game matches clip names exactly.
        new = bpy.data.actions.new('__rt__' + act.name)
        new.use_fake_user = True
        made.append((new, act.name))
        tgt.animation_data.action = new
        try:
            if new.slots:
                tgt.animation_data.action_slot = new.slots[0]
        except Exception:
            pass

        for i in range(steps + 1):
            f = f0 + (f1 - f0) * i / steps
            bpy.context.scene.frame_set(int(f), subframe=f - int(f))
            for pb in tgt.pose.bones:
                pb.matrix_basis.identity()
            bpy.context.view_layer.update()

            for t_name in order:
                s_pb = src.pose.bones[bone_map[t_name]]
                D = rot3(sw @ s_pb.matrix) @ vrest_inv[t_name]
                arm_rot = TRi @ (D @ t_rest[t_name])
                t_pb = tgt.pose.bones[t_name]
                head = t_pb.matrix.translation.copy()
                if t_name == 'Hips':
                    # Full offset, not just the bob: the lane-cut clips carry
                    # real lateral Hips motion the game reads as additive.
                    off = (sw @ s_pb.matrix.translation) - s_hip
                    head = (tgt.data.bones['Hips'].head_local
                            + TRi @ (off * hip_scale))
                t_pb.matrix = Matrix.Translation(head) @ arm_rot.to_4x4()
                bpy.context.view_layer.update()

            for pb in tgt.pose.bones:
                pb.keyframe_insert('rotation_quaternion', frame=i)
            tgt.pose.bones['Hips'].keyframe_insert('location', frame=i)

        for layer in new.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        for k in fc.keyframe_points:
                            k.interpolation = 'LINEAR'
        print('  clip %-26s %d frames' % (act.name, steps + 1))

    for a in src_actions:
        bpy.data.actions.remove(a)
    for new, name in made:
        new.name = name
    for o in src_objs:
        if o.name in bpy.data.objects:
            bpy.data.objects.remove(o, do_unlink=True)

    # Mark the asset complete. berlin-runner.html:isCompleteAuthoredHero looks
    # for a node named BerlinRunnerHero or the glTF extra
    # artikelExpressHero="complete"; without it the game treats the model as a
    # rough text-to-3D donor and stacks its own hat, hair and coat geometry on
    # top, recolours the materials, and runs heroScaleBones() over the
    # proportions -- which is exactly what makes a correctly loaded asset still
    # render as the old procedural hero.
    # The name is the reliable half of that check: Blender 5.2's exporter did
    # not carry the custom property through to glTF extras here, but a node
    # named BerlinRunnerHero always survives. Kept at identity so parenting
    # the armature to it moves nothing.
    root = bpy.data.objects.new('BerlinRunnerHero', None)
    bpy.context.collection.objects.link(root)
    root['artikelExpressHero'] = 'complete'
    for o in (root, tgt, mesh):
        o['artikelExpressHero'] = 'complete'
    tgt.parent = root
    tgt_objs.append(root)

    bpy.context.scene.frame_set(0)
    bpy.ops.object.select_all(action='DESELECT')
    for o in tgt_objs:
        if o.name in bpy.data.objects:
            o.select_set(True)
    bpy.context.view_layer.objects.active = tgt

    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB', use_selection=True,
        export_animations=True, export_animation_mode='ACTIONS',
        export_force_sampling=False, export_apply=False, export_yup=True,
        export_skins=True, export_materials='EXPORT',
        export_image_format='AUTO',
    )
    print('GLB %s  %.2f MB' % (out, os.path.getsize(out) / 1e6))


main()
