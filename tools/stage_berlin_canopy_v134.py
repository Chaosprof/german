"""Author dense, overlapping linden crowns in the existing opaque garden kit.

Run in Blender 5.2. Near/far roles share leaf centres and supporting limbs;
the untouched trunk, grove, planter, atlas, materials and GLB nodes are retained.
"""
import ast, base64, collections, copy, hashlib, json, math, os, pathlib, random, shutil, struct, sys
import bpy
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit/berlin-parity-v134'
BASE, OUT = STAGE / 'baseline', STAGE / 'models'
PREFIX = 'berlin-kiez-garden-v1'
FORMATS = {'position':'f', 'normal':'h', 'color':'B', 'uv':'f', 'index':'H'}
SIZES = {'position':3, 'normal':3, 'color':3, 'uv':2}
sys.path.insert(0, str(ROOT / 'tools'))
from berlin_mesh_pack import packed_geometry
exec(compile((ROOT/'audit/berlin-model-forms-v114/garden/baseline/mesh_helpers.py').read_text(), 'garden_mesh_helpers', 'exec'), globals())

# Reuse the established closed-leaf and swept-branch constructors without
# executing their historical stage, its file writes or its old asset installs.
source = ast.parse((ROOT/'tools/stage_berlin_branch_canopy_v114.py').read_text())
constructors = ast.Module(body=[n for n in source.body if isinstance(n, ast.FunctionDef) and n.name in ('unit','native','tube')], type_ignores=[])
exec(compile(constructors, 'canopy_shared_constructors', 'exec'), globals())

def leaf(center, length, width, axis, roll, color, lod=False):
    """Closed, thin eight-corner oval leaf; distance uses a closed tetrahedron.

    Alternating raised corners form a twelve-triangle antiprism. Every edge
    belongs to exactly two faces, including the tiny edge-on silhouette.
    Separate upper/lower normals retain a softly curved broad surface.
    """
    u=unit(axis)
    v=unit(np.cross([0,0,1] if abs(u[1])>.94 else [0,1,0],u))
    n=unit(np.cross(u,v))
    v,n=v*math.cos(roll)+n*math.sin(roll),n*math.cos(roll)-v*math.sin(roll)
    xy=[(1,0),(-.6,1.05),(-.6,-1.05),(0,0)] if lod else [(math.cos(j*math.tau/8),math.sin(j*math.tau/8)) for j in range(8)]
    heights=[.055,.055,.055,-.09] if lod else [.07,-.07]*4
    verts=[center+u*x*length+v*y*width+n*width*heights[j] for j,(x,y) in enumerate(xy)]
    topology=[(0,1,2),(0,3,1),(1,3,2),(2,3,0)] if lod else [(0,2,4),(0,4,6),(1,7,5),(1,5,3),(0,1,2),(2,3,4),(4,5,6),(6,7,0),(1,0,7),(3,2,1),(5,4,3),(7,6,5)]
    faces=[]
    for face in topology:
        a,b,c=(verts[j] for j in face)
        fn=np.cross(b-a,c-a)
        if np.dot(fn,(a+b+c)/3-center)<0:face=(face[0],face[2],face[1]);fn=-fn
        side=0 if np.dot(fn,n)>0 else len(xy)
        faces.append(tuple(j+side for j in face))
    # Render seams split normals, never the closed physical surface.
    side_count=len(xy)
    verts=verts+list(verts)
    normals=[]
    for fi,f in enumerate(faces):
        a,b,c=(verts[j] for j in f)
        fn=np.cross(b-a,c-a)
        sign=1 if np.dot(fn,n)>0 else -1
        normals.append([native(unit(n*sign+u*xy[j%side_count][0]*.35+v*xy[j%side_count][1]*.55)) for j in f])
    colors=[np.clip(np.rint(np.array(color)*(1.015-.07*abs(y)-.025*max(0,-x))),0,255).astype(int).tolist() for x,y in xy]
    result={'points':[native(p) for p in verts],'faces':faces,'normals':normals,'colors':colors+colors}
    if '--flat' not in sys.argv:
        # Sample a single linden leaf in the existing shared atlas. Its veins
        # and broad variation follow the actual leaf, at no new texture cost.
        tex=[((151+x*25+y*27)/512,1-(51-x*35+y*20)/512) for x,y in xy]
        result['uv']=tex+tex
    return result

def detailed_mesh(name,specs,material):
    mesh=create_mesh(name,specs,material)[0]
    loop=0
    for spec in specs:
        for face in spec['faces']:
            for vertex in face:
                if 'uv' in spec:mesh.uv_layers.active.data[loop].uv=spec['uv'][vertex]
                loop+=1
    return mesh

baseline=json.loads((BASE/(PREFIX+'.json')).read_text())
bpy.ops.wm.open_mainfile(filepath=str(BASE/(PREFIX+'.blend')))
bpy.context.preferences.filepaths.save_version=0
near_obj=bpy.data.objects['Kiez_Tree_Leaves_Street']
far_obj=bpy.data.objects['Kiez_Tree_Leaves_Street_Far']
material=near_obj.data.materials[0]
protected={o.name:native_snapshot(o) for o in bpy.data.objects if o.type=='MESH' and o not in (near_obj,far_obj)}
old_data=unpack(baseline['meshes']['treeNear'])
trunk_faces=list(range(552))
trunk_points=np.array([old_data['position'][i*3:i*3+3] for i in sorted(set(old_data['index'][:552*3]))])
lobes=[((-1.40,7.05,-.20),(1.22,1.42,1.15),165),
       ((.75,7.40,-.30),(1.30,1.58,1.25),180),
       ((-.30,8.45,.18),(1.45,1.35,1.32),225),
       ((-.50,6.85,1.48),(1.20,1.20,1.15),145),
       ((.20,7.25,-1.48),(1.35,1.20,1.17),150),
       ((1.38,6.18,.80),(.85,1.10,.90),125),
       ((-1.55,5.90,.65),(.90,.95,.83),110)]
rng=random.Random(1270924)
near_specs=[];far_specs=[];leaf_meta=[];lod_candidates=[]
for li,(center,radii,count) in enumerate(lobes):
    count=round(count*2.00)
    c=np.array(center);r=np.array(radii)
    candidates=trunk_points[(trunk_points[:,1]>3.1)&(trunk_points[:,1]<c[1]-.8)]
    start=candidates[np.argmin(np.sum((candidates-c)**2,axis=1))].copy()
    bend=start+(c-start)*.55+np.array([.06,.22,.08])
    limb=tube([start,bend,c],[.086,.046,.010],6,[49,34,17])
    near_specs.append(limb);far_specs.append(limb)
    for si in range(3):
        a=si*math.tau/3+li*.79
        tip=c+r*np.array([math.cos(a)*.72,.25,math.sin(a)*.72])
        near_specs.append(tube([c,(c+tip)*.5+np.array([0,.1,0]),tip],[.023,.012,.003],3,[53,39,17]))
    shoots=[]
    shoot_count=math.ceil(count/10)
    for si in range(shoot_count):
        y=1-2*(si+.5)/shoot_count
        theta=si*2.39996323+li*.78+rng.uniform(-.36,.36)
        h=math.sqrt(1-y*y)
        normal=np.array([h*math.cos(theta),y,h*math.sin(theta)])
        shell=.71+.21*rng.random() if si%5 else .35+.30*rng.random()
        shoot_center=c+normal*r*shell
        shoot_axis=unit(normal+np.array([.12,.34,-.05]))
        lateral=unit(np.cross([0,1,0],shoot_axis))
        shoot_roll=rng.uniform(-.65,.65)
        lateral=unit(lateral*math.cos(shoot_roll)+np.cross(shoot_axis,lateral)*math.sin(shoot_roll))
        shoots.append((shoot_center,shoot_axis,lateral,normal,shell))
        # The sparsely exposed supporting shoots share the opaque leaf batch.
        # Hidden shoots need no extra geometry beneath overlapping leaves.
        if si%4==0:
            start=shoot_center-shoot_axis*.42
            tip=shoot_center+shoot_axis*.28
            near_specs.append(tube([start,shoot_center,tip],[.008,.005,.0015],3,[55,43,19]))
    for j in range(count):
        shoot_center,shoot_axis,lateral,normal,shell=shoots[j//10]
        pair=(j%10)//2;side=-1 if j%2 else 1
        along=-.25+pair*.122+rng.uniform(-.026,.026)
        lateral_spread=.11+(4-pair)*.018
        leaf_drop=.24+.38*rng.random()
        axis=unit(lateral*side*.76+shoot_axis*.36+np.array([0,-leaf_drop,0])+rng.uniform(-.10,.10)*normal)
        p=shoot_center+shoot_axis*along+lateral*side*lateral_spread+axis*.047
        length=(.137+.046*rng.random())*(1-.10*max(0,normal[1]))
        width=length*(.64+.15*rng.random())
        roll=rng.uniform(-1.65,1.65)
        # Ambient-occlusion paint follows height and exposed shell, so rotating
        # an instance does not rotate a baked directional sunlight highlight.
        exposure=np.clip(.14+.59*(normal[1]+1)*.5+.15*shell+.14*(p[1]-5)/5,0,1)
        overhead=0
        for other_center,other_radii,_ in lobes:
            oc=np.array(other_center);orr=np.array(other_radii)
            radial=((p[0]-oc[0])/orr[0])**2+((p[2]-oc[2])/orr[2])**2
            if radial<1 and oc[1]+orr[1]*math.sqrt(1-radial)>p[1]+.3:overhead+=1
        exposure*=max(.48,1-.15*overhead)
        if (j//10)%5==0:exposure*=.68
        shade=np.array([8,27,8]);light=np.array([93,143,28])
        color=np.rint((shade*(1-exposure)+light*exposure)*(.94+.10*rng.random())).astype(int).tolist()
        near_shape=leaf(p,length,width,axis,roll,color)
        # Interior shoots overlap several lobes. Retain their end pairs and
        # omit the three middle pairs; the complete outer shoots and all random
        # draws stay exact. This removes hidden layering, not silhouette leaves.
        if (j//10)%5==0 and 0<pair<4:
            continue
        near_specs.append(near_shape)
        lod_candidates.append((near_shape,leaf(p,length*1.85,width*2.10,axis,roll,color,True),j%3==0))
        leaf_meta.append({'center':p.tolist(),'length':length,'width':width,'lobe':li,'shoot':j//10,'pair':pair})

# Preserve the actual outline leaves across the LOD transition. Only leaves
# inside the crown are consolidated into larger, lower-detail forms. Centres
# never move, and no bounds-dependent vertex clamp distorts either asset.
outline=np.array([p for near,_,_ in lod_candidates for p in near['points']])
outline_min,outline_max=outline.min(axis=0),outline.max(axis=0)
for near,far,selected in lod_candidates:
    points=np.array(near['points']);coarse=np.array(far['points'])
    silhouette=np.any(points.min(axis=0)<outline_min+.028) or np.any(points.max(axis=0)>outline_max-.028)
    coarse_outside=np.any(coarse.min(axis=0)<outline_min) or np.any(coarse.max(axis=0)>outline_max)
    if silhouette or (selected and coarse_outside):far_specs.append(near)
    elif selected:far_specs.append(far)

near_obj.data=detailed_mesh('Fine clustered linden crown v134',near_specs,material)
far_obj.data=detailed_mesh('Fine clustered linden crown far v134',far_specs,material)
near_obj['form_source']=far_obj['form_source']='tools/stage_berlin_canopy_v134.py'
near_leaf=packed_geometry(near_obj);far_leaf=packed_geometry(far_obj)
near_record=splice(old_data,trunk_faces,unpack(near_leaf))
far_record=splice(old_data,trunk_faces,unpack(far_leaf))
original_budget=json.loads((ROOT/'audit/berlin-parity-v127/baseline'/(PREFIX+'.json')).read_text())
# Candidate envelope. This prototype can only ship after frame-level timing
# verifies that reclaimed facade work covers the finer near foliage.
assert near_record['triangles']<=25000 and far_record['triangles']<=4000
positions=unpack(near_record)['position']+unpack(far_record)['position']
radius=max(math.hypot(positions[i],positions[i+2]) for i in range(0,len(positions),3))
updated=copy.deepcopy(baseline)
updated['meshes']['treeNear']=near_record;updated['meshes']['treeStreetFar']=far_record
updated['streetCanopyRadius']=math.ceil((radius+.02)*100)/100
updated['canopyRevision']='fine-twig-linden-v134'
updated['source']='Blender 5.2 / tools/stage_berlin_canopy_v134.py'
for key in ('tree','leaves','trunk','planter'):assert updated['meshes'][key]==baseline['meshes'][key]
for name,snapshot in protected.items():assert native_snapshot(bpy.data.objects[name])==snapshot,name
OUT.mkdir(parents=True,exist_ok=True)
(OUT/(PREFIX+'.json')).write_text(json.dumps(updated,separators=(',',':')))
(OUT/(PREFIX+'.inline.js')).write_text('/* Fine clustered linden crowns, shared opaque material. */\nvar BERLIN_KIEZ_GARDEN_DATA = '+json.dumps(updated,separators=(',',':'))+';\n')
shutil.copyfile(ROOT/'assets/models'/(PREFIX+'-atlas.jpg'),OUT/(PREFIX+'-atlas.jpg'))
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/(PREFIX+'.blend')))
TARGETS={'treeNear':'Kiez_Tree_Leaves_Street'}
glb_report=write_glb(near_leaf)
report={'source':updated['source'],'nearTriangles':near_record['triangles'],'farTriangles':far_record['triangles'],
        'nearVertices':near_record['vertices'],'farVertices':far_record['vertices'],
        'radius':radius,'cullRadius':updated['streetCanopyRadius'],'leafCount':len(leaf_meta),
        'nearBounds':[near_record['min'],near_record['max']], 'preservedRoles':['tree','leaves','trunk','planter'],
        'glb':glb_report,'baselineSha256':hashlib.sha256((BASE/(PREFIX+'.json')).read_bytes()).hexdigest()}
(STAGE/'geometry.json').write_text(json.dumps(report,indent=2))
(STAGE/'layout.json').write_text(json.dumps({'lobes':lobes,'leaves':leaf_meta},separators=(',',':')))
print('CANOPY_V134_COMPLETE',json.dumps(report),flush=True)

