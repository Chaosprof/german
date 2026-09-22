"""Stage branch-led irregular street crowns, preserving all other garden roles.

Blender 5.2: -b -t 2 --python tools/stage_berlin_branch_canopy_v114.py -- --render
The authoring and packed meshes share real leaves, supporting branches and LOD
placements. The far role uses small closed diamonds instead of opaque cores.
"""
import base64, collections, copy, hashlib, json, math, pathlib, random, shutil, struct, sys, os
import bpy
import numpy as np
from mathutils import Vector

ROOT=pathlib.Path(__file__).resolve().parents[1]
STAGE=ROOT/'audit/berlin-model-forms-v114/garden/branch-canopy'
BASE=STAGE/'baseline';OUT=STAGE/'models';PREFIX='berlin-kiez-garden-v1'
FORMATS={'position':'f','normal':'h','color':'B','uv':'f','index':'H'}
SIZES={'position':3,'normal':3,'color':3,'uv':2}
for p in (BASE,OUT):p.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'tools'))
from berlin_mesh_pack import packed_geometry
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
hf=BASE/'sha256.json'
if not hf.exists():
    for ext in ('.blend','.glb','.json','.inline.js','-atlas.jpg'):
        shutil.copyfile(ROOT/'assets/models'/(PREFIX+ext),BASE/(PREFIX+ext))
    shutil.copyfile(ROOT/'audit/berlin-model-forms-v114/garden/baseline/mesh_helpers.py',BASE/'mesh_helpers.py')
    hf.write_text(json.dumps({p.name:digest(p) for p in BASE.iterdir() if p.is_file()},indent=2))
hashes=json.loads(hf.read_text())
for name,value in hashes.items():assert digest(BASE/name)==value
exec(compile((BASE/'mesh_helpers.py').read_text(),str(BASE/'mesh_helpers.py'),'exec'),globals())
baseline=json.loads((BASE/(PREFIX+'.json')).read_text())
assert baseline['meshes']['planter']['triangles']==7338
old_data,old_parts=record_components(baseline['meshes']['treeNear'])
old_leaves=[g for g in old_parts if len(g['faces'])==12 and len(g['unique'])==8]
assert len(old_leaves)==1120
old_centers=np.array([g['center'] for g in old_leaves])
old_paint=np.array([np.mean([old_data['color'][i*3:i*3+3] for i in g['vertices']],axis=0) for g in old_leaves])
trunk_faces=sorted(fi for g in old_parts if g not in old_leaves for fi in g['faces'])
assert len(trunk_faces)==552
trunk_points=np.array([old_data['position'][i*3:i*3+3] for i in sorted({old_data['index'][j] for fi in trunk_faces for j in range(fi*3,fi*3+3)})])
trunk_tips=trunk_points[trunk_points[:,1]>4.70]
bpy.ops.wm.open_mainfile(filepath=str(BASE/(PREFIX+'.blend')))
bpy.context.preferences.filepaths.save_version=0
near_obj=bpy.data.objects['Kiez_Tree_Leaves_Street'];far_obj=bpy.data.objects['Kiez_Tree_Leaves_Street_Far']
before_mesh=near_obj.data.copy()
protected={o.name:native_snapshot(o) for o in bpy.data.objects if o.type=='MESH' and o not in (near_obj,far_obj)}
material=near_obj.data.materials[0]
near_specs=[];far_specs=[];leaf_meta=[];branch_meta=[]
def unit(a):
    v=np.array(a,dtype=float);return v/max(np.linalg.norm(v),1e-9)
def native(p):return (float(p[0]),float(-p[2]),float(p[1]))
def tube(points,radii,sides,color):
    points=np.array(points);verts=[];normals=[];previous_u=None
    for k,(p,r) in enumerate(zip(points,radii)):
        tangent=unit(points[min(k+1,len(points)-1)]-points[max(0,k-1)])
        if previous_u is None:u=unit(np.cross(tangent,[0,0,1] if abs(tangent[2])<.94 else [0,1,0]))
        else:u=unit(previous_u-tangent*np.dot(previous_u,tangent))
        v=np.cross(tangent,u);previous_u=u
        for j in range(sides):
            n=u*math.cos(j*math.tau/sides)+v*math.sin(j*math.tau/sides)
            verts.append(p+n*r);normals.append(n)
    faces=[]
    for k in range(len(points)-1):
        for j in range(sides):
            a=k*sides+j;b=k*sides+(j+1)%sides;c=b+sides;d=a+sides
            faces.extend([(a,b,c),(a,c,d)])
    for j in range(1,sides-1):faces.extend([(0,j+1,j),((len(points)-1)*sides,(len(points)-1)*sides+j,(len(points)-1)*sides+j+1)])
    side_faces=2*(len(points)-1)*sides
    corner_normals=[]
    for fi,f in enumerate(faces):
        cap=unit(np.cross(verts[f[1]]-verts[f[0]],verts[f[2]]-verts[f[0]]))
        corner_normals.append([native(normals[i] if fi<side_faces else cap) for i in f])
    return {'points':[native(p) for p in verts],'faces':faces,'normals':corner_normals,'colors':[color]*len(verts)}

def leaf(center,length,width,axis,roll,color,lod=False):
    u=unit(axis)
    reference=[0,0,1] if abs(u[1])>.94 else [0,1,0]
    v=unit(np.cross(reference,u));n=unit(np.cross(u,v))
    # Turn broad faces to varying light angles within a coherent twig.
    v,n=v*math.cos(roll)+n*math.sin(roll),n*math.cos(roll)-v*math.sin(roll)
    if lod:
        xy=[(1,0),(0,1),(-1,0),(0,-1)]
        verts=[center+u*x*length+v*y*width+n*(width*.055*(1 if j%2==0 else -1)) for j,(x,y) in enumerate(xy)]
        faces=[(0,1,2),(0,2,3),(0,3,1),(1,3,2)]
    else:
        xy=[(math.cos(j*math.tau/8),math.sin(j*math.tau/8)) for j in range(8)]
        verts=[center+u*x*length+v*y*width+n*width*(.07*x*x+.025*y*y) for x,y in xy]
        verts.extend([center+n*width*.19,center-n*width*.12]);xy.extend([(0,0),(0,0)])
        faces=[f for j in range(8) for f in ((8,j,(j+1)%8),(9,(j+1)%8,j))]
    ns=[]
    for fi,f in enumerate(faces):
        a,b,c=(verts[j] for j in f);fn=np.cross(b-a,c-a)
        if np.dot(fn,(a+b+c)/3-center)<0:f=(f[0],f[2],f[1]);faces[fi]=f;fn=-fn
        side=1 if np.dot(fn,n)>0 else -1
        ns.append([native(unit(n*side+u*xy[j][0]*width/length*.20+v*xy[j][1]*.24)) for j in f])
    colors=[np.clip(np.rint(np.array(color)*(1-.045*max(0,-x))),0,255).astype(int).tolist() for x,y in xy]
    return {'points':[native(p) for p in verts],'faces':faces,'normals':ns,'colors':colors}

# Distinct, unequal masses deliberately replace the oval envelope. Gaps are
# between branch families; each family has densely overlapping small sprays.
lobes=[((-.55,7.36,.04),(.72,.71,.65),150),
       ((.66,7.70,.10),(.58,.55,.51),100),
       ((-1.23,6.53,-.16),(.65,.67,.57),130),
       ((-1.57,5.71,.10),(.44,.59,.48),100),
       ((1.13,6.61,-.27),(.67,.66,.57),135),
       ((1.66,5.91,.18),(.39,.55,.43),75),
       ((-.03,6.11,-1.18),(.61,.69,.56),120),
       ((.21,6.55,1.16),(.63,.75,.52),100),
       ((-.66,5.11,-.52),(.34,.38,.36),55),
       ((.93,5.24,.51),(.34,.39,.36),55),
       ((-.35,6.25,.0),(.67,.76,.72),220),
       ((.53,5.90,.05),(.54,.69,.63),180)]
assert sum(n for c,r,n in lobes)==1420
rng=random.Random(114922)
branch_color=[55,37,18]
for li,(center,radii,count) in enumerate(lobes):
    c=np.array(center);r=np.array(radii)
    # Ten tapering upper limbs lead out of the established root/trunk. Only
    # these structural branches survive in the far role, never opaque cores.
    candidates=trunk_points[(trunk_points[:,1]>3.5)&(trunk_points[:,1]<c[1]-.60)]
    assert len(candidates)
    start=candidates[np.argmin(np.sum((candidates-c)**2,axis=1))].copy()
    bend=start+(c-start)*.55+np.array([.10*math.sin(li),.20,.09*math.cos(li)])
    branch_end=c+np.array([-.05,.10,.02])
    spec=tube([start,bend,branch_end],[.083 if li<8 else .055,.043,.009],6,branch_color)
    near_specs.append(spec);far_specs.append(spec);branch_meta.append({'lobe':li,'points':[p.tolist() for p in [start,bend,branch_end]],'triangles':len(spec['faces'])})
    sprigs=[]
    for si in range(3):
        angle=li*.71+si*math.tau/3+.4
        end=c+np.array([r[0]*math.cos(angle)*.90, r[1]*(.27 if si==0 else -.40 if si==1 else .67),r[2]*math.sin(angle)*.90])
        mid=c+(end-c)*.50+np.array([0,.11,0])
        sprigs.append((c,mid,end))
        spec=tube([c,mid,end],[.018,.010,.0025],3,[61,47,21]);near_specs.append(spec)
    for j in range(count):
        # 70% form dense, non-spherical sprays around unequal lateral twigs;
        # the remainder overlap their junction, with smaller terminal leaves.
        si=j%3;t=(j//3+.5)/(math.ceil(count/3))
        a,b,end=sprigs[si];stem=(1-t)**2*a+2*t*(1-t)*b+t*t*end
        theta=j*2.39996323+li*.49+rng.uniform(-.19,.19)
        vertical=1-2*((j*.61803398875+li*.19)%1)
        horizontal=math.sqrt(1-vertical*vertical)
        side=np.array([horizontal*math.cos(theta),vertical,horizontal*math.sin(theta)])
        envelope=.30+.62*math.sin(t*math.pi)**.65
        offset=side*r*envelope
        p=stem+offset
        if j%5==0:
            # Interior leaves join masses without sealing the large gaps.
            p=c+(p-c)*.55
        outward=unit(offset+np.array([0,.025,0]))
        droop=max(0,t-.55)*1.4+(0.26 if li in (3,5,8,9) else 0)
        # Present broad faces around each branch mass instead of arranging
        # every blade as a horizontal radial shelf. The leaf midrib rises
        # from its twig and the varied roll supplies overlapping planes.
        axis=unit(np.array([outward[0]*.50,.72-.18*droop+.20*math.sin(theta),outward[2]*.50]))
        ease=lambda x:max(0,min(1,float(x)))**2*(3-2*max(0,min(1,float(x))))
        terminal=max(ease((t-.55)/.45),ease((np.linalg.norm((p-c)/r)-.82)/.45))
        tip_axis=unit(np.array([math.sin(theta+.6),-.35-.25*math.cos(j*1.31),math.cos(theta+.6)]))
        axis=unit(axis*(1-.85*terminal)+tip_axis*(.85*terminal))
        length=(.140+.043*math.sin(math.pi*t))*(.86+.22*rng.random())
        if t>.82:length*=1-(t-.82)*2.1
        length*=1-.35*terminal
        width=length*(.49+.16*rng.random())
        roll=rng.uniform(-.85,.85)*(1+.60*terminal)+(si-1)*.18
        # Preserve broad source paint neighborhoods instead of per-face noise.
        dist=np.sum((old_centers-p)**2,axis=1);nearest=np.argsort(dist)[:8]
        color=np.mean(old_paint[nearest],axis=0)*(.94+.085*rng.random())
        color=np.clip(np.rint(color),0,255).astype(int).tolist()
        near_specs.append(leaf(p,length,width,axis,roll,color))
        far_specs.append(leaf(p,length,width,axis,roll,color,True))
        leaf_meta.append({'lobe':li,'sprig':si,'t':t,'center':p.tolist(),'halfLength':length,'halfWidth':width,'axis':axis.tolist(),'roll':roll})

def canopy_mesh(name,specs):
    mesh=create_mesh(name,specs,material)[0]
    assert all(n.vector.length>.99 for n in mesh.corner_normals)
    return mesh
near_obj.data=canopy_mesh('Branch-led layered street crown v114',near_specs)
far_obj.data=canopy_mesh('Branch-led matching far crown v114',far_specs)
near_obj['form_source']=far_obj['form_source']='tools/stage_berlin_branch_canopy_v114.py'
near_obj['form_note']='Twelve unequal branch families; thirty-six lateral sprays; 1420 rounded closed leaves'
near_leaf=packed_geometry(near_obj);far_leaf=packed_geometry(far_obj)
near_record=splice(old_data,trunk_faces,unpack(near_leaf));far_record=splice(old_data,trunk_faces,unpack(far_leaf))
assert near_record['triangles']<=25000 and far_record['triangles']<=7000
near_positions=unpack(near_record)['position']
radius=max(math.hypot(near_positions[j],near_positions[j+2]) for j in range(0,len(near_positions),3))
assert radius<2.85
updated=copy.deepcopy(baseline);updated['meshes']['treeNear']=near_record;updated['meshes']['treeStreetFar']=far_record
updated['canopyRevision']='branch-led-lobed-crown-v114'
updated['source']='Blender 5.2 / tools/stage_berlin_branch_canopy_v114.py'
for key in ('tree','leaves','trunk','planter'):assert updated['meshes'][key]==baseline['meshes'][key]
assert updated['atlas']==baseline['atlas'] and updated['material']==baseline['material']
for name,snapshot in protected.items():assert native_snapshot(bpy.data.objects[name])==snapshot,name
# Carry the accepted twig planter into the combined pack. Its independent
# stage preserves the old pot and all garden roles other than the shrub.
plant_stage=ROOT/'audit/berlin-model-forms-v114/garden/planter-sprays/models'
plant_pack=json.loads((plant_stage/(PREFIX+'.json')).read_text())
assert plant_pack['planterRevision']=='twig-spray-shrub-v114'
updated['meshes']['planter']=plant_pack['meshes']['planter']
updated['planterRevision']=plant_pack['planterRevision']
plant=bpy.data.objects['Kiez_Flower_Planter'];plant_material=plant.data.materials[0]
with bpy.data.libraries.load(str(plant_stage/(PREFIX+'.blend')),link=False) as (source,target):
    target.objects=['Kiez_Flower_Planter']
imported=target.objects[0];plant.data=imported.data
plant.data.materials.clear();plant.data.materials.append(plant_material)
bpy.data.objects.remove(imported,do_unlink=True)
(OUT/(PREFIX+'.json')).write_text(json.dumps(updated,separators=(',',':')))
(OUT/(PREFIX+'.inline.js')).write_text('/* Blender branch-led street crowns v114, opaque shared material. */\nvar BERLIN_KIEZ_GARDEN_DATA = '+json.dumps(updated,separators=(',',':'))+';\n')
shutil.copyfile(BASE/(PREFIX+'-atlas.jpg'),OUT/(PREFIX+'-atlas.jpg'))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(PREFIX+'.blend')))
TARGETS={'treeNear':'Kiez_Tree_Leaves_Street'}
glb_report=write_glb(near_leaf)
# Merge the planter's already-verified native GLB buffers without re-exporting
# or touching the tree, grove, materials or image payloads.
def glb_parts(path):
    b=path.read_bytes();length=struct.unpack_from('<I',b,12)[0]
    return json.loads(b[20:20+length]),b[28+length:]
doc,binary=glb_parts(OUT/(PREFIX+'.glb'));plant_doc,plant_binary=glb_parts(plant_stage/(PREFIX+'.glb'))
primitive=lambda d:next(m for m in d['meshes'] if m['name']=='Kiez_Flower_Planter')['primitives'][0]
a,b=primitive(doc),primitive(plant_doc)
views={i:binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for i,v in enumerate(doc['bufferViews'])}
for semantic in list(a['attributes'])+['index']:
    dest=a['indices'] if semantic=='index' else a['attributes'][semantic]
    source=b['indices'] if semantic=='index' else b['attributes'][semantic]
    accessor=copy.deepcopy(plant_doc['accessors'][source]);vid=doc['accessors'][dest]['bufferView']
    source_view=plant_doc['bufferViews'][accessor['bufferView']]
    views[vid]=plant_binary[source_view.get('byteOffset',0):source_view.get('byteOffset',0)+source_view['byteLength']]
    accessor['bufferView']=vid;doc['accessors'][dest]=accessor
    doc['bufferViews'][vid]={**source_view,'byteOffset':0}
payload=bytearray()
for i,v in enumerate(doc['bufferViews']):
    while len(payload)%4:payload.append(0)
    v['byteOffset']=len(payload);v['byteLength']=len(views[i]);payload.extend(views[i])
doc['buffers'][0]['byteLength']=len(payload)
while len(payload)%4:payload.append(0)
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
(OUT/(PREFIX+'.glb')).write_bytes(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(payload))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(payload),b'BIN\0')+payload)
report={'source':'tools/stage_berlin_branch_canopy_v114.py','baseline_sha256':hashes,'near_triangles':near_record['triangles'],'far_triangles':far_record['triangles'],'leaf_count':len(leaf_meta),'main_branch_count':len(lobes),'lateral_spray_count':len(lobes)*3,'new_branch_triangles':sum(len(s['faces']) for s in near_specs)-len(leaf_meta)*16,'far_has_opaque_cores':False,'canopy_radius':radius,'near_bounds':{'min':near_record['min'],'max':near_record['max']},'far_bounds':{'min':far_record['min'],'max':far_record['max']},'grove_atlas_trunk_exact':True,'accepted_twig_planter_exact':True,'glb_before_planter_merge':glb_report}
(STAGE/'validation.json').write_text(json.dumps(report,indent=2))
(STAGE/'branch-layout.json').write_text(json.dumps({'lobes':lobes,'branches':branch_meta,'leaves':leaf_meta},separators=(',',':')))
if '--render' in sys.argv:
    for o in bpy.data.objects:
        if o.type=='MESH':o.hide_render=True
    near_obj.hide_render=False;near_obj.hide_set(False);near_obj.location=(2.75,0,0)
    old=bpy.data.objects.new('Before accepted oval crown',before_mesh);bpy.context.collection.objects.link(old);old.location=(-2.75,0,0)
    trunk=bpy.data.objects['Kiez_Tree_Street_Trunk'];trunk.hide_render=False;trunk.hide_set(False);trunk.location=(2.75,0,0)
    oldtrunk=bpy.data.objects.new('Before trunk',trunk.data);bpy.context.collection.objects.link(oldtrunk);oldtrunk.location=(-2.75,0,0)
    for o in bpy.data.objects:
        if o.type=='LIGHT':o.hide_render=True
    for name,energy,col,direction in [('key',3,(1,.95,.85),(4,6,-9)),('fill',.65,(.7,.82,1),(-4,-3,-7))]:
        light=bpy.data.lights.new(name,'SUN');light.energy=energy;light.color=col;light.angle=.16
        sun=bpy.data.objects.new(name,light);bpy.context.collection.objects.link(sun);sun.rotation_euler=Vector(direction).to_track_quat('-Z','Y').to_euler()
    scene=bpy.context.scene;camera=scene.camera;camera.location=(0,-24,9.8);camera.rotation_euler=(Vector((0,0,5.35))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=11.4;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=1100;scene.render.resolution_y=750;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(STAGE/'canopy-comparison.png');bpy.ops.render.render(write_still=True)
for name,value in hashes.items():assert digest(BASE/name)==value
print('BRANCH_CANOPY_COMPLETE',json.dumps(report),flush=True)
