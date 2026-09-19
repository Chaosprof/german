"""Stage leaf-local ambient occlusion without changing any garden geometry.

Blender -b -t 2 --python tools/stage_berlin_canopy_depth.py
The immutable v87 baseline prevents cumulative darkening on repeat builds.
Only street-near/street-far RGB bytes change; existing native leaf normals,
atlas, trunks, grove geometry, and the accepted stone planter stay untouched.
"""
import bpy, base64, collections, hashlib, json, math, os, shutil, struct
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE=os.path.join(ROOT,'audit','berlin-canopy-depth-v87')
BASE=os.path.join(STAGE,'baseline'); OUT=os.path.join(STAGE,'models')
PREFIX='berlin-kiez-garden-v1'
os.makedirs(BASE,exist_ok=True);os.makedirs(OUT,exist_ok=True)
NAMES=[PREFIX+'.'+s for s in ('json','inline.js','blend','glb')]+[PREFIX+'-atlas.jpg']
def sha(path):
    with open(path,'rb') as f:return hashlib.sha256(f.read()).hexdigest()
for name in NAMES:
    target=os.path.join(BASE,name)
    if not os.path.exists(target):shutil.copyfile(os.path.join(ROOT,'assets','models',name),target)
baseline_hashes={name:sha(os.path.join(BASE,name)) for name in NAMES}
hash_path=os.path.join(BASE,'sha256.json')
if os.path.exists(hash_path):
    with open(hash_path) as f:assert baseline_hashes==json.load(f),'Immutable baseline changed'
else:
    with open(hash_path,'w') as f:json.dump(baseline_hashes,f,indent=2)
with open(os.path.join(BASE,PREFIX+'.json')) as f:baseline=json.load(f)

def unpack(record,key,fmt):
    raw=base64.b64decode(record[key]);return struct.unpack('<'+fmt*(len(raw)//struct.calcsize(fmt)),raw)
def read_record(record):
    p=unpack(record,'position','f');indices=unpack(record,'index','H')
    return [Vector(p[i:i+3]) for i in range(0,len(p),3)],[tuple(indices[i:i+3]) for i in range(0,len(indices),3)]
def point_key(p):return tuple(round(v,5) for v in p)
def groups(points,faces):
    parents=[];weld=[];ids={}
    def find(i):
        while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
        return i
    for point in points:
        key=tuple(point)
        if key not in ids:ids[key]=len(parents);parents.append(len(parents))
        weld.append(ids[key])
    for face in faces:
        root=find(weld[face[0]])
        for v in face[1:]:parents[find(weld[v])]=root
    components={}
    for ti,face in enumerate(faces):components.setdefault(find(weld[face[0]]),[]).append(ti)
    result=[]
    for tris in components.values():
        vertices=sorted({v for ti in tris for v in faces[ti]})
        unique={point_key(points[v]):points[v] for v in vertices}
        result.append(dict(tris=tris,vertices=vertices,points=list(unique.values()),
                           signature=tuple(sorted(unique)),center=sum(unique.values(),Vector())/len(unique)))
    return result
def leaf_groups(parts):
    return [g for g in parts if len(g['tris'])==8 and len(g['points'])==6 and g['center'].y>4.4]

near=baseline['meshes']['treeNear'];far=baseline['meshes']['treeStreetFar']
assert (near['triangles'],far['triangles'])==(13992,3996)
points,faces=read_record(near);parts=groups(points,faces);leaves=leaf_groups(parts)
assert len(leaves)==1680,'Expected 1680 actual closed eight-face leaves'
leaf_faces=[];face_leaf=[]
for li,leaf in enumerate(leaves):
    for ti in leaf['tris']:leaf_faces.append(faces[ti]);face_leaf.append(li)
bvh=BVHTree.FromPolygons(points,leaf_faces,all_triangles=True,epsilon=.000001)
DISTANCE=.72;RAYS_PER_SIDE=16;MIN_FACTOR=.62

def visible_hit(origin,direction,leaf_id):
    # The support-plane origin already lies beyond the leaf. Explicitly skip
    # its own faces as well, so thin-shell precision cannot bake self-shadow.
    travelled=0.0
    for step in range(10):
        hit=bvh.ray_cast(origin,direction,DISTANCE-travelled)
        if hit[0] is None:return 0.0
        travelled+=hit[3]
        if face_leaf[hit[2]]!=leaf_id:
            return max(0,1-(travelled/DISTANCE)**1.5)
        origin=hit[0]+direction*.003;travelled+=.003
        if travelled>=DISTANCE:return 0.0
    return 0.0

raw=[]
for li,leaf in enumerate(leaves):
    triangles=[faces[ti] for ti in leaf['tris']]
    a,b,c=max(triangles,key=lambda face:(points[face[1]]-points[face[0]]).cross(points[face[2]]-points[face[0]]).length_squared)
    normal=(points[b]-points[a]).cross(points[c]-points[a]).normalized()
    axis=normal.cross(Vector((0,1,0)))
    if axis.length<.1:axis=normal.cross(Vector((1,0,0)))
    axis.normalize();other=normal.cross(axis).normalized();occlusion=0
    for side in (-1,1):
        n=normal*side
        support=max((p-leaf['center']).dot(n) for p in leaf['points'])
        origin=leaf['center']+n*(support+.006)
        for sample in range(RAYS_PER_SIDE):
            radius=math.sqrt((sample+.5)/RAYS_PER_SIDE)
            azimuth=sample*2.399963229728653
            direction=n*math.sqrt(1-radius*radius)+axis*(radius*math.cos(azimuth))+other*(radius*math.sin(azimuth))
            occlusion+=visible_hit(origin,direction,li)
    raw.append(occlusion/(RAYS_PER_SIDE*2))

tree=KDTree(len(leaves))
for li,leaf in enumerate(leaves):tree.insert(leaf['center'],li)
tree.balance();factors=[]
for li,leaf in enumerate(leaves):
    neighbors=tree.find_range(leaf['center'],.30)
    weight=sum(max(.05,1-distance/.30) for _,_,distance in neighbors)
    local=sum(raw[other]*max(.05,1-distance/.30) for _,other,distance in neighbors)/weight
    # Share only a quarter of the neighbor estimate: overlapping sprays gain
    # depth without random dark pixels or suppressing exposed outer leaves.
    occlusion=.75*raw[li]+.25*local
    factors.append(max(MIN_FACTOR,1-.60*max(0,occlusion-.025)))
factor_lookup={g['signature']:factor for g,factor in zip(leaves,factors)}

updated=dict(baseline);updated['meshes']=dict(baseline['meshes'])
object_paint={};record_reports={};factor_entries=[]
def apply_record(key,record,parts,record_leaves,leaf_factors,cores=()):
    colors=list(unpack(record,'color','B'));result=colors.copy();changed=set();paint={}
    component_factors=list(zip(record_leaves,leaf_factors))+list(cores)
    for g,factor in component_factors:
        for v in g['vertices']:
            result[v*3:v*3+3]=[round(c*factor) for c in colors[v*3:v*3+3]]
            changed.add(v)
            lookup=point_key(record_points[key][v]);value=tuple(result[v*3:v*3+3])
            assert lookup not in paint or paint[lookup]==value
            paint[lookup]=value
    after=dict(record);after['color']=base64.b64encode(bytes(result)).decode('ascii')
    assert {k:v for k,v in after.items() if k!='color'}=={k:v for k,v in record.items() if k!='color'}
    assert all(result[i*3:i*3+3]==colors[i*3:i*3+3] for i in range(record['vertices']) if i not in changed),'Trunk colors changed'
    updated['meshes'][key]=after;object_paint[key]=paint
    record_reports[key]={'triangles':record['triangles'],'vertices':record['vertices'],
        'leaf_count':len(record_leaves),'shaded_vertices':sum(result[i*3:i*3+3]!=colors[i*3:i*3+3] for i in changed),
        'protected_trunk_vertices':record['vertices']-len(changed),'recessed_core_count':len(cores),
        'geometry_normals_uv_indices_bounds_exact':True,'trunk_colors_exact':True}

far_points,far_faces=read_record(far);far_parts=groups(far_points,far_faces);far_leaves=leaf_groups(far_parts)
assert len(far_leaves)==418
assert all(g['signature'] in factor_lookup for g in far_leaves),'Near/far leaves must have identical physical anchors'
far_factors=[factor_lookup[g['signature']] for g in far_leaves]
cores=[g for g in far_parts if len(g['tris'])==20 and g['center'].y>4.4]
assert len(cores)==5
core_factors=[]
for core in cores:
    neighbors=tree.find_n(core['center'],96)
    factor=sum(factors[li] for _,li,_ in neighbors)/len(neighbors)
    core_factors.append((core,factor))
record_points={'treeNear':points,'treeStreetFar':far_points}
apply_record('treeNear',near,parts,leaves,factors)
apply_record('treeStreetFar',far,far_parts,far_leaves,far_factors,core_factors)
near_color=object_paint['treeNear']
assert all(object_paint['treeStreetFar'][point_key(p)]==near_color[point_key(p)] for g in far_leaves for p in g['points']),'Retained leaf RGB must match across LODs'
for key in baseline['meshes']:
    if key not in record_reports:assert updated['meshes'][key]==baseline['meshes'][key]
assert updated['atlas']==baseline['atlas']

# Paint the original editable Blender mesh in place. Do not recalculate or
# rewrite its authored curved normals; the snapshot checks every corner.
bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,PREFIX+'.blend'))
bpy.context.preferences.filepaths.save_version=0
def mesh_snapshot(obj):
    me=obj.data
    return ([tuple(v.co) for v in me.vertices],[tuple(n.vector) for n in me.corner_normals],
            [tuple(poly.vertices) for poly in me.polygons],
            [tuple(v.uv) for v in me.uv_layers.active.data])
snapshots={o.name:mesh_snapshot(o) for o in bpy.data.objects if o.type=='MESH'}
untouched_colors={o.name:[tuple(v.color) for v in o.data.color_attributes['Color'].data]
    for o in bpy.data.objects if o.type=='MESH' and o.name not in ('Kiez_Tree_Leaves_Street','Kiez_Tree_Leaves_Street_Far')}
for key,name in [('treeNear','Kiez_Tree_Leaves_Street'),('treeStreetFar','Kiez_Tree_Leaves_Street_Far')]:
    obj=bpy.data.objects[name];me=obj.data;attr=me.color_attributes['Color'];assert attr.domain=='POINT'
    for vertex in me.vertices:
        p=vertex.co;lookup=point_key((p.x,p.z,-p.y));value=object_paint[key].get(lookup)
        assert value is not None,('Native/runtime leaf lookup',name,vertex.index,lookup)
        attr.data[vertex.index].color=(*[v/255 for v in value],1)
    obj['local_leaf_occlusion']='v87: 32 leaf-center rays, 0.72m range, 0.62 linear floor; same factor on both faces'
for name,snapshot in snapshots.items():assert mesh_snapshot(bpy.data.objects[name])==snapshot,'Native noncolor attribute changed: '+name
for name,colors in untouched_colors.items():assert [tuple(v.color) for v in bpy.data.objects[name].data.color_attributes['Color'].data]==colors,'Native protected paint changed: '+name
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,PREFIX+'.blend'))

# Patch the reusable original GLB's existing leaf COLOR_0 accessor, retaining
# all mesh positions, authored normals, UVs, indices, materials and its atlas
# bytes verbatim. Its original export contains the near tree and planter;
# the street-far mesh remains available in the .blend and runtime JSON.
with open(os.path.join(BASE,PREFIX+'.glb'),'rb') as f:glb=bytearray(f.read())
json_size=struct.unpack_from('<I',glb,12)[0];gltf=json.loads(glb[20:20+json_size])
bin_start=20+json_size+8
leaf_mesh=next(m for m in gltf['meshes'] if m.get('name')=='Kiez_Tree_Leaves_Street')
assert len(leaf_mesh['primitives'])==1
attributes=leaf_mesh['primitives'][0]['attributes']
def accessor(key):
    a=gltf['accessors'][attributes[key]];view=gltf['bufferViews'][a['bufferView']]
    return a,bin_start+view.get('byteOffset',0)+a.get('byteOffset',0),view
pos,po,pv=accessor('POSITION');col,co,cv=accessor('COLOR_0')
assert pos['componentType']==5126 and col['componentType']==5123 and col['type']=='VEC4' and col['normalized']
assert pos['count']==col['count'];allowed=set()
for i in range(pos['count']):
    p=struct.unpack_from('<fff',glb,po+i*pv.get('byteStride',12));value=object_paint['treeNear'].get(point_key(p))
    assert value is not None,('GLB leaf point',i,p)
    offset=co+i*cv.get('byteStride',8)
    struct.pack_into('<HHH',glb,offset,*[v*257 for v in value]);allowed.update(range(offset,offset+6))
with open(os.path.join(BASE,PREFIX+'.glb'),'rb') as f:old_glb=f.read()
assert all(a==b or i in allowed for i,(a,b) in enumerate(zip(old_glb,glb))),'GLB changed beyond near-leaf RGB'
with open(os.path.join(OUT,PREFIX+'.glb'),'wb') as f:f.write(glb)
with open(os.path.join(OUT,PREFIX+'.json'),'w') as f:json.dump(updated,f,separators=(',',':'))
with open(os.path.join(OUT,PREFIX+'.inline.js'),'w') as f:
    f.write('/* Blender-authored opaque garden meshes; v87 local leaf occlusion. */\nvar BERLIN_KIEZ_GARDEN_DATA = ')
    json.dump(updated,f,separators=(',',':'));f.write(';\n')
shutil.copyfile(os.path.join(BASE,PREFIX+'-atlas.jpg'),os.path.join(OUT,PREFIX+'-atlas.jpg'))
def distribution(values):
    values=sorted(values)
    return {'min':min(values),'p10':values[round((len(values)-1)*.1)],'median':values[len(values)//2],
            'p90':values[round((len(values)-1)*.9)],'max':max(values),'mean':sum(values)/len(values)}
report={'source':'tools/stage_berlin_canopy_depth.py','baseline_sha256':baseline_hashes,
    'method':{'rays_per_leaf':32,'range_m':DISTANCE,'whole_leaf_factor':True,'linear_floor':MIN_FACTOR,'neighbor_blend':.25},
    'near_leaf_factors':distribution(factors),'far_retained_leaf_factors':distribution(far_factors),
    'retained_leaf_rgb_exact':True,'near_far_matched_leaves':len(far_leaves),
    'far_core_factors':[factor for _,factor in core_factors],
    'records':record_reports,'other_records_and_atlas_exact':True,
    'native_geometry_normals_uv_faces_exact':True,'native_other_colors_exact':True,
    'glb_only_near_leaf_rgb_changed':True,'shared_draws_and_triangles_unchanged':True,
    'runtime_bytes':sum(len(base64.b64decode(record[k])) for record in updated['meshes'].values() for k in ('position','normal','color','uv','index'))}
with open(os.path.join(STAGE,'validation.json'),'w') as f:json.dump(report,f,indent=2)
with open(os.path.join(STAGE,'leaf-factors.json'),'w') as f:
    json.dump([{'center':list(g['center']),'factor':factor,'raw_occlusion':occlusion,'retained_far':g['signature'] in {p['signature'] for p in far_leaves}} for g,factor,occlusion in zip(leaves,factors,raw)],f,separators=(',',':'))
assert baseline_hashes=={name:sha(os.path.join(BASE,name)) for name in NAMES}
print('CANOPY_DEPTH_COMPLETE',json.dumps(report),flush=True)
