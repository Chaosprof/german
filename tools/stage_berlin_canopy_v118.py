"""Author dense, overlapping linden crowns in the existing opaque garden kit.

Run in Blender 5.2. Near/far roles share leaf centres and supporting limbs;
the untouched trunk, grove, planter, atlas, materials and GLB nodes are retained.
"""
import ast, base64, collections, copy, hashlib, json, math, os, pathlib, random, shutil, struct, sys
import bpy
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
STAGE = ROOT / 'audit/berlin-parity-trees-v118'
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
    u = unit(axis)
    v = unit(np.cross([0,0,1] if abs(u[1]) > .94 else [0,1,0], u))
    n = unit(np.cross(u,v))
    v, n = v*math.cos(roll)+n*math.sin(roll), n*math.cos(roll)-v*math.sin(roll)
    # Eight perimeter points give each close leaf a rounded tapered contour.
    # At distance four triangular faces retain its silhouette and thickness.
    if lod:
        xy = [(1,0),(0,1),(-1,0),(0,-1)]
        verts = [center+u*x*length+v*y*width+n*width*(.06 if j%2==0 else -.06) for j,(x,y) in enumerate(xy)]
        faces = [(0,1,2),(0,2,3),(0,3,1),(1,3,2)]
    else:
        xy = [(math.cos(j*math.tau/8), math.sin(j*math.tau/8)) for j in range(8)]
        verts = [center+u*x*length+v*y*width+n*width*(.07*x*x+.035*y*y) for x,y in xy]
        verts += [center+n*width*.18, center-n*width*.10]
        xy += [(0,0),(0,0)]
        faces = [f for j in range(8) for f in ((8,j,(j+1)%8),(9,(j+1)%8,j))]
    normals=[]
    for fi,f in enumerate(faces):
        a,b,c=(verts[j] for j in f)
        fn=np.cross(b-a,c-a)
        if np.dot(fn,(a+b+c)/3-center)<0:
            f=(f[0],f[2],f[1]);faces[fi]=f;fn=-fn
        sign=1 if np.dot(fn,n)>0 else -1
        normals.append([native(unit(n*sign+u*xy[j][0]*.28+v*xy[j][1]*.60)) for j in f])
    colors=[np.clip(np.rint(np.array(color)*(1.035-.08*abs(y)-.035*max(0,-x))),0,255).astype(int).tolist() for x,y in xy]
    return {'points':[native(p) for p in verts], 'faces':faces, 'normals':normals, 'colors':colors}

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
rng=random.Random(1180923)
near_specs=[];far_specs=[];leaf_meta=[]
for li,(center,radii,count) in enumerate(lobes):
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
    for j in range(count):
        # Most leaves occupy overlapping outer shells, while the inner tier
        # closes line-of-sight holes. There are no opaque ellipsoid cores.
        y=1-2*(j+.5)/count
        theta=j*2.39996323+li*.78+rng.uniform(-.13,.13)
        h=math.sqrt(1-y*y)
        normal=np.array([h*math.cos(theta),y,h*math.sin(theta)])
        shell=.78+.22*rng.random() if j%4 else .38+.33*rng.random()
        p=c+normal*r*shell
        axis=unit(normal*.66+np.array([.17,.64,.08]))
        length=(.235+.065*rng.random())*(1-.14*max(0,normal[1]))
        width=length*(.65+.13*rng.random())
        roll=rng.uniform(-1.3,1.3)
        # Ambient-occlusion paint follows height and exposed shell, so rotating
        # an instance does not rotate a baked directional sunlight highlight.
        exposure=np.clip(.14+.59*(normal[1]+1)*.5+.15*shell+.14*(p[1]-5)/5,0,1)
        overhead=0
        for other_center,other_radii,_ in lobes:
            oc=np.array(other_center);orr=np.array(other_radii)
            radial=((p[0]-oc[0])/orr[0])**2+((p[2]-oc[2])/orr[2])**2
            if radial<1 and oc[1]+orr[1]*math.sqrt(1-radial)>p[1]+.3:overhead+=1
        exposure*=max(.48,1-.15*overhead)
        if j%4==0:exposure*=.61
        shade=np.array([15,39,9]);light=np.array([118,151,24])
        color=np.rint((shade*(1-exposure)+light*exposure)*(.94+.10*rng.random())).astype(int).tolist()
        near_specs.append(leaf(p,length,width,axis,roll,color))
        far_specs.append(leaf(p,length,width,axis,roll,color,True))
        leaf_meta.append({'center':p.tolist(),'length':length,'width':width,'lobe':li})

near_obj.data=create_mesh('Dense layered linden crown v118',near_specs,material)[0]
far_obj.data=create_mesh('Dense layered linden crown far v118',far_specs,material)[0]
near_obj['form_source']=far_obj['form_source']='tools/stage_berlin_canopy_v118.py'
near_leaf=packed_geometry(near_obj);far_leaf=packed_geometry(far_obj)
near_record=splice(old_data,trunk_faces,unpack(near_leaf))
far_record=splice(old_data,trunk_faces,unpack(far_leaf))
assert near_record['triangles']<=24160 and far_record['triangles']<=6616
positions=unpack(near_record)['position']
radius=max(math.hypot(positions[i],positions[i+2]) for i in range(0,len(positions),3))
updated=copy.deepcopy(baseline)
updated['meshes']['treeNear']=near_record;updated['meshes']['treeStreetFar']=far_record
updated['streetCanopyRadius']=math.ceil((radius+.02)*100)/100
updated['canopyRevision']='dense-layered-linden-v118'
updated['source']='Blender 5.2 / tools/stage_berlin_canopy_v118.py'
for key in ('tree','leaves','trunk','planter'):assert updated['meshes'][key]==baseline['meshes'][key]
for name,snapshot in protected.items():assert native_snapshot(bpy.data.objects[name])==snapshot,name
OUT.mkdir(parents=True,exist_ok=True)
(OUT/(PREFIX+'.json')).write_text(json.dumps(updated,separators=(',',':')))
(OUT/(PREFIX+'.inline.js')).write_text('/* Dense layered linden crowns, shared opaque material. */\nvar BERLIN_KIEZ_GARDEN_DATA = '+json.dumps(updated,separators=(',',':'))+';\n')
shutil.copyfile(BASE/(PREFIX+'-atlas.jpg'),OUT/(PREFIX+'-atlas.jpg'))
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
print('CANOPY_V118_COMPLETE',json.dumps(report),flush=True)
