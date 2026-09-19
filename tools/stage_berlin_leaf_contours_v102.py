"""Redistribute the accepted near-tree budget into smoother exposed leaves.

blender.exe -b -t 2 --python tools/stage_berlin_leaf_contours_v102.py -- --render
Only audit/berlin-leaf-contours-v102 is written. Far leaves remain exact.
"""
import ast,base64,collections,copy,hashlib,json,math,os,pathlib,shutil,struct,sys
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ROOT=pathlib.Path(__file__).resolve().parents[1];STAGE=ROOT/'audit/berlin-leaf-contours-v102';BASE=STAGE/'baseline';OUT=STAGE/'models'
PREFIX='berlin-kiez-garden-v1';TARGETS={'treeNear':'Kiez_Tree_Leaves_Street'}
FORMATS={'position':'f','normal':'h','color':'B','uv':'f','index':'H'}
SIZES={'position':3,'normal':3,'color':3,'uv':2}
for path in (BASE,OUT):path.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'tools'))
from berlin_mesh_pack import packed_geometry
def digest(path):return hashlib.sha256(pathlib.Path(path).read_bytes()).hexdigest()
hashfile=BASE/'sha256.json'
if not hashfile.exists():
    for suffix in ('.json','.inline.js','.blend','.glb','-atlas.jpg'):shutil.copyfile(ROOT/'assets/models'/(PREFIX+suffix),BASE/(PREFIX+suffix))
    source=(ROOT/'tools/stage_berlin_oval_foliage_v92.py').read_text()
    parsed=ast.parse(source)
    helper='\n\n'.join(ast.get_source_segment(source,node) for node in parsed.body if isinstance(node,ast.FunctionDef) and node.name in
        ('sha','enc','unpack','point_key','runtime_point','components','record_components','is_leaf','corner','triangle_counter','counter_hash','splice','native_snapshot','native_components','create_mesh','write_glb'))
    (BASE/'mesh_helpers.py').write_text(helper)
    hashfile.write_text(json.dumps({p.name:digest(p) for p in BASE.iterdir() if p.is_file()},indent=2))
hashes=json.loads(hashfile.read_text())
for name,value in hashes.items():assert digest(BASE/name)==value,'Immutable baseline changed: '+name
exec(compile((BASE/'mesh_helpers.py').read_text(),str(BASE/'mesh_helpers.py'),'exec'),globals())
baseline=json.loads((BASE/(PREFIX+'.json')).read_text());near=baseline['meshes']['treeNear']
accepted=json.loads((ROOT/'audit/berlin-canopy-paint-v100/models'/(PREFIX+'.json')).read_text())
assert baseline==accepted,'Use the accepted V100 paint/V95 planter baseline'
data,parts=record_components(near);leaves=[g for g in parts if is_leaf(g)]
far_data,far_parts=record_components(baseline['meshes']['treeStreetFar']);far_signatures={g['signature'] for g in far_parts if is_leaf(g)}
assert len(leaves)==1680 and len(far_signatures)==418
far_ids={i for i,g in enumerate(leaves) if g['signature'] in far_signatures};assert len(far_ids)==418
all_points=[Vector(data['position'][i:i+3]) for i in range(0,len(data['position']),3)]
leaf_faces=[];face_leaf=[]
for i,leaf in enumerate(leaves):
    for fi in leaf['faces']:leaf_faces.append(data['index'][fi*3:fi*3+3]);face_leaf.append(i)
bvh=BVHTree.FromPolygons(all_points,leaf_faces,all_triangles=True,epsilon=.000001)
kd=KDTree(len(leaves))
for i,g in enumerate(leaves):kd.insert(Vector(g['center']),i)
kd.balance()
views=[]
for elevation in (-12,8):
    el=math.radians(elevation)
    for yaw in range(0,360,15):
        a=math.radians(yaw);views.append(Vector((math.cos(a)*math.cos(el),math.sin(el),math.sin(a)*math.cos(el))))
visibility=[];density=[];exposure_path=STAGE/'exposure.json'
if exposure_path.exists():
    cache=json.loads(exposure_path.read_text());assert cache['baseline_json_sha256']==hashes[PREFIX+'.json']
    visibility=cache['visibility'];density=cache['density']
else:
    for i,leaf in enumerate(leaves):
        center=Vector(leaf['center']);points=[Vector(p) for p in leaf['unique']]
        samples=[center]+[center.lerp(points[k],.70) for k in (0,1,3,4)]
        exposed=0
        for direction in views:
            for sample in samples:
                origin=sample+direction*.002;travelled=0;clear=True
                for step in range(10):
                    hit=bvh.ray_cast(origin,direction,9-travelled)
                    if hit[0] is None:break
                    travelled+=hit[3]
                    if face_leaf[hit[2]]!=i:clear=False;break
                    origin=hit[0]+direction*.003;travelled+=.003
                if clear:exposed+=1
        visibility.append(exposed/(len(views)*len(samples)))
        density.append(len(kd.find_range(center,.65)))
    exposure_path.write_text(json.dumps({'baseline_json_sha256':hashes[PREFIX+'.json'],'visibility':visibility,'density':density},separators=(',',':')))
eligible=[i for i in range(1680) if i not in far_ids]
removed=set(sorted(eligible,key=lambda i:(visibility[i],-density[i],i))[:200])
converted=set(sorted((i for i in eligible if i not in removed),key=lambda i:(-visibility[i],density[i],i))[:400])
unchanged=set(range(1680))-removed-converted
assert len(unchanged)==1080 and far_ids<=unchanged
print('VISIBILITY_SELECTION',json.dumps({'removed_max':max(visibility[i] for i in removed),'removed_mean':sum(visibility[i] for i in removed)/200,'eligible_below_0015':sum(visibility[i]<.015 for i in eligible)}),flush=True)

OLD_OUTLINE=np.array([(1,0),(.45,1),(-.48,.85),(-.94,0),(-.48,-.85),(.45,-1)])
OLD_BEND=np.array([.10*x*x+.06*y*y+(1 if i%2==0 else -1)*.13 for i,(x,y) in enumerate(OLD_OUTLINE)])
DESIGN=np.column_stack([np.ones(6),OLD_OUTLINE,OLD_BEND]);FIT=np.linalg.pinv(DESIGN)
# Convert the measured runtime foliage envelope back to Blender Z-up.
native_leaf_points=np.array([(p[0],-p[2],p[1]) for leaf in leaves for p in leaf['unique']])
CROWN_MIN=native_leaf_points.min(axis=0);CROWN_MAX=native_leaf_points.max(axis=0)
def make_leaf(points,colors):
    coefficients=FIT@points;assert np.max(np.abs(DESIGN@coefficients-points))<2e-6
    _,u,v,n=coefficients;basis=np.column_stack([u,v,n]);center=points.mean(axis=0)
    angles=np.arange(8)*math.tau/8
    xy=np.column_stack([.99*np.cos(angles)+.03,np.sin(angles)*(1.02+.05*np.cos(angles))])
    heights=.040*xy[:,0]**2+.024*xy[:,1]**2+np.array([.070 if i%2==0 else -.070 for i in range(8)])
    local=np.column_stack([xy,heights]);local-=local.mean(axis=0)
    new=local@basis.T
    # A six-point leaf's AABB can artificially squeeze a rounder outline along
    # its thinnest projected axis. Allow at most 1.5 cm local shoulder growth,
    # while preserving the exact whole crown envelope and every leaf centre.
    low=np.maximum(points.min(axis=0)-.015,CROWN_MIN)-center
    high=np.minimum(points.max(axis=0)+.015,CROWN_MAX)-center;scale=1.0
    for p in new:
        for k in range(3):
            if p[k]>0:scale=min(scale,high[k]/p[k])
            elif p[k]<0:scale=min(scale,low[k]/p[k])
    new=new*scale+center
    faces=[(0,2,4),(0,4,6),(1,5,3),(1,7,5)]+[(i,(i+1)%8,(i+2)%8) for i in range(8)]
    inverse=np.linalg.inv(basis).T;normals=[]
    for i,face in enumerate(faces):
        a,b,c=(new[v] for v in face);normal=np.cross(b-a,c-a)
        if np.dot(normal,(a+b+c)/3-center)<0:face=(face[0],face[2],face[1]);faces[i]=face;normal=-normal
        side=1 if np.dot(normal,n)>0 else -1;values=[]
        for vi in face:
            x,y=xy[vi];value=inverse@np.array([-.080*x,-.048*y,1])*side;value/=np.linalg.norm(value)
            assert np.dot(value,normal/np.linalg.norm(normal))>.005
            values.append(value.tolist())
        normals.append(values)
    volume=sum(np.dot(new[a]-center,np.cross(new[b]-center,new[c]-center)) for a,b,c in faces)/6
    assert volume>0
    old_angles=np.mod(np.arctan2(OLD_OUTLINE[:,1],OLD_OUTLINE[:,0]),math.tau);order=np.argsort(old_angles)
    old_angles=old_angles[order];palette=colors[order]
    old_angles=np.r_[old_angles[-1]-math.tau,old_angles,old_angles[0]+math.tau]
    palette=np.vstack([palette[-1],palette,palette[0]])
    new_angles=np.mod(np.arctan2(xy[:,1],xy[:,0]),math.tau)
    interpolated=np.array([[np.interp(a,old_angles,palette[:,k]) for k in range(3)] for a in new_angles])
    rounded=np.rint(interpolated).astype(int)
    for k in range(3):
        target=round(float(colors[:,k].mean()*8));lo=int(colors[:,k].min());hi=int(colors[:,k].max())
        while int(sum(rounded[:,k]))!=target:
            sign=1 if sum(rounded[:,k])<target else -1
            choices=[i for i in range(8) if lo<=rounded[i,k]+sign<=hi]
            assert choices
            j=min(choices,key=lambda i:abs(rounded[i,k]+sign-interpolated[i,k])-abs(rounded[i,k]-interpolated[i,k]));rounded[j,k]+=sign
    assert np.max(np.abs(rounded.mean(axis=0)-colors.mean(axis=0)))<=1/24+.000001
    return {'points':new.tolist(),'faces':faces,'normals':normals,'colors':rounded.tolist(),'scale':float(scale),'center':center.tolist(),'volume':float(volume)}

bpy.ops.wm.open_mainfile(filepath=str(BASE/(PREFIX+'.blend')));bpy.context.preferences.filepaths.save_version=0
obj=bpy.data.objects['Kiez_Tree_Leaves_Street'];old_mesh=obj.data;baseline_mesh=old_mesh.copy()
native_groups=native_components(obj);native_lookup={g['signature']:g for g in native_groups}
assert len(native_lookup)==1680
protected_native=[native_lookup[leaves[i]['signature']] for i in sorted(unchanged)]
other_snapshots={o.name:native_snapshot(o) for o in bpy.data.objects if o.type=='MESH' and o!=obj}
paint={}
for leaf in leaves:
    for vi in leaf['vertices']:paint[point_key(data['position'][vi*3:vi*3+3])]=data['color'][vi*3:vi*3+3]
authored=[];pairing=[]
for i in sorted(converted):
    g=native_lookup[leaves[i]['signature']]
    points=np.array([tuple(old_mesh.vertices[j].co) for j in g['vertices']])
    colors=np.array([paint[point_key(runtime_point(p))] for p in points])
    leaf=make_leaf(points,colors);authored.append(leaf)
    pairing.append({'source_leaf':i,'center':leaves[i]['center'].tolist(),'visibility':visibility[i],
                    'scale':leaf['scale'],'old_mean_rgb':colors.mean(axis=0).tolist(),'new_mean_rgb':np.mean(leaf['colors'],axis=0).tolist()})
new_mesh,_,_=create_mesh('V102 eight-corner leaf authoring',authored,obj.data.materials[0])
temporary=bpy.data.objects.new('V102 new contour leaf export',new_mesh);bpy.context.collection.objects.link(temporary)
added_record=packed_geometry(temporary);added=unpack(added_record)
assert added_record['triangles']==4800
unchanged_faces={fi for i in unchanged for fi in leaves[i]['faces']}
all_leaf_faces={fi for leaf in leaves for fi in leaf['faces']}
protected_faces=[fi for fi in range(near['triangles']) if fi not in all_leaf_faces or fi in unchanged_faces]
near_record=splice(data,protected_faces,added)
leaf_record=splice(data,sorted(unchanged_faces),added)
assert near_record['triangles']==13992
assert near_record['min']==[min(data['position'][i::3]) for i in range(3)]
assert near_record['max']==[max(data['position'][i::3]) for i in range(3)]
# Keep the source's rounded metadata after checking the actual Float32 extrema.
near_record['min']=near['min'];near_record['max']=near['max']
updated=copy.deepcopy(baseline);updated['meshes']['treeNear']=near_record
for key,value in baseline['meshes'].items():
    if key!='treeNear':assert updated['meshes'][key]==value
combined,_,normal_delta=create_mesh('Kiez near leaves mixed contours v102',authored,old_mesh.materials[0],obj,protected_native)
obj.data=combined;obj['contour_source']='tools/stage_berlin_leaf_contours_v102.py'
bpy.data.objects.remove(temporary,do_unlink=True)
for name,snapshot in other_snapshots.items():assert native_snapshot(bpy.data.objects[name])==snapshot
native_record=unpack(packed_geometry(obj));runtime_leaf=unpack(leaf_record)
def ordered_corners(record,attrs):
    return [tuple(tuple(record[k][v*SIZES[k]:(v+1)*SIZES[k]]) for k in attrs) for v in record['index']]
assert ordered_corners(native_record,['position','color','uv'])==ordered_corners(runtime_leaf,['position','color','uv'])
native_normals=ordered_corners(native_record,['normal']);runtime_normals=ordered_corners(runtime_leaf,['normal'])
max_normal_error=max(abs(a-b) for left,right in zip(native_normals,runtime_normals) for a,b in zip(left[0],right[0]))
assert max_normal_error<=3,'Native custom-normal quantization changed too far'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(PREFIX+'.blend')))
glb_report=write_glb(leaf_record)
(OUT/(PREFIX+'.json')).write_text(json.dumps(updated,separators=(',',':')))
(OUT/(PREFIX+'.inline.js')).write_text('/* Blender-authored garden: mixed contour leaves v102. */\nvar BERLIN_KIEZ_GARDEN_DATA = '+json.dumps(updated,separators=(',',':'))+';\n')
shutil.copyfile(BASE/(PREFIX+'-atlas.jpg'),OUT/(PREFIX+'-atlas.jpg'))
selection={'converted':sorted(converted),'removed':sorted(removed),'unchanged':sorted(unchanged),'far_retained':sorted(far_ids),
           'visibility':visibility,'neighbors_065m':density,'converted_leaf_mapping':pairing}
(STAGE/'selection.json').write_text(json.dumps(selection,separators=(',',':')))
report={'source':'tools/stage_berlin_leaf_contours_v102.py','baseline_sha256':hashes,
        'triangles_before':near['triangles'],'triangles_after':near_record['triangles'],
        'unchanged_eight_face_leaves':1080,'new_twelve_face_leaves':400,'hidden_leaves_removed':200,
        'far_retained_leaves_exact':418,'far_record_exact':True,'planter_trunks_grove_atlas_exact':True,
        'removed_max_visibility':max(visibility[i] for i in removed),'converted_mean_visibility':sum(visibility[i] for i in converted)/400,
        'visibility_views':len(views),'samples_per_leaf_per_view':5,'bounds_exact':True,
        'maximum_local_shoulder_extension_m':.015,
        'near_runtime_bytes_before':sum(len(base64.b64decode(near[k])) for k in FORMATS),
        'near_runtime_bytes_after':sum(len(base64.b64decode(near_record[k])) for k in FORMATS),
        'converted_mean_color_error_byte':max(abs(a-b) for p in pairing for a,b in zip(p['old_mean_rgb'],p['new_mean_rgb'])),
        'native_corner_normal_quantization_max':max_normal_error,'native_other_meshes_exact':True,
        'glb':glb_report,'runtime_inline_bytes':(OUT/(PREFIX+'.inline.js')).stat().st_size}
(STAGE/'validation.json').write_text(json.dumps(report,indent=2))
if '--render' in sys.argv:
    for ob in bpy.data.objects:
        if ob.type=='MESH':ob.hide_render=True
    obj.hide_render=False;obj.hide_set(False);obj.location=(2.85,0,0)
    before_obj=bpy.data.objects.new('Preview accepted contours',baseline_mesh);bpy.context.collection.objects.link(before_obj);before_obj.location=(-2.85,0,0)
    trunk=bpy.data.objects['Kiez_Tree_Street_Trunk'];trunk.hide_render=False;trunk.hide_set(False);trunk.location=(2.85,0,0)
    before_trunk=bpy.data.objects.new('Preview accepted trunk',trunk.data);bpy.context.collection.objects.link(before_trunk);before_trunk.location=(-2.85,0,0)
    for ob in bpy.data.objects:
        if ob.type=='LIGHT':ob.hide_render=True
    for name,energy,color,direction in [('uniform key',3.0,(1,.95,.85),(4,6,-9)),('uniform fill',.65,(.70,.82,1),(-4,-3,-7))]:
        light=bpy.data.lights.new(name,'SUN');light.energy=energy;light.color=color;light.angle=.16
        sun=bpy.data.objects.new(name,light);bpy.context.collection.objects.link(sun);sun.rotation_euler=Vector(direction).to_track_quat('-Z','Y').to_euler()
    scene=bpy.context.scene;camera=scene.camera;camera.location=(0,-24,10);camera.rotation_euler=(Vector((0,0,5.65))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=11.7;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=1050;scene.render.resolution_y=680;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(STAGE/'canopy-comparison.png');bpy.ops.render.render(write_still=True)
for name,value in hashes.items():assert digest(BASE/name)==value
print('LEAF_CONTOURS_COMPLETE',json.dumps(report),flush=True)
