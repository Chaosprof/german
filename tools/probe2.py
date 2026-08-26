import bpy, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=sys.argv[-1])
arm = [o for o in bpy.context.scene.objects if o.type=='ARMATURE'][0]
print('LEGS:')
for b in arm.data.bones:
    if 'Leg' in b.name or 'Foot' in b.name or 'Toe' in b.name:
        print('  %-30s head=(%.2f,%.2f,%.2f) children=%s' % (b.name,
            b.head_local.x,b.head_local.y,b.head_local.z,[c.name for c in b.children]))
run = bpy.data.actions.get('run')
print('RUN action:', run, 'frame_range', tuple(run.frame_range))
chans=set()
for layer in run.layers:
    for strip in layer.strips:
        for bag in strip.channelbags:
            for fc in bag.fcurves:
                chans.add((fc.data_path, fc.array_index))
hips=[c for c in sorted(chans) if 'Hips' in c[0]]
print('Hips channels:', hips)
# sample hips location over the clip
arm.animation_data.action = run
import math
for f in range(int(run.frame_range[0]), int(run.frame_range[1])+1, 4):
    bpy.context.scene.frame_set(f)
    pb = arm.pose.bones['mixamorig:Hips']
    print('   f%-4d hips loc=(%.2f, %.2f, %.2f)' % (f, pb.location.x, pb.location.y, pb.location.z))
