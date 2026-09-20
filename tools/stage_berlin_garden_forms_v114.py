"""Organic street crown forms, staged against the actual accepted V102 Blend.

No canonical files are written. Run Blender with --python this file -- --render.
Keeps the existing shared opaque material, planter, grove, atlas and budgets.
"""
import ast, base64, collections, copy, hashlib, json, math, os, pathlib, shutil, struct, sys
import bpy
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT=pathlib.Path(__file__).resolve().parents[1]
MAIN_STAGE=ROOT/'audit/berlin-model-forms-v114/garden'
CROWN='--crown' in sys.argv
LOD_CORES='--lod-cores' in sys.argv
SPRAYS='--sprays' in sys.argv or CROWN or LOD_CORES
STAGE=MAIN_STAGE/'lod-cores' if LOD_CORES else MAIN_STAGE/'crown' if CROWN else MAIN_STAGE/'sprays' if SPRAYS else MAIN_STAGE
BASE=MAIN_STAGE/'baseline'; OUT=STAGE/'models'
PREFIX='berlin-kiez-garden-v1'
FORMATS={'position':'f','normal':'h','color':'B','uv':'f','index':'H'}
SIZES={'position':3,'normal':3,'color':3,'uv':2}
for p in (BASE,OUT):p.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'tools'))
from berlin_mesh_pack import packed_geometry
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
hashfile=BASE/'sha256.json'
if not hashfile.exists():
    for suffix in ('.blend','.glb','.json','.inline.js','-atlas.jpg'):
        shutil.copyfile(ROOT/'assets/models'/(PREFIX+suffix),BASE/(PREFIX+suffix))
    shutil.copyfile(ROOT/'audit/berlin-leaf-contours-v102/baseline/mesh_helpers.py',BASE/'mesh_helpers.py')
    hashfile.write_text(json.dumps({p.name:digest(p) for p in BASE.iterdir() if p.is_file()},indent=2))
hashes=json.loads(hashfile.read_text())
for name,value in hashes.items():assert digest(BASE/name)==value
exec(compile((BASE/'mesh_helpers.py').read_text(),str(BASE/'mesh_helpers.py'),'exec'),globals())
baseline=json.loads((BASE/(PREFIX+'.json')).read_text())
near=baseline['meshes']['treeNear']; far=baseline['meshes']['treeStreetFar']
assert near['triangles']==13992 and far['triangles']==3996
assert baseline['meshes']['planter']['triangles']==6698
data,parts=record_components(near)
is_blade=lambda g:len(g['faces']) in (8,12) and len(g['unique']) in (6,8) and g['center'][1]>4.4
leaves=[g for g in parts if is_blade(g)]
assert len(leaves)==1480
far_data,far_parts=record_components(far)
far_leaves=[g for g in far_parts if is_blade(g)]
assert len(far_leaves)==418
far_signatures={g['signature'] for g in far_leaves}
far_ids={i for i,g in enumerate(leaves) if g['signature'] in far_signatures}
assert len(far_ids)==418

# Remove only concealed leaves, spending their triangles on curved outlines.
points=[Vector(data['position'][i:i+3]) for i in range(0,len(data['position']),3)]
leaf_faces=[]; face_leaf=[]
for i,g in enumerate(leaves):
    for fi in g['faces']:leaf_faces.append(data['index'][fi*3:fi*3+3]);face_leaf.append(i)
bvh=BVHTree.FromPolygons(points,leaf_faces,all_triangles=True,epsilon=.000001)
views=[]
for elevation in (-14,9,34):
    el=math.radians(elevation)
    for angle in range(0,360,30):
        a=math.radians(angle);views.append(Vector((math.cos(a)*math.cos(el),math.sin(el),math.sin(a)*math.cos(el))))
cachefile=MAIN_STAGE/'exposure.json'
if cachefile.exists():
    cache=json.loads(cachefile.read_text());assert cache['source']==hashes[PREFIX+'.json'];exposure=cache['exposure']
else:
    exposure=[]
    for i,g in enumerate(leaves):
        center=Vector(g['center']);samples=[center]+[center.lerp(Vector(p),.62) for p in g['unique'][::3]]
        count=0
        for direction in views:
            for sample in samples:
                origin=sample+direction*.002;clear=True
                for step in range(8):
                    hit=bvh.ray_cast(origin,direction,9)
                    if hit[0] is None:break
                    if face_leaf[hit[2]]!=i:clear=False;break
                    origin=hit[0]+direction*.003
                if clear:count+=1
        exposure.append(count/(len(views)*len(samples)))
    cachefile.write_text(json.dumps({'source':hashes[PREFIX+'.json'],'exposure':exposure},separators=(',',':')))
removed=set(sorted((i for i in range(len(leaves)) if i not in far_ids),key=lambda i:(exposure[i],i))[:360])
kept=set(range(len(leaves)))-removed
assert len(kept)==1120 and far_ids<=kept

# Compact, irregular sprigs replace the nearly continuous umbrella surface.
# Clusters are derived from the actual accepted leaf cloud, so broad V100 paint
# travels with its old neighborhood instead of becoming random speckling.
centers=np.array([g['center'] for g in leaves]); cloud=centers.copy()
seed=[int(np.argmax(cloud[:,1]))]
for _ in range(43):
    distances=np.min(np.sum((cloud[:,None,:]-cloud[seed][None,:,:])**2,axis=2),axis=1)
    seed.append(int(np.argmax(distances)))
anchors=cloud[seed].copy()
for _ in range(12):
    membership=np.argmin(np.sum((cloud[:,None,:]-anchors[None,:,:])**2,axis=2),axis=1)
    for k in range(len(anchors)):
        group=cloud[membership==k]
        if len(group):anchors[k]=group.mean(axis=0)
centerline=np.array([.04,6.55,-.02])
new_centers=[]; leaf_transforms=[]; spray_weights=[]
def smooth01(value):
    value=max(0,min(1,float(value)));return value*value*(3-2*value)
crown_moves=[];crown_weights=[]
for anchor in anchors:
    radial=np.array([anchor[0]-.04,0,anchor[2]+.02]);radius=np.linalg.norm(radial)
    radial/=max(radius,1e-8);theta=math.atan2(radial[2],radial[0])
    weight=smooth01((radius-.45)/1.10)*smooth01((7.40-anchor[1])/1.35) if CROWN else 0
    displacement=-radial*(.55*weight)
    displacement[1]=weight*(.50*math.sin(theta*2.60+.80)+.28*(anchor[1]-6.0))
    crown_moves.append(displacement);crown_weights.append(weight)
for i,c in enumerate(centers):
    k=int(membership[i]);anchor=anchors[k];relative=c-anchor
    radial=anchor-centerline;radial[1]*=.42
    radial/=max(np.linalg.norm(radial),.001)
    # Deliberately unequal shoulders, a lower hanging west spray, and lifted
    # small north tips. At most 27 cm relative movement keeps established scale.
    wave=.11*math.sin(k*2.17)+.075*math.cos(k*1.31)
    shift=radial*wave
    shift[1]+=.13*math.sin(k*1.87)-.14*max(0,-anchor[0]/2.4)
    direction=np.array([math.sin(k*2.71),0,math.cos(k*2.71)])
    shift+=direction*.055
    nc=anchor+shift+relative*.86
    # Gentle branchlike streams inside each sprig instead of independent disks.
    nc[1]+=.06*math.sin(relative[0]*3.8+relative[2]*3.2+k)
    angle=.14*math.sin(k*1.97)+.07*math.sin(i*1.41)
    axis=Vector((math.cos(k*1.73),.3,math.sin(k*1.73))).normalized()
    rot=np.array(Matrix.Rotation(angle,3,axis))
    scale=1.06+.065*math.sin(i*1.713)+.025*math.cos(k*2.17)
    weight=0.0
    if SPRAYS:
        radial=np.array([c[0]-.04,0,c[2]+.02]);radius=np.linalg.norm(radial)
        radial/=max(radius,1e-8)
        weight=smooth01((radius-.85)/1.12)*smooth01((7.6-c[1])/1.65)
        # The broad low edge read as a horizontal slab in actual gameplay.
        # Stagger whole sprigs downwards by unequal amounts, stretch their
        # hanging tips vertically, and turn the blades down/out from the trunk.
        # Both LODs use this same identity-specific placement and rotation.
        phase=.5+.5*math.sin(k*1.63)
        nc[1]+=weight*(relative[1]*.35-.16-.21*phase)
        nc-=radial*(.08*weight)
        tip_axis=Vector((radial[2],0,-radial[0]))
        tilt=weight*(.48+.10*math.sin(k*1.91)+.08*math.sin(i*1.71))
        rot=np.array(Matrix.Rotation(tilt,3,tip_axis))@rot
        scale*=1-.06*weight
    if CROWN:
        # Move branch-sized masses, not isolated blade tips: tuck the lower
        # lateral shoulders inward by as much as 55 cm and give neighboring
        # lobes different vertical centers. Elongated local sprays bridge the
        # staggered masses back into the retained branch structure.
        cw=crown_weights[k]
        nc+=crown_moves[k]
        nc+=relative*np.array([-.12*cw,.38*cw,-.12*cw])
    new_centers.append(nc);spray_weights.append(weight)
    leaf_transforms.append((rot,scale))
new_centers=np.array(new_centers)
original_far_ids=far_ids.copy()
if LOD_CORES:
    # Spend 960 extra triangles on real outer blades, selected to fill the
    # largest gaps between existing LOD anchors. This is still 9,036 triangles
    # cheaper than the near role while reducing reliance on visible cores.
    for _ in range(120):
        candidates=sorted(kept-far_ids)
        distances=np.min(np.sum((new_centers[candidates,None,:]-new_centers[sorted(far_ids)][None,:,:])**2,axis=2),axis=1)
        score=distances*np.array([.45+.55*exposure[i] for i in candidates])
        far_ids.add(candidates[int(np.argmax(score))])
    assert len(far_ids)==538 and original_far_ids<=far_ids

bpy.ops.wm.open_mainfile(filepath=str(BASE/(PREFIX+'.blend')))
bpy.context.preferences.filepaths.save_version=0
near_obj=bpy.data.objects['Kiez_Tree_Leaves_Street']
far_obj=bpy.data.objects['Kiez_Tree_Leaves_Street_Far']
before_mesh=near_obj.data.copy()
protected={o.name:native_snapshot(o) for o in bpy.data.objects if o.type=='MESH' and o not in (near_obj,far_obj)}
native_near={g['signature']:g for g in native_components(near_obj)}
native_far={g['signature']:g for g in native_components(far_obj)}
assert len(native_near)==1480
paint={}
for g in leaves:
    for vi in g['vertices']:paint[point_key(data['position'][vi*3:vi*3+3])]=data['color'][vi*3:vi*3+3]

def normalized(v):return v/max(np.linalg.norm(v),1e-8)
def blade(i,corners):
    g=leaves[i];old=np.array(g['unique']);center=centers[i]
    relative=old-center
    covariance=relative.T@relative
    values,basis=np.linalg.eigh(covariance)
    n=basis[:,0];v=basis[:,1];u=basis[:,2]
    if n[1]<0:n=-n
    if np.linalg.det(np.column_stack((u,v,n)))<0:v=-v
    ru=max(abs(relative@u));rv=max(abs(relative@v))
    rot,scale=leaf_transforms[i]
    u=rot@u;v=rot@v;n=rot@n
    # Rounded closed leaf perimeter, tip elongated only slightly, with a bowed
    # midrib and alternating front/back edge support. It remains real geometry.
    angles=np.arange(corners)*math.tau/corners
    xy=np.column_stack([np.cos(angles),np.sin(angles)*(1+.07*np.cos(angles))])
    thickness=.11 if corners==8 else .10
    heights=.10*xy[:,0]**2+.055*xy[:,1]**2+np.array([thickness if j%2==0 else -thickness for j in range(corners)])
    points=np.array([new_centers[i]+scale*(u*ru*x+v*rv*y+n*min(ru,rv)*h) for (x,y),h in zip(xy,heights)])
    if corners==8:faces=[(0,2,4),(0,4,6),(1,5,3),(1,7,5)]+[(j,(j+1)%8,(j+2)%8) for j in range(8)]
    else:faces=[(0,2,4),(1,5,3)]+[(j,(j+1)%6,(j+2)%6) for j in range(6)]
    normals=[]
    for fi,face in enumerate(faces):
        a,b,c=(points[j] for j in face);normal=np.cross(b-a,c-a)
        if np.dot(normal,(a+b+c)/3-new_centers[i])<0:face=(face[0],face[2],face[1]);faces[fi]=face;normal=-normal
        side=1 if np.dot(normal,n)>0 else -1
        corner_normals=[]
        for j in face:
            x,y=xy[j]
            value=normalized(n-u*.20*x*(min(ru,rv)/ru)-v*.11*y*(min(ru,rv)/rv))*side
            corner_normals.append((value[0],-value[2],value[1]))
        normals.append(corner_normals)
    # Use nearest old perimeter colors, then match the leaf's old mean exactly
    # to a byte. Broad warm/cool groups remain the accepted V100 palette.
    old_colors=np.array([paint[point_key(p)] for p in old])
    directions=relative.copy();directions/=np.maximum(np.linalg.norm(directions,axis=1)[:,None],1e-8)
    color_indices=[int(np.argmax(directions@normalized(u*ru*x+v*rv*y))) for x,y in xy]
    colors=old_colors[color_indices].copy()
    for channel in range(3):
        target=round(float(old_colors[:,channel].mean()*corners))
        while int(colors[:,channel].sum())!=target:
            delta=1 if colors[:,channel].sum()<target else -1
            choices=[j for j in range(corners) if 0<=colors[j,channel]+delta<=255]
            j=min(choices,key=lambda j:abs(colors[j,channel]+delta-old_colors[:,channel].mean()))
            colors[j,channel]+=delta
    return {'points':[(p[0],-p[2],p[1]) for p in points],'faces':faces,'normals':normals,'colors':colors.tolist()},points

authored=[];near_leaf_records={};new_near_points=[]
for i in sorted(kept):
    spec,ps=blade(i,8);authored.append(spec);new_near_points.extend(ps);near_leaf_records[i]=spec
near_mesh,_,_=create_mesh('Kiez grouped bowed rounded leaves v114',authored,near_obj.data.materials[0])
near_obj.data=near_mesh
near_obj['form_source']='tools/stage_berlin_garden_forms_v114.py'
near_obj['form_note']='44 asymmetric sprays; 1120 rounded closed blades; accepted V100 paint'
if SPRAYS:near_obj['form_note']+='; staggered drooping lower exterior sprays from actual gameplay critique'
if CROWN:near_obj['form_note']+='; narrowed vertically staggered branch-sized lower crown masses'
far_authored=[]
for i in sorted(far_ids):
    spec,_=blade(i,6);far_authored.append(spec)
far_cores=[g for g in native_components(far_obj) if g['signature'] not in far_signatures]
assert len(far_cores)==5
if CROWN or LOD_CORES:
    # The sparse LOD's old opaque interiors must follow the branch masses too;
    # leaving their old wide envelope would expose a platter through new leaves.
    # Keep all UVs/paint and tuck each core deeper behind its leaf-covered lobe.
    core_mesh=far_obj.data;old_normals=[tuple(n.vector) for n in core_mesh.corner_normals]
    vertex_scales={}
    for core in far_cores:
        center=np.array(core['center']);k=int(np.argmin(np.sum((anchors-center)**2,axis=1)))
        cw=crown_weights[k]
        scale=np.array([.66,.94,.66]) if LOD_CORES else np.array([.84-.14*cw,.87+.07*cw,.84-.14*cw])
        delta=np.zeros(3) if LOD_CORES else crown_moves[k]
        for vi in core['vertices']:
            p=np.array(runtime_point(core_mesh.vertices[vi].co));p=center+delta+(p-center)*scale
            core_mesh.vertices[vi].co=(p[0],-p[2],p[1]);vertex_scales[vi]=scale
    core_mesh.update();adjusted=[]
    for loop,native_normal in zip(core_mesh.loops,old_normals):
        if loop.vertex_index not in vertex_scales:adjusted.append(native_normal);continue
        n=normalized(np.array(runtime_point(native_normal))/vertex_scales[loop.vertex_index])
        adjusted.append((n[0],-n[2],n[1]))
    core_mesh.normals_split_custom_set(adjusted)
far_mesh,_,_=create_mesh('Kiez matching street LOD leaf sprays v114',far_authored,far_obj.data.materials[0],far_obj,far_cores)
far_obj.data=far_mesh
far_obj['form_source']='tools/stage_berlin_garden_forms_v114.py'


# The runtime pack retains the original trunk payload. New near/far geometry
# is packed through the same canonical Blender local-coordinate converter.
near_leaf=packed_geometry(near_obj);far_leaf=packed_geometry(far_obj)
trunk_faces=[fi for g in parts if not is_blade(g) for fi in g['faces']]
far_trunk_faces=[fi for g in far_parts if not is_blade(g) and len(g['faces'])>24 for fi in g['faces']]
# Far contains five 20-triangle recessed cores plus the 552-triangle trunk.
assert len(trunk_faces)==552
far_trunk_faces=[]
for g in far_parts:
    if len(g['faces']) not in (8,20):far_trunk_faces.extend(g['faces'])
assert len(far_trunk_faces)==552
near_record=splice(data,sorted(trunk_faces),unpack(near_leaf))
far_record=splice(far_data,sorted(far_trunk_faces),unpack(far_leaf))
assert near_record['triangles']==13992 and far_record['triangles']==(4956 if LOD_CORES else 3996)
if LOD_CORES:
    accepted_near=json.loads((MAIN_STAGE/'sprays/models'/(PREFIX+'.json')).read_text())['meshes']['treeNear']
    assert near_record==accepted_near,'Focused LOD correction must preserve shipping near mesh exactly'
updated=copy.deepcopy(baseline)
updated['meshes']['treeNear']=near_record;updated['meshes']['treeStreetFar']=far_record
updated['source']='Blender 5.2 / tools/stage_berlin_garden_forms_v114.py'
radius=max(math.hypot(p[0],p[2]) for p in new_near_points)
updated['streetCanopyRadius']=max(baseline['streetCanopyRadius'],math.ceil((radius+.15)*20)/20)
for key in ('tree','leaves','trunk','planter'):assert updated['meshes'][key]==baseline['meshes'][key]
assert updated['atlas']==baseline['atlas'] and updated['material']==baseline['material']
for name,snapshot in protected.items():assert native_snapshot(bpy.data.objects[name])==snapshot
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(PREFIX+'.blend')))
(OUT/(PREFIX+'.json')).write_text(json.dumps(updated,separators=(',',':')))
(OUT/(PREFIX+'.inline.js')).write_text('/* Blender street foliage forms v114: shared opaque painted mesh. */\nvar BERLIN_KIEZ_GARDEN_DATA = '+json.dumps(updated,separators=(',',':'))+';\n')
shutil.copyfile(BASE/(PREFIX+'-atlas.jpg'),OUT/(PREFIX+'-atlas.jpg'))

# Patch only the near leaf GLB accessor payloads. The existing GLB has no far
# LOD mesh; its native far source and packed runtime are retained separately.
TARGETS={'treeNear':'Kiez_Tree_Leaves_Street'}
glb_report=write_glb(near_leaf)
report={'source':'tools/stage_berlin_garden_forms_v114.py','baseline_sha256':hashes,
        'old_near_leaves':1480,'rounded_near_leaves':1120,'near_triangles':near_record['triangles'],'far_triangles':far_record['triangles'],
        'sprig_count':len(anchors),'removed_max_visibility':max(exposure[i] for i in removed),
        'removed_mean_visibility':sum(exposure[i] for i in removed)/len(removed),
        'near_bounds':{'min':near_record['min'],'max':near_record['max']},'far_bounds':{'min':far_record['min'],'max':far_record['max']},
        'canopy_radius':updated['streetCanopyRadius'],'measured_radius':radius,'planter_grove_atlas_trunk_exact':True,
        'shared_near_far_leaf_anchors':len(far_ids),'original_far_leaf_anchors_preserved':len(original_far_ids),'far_mesh_rescaled':False,
        'drooping_sprays_revision':SPRAYS,'strongly_adjusted_near_leaves':sum(spray_weights[i]>.25 for i in kept),
        'whole_crown_revision':CROWN,'cluster_displacements_m':[p.tolist() for p in crown_moves],
        'focused_lod_revision':LOD_CORES,'far_core_local_scale':([.66,.94,.66] if LOD_CORES else None),
        'near_bytes_before':sum(len(base64.b64decode(near[k])) for k in FORMATS),
        'near_bytes_after':sum(len(base64.b64decode(near_record[k])) for k in FORMATS),
        'glb':glb_report}
(STAGE/'validation.json').write_text(json.dumps(report,indent=2))
(STAGE/'leaf-mapping.json').write_text(json.dumps({'removed':sorted(removed),'near_ids':sorted(kept),'far_ids':sorted(far_ids),'original_far_ids':sorted(original_far_ids),'old_centers':centers.tolist(),'new_centers':new_centers.tolist(),'sprigs':membership.tolist(),'spray_weights':spray_weights},separators=(',',':')))

if '--render' in sys.argv:
    for ob in bpy.data.objects:
        if ob.type=='MESH':ob.hide_render=True
    near_obj.hide_render=False;near_obj.hide_set(False);near_obj.location=(2.85,0,0)
    old_obj=bpy.data.objects.new('Before current V102',before_mesh);bpy.context.collection.objects.link(old_obj);old_obj.location=(-2.85,0,0)
    trunk=bpy.data.objects['Kiez_Tree_Street_Trunk'];trunk.hide_render=False;trunk.hide_set(False);trunk.location=(2.85,0,0)
    old_trunk=bpy.data.objects.new('Before trunk',trunk.data);bpy.context.collection.objects.link(old_trunk);old_trunk.location=(-2.85,0,0)
    for ob in bpy.data.objects:
        if ob.type=='LIGHT':ob.hide_render=True
    for name,energy,color,direction in [('uniform key',3.0,(1,.95,.85),(4,6,-9)),('uniform fill',.65,(.70,.82,1),(-4,-3,-7))]:
        light=bpy.data.lights.new(name,'SUN');light.energy=energy;light.color=color;light.angle=.16
        sun=bpy.data.objects.new(name,light);bpy.context.collection.objects.link(sun);sun.rotation_euler=Vector(direction).to_track_quat('-Z','Y').to_euler()
    scene=bpy.context.scene;camera=scene.camera;camera.location=(0,-24,10);camera.rotation_euler=(Vector((0,0,5.65))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=11.7;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=1050;scene.render.resolution_y=680;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(STAGE/'canopy-comparison.png');bpy.ops.render.render(write_still=True)
for name,value in hashes.items():assert digest(BASE/name)==value
print('GARDEN_FORMS_COMPLETE',json.dumps(report),flush=True)
