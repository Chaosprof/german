"""Round the accepted native Kiez masters without rebuilding protected art.

Blender -b -t 2 --python tools/stage_berlin_architecture_forms_v114.py
New profile meshes are appended to exact existing runtime payloads; the native
scene and GLB include the same geometry for continued editing.
"""
import os,sys,json,math,struct,base64,shutil,hashlib,collections
import bpy
from mathutils import Vector
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from berlin_mesh_pack import packed_geometry
STAGE=os.path.join(ROOT,'audit','berlin-model-forms-v114','architecture')
REFINED='--refined' in sys.argv
BASE=os.path.join(STAGE,'baseline');OUT=os.path.join(STAGE,'refined-models' if REFINED else 'models')
os.makedirs(BASE,exist_ok=True);os.makedirs(OUT,exist_ok=True)
PREFIX='berlin-reference-architecture-v1'
for suffix in ('.blend','.glb','.json','.inline.js','-atlas.png'):
    name=PREFIX+suffix
    if not os.path.exists(os.path.join(BASE,name)):
        shutil.copyfile(os.path.join(ROOT,'assets','models',name),os.path.join(BASE,name))
data=json.load(open(os.path.join(BASE,PREFIX+'.json')))
bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,PREFIX+'.blend'))
bpy.context.preferences.filepaths.save_version=0
objects={o['runtime_key']:o for o in bpy.context.scene.objects if o.type=='MESH' and o.get('runtime_key')}

def unpack(rec):
    result={}
    for field,fmt in [('position','f'),('normal','h'),('uv','f'),('color','B'),('index','H' if rec['vertices']<65536 else 'I')]:
        raw=base64.b64decode(rec[field]);result[field]=list(struct.unpack('<'+fmt*(len(raw)//struct.calcsize(fmt)),raw))
    return result
def components(raw):
    p=raw['position'];inds=raw['index'];lookup={};parents=[];weld=[]
    def find(i):
        while parents[i]!=i:parents[i]=parents[parents[i]];i=parents[i]
        return i
    for i in range(0,len(p),3):
        key=tuple(p[i:i+3])
        if key not in lookup:lookup[key]=len(parents);parents.append(len(parents))
        weld.append(lookup[key])
    for t in range(0,len(inds),3):
        a=find(weld[inds[t]])
        for j in (1,2):parents[find(weld[inds[t+j]])]=a
    out={}
    for t in range(0,len(inds),3):
        g=out.setdefault(find(weld[inds[t]]),{'faces':[],'vertices':set(),'tiles':collections.Counter()})
        g['faces'].append(t//3);g['vertices'].update(inds[t:t+3])
        u=sum(raw['uv'][v*2] for v in inds[t:t+3])/3;v=sum(raw['uv'][v*2+1] for v in inds[t:t+3])/3
        g['tiles'][math.floor(u*4)+math.floor((1-v)*4)*4]+=1
    return list(out.values())
def linear(hexcode):
    vals=[((hexcode>>s)&255)/255 for s in (16,8,0)]
    return [v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in vals]
def outline(w,h,arch,offset=0,segments=12):
    hw=w/2;hh=h/2;r=min(w*.5,h*.37) if arch else 0
    if not arch:return [(-hw-offset,-hh-offset),(hw+offset,-hh-offset),(hw+offset,hh+offset),(-hw-offset,hh+offset)]
    out=[(-hw-offset,-hh-offset),(hw+offset,-hh-offset),(hw+offset,hh-r)]
    for i in range(1,segments+1):
        a=i*math.pi/segments;out.append((math.cos(a)*(hw+offset),hh-r+math.sin(a)*(r+offset)))
    return out

class Forms:
    def __init__(self,name,material):
        self.name=name;self.material=material;self.p=[];self.faces=[];self.n=[];self.c=[];self.uv=[];self.parts=[]
    def surface(self,points,faces,normals,color,shade=None,label='form'):
        start=len(self.p);triangles=0;rgb=linear(color)
        for i,(p,n) in enumerate(zip(points,normals)):
            self.p.append((p[0],-p[2],p[1]));self.n.append((n[0],-n[2],n[1]))
            # White atlas tile preserves coherent paint; rounded normals and a
            # restrained underside wash carry the shape without a new texture.
            factor=(.91+.09*max(0,n[1]))*(shade[i] if shade else 1)
            self.c.append(tuple(v*factor for v in rgb)+(1,));self.uv.append((.125,.875))
        for face in faces:
            self.faces.append(tuple(start+i for i in face));triangles+=len(face)-2
        self.parts.append({'name':label,'triangles':triangles})
    def ring(self,center,w,h,arch,profile,color,angle=0,segments=12,label='architrave'):
        # Closed profile around an unaltered opening. The original recessed
        # glass/returns stay visible and preserve their baked contact paint.
        ca=math.cos(angle);sa=math.sin(angle);points=[];normals=[];shade=[];faces=[]
        contours=[outline(w,h,arch,r,segments) for r,z,s in profile];N=len(contours[0]);M=len(profile)
        def world(x,y,z):return (center[0]+x*ca+z*sa,center[1]+y,center[2]-x*sa+z*ca)
        for j,(r,z,s) in enumerate(profile):
            for i,(x,y) in enumerate(contours[j]):
                prev=contours[j][(i-1)%N];nxt=contours[j][(i+1)%N]
                path=Vector((nxt[0]-prev[0],nxt[1]-prev[1],0)).normalized()
                prevP=contours[(j-1)%M][i];nextP=contours[(j+1)%M][i]
                prof=Vector((nextP[0]-prevP[0],nextP[1]-prevP[1],profile[(j+1)%M][1]-profile[(j-1)%M][1])).normalized()
                normal=prof.cross(path).normalized()
                points.append(world(x,y,z));normals.append((normal.x*ca+normal.z*sa,normal.y,-normal.x*sa+normal.z*ca));shade.append(s)
        for j in range(M):
            for i in range(N):faces.append((j*N+i,((j+1)%M)*N+i,((j+1)%M)*N+(i+1)%N,j*N+(i+1)%N))
        self.surface(points,faces,normals,color,shade,label)
    def prism(self,center,w,h,d,color,bevel=.045,angle=0,label='rounded joinery'):
        # A real rounded joinery extrusion with two-segment corner radii.
        # Its hidden end caps stay flat: 44 triangles, instead of beveling all
        # twelve box edges (108 triangles) for indistinguishable street reads.
        along_y=h>w;length=h if along_y else w;aa=(w if along_y else h)/2;bb=d/2
        radius=min(bevel,aa*.4,bb*.4);profile=[];profile_n=[]
        for a,b,start in [(aa-radius,bb-radius,0),(-aa+radius,bb-radius,90),(-aa+radius,-bb+radius,180),(aa-radius,-bb+radius,270)]:
            for step in range(3):
                t=math.radians(start+step*45);profile.append((a+radius*math.cos(t),b+radius*math.sin(t)));profile_n.append((math.cos(t),math.sin(t)))
        points=[];normals=[];faces=[];ca=math.cos(angle);sa=math.sin(angle)
        def local(side,i):
            a,b=profile[i];na,nb=profile_n[i]
            return ((a,side*length/2,b),(na,0,nb)) if along_y else ((side*length/2,a,b),(0,na,nb))
        def face(corners,normal_override=None):
            ids=[];localp=[];localn=[]
            for side,i in corners:
                p,n=local(side,i);localp.append(Vector(p));localn.append(Vector(normal_override or n))
            actual=(localp[1]-localp[0]).cross(localp[2]-localp[0])
            expected=sum(localn,Vector())
            if actual.dot(expected)<0:localp.reverse();localn.reverse()
            for p,n in zip(localp,localn):
                ids.append(len(points));points.append((center[0]+p.x*ca+p.z*sa,center[1]+p.y,center[2]-p.x*sa+p.z*ca));normals.append((n.x*ca+n.z*sa,n.y,-n.x*sa+n.z*ca))
            faces.append(tuple(ids))
        N=len(profile)
        for i in range(N):face([(-1,i),(1,i),(1,(i+1)%N),(-1,(i+1)%N)])
        for side in (-1,1):face([(side,i) for i in range(N)],(0,side,0) if along_y else (side,0,0))
        self.surface(points,faces,normals,color,label=label)
    def native(self):
        me=bpy.data.meshes.new(self.name);me.from_pydata(self.p,[],self.faces);me.update()
        uv=me.uv_layers.new(name='UVMap');col=me.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        for li,loop in enumerate(me.loops):
            uv.data[li].uv=self.uv[loop.vertex_index];col.data[li].color=self.c[loop.vertex_index]
        me.normals_split_custom_set([self.n[l.vertex_index] for l in me.loops]);me.materials.append(self.material)
        ob=bpy.data.objects.new(self.name,me);bpy.context.collection.objects.link(ob);return ob

UPPER=[(0,.055,.83),(.024,.143,.96),(.066,.188,1),(.135,.177,1),(.196,.098,.95),(.208,.026,.80),(0,.026,.78)]
SHOP=[(.003,.415,.71),(.018,.520,.84),(.056,.601,.97),(.115,.624,1),(.172,.585,.95),(.205,.526,.86),(.242,.505,.84),(.245,.405,.73),(.003,.405,.72)]
if REFINED:
    # Broad stone/timber faces, with small eased arrises. The earlier fully
    # convex section read like a hose at oblique gameplay angles.
    UPPER=[(0,.055,.83),(.022,.151,.96),(.044,.182,1),(.153,.182,1),(.188,.150,.95),(.208,.026,.80),(0,.026,.78)]
    SHOP=[(-.025,.415,.76),(-.025,.536,.91),(-.014,.558,.99),(.002,.566,1),(.177,.566,1),(.194,.558,.98),(.206,.540,.91),(.206,.497,.84),(.231,.497,.88),(.245,.484,.85),(.245,.405,.75),(-.025,.405,.74)]
summary={};updated=dict(data);updated['meshes']=dict(data['meshes'])
for variant in (0,1):
    key='13.5:'+str(variant)+':1';original=data['meshes'][key];raw=unpack(original);obj=objects[key]
    form=Forms(('Bakery' if variant==0 else 'Bookstore')+' sculpted profiles V114',obj.data.materials[0])
    window_count=0;window_specs=[]
    for g in components(raw):
        if set(g['tiles'])!={2}:continue
        ps=[Vector(raw['position'][v*3:v*3+3]) for v in g['vertices']]
        ymin=min(p.y for p in ps);ymax=max(p.y for p in ps)
        if abs(ymax-ymin-2.03)>.003:continue
        # Prioritize street-facing flat and curved bays; side-window fronts
        # are occluded between continuous lots and do not justify extra cost.
        ns=[Vector(raw['normal'][v*3:v*3+3]).normalized() for v in g['vertices']]
        normal=sum(ns,Vector()).normalized()
        if normal.z<.55:continue
        across=Vector((normal.z,0,-normal.x));lo=min(p.dot(across) for p in ps);hi=max(p.dot(across) for p in ps)
        depth=sum(p.dot(normal) for p in ps)/len(ps)
        # Curved-bay panes have a 12cm reveal; flat fronts have the later 23cm
        # reveal. Read this distinction from the actual glass plane.
        is_bay=variant==0 and min(p.z for p in ps)>.9
        center=across*((lo+hi)*.5)+normal*(depth+(.115 if is_bay else .23));center.y=(ymin+ymax)*.5
        angle=math.atan2(normal.x,normal.z);arch=len(g['faces'])>4
        profile=UPPER
        if REFINED and arch:
            # Cover the original 10-segment inner arris with a narrow smooth
            # lip. The panes and returns themselves remain untouched.
            profile=list(UPPER);profile[0]=(-.012,*profile[0][1:]);profile[-1]=(-.012,*profile[-1][1:])
        segments=(28 if is_bay else 24) if REFINED else 12
        form.ring(center,hi-lo,ymax-ymin,arch,profile,0xd2c1a5,angle,segments=segments,label='upper window layered stone architrave')
        push=normal*.08
        sill=center+push;sill.y=ymin-.19
        form.prism(sill,hi-lo+.55,.185,.44,0xd9c8ac,.044,angle,'rounded upper sill nose')
        window_specs.append({'center':list(center),'normal':list(normal),'width':hi-lo,'height':ymax-ymin,'arched':arch,'bay':is_bay,'profileMaxDepth':max(p[1] for p in profile),'profileWidth':.208,'arcSegments':segments,'innerLip':.012 if REFINED and arch else 0})
        window_count+=1
    if variant==1:
        for x in (-4.2,0,4.2):
            form.ring((x,2.21,0),3.6,3.36,True,SHOP,0x42685f,segments=28 if REFINED else 20,label='stepped bookstore arch with broad face' if REFINED else 'deep rounded bookstore arch')
            # The tall arches meet solid raised plinth panels, as on painted
            # Berlin timber shopfronts; counters and room openings stay clear.
            form.prism((x,.36,.52),3.78,.22,.28,0x35594f,.032,label='bookshop plinth rail')
            form.ring((x,.71,.365),3.28,.31,False,[(0,.06,.76),(.027,.117,1),(.06,.13,1),(.085,.075,.85),(.085,.03,.75),(0,.03,.75)],0x42665a,label='recessed timber base panel')
        for x in (-6.37,-2.1,2.1,6.37):
            form.prism((x,2.09,.535),.255,3.22,.19,0x42665b,.035,label='soft timber pilaster')
            form.prism((x,.67,.57),.40,.32,.28,0x38584f,.04,label='pilaster pedestal')
            form.prism((x,3.87,.58),.43,.20,.33,0x486d60,.038,label='rounded pilaster capital')
            form.prism((x,3.99,.60),.49,.08,.37,0x486d60,.015,label='capital abacus')
        form.prism((0,4.61,.44),13.56,.15,.39,0x3d6257,.034,label='continuous bookshop crown')
    else:
        # Actual V99 display center/width retained, including its expanded
        # masonry. Rich rounded reveals stay below the accepted cloth awning.
        x=(-5.8765+.326)*.5;w=5.53*13.5/11
        form.ring((x,2.81,0),w,4.56,False,[(.006,.418,.77),(.018,.495,.91),(.064,.545,1),(.12,.535,.98),(.16,.468,.89),(.162,.416,.78)],0x9d7954,label='rounded bakery display joinery')
        form.prism((x,.47,.48),w+.23,.16,.37,0xd9c4a0,.034,label='bakery display rounded stone sill')
        # Existing secondary doorway retains its original exact opening.
        form.ring((2.396,2.81,0),1.967,4.56,True,[(.004,.419,.76),(.025,.51,.94),(.074,.554,1),(.132,.512,.96),(.162,.423,.78)],0xb08c61,segments=28 if REFINED else 18,label='bakery rounded door arch')
    addition=form.native();addition.location=obj.location.copy();addon=packed_geometry(addition)
    # Append exact old buffers first. No original vertex, index, UV, normal,
    # painted shade, room, cloth or foliage value is touched by this pass.
    after=dict(original);off=original['vertices'];extra=unpack(addon)
    for field,fmt in [('position','f'),('normal','h'),('uv','f'),('color','B')]:
        after[field]=base64.b64encode(base64.b64decode(original[field])+base64.b64decode(addon[field])).decode('ascii')
    indices=raw['index']+[i+off for i in extra['index']];vc=off+addon['vertices']
    after['index']=base64.b64encode(struct.pack('<'+('H' if vc<65536 else 'I')*len(indices),*indices)).decode('ascii')
    after['vertices']=vc;after['triangles']=original['triangles']+addon['triangles']
    after['min']=[min(original['min'][i],addon['min'][i]) for i in range(3)];after['max']=[max(original['max'][i],addon['max'][i]) for i in range(3)]
    after['formsRevision']='stepped-smooth-architecture-v114' if REFINED else 'rounded-profile-architecture-v114';after['formsBaseTriangles']=original['triangles'];after['formsBaseVertices']=original['vertices']
    protected={}
    for field in ('position','normal','uv','color','index'):
        old=base64.b64decode(original[field]);new=base64.b64decode(after[field])
        assert new[:len(old)]==old,('Protected payload changed',key,field)
        protected[field]={'bytes':len(old),'sha256':hashlib.sha256(old).hexdigest()}
    updated['meshes'][key]=after
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);addition.select_set(True);bpy.context.view_layer.objects.active=obj
    bpy.ops.object.join();obj['forms_revision']='sculpted stone architraves and rounded timber portals v114'
    summary[key]={'upperFrontWindows':window_count,'windowSpecs':window_specs,'originalTriangles':original['triangles'],'originalVertices':original['vertices'],'addedTriangles':addon['triangles'],'triangles':after['triangles'],'vertices':vc,'newMaterials':0,'originalPayloadPrefixExact':True,'protectedPrefixes':protected,'parts':form.parts,'boundsBefore':[original['min'],original['max']],'boundsAfter':[after['min'],after['max']]}
for key in data['meshes']:
    if key not in summary:assert updated['meshes'][key]==data['meshes'][key]
updated['source']='Blender 5.2 / tools/stage_berlin_architecture_forms_v114.py'
for suffix in ('.json','.inline.js'):
    with open(os.path.join(OUT,PREFIX+suffix),'w') as f:f.write(('var BERLIN_REFERENCE_ARCHITECTURE = ' if suffix=='.inline.js' else '')+json.dumps(updated,separators=(',',':'))+(';\n' if suffix=='.inline.js' else ''))
shutil.copyfile(os.path.join(BASE,PREFIX+'-atlas.png'),os.path.join(OUT,PREFIX+'-atlas.png'))
bpy.ops.object.select_all(action='DESELECT')
for obj in objects.values():
    obj.select_set(True);obj.data.color_attributes.active_color_index=obj.data.color_attributes.find('Color');obj.data.color_attributes.render_color_index=obj.data.color_attributes.find('Color')
bpy.context.view_layer.objects.active=objects['13.5:0:1']
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,PREFIX+'.glb'),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True,export_vertex_color='NAME',export_vertex_color_name='Color',export_all_vertex_colors=False,export_extras=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,PREFIX+'.blend'))
json.dump(summary,open(os.path.join(STAGE,'refined-forms-report.json' if REFINED else 'forms-report.json'),'w'),indent=2)
print('ARCHITECTURE_V114_STAGED',json.dumps({k:{a:b for a,b in v.items() if a not in ('parts','windowSpecs','protectedPrefixes')} for k,v in summary.items()}),flush=True)
if '--render' in sys.argv:
    for ob in objects.values():ob.hide_render=ob.get('runtime_key') not in ('13.5:0:1','13.5:1:1')
    for variant in (0,1):
        obj=objects['13.5:'+str(variant)+':1'];loc=obj.location.copy()
        bpy.ops.object.camera_add(location=loc+Vector((12,-23,10)))
        camera=bpy.context.object;camera.rotation_euler=(loc+Vector((0,0,6))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=18
        bpy.context.scene.camera=camera
        bpy.ops.object.light_add(type='AREA',location=loc+Vector((-9,-12,18)));light=bpy.context.object;light.data.energy=2100;light.data.shape='DISK';light.data.size=7
        light.rotation_euler=(loc+Vector((0,0,5))-light.location).to_track_quat('-Z','Y').to_euler()
        scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.resolution_x=1000;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
        scene.world.color=(.33,.39,.49);scene.view_settings.view_transform='AgX'
        scene.render.filepath=os.path.join(STAGE,('bakery' if variant==0 else 'bookstore')+('-refined' if REFINED else '')+'-forms-preview.png');bpy.ops.render.render(write_still=True)
        bpy.data.objects.remove(camera,do_unlink=True);bpy.data.objects.remove(light,do_unlink=True)
