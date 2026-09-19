"""Stage a layered street shrub without rebuilding accepted trees or the pot.

blender.exe -b -t 2 --python tools/stage_berlin_layered_planter_v95.py -- --render
Outputs stay in audit/berlin-layered-planter-v95. The immutable baseline is
created once; every subsequent build validates its hashes before opening it.
"""
import ast, base64, copy, hashlib, json, math, pathlib, random, shutil, struct, sys
import bpy, bmesh
from mathutils import Vector

ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit/berlin-layered-planter-v95'
BASE = STAGE / 'baseline'
OUT = STAGE / 'models'
NAME = 'berlin-kiez-garden-v1'
for directory in (BASE, OUT): directory.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(ROOT / 'tools'))
from berlin_mesh_pack import packed_geometry

def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def unpack(record, key, fmt):
    raw = base64.b64decode(record[key]); return struct.unpack('<' + fmt * (len(raw) // struct.calcsize(fmt)), raw)
def encode(fmt, values): return base64.b64encode(struct.pack('<' + fmt * len(values), *values)).decode()

hashfile = BASE / 'sha256.json'
if not hashfile.exists():
    for suffix in ('.json', '.inline.js', '.blend', '.glb', '-atlas.jpg'):
        shutil.copyfile(ROOT / 'assets/models' / (NAME + suffix), BASE / (NAME + suffix))
    source = (ROOT / 'tools/build_berlin_garden.py').read_text(encoding='utf-8')
    parsed = ast.parse(source)
    helper = '\n\n'.join(ast.get_source_segment(source, node) for node in parsed.body
        if isinstance(node, (ast.FunctionDef, ast.ClassDef)) and node.name in ('linear', 'MeshBuilder'))
    (BASE / 'mesh_builder.py').write_text(helper, encoding='utf-8')
    hashfile.write_text(json.dumps({p.name: sha(p) for p in BASE.iterdir() if p.is_file()}, indent=2))
hashes = json.loads(hashfile.read_text())
for filename, digest in hashes.items(): assert sha(BASE / filename) == digest, 'Immutable baseline changed: ' + filename
before = json.loads((BASE / (NAME + '.json')).read_text())
oldrecord = before['meshes']['planter']
bpy.ops.wm.open_mainfile(filepath=str(BASE / (NAME + '.blend')))
bpy.context.preferences.filepaths.save_version = 0
old = bpy.data.objects['Kiez_Flower_Planter']
material = old.data.materials[0]
ICO_TEMPLATES = {}
exec(compile((BASE / 'mesh_builder.py').read_text(), str(BASE / 'mesh_builder.py'), 'exec'), globals())

def mesh_digest(obj):
    mesh = obj.data
    values = {'v': [tuple(v.co) for v in mesh.vertices], 'f': [tuple(p.vertices) for p in mesh.polygons],
              'n': [tuple(n.vector) for n in mesh.corner_normals],
              'uv': [tuple(t.uv) for t in mesh.uv_layers.active.data],
              'c': [tuple(c.color) for c in mesh.color_attributes['Color'].data]}
    return hashlib.sha256(json.dumps(values, separators=(',', ':')).encode()).hexdigest()
tree_digests = {ob.name: mesh_digest(ob) for ob in bpy.data.objects if ob.type == 'MESH' and ob.name.startswith('Kiez_Tree')}

# Opaque, overlapping leaves form the shrub itself: no hidden hard green cores.
shrub = MeshBuilder()
rng = random.Random(95173)
shoots = [((-.09,.02,1.78), .037), ((.14,.02,1.65), .032),
          ((-.31,-.11,1.24), .028), ((.33,.10,1.41), .028),
          ((.04,.30,1.46), .025), ((.08,-.32,1.17), .025), ((-.22,.19,1.59), .026)]
for end, radius in shoots:
    p = Vector(end)
    shrub.tube([(-.04,.015,.842), tuple(Vector((-.04,.015,.86)).lerp(p,.47)+Vector((-.045,.025,0))), end],
               [radius, radius*.58, .0048], 5, (105,112,52))
for i in range(8):
    angle = math.tau * i / 8 + .4
    p = Vector((math.cos(angle)*.18, math.sin(angle)*.16, 1.12+(i%3)*.16))
    q = p + Vector((math.cos(angle)*.22, math.sin(angle)*.20, .14))
    shrub.tube([tuple(p), tuple(q)], [.0105,.0027], 4, (108,125,53))
branch_triangles = len(shrub.f)
lobes = [((-.06,.06,1.23),(.32,.27,.30),170),
         ((-.08,.02,1.52),(.255,.24,.31),180),
         ((.025,.045,1.76),(.15,.15,.08),42),
         ((-.30,-.11,1.07),(.24,.25,.18),72),
         ((.31,.09,1.19),(.245,.26,.23),78),
         ((.04,.29,1.22),(.28,.20,.23),50),
         ((.07,-.34,1.00),(.29,.19,.18),48)]
leaf_start = len(shrub.f)
for li, (center, radii, count) in enumerate(lobes):
    c = Vector(center)
    for j in range(count):
        z = 1-2*(j+.5)/count
        angle = j*2.3999632297 + li*.67 + rng.uniform(-.24,.24)
        radial = math.sqrt(1-z*z)
        depth = rng.uniform(.60,1.0) if j%4 else rng.uniform(.30,.70)
        unit = Vector((radial*math.cos(angle),radial*math.sin(angle),z))
        p = c + Vector(tuple(unit[k]*radii[k]*depth for k in range(3)))
        length = rng.uniform(.069,.090)
        width = length*rng.uniform(.60,.74)
        # Turn the broad leaf faces toward each clump's exterior. Upright,
        # varied planes replace the first candidate's horizontal shelves;
        # random-call order stays fixed, preserving every authored color.
        tilt = rng.uniform(math.radians(35),math.radians(70))
        azimuth = angle + math.pi + rng.uniform(-.42,.42)
        # Interior shades are coherent per leaf, not per-face noise.
        lit = .76 + .20*depth + .06*(z*.5+.5)
        base = ((132,161,66),(146,167,72),(157,177,77),(118,151,62))[li%4]
        color = tuple(round(t*lit*rng.uniform(.96,1.02)) for t in base)
        start = len(shrub.v)
        shrub.oval_leaf(tuple(p), length, width, azimuth, tilt, color,
                        roll=rng.uniform(-.45,.45), curved=True)
        # Lower leaves spread over the rim without changing the root datum.
        lift = max(0, .895-min(v[2] for v in shrub.v[start:]))
        if lift: shrub.v[start:] = [(x,y,z+lift) for x,y,z in shrub.v[start:]]
assert len(shrub.f)-leaf_start == 640*8

flower_start = len(shrub.f)
clusters = [(-.40,-.24,1.22),(.34,-.25,1.27),(.18,.34,1.34),(-.20,.10,1.76),(.35,.11,1.10)]
palettes = [(242,157,169),(249,210,182),(235,141,159),(249,218,190),(239,161,168)]
for k, point in enumerate(clusters):
    for h in range(4):
        a = h*math.tau/4 + k*.6
        center = Vector(point)+Vector((math.cos(a)*.067,math.sin(a)*.067,(h%2)*.035))
        normal = Vector((center.x*.80,center.y*.80,.78)).normalized()
        u = normal.cross(Vector((0,1,0))).normalized(); v = normal.cross(u).normalized()
        shrub.tube([tuple(center-Vector((center.x*.08,center.y*.08,.10))),tuple(center)], [.0044,.0018], 3, (113,138,60))
        for petal in range(5):
            ang = petal*math.tau/5+k*.26
            d = u*math.cos(ang)+v*math.sin(ang); across = normal.cross(d)
            pc = center+d*.037
            vertices = [pc+d*.045,pc+across*.030,pc-d*.035,pc-across*.030,pc+normal*.013,pc-normal*.003]
            faces = []
            for edge in range(4): faces.extend(((4,edge,(edge+1)%4),(5,(edge+1)%4,edge)))
            colors = [linear(tuple(round(t*f) for t in palettes[k])) for f in (1,.99,.91,.98,1,.88)]
            shrub.add([tuple(p) for p in vertices],faces,colors)
        eye = center+normal*.017
        vertices = [eye+u*.016,eye+v*.016,eye-u*.016,eye-v*.016,eye+normal*.012,eye-normal*.006]
        faces = []
        for edge in range(4): faces.extend(((4,edge,(edge+1)%4),(5,(edge+1)%4,edge)))
        shrub.add([tuple(p) for p in vertices],faces,[linear((222,180,85))]*4+[linear((247,216,122)),linear((176,133,56))])
assert len(shrub.f)-flower_start == 20*56

# Exact old envelope, using one affine fit before generating native normals.
target_min=(-.56734,-.52996,.842);target_max=(.59477,.55551,1.85933)
low=[min(p[i] for p in shrub.v) for i in range(3)]
high=[max(p[i] for p in shrub.v) for i in range(3)]
scale=[(target_max[i]-target_min[i])/(high[i]-low[i]) for i in range(3)]
shrub.v=[tuple(target_min[i]+(p[i]-low[i])*scale[i] for i in range(3)) for p in shrub.v]
for fi,normals in enumerate(shrub.corner_n):
    if normals is not None:
        shrub.corner_n[fi]=[tuple(Vector(tuple(n[i]/scale[i] for i in range(3))).normalized()) for n in normals]
newplant=shrub.object('V95 layered shrub authoring')
plantrecord=packed_geometry(newplant)

# The pot's rendering attribute bytes are protected, including sharp normals.
pot_indices=unpack(oldrecord,'index','H')[:180*3]
pot_vertex_count=max(pot_indices)+1
record={}
for key,stride in [('position',12),('normal',6),('color',3),('uv',8)]:
    record[key]=base64.b64encode(base64.b64decode(oldrecord[key])[:pot_vertex_count*stride]+base64.b64decode(plantrecord[key])).decode()
record['index']=encode('H',list(pot_indices)+[v+pot_vertex_count for v in unpack(plantrecord,'index','H')])
record.update(vertices=pot_vertex_count+plantrecord['vertices'],triangles=180+plantrecord['triangles'],min=oldrecord['min'],max=oldrecord['max'])
assert record['triangles']==6698 and record['vertices']<65536
data=copy.deepcopy(before);data['meshes']['planter']=record
for key,value in before['meshes'].items():
    if key!='planter':assert data['meshes'][key]==value
assert data['atlas']==before['atlas'] and data['material']==before['material']
(OUT/(NAME+'.json')).write_text(json.dumps(data,separators=(',',':')))
(OUT/(NAME+'.inline.js')).write_text('/* Blender-authored opaque garden meshes; staged layered planter v95. */\nvar BERLIN_KIEZ_GARDEN_DATA = '+json.dumps(data,separators=(',',':'))+';\n')
shutil.copyfile(BASE/(NAME+'-atlas.jpg'),OUT/(NAME+'-atlas.jpg'))

# Native editable object retains the old pot's coordinates/UVs/colors exactly;
# custom corner normals are carried over along with the new curved leaf ones.
oldmesh=old.data
pot_faces=list(oldmesh.polygons)[:180]
assert all(len(p.vertices)==3 for p in pot_faces)
used=sorted({v for p in pot_faces for v in p.vertices}); remap={v:i for i,v in enumerate(used)}
positions=[tuple(oldmesh.vertices[v].co) for v in used]+[tuple(v.co) for v in newplant.data.vertices]
faces=[tuple(remap[v] for v in p.vertices) for p in pot_faces]+[tuple(v+len(used) for v in p.vertices) for p in newplant.data.polygons]
mesh=bpy.data.meshes.new('Kiez layered flowering planter v95')
mesh.from_pydata(positions,[],faces);mesh.update()
color=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
colors=[tuple(oldmesh.color_attributes['Color'].data[v].color) for v in used]+[tuple(c.color) for c in newplant.data.color_attributes['Color'].data]
for i,c in enumerate(colors):color.data[i].color=c
uv=mesh.uv_layers.new(name='UVMap')
oldloops=[li for p in pot_faces for li in p.loop_indices]
uvs=[tuple(oldmesh.uv_layers.active.data[li].uv) for li in oldloops]+[tuple(t.uv) for t in newplant.data.uv_layers.active.data]
normals=[tuple(oldmesh.corner_normals[li].vector) for li in oldloops]+[tuple(n.vector) for n in newplant.data.corner_normals]
for i,t in enumerate(uvs):uv.data[i].uv=t
for p in mesh.polygons:p.use_smooth=True
mesh.normals_split_custom_set(normals)
mesh.materials.append(material)
old.data=mesh
old['source']='tools/stage_berlin_layered_planter_v95.py'
old['opaque_foliage']=True
bpy.data.objects.remove(newplant,do_unlink=True)
native_record=packed_geometry(old)
# Compare corners rather than deduped indices: native normals have a second
# Blender custom-normal quantization, so allow only that tiny angular error.
def corner_values(rec,key,fmt,stride):
    values=unpack(rec,key,fmt);return [values[v*stride:v*stride+stride] for v in unpack(rec,'index','H')]
native_normal_error=0
for key,fmt,stride in [('position','f',3),('color','B',3),('uv','f',2),('normal','h',3)]:
    a=corner_values(record,key,fmt,stride);b=corner_values(native_record,key,fmt,stride)
    assert len(a)==len(b)
    error=max(abs(x-y) for p,q in zip(a,b) for x,y in zip(p,q))
    if key=='normal': native_normal_error=error;assert error<=24, ('custom normal quantization',error)
    else: assert error==0, (key,error)
for name,digest in tree_digests.items():assert mesh_digest(bpy.data.objects[name])==digest,'Native tree changed: '+name
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(NAME+'.blend')))

# Patch only the GLB planter buffers from the authoritative packed mesh. All
# tree buffers, atlas bytes, material descriptors and scene nodes stay exact.
original=(BASE/(NAME+'.glb')).read_bytes();jsonlen=struct.unpack_from('<I',original,12)[0]
gltf=json.loads(original[20:20+jsonlen]);binstart=28+jsonlen
binary=original[binstart:]
primitive=next(m for m in gltf['meshes'] if m['name']=='Kiez_Flower_Planter')['primitives'][0]
views={i:binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for i,v in enumerate(gltf['bufferViews'])}
changed_views=set()
def replace_accessor(accessor_id,payload,component,count,kind,normalized=False,minimum=None,maximum=None):
    a=gltf['accessors'][accessor_id];vid=a['bufferView'];changed_views.add(vid)
    views[vid]=payload;gltf['bufferViews'][vid].pop('byteStride',None)
    a.update(componentType=component,count=count,type=kind,byteOffset=0)
    for key in ('normalized','min','max'):a.pop(key,None)
    if normalized:a['normalized']=True
    if minimum is not None:a['min']=minimum;a['max']=maximum
attrs=primitive['attributes']
replace_accessor(attrs['POSITION'],base64.b64decode(record['position']),5126,record['vertices'],'VEC3',minimum=record['min'],maximum=record['max'])
normal_values=[v/32767 for v in unpack(record,'normal','h')]
replace_accessor(attrs['NORMAL'],struct.pack('<'+'f'*len(normal_values),*normal_values),5126,record['vertices'],'VEC3')
replace_accessor(attrs['TEXCOORD_0'],base64.b64decode(record['uv']),5126,record['vertices'],'VEC2')
rgb=unpack(record,'color','B');rgba=bytes(v for i in range(record['vertices']) for v in (*rgb[i*3:i*3+3],255))
replace_accessor(attrs['COLOR_0'],rgba,5121,record['vertices'],'VEC4',normalized=True)
replace_accessor(primitive['indices'],base64.b64decode(record['index']),5123,record['triangles']*3,'SCALAR')
newbin=bytearray()
for i,view in enumerate(gltf['bufferViews']):
    while len(newbin)%4:newbin.append(0)
    view['byteOffset']=len(newbin);view['byteLength']=len(views[i]);newbin.extend(views[i])
gltf['buffers'][0]['byteLength']=len(newbin)
while len(newbin)%4:newbin.append(0)
jsonbytes=json.dumps(gltf,separators=(',',':')).encode()
jsonbytes+=b' '*((-len(jsonbytes))%4)
glb=struct.pack('<4sII',b'glTF',2,28+len(jsonbytes)+len(newbin))+struct.pack('<I4s',len(jsonbytes),b'JSON')+jsonbytes+struct.pack('<I4s',len(newbin),b'BIN\0')+newbin
(OUT/(NAME+'.glb')).write_bytes(glb)

report={'baseline_sha256':hashes,'triangles':record['triangles'],'vertices':record['vertices'],
        'pot_triangles':180,'pot_vertices':pot_vertex_count,'leaf_count':640,'flower_heads':20,'flower_clusters':5,
        'primary_shoots':7,'twigs':8,'branches_triangles':branch_triangles,
        'bounds':{'min':record['min'],'max':record['max']},'affine_scale':scale,
        'native_corner_normal_quantization_max':native_normal_error,'native_tree_sha256':tree_digests,
        'glb_replaced_buffer_views':sorted(changed_views),'protected_runtime_records':[k for k in before['meshes'] if k!='planter'],
        'shared_inline_bytes':(OUT/(NAME+'.inline.js')).stat().st_size,
        'leaf_orientation':{'plane_tilt_degrees':[35,70],'azimuth':'outward from each existing foliage lobe','revision':'broad outward faces'}}
(STAGE/'validation.json').write_text(json.dumps(report,indent=2))
(STAGE/'manifest.json').write_text(json.dumps({'source':'tools/stage_berlin_layered_planter_v95.py','meshes':{k:{a:b for a,b in v.items() if a not in ('position','normal','uv','color','index')} for k,v in data['meshes'].items()},'material':data['material'],'streetCanopyRadius':data['streetCanopyRadius'],'runtime_bytes':report['shared_inline_bytes']},indent=2))

if '--render' in sys.argv:
    # A small side-by-side asset review. Saved .blend remains the production
    # asset sheet; the comparison and ground are deliberately not saved.
    for ob in bpy.data.objects:
        if ob.type=='MESH':ob.hide_render=True
    old.hide_render=False;old.hide_set(False);old.location=(.78,0,0)
    reference=bpy.data.objects.new('Baseline stone planter',oldmesh);bpy.context.collection.objects.link(reference)
    reference.location=(-.78,0,0)
    camera=bpy.context.scene.camera;camera.location=(2.7,-6,3.3)
    camera.rotation_euler=(Vector((0,0,.97))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=3.35
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.render.resolution_x=920;scene.render.resolution_y=650;scene.render.resolution_percentage=100
    for ob in bpy.data.objects:
        if ob.type=='LIGHT':ob.rotation_euler=(Vector((0,0,1))-ob.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008))
    ground=bpy.context.object;ground.name='Preview only ground'
    gm=bpy.data.materials.new('Preview sandstone v95');gm.diffuse_color=(.42,.39,.31,1);ground.data.materials.append(gm)
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(STAGE/'planter-comparison.png')
    bpy.ops.render.render(write_still=True)
print('LAYERED_PLANTER_COMPLETE',json.dumps(report))
