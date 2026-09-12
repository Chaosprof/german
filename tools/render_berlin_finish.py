"""Render exported gameplay meshes for asset QA (not a gameplay capture).
Blender --background --python tools/render_berlin_finish.py
First run: node tools/check_berlin_finish.cjs --export
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
KIT = json.loads((ROOT / 'audit/berlin-finish-inspection.json').read_text())
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.resolution_x = 1200
scene.render.resolution_y = 820
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'Standard'
scene.world.color = (0.23, 0.29, 0.36)

def material(name, color, vertex=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = .82
    if vertex:
        attr = m.node_tree.nodes.new('ShaderNodeAttribute')
        attr.attribute_name = 'runner_tint'
        mix = m.node_tree.nodes.new('ShaderNodeMixRGB')
        mix.blend_type = 'MULTIPLY'
        mix.inputs[0].default_value = 1
        mix.inputs[2].default_value = (*color, 1)
        m.node_tree.links.new(attr.outputs['Color'], mix.inputs[1])
        m.node_tree.links.new(mix.outputs[0], shader.inputs['Base Color'])
    return m

leaf = material('Vertex-painted foliage', (1,1,1), True)
stone = material('Warm stone', (.82,.76,.63), True)
bark = material('Bark', (.16,.073,.025))
floor = material('Sandstone', (.48,.55,.51))
wall = material('Mint plaster', (.16,.43,.35))
glass = material('Painted glass', (.025,.16,.31))

def mesh(name, data, mat, location):
    p,n,c = data['position'],data['normal'],data['color']
    verts = [(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)]
    normals = [(n[i],-n[i+2],n[i+1]) for i in range(0,len(n),3)]
    geo = bpy.data.meshes.new(name)
    geo.from_pydata(verts,[],[(i,i+1,i+2) for i in range(0,len(verts),3)])
    geo.update()
    obj = bpy.data.objects.new(name,geo)
    scene.collection.objects.link(obj)
    obj.location = location
    obj.data.materials.append(mat)
    col = geo.color_attributes.new(name='runner_tint',type='FLOAT_COLOR',domain='CORNER')
    for loop in geo.loops:
        i = loop.vertex_index*3
        col.data[loop.index].color = (*c[i:i+3],1)
    for face in geo.polygons: face.use_smooth=True
    geo.normals_split_custom_set(normals)
    geo.update()
    if '--inspect' in sys.argv:
        print(name, [(a.name,a.domain,a.data_type) for a in geo.color_attributes],
              [tuple(geo.color_attributes['runner_tint'].data[i].color) for i in range(3)], flush=True)
    return obj

def box(name, location, scale, mat):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location)
    obj=bpy.context.object
    obj.name=name
    obj.scale=scale
    obj.data.materials.append(mat)
    return obj

def camera(location,target,ortho):
    bpy.ops.object.camera_add(location=location)
    cam=bpy.context.object
    cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'
    cam.data.ortho_scale=ortho
    scene.camera=cam

def render(name):
    if '--inspect' in sys.argv: return
    scene.render.filepath=str(ROOT/'audit'/name)
    bpy.ops.render.render(write_still=True)

bpy.ops.object.light_add(type='AREA',location=(-4,-6,10))
bpy.context.object.data.energy=1250
bpy.context.object.data.shape='DISK'
bpy.context.object.data.size=5
bpy.ops.object.light_add(type='AREA',location=(6,2,8))
bpy.context.object.data.energy=800
bpy.context.object.data.color=(.69,.84,1)
bpy.context.object.data.size=6

objects=[]
for x,key in [(-2.25,'beforeCanopy'),(2.25,'canopy')]:
    if key not in KIT: continue
    objects.append(mesh(key,KIT[key],leaf,(x,0,0)))
    bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=.35,radius2=.22,depth=3.05,location=(x,0,1.525))
    bpy.context.object.data.materials.append(bark)
    objects.append(bpy.context.object)
    objects.append(box('Tree pit',(x,0,.09),(1.8,1.8,.18),floor))
base=box('Base',(0,0,-.08),(200,200,.1),floor)
camera((8,-16,9),(0,0,2.65),10)
render('berlin-finish-foliage-inspection.png')
for obj in objects: bpy.data.objects.remove(obj,do_unlink=True)
bpy.data.objects.remove(scene.camera,do_unlink=True)
for x,key,width in [(-1.55,'regular',1.0656),(1.55,'arch',1.476)]:
    mesh(key,KIT[key],stone,(x,0,2.25))
    box('Plaster',(x,.13,2.1),(2.9,.25,4.2),wall)
    # Behind the actual bevel mesh: a plain card shows the open sightline.
    box('Glazing',(x,-.048,2.25),(width,.008,1.872),glass)
camera((6,-12,6.5),(0,0,2.1),7.2)
render('berlin-finish-window-inspection.png')
