import bpy, sys
from mathutils import Vector

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def load(path):
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.context.scene.objects if o.type == 'ARMATURE'][0]

def dump(tag, arm):
    print('=== %s : %s  bones=%d ===' % (tag, arm.name, len(arm.data.bones)))
    print('  world scale', tuple(round(v,4) for v in arm.matrix_world.to_scale()))
    for b in arm.data.bones:
        d = (b.tail_local - b.head_local)
        L = d.length
        d = d.normalized() if L > 1e-9 else Vector((0,1,0))
        print('  %-28s len=%.4f head=(%.3f,%.3f,%.3f) dir=(%.2f,%.2f,%.2f) parent=%s'
              % (b.name, L, b.head_local.x, b.head_local.y, b.head_local.z,
                 d.x, d.y, d.z, b.parent.name if b.parent else '-'))
    acts = sorted(a.name for a in bpy.data.actions)
    print('  actions:', acts)

clear(); a = load(sys.argv[-2]); dump('TARGET', a)
clear(); b = load(sys.argv[-1]); dump('SOURCE', b)
