"""Widen the accepted focal bakery display and canopy without rebuilding it.

Python --inspect reads actual connected component bounds. Blender -b -t 2
stages the editable mesh and matching exports after the target is selected.
"""
import base64, collections, hashlib, json, math, os, shutil, struct, sys
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE=os.path.join(ROOT,'audit','berlin-bakery-display-v99')
BASE=os.path.join(STAGE,'baseline');OUT=os.path.join(STAGE,'models')
KEY='13.5:0:1'
def unpack(record):
    out={}
    for name,fmt in [('position','f'),('normal','h'),('uv','f'),('color','B'),('index','H')]:
        raw=base64.b64decode(record[name]);out[name]=list(struct.unpack('<'+fmt*(len(raw)//struct.calcsize(fmt)),raw))
    return out
def components(raw):
    p=raw['position'];indices=raw['index'];lookup={};parents=[];weld=[]
    def find(i):
        while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
        return i
    for i in range(0,len(p),3):
        key=tuple(p[i:i+3])
        if key not in lookup:lookup[key]=len(parents);parents.append(len(parents))
        weld.append(lookup[key])
    for t in range(0,len(indices),3):
        a=find(weld[indices[t]])
        for j in (1,2):parents[find(weld[indices[t+j]])]=a
    groups={}
    for t in range(0,len(indices),3):
        g=groups.setdefault(find(weld[indices[t]]),{'faces':[],'vertices':set(),'min':[math.inf]*3,'max':[-math.inf]*3,'tiles':collections.Counter()})
        g['faces'].append(t//3)
        for v in indices[t:t+3]:
            g['vertices'].add(v)
            for k in range(3):g['min'][k]=min(g['min'][k],p[v*3+k]);g['max'][k]=max(g['max'][k],p[v*3+k])
        u=sum(raw['uv'][v*2] for v in indices[t:t+3])/3
        y=sum(raw['uv'][v*2+1] for v in indices[t:t+3])/3
        g['tiles'][math.floor(u*4)+math.floor((1-y)*4)*4]+=1
    return list(groups.values())

if '--inspect' in sys.argv:
    data=json.load(open(os.path.join(ROOT,'assets/models/berlin-reference-architecture-v1.json')))
    raw=unpack(data['meshes'][KEY]);groups=components(raw)
    print('META',json.dumps({k:v for k,v in data['meshes'][KEY].items() if k not in raw}))
    for i,g in enumerate(groups):
        if g['max'][1]<6.01 and g['max'][0]<4.0 and g['min'][2]>-1.30:
            print(json.dumps({'id':i,'triangles':len(g['faces']),'min':g['min'],'max':g['max'],'tiles':g['tiles']}))
    print('COMPONENTS',len(groups));sys.exit(0)

os.makedirs(BASE,exist_ok=True);os.makedirs(OUT,exist_ok=True)
hashes={}
for suffix in ('blend','glb','json','inline.js','atlas.png'):
    name='berlin-reference-architecture-v1'+('-'+suffix if suffix=='atlas.png' else '.'+suffix)
    target=os.path.join(BASE,name)
    if not os.path.exists(target):shutil.copyfile(os.path.join(ROOT,'assets','models',name),target)
    hashes[name]=hashlib.sha256(open(target,'rb').read()).hexdigest()
hash_path=os.path.join(BASE,'sha256.json')
if os.path.exists(hash_path):assert json.load(open(hash_path))==hashes,'Immutable baseline changed'
else:json.dump(hashes,open(hash_path,'w'),indent=2)
data=json.load(open(os.path.join(BASE,'berlin-reference-architecture-v1.json')))
original=data['meshes'][KEY];raw=unpack(original);groups=components(raw)
assert len(groups)==375
assert len(groups[170]['faces'])==4 and groups[170]['tiles']=={5:4}
assert len(groups[226]['faces'])==1756
assert abs(groups[170]['min'][0]+5.8765)<1e-5 and abs(groups[170]['max'][0]-.326)<1e-5
assert abs(groups[194]['min'][0]+6.75)<1e-5 and abs(groups[195]['max'][0]-1.3025)<1e-5
assert len(groups[205]['faces'])==84 and all(len(groups[i]['faces'])==68 for i in range(206,213))

# The runtime resizes this 13.5 m master to every frontage. Target the actual
# 11 m instance's opening, not the different procedural build(11) formula.
DISPLAY=set(range(170,182))|set(range(205,213))|{226}
PIERS={194,195};TARGET=DISPLAY|PIERS
CENTER=(groups[170]['min'][0]+groups[170]['max'][0])*.5
WIDTH=groups[170]['max'][0]-groups[170]['min'][0]
TARGET_WIDTH_11=5.53;SCALE=TARGET_WIDTH_11/(WIDTH*11/13.5)
def display_x(x):return CENTER+(x-CENTER)*SCALE
left_low,left_high=groups[194]['min'][0],groups[194]['max'][0]
right_low,right_high=groups[195]['min'][0],groups[195]['max'][0]
PIER_SCALES={194:(display_x(left_high)-left_low)/(left_high-left_low),
             195:(right_high-display_x(right_low))/(right_high-right_low)}
assert min(PIER_SCALES.values())>.5
def transformed_x(x,group):
    if group in DISPLAY:return display_x(x)
    if group==194:return left_low+(x-left_low)*PIER_SCALES[194]
    if group==195:return right_high+(x-right_high)*PIER_SCALES[195]
    return x
def factor(group):return SCALE if group in DISPLAY else PIER_SCALES[group]
def normal_transform(n,s):
    if not n[0] or (not n[1] and not n[2]):return list(n)
    nn=[n[0]/s,n[1],n[2]];length=math.sqrt(sum(x*x for x in nn))
    return [x/length for x in nn]
def f32(x):return struct.unpack('<f',struct.pack('<f',x))[0]
def point_key(p):return tuple(round(x,5) for x in p)

after_raw={k:list(v) for k,v in raw.items()};vertex_groups={};position_groups={};changed_faces=set()
for gi,g in enumerate(groups):
    if gi not in TARGET:continue
    changed_faces.update(g['faces'])
    for v in g['vertices']:
        assert v not in vertex_groups or vertex_groups[v]==gi
        vertex_groups[v]=gi
        p=tuple(raw['position'][v*3:v*3+3]);key=point_key(p)
        assert key not in position_groups or position_groups[key]==gi
        position_groups[key]=gi
        after_raw['position'][v*3]=f32(round(transformed_x(p[0],gi),5))
        n=raw['normal'][v*3:v*3+3]
        if n[0] and (n[1] or n[2]):after_raw['normal'][v*3:v*3+3]=[round(x*32767) for x in normal_transform(n,factor(gi))]
for gi,g in enumerate(groups):
    if gi not in TARGET:
        assert all(point_key(raw['position'][v*3:v*3+3]) not in position_groups for v in g['vertices']),'target must not share protected points'
after=dict(original)
for name,fmt in [('position','f'),('normal','h')]:after[name]=base64.b64encode(struct.pack('<'+fmt*len(after_raw[name]),*after_raw[name])).decode('ascii')
for name in ('uv','color','index','vertices','triangles','min','max'):assert after[name]==original[name]
assert [min(raw['position'][i::3]) for i in range(3)]==[min(after_raw['position'][i::3]) for i in range(3)]
assert [max(raw['position'][i::3]) for i in range(3)]==[max(after_raw['position'][i::3]) for i in range(3)]
for v in range(original['vertices']):
    if v not in vertex_groups:
        for name in ('position','normal'):assert after_raw[name][v*3:v*3+3]==raw[name][v*3:v*3+3]

def payload_hash(a,protected):
    digest=hashlib.sha256()
    for t in range(original['triangles']):
        if (t not in changed_faces)!=protected:continue
        for v in a['index'][t*3:t*3+3]:
            digest.update(struct.pack('<3f3h3B2f',*a['position'][v*3:v*3+3],*a['normal'][v*3:v*3+3],*a['color'][v*3:v*3+3],*a['uv'][v*2:v*2+2]))
    return digest.hexdigest()
assert payload_hash(raw,True)==payload_hash(after_raw,True)
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def tri_normal(a,t):
    p=[a['position'][v*3:v*3+3] for v in a['index'][t*3:t*3+3]]
    return cross([p[1][k]-p[0][k] for k in range(3)],[p[2][k]-p[0][k] for k in range(3)])
area_ratios=[];cosines=[]
for t in changed_faces:
    a,b=tri_normal(raw,t),tri_normal(after_raw,t);la=math.sqrt(sum(x*x for x in a));lb=math.sqrt(sum(x*x for x in b))
    assert la>1e-10 and lb>1e-10
    area_ratios.append(lb/la);cosines.append(sum(x*y for x,y in zip(a,b))/(la*lb))
assert min(area_ratios)>.5 and min(cosines)>.9
def xbounds(group):
    xs=[after_raw['position'][v*3] for v in groups[group]['vertices']];return min(xs),max(xs)
display_bounds=xbounds(170);frame_bounds=xbounds(205);cloth_bounds=xbounds(226);support_bounds=xbounds(212)
clearances={}
for width in (11,13.5,16):
    f=width/13.5
    clearances[str(width)]={'outerMasonry':(frame_bounds[0]-left_low)*f,'doorMasonry':(right_high-frame_bounds[1])*f,
        'canopyToLot':(support_bounds[0]+6.75)*f,'canopyToDoorSign':(groups[220]['min'][0]-support_bounds[1])*f,
        'lowerSillsGap':(groups[213]['min'][0]-xbounds(206)[1])*f}
    assert min(clearances[str(width)].values())>.12
assert abs((display_bounds[1]-display_bounds[0])*11/13.5-5.53)<1e-5
after['displayRevision']='wider-coherent-display-v99';after['primaryDisplayWidth11']=5.53;after['primaryDisplayScaleX']=SCALE
updated=dict(data);updated['meshes']=dict(data['meshes']);updated['meshes'][KEY]=after
updated['source']='Blender 5.2 / tools/stage_berlin_bakery_display_v99.py'
for key in data['meshes']:
    if key!=KEY:assert updated['meshes'][key]==data['meshes'][key]

manifest={'version':99,'targetMaster':KEY,'indexPayloadUnchanged':True,'centerX':CENTER,'displayScaleX':SCALE,
          'sourceRecordPositionSha256':hashlib.sha256(base64.b64decode(original['position'])).hexdigest(),
          'targetRecordPositionSha256':hashlib.sha256(base64.b64decode(after['position'])).hexdigest(),
          'components':[{'id':gi,'role':'display' if gi in DISPLAY else 'outer-pier' if gi==194 else 'door-pier',
                         'xScale':factor(gi),'anchorX':CENTER if gi in DISPLAY else left_low if gi==194 else right_high,
                         'faces':groups[gi]['faces'],'vertices':sorted(groups[gi]['vertices']),
                         'oldMin':groups[gi]['min'],'oldMax':groups[gi]['max'],'newXBounds':xbounds(gi)} for gi in sorted(TARGET)]}
json.dump(manifest,open(os.path.join(STAGE,'transform-manifest.json'),'w'),indent=2)

# Change only the corresponding GLB position/normal scalars. This retains every
# non-target binary byte, including all other eleven modules and atlas image.
glb_path=os.path.join(BASE,'berlin-reference-architecture-v1.glb')
glb_before=open(glb_path,'rb').read();glb=bytearray(glb_before);at=12;doc=None;binary_start=None
while at<len(glb):
    length,kind=struct.unpack_from('<II',glb,at)
    if kind==0x4e4f534a:doc=json.loads(glb[at+8:at+8+length])
    if kind==0x004e4942:binary_start=at+8
    at+=8+length
node=next(n for n in doc['nodes'] if n.get('extras',{}).get('runtime_key')==KEY)
primitive=doc['meshes'][node['mesh']]['primitives'][0]
def glb_attribute(name):
    a=doc['accessors'][primitive['attributes'][name]];view=doc['bufferViews'][a['bufferView']]
    assert a['componentType']==5126 and a['type']=='VEC3'
    return a['count'],binary_start+view.get('byteOffset',0)+a.get('byteOffset',0),view.get('byteStride',12)
count,po,ps=glb_attribute('POSITION');nc,no,ns=glb_attribute('NORMAL');assert count==nc
allowed=set();glb_changed=0
for i in range(count):
    p=struct.unpack_from('<3f',glb,po+i*ps);gi=position_groups.get(point_key(p))
    if gi is None:continue
    x=f32(round(transformed_x(p[0],gi),5));struct.pack_into('<f',glb,po+i*ps,x);allowed.update(range(po+i*ps,po+i*ps+4))
    n=struct.unpack_from('<3f',glb,no+i*ns)
    if n[0] and (n[1] or n[2]):
        struct.pack_into('<3f',glb,no+i*ns,*normal_transform(n,factor(gi)));allowed.update(range(no+i*ns,no+i*ns+12))
    glb_changed+=1
assert glb_changed>1000
assert all(a==b or i in allowed for i,(a,b) in enumerate(zip(glb_before,glb)))
open(os.path.join(OUT,'berlin-reference-architecture-v1.glb'),'wb').write(glb)

# Edit the native accepted mesh in place. Every color and UV value remains
# stored as before; only the selected coordinates and their normal transforms
# change. Keep the original full-precision normals for protected corners.
import bpy
from mathutils import Vector
bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,'berlin-reference-architecture-v1.blend'))
bpy.context.preferences.filepaths.save_version=0
objects={o['runtime_key']:o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('runtime_key')}
obj=objects[KEY];mesh=obj.data
points=[v.co.copy() for v in mesh.vertices];normals=[tuple(n.vector) for n in mesh.corner_normals]
colors=[tuple(c.color) for c in mesh.color_attributes['Color'].data];uvs=[tuple(u.uv) for u in mesh.uv_layers.active.data]
native_groups={}
for v,p in enumerate(points):
    gi=position_groups.get(point_key((p.x,p.z,-p.y)))
    if gi is not None:native_groups[v]=gi;mesh.vertices[v].co.x=f32(round(transformed_x(p.x,gi),5))
for li,loop in enumerate(mesh.loops):
    gi=native_groups.get(loop.vertex_index)
    if gi is not None:normals[li]=normal_transform(normals[li],factor(gi))
mesh.update();mesh.normals_split_custom_set(normals)
assert colors==[tuple(c.color) for c in mesh.color_attributes['Color'].data]
assert uvs==[tuple(u.uv) for u in mesh.uv_layers.active.data]
for v,p in enumerate(points):
    q=mesh.vertices[v].co;assert q.y==p.y and q.z==p.z
    if v not in native_groups:assert q.x==p.x
mesh.calc_loop_triangles();assert len(mesh.loop_triangles)==original['triangles']
actual_positions={(v.co.x,v.co.z,-v.co.y) for v in mesh.vertices}
assert actual_positions=={tuple(after_raw['position'][v*3:v*3+3]) for v in range(original['vertices'])}
obj['display_revision']='wider coherent main display and continuous canopy v99';obj['primary_display_width_at_11m']=5.53
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.blend'))

for suffix in ('json','inline.js'):
    with open(os.path.join(OUT,'berlin-reference-architecture-v1.'+suffix),'w') as f:
        f.write(('var BERLIN_REFERENCE_ARCHITECTURE = ' if suffix=='inline.js' else '')+json.dumps(updated,separators=(',',':'))+(';\n' if suffix=='inline.js' else ''))
shutil.copyfile(os.path.join(BASE,'berlin-reference-architecture-v1-atlas.png'),os.path.join(OUT,'berlin-reference-architecture-v1-atlas.png'))
report={'targetMaster':KEY,'baselineSha256':hashes,'sameTriangles':original['triangles'],'sameVertices':original['vertices'],
    'displayComponents':len(DISPLAY),'pierComponents':2,'targetTriangles':len(changed_faces),'protectedTriangles':original['triangles']-len(changed_faces),
    'protectedPositionNormalColorUVSha256':payload_hash(after_raw,True),'protectedPayloadExact':True,'otherRecordsByteExact':11,
    'allUVColorIndexBytesExact':True,'atlasBytesExact':True,'completeBoundsExact':True,'noAddedMaterialsTexturesOrDraws':True,
    'oldWidth11':WIDTH*11/13.5,'newWidth11':(display_bounds[1]-display_bounds[0])*11/13.5,'xScale':SCALE,
    'masterCenterX':CENTER,'newCanopyWidth11':(cloth_bounds[1]-cloth_bounds[0])*11/13.5,'clearances':clearances,
    'minimumAreaRatio':min(area_ratios),'maximumAreaRatio':max(area_ratios),'minimumFaceNormalCosine':min(cosines),
    'glbChangedVertices':glb_changed,'glbNonTargetBinaryBytesExact':True,'nativeChangedVertices':len(native_groups),
    'nativeUVColorsExact':True,'nativePositionSetEqualsRuntime':True,'noBakeRepeated':True,'runtimeNormalTransform':'inverse transpose of positive horizontal affine scale'}
json.dump(report,open(os.path.join(STAGE,'validation.json'),'w'),indent=2)
print('BAKERY_DISPLAY_V99_STAGED',json.dumps(report),flush=True)
