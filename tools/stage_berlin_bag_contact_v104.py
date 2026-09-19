"""Bake the three existing backpack layers into a tiny shared contact atlas.

Authoring only: immutable V84 source, no canonical writes or geometry edits.
The UV layout may split vertices; the complete oriented surface stays exact.
"""
import bpy, os, sys, json, shutil, hashlib, math, base64, struct
from pathlib import Path
from collections import Counter
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit/berlin-bag-contact-v104'
BASE, OUT = STAGE / 'baseline', STAGE / 'models'
BASE.mkdir(parents=True, exist_ok=True)
OUT.mkdir(exist_ok=True)
sys.path.insert(0, str(ROOT / 'tools'))
from berlin_mesh_pack import packed_geometry

NAMES = ['berlin-courier-bag-v1.' + e for e in ('blend', 'glb', 'json', 'inline.js')]
for name in NAMES:
    target = BASE / name
    if not target.exists():
        shutil.copyfile(ROOT / 'assets/models' / name, target)
hashes = {n: hashlib.sha256((BASE / n).read_bytes()).hexdigest() for n in NAMES}
old = json.loads((BASE / NAMES[2]).read_text())
assert 'atlas' not in old, 'Always start from the unbaked bag, never bake twice'
bpy.ops.wm.open_mainfile(filepath=str(BASE / NAMES[0]))
bpy.context.preferences.filepaths.save_version = 0
objects = {o['runtime_key']: o for o in bpy.data.objects if o.type == 'MESH' and 'runtime_key' in o}
assert set(objects) == {'body', 'pocket', 'flap'}
native_before = {k: ([tuple(v.co) for v in o.data.vertices], [tuple(p.vertices) for p in o.data.polygons]) for k,o in objects.items()}
bpy.ops.object.select_all(action='DESELECT')
for o in objects.values():
    o.hide_set(False); o.hide_render = False; o.select_set(True)
bpy.context.view_layer.objects.active = objects['body']

# The old planar UVs overlap the front and back and cannot hold a contact bake.
# Multi-object UV packing gives all three shells one small padded atlas.
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=.035)
bpy.ops.uv.pack_islands(rotate=True, margin=.025)
bpy.ops.object.mode_set(mode='OBJECT')

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'; scene.cycles.samples = 16
scene.render.threads_mode = 'FIXED'; scene.render.threads = 2
scene.render.bake.margin = 8
scene.render.bake.use_clear = True
image = bpy.data.images.new('Backpack contact bake', width=256, height=256, alpha=True)
image.colorspace_settings.name = 'Non-Color'
temporary = bpy.data.materials.new('Temporary backpack contact rays'); temporary.use_nodes = True
nodes = temporary.node_tree.nodes; nodes.clear()
output = nodes.new('ShaderNodeOutputMaterial')
emission = nodes.new('ShaderNodeEmission')
ao = nodes.new('ShaderNodeAmbientOcclusion'); ao.samples = 32
ao.inputs['Distance'].default_value = .32
target = nodes.new('ShaderNodeTexImage'); target.image = image; nodes.active = target
temporary.node_tree.links.new(ao.outputs['AO'], emission.inputs['Color'])
temporary.node_tree.links.new(emission.outputs['Emission'], output.inputs['Surface'])
for o in objects.values():
    o.data.materials.clear(); o.data.materials.append(temporary)
print('BAKE_START', flush=True)
bpy.ops.object.bake(type='EMIT', margin=8, use_clear=True)
print('BAKE_FINISHED', flush=True)

# Limit the painted contact to 25% in linear light. Store explicit sRGB bytes
# from a Non-Color image; then reload them as sRGB for Blender/glTF/Three parity.
pixels = list(image.pixels[:]); before_values = []; mapped_values = []
def srgb(x):
    return 12.92*x if x <= .0031308 else 1.055*x**(1/2.4)-.055
for i in range(0,len(pixels),4):
    raw = max(0,min(1,pixels[i])) if pixels[i+3] > .1 else 1.0
    value = 1 - .25*(1-raw)
    if pixels[i+3] > .1: before_values.append(raw); mapped_values.append(value)
    encoded = srgb(value)
    pixels[i:i+4] = [encoded, encoded, encoded, 1.0]
image.pixels[:] = pixels
atlas_path = OUT / 'berlin-courier-bag-contact-v104.png'
image.filepath_raw = str(atlas_path); image.file_format = 'PNG'; image.save()
atlas = bpy.data.images.load(str(atlas_path), check_existing=False)
atlas.name = 'Backpack soft contact atlas'; atlas.colorspace_settings.name = 'sRGB'; atlas.pack()

mat = bpy.data.materials.new('Muted teal canvas with baked layer contact'); mat.use_nodes = True
nodes = mat.node_tree.nodes; bsdf = nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value = .86
tex = nodes.new('ShaderNodeTexImage'); tex.image = atlas
multiply = nodes.new('ShaderNodeMixRGB'); multiply.blend_type='MULTIPLY'
multiply.inputs[0].default_value=1
multiply.inputs[2].default_value=(.030,.275,.243,1)
mat.node_tree.links.new(tex.outputs['Color'], multiply.inputs[1])
mat.node_tree.links.new(multiply.outputs[0], bsdf.inputs['Base Color'])
records = {}
for key,obj in objects.items():
    obj.data.materials.clear(); obj.data.materials.append(mat)
    assert native_before[key] == ([tuple(v.co) for v in obj.data.vertices], [tuple(p.vertices) for p in obj.data.polygons])
    records[key] = packed_geometry(obj)

def decode(rec, name, fmt):
    b=base64.b64decode(rec[name]); return struct.unpack('<'+fmt*(len(b)//struct.calcsize(fmt)),b)
def oriented_surface(rec):
    p,n=decode(rec,'position','f'),decode(rec,'normal','h')
    idx=decode(rec,'index','H' if rec['vertices']<65536 else 'I')
    triangles=[]
    for a in range(0,len(idx),3):
        corners=[tuple(p[v*3:v*3+3])+tuple(n[v*3:v*3+3]) for v in idx[a:a+3]]
        triangles.append(min(tuple(corners[j:]+corners[:j]) for j in range(3)))
    return Counter(triangles)
for key,rec in records.items():
    assert rec['triangles'] == old['meshes'][key]['triangles']
    assert rec['min'] == old['meshes'][key]['min'] and rec['max'] == old['meshes'][key]['max']
    assert oriented_surface(rec) == oriented_surface(old['meshes'][key]), key+' oriented positions/normals changed'
assert sum(r['triangles'] for r in records.values()) == 2588
data = dict(old)
data.update(source='Blender 5.2 / tools/stage_berlin_bag_contact_v104.py', meshes=records,
            contactRevision='soft-layer-contact-v104',
            atlas=dict(width=256,height=256,mimeType='image/png',data=base64.b64encode(atlas_path.read_bytes()).decode(),colorSpace='sRGB'))
(OUT/NAMES[2]).write_text(json.dumps(data,separators=(',',':')))
(OUT/NAMES[3]).write_text('var BERLIN_COURIER_BAG_DATA = '+json.dumps(data,separators=(',',':'))+';\n')
bpy.ops.object.select_all(action='DESELECT')
for o in objects.values(): o.select_set(True)
bpy.context.view_layer.objects.active = objects['body']
bpy.ops.export_scene.gltf(filepath=str(OUT/NAMES[1]),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True,export_extras=True)
# Blender's exporter retains the image but omits the constant tint from this
# multiply-node layout. Encode that same native tint explicitly in glTF.
glb_path=OUT/NAMES[1]; glb=glb_path.read_bytes()
json_size=struct.unpack_from('<I',glb,12)[0]
gltf=json.loads(glb[20:20+json_size]); binary_chunk=glb[20+json_size:]
assert len(gltf['materials'])==1
pbr=gltf['materials'][0]['pbrMetallicRoughness']; assert 'baseColorTexture' in pbr
pbr['baseColorFactor']=[.030,.275,.243,1]
json_bytes=json.dumps(gltf,separators=(',',':')).encode()
json_bytes+=b' '*((-len(json_bytes))%4)
json_chunk=struct.pack('<II',len(json_bytes),0x4e4f534a)+json_bytes
glb_path.write_bytes(struct.pack('<III',0x46546c67,2,12+len(json_chunk)+len(binary_chunk))+json_chunk+binary_chunk)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/NAMES[0]))
report=dict(baseline_sha256=hashes,triangles=2588,native_geometry_exact=True,
            oriented_position_normal_triangles_exact=True,counts={k:dict(before=old['meshes'][k]['vertices'],after=r['vertices']) for k,r in records.items()},
            atlasBytes=atlas_path.stat().st_size,atlasSize=[256,256],contactRange=[min(mapped_values),max(mapped_values)],
            rawAORange=[min(before_values),max(before_values)],averageContact=sum(mapped_values)/len(mapped_values),
            lowContactTexels=sum(v<.93 for v in mapped_values),validTexels=len(mapped_values))
(STAGE/'validation.json').write_text(json.dumps(report,indent=2))
print('CONTACT_STAGE_COMPLETE',json.dumps(report),flush=True)

if '--render' in sys.argv:
    # Exact same uniform sun for both copies; no finite-distance key bias.
    prior=bpy.data.materials.new('Previous plain teal canvas'); prior.diffuse_color=(.030,.275,.243,1); prior.use_nodes=True
    prior.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.030,.275,.243,1)
    prior.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.86
    for o in list(objects.values()):
        original=o.copy(); original.data=o.data.copy(); bpy.context.collection.objects.link(original)
        original.location.x=-1.7; original.data.materials.clear(); original.data.materials.append(prior)
        o.location.x=1.7
    for obj in list(bpy.data.objects):
        if obj.type in {'CAMERA','LIGHT'}: bpy.data.objects.remove(obj,do_unlink=True)
    world=scene.world or bpy.data.worlds.new('Bag comparison world'); scene.world=world; world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.6,.7,.85,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.45
    light_data=bpy.data.lights.new('Uniform warm sun','SUN');light_data.energy=2.0;light_data.angle=.12
    light=bpy.data.objects.new('Uniform warm sun',light_data);bpy.context.collection.objects.link(light)
    light.rotation_euler=(math.radians(28),math.radians(-25),math.radians(-28))
    camera_data=bpy.data.cameras.new('Layer comparison');camera=bpy.data.objects.new('Layer comparison',camera_data);bpy.context.collection.objects.link(camera)
    camera.location=(0,10,3.0); aim=Vector((0,0,0));camera.rotation_euler=(aim-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.type='ORTHO';camera_data.ortho_scale=7.2;scene.camera=camera
    scene.render.resolution_x=1000;scene.render.resolution_y=640;scene.render.resolution_percentage=100
    scene.cycles.samples=16;scene.render.image_settings.file_format='PNG'
    scene.view_settings.view_transform='Standard';scene.view_settings.look='Medium High Contrast' if 'Medium High Contrast' in [i.name for i in bpy.types.ColorManagedViewSettings.bl_rna.properties['look'].enum_items] else 'None'
    scene.render.filepath=str(STAGE/'bag-comparison.png');bpy.ops.render.render(write_still=True)
