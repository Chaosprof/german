"""Add the reference's substantial curved balcony to the refined bakery.

Blender -b -t 2 --python tools/stage_berlin_architecture_balcony_v114.py
No canonical assets or game HTML are changed. Every refined source attribute
remains an exact prefix, including all accepted fabric and window profiles.
"""
import os,sys,json,math,base64,struct,hashlib,shutil,ast,random
import bpy
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from berlin_mesh_pack import packed_geometry
STAGE=os.path.join(ROOT,'audit','berlin-model-forms-v114','architecture')
BASE=os.path.join(STAGE,'refined-models');OUT=os.path.join(STAGE,'balcony-models')
os.makedirs(OUT,exist_ok=True);PREFIX='berlin-reference-architecture-v1';KEY='13.5:0:1'
data=json.load(open(os.path.join(BASE,PREFIX+'.json')))
assert data['meshes'][KEY]['formsRevision']=='stepped-smooth-architecture-v114'
assert data['meshes'][KEY]['triangles']==17328
bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,PREFIX+'.blend'))
bpy.context.preferences.filepaths.save_version=0
objects={o['runtime_key']:o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('runtime_key')}
# Reuse the authored surface helpers, without executing/rebuilding the prior
# stage. All definitions are selected explicitly from the Python AST.
source=ast.parse(open(os.path.join(ROOT,'tools','stage_berlin_architecture_forms_v114.py')).read())
defs=[node for node in source.body if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in ('unpack','linear','outline','Forms')]
assert len(defs)==4
exec(compile(ast.Module(body=defs,type_ignores=[]),'<existing architecture surface helpers>','exec'))
obj=objects[KEY];form=Forms('Reference curved stone balcony V114',obj.data.materials[0])
CX=4.65;CZ=-.05;SX=1.14;LOW=-1.12;HIGH=.80

def at(angle,radius,height):return Vector((CX+math.sin(angle)*radius*SX,height,CZ+math.cos(angle)*radius))
def orient(points,faces,normals):
    out=[]
    for ids in faces:
        a,b,c=[Vector(points[i]) for i in ids[:3]];expect=sum((Vector(normals[i]) for i in ids),Vector())
        out.append(tuple(reversed(ids)) if (b-a).cross(c-a).dot(expect)<0 else tuple(ids))
    return out
def arc_section(profile,color,label,segments=24):
    # Continuous closed radial moulding: actual underside, front fascia and
    # balcony floor, with a softened roll between the broad stone surfaces.
    points=[];normals=[];shades=[];faces=[];M=len(profile);N=segments+1
    for j,(radius,yy,shade) in enumerate(profile):
        before=profile[(j-1)%M];after=profile[(j+1)%M];dr=after[0]-before[0];dy=after[1]-before[1]
        for i in range(N):
            angle=LOW+(HIGH-LOW)*i/segments;p=at(angle,radius,yy)
            tangent=Vector((math.cos(angle)*radius*SX,0,-math.sin(angle)*radius))
            across=Vector((math.sin(angle)*dr*SX,dy,math.cos(angle)*dr))
            normal=tangent.cross(across).normalized();points.append(p);normals.append(normal);shades.append(shade)
    for j in range(M):
        for i in range(segments):faces.append((j*N+i,j*N+i+1,((j+1)%M)*N+i+1,((j+1)%M)*N+i))
    # Separate flat end caps preserve the rounded longitudinal normals.
    for i,sign in [(0,-1),(segments,1)]:
        angle=LOW+(HIGH-LOW)*i/segments;normal=Vector((math.cos(angle)/SX,0,-math.sin(angle))).normalized()*sign
        ids=[]
        for radius,yy,shade in profile:ids.append(len(points));points.append(at(angle,radius,yy));normals.append(normal);shades.append(shade*.92)
        faces.append(tuple(ids))
    form.surface(points,orient(points,faces,normals),normals,color,shades,label)
def tube(path,radius,color,label,sides=4):
    points=[];normals=[];faces=[];N=len(path)
    for i,p in enumerate(path):
        tangent=(path[min(N-1,i+1)]-path[max(0,i-1)]).normalized()
        # Consistent radial frame around the whole balcony prevents an iron
        # arch from acquiring a twist when its tangent turns nearly vertical.
        u=Vector(((p.x-CX)/(SX*SX),0,p.z-CZ));u=(u-tangent*tangent.dot(u)).normalized();v=tangent.cross(u).normalized()
        for j in range(sides):
            a=2*math.pi*j/sides;n=u*math.cos(a)+v*math.sin(a)
            points.append(p+n*radius);normals.append(n)
    for i in range(N-1):
        for j in range(sides):faces.append((i*sides+j,(i+1)*sides+j,(i+1)*sides+(j+1)%sides,i*sides+(j+1)%sides))
    for i,sign in [(0,-1),(N-1,1)]:
        tangent=(path[min(N-1,i+1)]-path[max(0,i-1)]).normalized()*sign;ids=[]
        for j in range(sides):ids.append(len(points));points.append(points[i*sides+j]);normals.append(tangent)
        faces.append(tuple(ids))
    form.surface(points,orient(points,faces,normals),normals,color,label=label)
def corbel(angle):
    # Broad curved console under the balcony, embedded into the existing drum.
    profile=[(1.99,8.27),(2.12,8.28),(2.24,8.39),(2.34,8.54),(2.52,8.70),(2.63,8.76),(2.63,8.83),(1.99,8.83)]
    tangent=Vector((math.cos(angle),0,-math.sin(angle))).normalized()
    raw=[]
    for side in (-1,1):
        for radius,yy in profile:raw.append(at(angle,radius,yy)+tangent*(side*.14))
    faces=[];M=len(profile)
    for j in range(M):faces.append((j,(j+1)%M,(j+1)%M+M,j+M))
    faces.extend([tuple(range(M-1,-1,-1)),tuple(range(M,2*M))])
    # Flat broad console surfaces, with the profile's curved silhouette.
    points=[];normals=[];out=[]
    center=sum(raw,Vector())/len(raw)
    for ids in faces:
        pp=[raw[i] for i in ids];normal=(pp[1]-pp[0]).cross(pp[2]-pp[0]).normalized();mid=sum(pp,Vector())/len(pp)
        if normal.dot(mid-center)<0:pp.reverse();normal=-normal
        part=[]
        for p in pp:part.append(len(points));points.append(p);normals.append(normal)
        out.append(tuple(part))
    form.surface(points,out,normals,0xd5bf9e,label='sculpted balcony console')
def leaf(center,direction,width,length,color,tilt):
    # Opaque curved blade, with a six-point contour and a soft raised ridge.
    direction=direction.normalized();side=direction.cross(Vector((0,0,1)))
    if side.length<.1:side=direction.cross(Vector((0,1,0)))
    side.normalize();normal=side.cross(direction).normalized()
    if normal.z<0:normal=-normal
    normal=(normal+Vector((0,.7,0))).normalized()
    points=[center-direction*length,center-direction*length*.4+side*width*.82,center+direction*length*.36+side*width,center+direction*length,center+direction*length*.36-side*width,center-direction*length*.4-side*width*.82,center+normal*tilt,center-normal*tilt*.35]
    normals=[]
    for i,p in enumerate(points):
        if i<6:n=(normal*.65+(p-center).normalized()*.35).normalized()
        else:n=normal if i==6 else -normal
        normals.append(n)
    # Opposite corners need opposite shading normals as well as opposite
    # winding: duplicate their attributes while keeping a closed shared shape.
    points.extend(points[:6]);normals.extend([-n for n in normals[:6]])
    faces=[]
    for i in range(6):faces.extend([(6,i,(i+1)%6),(7,8+(i+1)%6,8+i)])
    form.surface(points,orient(points,faces,normals),normals,color,label='curved flowering balcony leaf')
def bloom(center,normal,size,color):
    normal=normal.normalized();right=normal.cross(Vector((0,1,0))).normalized();up=right.cross(normal).normalized()
    points=[];normals=[]
    for i in range(10):
        a=2*math.pi*i/10;r=size*(1 if i%2==0 else .62);p=center+right*(math.cos(a)*r)+up*(math.sin(a)*r)
        points.append(p);normals.append((normal+right*math.cos(a)*.32+up*math.sin(a)*.32).normalized())
    points.extend([center+normal*size*.20,center-normal*size*.10]);normals.extend([normal,-normal]);faces=[]
    points.extend(points[:10]);normals.extend([-n for n in normals[:10]])
    for i in range(10):faces.extend([(10,i,(i+1)%10),(11,12+(i+1)%10,12+i)])
    form.surface(points,orient(points,faces,normals),normals,color,label='five-lobed geranium bloom')

# One purposeful projecting balcony at the established floor break. The
# existing shallow balcony and flowerbox paint stay inside this assembly.
arc_section([(1.95,8.63,.76),(2.38,8.63,.79),(2.57,8.69,.86),(2.68,8.80,.93),(2.72,8.91,1),(2.72,9.035,1),(2.67,9.07,1),(1.95,9.07,.96)],0xe4cfaf,'moulded cream curved balcony slab',24)
for angle in (-.87,-.18,.54):corbel(angle)
iron=0x344f4a
for height,radius,thick in [(9.16,2.675,.026),(9.97,2.675,.035)]:
    tube([at(LOW+(HIGH-LOW)*i/24,radius,height) for i in range(25)],thick,iron,'continuous curved iron rail')
for i in range(8):
    angle=LOW+(HIGH-LOW)*i/7
    tube([at(angle,2.675,9.13),at(angle,2.675,10.00)],.028,iron,'iron balcony upright')
for i in range(7):
    a=LOW+(HIGH-LOW)*i/7+.014;b=LOW+(HIGH-LOW)*(i+1)/7-.014
    path=[at(a+(b-a)*j/8,2.675,9.20+math.sin(math.pi*j/8)*.55) for j in range(9)]
    tube(path,.020,iron,'arched balcony iron infill')
# A real dark trough sits behind the rail. Its foliage overlaps and hangs
# across the top edge, matching the reference's generous flowering mass.
arc_section([(2.35,9.62,.73),(2.57,9.62,.77),(2.60,9.78,.90),(2.60,9.83,.96),(2.35,9.83,.94)],0x3c5745,'curved balcony planter trough',18)
rng=random.Random(114)
for cluster in range(7):
    angle=LOW+.07+(HIGH-LOW-.14)*cluster/6;center=at(angle,2.57,9.85)
    radial=Vector((math.sin(angle),.1,math.cos(angle))).normalized();tangent=Vector((math.cos(angle),0,-math.sin(angle)))
    for j in range(6):
        a=j*2.39996+cluster*.47;spread=tangent*(math.cos(a)*.19)+radial*(math.sin(a)*.13)
        direction=(tangent*math.cos(a)+Vector((0,.50+math.sin(a)*.45,0))+radial*.45).normalized()
        if j==5:direction=(Vector((0,-1,0))+radial*.30).normalized()
        leaf(center+spread+Vector((0,(j%3)*.055,0)),direction,.105+rng.random()*.05,.19+rng.random()*.09,[0x637e43,0x81974f,0x4e713e][j%3],.034)
    bloom(center+radial*.08+Vector((0,.23,0)),radial+Vector((0,.50,0)),.125,[0xe5a99a,0xf1c9ad,0xdd9c95][cluster%3])
    bloom(center+radial*.15-tangent*.16+Vector((0,.11,0)),radial+Vector((0,.28,0)),.086,[0xf1c9ad,0xdd9c95,0xe5a99a][cluster%3])
    bloom(center+radial*.10+tangent*.14+Vector((0,.20,0)),radial+Vector((0,.32,0)),.093,[0xdd9c95,0xe5a99a,0xf1c9ad][cluster%3])

addition=form.native();addition.location=obj.location.copy();addon=packed_geometry(addition)
assert addon['triangles']<2800,addon['triangles']
original=data['meshes'][KEY];raw=unpack(original);extra=unpack(addon);after=dict(original);off=original['vertices']
for field in ('position','normal','uv','color'):after[field]=base64.b64encode(base64.b64decode(original[field])+base64.b64decode(addon[field])).decode('ascii')
ix=raw['index']+[i+off for i in extra['index']];after['vertices']=off+addon['vertices'];after['triangles']=original['triangles']+addon['triangles']
after['index']=base64.b64encode(struct.pack('<'+('H' if after['vertices']<65536 else 'I')*len(ix),*ix)).decode('ascii')
after['min']=[min(original['min'][i],addon['min'][i]) for i in range(3)];after['max']=[max(original['max'][i],addon['max'][i]) for i in range(3)]
after['balconyRevision']='sculpted-curved-balcony-v114';after['balconyBaseTriangles']=original['triangles'];after['balconyBaseVertices']=off
protected={}
for field in ('position','normal','color','uv','index'):
    old=base64.b64decode(original[field]);new=base64.b64decode(after[field]);assert new[:len(old)]==old
    protected[field]={'bytes':len(old),'sha256':hashlib.sha256(old).hexdigest()}
updated=dict(data);updated['meshes']=dict(data['meshes']);updated['meshes'][KEY]=after
updated['source']='Blender 5.2 / tools/stage_berlin_architecture_balcony_v114.py'
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);addition.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.join()
obj['balcony_revision']='substantial curved stone balcony with arched ironwork and flowering trough v114'
for suffix in ('.json','.inline.js'):
    with open(os.path.join(OUT,PREFIX+suffix),'w') as f:f.write(('var BERLIN_REFERENCE_ARCHITECTURE = ' if suffix=='.inline.js' else '')+json.dumps(updated,separators=(',',':'))+(';\n' if suffix=='.inline.js' else ''))
shutil.copyfile(os.path.join(BASE,PREFIX+'-atlas.png'),os.path.join(OUT,PREFIX+'-atlas.png'))
bpy.ops.object.select_all(action='DESELECT')
for ob in objects.values():
    ob.select_set(True);ob.data.color_attributes.active_color_index=ob.data.color_attributes.find('Color');ob.data.color_attributes.render_color_index=ob.data.color_attributes.find('Color')
bpy.context.view_layer.objects.active=obj
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,PREFIX+'.glb'),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True,export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=False,export_extras=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,PREFIX+'.blend'))
report={'originalTriangles':original['triangles'],'addedTriangles':addon['triangles'],'triangles':after['triangles'],'otherElevenRecordsExact':all(updated['meshes'][k]==data['meshes'][k] for k in data['meshes'] if k!=KEY),'originalPayloadPrefixExact':True,'protectedPrefixes':protected,'appendedGeometryBounds':[addon['min'],addon['max']],'boundsBefore':[original['min'],original['max']],'boundsAfter':[after['min'],after['max']],'parts':form.parts,'newMaterialDraws':0}
json.dump(report,open(os.path.join(STAGE,'balcony-forms-report.json'),'w'),indent=2)
print('BALCONY_STAGED',json.dumps({k:v for k,v in report.items() if k not in ('parts','protectedPrefixes')}),flush=True)
if '--render' in sys.argv:
    for ob in objects.values():ob.hide_render=ob!=obj
    loc=obj.location.copy()
    bpy.ops.object.camera_add(location=loc+Vector((11,-20,12)))
    camera=bpy.context.object;camera.rotation_euler=(loc+Vector((3.6,-1,8.3))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=8.6
    bpy.context.scene.camera=camera
    bpy.ops.object.light_add(type='AREA',location=loc+Vector((-9,-12,18)));light=bpy.context.object;light.data.energy=2100;light.data.shape='DISK';light.data.size=7
    light.rotation_euler=(loc+Vector((3,-1,8))-light.location).to_track_quat('-Z','Y').to_euler()
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100
    scene.world.color=(.33,.39,.49);scene.view_settings.view_transform='AgX';scene.render.filepath=os.path.join(STAGE,'balcony-preview.png');bpy.ops.render.render(write_still=True)
