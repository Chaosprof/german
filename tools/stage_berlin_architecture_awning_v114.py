"""Sculpt a continuous fabric bakery awning, preserving current architecture.

Blender -b -t 2 --python tools/stage_berlin_architecture_awning_v114.py -- --render
Only the current 1,756-triangle awning is replaced. Output is staged, never
installed by this script. All current source arrays are retained verbatim;
only old fabric indices are omitted before appending the new cloth shell.
"""
import bpy,os,sys,json,base64,struct,math,shutil,collections,hashlib,ast
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from berlin_mesh_pack import packed_geometry
STAGE=os.path.join(ROOT,'audit','berlin-model-forms-v114','architecture','cloth-awning')
BASE=os.path.join(STAGE,'baseline');OUT=os.path.join(STAGE,'models')
os.makedirs(BASE,exist_ok=True);os.makedirs(OUT,exist_ok=True)
PREFIX='berlin-reference-architecture-v1';KEY='13.5:0:1'
SOURCE=os.path.join(ROOT,'audit','berlin-model-forms-v114','architecture','flowering-balcony','models')
hashes={}
for suffix in ('.blend','.glb','.json','.inline.js','-atlas.png'):
    name=PREFIX+suffix;target=os.path.join(BASE,name)
    if not os.path.exists(target):shutil.copyfile(os.path.join(SOURCE,name),target)
    hashes[name]=hashlib.sha256(open(target,'rb').read()).hexdigest()
hashfile=os.path.join(BASE,'sha256.json')
if os.path.exists(hashfile):assert json.load(open(hashfile))==hashes
else:json.dump(hashes,open(hashfile,'w'),indent=2)
data=json.load(open(os.path.join(BASE,PREFIX+'.json')));original=data['meshes'][KEY]
assert original['triangles']==23602 and original['balconyRevision']=='sculpted-curved-balcony-v114'
bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,PREFIX+'.blend'))
bpy.context.preferences.filepaths.save_version=0
objects={o['runtime_key']:o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('runtime_key')};bakery=objects[KEY]
defs=ast.parse(open(os.path.join(ROOT,'tools','stage_berlin_architecture_forms_v114.py')).read())
defs=[n for n in defs.body if isinstance(n,(ast.FunctionDef,ast.ClassDef)) and n.name in ('unpack','components','linear')]
exec(compile(ast.Module(body=defs,type_ignores=[]),'<existing helpers>','exec'))
raw=unpack(original);groups=components(raw)
fabric=[]
for g in groups:
    ys=[raw['position'][v*3+1] for v in g['vertices']];zs=[raw['position'][v*3+2] for v in g['vertices']]
    if len(g['faces'])==1756 and min(ys)>3.49 and max(ys)<5.66 and min(zs)>.18 and max(zs)>2.18:fabric.append(g)
assert len(fabric)==1;fabric=fabric[0];OLD_IDS=set(fabric['faces'])
assert min(OLD_IDS)==10402 and max(OLD_IDS)==12157
LEFT=min(raw['position'][v*3] for v in fabric['vertices']);RIGHT=max(raw['position'][v*3] for v in fabric['vertices'])
WIDTH=RIGHT-LEFT;BANDS=12;BAND=WIDTH/BANDS;THICK=.036
# Cross-section loops clockwise around a closed fabric shell. The upper
# canopy needs only two cross-stripe subdivisions; the scalloped hanging edge
# gets twelve, keeping its large silhouette genuinely round without wasting
# polygons on the nearly planar field of the canopy.
ROWS=[('top',i/6,2) for i in range(7)]
ROWS += [('bend',.5,6),('bend',1,12),('front',.28,12),('front',.83,12)]
ROWS += [('hem',i/4,12) for i in range(5)]
ROWS += [('back',.83,12),('back',.28,12),('backbend',1,12),('backbend',.5,6)]
ROWS += [('under',i/6,2) for i in range(6,-1,-1)]
M=len(ROWS)
def seam_sag(band,u,t):
    global_u=(band+u)/BANDS
    return (.030*math.sin(math.pi*u)**2+.018*math.sin(math.pi*global_u))*math.sin(math.pi*t)
def lip_wave(band,u):
    # Small fixed fabric tension variation; neither movement nor lighting
    # changes are introduced. Endpoints of adjacent stripe bands coincide.
    global_u=(band+u)/BANDS
    return .022*math.sin(math.pi*global_u)+.009*math.sin(math.pi*u)**2*math.sin(band*1.73)
def bottom(band,u):
    # Broad low scallop with quarter-round corners, rather than a pointed
    # repeated tab. A shallow whole-canopy curve softens the horizontal hem.
    q=abs(u-.5)*2
    roundness=math.sqrt(max(0,1-q*q))
    return 3.68-.185*roundness-lip_wave(band,u)
def pos(row,band,u):
    kind,t,_=ROWS[row];x=LEFT+(band+u)*BAND;wave=lip_wave(band,u)
    if kind in ('top','under'):
        yy=5.65-1.80*t-.115*math.sin(math.pi*t)-seam_sag(band,u,t)
        zz=.20+1.95*t+.018*math.sin(math.pi*t)
        if kind=='under':
            dy=-1.80-.115*math.pi*math.cos(math.pi*t);dz=1.95+.018*math.pi*math.cos(math.pi*t);length=math.hypot(dy,dz)
            yy-=THICK*dz/length;zz+=THICK*dy/length
    elif kind in ('bend','backbend'):
        # Smooth 6cm radius turn from the tensioned canopy into the hanging
        # valance. The fabric no longer terminates in a knife-straight crease.
        yy=3.85-.076*t-.013*math.sin(math.pi*t)-wave*t
        zz=2.15+.058*math.sin(math.pi*t/2)
        if kind=='backbend':yy-=THICK*.32;zz-=THICK*.94
    elif kind in ('front','back'):
        yy=(3.774-wave)*(1-t)+(bottom(band,u)+.020)*t
        zz=2.208+.019*math.sin(math.pi*u)**2*math.sin(math.pi*t)
        if kind=='back':zz-=THICK
    else:
        # A proper turned-under hem: half-round thickness, continuous along
        # every scallop and seamless across coral/cream color boundaries.
        a=math.pi*t;yy=bottom(band,u)+.020-.020*math.sin(a);zz=2.190+.018*math.cos(a)
    return Vector((x,yy,zz))
def normal(row,band,u):
    eps=.0001;a=pos(row,band,u-eps);b=pos(row,band,u+eps);tangent=(b-a).normalized()
    prev=pos((row-1)%M,band,u);here=pos(row,band,u);nxt=pos((row+1)%M,band,u)
    # Equal edge weighting is deliberate: the coarse canopy and finely
    # sampled hem should have the same soft normal through their shared lip.
    direction=(here-prev).normalized()+(nxt-here).normalized()
    n=direction.cross(tangent).normalized()
    return n
vertices=[];normals=[];colors=[];uvs=[];faces=[]
def vertex(row,band,u):
    p=pos(row,band,u);n=normal(row,band,u);rgb=linear(0xe49a84 if band%2 else 0xf5e8d0)
    factor=.90+.10*max(0,n.y)+.03*max(0,n.z)
    # A narrow physical-seam wash emphasizes the very shallow tension groove;
    # broad paint and daylight remain the accepted game colors.
    seam=min(u,1-u);factor*=1-.025*math.exp(-max(0,seam)*24)
    i=len(vertices);vertices.append((p.x,-p.z,p.y));normals.append((n.x,-n.z,n.y));colors.append(tuple(v*factor for v in rgb)+(1,));uvs.append((.125,.875));return i
for band in range(BANDS):
    rows=[]
    for row,(_,_,div) in enumerate(ROWS):rows.append([vertex(row,band,j/div) for j in range(div+1)])
    for row in range(M):
        a=rows[row];b=rows[(row+1)%M];na=len(a)-1;nb=len(b)-1;i=j=0
        while i<na or j<nb:
            next_a=(i+1)/na if i<na else 2;next_b=(j+1)/nb if j<nb else 2
            if abs(next_a-next_b)<1e-8:faces.extend([(a[i],b[j],b[j+1]),(a[i],b[j+1],a[i+1])]);i+=1;j+=1
            elif next_a<next_b:faces.append((a[i],b[j],a[i+1]));i+=1
            else:faces.append((a[i],b[j],b[j+1]));j+=1
    # Only the outside sheet ends need caps. Stripe boundaries join at exact
    # positions, with separate color corners but no overlapping fabric shells.
    if band in (0,BANDS-1):
        u=0 if band==0 else 1;sign=-1 if band==0 else 1;ids=[]
        for row in range(M):
            i=vertex(row,band,u);normals[i]=(sign,0,0);ids.append(i)
        faces.append(tuple(reversed(ids) if sign<0 else ids))
mesh=bpy.data.meshes.new('Bowed continuous cloth canopy and turned scalloped hem V114');mesh.from_pydata(vertices,[],faces);mesh.update()
uv=mesh.uv_layers.new(name='UVMap');col=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
for loop in mesh.loops:
    uv.data[loop.index].uv=uvs[loop.vertex_index];col.data[loop.index].color=colors[loop.vertex_index]
mesh.normals_split_custom_set([normals[l.vertex_index] for l in mesh.loops]);mesh.materials.append(bakery.data.materials[0])
cloth=bpy.data.objects.new('Bowed continuous bakery awning V114',mesh);bpy.context.collection.objects.link(cloth);addition=packed_geometry(cloth);extra=unpack(addition)
# Preserve every old attribute byte in its original position; unused original
# fabric vertices cost negligible memory and keep previous profile offsets
# meaningful. All protected indices retain order while old fabric is omitted.
after=dict(original);offset=original['vertices']
for field in ('position','normal','uv','color'):after[field]=base64.b64encode(base64.b64decode(original[field])+base64.b64decode(addition[field])).decode('ascii')
protected_ix=[v for t in range(original['triangles']) if t not in OLD_IDS for v in raw['index'][t*3:t*3+3]]
indices=protected_ix+[v+offset for v in extra['index']]
after['vertices']=offset+addition['vertices'];after['triangles']=len(indices)//3
after['index']=base64.b64encode(struct.pack('<'+('H' if after['vertices']<65536 else 'I')*len(indices),*indices)).decode('ascii')
after['min']=[min(original['min'][i],addition['min'][i]) for i in range(3)];after['max']=[max(original['max'][i],addition['max'][i]) for i in range(3)]
after['awningRevision']='bowed-cloth-rounded-valance-v114';after['awningOldFaceStart']=min(OLD_IDS);after['awningOldFaceCount']=len(OLD_IDS);after['awningBaseVertices']=offset;after['awningNewFaceStart']=len(protected_ix)//3
for field in ('position','normal','uv','color'):assert base64.b64decode(after[field])[:len(base64.b64decode(original[field]))]==base64.b64decode(original[field])
assert after['min']==original['min'] and after['max']==original['max']
# Rebuild just this native object's triangle data from preserved attributes;
# the stage's other eleven native objects are left untouched. Native custom
# normals use the explicit preserved values, without a contact rebake.
final=unpack(after);native=bpy.data.meshes.new(bakery.data.name+' / sculpted fabric canopy')
native.from_pydata([(final['position'][i],-final['position'][i+2],final['position'][i+1]) for i in range(0,len(final['position']),3)],[],[tuple(indices[i:i+3]) for i in range(0,len(indices),3)]);native.update()
uv=native.uv_layers.new(name='UVMap');col=native.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
for loop in native.loops:
    i=loop.vertex_index;uv.data[loop.index].uv=final['uv'][i*2:i*2+2];col.data[loop.index].color=(*[c/255 for c in final['color'][i*3:i*3+3]],1)
native.normals_split_custom_set([(final['normal'][l.vertex_index*3]/32767,-final['normal'][l.vertex_index*3+2]/32767,final['normal'][l.vertex_index*3+1]/32767) for l in native.loops]);native.materials.append(bakery.data.materials[0]);bakery.data=native
bakery['awning_revision']='continuous bowed tension panels, rounded hanging scallops and turned cloth hem v114'
bpy.data.objects.remove(cloth,do_unlink=True)
updated=dict(data);updated['meshes']=dict(data['meshes']);updated['meshes'][KEY]=after;updated['source']='Blender 5.2 / tools/stage_berlin_architecture_awning_v114.py'
for key in data['meshes']:
    if key!=KEY:assert updated['meshes'][key]==data['meshes'][key]
for suffix in ('.json','.inline.js'):
    with open(os.path.join(OUT,PREFIX+suffix),'w') as f:f.write(('var BERLIN_REFERENCE_ARCHITECTURE = ' if suffix=='.inline.js' else '')+json.dumps(updated,separators=(',',':'))+(';\n' if suffix=='.inline.js' else ''))
shutil.copyfile(os.path.join(BASE,PREFIX+'-atlas.png'),os.path.join(OUT,PREFIX+'-atlas.png'))
bpy.ops.object.select_all(action='DESELECT')
for obj in objects.values():
    obj.select_set(True);obj.data.color_attributes.active_color_index=obj.data.color_attributes.find('Color');obj.data.color_attributes.render_color_index=obj.data.color_attributes.find('Color')
bpy.context.view_layer.objects.active=bakery
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,PREFIX+'.glb'),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True,export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=False,export_extras=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,PREFIX+'.blend'))
report={'baselineSha256':hashes,'originalTriangles':original['triangles'],'removedClothTriangles':len(OLD_IDS),'newClothTriangles':addition['triangles'],'triangles':after['triangles'],'allOriginalAttributeArraysExactPrefixes':True,'protectedTriangleIndicesExactAndSameOrder':True,'protectedTriangles':len(protected_ix)//3,'removedOldFaceRange':[min(OLD_IDS),max(OLD_IDS)],'newClothFaceStart':len(protected_ix)//3,'newClothVertexStart':offset,'otherElevenRecordsExact':True,'completeBoundsExact':True,'clothBounds':[addition['min'],addition['max']],'noContactRebake':True,'materialDrawsAdded':0,'panels':12,'scallopSegmentsPerPanel':12,'canopyDepthSegments':6,'clothThickness':THICK}
json.dump(report,open(os.path.join(STAGE,'awning-report.json'),'w'),indent=2)
print('AWNING_V114_STAGED',json.dumps({k:v for k,v in report.items() if k!='baselineSha256'}),flush=True)
if '--render' in sys.argv:
    for obj in objects.values():obj.hide_render=obj!=bakery
    origin=bakery.location.copy();target=origin+Vector((-2.7,-1,4.35))
    bpy.ops.object.camera_add(location=origin+Vector((-8.5,-12,8.0)))
    camera=bpy.context.object;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=9.0;bpy.context.scene.camera=camera
    for location,energy,color in [((-7,-8,11),1350,(1,.83,.65)),((5,-4,8),650,(.75,.85,1))]:
        bpy.ops.object.light_add(type='AREA',location=origin+Vector(location));light=bpy.context.object;light.data.energy=energy;light.data.color=color;light.data.size=5;light.rotation_euler=(target-light.location).to_track_quat('-Z','Y').to_euler()
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.render.threads_mode='FIXED';scene.render.threads=2;scene.world.color=(.30,.35,.42);scene.view_settings.view_transform='AgX';scene.render.resolution_x=900;scene.render.resolution_y=650;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(STAGE,'awning-preview.png');bpy.ops.render.render(write_still=True)
