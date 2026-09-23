"""Soften the existing canvas satchel while retaining its UVs and contact atlas."""
import bpy,base64,copy,json,math,shutil,struct
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1]
STAGE=ROOT/'audit/berlin-parity-courier-v120/bag';BASE=STAGE/'baseline';OUT=STAGE/'models'
BASE.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
PREFIX='berlin-courier-bag-v1'
for ext in ('blend','glb','json','inline.js'):
    target=BASE/(PREFIX+'.'+ext)
    if not target.exists():shutil.copyfile(ROOT/'assets/models'/(PREFIX+'.'+ext),target)
before=json.loads((BASE/(PREFIX+'.json')).read_text());after=copy.deepcopy(before)
def smooth(a,b,x):
    t=max(0,min(1,(x-a)/(b-a)));return t*t*(3-2*t)
def shape(p,key):
    x,y,z=p;front=1-smooth(-.74,-.20,z)
    if key=='flap':
        # A small bow in the lower hem makes the lid read as cloth. Both ends
        # remain sewn to the existing shoulder, preserving strap attachment.
        sag=.075*math.exp(-((x-.035)/.93)**4)*(1-smooth(.55,1.12,y))*front
        y-=sag;z-=.030*math.exp(-((x-.035)/.98)**2)*front
    elif key=='body':
        z-=.045*math.exp(-(x/1.03)**4)*math.exp(-((y+.28)/.8)**4)*front
    elif key=='pocket':
        z-=.025*math.exp(-((x-.025)/.81)**4)*math.exp(-((y+.73)/.35)**4)*front
    return Vector((x,y,z))
def normal(p,n,key):
    eps=.00005;cols=[]
    for axis in range(3):
        a=p.copy();b=p.copy();a[axis]+=eps;b[axis]-=eps
        cols.append((shape(a,key)-shape(b,key))/(2*eps))
    jac=Matrix(cols).transposed();assert jac.determinant()>.75
    return (jac.inverted().transposed()@n).normalized()
def game(p):return Vector((p.x,p.z,-p.y))
def native(p):return Vector((p.x,-p.z,p.y))
def array(m,key,fmt):
    raw=base64.b64decode(m[key]);return struct.unpack('<'+fmt*(len(raw)//struct.calcsize(fmt)),raw)
def encode(values,fmt):return base64.b64encode(struct.pack('<'+fmt*len(values),*values)).decode()
maximum=0
for key,m in after['meshes'].items():
    old=before['meshes'][key];p=array(old,'position','f');n=array(old,'normal','h');pp=[];nn=[]
    for i in range(0,len(p),3):
        v=Vector(p[i:i+3]);out=shape(v,key);maximum=max(maximum,(out-v).length)
        pp.extend(out);nn.extend(max(-32767,min(32767,round(c*32767))) for c in normal(v,Vector(n[i:i+3]).normalized(),key))
    m['position']=encode(pp,'f');m['normal']=encode(nn,'h');m['min']=[min(pp[i::3]) for i in range(3)];m['max']=[max(pp[i::3]) for i in range(3)]
    for field in ('uv','color','index','vertices','triangles'):assert m[field]==old[field]
bpy.ops.wm.open_mainfile(filepath=str(BASE/(PREFIX+'.blend')))
bpy.context.preferences.filepaths.save_version=0
objects={o['runtime_key']:o for o in bpy.data.objects if o.type=='MESH' and 'runtime_key' in o}
assert set(objects)==set(after['meshes'])
for key,obj in objects.items():
    mesh=obj.data;points=[game(v.co) for v in mesh.vertices]
    normals=[native(normal(points[l.vertex_index],game(mesh.corner_normals[l.index].vector),key)) for l in mesh.loops]
    for v,p in zip(mesh.vertices,points):v.co=native(shape(p,key))
    mesh.update();mesh.normals_split_custom_set(normals);obj['finish_revision']='soft-sagging-canvas-v120'
assert after['atlas']==before['atlas'] and maximum<.085
assert sum(m['triangles'] for m in after['meshes'].values())==2588
after['source']='Blender 5.2 / tools/stage_berlin_bag_v120.py';after['finishRevision']='soft-sagging-canvas-v120'
raw=json.dumps(after,separators=(',',':'))
(OUT/(PREFIX+'.json')).write_text(raw);(OUT/(PREFIX+'.inline.js')).write_text('var BERLIN_COURIER_BAG_DATA = '+raw+';\n')
bpy.ops.object.select_all(action='DESELECT')
for o in objects.values():o.hide_set(False);o.hide_render=False;o.select_set(True)
bpy.context.view_layer.objects.active=objects['body']
bpy.ops.export_scene.gltf(filepath=str(OUT/(PREFIX+'.glb')),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(PREFIX+'.blend')))
report={'stagedOnly':True,'triangles':2588,'addedVertices':0,'addedDraws':0,'maxMoveInBagRadiusUnits':maximum,'atlasUVColorsTopologyExact':True}
(STAGE/'build-report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True)
