"""Author a rounded vintage tram shell in Blender, preserving accepted equipment.

Run node tools/export_berlin_tram_source.cjs first, then Blender -b -t 2
--python tools/build_berlin_tram_v90.py [-- --render]. All files stay staged.
"""
import bpy,bmesh,base64,json,math,os,sys,struct,hashlib
from mathutils import Vector,Matrix
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE=os.path.join(ROOT,'audit','berlin-tram-v90');OUT=os.path.join(STAGE,'models')
os.makedirs(OUT,exist_ok=True)
with open(os.path.join(STAGE,'baseline','tram-source.json')) as f:baseline=json.load(f)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0

def linear(hex_color):
    rgb=[(hex_color>>shift)&255 for shift in (16,8,0)]
    return tuple(((c/255+.055)/1.055)**2.4 if c>10 else c/3294.6 for c in rgb)
materials={}
for role,color in baseline['colors'].items():
    m=bpy.data.materials.new('Tram '+role);m.use_nodes=True;m.diffuse_color=(*linear(color),1)
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=m.diffuse_color
    p.inputs['Roughness'].default_value=.18 if role=='glass' else .4
    p.inputs['Metallic'].default_value=.24 if role=='steel' else .08
    if role in ('headlamp','tail'):
        p.inputs['Emission Color'].default_value=m.diffuse_color;p.inputs['Emission Strength'].default_value=.8
    materials[role]=m
rgba=bytearray(128*128*4)
for gy in range(128):
    for gx in range(128):
        sy=gy/127;sx=gx/127;sky=sy*sy*(3-2*sy)
        sweep=math.exp(-.5*((sx-.25-.18*sy)/.16)**2)*(.35+.65*sy)
        horizon=math.exp(-.5*((sy-.78)/.18)**2)
        street=(1-sy)**4
        color=(36+55*sky+30*sweep+14*horizon+8*street,
               48+75*sky+30*sweep+15*horizon+4*street,
               54+91*sky+26*sweep+16*horizon)
        rgba[(gy*128+gx)*4:(gy*128+gx)*4+4]=bytes([round(v) for v in color]+[255])
glass_texture={'width':128,'height':128,'data':base64.b64encode(rgba).decode('ascii')};pixels=[]
for i in range(0,len(rgba),4):pixels.extend((*linear((rgba[i]<<16)|(rgba[i+1]<<8)|rgba[i+2]),1))
image=bpy.data.images.new('Accepted tram opaque reflections',width=128,height=128,alpha=False)
image.pixels.foreach_set(pixels);image.pack();image.colorspace_settings.name='Non-Color'
node=materials['glass'].node_tree.nodes.new('ShaderNodeTexImage');node.image=image
materials['glass'].node_tree.links.new(node.outputs['Color'],materials['glass'].node_tree.nodes.get('Principled BSDF').inputs['Base Color'])

def native(p):return (p[0],-p[2],p[1])
def game(p):return (p[0],p[2],-p[1])
def make_mesh(name,vertices,faces,role=None):
    mesh=bpy.data.meshes.new(name);mesh.from_pydata([native(v) for v in vertices],[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    if role:mesh.materials.append(materials[role]);obj['material_role']=role
    return obj
def apply_modifier(obj,modifier):
    bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.modifier_apply(modifier=modifier.name);obj.select_set(False)

# Rounded plan sections flow continuously into a barrel roof. The deeper
# cab corners turn toward the sides rather than ending in a flat box face.
LAYERS=[(.44,1.04,3.76),(.54,1.15,3.84),(.76,1.205,3.89),
        (1.15,1.22,3.89),(1.30,1.22,3.89),(1.64,1.21,3.88),
        (2.43,1.17,3.85),(2.58,1.15,3.81),(2.69,1.055,3.73),
        (2.775,.85,3.57),(2.83,.55,3.39),(2.855,.25,3.24)]
XS=[-1,-.985,-.94,-.87,-.77,-.64,-.40,0,.40,.64,.77,.87,.94,.985,1]
def profile(y):
    if y<=LAYERS[0][0]:return LAYERS[0][1:]
    for i in range(1,len(LAYERS)):
        a,b=LAYERS[i-1],LAYERS[i]
        if y<=b[0]:
            t=(y-a[0])/(b[0]-a[0]);return (a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t)
    return LAYERS[-1][1:]
def nose(x,y):
    width,depth=profile(y);corner=.37*width;flat=width-corner;xx=min(abs(x),width)
    if xx<=flat:return depth-.04*(xx/flat)**2
    back=min(3.34,depth-.42);radius=depth-.04-back
    return back+radius*math.sqrt(max(0,1-((xx-flat)/corner)**2))
def ring(y,width,depth):
    front=[(u*width,y,-nose(u*width,y)) for u in XS]
    rear=[(u*width,y,nose(u*width,y)) for u in reversed(XS)]
    zside=min(3.34,depth-.42)
    return front+[(width,y,z) for z in (-2.58,0,2.58) if abs(z)<zside]+rear+[(-width,y,z) for z in (2.58,0,-2.58) if abs(z)<zside]
vertices=[]
for y,width,depth in LAYERS:vertices.extend(ring(y,width,depth))
N=len(ring(*LAYERS[0]));assert all(len(ring(*r))==N for r in LAYERS)
faces=[]
for row in range(len(LAYERS)-1):
    for i in range(N):
        j=(i+1)%N;faces.append((row*N+i,row*N+j,(row+1)*N+j,(row+1)*N+i))
faces.extend([tuple(reversed(range(N))),tuple((len(LAYERS)-1)*N+i for i in range(N))])
body=make_mesh('Vintage tram continuous body',vertices,faces)
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()
shell=body.modifiers.new('Real 35 mm coachwork','SOLIDIFY');shell.thickness=.035;shell.offset=-1;apply_modifier(body,shell)

def cutter(name,width,height,depth,radius,center,side=False):
    perimeter=[]
    for cx,cy,start in [(width/2-radius,height/2-radius,0),(-width/2+radius,height/2-radius,90),(-width/2+radius,-height/2+radius,180),(width/2-radius,-height/2+radius,270)]:
        for j in range(7):
            a=math.radians(start+j*90/6);perimeter.append((cx+radius*math.cos(a),cy+radius*math.sin(a)))
    # The four arcs above progress CCW from each right/top extreme.
    pts=[]
    for d in (-depth/2,depth/2):
        for u,v in perimeter:
            pts.append((center[0]+(d if side else u),center[1]+v,center[2]+(u if side else d)))
    n=len(perimeter);polys=[tuple(reversed(range(n))),tuple(range(n,2*n))]
    polys.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    obj=make_mesh(name,pts,polys)
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    return obj
cutters=[]
for end in (-1,1):cutters.append(cutter('Actual cab aperture',2.10,1.13,1.05,.135,(0,1.905,end*3.74)))
for side in (-1,1):
    cutters.append(cutter('Actual passenger aperture',5.16,.94,.55,.025,(side*1.20,2.11,0),True))
    for z in (-2.96,2.915):cutters.append(cutter('Actual door aperture',.74,1.93,.55,.025,(side*1.20,1.615,z),True))
for cut in cutters:
    boolean=body.modifiers.new('Real cab passenger and door openings','BOOLEAN');boolean.operation='DIFFERENCE';boolean.solver='EXACT';boolean.object=cut
    apply_modifier(body,boolean);bpy.data.objects.remove(cut,do_unlink=True)
    assert len(body.data.polygons)>0,'Aperture boolean emptied the body'
bm=bmesh.new();bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001)
bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00001)
bmesh.ops.triangulate(bm,faces=list(bm.faces))
# Exact booleans can leave a coincident opposing sliver at a tangent corner.
# Remove only paired duplicate triangles, retaining the aperture boundary.
face_groups={}
for face in bm.faces:
    key=tuple(sorted(tuple(round(v,6) for v in vert.co) for vert in face.verts))
    face_groups.setdefault(key,[]).append(face)
duplicates=[]
for group in face_groups.values():
    if len(group)>1:
        assert len(group)==2 and max(face.calc_area() for face in group)<.0001,'Unexpected duplicated coachwork patch'
        duplicates.extend(group)
if duplicates:bmesh.ops.delete(bm,geom=duplicates,context='FACES_ONLY')
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()
# The aperture corners are already rounded by their real cutters; preserve
# their 35 mm returns without spending thousands of triangles on tiny bevels.
body.data.materials.clear() # Boolean cutters can leave a leading empty slot.
body.data.materials.append(materials['yellow']);body.data.materials.append(materials['cream'])
for poly in body.data.polygons:
    center=sum((body.data.vertices[i].co for i in poly.vertices),Vector())/len(poly.vertices)
    p=game(center);poly.material_index=int(p[1]>=1.64 or abs(p[2])>3.34 and p[1]>=1.30)
    poly.use_smooth=True
body.data.set_sharp_from_angle(angle=math.radians(55));body.data.update()
uv=body.data.uv_layers.new(name='UVMap')
for loop in body.data.loops:
    x,y,z=game(body.data.vertices[loop.vertex_index].co);uv.data[loop.index].uv=((x+1.25)/2.5,(z+4)/8)

objects=[];protected=[];cab_count=0
for pi,part in enumerate(baseline['parts']):
    if pi<2:continue # Replace only the two accepted body material meshes.
    matrix=Matrix([part['matrix'][i::4] for i in range(4)]);inverse=matrix.inverted()
    raw=part['position'];world=[matrix@Vector(raw[i:i+3]) for i in range(0,len(raw),3)]
    is_cab=abs(part['translation'][2])>3.7
    if is_cab:
        cab_count+=1
        for p in world:
            end=1 if p.z>0 else -1
            old_depth=abs(p.z)+.065*(p.x/1.22)**2
            # Widen the panes into the rounded corners; retain the original
            # thin dark divider and the same opaque glass material.
            if part['role']=='glass':p.x*=1.20;p.y=1.91+(p.y-1.875)*1.06
            elif part['role']=='dark' and abs(part['translation'][1]-1.875)<.01 and part['translation'][0]==0:
                p.x*=1.12;p.y=1.91+(p.y-1.875)*1.06
            elif part['role']=='cream' and abs(part['translation'][1]-1.245)<.01:p.x*=1.10
            p.z=end*(nose(p.x,p.y)+old_depth-3.88)
        local=[inverse@p for p in world]
    else:local=[Vector(raw[i:i+3]) for i in range(0,len(raw),3)];protected.append(part['name'])
    faces=[part['index'][i:i+3] for i in range(0,len(part['index']),3)]
    custom_uv=None
    if is_cab and part['role']=='glass':
        # A sampled curved pane with square inner edges avoids two rounded
        # sticker panels. Both halves follow the actual wraparound aperture.
        side=1 if part['translation'][0]>0 else -1;end=1 if part['translation'][2]>0 else -1
        ys=[1.37,1.42,1.49,1.91,2.33,2.40,2.45];fractions=[0,.25,.5,.72,.88,1]
        verts=[];custom_uv=[];faces=[];W=len(fractions);H=len(ys)
        for back in (False,True):
            for y in ys:
                corner=max(0,abs(y-1.91)-(.54-.12));outer=1.015-.12+math.sqrt(max(0,.12**2-corner**2))
                for u in fractions:
                    x=side*(.012+(outer-.012)*u);z=end*(nose(x,y)-(.043 if back else .029))
                    verts.append((x,y,z));custom_uv.append((u if side>0 else 1-u,(y-1.37)/1.08))
        for back in range(2):
            offset=back*W*H
            for row in range(H-1):
                for col in range(W-1):
                    a=offset+row*W+col;faces.append((a,a+1,a+1+W,a+W))
        boundary=list(range(W))+[row*W+W-1 for row in range(1,H)]+list(reversed(range((H-1)*W,(H-1)*W+W-1)))+[row*W for row in reversed(range(1,H-1))]
        for i,a in enumerate(boundary):
            b=boundary[(i+1)%len(boundary)];faces.append((a,b,b+W*H,a+W*H))
        local=[inverse@Vector(p) for p in verts]
    elif is_cab and part['role']=='dark' and abs(part['translation'][1]-.63)<.01:
        # A curved tubular bumper needs intermediate columns; simply moving
        # the outer vertices of a wide box buries its flat middle in the nose.
        end=1 if part['translation'][2]>0 else -1;xs=[-1.01,-.9,-.76,-.6,-.4,-.2,0,.2,.4,.6,.76,.9,1.01]
        verts=[];faces=[];custom_uv=[]
        for x in xs:
            for k in range(8):
                angle=k*math.tau/8;y=.63+.072*math.sin(angle);z=end*(nose(x,.63)+.060+.048*math.cos(angle))
                verts.append((x,y,z));custom_uv.append(((x+1.01)/2.02,k/8))
        for col in range(len(xs)-1):
            for k in range(8):a=col*8+k;b=col*8+(k+1)%8;faces.append((a,b,b+8,a+8))
        faces.extend([tuple(reversed(range(8))),tuple((len(xs)-1)*8+k for k in range(8))])
        local=[inverse@Vector(p) for p in verts]
    elif is_cab and part['role']=='dark' and abs(part['translation'][1]-2.565)<.01:
        # The small header follows the forehead, too; its flat old cap cut
        # across the cream crown and left a bright wedge over the route sign.
        end=1 if part['translation'][2]>0 else -1;ys=[2.470,2.505,2.625,2.660];fractions=[0,.2,.4,.6,.8,1]
        verts=[];faces=[];custom_uv=[];W=len(fractions);H=len(ys)
        for back in (False,True):
            for y in ys:
                corner=max(0,abs(y-2.565)-(.095-.04));outer=.72-.04+math.sqrt(max(0,.04**2-corner**2))
                for u in fractions:
                    x=outer*(2*u-1);verts.append((x,y,end*(nose(x,y)+(.002 if back else .012))));custom_uv.append((u,(y-2.47)/.19))
        for back in range(2):
            for row in range(H-1):
                for col in range(W-1):a=back*W*H+row*W+col;faces.append((a,a+1,a+1+W,a+W))
        boundary=list(range(W))+[row*W+W-1 for row in range(1,H)]+list(reversed(range((H-1)*W,(H-1)*W+W-1)))+[row*W for row in reversed(range(1,H-1))]
        for i,a in enumerate(boundary):b=boundary[(i+1)%len(boundary)];faces.append((a,b,b+W*H,a+W*H))
        local=[inverse@Vector(p) for p in verts]
    role=part['role']
    if part['name'] in ('part_091','part_108'):
        # At an 80-100 px car width, a 5 cm light face reads as a 1-2 px
        # divider. Its existing geometry stays in the shared cream batch.
        width=max(p.x for p in local)-min(p.x for p in local)
        local=[Vector((p.x*(.050/width),p.y,p.z)) for p in local];role='cream'
    elif part['name'] in ('part_086','part_103'):
        # Replace the hidden dark backing with the actual cream aperture lip.
        # A shallow chamfer seats the glass inside the coachwork; no new draw.
        end=1 if part['translation'][2]>0 else -1;verts=[];custom_uv=[];faces=[]
        for inner in (False,True):
            width,height,radius=(2.028,1.06,.095) if inner else (2.128,1.16,.145)
            for cx,cy,start in [(width/2-radius,height/2-radius,0),(-width/2+radius,height/2-radius,90),(-width/2+radius,-height/2+radius,180),(width/2-radius,-height/2+radius,270)]:
                for k in range(6):
                    angle=math.radians(start+k*90/6);x=cx+radius*math.cos(angle);y=1.905+cy+radius*math.sin(angle)
                    verts.append((x,y,end*(nose(x,y)+(-.010 if inner else .008))));custom_uv.append(((x+1.064)/2.128,(y-1.325)/1.16))
        for k in range(24):
            j=(k+1)%24;face=(k,j,j+24,k+24)
            if end>0:face=tuple(reversed(face))
            faces.append(face)
        local=[inverse@Vector(p) for p in verts];role='cream'
    obj=make_mesh(part['name'],[tuple(p) for p in local],faces,role)
    if custom_uv is not None:
        bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    # Keep the object placement contract so runtime trim probes and pooling
    # retain the original local transforms.
    convert=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
    obj.matrix_world=convert@matrix@convert.inverted()
    obj['accepted_part']=part['name'];obj['cab_refit']=is_cab
    tex=obj.data.uv_layers.new(name='UVMap')
    for loop in obj.data.loops:
        v=loop.vertex_index;tex.data[loop.index].uv=custom_uv[v] if custom_uv is not None else part['uv'][v*2:v*2+2]
    if not is_cab:
        normals=[native(part['normal'][loop.vertex_index*3:loop.vertex_index*3+3]) for loop in obj.data.loops]
        obj.data.normals_split_custom_set(normals)
    else:
        for poly in obj.data.polygons:poly.use_smooth=True
        obj.data.set_sharp_from_angle(angle=math.radians(65))
    objects.append(obj)

def packed(obj,material_index=None):
    me=obj.data;me.calc_loop_triangles();arrays={k:[] for k in ('position','normal','uv','index')};lookup={}
    for tri in me.loop_triangles:
        if material_index is not None and me.polygons[tri.polygon_index].material_index!=material_index:continue
        for li in tri.loops:
            loop=me.loops[li];p=game(me.vertices[loop.vertex_index].co);n=game(me.corner_normals[li].vector);uv=me.uv_layers.active.data[li].uv
            values=(tuple(round(v,6) for v in p),tuple(max(-32767,min(32767,round(v*32767))) for v in n),tuple(round(v,6) for v in uv))
            key=values
            if key not in lookup:
                lookup[key]=len(arrays['position'])//3
                for name,vals in zip(('position','normal','uv'),values):arrays[name].extend(vals)
            arrays['index'].append(lookup[key])
    count=len(arrays['position'])//3
    record={k:base64.b64encode(struct.pack('<'+fmt*len(arrays[k]),*arrays[k])).decode('ascii') for k,fmt in [('position','f'),('normal','h'),('uv','f'),('index','H')]}
    record.update(vertices=count,triangles=len(arrays['index'])//3,min=[min(arrays['position'][i::3]) for i in range(3)],max=[max(arrays['position'][i::3]) for i in range(3)])
    return record
records={};parts=[]
for index,role in enumerate(('yellow','cream')):
    key='body_'+role;records[key]=packed(body,index);parts.append({'mesh':key,'role':role,'translation':[0,0,0],'quaternion':[0,0,0,1],'scale':[1,1,1]})
for obj,source in zip(objects,baseline['parts'][2:]):
    records[obj.name]=packed(obj);parts.append({'mesh':obj.name,'role':obj['material_role'],'translation':source['translation'],'quaternion':source['quaternion'],'scale':source['scale']})
data={'version':1,'source':'Blender 5.2 / tools/build_berlin_tram_v90.py','meshes':records,'parts':parts,'colors':baseline['colors'],'glassTexture':glass_texture}
triangles=sum(r['triangles'] for r in records.values());body_triangles=sum(records['body_'+role]['triangles'] for role in ('yellow','cream'))
assert triangles<=8000,('Tram triangle budget',triangles,body_triangles)
for obj in [body]+objects:
    for v in obj.data.vertices:
        x,y,z=game(obj.matrix_world@v.co)
        assert abs(x)<=1.25001 and -.00001<=y<=3.15001 and abs(z)<=4.00001,('Envelope',obj.name,x,y,z)
with open(os.path.join(OUT,'berlin-vintage-tram-v90.json'),'w') as f:json.dump(data,f,separators=(',',':'))
with open(os.path.join(OUT,'berlin-vintage-tram-v90.inline.js'),'w') as f:f.write('var BERLIN_VINTAGE_TRAM_DATA = '+json.dumps(data,separators=(',',':'))+';\n')
body['source']='Blender lofted hollow coachwork, actual boolean apertures, rounded returns'
body['reference']='audit/berlin-kiez-art-direction-v1.png'
bpy.ops.object.select_all(action='DESELECT')
for obj in [body]+objects:obj.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'berlin-vintage-tram-v90.glb'),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True)
bpy.context.scene.world.color=(.22,.26,.32)
bpy.ops.object.light_add(type='AREA',location=(-5,-7,8));light=bpy.context.object;light.data.energy=1200;light.data.size=5;light.data.color=(1,.87,.70)
light.rotation_euler=(Vector((0,0,1.4))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.light_add(type='AREA',location=(5,3,6));fill=bpy.context.object;fill.data.energy=750;fill.data.size=6
fill.rotation_euler=(Vector((0,0,1.4))-fill.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(7,11,5.5));camera=bpy.context.object;camera.rotation_euler=(Vector((0,0,1.5))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=10.0
scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.cycles.use_denoising=True
scene.render.threads_mode='FIXED';scene.render.threads=2;scene.render.resolution_x=850;scene.render.resolution_y=650;scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=os.path.join(STAGE,'tram-v90-preview.png')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'berlin-vintage-tram-v90.blend'))
report={'triangles':triangles,'body_triangles':body_triangles,'opaque_material_roles':len(set(p['role'] for p in parts)),
        'parts':len(parts),'preserved_equipment_parts':len(protected),'cab_refitted_parts':cab_count,'envelope':[2.5,3.15,8],
        'front':'-Z','actual_hollow_shell':True,'real_apertures':8,'source':'tools/build_berlin_tram_v90.py',
        'cab_readability_revision':{'center_mullion_width':.050,'aperture_lip_width':.050,'sky_reflection_texture':[128,128]}}
with open(os.path.join(STAGE,'build-report.json'),'w') as f:json.dump(report,f,indent=2)
print('TRAM_V90_BUILT',json.dumps(report),flush=True)
if '--render' in sys.argv:
    bpy.ops.mesh.primitive_plane_add(size=100,location=(0,0,-.012));ground=bpy.context.object
    material=bpy.data.materials.new('Preview ground');material.diffuse_color=(.35,.32,.28,1);ground.data.materials.append(material)
    bpy.ops.render.render(write_still=True)
