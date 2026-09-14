"""Bake local architectural contact shade into the accepted Blender masters.

All output is staged. Runtime positions, normals, UVs and indices stay exactly
unchanged; the existing color bytes carry the bake. The saved baseline prevents
cumulative darkening when this script is rerun. Blender -b -t 2 --python ...
"""
import bpy,base64,collections,json,math,os,shutil,struct,sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE=os.path.join(ROOT,'audit','berlin-facade-contact-v76')
SOURCE=os.path.join(STAGE,'baseline');OUT=os.path.join(STAGE,'models')
os.makedirs(SOURCE,exist_ok=True);os.makedirs(OUT,exist_ok=True)
for suffix in ('blend','glb','json','inline.js','atlas.png'):
    name='berlin-reference-architecture-v1'+('-'+suffix if suffix=='atlas.png' else '.'+suffix)
    target=os.path.join(SOURCE,name)
    if not os.path.exists(target):shutil.copyfile(os.path.join(ROOT,'assets','models',name),target)
with open(os.path.join(SOURCE,'berlin-reference-architecture-v1.json')) as f:accepted=json.load(f)
bpy.ops.wm.open_mainfile(filepath=os.path.join(SOURCE,'berlin-reference-architecture-v1.blend'))
bpy.context.preferences.filepaths.save_version=0
objects={o['runtime_key']:o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('runtime_key')}

def unpack(record,key,fmt):
    raw=base64.b64decode(record[key]);return struct.unpack('<'+fmt*(len(raw)//struct.calcsize(fmt)),raw)

def components(points,indices):
    ids={};parents=[];weld=[]
    def find(i):
        while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
        return i
    for p in points:
        key=tuple(p)
        if key not in ids:ids[key]=len(parents);parents.append(len(parents))
        weld.append(ids[key])
    for a,b,c in indices:
        root=find(weld[a]);parents[find(weld[b])]=root;parents[find(weld[c])]=root
    groups={}
    for ti,face in enumerate(indices):groups.setdefault(find(weld[face[0]]),[]).append(ti)
    return list(groups.values())

updated=dict(accepted);updated['meshes']=dict(accepted['meshes']);report={}
for key in ('13.5:0:1','13.5:1:1'):
    original=accepted['meshes'][key];obj=objects[key]
    arrays={k:unpack(original,k,f) for k,f in [('position','f'),('normal','h'),('uv','f'),('color','B'),('index','H')]}
    points=[Vector((arrays['position'][i],-arrays['position'][i+2],arrays['position'][i+1])) for i in range(0,len(arrays['position']),3)]
    normals=[Vector((arrays['normal'][i]/32767,-arrays['normal'][i+2]/32767,arrays['normal'][i+1]/32767)).normalized() for i in range(0,len(arrays['normal']),3)]
    faces=[arrays['index'][i:i+3] for i in range(0,len(arrays['index']),3)]
    cloth=set()
    if key=='13.5:0:1':
        groups=components(points,faces)
        cloth_groups=[g for g in groups if len(g)==1756 and all(3.49<points[v].z<5.67 for ti in g for v in faces[ti])]
        assert len(cloth_groups)==1,'Protect the actual continuous cloth component'
        cloth={v for ti in cloth_groups[0] for v in faces[ti]}
    bvh=BVHTree.FromPolygons(points,faces,all_triangles=True,epsilon=.000001)
    result=list(arrays['color']);factors=[1.0]*original['vertices'];cache={};changed=0;protected=0
    for i,(point,normal) in enumerate(zip(points,normals)):
        u,v=arrays['uv'][i*2:i*2+2]
        tile=math.floor(u*4)+math.floor((1-v)*4)*4
        if tile!=1 or i in cloth:
            protected+=1;continue
        cache_key=(*[round(v,4) for v in point],*[round(v,3) for v in normal])
        if cache_key not in cache:
            axis=normal.cross(Vector((0,0,1)))
            if axis.length<.1:axis=normal.cross(Vector((0,1,0)))
            axis.normalize();other=normal.cross(axis).normalized();occlusion=0
            # Cosine-weighted local hemisphere: nearby returns and soffits
            # matter, distant opposite buildings do not darken whole walls.
            for sample in range(12):
                radius=math.sqrt((sample+.5)/12);azimuth=sample*2.399963229728653
                direction=normal*math.sqrt(1-radius*radius)+axis*(radius*math.cos(azimuth))+other*(radius*math.sin(azimuth))
                hit=bvh.ray_cast(point+normal*.015,direction,.82)
                if hit[0] is not None:occlusion+=max(0,1-hit[3]/.82)
            local=max(0,occlusion/12-.035)
            factor=1-.52*local
            # Pale downward trim surfaces need a distinct warm underside.
            # Exposed vertical fronts retain their original paint values.
            if normal.z<-.82 and point.z>3.1:factor*=.87
            cache[cache_key]=max(.50,factor)
        factor=cache[cache_key];factors[i]=factor
        for k in range(3):result[i*3+k]=round(arrays['color'][i*3+k]*factor)
        if result[i*3:i*3+3]!=list(arrays['color'][i*3:i*3+3]):changed+=1
    after=dict(original);after['color']=base64.b64encode(bytes(result)).decode('ascii')
    for attr in ('position','normal','uv','index','vertices','triangles','min','max'):assert after[attr]==original[attr],key+' changed '+attr
    for i in cloth:assert result[i*3:i*3+3]==list(arrays['color'][i*3:i*3+3]),'Cloth colors changed'
    # Transfer the same vertex paint to the editable mesh. Saved custom-normal
    # encoding can differ slightly from authoritative runtime packed normals;
    # position+UV+old paint find candidates, normal proximity selects a side.
    candidates={}
    for i,point in enumerate(points):
        lookup=(*[round(v,5) for v in point],*[round(v,6) for v in arrays['uv'][i*2:i*2+2]],*arrays['color'][i*3:i*3+3])
        candidates.setdefault(lookup,[]).append(i)
    mesh=obj.data;paint=mesh.color_attributes['Color'];uv=mesh.uv_layers.active.data
    assert paint.domain=='CORNER','Preserve independent return/front colors'
    old_points=[tuple(v.co) for v in mesh.vertices]
    old_normals=[tuple(n.vector) for n in mesh.corner_normals]
    paint_values=[]
    for loop in mesh.loops:
        point=mesh.vertices[loop.vertex_index].co;tex=uv[loop.index].uv;color=paint.data[loop.index].color
        lookup=(*[round(v,5) for v in point],*[round(v,6) for v in tex],*[round(v*255) for v in color[:3]])
        choices=candidates.get(lookup)
        assert choices,('Editable/runtime paint lookup mismatch',key,loop.index,lookup)
        normal=Vector(old_normals[loop.index]);index=max(choices,key=lambda i:normal.dot(normals[i]))
        paint_values.extend((*[v/255 for v in result[index*3:index*3+3]],1))
    paint.data.foreach_set('color',paint_values)
    assert old_points==[tuple(v.co) for v in mesh.vertices]
    assert old_normals==[tuple(n.vector) for n in mesh.corner_normals]
    obj['contact_shade_v76']='Localized 0.82m bake on solid plaster/trim; protected glass, rooms and cloth'
    updated['meshes'][key]=after
    report[key]={'changed_vertices':changed,'protected_vertices':protected,'minimum_factor':min(factors),'mean_factor':sum(factors)/len(factors),'triangles':original['triangles'],'bytes_unchanged':True,'geometry_normals_uv_indices_identical':True,'protected_cloth_vertices':len(cloth)}
    print('CONTACT_BAKED',key,json.dumps(report[key]),flush=True)
for key in accepted['meshes']:
    if key not in report:assert updated['meshes'][key]==accepted['meshes'][key]
updated['source']='Blender 5.2 / tools/stage_berlin_facade_contact.py'
with open(os.path.join(OUT,'berlin-reference-architecture-v1.json'),'w') as f:json.dump(updated,f,separators=(',',':'))
with open(os.path.join(OUT,'berlin-reference-architecture-v1.inline.js'),'w') as f:f.write('var BERLIN_REFERENCE_ARCHITECTURE = '+json.dumps(updated,separators=(',',':'))+';\n')
shutil.copyfile(os.path.join(SOURCE,'berlin-reference-architecture-v1-atlas.png'),os.path.join(OUT,'berlin-reference-architecture-v1-atlas.png'))
bpy.ops.object.select_all(action='DESELECT')
for obj in objects.values():obj.select_set(True)
bpy.context.view_layer.objects.active=objects['13.5:0:1']
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.glb'),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True,export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=False,export_extras=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.blend'))
with open(os.path.join(STAGE,'validation.json'),'w') as f:json.dump(report,f,indent=2)
print('FACADE_CONTACT_COMPLETE',flush=True)
