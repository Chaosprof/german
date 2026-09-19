"""Stage the existing native backpack with the runtime V111 canvas finish.

No geometry, UV, atlas or canonical file is regenerated. The optional preview
uses actual accessory geometry assembled by the existing Three.js rig fixture.
"""
import bpy,sys,json,math,struct,shutil,hashlib,base64
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[1]
STAGE=ROOT/'audit/berlin-courier-v111'; BASE=STAGE/'baseline'; OUT=STAGE/'models'
sys.path.insert(0,str(ROOT/'tools'))
from berlin_mesh_pack import packed_geometry
meta=json.loads((STAGE/'candidate.json').read_text())
for name,sha in meta['baselineSha256'].items():
    assert hashlib.sha256((BASE/name).read_bytes()).hexdigest()==sha
data=json.loads((BASE/'berlin-courier-bag-v1.json').read_text())
def linear(x):
    x/=255
    return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
color=[linear((meta['bagColor']>>s)&255) for s in (16,8,0)]
bpy.ops.wm.open_mainfile(filepath=str(BASE/'berlin-courier-bag-v1.blend'))
bpy.context.preferences.filepaths.save_version=0
objects={o['runtime_key']:o for o in bpy.data.objects if o.type=='MESH' and 'runtime_key' in o}
assert set(objects)==set(data['meshes'])
for key,obj in objects.items(): assert packed_geometry(obj)==data['meshes'][key]
materials={m for o in objects.values() for m in o.data.materials}
assert len(materials)==1
material=next(iter(materials));material.name='Muted blue-teal canvas with V104 baked layer contact'
nodes=material.node_tree.nodes
multiply=next(n for n in nodes if n.type=='MIX_RGB' and n.blend_type=='MULTIPLY')
multiply.inputs[2].default_value=(*color,1)
nodes.get('Principled BSDF').inputs['Roughness'].default_value=meta['roughness']
material.diffuse_color=(*color,1)
for ext in ('json','inline.js'):shutil.copyfile(BASE/('berlin-courier-bag-v1.'+ext),OUT/('berlin-courier-bag-v1.'+ext))
atlas=base64.b64decode(data['atlas']['data']);(OUT/'berlin-courier-bag-contact-v104.png').write_bytes(atlas)
bpy.ops.object.select_all(action='DESELECT')
for obj in objects.values():obj.hide_set(False);obj.hide_render=False;obj.select_set(True)
bpy.context.view_layer.objects.active=objects['body']
glb_path=OUT/'berlin-courier-bag-v1.glb'
bpy.ops.export_scene.gltf(filepath=str(glb_path),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True,export_extras=True)
# Blender omits the constant tint from this established multiply-node layout.
# glTF's baseColorFactor expresses the exact same material as the native nodes.
gb=glb_path.read_bytes();size=struct.unpack_from('<I',gb,12)[0];gltf=json.loads(gb[20:20+size]);tail=gb[20+size:]
assert len(gltf['materials'])==1
pbr=gltf['materials'][0]['pbrMetallicRoughness'];assert 'baseColorTexture' in pbr
pbr['baseColorFactor']=[*color,1];pbr['roughnessFactor']=meta['roughness']
js=json.dumps(gltf,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
chunk=struct.pack('<II',len(js),0x4e4f534a)+js
glb_path.write_bytes(struct.pack('<III',0x46546c67,2,12+len(chunk)+len(tail))+chunk+tail)
for key,obj in objects.items():assert packed_geometry(obj)==data['meshes'][key]
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'berlin-courier-bag-v1.blend'))
report=dict(nativeRuntimeRecordsExact=True,runtimeJsonExact=True,runtimeInlineExact=True,atlasExact=True,linearCanvasColor=color,roughness=meta['roughness'],triangles=sum(r['triangles'] for r in data['meshes'].values()))
(STAGE/'export-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print('SATCHEL_EXPORT_COMPLETE',json.dumps(report),flush=True)

if '--render' in sys.argv:
    # Preview only: never save these display helpers into the reusable model.
    for obj in list(bpy.data.objects):bpy.data.objects.remove(obj,do_unlink=True)
    preview=json.loads((STAGE/'preview-geometry.json').read_text())
    atlas_img=next(n.image for n in material.node_tree.nodes if n.type=='TEX_IMAGE')
    scale=5.0
    for side,key in ((-1,'before'),(1,'candidate')):
        for i,record in enumerate(preview[key]):
            points=record['position']; normals=record['normal']; uvs=record['uv']; ids=record['index'] or list(range(len(points)//3))
            me=bpy.data.meshes.new(key+' runtime batch '+str(i))
            me.from_pydata([(points[j]*scale,-points[j+2]*scale,points[j+1]*scale) for j in range(0,len(points),3)],[],[ids[j:j+3] for j in range(0,len(ids),3)])
            me.update()
            for p in me.polygons:p.use_smooth=True
            # Three's mergeBoxes stores transformed normalized-Int16 values in
            # a float attribute and the vertex shader normalizes them. Blender
            # clamps custom-normal input components before encoding, so pass
            # unit vectors rather than those large but correctly directed values.
            me.normals_split_custom_set([tuple(Vector((normals[l.vertex_index*3],-normals[l.vertex_index*3+2],normals[l.vertex_index*3+1])).normalized()) for l in me.loops])
            uv=me.uv_layers.new(name='UVMap')
            for l in me.loops:uv.data[l.index].uv=uvs[l.vertex_index*2:l.vertex_index*2+2]
            ob=bpy.data.objects.new(key+' batch '+str(i),me);bpy.context.collection.objects.link(ob);ob.location.x=side*1.8
            m=bpy.data.materials.new(key+' finish '+str(i));m.use_nodes=True;shader=m.node_tree.nodes.get('Principled BSDF')
            shader.inputs['Roughness'].default_value=record['roughness'];shader.inputs['Base Color'].default_value=(*record['color'],1)
            if record['textured']:
                tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=atlas_img
                mix=m.node_tree.nodes.new('ShaderNodeMixRGB');mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[2].default_value=(*record['color'],1)
                m.node_tree.links.new(tex.outputs['Color'],mix.inputs[1]);m.node_tree.links.new(mix.outputs[0],shader.inputs['Base Color'])
            me.materials.append(m)
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12
    scene.render.threads_mode='FIXED';scene.render.threads=2
    world=bpy.data.worlds.new('Uniform satchel preview');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.62,.73,.83,1);world.node_tree.nodes['Background'].inputs[1].default_value=.55
    light_data=bpy.data.lights.new('Soft uniform sun','SUN');light_data.energy=2.0;light_data.angle=.16
    light=bpy.data.objects.new('Soft uniform sun',light_data);bpy.context.collection.objects.link(light);light.rotation_euler=(math.radians(34),math.radians(-20),math.radians(-35))
    camera_data=bpy.data.cameras.new('Fair comparison');camera=bpy.data.objects.new('Fair comparison',camera_data);bpy.context.collection.objects.link(camera)
    camera.location=(0,12,2.4);aim=Vector((0,0,.03));camera.rotation_euler=(aim-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=7.5;scene.camera=camera
    scene.render.resolution_x=900;scene.render.resolution_y=520;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.render.image_settings.file_format='PNG'
    scene.render.filepath=str(STAGE/'satchel-comparison.png');bpy.ops.render.render(write_still=True)
