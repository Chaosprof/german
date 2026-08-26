"""Fit the Berlin Runner hero armature onto a Meshy character and skin it.

The game keys off exact bone names (charBones, prepareNamedAdditiveClip), and
Meshy's own auto-rig happens to emit the very same 23 names -- Hips, Spine01,
Spine02, lowercase neck, head_end, LeftToeBase. So reusing the v11 armature
keeps every existing clip, including the retargeted mocap run, working.

The two bodies are not the same shape though: the Meshy character is a chunky
cartoon with a large head and short legs. Bones are therefore remapped through
a piecewise-linear height warp anchored on three landmarks measured off the
mesh itself -- ground, crotch and shoulder line -- rather than uniformly
scaled, which would leave the knees in the shins.
"""
import bpy
import sys
import os
from mathutils import Vector


def arg(flag, default=None):
    a = sys.argv[sys.argv.index('--') + 1:]
    return a[a.index(flag) + 1] if flag in a else default


def import_glb(path):
    before = set(bpy.data.objects)
    before_actions = set(bpy.data.actions)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    return new, [a for a in bpy.data.actions if a not in before_actions]


def measure(obj):
    """Ground, crotch and shoulder heights, plus half-widths, from the mesh."""
    pts = [obj.matrix_world @ v.co for v in obj.data.vertices]
    zs = [p.z for p in pts]
    z0, z1 = min(zs), max(zs)
    H = z1 - z0
    SLICES = 90

    def slice_at(z, band):
        return [p for p in pts if abs(p.z - z) < band]

    band = H / SLICES

    # Crotch: scanning up from the ankles, the last height at which the
    # cross-section still separates into two lateral islands.
    crotch = z0 + 0.45 * H
    for i in range(int(SLICES * 0.15), int(SLICES * 0.75)):
        z = z0 + H * i / SLICES
        xs = sorted(p.x for p in slice_at(z, band))
        if len(xs) < 8:
            continue
        gaps = [(xs[k + 1] - xs[k], xs[k]) for k in range(len(xs) - 1)]
        widest = max(gaps)[0] if gaps else 0
        if widest > 0.045 * H:
            crotch = z
    # Shoulder line: widest cross-section in the upper body (arms out).
    best_w, shoulder = -1, z0 + 0.72 * H
    for i in range(int(SLICES * 0.55), int(SLICES * 0.92)):
        z = z0 + H * i / SLICES
        xs = [p.x for p in slice_at(z, band)]
        if len(xs) < 8:
            continue
        w = max(xs) - min(xs)
        if w > best_w:
            best_w, shoulder = w, z

    half_hip = max(abs(p.x) for p in slice_at(crotch, band * 2)) if pts else 1
    print('MEASURE h=%.3f ground=%.3f crotch=%.3f (%.0f%%) shoulder=%.3f (%.0f%%) '
          'shoulder_span=%.3f' % (H, z0, crotch, 100 * (crotch - z0) / H,
                                  shoulder, 100 * (shoulder - z0) / H, best_w))
    return z0, z1, crotch, shoulder, best_w, half_hip


def main():
    hero_glb = arg('--hero')
    mesh_glb = arg('--mesh')
    out = arg('--out')

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 120

    hero_objs, _ = import_glb(hero_glb)
    arm = next(o for o in hero_objs if o.type == 'ARMATURE')
    for o in list(hero_objs):
        if o.type == 'MESH':
            bpy.data.objects.remove(o, do_unlink=True)
            hero_objs.remove(o)

    mesh_objs, _ = import_glb(mesh_glb)
    obj = next(o for o in mesh_objs if o.type == 'MESH')

    # Bake the import transform so measurements and bone space agree.
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    z0, z1, crotch, shoulder, span, half_hip = measure(obj)

    # Same landmarks on the source rig, from its own rest pose.
    b = arm.data.bones
    h_ground = 0.0
    h_crotch = b['LeftUpLeg'].head_local.z
    h_shoulder = b['LeftShoulder'].head_local.z
    h_top = b['head_end'].tail_local.z
    h_span = 2 * abs(b['LeftShoulder'].head_local.x)
    print('HERO   crotch=%.3f (%.0f%%) shoulder=%.3f (%.0f%%) top=%.3f span=%.3f'
          % (h_crotch, 100 * h_crotch / h_top, h_shoulder,
             100 * h_shoulder / h_top, h_top, h_span))

    src = [h_ground, h_crotch, h_shoulder, h_top]
    dst = [z0, crotch, shoulder, z1]
    xk = (span / h_span) if h_span > 1e-6 else 1.0
    yk = (z1 - z0) / h_top

    def warp(p):
        z = p.z
        for i in range(3):
            if z <= src[i + 1] or i == 2:
                t = ((z - src[i]) / (src[i + 1] - src[i])
                     if abs(src[i + 1] - src[i]) > 1e-9 else 0.0)
                z = dst[i] + t * (dst[i + 1] - dst[i])
                break
        return Vector((p.x * xk, p.y * yk, z))

    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.data.edit_bones
    orig = {e.name: (e.head.copy(), e.tail.copy(), e.roll) for e in eb}
    for e in eb:
        h, t, _ = orig[e.name]
        e.head = warp(h)
        e.tail = warp(t)
    bpy.ops.object.mode_set(mode='OBJECT')

    # Skin. Bone heat needs a watertight-ish mesh; Meshy output is many
    # shells, so fall back to envelopes rather than shipping an unskinned mesh.
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    def unweighted():
        return sum(1 for v in obj.data.vertices if not v.groups)

    try:
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        print('SKIN bone heat -> unweighted %d/%d'
              % (unweighted(), len(obj.data.vertices)))
    except Exception as exc:
        print('SKIN bone heat raised (%s)' % exc)

    # Bone heat does not raise when it fails to find a solution -- it logs a
    # warning and leaves the groups empty. Detect that by result, not by
    # exception, and fall back to envelopes.
    if unweighted() > 0.5 * len(obj.data.vertices):
        print('SKIN bone heat produced no solution; falling back to envelopes')
        for vg in list(obj.vertex_groups):
            obj.vertex_groups.remove(vg)
        if obj.parent == arm:
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
            for m in list(obj.modifiers):
                if m.type == 'ARMATURE':
                    obj.modifiers.remove(m)
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        arm.select_set(True)
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.parent_set(type='ARMATURE_ENVELOPE')
        print('SKIN envelopes -> unweighted %d/%d'
              % (unweighted(), len(obj.data.vertices)))

    # Cap influences at 4 -- what glTF and three.js skin with anyway, so
    # doing it here keeps the re-normalisation honest rather than letting the
    # exporter silently drop the smallest weight.
    #
    # Deliberately NOT running vertex_group_smooth: in weight-paint mode with
    # no selection mask it zeroes every weight, and limit_total then deletes
    # the now-empty groups, leaving the mesh completely unskinned. Welding the
    # shells in prep_meshy_hero.py fixes the sleeve tearing at its source,
    # which is what the smoothing was reaching for.
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL',
                                              lock_active=False)

    ngroups = len(obj.vertex_groups)
    unweighted = sum(1 for v in obj.data.vertices if not v.groups)
    print('SKIN groups=%d unweighted_verts=%d/%d'
          % (ngroups, unweighted, len(obj.data.vertices)))

    bpy.ops.object.select_all(action='DESELECT')
    for o in hero_objs + [obj]:
        if o.name in bpy.data.objects:
            o.select_set(True)
    bpy.context.view_layer.objects.active = arm

    bpy.ops.export_scene.gltf(
        filepath=out, export_format='GLB', use_selection=True,
        export_animations=True, export_animation_mode='ACTIONS',
        export_force_sampling=False, export_apply=False, export_yup=True,
        export_skins=True, export_materials='EXPORT',
        export_image_format='AUTO',
    )
    print('GLB %s  %.2f MB' % (out, os.path.getsize(out) / 1e6))


main()
