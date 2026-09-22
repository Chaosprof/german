"""Save an editable rigged sculpt and compare its actual skinned surfaces.

The authoring GLBs are already refined. Never install under hero-v14.glb.
This preview omits accessories; in-game captures decide visual acceptance.
"""
import bpy,json,math,os,sys
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
STAGE=ROOT/'audit/berlin-model-forms-v114/courier'
if os.getenv('BERLIN_COURIER_QUIET_HEM'):STAGE=STAGE/'quiet-hem'
elif os.getenv('BERLIN_COURIER_CONTOURS'):STAGE=STAGE/'contour-trial'
elif os.getenv('BERLIN_COURIER_SOFT_NORMALS'):STAGE=STAGE/'normal-trial'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.import_scene.gltf(filepath=str(STAGE/'courier-forms-v114-authoring.glb'))
for obj in bpy.data.objects:
    obj['authoring_only']='Already V97 + V114 refined; never replace original hero-v14.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(STAGE/'berlin-courier-forms-v114.blend'))
for obj in list(bpy.data.objects):bpy.data.objects.remove(obj,do_unlink=True)
preview=json.loads((STAGE/'preview-poses.json').read_text())
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=16
scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=900;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard';scene.view_settings.look='None'
world=bpy.data.worlds.new('Neutral shape comparison');scene.world=world;world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.43,.50,.56,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.5
light_data=bpy.data.lights.new('Soft sun','SUN');light_data.energy=2;light_data.angle=.16
light=bpy.data.objects.new('Soft sun',light_data);scene.collection.objects.link(light)
light.rotation_euler=(math.radians(35),math.radians(-25),math.radians(-35))
camera_data=bpy.data.cameras.new('Rear comparison');camera=bpy.data.objects.new('Rear comparison',camera_data);scene.collection.objects.link(camera)
camera.location=(0,5,1.9);camera.rotation_euler=(Vector((0,0,.8))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.type='ORTHO';camera_data.ortho_scale=2.6;scene.camera=camera
material=bpy.data.materials.new('V111 simplified matte color / form inspection only');material.use_nodes=True
attr=material.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='preview_color'
shader=material.node_tree.nodes.get('Principled BSDF');shader.inputs['Roughness'].default_value=.88
material.node_tree.links.new(attr.outputs['Color'],shader.inputs['Base Color'])
for pose in preview['poses']:
    if '--run-only' in sys.argv and pose['name']!='run':continue
    objects=[]
    for side,record in zip((-1,1),pose['meshes']):
        points=record['position'];normals=record['normal'];idx=preview['index']
        me=bpy.data.meshes.new(record['name'])
        me.from_pydata([(points[i],-points[i+2],points[i+1]) for i in range(0,len(points),3)],[],[idx[i:i+3] for i in range(0,len(idx),3)])
        me.update()
        for poly in me.polygons:poly.use_smooth=True
        me.normals_split_custom_set([tuple(Vector((normals[l.vertex_index*3],-normals[l.vertex_index*3+2],normals[l.vertex_index*3+1])).normalized()) for l in me.loops])
        colors=me.color_attributes.new(name='preview_color',type='FLOAT_COLOR',domain='CORNER')
        for l in me.loops:colors.data[l.index].color=(*preview['colors'][l.vertex_index*3:l.vertex_index*3+3],1)
        ob=bpy.data.objects.new(record['name'],me);scene.collection.objects.link(ob);ob.location.x=side*.55;me.materials.append(material);objects.append(ob)
    scene.render.filepath=str(STAGE/(pose['name']+'-shape-comparison.png'));bpy.ops.render.render(write_still=True)
    for obj in objects:bpy.data.objects.remove(obj,do_unlink=True)
print('COURIER_FORMS_V114_NATIVE_AND_PREVIEW_COMPLETE',flush=True)
