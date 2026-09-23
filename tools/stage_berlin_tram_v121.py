"""Stage a more legible vintage tram front without adding triangles or batches.

Run with Blender -b -t 2 --python tools/stage_berlin_tram_v121.py.
Only writes audit/berlin-parity-tram-v121. Source meshes/UVs/topology stay intact;
the world-space deformation is baked into both native Blender and runtime data.
"""
import bpy,base64,copy,json,math,shutil,struct
from pathlib import Path
from mathutils import Vector,Matrix,Quaternion
ROOT=Path(__file__).resolve().parents[1]
STAGE=ROOT/'audit/berlin-parity-tram-v121';BASE=STAGE/'baseline';OUT=STAGE/'models'
BASE.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
PREFIX='berlin-vintage-tram-v90'
for ext in ('blend','glb','json','inline.js'):
    target=BASE/(PREFIX+'.'+ext)
    if not target.exists():shutil.copyfile(ROOT/'assets/models'/(PREFIX+'.'+ext),target)
before=json.loads((BASE/(PREFIX+'.json')).read_text());after=copy.deepcopy(before)
assert before['proportionRevision']=='upright-coach-v114'
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def shape(p,name):
    x,y,z=p
    x*=1-.045*smooth(.65,1.65,y)
    number=int(name[5:]) if name.startswith('part_') else -1
    if 73<=number<=85:x*=1.25
    if number in (91,108):x*=1.5
    if number in (94,95,96,97,111,112,113,114):y-=.14
    rake=.22*smooth(1.35,3.2,p.y)*smooth(2.9,3.6,abs(z))
    z-=math.copysign(rake,z)
    return Vector((x,y,z))
def normal(p,n,name):
    eps=.00005;cols=[]
    for axis in range(3):
        a=p.copy();b=p.copy();a[axis]+=eps;b[axis]-=eps
        cols.append((shape(a,name)-shape(b,name))/(2*eps))
    jac=Matrix(cols).transposed()
    assert jac.determinant()>.45
    return (jac.inverted().transposed()@n).normalized()
def game(p):return Vector((p.x,p.z,-p.y))
def native(p):return Vector((p.x,-p.z,p.y))
def array(record,key,fmt):
    raw=base64.b64decode(record[key]);return struct.unpack('<'+fmt*(len(raw)//struct.calcsize(fmt)),raw)
def encode(values,fmt):return base64.b64encode(struct.pack('<'+fmt*len(values),*values)).decode()
low=Vector((1e9,1e9,1e9));high=-low
for part in after['parts']:
    name=part['mesh'];old=before['meshes'][name];record=after['meshes'][name]
    q=part['quaternion'];m=Matrix.LocRotScale(Vector(part['translation']),Quaternion((q[3],q[0],q[1],q[2])),Vector(part['scale']))
    inv=m.inverted();nm=inv.transposed().to_3x3();back=m.transposed().to_3x3()
    points=array(old,'position','f');normals=array(old,'normal','h');pp=[];nn=[]
    for i in range(0,len(points),3):
        p=m@Vector(points[i:i+3]);out=shape(p,name)
        world_n=(nm@Vector(normals[i:i+3])).normalized()
        local_n=(back@normal(p,world_n,name)).normalized()
        pp.extend(inv@out);nn.extend(max(-32767,min(32767,round(v*32767))) for v in local_n)
        for k in range(3):low[k]=min(low[k],out[k]);high[k]=max(high[k],out[k])
    record['position']=encode(pp,'f');record['normal']=encode(nn,'h')
    record['min']=[min(pp[i::3]) for i in range(3)];record['max']=[max(pp[i::3]) for i in range(3)]
    for key in ('uv','index','vertices','triangles'):assert record[key]==old[key]
    if name in ('part_091','part_108'):part['role']='cream'
bpy.ops.wm.open_mainfile(filepath=str(BASE/(PREFIX+'.blend')))
bpy.context.preferences.filepaths.save_version=0
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
cream=next(m for m in bpy.data.materials if 'cream' in m.name.lower())
for obj in objects:
    mesh=obj.data;inv=obj.matrix_world.inverted();nm=inv.transposed().to_3x3();back=obj.matrix_world.transposed().to_3x3()
    positions=[game(obj.matrix_world@v.co) for v in mesh.vertices]
    normals=[(back@native(normal(positions[l.vertex_index],game((nm@mesh.corner_normals[l.index].vector).normalized()),obj.name))).normalized() for l in mesh.loops]
    for v,p in zip(mesh.vertices,positions):v.co=inv@native(shape(p,obj.name))
    mesh.update();mesh.normals_split_custom_set(normals)
    if obj.name in ('part_091','part_108'):
        mesh.materials.clear();mesh.materials.append(cream);obj['material_role']='cream'
    obj['finish_revision']='raked-cab-visible-divider-v121'
assert sum(m['triangles'] for m in after['meshes'].values())==8200
assert low.x>=-1.25001 and high.x<=1.25001 and low.y>=-.00001 and high.y<=4.52001
assert low.z>=-4.00001 and high.z<=4.00001
after['source']='Blender 5.2 / tools/stage_berlin_tram_v121.py'
after['finishRevision']='raked-cab-visible-divider-v121'
after['renderBounds']={'min':list(low),'max':list(high)}
assert after['collisionContract']==before['collisionContract']
raw=json.dumps(after,separators=(',',':'))
(OUT/(PREFIX+'.json')).write_text(raw);(OUT/(PREFIX+'.inline.js')).write_text('var BERLIN_VINTAGE_TRAM_DATA = '+raw+';\n')
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/(PREFIX+'.glb')),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(PREFIX+'.blend')))
report={'stagedOnly':True,'triangles':8200,'addedTriangles':0,'addedDraws':0,'UVTopologyExact':True,'collisionContractExact':True,'renderBounds':after['renderBounds']}
(STAGE/'build-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
