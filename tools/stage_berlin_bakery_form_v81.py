"""Lower and broaden the existing bakery using its painted Blender master.

All output is staged; no canonical assets are modified. Runtime ground/cloth
corners and the eleven other records retain their exact packed payloads.
"""
import bpy,base64,collections,json,math,os,shutil,struct,sys
from mathutils import Vector

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE=os.path.join(ROOT,'audit','berlin-bakery-form-v81')
BASE=os.path.join(STAGE,'baseline');OUT=os.path.join(STAGE,'models')
os.makedirs(BASE,exist_ok=True);os.makedirs(OUT,exist_ok=True)
for suffix in ('blend','glb','json','inline.js','atlas.png'):
    name='berlin-reference-architecture-v1'+('-'+suffix if suffix=='atlas.png' else '.'+suffix)
    target=os.path.join(BASE,name)
    if not os.path.exists(target):shutil.copyfile(os.path.join(ROOT,'assets','models',name),target)
with open(os.path.join(BASE,'berlin-reference-architecture-v1.json')) as f:data=json.load(f)
KEY='13.5:0:1';original=data['meshes'][KEY]
def read(record,key,fmt):
    raw=base64.b64decode(record[key]);return list(struct.unpack('<'+fmt*(len(raw)//struct.calcsize(fmt)),raw))
arrays={k:read(original,k,f) for k,f in [('position','f'),('normal','h'),('uv','f'),('color','B'),('index','H')]}
p=arrays['position'];indices=arrays['index']
parents=[];weld=[];lookup={}
def find(i):
    while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
    return i
for i in range(original['vertices']):
    key=tuple(p[i*3:i*3+3])
    if key not in lookup:lookup[key]=len(parents);parents.append(len(parents))
    weld.append(lookup[key])
for i in range(0,len(indices),3):
    root=find(weld[indices[i]])
    for j in (1,2):parents[find(weld[indices[i+j]])]=root
groups={}
for i in range(0,len(indices),3):
    group=groups.setdefault(find(weld[indices[i]]),{'faces':[],'min':[math.inf]*3,'max':[-math.inf]*3})
    group['faces'].append(i//3)
    for v in indices[i:i+3]:
        for j in range(3):group['min'][j]=min(group['min'][j],p[v*3+j]);group['max'][j]=max(group['max'][j],p[v*3+j])
groups=list(groups.values())
if '--inspect' in sys.argv:
    for i,g in enumerate(groups):
        if g['max'][1]>6.29 and g['min'][0]>2.1 and g['min'][2]>-2.4:
            print(json.dumps({'id':i,'tris':len(g['faces']),'min':g['min'],'max':g['max']}))
    print('COMPONENTS',len(groups));sys.exit(0)

# This immutable master has separate authored components for the drum,
# windows, curved cornices, dome and balcony. Full-frame walls/pilasters are
# deliberately excluded from the broadening operation.
assert len(groups)==374 and len(groups[164]['faces'])==160
assert abs(groups[164]['max'][1]-16.2)<.001
turret_groups=set(range(165,243))|set(range(294,306))|{334}
face_group={face:gi for gi,g in enumerate(groups) for face in g['faces']}
CUT_LOW=12.10;CUT_HIGH=15.15;DROP=3.05;TURRET_X=4.65;WIDEN=1.14
def corner(v):
    return [*p[v*3:v*3+3],*arrays['normal'][v*3:v*3+3],
            *arrays['color'][v*3:v*3+3],*arrays['uv'][v*2:v*2+2]]
def clip(poly,y,below):
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        ain=a[1]<=y+1e-7 if below else a[1]>=y-1e-7
        bin=b[1]<=y+1e-7 if below else b[1]>=y-1e-7
        if ain:out.append(a)
        if ain!=bin:
            t=(y-a[1])/(b[1]-a[1]);c=[a[k]+(b[k]-a[k])*t for k in range(11)];c[1]=y
            n=Vector(c[3:6]).normalized();c[3:6]=[round(v*32767) for v in n]
            c[6:9]=[round(v) for v in c[6:9]];out.append(c)
    return out
output={key:[] for key in ('position','normal','color','uv','index')};packed_lookup={}
protected_before=collections.Counter();protected_after=collections.Counter()
def face_payload(poly):return tuple(sorted(tuple(c) for c in poly))
removed=0;broadened=0;clipped=0
for first in range(0,len(indices),3):
    face=first//3;poly=[corner(v) for v in indices[first:first+3]]
    protected=max(c[1] for c in poly)<=5.39
    if protected:protected_before[face_payload(poly)]+=1
    group=face_group[face]
    wide=group in turret_groups or (group==164 and max(c[1] for c in poly)>6.01)
    if wide:broadened+=1
    if max(c[1] for c in poly)<=CUT_LOW:parts=[(poly,False)]
    elif min(c[1] for c in poly)>=CUT_HIGH:parts=[(poly,True)]
    else:
        parts=[(clip(poly,CUT_LOW,True),False),(clip(poly,CUT_HIGH,False),True)]
        if all(len(part)<3 for part,_ in parts):removed+=1
        else:clipped+=1
    for part,upper in parts:
        if len(part)<3:continue
        final=[]
        for original_corner in part:
            c=list(original_corner)
            if upper:c[1]-=DROP
            if wide:
                c[0]=TURRET_X+(c[0]-TURRET_X)*WIDEN
                n=Vector((c[3]/WIDEN,c[4],c[5])).normalized();c[3:6]=[round(v*32767) for v in n]
            # Keep untouched float payloads exact; changed positions are
            # rounded to the existing 10-micron authoring convention.
            if upper or wide:c[:3]=[round(v,5) for v in c[:3]]
            final.append(c)
        for i in range(1,len(final)-1):
            tri=[final[0],final[i],final[i+1]]
            a,b,c=[Vector(v[:3]) for v in tri]
            if (b-a).cross(c-a).length_squared<1e-12:continue
            if protected:protected_after[face_payload(tri)]+=1
            for c in tri:
                key=tuple(c)
                if key not in packed_lookup:
                    packed_lookup[key]=len(output['position'])//3
                    for name,values in [('position',c[:3]),('normal',c[3:6]),('color',c[6:9]),('uv',c[9:])]:output[name].extend(values)
                output['index'].append(packed_lookup[key])
assert protected_before==protected_after,'All protected shop/cloth corners must survive unchanged'
def encode(values,fmt):return base64.b64encode(struct.pack('<'+fmt*len(values),*values)).decode('ascii')
record={key:encode(values,{'position':'f','normal':'h','color':'B','uv':'f','index':'H'}[key]) for key,values in output.items()}
record.update(vertices=len(output['position'])//3,triangles=len(output['index'])//3,
    min=[min(output['position'][i::3]) for i in range(3)],max=[max(output['position'][i::3]) for i in range(3)],
    upperFloors=2,roofBase=12.1,upperTurretScaleX=WIDEN,upperTurretAngles=[-.74,.28],upperTopArched=False)
assert record['vertices']<65536 and record['triangles']<original['triangles']
assert record['max'][2]<=original['max'][2]+.00001,'No added road projection'
assert record['max'][0]<7.3 and record['min'][0]>-7.3,'Broader bay remains inside the existing cornice allowance'
updated=dict(data);updated['meshes']=dict(data['meshes']);updated['meshes'][KEY]=record
updated['source']='Blender 5.2 / tools/stage_berlin_bakery_form_v81.py'
for key in data['meshes']:
    if key!=KEY:assert updated['meshes'][key]==data['meshes'][key]

# Rebuild the editable Blender object from the exact transformed corner
# payloads, retaining the shared atlas material and source-sheet placement.
bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,'berlin-reference-architecture-v1.blend'))
bpy.context.preferences.filepaths.save_version=0
objects={o['runtime_key']:o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('runtime_key')}
obj=objects[KEY];old_mesh=obj.data;material=old_mesh.materials[0]
points=[(output['position'][i],-output['position'][i+2],output['position'][i+1]) for i in range(0,len(output['position']),3)]
faces=[tuple(output['index'][i:i+3]) for i in range(0,len(output['index']),3)]
mesh=bpy.data.meshes.new('Bakery / broad two-storey bay');mesh.from_pydata(points,[],faces);mesh.update()
uv=mesh.uv_layers.new(name='UVMap');paint=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
normals=[]
for loop in mesh.loops:
    i=loop.vertex_index;uv.data[loop.index].uv=output['uv'][i*2:i*2+2]
    paint.data[loop.index].color=(*[v/255 for v in output['color'][i*3:i*3+3]],1)
    n=output['normal'][i*3:i*3+3];normals.append((n[0]/32767,-n[2]/32767,n[1]/32767))
for face in mesh.polygons:face.use_smooth=True
mesh.normals_split_custom_set(normals);mesh.materials.append(material);obj.data=mesh
obj['form_revision']='broad-two-storey-bay-v81';obj['upper_storeys']=2
mesh.calc_loop_triangles();assert len(mesh.loop_triangles)==record['triangles']
bpy.ops.object.select_all(action='DESELECT')
for item in objects.values():
    ci=item.data.color_attributes.find('Color');item.data.color_attributes.active_color_index=ci;item.data.color_attributes.render_color_index=ci;item.select_set(True)
bpy.context.view_layer.objects.active=obj
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.glb'),use_selection=True,export_format='GLB',
    export_normals=True,export_materials='EXPORT',export_yup=True,export_vertex_color='NAME',export_vertex_color_name='Color',
    export_all_vertex_colors=False,export_extras=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'berlin-reference-architecture-v1.blend'))
for suffix in ('json','inline.js'):
    with open(os.path.join(OUT,'berlin-reference-architecture-v1.'+suffix),'w') as f:
        f.write(('var BERLIN_REFERENCE_ARCHITECTURE = ' if suffix=='inline.js' else '')+json.dumps(updated,separators=(',',':'))+(';\n' if suffix=='inline.js' else ''))
shutil.copyfile(os.path.join(BASE,'berlin-reference-architecture-v1-atlas.png'),os.path.join(OUT,'berlin-reference-architecture-v1-atlas.png'))
report={'beforeTriangles':original['triangles'],'triangles':record['triangles'],'removedThirdStoreyFaces':removed,
    'clippedStructuralFaces':clipped,'broadenedFaces':broadened,'protectedGroundFaces':sum(protected_after.values()),
    'otherRecordsUnchanged':11,'min':record['min'],'max':record['max'],'upperFloors':2,'upperTurretScaleX':WIDEN,
    'roadProjectionUnchanged':True,'existingPaintPreserved':True}
with open(os.path.join(STAGE,'validation.json'),'w') as f:json.dump(report,f,indent=2)
print('BAKERY_FORM_V81_COMPLETE',json.dumps(report),flush=True)
