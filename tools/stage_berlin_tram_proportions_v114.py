"""Baked upright vintage coach proportions; no added runtime geometry or work."""
import bpy, base64, copy, json, math, os, struct, sys
from mathutils import Vector, Matrix, Quaternion
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'audit/berlin-model-forms-v114/tram/models'
OUT=ROOT/'audit/berlin-model-forms-v114/tram/upright/models'
OUT.mkdir(parents=True,exist_ok=True)
PREFIX='berlin-vintage-tram-v90'
before=json.loads((BASE/(PREFIX+'.json')).read_text()); after=copy.deepcopy(before)

def smooth(a,b,y):
    t=max(0,min(1,(y-a)/(b-a)))
    return t*t*(3-2*t),6*t*(1-t)/(b-a) if a<y<b else 0

def frame(y):
    h,dh=smooth(.7,2.8,y); s,ds=smooth(1.25,2.8,y)
    return 1-.035*s,-.035*ds,.42*h,1+.42*dh

def shape(p):
    s,ds,h,dh=frame(p.y)
    return Vector((p.x*s,p.y+h,p.z))

def normal(p,n):
    s,ds,h,dh=frame(p.y)
    return Vector((n.x/s,(n.y-p.x*ds*n.x/s)/dh,n.z)).normalized()

def game(p):return Vector((p.x,p.z,-p.y))
def native(p):return Vector((p.x,-p.z,p.y))
def arr(record,key,fmt):
    b=base64.b64decode(record[key]);return list(struct.unpack('<'+fmt*(len(b)//struct.calcsize(fmt)),b))
def enc(values,fmt):return base64.b64encode(struct.pack('<'+fmt*len(values),*values)).decode()

low=Vector((1e9,1e9,1e9));high=-low
for part in after['parts']:
    old=before['meshes'][part['mesh']]; out=after['meshes'][part['mesh']]
    t=Vector(part['translation']); q=part['quaternion']; scale=Vector(part['scale'])
    mat=Matrix.LocRotScale(t,Quaternion((q[3],q[0],q[1],q[2])),scale)
    inv=mat.inverted(); nmat=inv.transposed().to_3x3(); back=mat.transposed().to_3x3()
    p=arr(old,'position','f');n=arr(old,'normal','h');result=[];norm=[]
    for i in range(0,len(p),3):
        world=mat@Vector(p[i:i+3]); moved=shape(world); local=inv@moved
        world_n=(nmat@Vector(n[i:i+3])).normalized()
        local_n=(back@normal(world,world_n)).normalized()
        result.extend(local);norm.extend(max(-32767,min(32767,round(v*32767))) for v in local_n)
        for k in range(3):low[k]=min(low[k],moved[k]);high[k]=max(high[k],moved[k])
    out['position']=enc(result,'f');out['normal']=enc(norm,'h')
    out['min']=[min(result[i::3]) for i in range(3)];out['max']=[max(result[i::3]) for i in range(3)]
    for field in ('index','uv','triangles','vertices'):assert out[field]==old[field]

bpy.ops.wm.open_mainfile(filepath=str(BASE/(PREFIX+'.blend')))
bpy.context.preferences.filepaths.save_version=0
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
for obj in objects:
    mesh=obj.data; inverse=obj.matrix_world.inverted()
    nmat=inverse.transposed().to_3x3();back=obj.matrix_world.transposed().to_3x3()
    points=[game(obj.matrix_world@v.co) for v in mesh.vertices]
    normals=[(back@native(normal(points[l.vertex_index],game((nmat@mesh.corner_normals[l.index].vector).normalized())))).normalized() for l in mesh.loops]
    for v,p in zip(mesh.vertices,points):v.co=inverse@native(shape(p))
    mesh.update();mesh.normals_split_custom_set(normals)
    obj['proportion_revision']='Upright passenger cabin; roof taper; fixed contact footprint v114'

after['source']='Blender 5.2 / tools/stage_berlin_tram_proportions_v114.py'
after['proportionRevision']='upright-coach-v114'
after['renderBounds']={'min':list(low),'max':list(high)}
assert abs(high.y-4.52)<.00002 and high.x<=1.25 and low.x>=-1.25
assert after['parts']==before['parts'] and after['collisionContract']==before['collisionContract']
raw=json.dumps(after,separators=(',',':'))
(OUT/(PREFIX+'.json')).write_text(raw)
(OUT/(PREFIX+'.inline.js')).write_text('var BERLIN_VINTAGE_TRAM_DATA = '+raw+';\n')
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.export_scene.gltf(filepath=str(OUT/(PREFIX+'.glb')),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(PREFIX+'.blend')))
(OUT.parent/'build-report.json').write_text(json.dumps({'triangles':sum(m['triangles'] for m in after['meshes'].values()),'addedTriangles':0,'addedDraws':0,'partsTransformsExact':True,'allTopologyUVsExact':True,'collisionContractExact':True,'renderBounds':after['renderBounds']},indent=2))
print('UPRIGHT_TRAM_STAGED',after['renderBounds'],flush=True)
if '--render' in sys.argv:
    scene=bpy.context.scene;scene.render.resolution_x=900;scene.render.resolution_y=700;scene.render.resolution_percentage=100
    scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.samples=16
    scene.camera.location=(6,12,5.4);scene.camera.rotation_euler=(Vector((0,0,2.05))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=9.6
    scene.render.filepath=str(OUT.parent/'tram-upright-preview.png');bpy.ops.render.render(write_still=True)
