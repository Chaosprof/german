"""Replace large isolated bakery flowers with three-floret rounded clusters.

Run in Blender 5.2. Protected facade triangle corners stay byte-exact; all
other authoring records and the atlas are preserved. Only audit files change.
"""
import base64, collections, copy, json, math, pathlib, shutil, struct, sys
import bpy
import numpy as np
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit/berlin-parity-v138'
BASE, OUT = STAGE / 'baseline', STAGE / 'models'
NAME = 'berlin-reference-architecture-v1'
for folder in (BASE, OUT): folder.mkdir(parents=True, exist_ok=True)
for suffix in ('.json', '.inline.js', '.blend', '.glb', '-atlas.png'):
    if not (BASE/(NAME+suffix)).exists():
        shutil.copyfile(ROOT/'assets/models'/(NAME+suffix), BASE/(NAME+suffix))
sys.path.insert(0, str(ROOT/'tools'))
import stage_berlin_facade_planting_v86 as helpers
source = json.loads((BASE/(NAME+'.json')).read_text())
KEY = '13.5:0:1'
old = source['meshes'][KEY]
raw = helpers.unpack(old)
groups = helpers.components(raw)
selected = []
for group in groups:
    r, g, b = group['meanColor']
    extent = max(hi-lo for lo, hi in zip(group['min'], group['max']))
    if (len(group['faces']) in (20, 60) and group['tiles'] == [0]
            and .06 < extent < .36 and group['center'][1] > 6.2
            and r > g*1.25 and b > g*.60 and b > r*.25):
        selected.append(group)
assert collections.Counter(len(g['faces']) for g in selected) == {20:22, 60:45}

extra = {key: [] for key in helpers.FORMATS}
florets = []
def floret(center, normal, right, up, radius, color, phase):
    """Closed six-corner cup, front/back normals split along the thin rim."""
    rim = [center+radius*(right*math.cos(phase+i*math.tau/6)+up*math.sin(phase+i*math.tau/6))
           for i in range(6)]
    points = rim+[center+normal*radius*.38, center-normal*radius*.12]
    # Split front/back at the rim so the translucent-looking petals do not
    # become shaded spheres. The shader and opaque material are unchanged.
    points += list(rim)
    normals = []
    for i in range(6):
        tangent = (rim[i]-center)/radius
        normals.append((normal+tangent*.40).normalized())
    normals += [normal, -normal]
    normals += [(-normal+(rim[i]-center)/radius*.30).normalized() for i in range(6)]
    faces = []
    for i in range(6):
        faces.extend([(6,i,(i+1)%6),(7,8+(i+1)%6,8+i)])
    off = len(extra['position'])//3
    for i, point in enumerate(points):
        extra['position'].extend(round(v,5) for v in point)
        extra['normal'].extend(round(v*32767) for v in normals[i])
        shade = 1.04 if i==6 else .72 if i==7 or i>=8 else .91+.035*math.sin(i*1.9+phase)
        extra['color'].extend(max(0,min(255,round(v*shade))) for v in color)
        extra['uv'].extend((.125,.875))
    for face in faces:
        a,b,c=(points[i] for i in face)
        expected=sum((normals[i] for i in face), Vector())
        if (b-a).cross(c-a).dot(expected)<0: face=tuple(reversed(face))
        extra['index'].extend(off+i for i in face)
    florets.append({'center':list(center),'radius':radius})

removed = set()
for gi, group in enumerate(selected):
    removed.update(group['faces'])
    points = np.array([raw['position'][i*3:i*3+3] for i in sorted(group['vertices'])])
    center = Vector(points.mean(axis=0))
    _, basis = np.linalg.eigh(np.cov(points.T))
    normal = Vector(basis[:,0]).normalized()
    if normal.z<0: normal=-normal
    right = normal.cross(Vector((0,1,0))).normalized()
    up = right.cross(normal).normalized()
    radius = max(math.hypot((Vector(p)-center).dot(right),(Vector(p)-center).dot(up)) for p in points)
    color = [max(raw['color'][i*3+k] for i in group['vertices'])*.98 for k in range(3)]
    for fi in range(3):
        angle=gi*.83+fi*math.tau/3
        position=center+radius*.40*(right*math.cos(angle)+up*math.sin(angle))+normal*radius*(-.055 if fi==1 else -.10)
        floret(position,normal,right,up,radius*(.58,.54,.56)[fi],
               [v*(1,.97,1.02)[fi] for v in color],angle*.37)

extra = {key:tuple(values) for key,values in extra.items()}
after = helpers.splice([(raw,removed),(extra,set())], old)
for field in ('min','max'):
    assert all((a>=b-1e-6 if field=='min' else a<=b+1e-6) for a,b in zip(after[field],old[field]))
    after[field]=list(old[field])
after['plantingRevision']='rounded-floret-clusters-v138'
assert after['triangles']==old['triangles']-728
assert after['vertices']<=old['vertices']
protected=helpers.payloads(raw,removed)
newraw=helpers.unpack(after)
assert helpers.payloads(newraw,range(old['triangles']-len(removed),after['triangles']))==protected
updated=copy.deepcopy(source)
updated['meshes'][KEY]=after
updated['source']='Blender 5.2 / tools/stage_berlin_flowers_v138.py'
for key in source['meshes']:
    if key!=KEY: assert updated['meshes'][key]==source['meshes'][key]

# Rebuild the one native mesh from the protected runtime corners and new
# florets. All eleven other native objects remain as saved in the baseline.
bpy.ops.wm.open_mainfile(filepath=str(BASE/(NAME+'.blend')))
bpy.context.preferences.filepaths.save_version=0
objects={o['runtime_key']:o for o in bpy.data.objects if o.type=='MESH' and o.get('runtime_key')}
target=objects[KEY];material=target.data.materials[0]
mesh=bpy.data.meshes.new('Rounded clustered geranium florets v138')
p=newraw['position'];idx=newraw['index'];norm=newraw['normal'];col=newraw['color'];tex=newraw['uv']
mesh.from_pydata([(p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3)],[],[idx[i:i+3] for i in range(0,len(idx),3)])
mesh.update();uv=mesh.uv_layers.new(name='UVMap');paint=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
for i,c in enumerate(paint.data): c.color=(*[v/255 for v in col[i*3:i*3+3]],1)
custom=[]
for loop in mesh.loops:
    i=loop.vertex_index;uv.data[loop.index].uv=tex[i*2:i*2+2]
    n=Vector(norm[i*3:i*3+3]).normalized();custom.append((n.x,-n.z,n.y))
for face in mesh.polygons: face.use_smooth=True
mesh.normals_split_custom_set(custom);mesh.materials.append(material);target.data=mesh
target['planting_revision']='rounded-floret-clusters-v138'
(OUT/(NAME+'.json')).write_text(json.dumps(updated,separators=(',',':')))
(OUT/(NAME+'.inline.js')).write_text('var BERLIN_REFERENCE_ARCHITECTURE = '+json.dumps(updated,separators=(',',':'))+';\n')
shutil.copyfile(BASE/(NAME+'-atlas.png'),OUT/(NAME+'-atlas.png'))
bpy.ops.object.select_all(action='DESELECT')
for obj in objects.values():
    obj.select_set(True);obj.data.color_attributes.active_color_index=obj.data.color_attributes.find('Color');obj.data.color_attributes.render_color_index=obj.data.color_attributes.find('Color')
bpy.context.view_layer.objects.active=target
bpy.ops.export_scene.gltf(filepath=str(OUT/(NAME+'.glb')),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True,export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=False,export_extras=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(NAME+'.blend')))
report={'beforeTriangles':old['triangles'],'afterTriangles':after['triangles'],'beforeVertices':old['vertices'],'afterVertices':after['vertices'],
        'oldBlooms':len(selected),'newFlorets':len(florets),'removedFaces':sorted(removed),'protectedTriangles':old['triangles']-len(removed),
        'protectedCornerSha256':helpers.payload_hash(protected),'florets':florets,'otherElevenRecordsExact':True,'addedDraws':0,'addedTextures':0}
(STAGE/'flowers.json').write_text(json.dumps(report,indent=2))
print('FLOWERS_V138_COMPLETE',json.dumps({k:v for k,v in report.items() if k not in ('removedFaces','florets')}),flush=True)
