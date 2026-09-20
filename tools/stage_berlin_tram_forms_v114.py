"""Refine the accepted vintage tram cab; never reconstruct its body or roof.

Blender -b -t 2 --python tools/stage_berlin_tram_forms_v114.py [-- --render]
Only writes audit/berlin-model-forms-v114/tram. Runtime JSON copies protected
packed records verbatim. Native edits start from the actual accepted .blend.
"""
import bpy, bmesh, base64, copy, hashlib, json, math, os, shutil, struct, sys
from mathutils import Matrix, Vector, Quaternion

ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STAGE=os.path.join(ROOT,'audit','berlin-model-forms-v114','tram')
BASE=os.path.join(STAGE,'baseline'); OUT=os.path.join(STAGE,'models')
PREFIX='berlin-vintage-tram-v90'
os.makedirs(BASE,exist_ok=True); os.makedirs(OUT,exist_ok=True)
def read(p):
    with open(p,'rb') as f:return f.read()
def dump(p,v):
    with open(p,'w') as f:json.dump(v,f,indent=2)
def sha(v):return hashlib.sha256(v).hexdigest()
for ext in ('blend','glb','json','inline.js'):
    dst=os.path.join(BASE,PREFIX+'.'+ext)
    if not os.path.exists(dst):shutil.copyfile(os.path.join(ROOT,'assets','models',PREFIX+'.'+ext),dst)
before=json.loads(read(os.path.join(BASE,PREFIX+'.json'))); after=copy.deepcopy(before)
bpy.ops.wm.open_mainfile(filepath=os.path.join(BASE,PREFIX+'.blend'))
bpy.context.preferences.filepaths.save_version=0
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def native(p):return (p[0],-p[2],p[1])
def game(p):return (p[0],p[2],-p[1])
def digest(o):
    m=o.data;m.calc_loop_triangles();h=hashlib.sha256()
    for v in m.vertices:h.update(struct.pack('<3f',*v.co))
    for l in m.loops:h.update(struct.pack('<I',l.vertex_index))
    for t in m.loop_triangles:h.update(struct.pack('<3I',*t.loops))
    for n in m.corner_normals:h.update(struct.pack('<3f',*n.vector))
    for uv in m.uv_layers:
        for d in uv.data:h.update(struct.pack('<2f',*d.uv))
    for p in m.polygons:h.update(struct.pack('<IB',p.material_index,p.use_smooth))
    return h.hexdigest()
objects=[o for o in bpy.context.scene.objects if o.type=='MESH']
baseline_native={o.name:{'mesh':digest(o),'matrix':[float(v) for row in o.matrix_world for v in row]} for o in objects}
materials={}
for o in objects:
    if 'material_role' in o:materials[o['material_role']]=o.data.materials[0]
body=bpy.data.objects['Vintage tram continuous body']
for m in body.data.materials:
    for role in ('yellow','cream'):
        if role in m.name.lower():materials[role]=m
parts={p['mesh']:p for p in after['parts']}; edited=[]; added=[]

LAYERS=[(.44,1.04,3.76),(.54,1.15,3.84),(.76,1.205,3.89),(1.15,1.22,3.89),
        (1.30,1.22,3.89),(1.64,1.21,3.88),(2.43,1.17,3.85),(2.58,1.15,3.81),
        (2.69,1.055,3.73),(2.775,.85,3.57),(2.83,.55,3.39),(2.855,.25,3.24)]
def nose(x,y):
    width,depth=LAYERS[0][1:]
    for a,b in zip(LAYERS,LAYERS[1:]):
        if y<=b[0]:
            t=max(0,(y-a[0])/(b[0]-a[0]));width=a[1]+(b[1]-a[1])*t;depth=a[2]+(b[2]-a[2])*t;break
    corner=.37*width;flat=width-corner;xx=min(abs(x),width)
    if xx<=flat:return depth-.04*(xx/flat)**2
    back=min(3.34,depth-.42)
    return back+(depth-.04-back)*math.sqrt(max(0,1-((xx-flat)/corner)**2))

def build(name,vertices,faces,role,uvs=None):
    if name in bpy.data.objects:
        obj=bpy.data.objects[name]; inverse=obj.matrix_world.inverted()
        vertices=[game(inverse@Vector(native(p))) for p in vertices]
        edited.append(name)
    else:
        obj=bpy.data.objects.new(name,bpy.data.meshes.new(name));bpy.context.collection.objects.link(obj)
        objects.append(obj);added.append(name)
        part={'mesh':name,'role':role,'translation':[0,0,0],'quaternion':[0,0,0,1],'scale':[1,1,1]}
        after['parts'].append(part);parts[name]=part
    mesh=bpy.data.meshes.new(name+' sculpted cab');mesh.from_pydata([native(p) for p in vertices],[],faces);mesh.update()
    obj.data=mesh;mesh.materials.append(materials[role]);obj['material_role']=role;parts[name]['role']=role
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    uv=mesh.uv_layers.new(name='UVMap')
    for loop in mesh.loops:
        i=loop.vertex_index;p=vertices[i]
        uv.data[loop.index].uv=uvs[i] if uvs else ((p[0]+1.25)/2.5,(p[1]-.4)/2.5)
    for poly in mesh.polygons:poly.use_smooth=True
    mesh.set_sharp_from_angle(angle=math.radians(64));mesh.update()
    return obj

def perimeter(w,h,r,cy=1.905):
    pts=[]
    for cx,yy,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for i in range(6):
            a=math.radians(start+i*15);pts.append((cx+r*math.cos(a),cy+yy+r*math.sin(a)))
    return pts
def surround(name,end,sections,role):
    vertices=[];faces=[]
    for w,h,r,offset in sections:
        vertices.extend((x,y,end*(nose(x,y)+offset)) for x,y in perimeter(w,h,r))
    for row in range(len(sections)-1):
        for i in range(24):j=(i+1)%24;faces.append((row*24+i,row*24+j,(row+1)*24+j,(row+1)*24+i))
    return build(name,vertices,faces,role)
def tube(name,end,points,r,role,segments=6):
    vertices=[];faces=[]
    for pi,(x,y) in enumerate(points):
        a=points[max(0,pi-1)];b=points[min(len(points)-1,pi+1)]
        dx=b[0]-a[0];dy=b[1]-a[1];length=math.hypot(dx,dy)
        for k in range(segments):
            angle=k*math.tau/segments;xx=x-r*dy/length*math.cos(angle);yy=y+r*dx/length*math.cos(angle)
            vertices.append((xx,yy,end*(nose(xx,yy)+.007+r+r*math.sin(angle))))
    # A square-section wiper is intentional; its silhouette is readable at small scale.
    for row in range(len(points)-1):
        for i in range(segments):j=(i+1)%segments;faces.append((row*segments+i,row*segments+j,(row+1)*segments+j,(row+1)*segments+i))
    faces.extend([tuple(reversed(range(segments))),tuple((len(points)-1)*segments+i for i in range(segments))])
    return build(name,vertices,faces,role)

for end,start in [(-1,86),(1,103)]:
    # Substantial rounded coachwork shoulders roll into a deep dark rubber
    # channel. The 14 cm surround narrows the overly broad bus-like windshield.
    surround('part_%03d'%start,end,[(2.14,1.17,.15,.006),(2.12,1.15,.14,.036),
             (1.88,1.095,.115,.046),(1.84,1.065,.10,.004)],'cream')
    surround('cab_gasket_'+str(start),end,[(1.856,1.08,.108,.008),(1.828,1.055,.098,.018),
             (1.76,1.005,.083,-.014)],'dark')
    # Keep the accepted real curved glazing and texture; narrow only its width
    # so it sits behind the new recessed, rounded gasket rather than on top.
    for pid in (start+1,start+3):
        name='part_%03d'%pid;o=bpy.data.objects[name]; inv=o.matrix_world.inverted()
        for v in o.data.vertices:
            p=Vector(game(o.matrix_world@v.co));old_x=p.x;old_gap=nose(p.x,p.y)-abs(p.z);p.x*=.875
            p.z=end*(nose(p.x,p.y)-old_gap-.018)
            v.co=inv@Vector(native(p))
        o.data.update();edited.append(name)
    # Dark central structural post with rounded shoulders, matching the
    # reference window language rather than a bright stripe pasted on glass.
    name='part_%03d'%(start+5);o=bpy.data.objects[name]
    inv=o.matrix_world.inverted()
    for v in o.data.vertices:
        p=Vector(game(o.matrix_world@v.co));p.x*=1.32
        p.z=end*(nose(p.x,p.y)-.013+(abs(p.z)-nose(p.x,p.y))*.12)
        v.co=inv@Vector(native(p))
    o.data.materials.clear();o.data.materials.append(materials['dark']);o['material_role']='dark';parts[name]['role']='dark'
    o.data.update();edited.append(name)
    # A real curved belt rail was previously largely buried in the yellow nose.
    vertices=[];faces=[];xs=[-1.075,-1.00,-.9,-.75,-.55,-.3,0,.3,.55,.75,.9,1,1.075]
    for x in xs:
        for k in range(8):
            a=k*math.tau/8;y=1.303+.035*math.sin(a)
            vertices.append((x,y,end*(nose(x,y)+.022+.018*math.cos(a))))
    for row in range(len(xs)-1):
        for k in range(8):faces.append((row*8+k,row*8+(k+1)%8,(row+1)*8+(k+1)%8,(row+1)*8+k))
    faces.extend([tuple(reversed(range(8))),tuple((len(xs)-1)*8+i for i in range(8))])
    build('part_%03d'%(start+6),vertices,faces,'cream')
    # Broad lower skirt, rolled in vertically as well as around each corner.
    # Reuses the dark bumper batch and stays within the original obstacle box.
    vertices=[];faces=[]
    for y,hw,offset in [(.46,.96,.046),(.48,1.055,.066),(.62,1.095,.066),(.66,1.06,.040)]:
        for t in [-1,-.94,-.84,-.67,-.4,0,.4,.67,.84,.94,1]:
            x=t*hw;vertices.append((x,y,end*(nose(x,y)+offset)))
    for row in range(3):
        for k in range(10):faces.append((row*11+k,row*11+k+1,(row+1)*11+k+1,(row+1)*11+k))
    faces.extend([tuple(reversed(range(11))),tuple(33+i for i in range(11))])
    build('part_%03d'%(start+7),vertices,faces,'dark')
    for pid,side in [(start+2,-1),(start+4,1)]:
        tube('part_%03d'%pid,end,[(side*.55,1.425),(side*.54,1.53),(side*.19,1.82)],.016,'dark')

def packed(obj):
    m=obj.data;m.calc_loop_triangles();arrays={k:[] for k in ('position','normal','uv','index')}; lookup={}
    for t in m.loop_triangles:
        for li in t.loops:
            l=m.loops[li];p=game(m.vertices[l.vertex_index].co);n=game(m.corner_normals[li].vector);uv=m.uv_layers.active.data[li].uv
            values=(tuple(round(v,6) for v in p),tuple(max(-32767,min(32767,round(v*32767))) for v in n),tuple(round(v,6) for v in uv))
            if values not in lookup:
                lookup[values]=len(arrays['position'])//3
                for name,vals in zip(('position','normal','uv'),values):arrays[name].extend(vals)
            arrays['index'].append(lookup[values])
    r={k:base64.b64encode(struct.pack('<'+fmt*len(arrays[k]),*arrays[k])).decode() for k,fmt in [('position','f'),('normal','h'),('uv','f'),('index','H')]}
    r.update(vertices=len(arrays['position'])//3,triangles=len(arrays['index'])//3,
      min=[min(arrays['position'][i::3]) for i in range(3)],max=[max(arrays['position'][i::3]) for i in range(3)])
    return r
for name in edited+added:after['meshes'][name]=packed(bpy.data.objects[name])
after['source']='Blender 5.2 / tools/stage_berlin_tram_forms_v114.py; accepted hollow body and V103 roof exact'
after['cabRevision']='sculpted-recessed-cab-v114'
protected=[name for name in before['meshes'] if name not in edited]
for name in protected:assert before['meshes'][name]==after['meshes'][name]
for p in before['parts']:
    q=parts[p['mesh']]
    for k in ('translation','quaternion','scale'):assert p[k]==q[k]
for name,old in baseline_native.items():
    if name not in edited:
        o=bpy.data.objects[name];assert digest(o)==old['mesh'],name
        assert [float(v) for row in o.matrix_world for v in row]==old['matrix'],name
assert after['colors']==before['colors'] and after['glassTexture']==before['glassTexture']
bpy.context.view_layer.update()
low=[float('inf')]*3; high=[float('-inf')]*3
for o in objects:
    for v in o.data.vertices:
        p=game(o.matrix_world@v.co)
        for i in range(3):low[i]=min(low[i],p[i]);high[i]=max(high[i],p[i])
assert low[0]>=-1.25001 and high[0]<=1.25001 and low[1]>=-.00001 and high[1]<=4.10001 and low[2]>=-4.00001 and high[2]<=4.00001,(low,high)
after['renderBounds']={'min':low,'max':high}
total=sum(r['triangles'] for r in after['meshes'].values());assert total<=10000,total
assert len(set(p['role'] for p in after['parts']))==9
raw=json.dumps(after,separators=(',',':'))
with open(os.path.join(OUT,PREFIX+'.json'),'w') as f:f.write(raw)
with open(os.path.join(OUT,PREFIX+'.inline.js'),'w') as f:f.write('var BERLIN_VINTAGE_TRAM_DATA = '+raw+';\n')
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,PREFIX+'.glb'),use_selection=True,export_format='GLB',export_normals=True,export_materials='EXPORT',export_yup=True)
bpy.context.scene['cab_stage']='v114: deeper rounded narrow cab glazing, dimensional belt and skirt; original body and roof exact'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,PREFIX+'.blend'))
report={'ok':True,'triangles':total,'deltaTriangles':total-7796,'materials':9,'editedParts':edited,'addedParts':added,
        'protectedPackedMeshesExact':protected,'protectedNativeMeshesExact':[n for n in baseline_native if n not in edited],
        'allExistingPartTransformsExact':True,'bodyGeometryExact':True,'roofGeometryAndTransformsExact':True,
        'glassTextureExact':True,'colorsExact':True,'collisionContract':after['collisionContract'],'renderBounds':after['renderBounds'],
        'baselineHashes':{ext:sha(read(os.path.join(BASE,PREFIX+'.'+ext))) for ext in ('blend','glb','json','inline.js')}}
dump(os.path.join(STAGE,'build-report.json'),report)
print('TRAM_V114_STAGED',json.dumps({k:v for k,v in report.items() if not isinstance(v,list)}),flush=True)
if '--render' in sys.argv:
    scene=bpy.context.scene;scene.render.resolution_x=900;scene.render.resolution_y=700;scene.render.resolution_percentage=100
    scene.render.threads_mode='FIXED';scene.render.threads=2;scene.cycles.samples=24
    scene.camera.location=(6,12,5.4);scene.camera.rotation_euler=(Vector((0,0,1.85))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.camera.data.type='ORTHO';scene.camera.data.ortho_scale=9.6
    scene.render.filepath=os.path.join(STAGE,'tram-cab-preview.png');bpy.ops.render.render(write_still=True)
