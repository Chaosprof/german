"""Replace only the accepted bakery fabric; preserve every other baked surface.

First run export_kiez_architecture_source.cjs. Then run this script in Blender
with -b -t 2, optionally -- --render. Outputs stay under audit/berlin-awning-v71.
No structural bevel or contact bake is applied to the new cloth.
"""
import bpy,bmesh,json,os,sys,base64,struct,math,shutil,collections
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from berlin_mesh_pack import packed_geometry
STAGE=os.path.join(ROOT,'audit','berlin-awning-v71');OUT=os.path.join(STAGE,'models')
os.makedirs(OUT,exist_ok=True)
SOURCE=os.path.join(STAGE,'baseline')
assert os.path.isfile(os.path.join(SOURCE,'berlin-reference-architecture-v1.blend')),'Preserved pre-awning baseline is required; never overwrite it with a later canonical asset'
with open(os.path.join(SOURCE,'berlin-reference-architecture-v1.json')) as f:accepted=json.load(f)
with open(os.path.join(ROOT,'.tmp','kiez-architecture-source.json')) as f:modules=json.load(f)['modules']
item=next(m for m in modules if m['name']=='13.5:0:1')
start,end=item['fabricRanges'][0]
cloth={k:item[k][start*size:end*size] for k,size in [('position',9),('normal',9),('color',9),('uv',6)]}
assert end-start==1756

def read_record(record,key,fmt):
    raw=base64.b64decode(record[key]);return struct.unpack('<'+fmt*(len(raw)//struct.calcsize(fmt)),raw)

def record_components(record):
    p=read_record(record,'position','f');indices=read_record(record,'index','H')
    ids={};parents=[];weld=[]
    def find(i):
        while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
        return i
    for i in range(0,len(p),3):
        key=tuple(p[i:i+3])
        if key not in ids:ids[key]=len(parents);parents.append(len(parents))
        weld.append(ids[key])
    for i in range(0,len(indices),3):
        a=find(weld[indices[i]])
        for j in range(1,3):parents[find(weld[indices[i+j]])]=a
    groups={}
    for i in range(0,len(indices),3):
        key=find(weld[indices[i]]);g=groups.setdefault(key,{'triangles':set(),'min':[math.inf]*3,'max':[-math.inf]*3})
        g['triangles'].add(i//3)
        for k in indices[i:i+3]:
            for j in range(3):g['min'][j]=min(g['min'][j],p[k*3+j]);g['max'][j]=max(g['max'][j],p[k*3+j])
    return list(groups.values())

def old_fabric(bounds):
    lo,hi=bounds['min'],bounds['max']
    within=lo[0]>-6.21 and hi[0]<.66
    roof=3.80<lo[1]<3.89 and 5.60<hi[1]<5.70 and .15<lo[2]<.25 and 2.10<hi[2]<2.18
    hem=3.49<lo[1]<3.54 and 3.85<hi[1]<3.90 and 2.11<lo[2]<2.14 and 2.18<hi[2]<2.20
    return within and (roof or hem)

def face_payloads(record,omit,include_normals=True):
    attrs=[read_record(record,k,f) for k,f in [('position','f'),('normal','h'),('color','B'),('uv','f')]]
    indices=read_record(record,'index','H');out=collections.Counter()
    for i in range(0,len(indices),3):
        if i//3 in omit:continue
        corners=[]
        for v in indices[i:i+3]:corners.append(tuple(value for ai,(array,size) in enumerate(zip(attrs,(3,3,3,2))) if include_normals or ai!=1 for value in array[v*size:(v+1)*size]))
        # Sorting accepts cyclic triangle order, but compares every actual
        # position, signed normal, vertex color and atlas coordinate exactly.
        out[tuple(sorted(corners))]+=1
    return out

bpy.ops.wm.open_mainfile(filepath=os.path.join(SOURCE,'berlin-reference-architecture-v1.blend'))
bpy.context.preferences.filepaths.save_version=0
objects={o['runtime_key']:o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('runtime_key')}
bakery=objects['13.5:0:1'];before=packed_geometry(bakery)
assert before==accepted['meshes']['13.5:0:1'],'Saved bakery blend must match the accepted runtime master'
old_components=[g for g in record_components(before) if old_fabric(g)]
old_ids=set().union(*(g['triangles'] for g in old_components))
assert len(old_components)==17 and len(old_ids)==1472,(len(old_components),len(old_ids))

# Blender only authors the replacement fabric. Protected storefront surfaces
# never pass through BMesh; their exact packed attributes are spliced below.
bm=bmesh.new();uv=bm.loops.layers.uv.new('UVMap');color=bm.loops.layers.float_color.new('Color')
fabric=bm.faces.layers.int.new('awning_fabric')
created={};new_verts=set();new_faces=[]
for tri in range(end-start):
    verts=[]
    for corner in range(3):
        i=tri*3+corner;p=cloth['position'][i*3:i*3+3];point=(p[0],-p[2],p[1]);key=tuple(round(x,6) for x in point)
        if key not in created:created[key]=bm.verts.new(point);new_verts.add(created[key])
        verts.append(created[key])
    face=bm.faces.new(verts);face.smooth=True;face[fabric]=1;new_faces.append(face)
    for corner,loop in enumerate(face.loops):
        i=tri*3+corner;loop[uv].uv=cloth['uv'][i*2:i*2+2];loop[color]=(*cloth['color'][i*3:i*3+3],1)
bm.normal_update()
for edge in bm.edges:
    if all(v in new_verts for v in edge.verts):edge.smooth=len(edge.link_faces)==2 and edge.calc_face_angle(0)<math.radians(75)
cloth_mesh=bpy.data.meshes.new('Replacement soft fabric');bm.to_mesh(cloth_mesh);bm.free();cloth_mesh.update()
cloth_obj=bpy.data.objects.new('Replacement soft fabric',cloth_mesh);bpy.context.collection.objects.link(cloth_obj)
cloth_obj.data.materials.append(bakery.data.materials[0]);cloth_record=packed_geometry(cloth_obj)

def splice_records(parts):
    arrays={k:[] for k in ('position','normal','color','uv','index')};lookup={}
    for record,omit in parts:
        data={k:read_record(record,k,f) for k,f in [('position','f'),('normal','h'),('color','B'),('uv','f')]}
        indices=read_record(record,'index','H')
        for first in range(0,len(indices),3):
            if first//3 in omit:continue
            for index in indices[first:first+3]:
                values={k:tuple(data[k][index*size:(index+1)*size]) for k,size in [('position',3),('normal',3),('color',3),('uv',2)]}
                key=tuple(value for k in ('position','normal','color','uv') for value in values[k])
                if key not in lookup:
                    lookup[key]=len(arrays['position'])//3
                    for k,value in values.items():arrays[k].extend(value)
                arrays['index'].append(lookup[key])
    result={}
    for k,f in [('position','f'),('normal','h'),('color','B'),('uv','f'),('index','H')]:
        result[k]=base64.b64encode(struct.pack('<'+f*len(arrays[k]),*arrays[k])).decode('ascii')
    result.update(vertices=len(arrays['position'])//3,triangles=len(arrays['index'])//3,
        min=[round(min(arrays['position'][i::3]),5) for i in range(3)],max=[round(max(arrays['position'][i::3]),5) for i in range(3)])
    return result

after=splice_records([(before,old_ids),(cloth_record,set())])
new_components=[g for g in record_components(after) if len(g['triangles'])==1756 and g['min'][1]>3.50 and g['max'][1]<5.66 and g['max'][2]>2.18]
assert len(new_components)==1,'New cloth is one closed component'
new_ids=new_components[0]['triangles']
assert face_payloads(before,old_ids)==face_payloads(after,new_ids),'Every non-fabric position/normal/color/UV must remain byte-identical'
assert before['min']==after['min'] and before['max']==after['max'],'Complete bakery footprint must be unchanged'
assert after['triangles']<23000

# Reviewable editable .blend: exactly the spliced triangle geometry. Carry the
# original full-precision custom normals where possible instead of deriving
# protected trim lighting again from its already-baked triangles.
original=bakery.data;original.calc_loop_triangles();normal_lookup={}
attr=original.color_attributes['Color'];tex=original.uv_layers.active.data
for tri in original.loop_triangles:
    for li in tri.loops:
        loop=original.loops[li];p=original.vertices[loop.vertex_index].co;n=original.corner_normals[li].vector
        c=attr.data[li if attr.domain=='CORNER' else loop.vertex_index].color;t=tex[li].uv
        key=(*[round(v,5) for v in (p.x,p.z,-p.y)],*[round(v*32767) for v in (n.x,n.z,-n.y)],
             *[round(v*255) for v in c[:3]],*[round(v,6) for v in t])
        normal_lookup[key]=tuple(n)
raw={k:read_record(after,k,f) for k,f in [('position','f'),('normal','h'),('color','B'),('uv','f'),('index','H')]}
points=[];normals=[]
for i in range(after['vertices']):
    p=raw['position'][i*3:i*3+3];n=raw['normal'][i*3:i*3+3];c=raw['color'][i*3:i*3+3];t=raw['uv'][i*2:i*2+2]
    points.append((p[0],-p[2],p[1]))
    key=(*[round(v,5) for v in p],*n,*c,*[round(v,6) for v in t])
    normals.append(normal_lookup.get(key,(n[0]/32767,-n[2]/32767,n[1]/32767)))
faces=[tuple(raw['index'][i:i+3]) for i in range(0,len(raw['index']),3)]
mesh=bpy.data.meshes.new(original.name+' / soft continuous fabric');mesh.from_pydata(points,[],faces);mesh.update()
texture=mesh.uv_layers.new(name='UVMap');paint=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
for loop in mesh.loops:
    i=loop.vertex_index;texture.data[loop.index].uv=raw['uv'][i*2:i*2+2];paint.data[loop.index].color=(*[v/255 for v in raw['color'][i*3:i*3+3]],1)
for polygon in mesh.polygons:polygon.use_smooth=True
mesh.normals_split_custom_set([normals[loop.vertex_index] for loop in mesh.loops]);mesh.materials.append(original.materials[0])
bakery.data=mesh;bakery['awning_fabric']='12 continuous coral/cream bands, shallow bow, rounded scallops; no structural bevel'
bpy.data.objects.remove(cloth_obj,do_unlink=True);bpy.data.meshes.remove(cloth_mesh)
blend_record=packed_geometry(bakery)
assert blend_record['triangles']==after['triangles']
assert face_payloads(blend_record,set(),False)==face_payloads(after,set(),False),'Editable blend reproduces exact triangle geometry, UV and paint'
def normal_samples(record):
    raw={k:read_record(record,k,f) for k,f in [('position','f'),('normal','h'),('color','B'),('uv','f')]};samples={}
    for i in range(record['vertices']):
        key=(*raw['position'][i*3:i*3+3],*raw['color'][i*3:i*3+3],*raw['uv'][i*2:i*2+2])
        samples.setdefault(key,[]).append(raw['normal'][i*3:i*3+3])
    return samples
base_normals=normal_samples(after);view_normals=normal_samples(blend_record)
normal_lsb_delta=max(min(max(abs(a-b) for a,b in zip(n,other)) for other in base_normals[key]) for key,values in view_normals.items() for n in values)
# Blender stores custom normals in its own local encoding. The authoritative
# runtime splice above is byte-exact; allow sub-degree encoding precision in
# the editable review file and report the measured delta rather than rebaking.
assert normal_lsb_delta<=64,('Unexpected review normal change',normal_lsb_delta)

updated=dict(accepted);updated['meshes']=dict(accepted['meshes']);updated['meshes']['13.5:0:1']=after
updated['source']='Blender 5.2 / tools/stage_berlin_bakery_awning.py'
for key,obj in objects.items():
    if key!='13.5:0:1':assert packed_geometry(obj)==accepted['meshes'][key],'Other module changed: '+key
with open(os.path.join(OUT,'berlin-reference-architecture-v1.json'),'w') as f:json.dump(updated,f,separators=(',',':'))
with open(os.path.join(OUT,'berlin-reference-architecture-v1.inline.js'),'w') as f:f.write('var BERLIN_REFERENCE_ARCHITECTURE = '+json.dumps(updated,separators=(',',':'))+';\n')
shutil.copyfile(os.path.join(SOURCE,'berlin-reference-architecture-v1-atlas.png'),os.path.join(OUT,'berlin-reference-architecture-v1-atlas.png'))
bpy.ops.object.select_all(action='DESELECT')
for obj in objects.values():obj.select_set(True)
bpy.context.view_layer.objects.active=bakery
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.glb'),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True,export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=False,export_extras=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.blend'))
report={'old_cloth_triangles':len(old_ids),'new_cloth_triangles':len(new_ids),'before_bakery_triangles':before['triangles'],'after_bakery_triangles':after['triangles'],'unchanged_nonfabric_triangles':before['triangles']-len(old_ids),'other_modules_identical':len(objects)-1,'cloth_bounds':{k:new_components[0][k] for k in ('min','max')},'structural_bevel_on_cloth':False,'contact_rebaked':False,'blend_geometry_uv_paint_matches_runtime':True,'blend_normal_max_lsb_delta':normal_lsb_delta,'runtime_noncloth_normals_byte_identical':True,'new_materials':0,'new_draws':0}
with open(os.path.join(STAGE,'validation.json'),'w') as f:json.dump(report,f,indent=2)
print('AWNING_SURGERY_VALIDATED',json.dumps(report),flush=True)

if '--render' in sys.argv:
    for obj in objects.values():obj.hide_render=obj!=bakery
    origin=bakery.location.copy();target=origin+Vector((-2.7,-1,4.35))
    bpy.ops.object.camera_add(location=origin+Vector((-8.5,-12,8.0)))
    camera=bpy.context.object;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=9.0
    bpy.context.scene.camera=camera
    for location,energy,color in [((-7,-8,11),1350,(1,.83,.65)),((5,-4,8),650,(.75,.85,1))]:
        bpy.ops.object.light_add(type='AREA',location=origin+Vector(location));light=bpy.context.object;light.data.energy=energy;light.data.color=color;light.data.size=5;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=2;scene.world.color=(.30,.35,.42);scene.view_settings.view_transform='AgX'
    scene.render.resolution_x=720;scene.render.resolution_y=520;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(STAGE,'bakery-awning-preview.png')
    bpy.ops.render.render(write_still=True)
