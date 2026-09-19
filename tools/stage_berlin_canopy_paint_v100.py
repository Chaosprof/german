"""Stage broad, luminance-balanced canopy color groups on accepted geometry.

blender.exe -b -t 2 --python tools/stage_berlin_canopy_paint_v100.py -- --render
Writes only audit/berlin-canopy-paint-v100. No runtime shader changes.
"""
import ast, base64, copy, hashlib, json, math, pathlib, shutil, struct, sys
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ROOT=pathlib.Path(__file__).resolve().parents[1]
STAGE=ROOT/'audit/berlin-canopy-paint-v100';BASE=STAGE/'baseline';OUT=STAGE/'models'
PREFIX='berlin-kiez-garden-v1'
for path in (BASE,OUT):path.mkdir(parents=True,exist_ok=True)
def sha(path):return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
names=[PREFIX+s for s in ('.json','.inline.js','.blend','.glb','-atlas.jpg')]
hashfile=BASE/'sha256.json'
if not hashfile.exists():
    for name in names:shutil.copyfile(ROOT/'assets/models'/name,BASE/name)
    source=(ROOT/'tools/stage_berlin_canopy_depth.py').read_text()
    tree=ast.parse(source)
    helper='\n\n'.join(ast.get_source_segment(source,node) for node in tree.body
        if isinstance(node,ast.FunctionDef) and node.name in ('unpack','read_record','point_key','groups','leaf_groups','mesh_snapshot','distribution'))
    (BASE/'geometry_helpers.py').write_text(helper)
    hashes={p.name:sha(p) for p in BASE.iterdir() if p.is_file()}
    hashfile.write_text(json.dumps(hashes,indent=2))
hashes=json.loads(hashfile.read_text())
for name,digest in hashes.items():assert sha(BASE/name)==digest,'Immutable baseline changed: '+name
exec(compile((BASE/'geometry_helpers.py').read_text(),str(BASE/'geometry_helpers.py'),'exec'),globals())
baseline=json.loads((BASE/(PREFIX+'.json')).read_text())
near=baseline['meshes']['treeNear'];far=baseline['meshes']['treeStreetFar']
assert near['triangles']==13992 and far['triangles']==3996
assert baseline['meshes']['planter']['triangles']==6698,'Accepted V95 planter required'
points,faces=read_record(near);leaves=leaf_groups(groups(points,faces));assert len(leaves)==1680
leaf_faces=[];face_leaf=[]
for i,leaf in enumerate(leaves):
    for ti in leaf['tris']:leaf_faces.append(faces[ti]);face_leaf.append(i)
bvh=BVHTree.FromPolygons(points,leaf_faces,all_triangles=True,epsilon=.000001)
distance=2.6;rays=48
# Upward-biased broad sky visibility has no chosen horizontal sun direction:
# it remains applicable to instances rotated around the vertical tree axis.
raw=[]
for i,leaf in enumerate(leaves):
    visibility=0.0
    for sample in range(rays):
        cosine=math.sqrt(.06+.94*(sample+.5)/rays)
        radius=math.sqrt(1-cosine*cosine);angle=sample*2.399963229728653
        direction=Vector((radius*math.cos(angle),cosine,radius*math.sin(angle)))
        support=max((p-leaf['center']).dot(direction) for p in leaf['points'])
        origin=leaf['center']+direction*(support+.008)
        travelled=0.0;visible=1.0
        for step in range(12):
            hit=bvh.ray_cast(origin,direction,distance-travelled)
            if hit[0] is None:break
            travelled+=hit[3]
            if face_leaf[hit[2]]!=i:
                visible=min(1.0,(travelled/distance)**1.3);break
            origin=hit[0]+direction*.004;travelled+=.004
            if travelled>=distance:break
        visibility+=visible
    raw.append(visibility/rays)
kd=KDTree(len(leaves))
for i,leaf in enumerate(leaves):kd.insert(leaf['center'],i)
kd.balance()
openness=[]
for i,leaf in enumerate(leaves):
    neighbors=kd.find_range(leaf['center'],.72)
    total=sum(max(.02,1-d/.72)**2 for _,_,d in neighbors)
    mean=sum(raw[j]*max(.02,1-d/.72)**2 for _,j,d in neighbors)/total
    openness.append(.20*raw[i]+.80*mean)
sorted_open=sorted(openness)
low=sorted_open[round((len(leaves)-1)*.13)];high=sorted_open[round((len(leaves)-1)*.87)]
assert high>low+.01
def smooth01(x):
    x=max(0,min(1,x));return x*x*(3-2*x)
group_t=[smooth01((value-low)/(high-low)) for value in openness]
def linear(rgb):return tuple(((c/255+.055)/1.055)**2.4 if c>10 else c/3294.6 for c in rgb)
def luminance(rgb):return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]
old_colors=list(unpack(near,'color','B'))
means=[];areas=[]
for leaf in leaves:
    means.append(tuple(sum(old_colors[v*3+c]/255 for v in leaf['vertices'])/len(leaf['vertices']) for c in range(3)))
    areas.append(sum((points[faces[t][1]]-points[faces[t][0]]).cross(points[faces[t][2]]-points[faces[t][0]]).length*.5 for t in leaf['tris']))
old_y=[luminance(c) for c in means];total_area=sum(areas)
old_mean=sum(y*a for y,a in zip(old_y,areas))/total_area
cool=linear((88,142,87));warm=linear((215,217,98))
cool=tuple(c/luminance(cool) for c in cool);warm=tuple(c/luminance(warm) for c in warm)
targets=[]
for i,t in enumerate(group_t):
    # Replace most scalar local AO contrast with a coherent broad field. The
    # small retained exponent keeps individual leaf character without applying
    # a second multiplicative occlusion pass on top of accepted V87 paint.
    y=old_mean*(.57+.99*t)*(old_y[i]/old_mean)**.16
    palette=tuple(cool[c]*(1-t)+warm[c]*t for c in range(3))
    chroma=tuple(.78*palette[c]+.22*means[i][c]/old_y[i] for c in range(3))
    targets.append(tuple(y*c for c in chroma))
unbalanced=sum(luminance(c)*a for c,a in zip(targets,areas))/total_area
normalization=old_mean/unbalanced
targets=[tuple(c*normalization for c in color) for color in targets]
new_colors=old_colors.copy();paint={};leaf_output=[];clip_count=0
for i,leaf in enumerate(leaves):
    for v in leaf['vertices']:
        result=[]
        for c in range(3):
            # Preserve the original subtle color shape within each leaf.
            value=targets[i][c]*(old_colors[v*3+c]/255)/max(.0001,means[i][c])
            if value<0 or value>1:clip_count+=1
            result.append(max(0,min(255,round(value*255))))
        new_colors[v*3:v*3+3]=result
        key=point_key(points[v]);value=tuple(result)
        assert key not in paint or paint[key]==value
        paint[key]=value
    actual=tuple(sum(new_colors[v*3+c]/255 for v in leaf['vertices'])/len(leaf['vertices']) for c in range(3))
    leaf_output.append(actual)
new_y=[luminance(c) for c in leaf_output]
new_mean=sum(y*a for y,a in zip(new_y,areas))/total_area
assert abs(new_mean/old_mean-1)<.003 and clip_count==0
updated=copy.deepcopy(baseline)
updated['meshes']['treeNear']['color']=base64.b64encode(bytes(new_colors)).decode()
object_paint={'treeNear':paint}

far_points,far_faces=read_record(far);far_parts=groups(far_points,far_faces);far_leaves=leaf_groups(far_parts)
assert len(far_leaves)==418
far_colors=list(unpack(far,'color','B'));far_paint={}
for leaf in far_leaves:
    for v in leaf['vertices']:
        key=point_key(far_points[v]);value=paint[key]
        far_colors[v*3:v*3+3]=value;far_paint[key]=value
cores=[part for part in far_parts if len(part['tris'])==20 and part['center'].y>4.4]
assert len(cores)==5
core_ratios=[];far_clips=0
for core in cores:
    ratios=[]
    for v in core['vertices']:
        # Existing textured cores retain their atlas. Transfer only the local
        # nearby leaf RGB change, avoiding a second green tint multiplication.
        neighbors=kd.find_n(far_points[v],48)
        weights=[1/(.15+d*d) for _,_,d in neighbors];total=sum(weights)
        old_local=[sum(means[j][c]*w for (_,j,_),w in zip(neighbors,weights))/total for c in range(3)]
        new_local=[sum(leaf_output[j][c]*w for (_,j,_),w in zip(neighbors,weights))/total for c in range(3)]
        ratio=[new_local[c]/max(.002,old_local[c]) for c in range(3)]
        value=[far_colors[v*3+c]*ratio[c] for c in range(3)]
        if max(value)>255:
            # Keep hue when the white atlas tint reaches its physical ceiling.
            factor=255/max(value);value=[x*factor for x in value];far_clips+=1
        value=tuple(max(0,min(255,round(x))) for x in value)
        far_colors[v*3:v*3+3]=value;far_paint[point_key(far_points[v])]=value;ratios.append(ratio)
    core_ratios.append([sum(r[c] for r in ratios)/len(ratios) for c in range(3)])
updated['meshes']['treeStreetFar']['color']=base64.b64encode(bytes(far_colors)).decode();object_paint['treeStreetFar']=far_paint
for key,record in baseline['meshes'].items():
    for attr,value in record.items():
        if key in object_paint and attr=='color':continue
        assert updated['meshes'][key][attr]==value,(key,attr)
for key,value in baseline.items():
    if key!='meshes':assert updated[key]==value

bpy.ops.wm.open_mainfile(filepath=str(BASE/(PREFIX+'.blend')))
bpy.context.preferences.filepaths.save_version=0
snapshots={o.name:mesh_snapshot(o) for o in bpy.data.objects if o.type=='MESH'}
protected_colors={o.name:[tuple(c.color) for c in o.data.color_attributes['Color'].data]
    for o in bpy.data.objects if o.type=='MESH' and o.name not in ('Kiez_Tree_Leaves_Street','Kiez_Tree_Leaves_Street_Far')}
baseline_near=bpy.data.objects['Kiez_Tree_Leaves_Street'].data.copy()
for key,name in [('treeNear','Kiez_Tree_Leaves_Street'),('treeStreetFar','Kiez_Tree_Leaves_Street_Far')]:
    obj=bpy.data.objects[name];me=obj.data;attr=me.color_attributes['Color'];assert attr.domain=='POINT'
    for v in me.vertices:
        p=v.co;value=object_paint[key][point_key((p.x,p.z,-p.y))]
        attr.data[v.index].color=(*[c/255 for c in value],1)
    obj['canopy_paint']='v100: broad 2.6m upward sky visibility, 0.72m groups; global area-weighted luminance preserved'
for name,snapshot in snapshots.items():assert mesh_snapshot(bpy.data.objects[name])==snapshot
for name,colors in protected_colors.items():assert [tuple(c.color) for c in bpy.data.objects[name].data.color_attributes['Color'].data]==colors
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(PREFIX+'.blend')))

original=(BASE/(PREFIX+'.glb')).read_bytes();glb=bytearray(original)
size=struct.unpack_from('<I',glb,12)[0];gltf=json.loads(glb[20:20+size]);start=28+size
attributes=next(m for m in gltf['meshes'] if m['name']=='Kiez_Tree_Leaves_Street')['primitives'][0]['attributes']
def accessor(key):
    a=gltf['accessors'][attributes[key]];v=gltf['bufferViews'][a['bufferView']]
    return a,start+v.get('byteOffset',0)+a.get('byteOffset',0),v
pos,po,pv=accessor('POSITION');col,co,cv=accessor('COLOR_0')
assert pos['componentType']==5126 and col['componentType']==5123 and col['type']=='VEC4' and col['normalized']
allowed=set()
for i in range(pos['count']):
    p=struct.unpack_from('<fff',glb,po+i*pv.get('byteStride',12));value=paint[point_key(p)]
    offset=co+i*cv.get('byteStride',8);struct.pack_into('<HHH',glb,offset,*[v*257 for v in value]);allowed.update(range(offset,offset+6))
assert all(a==b or i in allowed for i,(a,b) in enumerate(zip(original,glb)))
(OUT/(PREFIX+'.glb')).write_bytes(glb)
(OUT/(PREFIX+'.json')).write_text(json.dumps(updated,separators=(',',':')))
(OUT/(PREFIX+'.inline.js')).write_text('/* Blender-authored garden: staged broad canopy paint v100. */\nvar BERLIN_KIEZ_GARDEN_DATA = '+json.dumps(updated,separators=(',',':'))+';\n')
shutil.copyfile(BASE/(PREFIX+'-atlas.jpg'),OUT/(PREFIX+'-atlas.jpg'))
report={'source':'tools/stage_berlin_canopy_paint_v100.py','baseline_sha256':hashes,
    'method':{'range_m':distance,'rays_per_leaf':rays,'upward_biased':True,'no_preferred_horizontal_sun_direction':True,
              'neighbor_radius_m':.72,'neighbor_mix':.80,'original_leaf_luminance_exponent':.16,'palette_mix':.78,
              'cool_srgb':[88,142,87],'warm_srgb':[215,217,98],'openness_range':[low,high]},
    'area_weighted_leaf_luminance':{'before':old_mean,'after':new_mean,'relative_change':new_mean/old_mean-1,'normalization':normalization},
    'before_leaf_luminance':distribution(old_y),'after_leaf_luminance':distribution(new_y),
    'raw_visibility':distribution(raw),'broad_visibility':distribution(openness),'leaf_color_clips':clip_count,
    'near_leaf_count':1680,'retained_far_leaf_count':418,'near_far_rgb_exact':True,'far_core_rgb_ratios':core_ratios,'far_core_normalized_vertices':far_clips,
    'triangles':{key:r['triangles'] for key,r in updated['meshes'].items()},'all_geometry_normals_uv_indices_bounds_exact':True,
    'trunks_planter_grove_and_atlas_exact':True,'native_noncolor_and_protected_colors_exact':True,
    'glb_only_near_leaf_rgb_changed':True,'runtime_inline_bytes':(OUT/(PREFIX+'.inline.js')).stat().st_size}
(STAGE/'validation.json').write_text(json.dumps(report,indent=2))
(STAGE/'leaf-paint.json').write_text(json.dumps([{'center':list(leaf['center']),'area':areas[i],'raw_sky':raw[i],'broad_sky':openness[i],'group_t':group_t[i],
    'before_rgb':means[i],'after_rgb':leaf_output[i]} for i,leaf in enumerate(leaves)],separators=(',',':')))
if '--render' in sys.argv:
    for obj in bpy.data.objects:
        if obj.type=='MESH':obj.hide_render=True
    near_obj=bpy.data.objects['Kiez_Tree_Leaves_Street'];near_obj.hide_render=False;near_obj.hide_set(False);near_obj.location=(2.85,0,0)
    old_obj=bpy.data.objects.new('Preview accepted V87 canopy',baseline_near);bpy.context.collection.objects.link(old_obj);old_obj.location=(-2.85,0,0)
    trunk=bpy.data.objects['Kiez_Tree_Street_Trunk'];trunk.hide_render=False;trunk.hide_set(False);trunk.location=(2.85,0,0)
    old_trunk=bpy.data.objects.new('Preview baseline trunk',trunk.data);bpy.context.collection.objects.link(old_trunk);old_trunk.location=(-2.85,0,0)
    scene=bpy.context.scene;camera=scene.camera;camera.location=(0,-24,10)
    camera.rotation_euler=(Vector((0,0,5.65))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=11.7
    # A finite-distance area light favors whichever copy is closer. Use a
    # uniform sun so this side-by-side isolates the actual painted difference.
    for obj in bpy.data.objects:
        if obj.type=='LIGHT':obj.hide_render=True
    light=bpy.data.lights.new('Preview uniform comparison sun','SUN');light.energy=2.4;light.color=(1,.90,.74);light.angle=.16
    sun=bpy.data.objects.new('Preview uniform comparison sun',light);bpy.context.collection.objects.link(sun)
    sun.rotation_euler=Vector((4,6,-9)).to_track_quat('-Z','Y').to_euler()
    scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.render.resolution_x=1050;scene.render.resolution_y=680;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(STAGE/'canopy-comparison.png')
    bpy.ops.render.render(write_still=True)
for name,digest in hashes.items():assert sha(BASE/name)==digest
print('CANOPY_PAINT_COMPLETE',json.dumps(report),flush=True)
