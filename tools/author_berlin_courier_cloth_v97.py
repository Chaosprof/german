"""Editable rigged v97 surface and one restrained pose comparison.

Run after stage_berlin_courier_cloth_v97.cjs, with Blender -b -t 2.
The GLB is an already-refined authoring copy, never a replacement v14 source.
"""
import bpy, hashlib, json, math, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE = os.path.join(ROOT, 'audit', 'berlin-courier-cloth-v97')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.import_scene.gltf(filepath=os.path.join(STAGE, 'models', 'courier-cloth-render-copy-v97.glb'))
bone_widgets = {bone.custom_shape for obj in bpy.context.scene.objects if obj.type=='ARMATURE'
                for bone in obj.pose.bones if bone.custom_shape}
authoring_report = {
    'source_glb_sha256': hashlib.sha256(open(os.path.join(STAGE, 'models', 'courier-cloth-render-copy-v97.glb'),'rb').read()).hexdigest(),
    'meshes': [{'name': o.name, 'vertices':len(o.data.vertices), 'triangles':sum(len(p.vertices)-2 for p in o.data.polygons),
                'materials':len(o.data.materials)} for o in bpy.context.scene.objects if o.type=='MESH' and o not in bone_widgets],
    'armatures': [{'name':o.name,'bones':len(o.data.bones)} for o in bpy.context.scene.objects if o.type=='ARMATURE'],
    'actions': sorted(a.name for a in bpy.data.actions),
    'nonrendering_bone_widgets': sorted(o.name for o in bone_widgets),
}
assert len(authoring_report['meshes']) == 1, authoring_report
assert authoring_report['meshes'][0]['triangles'] == 17999
assert len(authoring_report['actions']) == 15
author = bpy.data.collections.new('EDITABLE RIG / shaped render copy / 15 source clips')
bpy.context.scene.collection.children.link(author)
for obj in list(bpy.context.scene.objects):
    for collection in list(obj.users_collection): collection.objects.unlink(obj)
    author.objects.link(obj)
    obj['courier_v97_authoring_copy'] = True
author.hide_render = True
author.hide_viewport = True

data = json.load(open(os.path.join(STAGE, 'preview-poses.json')))
material = bpy.data.materials.new('Shape comparison only / original runtime texture unchanged')
material.diffuse_color = (.62, .20, .08, 1)
material.use_nodes = True
nodes = material.node_tree.nodes
shader = nodes.get('Principled BSDF')
shader.inputs['Roughness'].default_value = .82
vertex = nodes.new('ShaderNodeVertexColor'); vertex.layer_name = 'Preview'
material.node_tree.links.new(vertex.outputs['Color'], shader.inputs['Base Color'])
faces = [tuple(data['index'][i:i+3]) for i in range(0,len(data['index']),3)]
for pi, pose in enumerate(data['poses']):
    for mi, item in enumerate(pose['meshes']):
        coords = [tuple(item['positions'][i:i+3]) for i in range(0,len(item['positions']),3)]
        norms = [tuple(item['normals'][i:i+3]) for i in range(0,len(item['normals']),3)]
        center_x = (min(p[0] for p in coords)+max(p[0] for p in coords))*.5
        floor_y = min(p[1] for p in coords)
        x = (pi-1)*2.18 + (mi-.5)*.98
        points = [(p[0]-center_x+x, -p[2], p[1]-floor_y) for p in coords]
        normals = [(n[0],-n[2],n[1]) for n in norms]
        mesh=bpy.data.meshes.new(pose['name']+' '+item['name']);mesh.from_pydata(points,[],faces);mesh.update()
        for poly in mesh.polygons: poly.use_smooth=True
        mesh.normals_split_custom_set_from_vertices(normals)
        colors=mesh.color_attributes.new(name='Preview',type='FLOAT_COLOR',domain='POINT')
        for i,c in enumerate(colors.data): c.color=(*data['colors'][i*3:i*3+3],1)
        obj=bpy.data.objects.new(pose['name']+' / '+item['name'],mesh)
        bpy.context.scene.collection.objects.link(obj);obj.data.materials.append(material)
        obj['comparison_only'] = True

ground = bpy.data.materials.new('Warm neutral floor');ground.diffuse_color=(.35,.36,.34,1)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.015))
bpy.context.object.data.materials.append(ground)
scene=bpy.context.scene
if not scene.world: scene.world=bpy.data.worlds.new('Neutral comparison world')
scene.world.color=(.22,.22,.22)
def point(obj,target): obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(0,10,3.25));camera=bpy.context.object
camera.data.type='ORTHO';camera.data.ortho_scale=6.9;point(camera,(0,0,.78));scene.camera=camera
for location,energy,size in [((-3,4,6),950,5),((4,-3,5),700,5)]:
    bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object
    light.data.energy=energy;light.data.shape='DISK';light.data.size=size;point(light,(0,0,.8))
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=2
scene.render.resolution_x=1500;scene.render.resolution_y=600;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=os.path.join(STAGE,'courier-cloth-pose-comparison.png')
scene.view_settings.view_transform='AgX'
scene['comparison_description']='Image left to right: run, roll, jump left. Each pair is staged v97 left and accepted right. Clay colors show form, not runtime material.'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(STAGE,'models','courier-cloth-authoring-v97.blend'))
bpy.ops.render.render(write_still=True)
authoring_report['preview']='Corrected, softened accepted shape. Image pairs: candidate left, prior accepted right; run, roll, jump.'
json.dump(authoring_report,open(os.path.join(STAGE,'blender-validation.json'),'w'),indent=2)
